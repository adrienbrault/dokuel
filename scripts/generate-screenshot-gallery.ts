import { mkdirSync, readdirSync, copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SCREENSHOTS_DIR = join(import.meta.dirname, "../e2e/screenshots");
const SITE_DIR = join(import.meta.dirname, "../e2e/screenshots-site");
const IMAGES_DIR = join(SITE_DIR, "images");

mkdirSync(IMAGES_DIR, { recursive: true });

const files = readdirSync(SCREENSHOTS_DIR).filter((f) => f.endsWith(".png"));
for (const file of files) {
  copyFileSync(join(SCREENSHOTS_DIR, file), join(IMAGES_DIR, file));
}

type ScreenGroup = {
  screen: string;
  images: { device: string; file: string }[];
};
const groups = new Map<string, ScreenGroup>();

for (const file of files) {
  const nameWithoutExt = file.replace(/\.png$/, "");
  const lastDash = nameWithoutExt.lastIndexOf("--");
  if (lastDash === -1) continue;
  const screen = nameWithoutExt.substring(0, lastDash);
  const device = nameWithoutExt.substring(lastDash + 2);

  if (!groups.has(screen)) {
    groups.set(screen, { screen, images: [] });
  }
  groups.get(screen)!.images.push({ device, file });
}

const deviceOrder = [
  "iPhone-SE",
  "iPhone-14",
  "iPhone-14-Safari",
  "iPhone-SE-Landscape",
  "iPhone-SE-Landscape-Safari",
  "iPhone-14-Landscape",
  "iPhone-14-Landscape-Safari",
  "iPad-Mini",
  "Desktop",
];

for (const group of groups.values()) {
  group.images.sort(
    (a, b) => deviceOrder.indexOf(a.device) - deviceOrder.indexOf(b.device),
  );
}

const sortedGroups = [...groups.values()].sort((a, b) =>
  a.screen.localeCompare(b.screen),
);

const commitSha = process.env.GITHUB_SHA?.substring(0, 7) ?? "local";
const commitRef = process.env.GITHUB_REF ?? "";
const timestamp = new Date().toISOString();

const navLinks = sortedGroups
  .map((g) => `<a href="#${g.screen}">${g.screen}</a>`)
  .join("\n    ");

const screenSections = sortedGroups
  .map((g) => {
    const devices = g.images
      .map(
        (img) => `
      <div class="device">
        <img src="images/${img.file}" alt="${g.screen} on ${img.device}" loading="lazy"
             onclick="openLightbox(this.src)">
        <div class="label">${img.device}</div>
      </div>`,
      )
      .join("");

    return `
  <div class="screen-group" id="${g.screen}">
    <h2>${g.screen}</h2>
    <div class="devices">${devices}
    </div>
  </div>`;
  })
  .join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dokuel Screenshots</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #333; padding: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { font-size: 0.8rem; color: #888; margin-bottom: 1.5rem; }
    .nav { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 2rem;
           position: sticky; top: 0; background: #f5f5f5; padding: 0.5rem 0; z-index: 10; }
    .nav a { font-size: 0.7rem; padding: 0.15rem 0.35rem; background: #e0e0e0;
             border-radius: 3px; text-decoration: none; color: #333; line-height: 1.2; }
    .nav a:hover { background: #d0d0d0; }
    @media (min-width: 640px) {
      .nav { gap: 0.5rem; }
      .nav a { font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 4px; }
    }
    .screen-group { margin-bottom: 3rem; }
    .screen-group h2 { font-size: 1.1rem; margin-bottom: 1rem; padding-top: 1rem;
                       border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; }
    .devices { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-start; }
    .device { background: white; border-radius: 8px; padding: 0.5rem;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .device img { display: block; max-width: 300px; height: auto; border-radius: 4px;
                  cursor: pointer; }
    .device img:hover { outline: 2px solid #4a90d9; }
    .device .label { font-size: 0.75rem; color: #666; margin-top: 0.25rem; text-align: center; }
    .lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9);
                z-index: 100; justify-content: center; align-items: center; cursor: pointer; }
    .lightbox.active { display: flex; }
    .lightbox img { max-width: 95vw; max-height: 95vh; object-fit: contain; }
  </style>
</head>
<body>
  <h1>Dokuel Screenshots</h1>
  <p class="meta">Commit: ${commitSha} | ${commitRef} | ${timestamp} | ${files.length} screenshots</p>

  <div class="nav">
    ${navLinks}
  </div>
  ${screenSections}

  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <img id="lightbox-img" src="" alt="Full size screenshot">
  </div>
  <script>
    function openLightbox(src) {
      document.getElementById('lightbox-img').src = src;
      document.getElementById('lightbox').classList.add('active');
    }
    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('active');
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
  </script>
</body>
</html>`;

writeFileSync(join(SITE_DIR, "index.html"), html);
console.log(
  `Generated gallery with ${files.length} screenshots in ${sortedGroups.length} groups`,
);
