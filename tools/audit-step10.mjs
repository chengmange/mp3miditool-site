import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const dist = resolve(site, 'dist');
const routes = ['/', '/midi-to-mp3/', '/about/', '/contact/', '/privacy/'];
const routeFile = (route) => resolve(dist, route === '/' ? 'index.html' : `.${route}index.html`);
const files = Object.fromEntries(routes.map((route) => [route, routeFile(route)]));
const html = Object.fromEntries(routes.map((route) => [route, readFileSync(files[route], 'utf8')]));

const forbiddenPlaceholder = /lorem ipsum|coming soon|under construction/i;
const linkErrors = [];
for (const [route, source] of Object.entries(html)) {
  for (const match of source.matchAll(/href=["']([^"']+)["']/g)) {
    const href = match[1];
    if (/^(?:mailto:|https?:|data:|#)/i.test(href)) continue;
    const path = href.split('#')[0].split('?')[0];
    if (!path) continue;
    const target = path.endsWith('/') ? resolve(dist, `.${path}index.html`) : resolve(dist, `.${path}`);
    if (!existsSync(target)) linkErrors.push({ from: route, href, target });
  }
}

const sitemap = readFileSync(resolve(dist, 'sitemap.xml'), 'utf8');
const checks = {
  pagesBuilt: Object.fromEntries(routes.map((route) => [route, existsSync(files[route]) && statSync(files[route]).size > 500])),
  noPlaceholders: Object.fromEntries(routes.map((route) => [route, !forbiddenPlaceholder.test(html[route])])),
  footerLinksOnMainPages: ['/about/', '/contact/', '/privacy/'].every((path) => html['/'].includes(`href="${path}"`) && html['/midi-to-mp3/'].includes(`href="${path}"`)),
  aboutName: html['/about/'].includes('<strong>CHENGMAN</strong>'),
  contactEmail: html['/contact/'].includes('mailto:clarethacorninginu48@gmail.com'),
  privacyLocalProcessing: html['/privacy/'].includes('selected audio file is not uploaded'),
  privacyAdvertising: html['/privacy/'].includes('Third-party advertising') && html['/privacy/'].includes('cookies, local storage, device identifiers'),
  sitemapAllRoutes: routes.every((route) => sitemap.includes(`https://mp3miditool.com${route}`)),
  internalLinksValid: linkErrors.length === 0,
  modelBytes: statSync(resolve(dist, 'basic-pitch-model', 'group1-shard1of1.bin')).size,
};

console.log(JSON.stringify({ checks, linkErrors }, null, 2));
const ok = Object.values(checks.pagesBuilt).every(Boolean)
  && Object.values(checks.noPlaceholders).every(Boolean)
  && checks.footerLinksOnMainPages
  && checks.aboutName
  && checks.contactEmail
  && checks.privacyLocalProcessing
  && checks.privacyAdvertising
  && checks.sitemapAllRoutes
  && checks.internalLinksValid
  && checks.modelBytes > 0;
if (!ok) process.exit(1);
