const origin = 'https://mp3miditool.com';
const routes = ['/', '/midi-to-mp3/', '/about/', '/contact/', '/privacy/'];
const fetched = {};

function decodeCloudflareEmail(encoded) {
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let value = '';
  for (let index = 2; index < encoded.length; index += 2) {
    value += String.fromCharCode(Number.parseInt(encoded.slice(index, index + 2), 16) ^ key);
  }
  return value;
}

function pageContainsEmail(body, email) {
  if (body.includes(`mailto:${email}`)) return true;
  return [...body.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)]
    .some((match) => decodeCloudflareEmail(match[1]) === email);
}

for (const route of routes) {
  const response = await fetch(`${origin}${route}`, { redirect: 'follow' });
  const body = await response.text();
  fetched[route] = {
    status: response.status,
    finalUrl: response.url,
    bytes: Buffer.byteLength(body),
    body,
  };
}

const internalTargets = new Set();
for (const { body } of Object.values(fetched)) {
  for (const match of body.matchAll(/href=["']([^"']+)["']/g)) {
    const href = match[1];
    if (href.startsWith('/cdn-cgi/l/email-protection')) continue;
    if (href.startsWith('/') && !href.startsWith('//')) internalTargets.add(href.split('#')[0] || '/');
  }
}

const linkChecks = [];
for (const path of internalTargets) {
  const response = await fetch(`${origin}${path}`, { redirect: 'follow' });
  linkChecks.push({ path, status: response.status, finalUrl: response.url });
}

const robotsResponse = await fetch(`${origin}/robots.txt`);
const robots = await robotsResponse.text();
const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
const sitemap = await sitemapResponse.text();
const pageChecks = Object.fromEntries(Object.entries(fetched).map(([route, item]) => [route, {
  status: item.status,
  finalUrl: item.finalUrl,
  bytes: item.bytes,
  placeholderFree: !/lorem ipsum|coming soon|under construction/i.test(item.body),
}]));

const evidence = {
  pageChecks,
  privacy: {
    linkedFromHome: fetched['/'].body.includes('href="/privacy/"'),
    localAudioStatement: fetched['/privacy/'].body.includes('selected audio file is not uploaded'),
    thirdPartyAdvertising: fetched['/privacy/'].body.includes('Third-party advertising'),
  },
  about: {
    linkedFromHome: fetched['/'].body.includes('href="/about/"'),
    operatorName: fetched['/about/'].body.includes('<strong>CHENGMAN</strong>'),
    purpose: fetched['/about/'].body.includes('browser-based MP3-to-MIDI converter'),
  },
  contact: {
    linkedFromHome: fetched['/'].body.includes('href="/contact/"'),
    usableEmail: pageContainsEmail(fetched['/contact/'].body, 'clarethacorninginu48@gmail.com'),
  },
  linkChecks,
  noBrokenInternalLinks: linkChecks.every((item) => item.status === 200),
  robots: { status: robotsResponse.status, hasSitemap: robots.includes(`${origin}/sitemap.xml`) },
  sitemap: { status: sitemapResponse.status, allFiveRoutes: routes.every((route) => sitemap.includes(`${origin}${route}`)) },
};

console.log(JSON.stringify(evidence, null, 2));
const ok = Object.values(pageChecks).every((item) => item.status === 200 && item.placeholderFree)
  && Object.values(evidence.privacy).every(Boolean)
  && Object.values(evidence.about).every(Boolean)
  && Object.values(evidence.contact).every(Boolean)
  && evidence.noBrokenInternalLinks
  && evidence.robots.status === 200
  && evidence.robots.hasSitemap
  && evidence.sitemap.status === 200
  && evidence.sitemap.allFiveRoutes;
if (!ok) process.exit(1);
