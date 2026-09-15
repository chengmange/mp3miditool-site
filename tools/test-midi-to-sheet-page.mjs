import { chromium } from 'playwright';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173';
const root = path.resolve('.');
const assets = path.join(root, 'test-assets');
await mkdir(assets, { recursive: true });

function makeType0Midi() {
  const track = [
    0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
    0x00, 0x90, 0x3c, 0x64,
    0x83, 0x60, 0x80, 0x3c, 0x00,
    0x00, 0x90, 0x40, 0x64,
    0x83, 0x60, 0x80, 0x40, 0x00,
    0x00, 0xff, 0x2f, 0x00,
  ];
  return Uint8Array.from([
    0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
    0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,
    0x4d, 0x54, 0x72, 0x6b,
    (track.length >>> 24) & 0xff, (track.length >>> 16) & 0xff, (track.length >>> 8) & 0xff, track.length & 0xff,
    ...track,
  ]);
}

const type0Path = path.join(assets, 'type-0-test.mid');
await writeFile(type0Path, makeType0Midi());
const type1Path = path.join(assets, 'four-note-test.mid');

const browser = await chromium.launch({
  headless: true,
  executablePath: path.join(root, '.playwright-browsers', 'chromium_headless_shell-1187', 'chrome-win', 'headless_shell.exe'),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

const response = await page.goto(`${baseUrl}/midi-to-sheet-music/`, { waitUntil: 'networkidle', timeout: 120000 });
const initial = await page.evaluate(() => ({
  title: document.title,
  h1: document.querySelector('#hero-title')?.textContent?.trim(),
  accept: document.querySelector('#audio-file')?.getAttribute('accept'),
  typeText: document.body.textContent.includes('Type 0 and Type 1 are accepted'),
  privateText: document.body.textContent.includes('It is never uploaded to a server.'),
  noAccountText: document.body.textContent.includes('No login, no registration, and no popups.'),
  scoreHidden: document.querySelector('#score-section')?.hidden,
  loginControls: [...document.querySelectorAll('a,button,input')].filter((element) => /log\s?in|sign\s?in|password/i.test(`${element.textContent || ''} ${element.getAttribute('type') || ''}`)).length,
}));

async function runConversion(filePath, label) {
  await page.setInputFiles('#audio-file', filePath);
  await page.click('#convert-button');
  await page.waitForFunction(() => document.querySelector('#result')?.classList.contains('success') && document.querySelector('#progress-value')?.textContent === '100%', null, { timeout: 120000 });
  const facts = await page.evaluate(() => ({
    result: document.querySelector('#result')?.textContent?.trim(),
    noteCount: document.querySelector('#note-count')?.textContent?.trim(),
    pageCount: document.querySelector('#page-count')?.textContent?.trim(),
    elapsed: document.querySelector('#elapsed-time')?.textContent?.trim(),
    renderedSvgs: document.querySelectorAll('#score-output svg').length,
    musicXmlLink: [...document.querySelectorAll('#score-downloads a')].some((a) => a.textContent === 'Download MusicXML'),
    svgLink: [...document.querySelectorAll('#score-downloads a')].some((a) => a.textContent === 'Download score SVG'),
  }));
  const musicXmlPath = path.join(assets, `${label}.musicxml`);
  const musicXmlDownload = page.waitForEvent('download');
  await page.getByText('Download MusicXML', { exact: true }).click();
  await (await musicXmlDownload).saveAs(musicXmlPath);
  const svgPath = path.join(assets, `${label}.svg`);
  const svgDownload = page.waitForEvent('download');
  await page.getByText('Download score SVG', { exact: true }).click();
  await (await svgDownload).saveAs(svgPath);
  const xml = await readFile(musicXmlPath, 'utf8');
  const svg = await readFile(svgPath, 'utf8');
  return {
    input: path.basename(filePath),
    inputBytes: (await stat(filePath)).size,
    ...facts,
    musicXmlBytes: (await stat(musicXmlPath)).size,
    musicXmlValid: xml.includes('<score-partwise') && (xml.match(/<pitch>/g) || []).length > 0,
    svgBytes: (await stat(svgPath)).size,
    svgValid: svg.includes('<svg'),
  };
}

const type0 = await runConversion(type0Path, 'midi-page-type0');
const type1 = await runConversion(type1Path, 'midi-page-type1');

const routes = ['/', '/wav-to-midi/', '/audio-to-sheet-music/', '/midi-to-mp3/', '/about/', '/contact/', '/privacy/'];
const footerChecks = {};
for (const route of routes) {
  const checkPage = await context.newPage();
  const routeResponse = await checkPage.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 120000 });
  footerChecks[route] = {
    status: routeResponse?.status(),
    hasLink: await checkPage.locator('footer a[href="/midi-to-sheet-music/"]').count() > 0,
  };
  await checkPage.close();
}

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mobile = await mobileContext.newPage();
await mobile.goto(`${baseUrl}/midi-to-sheet-music/`, { waitUntil: 'networkidle', timeout: 120000 });
const mobileLayout = await mobile.evaluate(() => ({
  bodyScrollWidth: document.body.scrollWidth,
  viewportWidth: document.documentElement.clientWidth,
  fileInputVisible: Boolean(document.querySelector('#audio-file')?.getBoundingClientRect().height),
  chooseControlVisible: Boolean(document.querySelector('.file-picker')?.getBoundingClientRect().height),
}));
await mobileContext.close();
await browser.close();

const report = { url: `${baseUrl}/midi-to-sheet-music/`, status: response?.status(), initial, type0, type1, footerChecks, mobileLayout, errors };
await writeFile(path.join(assets, 'midi-to-sheet-page-test.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));

const allFootersPass = Object.values(footerChecks).every((check) => check.status === 200 && check.hasLink);
const conversionPass = [type0, type1].every((run) => run.renderedSvgs >= 1 && run.musicXmlLink && run.svgLink && run.musicXmlBytes > 200 && run.musicXmlValid && run.svgBytes > 200 && run.svgValid);
if (report.status !== 200 || !initial.h1?.toLowerCase().includes('midi') || !initial.accept?.includes('.mid') || !initial.accept?.includes('.midi') || !initial.typeText || !initial.privateText || !initial.noAccountText || initial.loginControls !== 0 || !conversionPass || !allFootersPass || mobileLayout.bodyScrollWidth > mobileLayout.viewportWidth || !mobileLayout.fileInputVisible || !mobileLayout.chooseControlVisible || errors.length) process.exitCode = 1;
