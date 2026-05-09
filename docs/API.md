# NEXUS API Reference

NEXUS exposes two sets of APIs:

1. app APIs used by the web client
2. scriptable NEXUS APIs under `/api/nexus`

The current v1 auth model uses the normal web login session cookie. API keys are not enabled yet.

## Auth

### `POST /api/auth/login`

```json
{
  "username": "Epic",
  "password": "YOUR_PASSWORD"
}
```

Returns a login session cookie.

### `POST /api/auth/logout`

Clears the current session.

### `GET /api/auth/session`

Returns the current authenticated user/session state.

## Health/bootstrap/models

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Authenticated app health |
| `GET` | `/api/bootstrap` | Initial UI data: user, characters, config, preferences |
| `GET` | `/api/models` | Available configured models |
| `GET` | `/api/provider-models` | Provider-backed model list |

## NEXUS scriptable API

### `GET /api/nexus/health`

Authenticated health probe for scripts.

### `GET /api/nexus/characters`

Lists characters and IDs suitable for API calls.

### `POST /api/nexus/histories`

Creates a saved history.

### `GET /api/nexus/histories/:historyId`

Fetches a saved history.

### `POST /api/nexus/chat`

Runs a chat turn. Supports normal and streaming chat behavior depending on request options.

## Characters

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/characters` | Create a character |
| `GET` | `/api/characters/:characterId` | Fetch a character |
| `PUT` | `/api/characters/:characterId` | Update a character |
| `GET` | `/api/characters/:characterId/export` | Export character data |
| `DELETE` | `/api/characters/:characterId` | Delete a character |
| `POST` | `/api/characters/import` | Import a character card/file |
| `POST` | `/api/characters/acquire-chub` | Admin: acquire from Chub |
| `GET` | `/api/acquisition/chub` | Admin: Chub acquisition status |
| `POST` | `/api/acquisition/chub/start` | Admin: start acquisition run |

## Conversations and memory

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/conversations` | List conversations |
| `POST` | `/api/conversations` | Create a conversation |
| `GET` | `/api/conversations/:conversationId` | Fetch one conversation |
| `PUT` | `/api/conversations/:conversationId` | Update conversation metadata/messages |
| `DELETE` | `/api/conversations/:conversationId` | Delete a conversation |
| `GET` | `/api/conversations/:conversationId/memory` | Get memory cards |
| `POST` | `/api/conversations/:conversationId/memory` | Create/edit memory entries |
| `POST` | `/api/conversations/:conversationId/memory/refresh` | Refresh memory extraction |
| `POST` | `/api/memory/:memoryId/dismiss` | Dismiss a memory |
| `POST` | `/api/memory/:memoryId/promote` | Promote a memory |
| `POST` | `/api/characters/:characterId/memory-seeds` | Seed character memory |

## Personas and preferences

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/personas` | Create persona |
| `PUT` | `/api/personas/:personaId` | Update persona |
| `GET` | `/api/preferences` | Get user preferences |
| `PUT` | `/api/preferences` | Update user preferences |
| `GET` | `/api/ui` | Get user UI settings |
| `PUT` | `/api/ui` | Update user UI settings |

## TTS / Fish Audio

### `POST /api/tts/tag`

Produces Fish-style tagged text for speech.

### `POST /api/tts/audio`

Tags and synthesizes audio bytes. Important request fields include:

```json
{
  "text": "Line to speak",
  "voiceId": "fish-reference-id",
  "format": "mp3",
  "stream": true,
  "includeAsteriskNarration": false
}
```

Responses include audio bytes and may set:

- `X-TTS-Mode: stream`
- `X-TTS-Mode: full`
- `X-TTS-Mode: cache`

### `POST /api/tts`

Character-context TTS playback route used by the app UI.

## Image generation

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/characters/:characterId/generate-image-prompt` | Generate/refine an image prompt |
| `POST` | `/api/characters/:characterId/generate-image` | Generate image assets |

## Admin/config

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/users` | Admin user list |
| `POST` | `/api/admin/users` | Create user |
| `PUT` | `/api/admin/users/:username` | Update role/password |
| `GET` | `/api/config/ui` | UI config |
| `PUT` | `/api/config/ui` | Update UI config |
| `GET` | `/api/config/endpoints` | Endpoint config |
| `PUT` | `/api/config/endpoints` | Update endpoints |
| `GET` | `/api/config/providers` | Provider config |
| `PUT` | `/api/config/providers` | Update providers |
| `POST` | `/api/config/test-connection` | Test configured backend connection |
| `GET` | `/api/fish/models` | Search/list Fish voices/models |
| `POST` | `/api/fish/rematch-default-voices` | Rematch Fish default voices |
