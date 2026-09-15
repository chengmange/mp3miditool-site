import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
const digest = (text) => createHash('sha256').update(text).digest('hex');

const sourceMp3 = read('../../../outputs/mp3-to-midi-practical-workflow.md');
const copiedMp3 = read('../src/articles/mp3-to-midi-practical-workflow.md');
const sourceMidi = read('../../../outputs/convert-midi-to-mp3-second-article.md');
const copiedMidi = read('../src/articles/convert-midi-to-mp3-second-article.md');
const rootHtml = read('../dist/index.html');
const innerHtml = read('../dist/midi-to-mp3/index.html');
const robots = read('../dist/robots.txt');
const sitemap = read('../dist/sitemap.xml');

const result = {
  articlesUnchanged: digest(sourceMp3) === digest(copiedMp3) && digest(sourceMidi) === digest(copiedMidi),
  sourceHashes: [digest(sourceMp3), digest(sourceMidi)],
  cjkCharacters: (sourceMp3 + sourceMidi).match(/[\u3400-\u9fff]/g)?.length ?? 0,
  rootPageBuilt: rootHtml.includes('MP3 to MIDI Converter'),
  secondPageBuilt: innerHtml.includes('Convert MIDI to MP3'),
  robotsHasSitemap: robots.includes('https://mp3miditool.com/sitemap.xml'),
  sitemapHasBothRoutes: sitemap.includes('<loc>https://mp3miditool.com/</loc>') && sitemap.includes('<loc>https://mp3miditool.com/midi-to-mp3/</loc>'),
  modelBytes: statSync(fileURLToPath(new URL('../dist/basic-pitch-model/group1-shard1of1.bin', import.meta.url))).size,
};

console.log(JSON.stringify(result));
const ok = result.articlesUnchanged
  && result.cjkCharacters === 0
  && result.rootPageBuilt
  && result.secondPageBuilt
  && result.robotsHasSitemap
  && result.sitemapHasBothRoutes
  && result.modelBytes > 0;
if (!ok) process.exit(1);
