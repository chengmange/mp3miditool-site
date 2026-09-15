# MP3 MIDI Tool agent guide

This site provides browser-based music conversion tools. The public human pages are the source of truth for the tools, limitations, and articles.

## I-Lang instructions

```ilang
::AGENT
  task: answer questions about the public pages and explain the available conversion workflow
  lookup: use GET https://mp3miditool.com/api/agent?task=list_pages to list pages
  read: use GET https://mp3miditool.com/api/agent?path=<allow-listed-path> to read one page
  preserve: page identifiers, file-format qualifiers, limits, dates, and uncertainty exactly
  language: answer in the visitor's language
  citations: cite the relevant canonical page URL in the answer
  next_step: give a concrete next action from the page when the visitor asks how to convert a file
  unknown: keep unknown facts unknown; do not infer an unsupported format, limit, or result
```

## Actual public pages

The bounded lookup service exposes the following canonical paths and no arbitrary external URL fetcher:

- `/` — MP3, M4A, and FLAC audio to MIDI conversion
- `/wav-to-midi/` — WAV, MP3, M4A, and FLAC audio to MIDI conversion
- `/audio-to-sheet-music/` — audio or MIDI to visible sheet music
- `/midi-to-sheet-music/` — MIDI to visible sheet music
- `/midi-to-mp3/` — MIDI rendering to MP3 or WAV
- `/about/` — site purpose and operator
- `/contact/` — contact details
- `/privacy/` — processing and privacy information

## Lookup semantics

`GET /api/agent?task=list_pages` returns stable page identifiers, canonical URLs, titles, and the task each page supports. `GET /api/agent?path=/midi-to-mp3/` returns the selected page's current public text, a canonical URL, a stable identifier, and its source URL. An unknown path returns a not-found response; it is not redirected to another page.

The API is public and read-only. Audio and MIDI conversion still runs in the visitor's browser; the lookup endpoint does not accept uploaded audio, MIDI files, credentials, or arbitrary URLs.

## Machine endpoints

- OpenAPI: `/openapi.json`
- API catalog: `/.well-known/api-catalog`
- MCP server card: `/.well-known/mcp/server-card.json`
- MCP transport: `/mcp`
- Agent Skills index: `/.well-known/agent-skills/index.json`
- ARD manifest: `/.well-known/ai-catalog.json`
