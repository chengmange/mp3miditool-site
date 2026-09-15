import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const response = await page.goto('https://mp3miditool.com/', { waitUntil: 'networkidle', timeout: 120000 });

const pageFacts = {
  status: response?.status(),
  title: await page.title(),
  h1: (await page.locator('#hero-title').innerText()).trim(),
  hero: (await page.locator('.hero-text').innerText()).trim(),
  sectionHeading: (await page.locator('#audio-guide-title').innerText()).trim(),
  wavLink: await page.locator('.hero-text a[href="/wav-to-midi/"]').getAttribute('href'),
};
await page.screenshot({ path: path.join(assets, 'home-umbrella-live.png'), fullPage: true });

const inputPath = path.join(assets, 'four-note-test.mp3');
await page.setInputFiles('#audio-file', inputPath);
await page.waitForFunction(() => document.querySelector('#result')?.hidden === true);
await page.click('#convert-button');
await page.waitForFunction(() => document.querySelector('#result')?.hidden === false && document.querySelector('#result')?.classList.contains('success') && document.querySelector('#progress-value')?.textContent === '100%', null, { timeout: 180000 });
const resultText = (await page.locator('#result').innerText()).trim();
const outputPath = path.join(assets, 'live-home-mp3.mid');
const downloadPromise = page.waitForEvent('download');
await page.click('#result a');
const download = await downloadPromise;
await download.saveAs(outputPath);
const bytes = await readFile(outputPath);
const midi = new Midi(bytes);
const converter = {
  resultText,
  outputBytes: bytes.byteLength,
  parsedTracks: midi.tracks.length,
  parsedNotes: midi.tracks.reduce((total, track) => total + track.notes.length, 0),
};

const wavPage = await browser.newPage();
const wavResponse = await wavPage.goto('https://mp3miditool.com/wav-to-midi/', { waitUntil: 'networkidle', timeout: 120000 });
const links = {
  homepageToWav: (await page.locator('a[href="/wav-to-midi/"]').count()) > 0,
  wavToHomepage: (await wavPage.locator('a[href="/#converter"]').count()) > 0,
  wavStatus: wavResponse?.status(),
};

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await mobile.goto('https://mp3miditool.com/', { waitUntil: 'networkidle', timeout: 120000 });
const mobileLayout = await mobile.evaluate(() => ({
  bodyScrollWidth: document.body.scrollWidth,
  viewportWidth: document.documentElement.clientWidth,
  convertButtonVisible: Boolean(document.querySelector('#convert-button')?.getBoundingClientRect().height),
}));
await mobile.screenshot({ path: path.join(assets, 'home-umbrella-mobile-live.png'), fullPage: true });
await browser.close();

const report = { url: 'https://mp3miditool.com/', pageFacts, converter, links, mobileLayout, errors };
await writeFile(path.join(assets, 'live-home-umbrella.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (pageFacts.status !== 200 || !pageFacts.title.includes('Audio to MIDI Converter') || !pageFacts.title.includes('MP3 to MIDI Converter') || !pageFacts.h1.includes('audio to MIDI') || !pageFacts.h1.includes('MP3') || converter.outputBytes < 20 || converter.parsedNotes < 1 || !links.homepageToWav || !links.wavToHomepage || links.wavStatus !== 200 || mobileLayout.bodyScrollWidth > mobileLayout.viewportWidth || !mobileLayout.convertButtonVisible || errors.length) process.exitCode = 1;
