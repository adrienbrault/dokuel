import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures.ts";

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

type Region = {
  canvasWidth: number;
  tile: number;
  x: number;
  y: number;
  glyphX: number;
  glyphY: number;
  glyphTile: number;
};

/**
 * Where the board's own surfaces sit inside the canvas, in CSS pixels.
 *
 * Both samples are taken well away from the frame: a patch that hangs off
 * the drawing buffer averages in transparent black, which reads as a
 * surface far darker than anything the scene painted.
 */
async function boardRegions(page: Page): Promise<Region & { token: string }> {
  const canvas = page.locator("canvas.board-canvas");
  await expect(canvas).toBeVisible();
  // The glyph atlas is rebuilt once the webfonts land, and that reflow
  // shifts the board's box: a shot taken through the window it opens is
  // taken of an element still moving, which Playwright refuses to draw.
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("[data-board3d='active']")).toBeAttached();

  const regions = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.board-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("the board has no canvas");
    }
    const cells = [...document.querySelectorAll('[role="gridcell"]')];
    const box = (element: Element) => element.getBoundingClientRect();
    const canvasBox = box(canvas);
    const inset = (element: Element) => {
      const b = box(element);
      return (
        b.x > canvasBox.x + 8 &&
        b.y > canvasBox.y + 8 &&
        b.x + b.width < canvasBox.x + canvasBox.width - 8 &&
        b.y + b.height < canvasBox.y + canvasBox.height - 8
      );
    };
    const centre = (list: Element[]) => {
      const kept = list.filter(inset);
      const cell = kept[Math.floor(kept.length / 2)];
      if (!cell) throw new Error("no cell sits clear of the frame");
      const b = box(cell);
      return {
        x: b.x + b.width / 2 - canvasBox.x,
        y: b.y + b.height / 2 - canvasBox.y,
        tile: b.width,
      };
    };
    const blank = centre(
      cells.filter((cell) => !cell.querySelector(".digit-ink")),
    );
    const filled = centre(
      cells.filter((cell) => cell.querySelector(".digit-ink")),
    );
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
    return {
      canvasWidth: canvasBox.width,
      tile: blank.tile,
      x: blank.x,
      y: blank.y,
      glyphX: filled.x,
      glyphY: filled.y,
      glyphTile: filled.tile,
      token: ctx.fillStyle as string,
    };
  });
  return regions;
}

/**
 * Reads the board as the canvas actually paints it.
 *
 * The scene pulls its colours out of the page's design tokens, so the only
 * honest check on the whole path - token, colour space, lighting, tone
 * curve - is the pixels the canvas lands on. Its drawing buffer is not
 * preserved between frames, so those pixels come from a screenshot of the
 * element rather than gl.readPixels.
 *
 * A tile is averaged over its inner face rather than read at one point:
 * the grain pass, the bevel and the glyph mip-maps all move a single pixel
 * by several levels between frames, which is enough to fail a tile that is
 * otherwise sitting on its token.
 */
async function boardSample(page: Page) {
  const canvas = page.locator("canvas.board-canvas");
  const { token, ...region } = await boardRegions(page);
  const shot = await canvas.screenshot({ timeout: 15_000 });

  const pixels = await page.evaluate(
    async ({ base64, ...area }) => {
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
      const ratio = img.width / area.canvasWidth;
      const patch = (px: number, py: number, width: number) => {
        const size = Math.max(3, Math.round(width * ratio));
        const x = Math.min(
          Math.max(Math.round(px * ratio - size / 2), 0),
          img.width - size,
        );
        const y = Math.min(
          Math.max(Math.round(py * ratio - size / 2), 0),
          img.height - size,
        );
        return { data: ctx.getImageData(x, y, size, size).data, size };
      };
      const face = patch(area.x, area.y, area.tile * 0.5);
      let r = 0;
      let g = 0;
      let b = 0;
      const count = face.data.length / 4;
      for (let i = 0; i < face.data.length; i += 4) {
        r += face.data[i] ?? 0;
        g += face.data[i + 1] ?? 0;
        b += face.data[i + 2] ?? 0;
      }
      const tile = [r / count, g / count, b / count];
      const [tileR, tileG, tileB] = tile;

      // The digit is the mark the tile carries, and a board whose tiles
      // match their tokens but whose digits wash into them is no use to
      // anyone. Its ink is thin and antialiased, so the honest read is
      // the pixel in the cell that sits furthest from the tile.
      const glyph = patch(area.glyphX, area.glyphY, area.glyphTile * 0.62);
      let contrast = 0;
      for (let i = 0; i < glyph.data.length; i += 4) {
        const gap =
          Math.abs((glyph.data[i] ?? 0) - (tileR ?? 0)) +
          Math.abs((glyph.data[i + 1] ?? 0) - (tileG ?? 0)) +
          Math.abs((glyph.data[i + 2] ?? 0) - (tileB ?? 0));
        contrast = Math.max(contrast, gap / 3);
      }
      return { tile, contrast };
    },
    { base64: shot.toString("base64"), ...region },
  );

  return { tile: pixels.tile, contrast: pixels.contrast, token };
}

function drift(sample: number[], token: string): number {
  const expected = srgbChannels(token);
  return Math.max(
    ...sample.map((value, i) => Math.abs(value - (expected[i] ?? 0))),
  );
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

  const { tile, token, contrast } = await boardSample(page);
  expect(drift(tile, token)).toBeLessThan(12);
  expect(contrast).toBeGreaterThan(40);
});

test("a dark tile keeps its token too", async ({ page }) => {
  // Dark mode flips every token, and the toe of the output curve takes a
  // near-black surface to a black hole - so the tiles, the grout and the
  // digits all have to be handed the albedo that lands them on the
  // palette, not the palette itself.
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await expect(page.locator("canvas.board-canvas")).toBeVisible();
  await page.getByLabel("Settings").click();
  await page.getByLabel("Switch to dark mode").click();
  await page.getByLabel("Close settings").click();
  await page.waitForTimeout(1200);

  const { tile, token, contrast } = await boardSample(page);
  expect(drift(tile, token)).toBeLessThan(12);
  expect(contrast).toBeGreaterThan(40);
});
