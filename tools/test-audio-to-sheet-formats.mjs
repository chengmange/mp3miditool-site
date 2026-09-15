import { chromium } from 'playwright';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] || 'https://mp3miditool.com';
const root = path.resolve('.');
const assets = path.join(root, 'test-assets');
await mkdir(assets, { recursive: true });

const midiPath = path.join(assets, 'four-note-test.mid');
const midiAliasPath = path.join(assets, 'four-note-test.midi');
await copyFile(midiPath, midiAliasPath);
const cases = [
  { label: 'mp3', path: path.join(assets, 'four-note-test.mp3'), expected: ['A4', 'C5', 'E5', 'G5'] },
  { label: 'wav', path: path.join(assets, 'four-note-test.wav'), expected: ['A4', 'C5', 'E5', 'G5'] },
  { label: 'mid', path: midiPath, expected: ['A4', 'C5', 'E5', 'G5'] },
  { label: 'midi', path: midiAliasPath, expected: ['A4', 'C5', 'E5', 'G5'] },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: path.join(root, '.playwright-browsers', 'chromium_headless_shell-1187', 'chrome-win', 'headless_shell.exe'),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

function readPitches(xml) {
  return [...xml.matchAll(/<pitch><step>([A-G])<\/step>(?:<alter>(-?\d+)<\/alter>)?<octave>(\d+)<\/octave><\/pitch>/g)].map((match) => {
    const alter = Number(match[2] || 0);
    const suffix = alter === 1 ? '#' : alter === -1 ? 'b' : '';
    return `${match[1]}${suffix}${match[3]}`;
  });
}

const runs = [];
for (const item of cases) {
  await page.goto(`${baseUrl}/audio-to-sheet-music/`, { waitUntil: 'networkidle', timeout: 120000 });
  const started = Date.now();
  await page.setInputFiles('#audio-file', item.path);
  await page.click('#convert-button');
  await page.waitForFunction(() => document.querySelector('#result')?.classList.contains('success') && document.querySelector('#progress-value')?.textContent === '100%', null, { timeout: 180000 });
  const elapsedWall = Number(((Date.now() - started) / 1000).toFixed(1));
  const facts = await page.evaluate(() => ({
    result: document.querySelector('#result')?.textContent?.trim(),
    noteCount: document.querySelector('#note-count')?.textContent?.trim(),
    pageCount: document.querySelector('#page-count')?.textContent?.trim(),
    reportedElapsed: document.querySelector('#elapsed-time')?.textContent?.trim(),
    renderedSvgs: document.querySelectorAll('#score-output svg').length,
  }));
  const xmlPath = path.join(assets, `audio-sheet-${item.label}.musicxml`);
  const xmlDownload = page.waitForEvent('download');
  await page.getByText('Download MusicXML', { exact: true }).click();
  await (await xmlDownload).saveAs(xmlPath);
  const svgPath = path.join(assets, `audio-sheet-${item.label}.svg`);
  const svgDownload = page.waitForEvent('download');
  await page.getByText('Download score SVG', { exact: true }).click();
  await (await svgDownload).saveAs(svgPath);
  const xml = await readFile(xmlPath, 'utf8');
  const svg = await readFile(svgPath, 'utf8');
  const pitches = readPitches(xml);
  await page.locator('#score-section').screenshot({ path: path.join(assets, `audio-sheet-${item.label}-score.png`) });
  await page.screenshot({ path: path.join(assets, `audio-sheet-${item.label}.png`), fullPage: true });
  runs.push({
    format: item.label.toUpperCase(),
    inputBytes: (await stat(item.path)).size,
    expectedPitches: item.expected,
    renderedPitches: pitches,
    result: facts.result,
    noteCount: facts.noteCount,
    pageCount: facts.pageCount,
    reportedElapsed: facts.reportedElapsed,
    wallSeconds: elapsedWall,
    renderedSvgs: facts.renderedSvgs,
    musicXmlBytes: (await stat(xmlPath)).size,
    svgBytes: (await stat(svgPath)).size,
    hasMusicXml: xml.includes('<score-partwise'),
    hasSvg: svg.includes('<svg'),
  });
}

await browser.close();
const report = { url: `${baseUrl}/audio-to-sheet-music/`, runs, errors };
await writeFile(path.join(assets, 'audio-to-sheet-formats-test.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (errors.length || runs.some((run) => !run.hasMusicXml || !run.hasSvg || run.renderedSvgs < 1 || run.musicXmlBytes < 200 || run.svgBytes < 200)) process.exitCode = 1;
