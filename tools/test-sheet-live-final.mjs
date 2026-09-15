import { chromium } from 'playwright';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = 'https://mp3miditool.com';
const assets = path.resolve('test-assets');
await mkdir(assets, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

const response = await page.goto(`${baseUrl}/audio-to-sheet-music/`, { waitUntil: 'networkidle', timeout: 120000 });
const inputPath = path.join(assets, 'four-note-test.wav');
await page.setInputFiles('#audio-file', inputPath);
const started = Date.now();
await page.click('#convert-button');
await page.waitForFunction(() => document.querySelector('#result')?.classList.contains('success') && document.querySelector('#progress-value')?.textContent === '100%', null, { timeout: 180000 });
const conversion = await page.evaluate(() => ({
  result: document.querySelector('#result')?.textContent?.trim(),
  notes: document.querySelector('#note-count')?.textContent?.trim(),
  pages: document.querySelector('#page-count')?.textContent?.trim(),
  elapsed: document.querySelector('#elapsed-time')?.textContent?.trim(),
  renderedSvgs: document.querySelectorAll('#score-output svg').length,
  publishedRun: document.querySelector('[data-test="test-time"]')?.textContent?.trim(),
  loginControls: [...document.querySelectorAll('a,button,input')].filter((element) => /log\s?in|sign\s?in|password/i.test(`${element.textContent || ''} ${element.getAttribute('type') || ''}`)).length,
}));
conversion.wallSeconds = Number(((Date.now() - started) / 1000).toFixed(1));

const xmlPath = path.join(assets, 'sheet-page-live-final.musicxml');
const xmlDownload = page.waitForEvent('download');
await page.getByText('Download MusicXML', { exact: true }).click();
await (await xmlDownload).saveAs(xmlPath);
const xml = await readFile(xmlPath, 'utf8');

const svgPath = path.join(assets, 'sheet-page-live-final.svg');
const svgDownload = page.waitForEvent('download');
await page.getByText('Download score SVG', { exact: true }).click();
await (await svgDownload).saveAs(svgPath);
const svg = await readFile(svgPath, 'utf8');
await page.screenshot({ path: path.join(assets, 'sheet-page-live-final.png'), fullPage: true });

const [homeResponse, wavResponse, sitemapResponse] = await Promise.all([
  context.request.get(`${baseUrl}/`),
  context.request.get(`${baseUrl}/wav-to-midi/`),
  context.request.get(`${baseUrl}/sitemap.xml`),
]);
const home = await homeResponse.text();
const wav = await wavResponse.text();
const sitemap = await sitemapResponse.text();
const sheetLinks = {
  sheetToHome: (await page.locator('a[href="/#converter"]').count()) > 0,
  sheetToWav: (await page.locator('a[href="/wav-to-midi/"]').count()) > 0,
};

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mobile = await mobileContext.newPage();
await mobile.goto(`${baseUrl}/audio-to-sheet-music/`, { waitUntil: 'networkidle', timeout: 120000 });
const mobileLayout = await mobile.evaluate(() => ({ bodyScrollWidth: document.body.scrollWidth, viewportWidth: document.documentElement.clientWidth, buttonVisible: Boolean(document.querySelector('#convert-button')?.getBoundingClientRect().height) }));
await mobile.screenshot({ path: path.join(assets, 'sheet-page-live-final-mobile.png'), fullPage: true });
await mobileContext.close();
await browser.close();

const report = {
  url: `${baseUrl}/audio-to-sheet-music/`,
  status: response?.status(),
  input: { file: path.basename(inputPath), bytes: (await stat(inputPath)).size, durationSeconds: 4 },
  conversion,
  downloads: { musicXmlBytes: (await stat(xmlPath)).size, musicXmlValid: xml.includes('<score-partwise'), svgBytes: (await stat(svgPath)).size, svgValid: svg.includes('<svg') },
  links: { homeToSheet: home.includes('/audio-to-sheet-music/'), wavToSheet: wav.includes('/audio-to-sheet-music/'), ...sheetLinks },
  sitemap: { status: sitemapResponse.status(), containsSheetPage: sitemap.includes('https://mp3miditool.com/audio-to-sheet-music/') },
  mobileLayout,
  errors,
};
await writeFile(path.join(assets, 'sheet-page-live-final.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (report.status !== 200 || conversion.renderedSvgs < 1 || conversion.loginControls !== 0 || !conversion.publishedRun.includes('92.9 seconds') || report.downloads.musicXmlBytes < 200 || !report.downloads.musicXmlValid || report.downloads.svgBytes < 200 || !report.downloads.svgValid || !Object.values(report.links).every(Boolean) || report.sitemap.status !== 200 || !report.sitemap.containsSheetPage || mobileLayout.bodyScrollWidth > mobileLayout.viewportWidth || !mobileLayout.buttonVisible || errors.length) process.exitCode = 1;
