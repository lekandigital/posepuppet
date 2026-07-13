// Screenshot board driver. Usage: node shots.mjs [outdir] [urlSuffix...]
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? ".shots";
const views = process.argv.slice(3);
const targets = views.length ? views : [
  "flyover-orbit|/openworld/?hud=0|6000",
  "flyover-high|/openworld/?hud=0&cam=high|3000",
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
for (const t of targets) {
  const [name, url, waitMs] = t.split("|");
  await page.goto(`http://localhost:5176${url}`);
  await page.waitForFunction(() => window.__OW !== undefined);
  await page.waitForTimeout(Number(waitMs ?? 3000));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`${out}/${name}.png`);
}
await browser.close();
