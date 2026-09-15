const origin = 'https://mp3miditool.com';
const checks = [];

async function get(path) {
  const started = Date.now();
  const response = await fetch(`${origin}${path}`, { cache: 'no-store' });
  const body = await response.text();
  return { response, body, elapsedMs: Date.now() - started };
}

function check(name, condition, evidence) {
  const item = { name, pass: Boolean(condition), evidence };
  checks.push(item);
  if (!condition) throw new Error(JSON.stringify(item));
}

const home = await get('/');
const guide = await get('/midi-to-mp3/');
const wav = await get('/wav-to-midi/');
const sitemap = await get('/sitemap.xml');
const model = await get('/basic-pitch-model/model.json');

check('WAV page responds over HTTPS', wav.response.status === 200, `${wav.response.status}; ${wav.elapsedMs} ms`);
check('Header is present', wav.body.includes('Primary navigation') && wav.body.includes('MP3<span>MIDI</span>Tool'), 'brand and primary navigation found');
check('WAV tool is mounted', wav.body.includes('id="audio-file"') && wav.body.includes('audio/wav') && wav.body.includes('id="convert-button"'), 'WAV file input and conversion button found');
check('WAV page links back to homepage', wav.body.includes('href="/#converter"'), 'homepage converter link found');
check('WAV page links to MIDI guide', wav.body.includes('href="/midi-to-mp3/"'), 'MIDI guide link found');
check('Homepage links to WAV page', home.response.status === 200 && home.body.includes('href="/wav-to-midi/"'), `${home.response.status}; link found`);
check('MIDI guide links to WAV page', guide.response.status === 200 && guide.body.includes('href="/wav-to-midi/"'), `${guide.response.status}; link found`);
check('Comparison evidence is live', (wav.body.match(/5 detected notes/g) ?? []).length === 2 && wav.body.includes('0.0698-second') && wav.body.includes('0.0594-second') && !wav.body.includes('Pending verification'), 'both measured result cards and the timing difference found');
check('Sitemap includes WAV page', sitemap.response.status === 200 && sitemap.body.includes(`${origin}/wav-to-midi/`), `${sitemap.response.status}; URL found`);
check('Transcription model is reachable', model.response.status === 200 && model.body.includes('modelTopology'), `${model.response.status}; ${model.body.length} text bytes`);

console.log(JSON.stringify({ origin, passed: checks.length, checks }, null, 2));
