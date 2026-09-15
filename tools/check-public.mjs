const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) throw new Error('Pass a base URL');

const checks = ['/', '/midi-to-mp3/', '/robots.txt', '/sitemap.xml', '/basic-pitch-model/model.json', '/basic-pitch-model/group1-shard1of1.bin'];
const results = [];

for (const path of checks) {
  const response = await fetch(`${base}${path}`, { redirect: 'follow' });
  const bytes = new Uint8Array(await response.arrayBuffer());
  results.push({
    path,
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get('content-type'),
    bytes: bytes.byteLength,
  });
}

console.log(JSON.stringify(results));
