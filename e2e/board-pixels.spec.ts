import { expect, type Page, test } from "@playwright/test";

/** Reads a computed sRGB colour as 0-255 channels, in either spelling. */
function srgbChannels(colour: string): number[] {
  const floats = colour.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)\)$/);
  if (floats) {
    return floats.slice(1).map((value) => Math.round(Number(value) * 255));
  }
  const hex = colour.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (hex) return hex.slice(1).map((value) => Number.parseInt(value, 16));
  throw new Error(`unreadable token colour: ${colour}`);
}

/**
 * Samples one tile of the board as the canvas actually paints it.
 *
 * The scene pulls its colours out of the page's design tokens, so the
 * only honest check on the whole path - token, colour space, lighting,
 * tone curve - is the pixel the canvas lands on. Its drawing buffer is
 * not preserved between frames, so the pixels come from a screenshot of
 * the element rather than gl.readPixels.
 */
async function tileSample(page: Page) {
  const canvas = page.locator("canvas.board-canvas");
  await expect(canvas).toBeVisible();
  // The glyph atlas is rebuilt once the webfonts land, and that reflow
  // shifts the board's box: a shot taken through the window it opens is
  // taken of an element still moving, which Playwright refuses to draw.
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("[data-board3d='active']")).toBeAttached();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("the board canvas has no box");
  const shot = await canvas.screenshot({ timeout: 15_000 });
  const cell = page.locator('[role="gridcell"]:not(:has(.digit-ink))').first();
  const cellBox = await cell.boundingBox();
  if (!cellBox) throw new Error("the board has no empty cell");

  const token = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.opacity = "0";
    probe.style.color =
      "color-mix(in srgb, var(--color-cell-bg) 100%, rgb(0 0 0) 0%)";
    document.body.append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    // A 2d context normalises any colour it accepts to #rrggbb, which is
    // the same sRGB space the canvas pixel is written in.
    const surface = document.createElement("canvas");
    const ctx = surface.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.fillStyle = computed;
    return ctx.fillStyle as string;
  });

  const sample = await page.evaluate(
    async ([base64, region]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const surface = document.createElement("canvas");
      surface.width = img.width;
      surface.height = img.height;
      const ctx = surface.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0);
      // The shot is captured at the page's device pixel ratio, so the
      // cell's CSS-space centre has to be scaled into it.
      const ratio = img.width / region.canvasWidth;
      const data = ctx.getImageData(
        Math.round(region.x * ratio),
        Math.round(region.y * ratio),
        1,
        1,
      ).data;
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
    },
    [
      shot.toString("base64"),
      {
        canvasWidth: canvasBox.width,
        x: cellBox.x + cellBox.width / 2 - canvasBox.x,
        y: cellBox.y + cellBox.height / 2 - canvasBox.y,
      },
    ] as const,
  );

  return { sample, token };
}

test("the WebGL board paints a tile the colour of its token", async ({
  page,
}) => {
  // A tile lit below its own token greys the whole board, which is the
  // difference between a clean sudoku grid and a slab of dirty plastic.
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await expect(page.locator("canvas.board-canvas")).toBeVisible();
  await page.waitForTimeout(1200);

  const { sample, token } = await tileSample(page);
  const expected = srgbChannels(token);
  const drift = Math.max(
    ...sample.map((value, i) => Math.abs(value - (expected[i] ?? 0))),
  );
  expect(drift).toBeLessThan(12);
});
