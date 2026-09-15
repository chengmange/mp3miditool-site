import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const read = (relative) => readFile(path.join(root, relative), 'utf8');
const checks = [];
function check(name, condition) {
  checks.push({ name, pass: Boolean(condition) });
  if (!condition) throw new Error(`Failed: ${name}`);
}

const home = await read('index.html');
const guide = await read(path.join('midi-to-mp3', 'index.html'));
const wav = await read(path.join('wav-to-midi', 'index.html'));
const sitemap = await read('sitemap.xml');
const wavScriptMatch = wav.match(/<script[^>]+src="([^"]+)"/);
check('WAV page has a built script', wavScriptMatch);
const wavScriptRelative = wavScriptMatch[1].replace(/^\/wav-to-midi\//, '');
const wavScript = await read(path.join('wav-to-midi', wavScriptRelative));

check('Homepage links to WAV page', home.includes('/wav-to-midi/'));
check('MIDI guide links to WAV page', guide.includes('/wav-to-midi/'));
check('WAV page links to homepage converter', wav.includes('/#converter'));
check('WAV page links to MIDI guide', wav.includes('/midi-to-mp3/'));
check('WAV page first screen contains direct steps', wav.includes('Choose a <code>.wav</code>') && wav.includes('Download the generated <code>.mid</code>'));
check('WAV input is declared', wav.includes('audio/wav') && wav.includes('.wav'));
check('Built converter code checks WAV', wavScript.includes('.wav'));
check('Browser-only privacy statement is visible', wav.includes('never uploaded to a server'));
check('Comparison evidence is complete', !wav.includes('Pending verification') && (wav.match(/5 detected notes/g) ?? []).length === 2 && wav.includes('0.0698-second') && wav.includes('0.0594-second'));
check('Sitemap includes WAV page', sitemap.includes('https://mp3miditool.com/wav-to-midi/'));
check('No CJK characters on WAV page', !/[\u3400-\u9fff]/u.test(wav));
check('Model is included in build', (await stat(path.join(root, 'basic-pitch-model', 'model.json'))).size > 0);

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
