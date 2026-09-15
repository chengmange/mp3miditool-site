const modelContext = globalThis.navigator?.modelContext;

if (modelContext && typeof modelContext.registerTool === 'function') {
  const controller = new AbortController();
  const listPages = {
    name: 'list_site_pages',
    description: 'List the bounded public pages of MP3 MIDI Tool.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const response = await fetch('/api/agent?task=list_pages', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Lookup failed with HTTP ${response.status}`);
      return response.json();
    },
    signal: controller.signal,
  };
  const readPage = {
    name: 'read_site_page',
    description: 'Read one public page from the MP3 MIDI Tool allow-list. Do not pass an arbitrary URL.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', enum: ['/', '/wav-to-midi/', '/audio-to-sheet-music/', '/midi-to-sheet-music/', '/midi-to-mp3/', '/about/', '/contact/', '/privacy/'] } },
      required: ['path'],
      additionalProperties: false,
    },
    execute: async ({ path }) => {
      const response = await fetch(`/api/agent?path=${encodeURIComponent(path)}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Lookup failed with HTTP ${response.status}`);
      return response.json();
    },
    signal: controller.signal,
  };
  modelContext.registerTool(listPages);
  modelContext.registerTool(readPage);
  globalThis.addEventListener?.('pagehide', () => controller.abort(), { once: true });
}
