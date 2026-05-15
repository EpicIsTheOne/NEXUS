# NEXUS / AIChat

NEXUS is a self-hosted character-chat web app with a cyberpunk mobile-first UI, login-gated character library, saved histories, persona support, model routing, image generation, Fish Audio TTS, and scriptable API endpoints.

The live deployment for Epic runs at:

- App: `https://your-domain.example/aichat/`
- API docs: `https://your-domain.example/aichat/nexus-api.html`
- NEXUS API base: `https://your-domain.example/aichat/api/nexus`


## Documentation

- [Setup guide](docs/SETUP.md)
- [Feature guide](docs/FEATURES.md)
- [API reference](docs/API.md)
- [Deployment notes](docs/DEPLOYMENT.md)
- [OpenClaw bridge notes](docs/OPENCLAW_BRIDGE.md)

![NEXUS login screen](docs/assets/screenshots/nexus-login.png)

## What NEXUS can do

### Chat and character roleplay

- Login-protected chat UI.
- Character library with search, source filters, tag filters, featured/new/Chub tabs, and top-character strips.
- Saved recent chats and conversation histories.
- New chat creation and history switching.
- Character-specific settings.
- Persona creation/editing and persona selection.
- Local profile support for admin users.
- Per-message image upload/preview support.
- Lightbox image preview for generated/uploaded images.
- Memory panel for conversation memory review and management.
- Memory refresh, seed, promote, dismiss, and edit APIs.

### Character management

- Create characters directly in the UI.
- Edit existing character cards.
- Import character cards from files/URLs.
- Export characters.
- Delete characters.
- Store local character assets and avatars.
- Import from Chub / Character Hub using the acquisition pipeline.
- Chub acquisition supports batch size, score thresholds, and rejection summaries.
- Character metadata backfill scripts are included.

### Model and provider routing

- Supports a local OpenAI-compatible backend through `BACKEND_BASE_URL`.
- Supports configurable global model selection.
- Supports endpoint settings and provider settings from the admin UI.
- Supports provider API keys for OpenAI, OpenRouter, Anthropic, Gemini, and xAI through the admin panel/config.
- Supports fallback endpoint configuration.
- Includes connection testing endpoints for admin diagnostics.

### Voice / TTS

- Fish Audio integration via the official `fish-audio` package.
- Fish model/voice search endpoint.
- Per-character Fish voice/reference settings.
- Fish default voice rematching helper.
- Fish-style emotion tagging endpoint: `POST /api/tts/tag`.
- Tagged audio endpoint: `POST /api/tts/audio`.
- Tagged audio can return:
  - cached audio
  - full generated audio
  - realtime streamed Fish audio when `stream: true`
- `X-TTS-Mode` response header reports `stream`, `full`, or `cache`.
- TTS cache pruning by age, file count, and total byte size.
- Optional asterisk/narration handling for spoken output.

### Image generation

- Prompt generation endpoint for character images.
- Image generation through configured providers.
- Replicate SDXL support when `REPLICATE_API_TOKEN` is configured.
- OpenAI / OpenRouter image model options.
- Generated assets are stored and served from app data/public asset endpoints.

### NEXUS API

The scriptable API is documented in `public/nexus-api.html` and exposed under `/api/nexus`.

Core endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/nexus/health` | Health check |
| `GET` | `/api/nexus/characters` | List characters and IDs |
| `POST` | `/api/nexus/histories` | Create a saved history |
| `GET` | `/api/nexus/histories/:historyId` | Fetch one history |
| `POST` | `/api/nexus/chat` | Normal or streaming chat |
| `POST` | `/api/tts/tag` | Produce Fish-style tagged TTS text |
| `POST` | `/api/tts/audio` | Tag + synthesize Fish audio bytes |
| `POST` | `/api/tts` | Character-context TTS playback route |
| `POST` | `/api/chat` | Main app chat endpoint |

NEXUS API auth currently uses the same web login session cookie as the app. API keys are not enabled for v1.

### Admin features

- Login/logout/session APIs.
- Admin user management.
- Create users, change roles, and reset passwords.
- UI config management.
- Endpoint/provider config management.
- Provider connection tests.
- Chub acquisition controls.

### Mobile/PWA/UI

- Cyberpunk NEXUS UI theme.
- Mobile-first layout with library/recents/chat transitions.
- PWA manifest and service worker.
- Install button/hint for mobile devices.
- Header controls for memory, TTS status, profile/settings, and recents.
- Touch-friendly character library and chat composer.

### OpenClaw bridge integration (Alpha)

- Optional OpenClaw bridge integration through `OPENCLAW_BRIDGE_URL` and `OPENCLAW_BRIDGE_SECRET`.
- **Alpha / experimental:** this feature is not fully reliable yet.
- Can send chat/session work to an OpenClaw bridge when configured.
- Uses mounted OpenClaw auth profiles in the current Docker deployment.

## Project layout

| Path | Purpose |
|---|---|
| `server.mjs` | Express server, auth, data APIs, chat routes, NEXUS API, TTS, image generation, acquisition hooks |
| `public/` | Live frontend app, styles, service worker, manifest, API docs |
| `public/nexus-api.html` | Human-readable API examples and endpoint docs |
| `characters/` | Seed/imported character assets and JSON cards used by the deployment |
| `scripts/` | Character acquisition and metadata backfill helpers |
| `automation/chub/` | Chub acquisition automation package |
| `bridge-app/` | Optional bridge-side helper app/package |
| `Dockerfile` | Production container image |
| `docker-compose.yml` | Current deployed service definition |

Runtime/private directories are intentionally ignored by git:

- `.env`
- `data/`
- `node_modules/`
- `.pydeps/`
- `tmp/`
- `backups/`
- generated caches/assets

## Environment variables

Common deployment variables:

| Variable | Purpose |
|---|---|
| `PORT` | Server port. Defaults to `3000`. |
| `BASE_PATH` | Mount path. Live deployment uses `/aichat`. |
| `BACKEND_BASE_URL` | OpenAI-compatible chat backend URL. |
| `DEFAULT_MODEL` | Default chat model. |
| `DEFAULT_PROVIDER_LABEL` | Human label for the default provider. |
| `ST_DATA_DIR` | Optional SillyTavern-compatible data mount. |
| `APP_DATA_DIR` | Writable NEXUS app data directory. Defaults to `/app/data`. |
| `PUBLIC_APP_ORIGIN` | Public origin used for generated/public URLs. |
| `FISH_AUDIO_API_KEY` | Enables Fish Audio TTS/model APIs. |
| `FISH_AUDIO_BASE_URL` | Fish API base. Defaults to `https://api.fish.audio`. |
| `DEFAULT_FISH_REFERENCE_ID` | Optional default Fish reference/voice ID. |
| `FISH_TTS_BACKEND` | Fish backend, default `s2-pro`. |
| `TTS_EMOTION_MODEL` | Optional model for TTS emotion tagging. |
| `REPLICATE_API_TOKEN` | Enables Replicate image generation. |
| `OPENAI_API_KEY` | Enables OpenAI image/provider calls where configured. |
| `OPENROUTER_API_KEY` | Enables OpenRouter provider/image calls. |
| `OPENCLAW_BRIDGE_URL` | Optional OpenClaw bridge URL. |
| `OPENCLAW_BRIDGE_SECRET` | Optional OpenClaw bridge shared secret. |

Do not commit real `.env` files, API keys, bridge secrets, session cookies, generated data, or private character/chat logs.

## Local development

```bash
npm ci
cp .env.example .env
npm run setup:check
npm start
```

(`npm install` is also supported; `npm ci` is recommended for clean-room verification.)

Then open:

```text
http://localhost:3000/aichat/
```

The setup doctor checks Node, writable data paths, backend reachability, optional Fish Audio, optional image providers, and optional OpenClaw bridge wiring before you waste time in the browser.

## Docker

For local Docker without Traefik/proxy assumptions:

```bash
cp .env.example .env
# edit .env first
# optional: set HOST_PORT=4320 if 3000 is already taken
docker compose -f docker-compose.local.yml up -d --build
```

The default `docker-compose.yml` is deployment-oriented. Review secrets, volumes, Traefik labels, and network names before using it on a different host.

## Safety / privacy notes

- `data/` contains private runtime state and is not meant for GitHub.
- `.env` contains secrets and must stay local.
- The README and API docs use placeholder credentials only; use environment/user-managed credentials in real deployments.
- The app is intended to be deployed behind HTTPS and login protection.
