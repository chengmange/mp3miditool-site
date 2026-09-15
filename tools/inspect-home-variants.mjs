import { chromium } from 'playwright';
const root = process.cwd();
const browser = await chromium.launch({ headless: true, executablePath: `${root}/.playwright-browsers/chromium_headless_shell-1187/chrome-win/headless_shell.exe` });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('https://mp3miditool.com/', { waitUntil: 'networkidle', timeout: 120000 });
const snippets = await page.evaluate(() => {
  const terms = ['audio into MIDI', 'audio to MIDI converter', 'audio to MIDI conversion'];
  return Object.fromEntries(terms.map((term) => [term, [...document.querySelectorAll('h1,h2,h3,p')].filter((node) => node.textContent?.toLowerCase().includes(term.toLowerCase())).map((node) => node.textContent.trim())]));
});
console.log(JSON.stringify(snippets, null, 2));
await browser.close();
