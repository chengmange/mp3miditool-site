const ORIGIN = 'https://mp3miditool.com';
const SERVICE_NAME = 'MP3 MIDI Tool Site Lookup';
const SERVICE_VERSION = '1.0.0';

const PAGES = [
  { path: '/', task: 'Convert MP3, M4A, or FLAC audio to editable MIDI.' },
  { path: '/wav-to-midi/', task: 'Convert WAV, MP3, M4A, or FLAC audio to editable MIDI.' },
  { path: '/audio-to-sheet-music/', task: 'Turn audio or MIDI into visible sheet music.' },
  { path: '/midi-to-sheet-music/', task: 'Render a MIDI file as visible sheet music.' },
  { path: '/midi-to-mp3/', task: 'Render a MIDI file to MP3 or WAV audio.' },
  { path: '/about/', task: 'Explain the site purpose and operator.' },
  { path: '/contact/', task: 'Provide the public contact details.' },
  { path: '/privacy/', task: 'Explain browser processing and privacy.' },
];

const PAGE_MAP = new Map(PAGES.map((page) => [page.path, page]));
const HTML_PATHS = new Set(PAGES.map((page) => page.path));
const MACHINE_PATHS = [
  '/ai/', '/ai/index.ilang', '/ai/skills/site-lookup/SKILL.md', '/openapi.json',
  '/.well-known/api-catalog', '/.well-known/ai-catalog.json',
  '/.well-known/agent-skills/index.json', '/.well-known/mcp/server-card.json',
  '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource',
  '/.well-known/jwks.json', '/auth.md', '/llms.txt', '/llms-full.txt',
];
const MACHINE_PATH_SET = new Set(MACHINE_PATHS);

function jsonResponse(value, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
    ...extraHeaders,
  });
  return new Response(JSON.stringify(value, null, 2), { status, headers });
}

function errorResponse(status, code, message) {
  return jsonResponse({ error: code, message }, status, { 'cache-control': 'no-store' });
}

function pageIdentifier(path) {
  return `https://mp3miditool.com${path === '/' ? '/#home' : path}`;
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/');
}

function plainText(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function htmlToMarkdown(html, path) {
  const title = plainText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || path);
  let source = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  source = source
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, text) => `[${plainText(text)}](${href})`)
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_match, text) => `\`${plainText(text)}\``)
    .replace(/<br\s*\/?>(?=\s*)/gi, '\n')
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<article\b[^>]*>|<\/article>|<section\b[^>]*>|<\/section>|<div\b[^>]*>|<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
  const lines = decodeEntities(source)
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, index, all) => line || (index > 0 && all[index - 1]));
  const body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return `# ${title}\n\nCanonical page: ${ORIGIN}${path}\n\n${body}`.slice(0, 60000);
}

function pageSummary(page, title = '') {
  return {
    identifier: pageIdentifier(page.path),
    path: page.path,
    canonical_url: `${ORIGIN}${page.path}`,
    title: title || page.path,
    task: page.task,
  };
}

async function fetchHtmlAsset(request, env, path) {
  const url = new URL(path, request.url);
  const headers = new Headers(request.headers);
  headers.set('accept', 'text/html');
  return env.ASSETS.fetch(new Request(url, { method: 'GET', headers }));
}

async function readPage(request, env, path) {
  const page = PAGE_MAP.get(path);
  if (!page) return null;
  const response = await fetchHtmlAsset(request, env, path);
  if (!response.ok) return null;
  const html = await response.text();
  const title = plainText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || path);
  return {
    ...pageSummary(page, title),
    source_url: `${ORIGIN}${path}`,
    content: htmlToMarkdown(html, path),
  };
}

async function agentLookup(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return errorResponse(405, 'method_not_allowed', 'Use GET for the public lookup service.');
  }
  const url = new URL(request.url);
  const task = url.searchParams.get('task');
  const path = url.searchParams.get('path');
  if (task && task !== 'list_pages') {
    return errorResponse(400, 'unsupported_task', 'The only supported task is list_pages.');
  }
  if (task === 'list_pages' || (!task && !path)) {
    return jsonResponse({
      service: SERVICE_NAME,
      task: 'list_pages',
      read_only: true,
      pages: PAGES.map((page) => pageSummary(page)),
    });
  }
  if (!path || !PAGE_MAP.has(path)) {
    return errorResponse(404, 'page_not_found', 'The path is not in the public page allow-list.');
  }
  const page = await readPage(request, env, path);
  if (!page) return errorResponse(502, 'page_unavailable', 'The selected public page could not be read.');
  return jsonResponse({ service: SERVICE_NAME, task: 'read_page', page });
}

const MCP_TOOLS = [
  {
    name: 'list_site_pages',
    description: 'List the bounded public pages of MP3 MIDI Tool.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_site_page',
    description: 'Read one public page from the MP3 MIDI Tool allow-list. Do not pass an arbitrary URL.',
    inputSchema: { type: 'object', properties: { path: { type: 'string', enum: PAGES.map((page) => page.path) } }, required: ['path'], additionalProperties: false },
  },
];

function mcpResult(id, result) {
  return jsonResponse({ jsonrpc: '2.0', id, result }, 200, { 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
}

function mcpError(id, code, message) {
  return jsonResponse({ jsonrpc: '2.0', id, error: { code, message } }, 200, { 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
}

async function mcp(request, env) {
  if (request.method === 'GET') return errorResponse(405, 'method_not_allowed', 'Use POST for the Streamable HTTP MCP endpoint.');
  if (request.method !== 'POST') return errorResponse(405, 'method_not_allowed', 'Use POST for the Streamable HTTP MCP endpoint.');
  let body;
  try { body = await request.json(); } catch { return errorResponse(400, 'invalid_json', 'MCP requests must be JSON.'); }
  const { id = null, method, params = {} } = body || {};
  if (method === 'notifications/initialized') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' } });
  if (method === 'initialize') {
    return mcpResult(id, {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: SERVICE_NAME, version: SERVICE_VERSION },
      instructions: 'Use list_site_pages, then read_site_page with a returned path. Preserve identifiers, qualifiers, dates, and unknowns.',
    });
  }
  if (method === 'tools/list') return mcpResult(id, { tools: MCP_TOOLS });
  if (method !== 'tools/call') return mcpError(id, -32601, `Unsupported MCP method: ${method || 'missing'}`);
  const name = params?.name;
  const args = params?.arguments || {};
  if (name === 'list_site_pages') {
    const payload = { service: SERVICE_NAME, task: 'list_pages', read_only: true, pages: PAGES.map((page) => pageSummary(page)) };
    return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], structuredContent: payload });
  }
  if (name === 'read_site_page') {
    if (!PAGE_MAP.has(args.path)) return mcpResult(id, { isError: true, content: [{ type: 'text', text: 'The path is not in the public page allow-list.' }] });
    const page = await readPage(request, env, args.path);
    if (!page) return mcpError(id, -32000, 'The selected public page could not be read.');
    const payload = { service: SERVICE_NAME, task: 'read_page', page };
    return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], structuredContent: payload });
  }
  return mcpError(id, -32602, `Unknown MCP tool: ${name || 'missing'}`);
}

function constructionResponse() {
  return jsonResponse({ status: 'under_construction', available: false, error: 'temporarily_unavailable', error_description: 'Coming soon. No registration or token issuance is available. Use the public lookup service.' }, 503, { 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
}

async function serve(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/agent') return agentLookup(request, env);
  if (url.pathname === '/mcp') return mcp(request, env);
  if (/^\/agent-auth\/(authorize|token|register|claim|resource)$/.test(url.pathname)) return constructionResponse();

  const accept = request.headers.get('accept') || '';
  const wantsMarkdown = /(?:^|,|\s)text\/markdown(?:\s|,|$)/i.test(accept);
  let response;
  if (wantsMarkdown && HTML_PATHS.has(url.pathname)) {
    const asset = await fetchHtmlAsset(request, env, url.pathname);
    if (asset.ok) {
      const html = await asset.text();
      const markdown = htmlToMarkdown(html, url.pathname);
      response = new Response(markdown, { status: asset.status, headers: { 'content-type': 'text/markdown; charset=utf-8', 'x-markdown-tokens': String(Math.ceil(markdown.length / 4)), 'cache-control': 'public, max-age=0, must-revalidate' } });
    } else response = asset;
  } else {
    response = await env.ASSETS.fetch(request);
  }

  const headers = new Headers(response.headers);
  headers.set('vary', 'Accept');
  if (url.pathname === '/') {
    headers.set('Link', '<https://mp3miditool.com/.well-known/api-catalog>; rel="api-catalog", <https://mp3miditool.com/openapi.json>; rel="service-desc", <https://mp3miditool.com/ai/>; rel="service-doc", <https://mp3miditool.com/.well-known/ai-catalog.json>; rel="describedby"');
  }
  if (MACHINE_PATH_SET.has(url.pathname) || url.pathname === '/api/agent' || url.pathname === '/mcp') {
    headers.set('access-control-allow-origin', '*');
  }
  if (url.pathname === '/auth.md') headers.set('content-type', 'text/markdown; charset=utf-8');
  if (url.pathname === '/.well-known/api-catalog') headers.set('content-type', 'application/linkset+json; charset=utf-8');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default { fetch: serve };
