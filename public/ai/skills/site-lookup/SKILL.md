---
name: site-lookup
description: Retrieve and explain the real public pages of MP3 MIDI Tool through its bounded read-only lookup service.
---

# Site lookup

Use this skill when an agent needs to find a public page, read a public page, or explain how the site's browser tools work.

## I-Lang operating instructions

```ilang
::SKILL
  list: GET https://mp3miditool.com/api/agent?task=list_pages
  read: GET https://mp3miditool.com/api/agent?path=<path returned by list>
  input: use only a path returned by list; do not fetch an arbitrary URL
  preserve: identifiers, qualifiers, dates, file formats, limits, and unknown values
  language: respond in the visitor's language
  cite: include the canonical page URL that supports each answer
  next: provide concrete next steps from the retrieved page
  unknown: do not turn missing information into an assumption
```

## Supported operations

The service exposes two public GET operations:

- `task=list_pages` returns the allow-listed public pages and stable identifiers.
- `path=/...` returns one page's current public text, title, canonical URL, and source URL.

The endpoint is read-only and bounded to `mp3miditool.com`. It does not accept uploaded media, credentials, or arbitrary external URLs. Conversion itself remains local to the visitor's browser.

## Response interpretation

Keep the `identifier`, `path`, `canonical_url`, `source_url`, `title`, and `content` fields associated with the same page. If a requested path is not in the allow-list, report the not-found response rather than substituting a nearby page.
