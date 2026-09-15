const base = process.argv[2] || 'http://127.0.0.1:8787';
const get = async (path, headers = {}) => {
  const response = await fetch(`${base}${path}`, { headers });
  return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
};
const post = async (path, body) => {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
};
const homeHtml = await get('/');
const homeMarkdown = await get('/', { accept: 'text/markdown' });
const homeHtmlAgain = await get('/');
const list = await get('/api/agent?task=list_pages', { accept: 'application/json' });
const page = await get('/api/agent?path=/midi-to-mp3/', { accept: 'application/json' });
const missing = await get('/api/agent?path=/not-allow-listed/', { accept: 'application/json' });
const initialize = await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'local-test', version: '1.0.0' } } });
const tools = await post('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
const call = await post('/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_site_page', arguments: { path: '/midi-to-mp3/' } } });
const results = {
  html: { status: homeHtml.status, contentType: homeHtml.headers['content-type'], vary: homeHtml.headers.vary, link: homeHtml.headers.link, hasHtml: /<html/i.test(homeHtml.body) },
  markdown: { status: homeMarkdown.status, contentType: homeMarkdown.headers['content-type'], vary: homeMarkdown.headers.vary, hasMarkdownHeading: /^# /m.test(homeMarkdown.body), notHtml: !/<html/i.test(homeMarkdown.body) },
  htmlAfterMarkdown: { status: homeHtmlAgain.status, contentType: homeHtmlAgain.headers['content-type'], hasHtml: /<html/i.test(homeHtmlAgain.body) },
  apiList: { status: list.status, contentType: list.headers['content-type'], parsed: JSON.parse(list.body) },
  apiRead: { status: page.status, parsed: JSON.parse(page.body), hasContent: page.body.includes('Canonical page') },
  apiMissing: { status: missing.status, parsed: JSON.parse(missing.body) },
  mcpInitialize: { status: initialize.status, parsed: JSON.parse(initialize.body) },
  mcpTools: { status: tools.status, parsed: JSON.parse(tools.body) },
  mcpCall: { status: call.status, parsed: JSON.parse(call.body), hasPageText: call.body.includes('Convert MIDI to MP3') },
};
console.log(JSON.stringify(results, null, 2));
const pass = results.html.status === 200 && results.html.hasHtml && results.html.contentType.includes('text/html') && results.html.link.includes('api-catalog')
  && results.markdown.status === 200 && results.markdown.contentType.includes('text/markdown') && results.markdown.hasMarkdownHeading && results.markdown.notHtml
  && results.htmlAfterMarkdown.hasHtml && results.apiList.status === 200 && results.apiList.parsed.pages.length === 8
  && results.apiRead.status === 200 && results.apiRead.hasContent && results.apiMissing.status === 404
  && results.mcpInitialize.status === 200 && results.mcpTools.status === 200 && results.mcpCall.status === 200 && results.mcpCall.hasPageText;
if (!pass) process.exitCode = 1;
