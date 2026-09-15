const queries = [
  ['cloudflare-svcb', 'https://cloudflare-dns.com/dns-query?name=_index._agents.mp3miditool.com&type=SVCB&do=1'],
  ['google-svcb', 'https://dns.google/resolve?name=_index._agents.mp3miditool.com&type=SVCB'],
  ['google-dnskey', 'https://dns.google/resolve?name=mp3miditool.com&type=DNSKEY&do=1'],
];
for (const [name, url] of queries) {
  const response = await fetch(url, { headers: { accept: 'application/dns-json' } });
  console.log(JSON.stringify({ name, url, status: response.status, body: await response.json() }, null, 2));
}
