/**
 * Headless smoke-test harness: drives system chromium via puppeteer-core,
 * captures console errors, waits for real frames, screenshots routes.
 *
 *   node scripts/snap.mjs <url> <outfile> [waitMs]
 */

import puppeteer from 'puppeteer-core';

const [url, outfile, waitMs = '2500'] = process.argv.slice(2);
if (!url || !outfile) {
  console.error('usage: node scripts/snap.mjs <url> <outfile> [waitMs]');
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'shell' === 'never' ? false : true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=1400,900',
    '--hide-scrollbars',
  ],
  defaultViewport: { width: 1400, height: 900 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, Number(waitMs)));

const diag = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  let webgl = 'no-canvas';
  if (canvas) {
    webgl = `canvas ${canvas.width}x${canvas.height}`;
  }
  return { hidden: document.hidden, webgl, hash: location.hash };
});

await page.screenshot({ path: outfile });
console.log(JSON.stringify({ diag, errors: errors.slice(0, 6) }, null, 1));
await browser.close();
