import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] || 'https://mp3miditool.com';
const root = path.resolve('.');
const assets = path.join(root, 'test-assets');
await mkdir(assets, { recursive: true });
const target = 'https://midiagent.com?fp_ref=mp3miditool';
const pages = [
  { path: '/', label: 'home', phrase: 'Next step for DAW work' },
  { path: '/wav-to-midi/', label: 'wav-to-midi', phrase: 'After the WAV conversion' },
  { path: '/audio-to-sheet-music/', label: 'audio-to-sheet-music', phrase: 'For the next production step' },
  { path: '/midi-to-sheet-music/', label: 'midi-to-sheet-music', phrase: 'For editing after notation' },
  { path: '/midi-to-mp3/', label: 'midi-to-mp3', phrase: 'Keep the MIDI editable' },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: path.join(root, '.playwright-browsers', 'chromium_headless_shell-1187', 'chrome-win', 'headless_shell.exe'),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const errors = [];
const results = [];
for (const item of pages) {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${item.path}: page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`${item.path}: console: ${message.text()}`); });
  const response = await page.goto(`${baseUrl}${item.path}`, { waitUntil: 'networkidle', timeout: 120000 });
  const details = await page.evaluate(({ targetUrl, phrase }) => {
    const link = [...document.querySelectorAll('a')].find((candidate) => candidate.getAttribute('href') === targetUrl);
    const disclosure = [...document.querySelectorAll('.affiliate-disclosure')].find((node) => /affiliate link/i.test(node.textContent || ''));
    const rect = link?.getBoundingClientRect();
    return {
      linkHref: link?.getAttribute('href') || null,
      linkText: link?.textContent?.trim() || null,
      linkVisible: Boolean(link && rect && rect.width > 0 && rect.height > 0),
      rel: link?.getAttribute('rel') || null,
      contextPhrase: document.body.textContent.includes(phrase),
      disclosure: disclosure?.textContent?.trim() || null,
      disclosureVisible: Boolean(disclosure && disclosure.getBoundingClientRect().width > 0),
      chineseCharacters: (document.body.textContent.match(/[\u3400-\u9fff]/g) || []).length,
    };
  }, { targetUrl: target, phrase: item.phrase });
  await page.screenshot({ path: path.join(assets, `affiliate-${item.label}.png`), fullPage: false });
  results.push({ path: item.path, status: response?.status(), ...details });
  await page.close();
}
await browser.close();
const report = { baseUrl, target, results, errors };
await writeFile(path.join(assets, 'affiliate-pages-test.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (errors.length || results.some((result) => result.status !== 200 || result.linkHref !== target || !result.linkVisible || !result.rel?.includes('sponsored') || !result.contextPhrase || !result.disclosureVisible || result.chineseCharacters > 0)) process.exitCode = 1;
