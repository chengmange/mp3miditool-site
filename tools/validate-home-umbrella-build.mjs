import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const read = (relative) => readFile(path.join(root, relative), 'utf8');
const home = await read('index.html');
const wav = await read(path.join('wav-to-midi', 'index.html'));
const sitemap = await read('sitemap.xml');
const scriptUrl = home.match(/<script[^>]+src="([^"]+)"/)?.[1];
const script = await read(scriptUrl.replace(/^\//, ''));
const checks = [];
function check(name, condition) {
  checks.push({ name, pass: Boolean(condition) });
  if (!condition) throw new Error(`Failed: ${name}`);
}

check('Title contains audio to MIDI and MP3 to MIDI', home.includes('<title>Audio to MIDI Converter &amp; MP3 to MIDI Converter'));
check('H1 contains audio to MIDI and MP3', home.includes('Convert audio to MIDI from an MP3'));
check('First screen directly explains conversion', home.includes('run the audio into MIDI transcription') && home.includes('download an editable .mid file'));
check('First screen links to the WAV tool', home.includes('hero-text') && home.includes('href="/wav-to-midi/"'));
check('General audio section is present', home.includes('How to turn audio into editable MIDI'));
check('Input formats are stated exactly', home.includes('accepts <code>.mp3</code>') && home.includes('accepts <code>.wav</code> and <code>.mp3</code>'));
check('Repair guidance is concrete', home.includes('Merge short fragments') && home.includes('restore a missing pitch') && home.includes('set tempo and bar alignment'));
check('Measured WAV and MP3 result is cited', home.includes('four-second phrase') && home.includes('five note events') && home.includes('93 bytes'));
check('Homepage converter input remains MP3', home.includes('accept="audio/mpeg,.mp3"'));
check('Built converter still checks MP3', script.includes('audio/mpeg') && script.includes('.mp3'));
check('WAV page links back to homepage converter', wav.includes('href="/#converter"'));
check('Sitemap has no new umbrella route', !sitemap.includes('/audio-to-midi/') && (sitemap.match(/<url>/g) ?? []).length === 6);

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
