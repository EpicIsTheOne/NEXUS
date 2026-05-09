# NEXUS Setup Guide

This guide gets NEXUS running locally or in Docker without copying private deployment state into git.

## Requirements

- Node.js 22+
- npm
- Optional: Docker + Docker Compose
- Optional: an OpenAI-compatible chat backend, such as a local model server
- Optional: Fish Audio API key for TTS
- Optional: Replicate/OpenAI/OpenRouter keys for image generation

## 1. Clone and install

```bash
git clone https://github.com/EpicIsTheOne/NEXUS.git
cd NEXUS
npm install
cp .env.example .env
```

Edit `.env` for your machine. At minimum, configure a chat backend:

```env
PORT=3000
BASE_PATH=/aichat
BACKEND_BASE_URL=http://127.0.0.1:1234/v1
DEFAULT_MODEL=your-model-id
DEFAULT_PROVIDER_LABEL=local
APP_DATA_DIR=./data
```

## 2. Run locally

```bash
npm start
```

Open:

```text
http://localhost:3000/aichat/
```

On first startup, NEXUS creates an admin account if no user store exists. Set `DEFAULT_ADMIN_PASSWORD` in your environment if you want a known first password; otherwise the server generates a random one. Do not commit that password.

## 3. Docker deployment

```bash
cp .env.example .env
# edit .env first
docker compose up -d --build
```

The included `docker-compose.yml` mirrors the current deployed shape and expects a `proxy` Docker network / Traefik style setup. If you are deploying elsewhere, review:

- `networks`
- `volumes`
- Traefik labels
- `OPENCLAW_AUTH_PROFILES_PATH`
- `OPENCLAW_BRIDGE_URL`
- `OPENCLAW_BRIDGE_SECRET`

## 4. Configure providers

NEXUS can use provider settings from the admin UI and/or environment. Common keys:

```env
OPENAI_API_KEY=
OPENROUTER_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
XAI_API_KEY=
REPLICATE_API_TOKEN=
FISH_AUDIO_API_KEY=
```

For Fish Audio TTS:

```env
FISH_AUDIO_API_KEY=your-fish-key
FISH_AUDIO_BASE_URL=https://api.fish.audio
DEFAULT_FISH_REFERENCE_ID=optional-reference-id
DEFAULT_FISH_VOICE_LABEL=Default Fish Voice
FISH_TTS_BACKEND=s2-pro
```

## 5. Runtime data

Do not commit runtime data. These paths are intentionally gitignored:

- `.env`
- `data/`
- `tmp/`
- `backups/`
- `node_modules/`
- `.pydeps/`
- generated media/cache files

`data/` may contain:

- users and password hashes
- sessions
- conversations
- character assets
- generated images
- TTS cache
- private app configuration

Treat it as private production data.

## 6. Useful checks

```bash
node --check server.mjs
npm start
curl http://localhost:3000/aichat/api/health
```

Most API routes require a login session, so browser testing is usually easiest after first boot.
