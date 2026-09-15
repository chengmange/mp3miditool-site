import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = (process.argv[2] || 'https://mp3miditool.com').replace(/\/$/, '');
const evidenceDir = path.resolve(process.argv[3] || '../../agent-readiness-evidence/2026-09-15');
await mkdir(evidenceDir, { recursive: true });

async function get(pathname, headers = {}) {
  const response = await fetch(`${base}${pathname}`, { headers, redirect: 'follow' });
  return { status: response.status, url: response.url, headers: Object.fromEntries(response.headers), body: await response.text() };
}
async function post(pathname, body) {
  const response = await fetch(`${base}${pathname}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, url: response.url, headers: Object.fromEntries(response.headers), body: await response.text() };
}

const home = await get('/');
const markdown = await get('/', { accept: 'text/markdown' });
const htmlAfterMarkdown = await get('/');
const markdownAfterHtml = await get('/midi-to-mp3/', { accept: 'text/markdown' });
const pages = {};
for (const pathname of ['/', '/wav-to-midi/', '/audio-to-sheet-music/', '/midi-to-sheet-music/', '/midi-to-mp3/', '/about/', '/contact/', '/privacy/']) pages[pathname] = await get(pathname);
const robots = await get('/robots.txt');
const sitemap = await get('/sitemap.xml');
const apiList = await get('/api/agent?task=list_pages', { accept: 'application/json' });
const apiRead = await get('/api/agent?path=/midi-to-mp3/', { accept: 'application/json' });
const apiMissing = await get('/api/agent?path=/not-allow-listed/', { accept: 'application/json' });
const mcpInitialize = await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'public-test', version: '1.0.0' } } });
const mcpTools = await post('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
const mcpListCall = await post('/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_site_pages', arguments: {} } });
const mcpReadCall = await post('/mcp', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'read_site_page', arguments: { path: '/midi-to-mp3/' } } });
const openapi = await get('/openapi.json', { accept: 'application/json' });
const catalog = await get('/.well-known/api-catalog', { accept: 'application/linkset+json' });
const ard = await get('/.well-known/ai-catalog.json', { accept: 'application/json' });
const skills = await get('/.well-known/agent-skills/index.json', { accept: 'application/json' });
const skill = await get('/ai/skills/site-lookup/SKILL.md', { accept: 'text/markdown' });
const card = await get('/.well-known/mcp/server-card.json', { accept: 'application/json' });
const auth = await get('/auth.md', { accept: 'text/markdown, text/plain, */*' });
const oauth = await get('/.well-known/oauth-authorization-server', { accept: 'application/json' });
const prm = await get('/.well-known/oauth-protected-resource', { accept: 'application/json' });

const parse = (response) => { try { return JSON.parse(response.body); } catch { return null; } };
const skillsJson = parse(skills);
const skillDigest = skillsJson?.skills?.[0]?.digest;
const actualDigest = `sha256:${createHash('sha256').update(skill.body).digest('hex')}`;
const result = {
  base,
  home: { status: home.status, contentType: home.headers['content-type'], link: home.headers.link, vary: home.headers.vary, hasAiCatalogHead: home.body.includes('rel="ai-catalog"') },
  markdown: { status: markdown.status, contentType: markdown.headers['content-type'], vary: markdown.headers.vary, hasMarkdownHeading: /^# /m.test(markdown.body), notHtml: !/<html/i.test(markdown.body) },
  htmlAfterMarkdown: { status: htmlAfterMarkdown.status, contentType: htmlAfterMarkdown.headers['content-type'], hasHtml: /<html/i.test(htmlAfterMarkdown.body) },
  markdownAfterHtml: { status: markdownAfterHtml.status, contentType: markdownAfterHtml.headers['content-type'], hasMarkdownHeading: /^# /m.test(markdownAfterHtml.body), notHtml: !/<html/i.test(markdownAfterHtml.body) },
  pages: Object.fromEntries(Object.entries(pages).map(([pathname, response]) => [pathname, { status: response.status, contentType: response.headers['content-type'], hasHtml: /<html/i.test(response.body) }])),
  robots: { status: robots.status, hasSitemap: robots.body.includes(`${base}/sitemap.xml`), hasContentSignal: /Content-Signal:\s*ai-train=no,\s*search=yes,\s*ai-input=yes/i.test(robots.body), hasAgentmap: robots.body.includes('/.well-known/ai-catalog.json') },
  sitemap: { status: sitemap.status, urlCount: (sitemap.body.match(/<loc>/g) || []).length, includesPages: Object.keys(pages).every((pathname) => sitemap.body.includes(`${base}${pathname}`)) },
  apiList: { status: apiList.status, contentType: apiList.headers['content-type'], pageCount: parse(apiList)?.pages?.length, readOnly: parse(apiList)?.read_only },
  apiRead: { status: apiRead.status, contentType: apiRead.headers['content-type'], hasSourceUrl: Boolean(parse(apiRead)?.page?.source_url), hasPageContent: Boolean(parse(apiRead)?.page?.content?.includes('Convert MIDI to MP3')) },
  apiMissing: { status: apiMissing.status, error: parse(apiMissing)?.error },
  mcp: { initializeStatus: mcpInitialize.status, protocolVersion: parse(mcpInitialize)?.result?.protocolVersion, toolsStatus: mcpTools.status, toolNames: parse(mcpTools)?.result?.tools?.map((tool) => tool.name), listCallStatus: mcpListCall.status, readCallStatus: mcpReadCall.status, readCallHasContent: mcpReadCall.body.includes('Convert MIDI to MP3') },
  docs: {
    openapi: { status: openapi.status, contentType: openapi.headers['content-type'], hasPaths: Boolean(parse(openapi)?.paths?.['/api/agent']) },
    apiCatalog: { status: catalog.status, contentType: catalog.headers['content-type'], hasLinkset: Boolean(parse(catalog)?.linkset?.length) },
    ard: { status: ard.status, contentType: ard.headers['content-type'], cors: ard.headers['access-control-allow-origin'], entries: parse(ard)?.entries?.length },
    skills: { status: skills.status, contentType: skills.headers['content-type'], digest: skillDigest, actualDigest, matches: skillDigest === actualDigest },
    skill: { status: skill.status, contentType: skill.headers['content-type'], hasInstructions: skill.body.includes('preserve') },
    serverCard: { status: card.status, contentType: card.headers['content-type'], hasEndpoint: Boolean(parse(card)?.endpoint), hasServerInfo: Boolean(parse(card)?.serverInfo?.name) },
    auth: { status: auth.status, contentType: auth.headers['content-type'], hasConstruction: auth.body.includes('under construction'), hasAuthHeading: /^# .*auth\.md/im.test(auth.body) },
    oauth: { status: oauth.status, contentType: oauth.headers['content-type'], issuer: parse(oauth)?.issuer, construction: parse(oauth)?.available === false },
    protectedResource: { status: prm.status, contentType: prm.headers['content-type'], resource: parse(prm)?.resource, construction: parse(prm)?.available === false },
  },
};
await writeFile(path.join(evidenceDir, 'public-test.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

const allPagesGood = Object.values(result.pages).every((item) => item.status === 200 && item.hasHtml);
const pass = result.home.status === 200 && result.home.link.includes('api-catalog') && result.home.vary.includes('Accept') && result.home.hasAiCatalogHead
  && result.markdown.status === 200 && result.markdown.contentType.includes('text/markdown') && result.markdown.hasMarkdownHeading && result.markdown.notHtml
  && result.htmlAfterMarkdown.hasHtml && result.markdownAfterHtml.contentType.includes('text/markdown') && result.markdownAfterHtml.notHtml
  && allPagesGood && result.robots.status === 200 && result.robots.hasSitemap && result.robots.hasContentSignal && result.robots.hasAgentmap
  && result.sitemap.status === 200 && result.sitemap.includesPages
  && result.apiList.status === 200 && result.apiList.pageCount === 8 && result.apiList.readOnly
  && result.apiRead.status === 200 && result.apiRead.hasSourceUrl && result.apiRead.hasPageContent && result.apiMissing.status === 404
  && result.mcp.initializeStatus === 200 && result.mcp.toolsStatus === 200 && result.mcp.toolNames.includes('list_site_pages') && result.mcp.toolNames.includes('read_site_page') && result.mcp.listCallStatus === 200 && result.mcp.readCallStatus === 200 && result.mcp.readCallHasContent
  && result.docs.openapi.status === 200 && result.docs.openapi.hasPaths && result.docs.apiCatalog.status === 200 && result.docs.apiCatalog.contentType.includes('application/linkset+json') && result.docs.apiCatalog.hasLinkset
  && result.docs.ard.status === 200 && result.docs.ard.entries > 0 && result.docs.ard.cors === '*'
  && result.docs.skills.status === 200 && result.docs.skills.matches && result.docs.skill.status === 200 && result.docs.serverCard.status === 200 && result.docs.serverCard.hasEndpoint && result.docs.serverCard.hasServerInfo
  && result.docs.auth.status === 200 && result.docs.auth.contentType.includes('text/markdown') && result.docs.auth.hasConstruction && result.docs.auth.hasAuthHeading
  && result.docs.oauth.status === 200 && result.docs.oauth.construction && result.docs.protectedResource.status === 200 && result.docs.protectedResource.construction;
if (!pass) process.exitCode = 1;
