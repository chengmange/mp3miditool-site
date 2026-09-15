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
const wav = await read(path.join('wav-to-midi', 'index.html'));
const sheet = await read(path.join('audio-to-sheet-music', 'index.html'));
const sitemap = await read('sitemap.xml');
const scriptMatch = sheet.match(/<script[^>]+src="([^"]+)"/);
check('Sheet page has built JavaScript', scriptMatch);
const scriptPath = scriptMatch[1].replace(/^\//, '');
const sheetScript = await read(scriptPath);

check('First screen gives direct conversion steps', sheet.includes('Turn an audio recording into visible, downloadable sheet music.') && sheet.includes('Create sheet music') && sheet.includes('download MusicXML or SVG'));
check('Audio and MIDI input formats are declared', sheet.includes('audio/mpeg') && sheet.includes('audio/wav') && sheet.includes('.mid'));
check('Free and no-login statement is visible', sheet.includes('Free to use. No account or login is requested.'));
check('Browser-only privacy statement is visible', sheet.includes('never uploaded'));
check('Measured run is published', sheet.includes('31-second WAV') && sheet.includes('33 notes') && sheet.includes('1 rendered score page') && sheet.includes('92.9 seconds') && !sheet.includes('Pending local verification'));
check('MusicXML and SVG downloads exist in built code', sheetScript.includes('Download MusicXML') && sheetScript.includes('Download score SVG'));
check('Rendered notation code is included', sheetScript.includes('OpenSheetMusicDisplay') || sheetScript.includes('score-partwise'));
check('Homepage points to sheet page', home.includes('/audio-to-sheet-music/'));
check('WAV page points to sheet page', wav.includes('/audio-to-sheet-music/'));
check('Sheet page points to homepage and WAV page', sheet.includes('/#converter') && sheet.includes('/wav-to-midi/'));
check('Sitemap includes sheet page', sitemap.includes('https://mp3miditool.com/audio-to-sheet-music/'));
check('No CJK characters on sheet page', !/[\u3400-\u9fff]/u.test(sheet));
check('Model is included in build', (await stat(path.join(root, 'basic-pitch-model', 'model.json'))).size > 0);

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
