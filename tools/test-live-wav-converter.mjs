import { chromium } from 'playwright';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { Midi } = require('@tonejs/midi');

const root = path.resolve('.');
const assets = path.join(root, 'test-assets');
await mkdir(assets, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

await page.goto('https://mp3miditool.com/wav-to-midi/', { waitUntil: 'networkidle', timeout: 120000 });
await page.screenshot({ path: path.join(assets, 'wav-page-live.png'), fullPage: true });

const expected = new Map([[69, 'A4'], [72, 'C5'], [76, 'E5'], [79, 'G5']]);
const runs = [];
for (const extension of ['wav', 'mp3']) {
  const inputPath = path.join(assets, `four-note-test.${extension}`);
  await page.setInputFiles('#audio-file', inputPath);
  await page.waitForFunction(() => document.querySelector('#result')?.hidden === true);
  await page.click('#convert-button');
  await page.waitForFunction(() => document.querySelector('#result')?.hidden === false && document.querySelector('#result')?.classList.contains('success') && document.querySelector('#progress-value')?.textContent === '100%', null, { timeout: 180000 });
  const resultText = (await page.locator('#result').innerText()).trim();
  const progressText = (await page.locator('#progress-copy').innerText()).trim();
  const outputPath = path.join(assets, `live-browser-${extension}.mid`);
  const downloadPromise = page.waitForEvent('download');
  await page.click('#result a');
  const download = await downloadPromise;
  await download.saveAs(outputPath);
  const bytes = await readFile(outputPath);
  const midi = new Midi(bytes);
  const notes = midi.tracks.flatMap((track) => track.notes);
  const pitches = new Set(notes.map((note) => note.midi));
  runs.push({
    input: path.basename(inputPath),
    inputBytes: (await stat(inputPath)).size,
    resultText,
    progressText,
    output: path.basename(outputPath),
    outputBytes: bytes.byteLength,
    parsedTracks: midi.tracks.length,
    parsedNotes: notes.length,
    longNotes: notes.filter((note) => note.duration >= 0.5).length,
    shortNotes: notes.filter((note) => note.duration < 0.5).length,
    missed: [...expected].filter(([pitch]) => !pitches.has(pitch)).map(([, name]) => name),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    detected: notes.map((note) => ({ pitch: note.name, start: Number(note.time.toFixed(4)), duration: Number(note.duration.toFixed(4)) })),
  });
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await mobile.goto('https://mp3miditool.com/wav-to-midi/', { waitUntil: 'networkidle', timeout: 120000 });
const mobileLayout = await mobile.evaluate(() => ({
  bodyScrollWidth: document.body.scrollWidth,
  viewportWidth: document.documentElement.clientWidth,
  fileInputAccept: document.querySelector('#audio-file')?.getAttribute('accept'),
  convertButtonVisible: Boolean(document.querySelector('#convert-button')?.getBoundingClientRect().height),
}));
await mobile.screenshot({ path: path.join(assets, 'wav-page-mobile-live.png'), fullPage: true });
await browser.close();

const report = { url: 'https://mp3miditool.com/wav-to-midi/', runs, mobileLayout, errors };
await writeFile(path.join(assets, 'live-browser-comparison.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (errors.length || mobileLayout.bodyScrollWidth > mobileLayout.viewportWidth || !mobileLayout.convertButtonVisible || runs.some((run) => run.outputBytes < 20 || run.parsedNotes < 1)) process.exitCode = 1;
