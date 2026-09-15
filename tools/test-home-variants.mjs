import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] || 'https://mp3miditool.com';
const root = path.resolve('.');
const assets = path.join(root, 'test-assets');
await mkdir(assets, { recursive: true });
const target = 'https://midiagent.com?fp_ref=mp3miditool';
const disclosure = 'Disclosure: The link on this page may be an affiliate link. If you make a purchase through it, I may earn a commission.';
const browser = await chromium.launch({
  headless: true,
  executablePath: path.join(root, '.playwright-browsers', 'chromium_headless_shell-1187', 'chrome-win', 'headless_shell.exe'),
});
const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
desktop.on('pageerror', (error) => errors.push(`page: ${error.message}`));
desktop.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
const response = await desktop.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 120000 });
const details = await desktop.evaluate(({ targetUrl, disclosureText }) => {
  const text = document.body.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
  const link = [...document.querySelectorAll('a')].find((candidate) => candidate.getAttribute('href') === targetUrl);
  const disclosureNode = [...document.querySelectorAll('.affiliate-disclosure')].find((node) => node.textContent?.trim() === disclosureText);
  const rect = link?.getBoundingClientRect();
  return {
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim(),
    variantCounts: {
      'audio to midi': (text.match(/audio to midi/g) || []).length,
      'audio into midi': (text.match(/audio into midi/g) || []).length,
      'audio to midi converter': (text.match(/audio to midi converter/g) || []).length,
      'audio to midi conversion': (text.match(/audio to midi conversion/g) || []).length,
    },
    toolVisible: Boolean(document.querySelector('#converter')?.getBoundingClientRect().height),
    linkHref: link?.getAttribute('href') || null,
    linkText: link?.textContent?.trim() || null,
    linkVisible: Boolean(link && rect && rect.width > 0 && rect.height > 0),
    disclosure: disclosureNode?.textContent?.trim() || null,
    chineseCharacters: (document.body.textContent.match(/[\u3400-\u9fff]/g) || []).length,
  };
}, { targetUrl: target, disclosureText: disclosure });
await desktop.screenshot({ path: path.join(assets, 'home-variants-public.png'), fullPage: false });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await mobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 120000 });
const mobileLayout = await mobile.evaluate(() => ({
  bodyScrollWidth: document.body.scrollWidth,
  viewportWidth: document.documentElement.clientWidth,
  fileInputVisible: Boolean(document.querySelector('#audio-file')?.getBoundingClientRect().height),
  convertButtonVisible: Boolean(document.querySelector('#convert-button')?.getBoundingClientRect().height),
}));
await browser.close();

const report = { url: `${baseUrl}/`, status: response?.status(), details, mobileLayout, errors };
await writeFile(path.join(assets, 'home-variants-test.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
const countsPass = Object.entries(details.variantCounts).every(([variant, count]) => variant === 'audio to midi' ? count >= 1 : count >= 1 && count <= 2);
if (report.status !== 200 || !details.h1?.toLowerCase().includes('audio to midi') || !countsPass || !details.toolVisible || details.linkHref !== target || details.linkText !== 'Explore MIDI Agent' || !details.linkVisible || details.disclosure !== disclosure || details.chineseCharacters > 0 || mobileLayout.bodyScrollWidth > mobileLayout.viewportWidth || !mobileLayout.fileInputVisible || !mobileLayout.convertButtonVisible || errors.length) process.exitCode = 1;
