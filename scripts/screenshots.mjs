/**
 * Regenerates the README screenshots from the real application.
 *
 * Usage (see .github/workflows/screenshots.yml):
 *   npm run build
 *   npx vite preview --port 4173 --host 127.0.0.1 &
 *   node scripts/screenshots.mjs
 *
 * It also asserts the privacy promise: after the page has loaded, working with
 * a payload must not produce a single network request.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.SAFESHARE_URL ?? 'http://127.0.0.1:4173/safeshare-json/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2 });
const page = await context.newPage();

const requests = [];
page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));

await page.goto(BASE, { waitUntil: 'networkidle' });
const duringLoad = requests.length;

await page.click('#btn-demo');
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, 'app-overview.png') });

await page.locator('section.findings').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, 'findings.png') });

await page.fill('#input', '{"customer": {"email": "john@example.com",}}');
await page.waitForTimeout(300);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: join(OUT, 'invalid-json.png') });

const afterLoad = requests.slice(duringLoad);
const storage = await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length);

await browser.close();

if (afterLoad.length > 0) {
  console.error('Privacy check failed - unexpected network activity:', afterLoad);
  process.exit(1);
}
if (storage !== 0) {
  console.error('Privacy check failed - browser storage was written');
  process.exit(1);
}
console.log(`Screenshots written to docs/screenshots (${duringLoad} static asset requests, 0 after load, 0 storage keys).`);
