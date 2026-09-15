# MP3 MIDI Tool auth.md

Authentication is currently under construction and unavailable. No registration, token issuance, OAuth redirect, or credential exchange is active.

```ilang
::AUTH
  status: under_construction
  available: false
  capabilities_status: planned_contract_only
  message: Coming soon; authentication is not available.
  launch_date: null
  instruction: Do not attempt registration, claims, token exchange, or protected operations while available is false.
```

The existing public lookup service remains available without authentication. Use the public read-only service described at [the agent guide](https://mp3miditool.com/ai/) and its [OpenAPI document](https://mp3miditool.com/openapi.json). It accepts only the site's allow-listed public page paths; it does not accept uploaded media or arbitrary URLs.
