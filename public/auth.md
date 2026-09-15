# MP3 MIDI Tool auth.md

This document is for agents that need to discover authentication and registration. Authentication is currently under construction and unavailable. No registration, token issuance, OAuth redirect, claim, or credential exchange is active.

## Agent registration

The planned registration method is anonymous agent registration for a future read scope. The planned registration endpoint is `https://mp3miditool.com/agent-auth/register`. It currently returns HTTP 503 with `temporarily_unavailable`; it does not create an account, store identity data, send email, issue a token, or begin an OAuth flow.

The planned anonymous credential type is an access token for the `site:read` scope. Agents must not call the registration, claim, authorization, token, or protected-resource endpoints while `available` is `false`. The working public lookup service does not require credentials.

```ilang
::AUTH
  status: under_construction
  available: false
  capabilities_status: planned_contract_only
  message: Coming soon; authentication is not available.
  launch_date: null
  agent_audience: agents that need public site discovery
  skill: https://mp3miditool.com/ai/skills/site-lookup/SKILL.md
  register_uri: https://mp3miditool.com/agent-auth/register
  identity_types_supported: [anonymous]
  anonymous:
    status: under_construction
    available: false
    credential_types_supported: [access_token]
    register_uri: https://mp3miditool.com/agent-auth/register
    claim_uri: https://mp3miditool.com/agent-auth/claim
    scopes_supported: [site:read]
  instruction: Do not attempt registration, claims, token exchange, or protected operations while available is false.
```

The existing public lookup service remains available without authentication. Use the public read-only service described at [the agent guide](https://mp3miditool.com/ai/) and its [OpenAPI document](https://mp3miditool.com/openapi.json). It accepts only the site's allow-listed public page paths; it does not accept uploaded media or arbitrary URLs.
