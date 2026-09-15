import { chromium } from 'playwright';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173';
const root = path.resolve('.');
const assets = path.join(root, 'test-assets');
await mkdir(assets, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

const response = await page.goto(`${baseUrl}/audio-to-sheet-music/`, { waitUntil: 'networkidle', timeout: 120000 });
const inputPath = path.join(assets, 'thirty-one-second-melody.wav');
await page.setInputFiles('#audio-file', inputPath);
const started = Date.now();
await page.click('#convert-button');
await page.waitForFunction(() => document.querySelector('#result')?.classList.contains('success') && document.querySelector('#progress-value')?.textContent === '100%', null, { timeout: 360000 });
const wallSeconds = Number(((Date.now() - started) / 1000).toFixed(1));
const facts = await page.evaluate(() => ({
  title: document.title,
  h1: document.querySelector('#hero-title')?.textContent?.trim(),
  result: document.querySelector('#result')?.textContent?.trim(),
  noteCount: document.querySelector('#note-count')?.textContent?.trim(),
  pageCount: document.querySelector('#page-count')?.textContent?.trim(),
  elapsed: document.querySelector('#elapsed-time')?.textContent?.trim(),
  renderedSvgs: document.querySelectorAll('#score-output svg').length,
  scoreText: document.querySelector('#score-output')?.textContent?.trim().slice(0, 200),
  fileAccept: document.querySelector('#audio-file')?.getAttribute('accept'),
  loginControls: [...document.querySelectorAll('a,button,input')].filter((element) => /log\s?in|sign\s?in|password/i.test(`${element.textContent || ''} ${element.getAttribute('type') || ''}`)).length,
  accountClaim: [...document.querySelectorAll('.privacy-note')].some((element) => element.textContent.includes('No account or login is requested.')),
}));
await page.screenshot({ path: path.join(assets, 'sheet-page-local.png'), fullPage: true });

const musicXmlPath = path.join(assets, 'sheet-page-test.musicxml');
const musicXmlDownload = page.waitForEvent('download');
await page.getByText('Download MusicXML', { exact: true }).click();
await (await musicXmlDownload).saveAs(musicXmlPath);
const musicXml = await readFile(musicXmlPath, 'utf8');

const svgPath = path.join(assets, 'sheet-page-test.svg');
const svgDownload = page.waitForEvent('download');
await page.getByText('Download score SVG', { exact: true }).click();
await (await svgDownload).saveAs(svgPath);
const svg = await readFile(svgPath, 'utf8');

const home = await context.newPage();
const wav = await context.newPage();
const [homeResponse, wavResponse] = await Promise.all([
  home.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 120000 }),
  wav.goto(`${baseUrl}/wav-to-midi/`, { waitUntil: 'networkidle', timeout: 120000 }),
]);
const links = {
  sheetToHome: (await page.locator('a[href="/#converter"]').count()) > 0,
  sheetToWav: (await page.locator('a[href="/wav-to-midi/"]').count()) > 0,
  homeToSheet: (await home.locator('a[href="/audio-to-sheet-music/"]').count()) > 0,
  wavToSheet: (await wav.locator('a[href="/audio-to-sheet-music/"]').count()) > 0,
  homeStatus: homeResponse?.status(),
  wavStatus: wavResponse?.status(),
};

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mobile = await mobileContext.newPage();
await mobile.goto(`${baseUrl}/audio-to-sheet-music/`, { waitUntil: 'networkidle', timeout: 120000 });
const mobileLayout = await mobile.evaluate(() => ({
  bodyScrollWidth: document.body.scrollWidth,
  viewportWidth: document.documentElement.clientWidth,
  convertButtonVisible: Boolean(document.querySelector('#convert-button')?.getBoundingClientRect().height),
}));
await mobile.screenshot({ path: path.join(assets, 'sheet-page-mobile-local.png'), fullPage: true });
await mobileContext.close();
await browser.close();

const report = {
  url: `${baseUrl}/audio-to-sheet-music/`,
  status: response?.status(),
  input: { file: path.basename(inputPath), bytes: (await stat(inputPath)).size, durationSeconds: 31, sourceTones: ['A4', 'C5', 'E5', 'G5'] },
  conversion: { ...facts, wallSeconds },
  downloads: {
    musicXmlBytes: (await stat(musicXmlPath)).size,
    musicXmlPitchElements: (musicXml.match(/<pitch>/g) || []).length,
    musicXmlValidRoot: musicXml.includes('<score-partwise'),
    svgBytes: (await stat(svgPath)).size,
    svgValidRoot: svg.includes('<svg'),
  },
  links,
  mobileLayout,
  errors,
};
await writeFile(path.join(assets, 'sheet-page-test.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (report.status !== 200 || !facts.h1?.includes('sheet music') || facts.loginControls !== 0 || !facts.accountClaim || facts.renderedSvgs < 1 || report.downloads.musicXmlBytes < 200 || !report.downloads.musicXmlValidRoot || report.downloads.svgBytes < 200 || !report.downloads.svgValidRoot || Object.values(links).some((value) => value === false) || links.homeStatus !== 200 || links.wavStatus !== 200 || mobileLayout.bodyScrollWidth > mobileLayout.viewportWidth || !mobileLayout.convertButtonVisible || errors.length) process.exitCode = 1;
