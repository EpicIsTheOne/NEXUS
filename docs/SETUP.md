# NEXUS Setup Guide

This guide is for getting NEXUS running without dragging private deployment state, Traefik labels, or Epic's server assumptions into your poor innocent machine.

## Minimum viable setup

You need only three things for basic chat:

1. Node.js 22+
2. a writable app data directory
3. an OpenAI-compatible chat backend

Voice, image generation, SillyTavern assets, and the OpenClaw bridge are optional.

## Quick start: local Node

```bash
git clone https://github.com/EpicIsTheOne/NEXUS.git
cd NEXUS
npm ci
cp .env.example .env
```

(`npm install` works too; `npm ci` is preferred for clean reproducible setup tests.)

## Copy/paste quick start (local Node)

```bash
git clone https://github.com/EpicIsTheOne/NEXUS.git && cd NEXUS
npm ci && cp .env.example .env
sed -i 's|^BACKEND_BASE_URL=.*|BACKEND_BASE_URL=http://127.0.0.1:1234/v1|' .env
sed -i 's|^DEFAULT_MODEL=.*|DEFAULT_MODEL=your-model-id|' .env
npm run setup:check && npm start
```

Open `http://localhost:3000/nexus/`.

Expected output (minimum):
- Login page loads
- `npm run setup:check` reports `Setup looks ready.` (or only non-blocking optional warnings)
- After login, a test character + conversation can produce one assistant reply

Edit `.env` and set the basics:

```env
PORT=3000
BASE_PATH=/nexus
APP_DATA_DIR=./data
PUBLIC_APP_ORIGIN=http://localhost:3000
BACKEND_BASE_URL=http://127.0.0.1:1234/v1
DEFAULT_MODEL=your-model-id
DEFAULT_PROVIDER_LABEL=local
```

Then run the setup doctor:

```bash
npm run setup:check
```

If it passes, start the app:

```bash
npm start
```

Open:

```text
http://localhost:3000/nexus/
```

## Quick start: local Docker

Use the local compose file for a normal machine. It does **not** require Traefik, a proxy network, SillyTavern mounts, or OpenClaw mounts.

## Copy/paste quick start (local Docker)

```bash
cp .env.example .env
sed -i 's|^BACKEND_BASE_URL=.*|BACKEND_BASE_URL=http://host.docker.internal:1234/v1|' .env
sed -i 's|^DEFAULT_MODEL=.*|DEFAULT_MODEL=your-model-id|' .env
# optional if 3000 is busy:
# echo 'HOST_PORT=4320' >> .env
# echo 'PUBLIC_APP_ORIGIN=http://localhost:4320' >> .env
docker compose -f docker-compose.local.yml up -d --build
```

Expected output (minimum):
- Container starts without port-bind errors
- App loads at `/nexus/`
- Setup status shows backend reachable (`/models` check passes)

```bash
cp .env.example .env
# edit .env first
# optional: change HOST_PORT if 3000 is already taken
docker compose -f docker-compose.local.yml up -d --build
```

Open:

```text
http://localhost:3000/nexus/
```

If port `3000` is already busy, set for example:

```env
HOST_PORT=4320
PUBLIC_APP_ORIGIN=http://localhost:4320
```

Then open `http://localhost:4320/nexus/` instead.

If your backend runs on the host and Docker cannot reach it, use `host.docker.internal` in `BACKEND_BASE_URL` (not `127.0.0.1`, which points to the container itself).

The default `docker-compose.yml` is production/deployment shaped. Use it only if you understand the proxy network, labels, and mounted paths.

## First login / admin account

On first startup, NEXUS creates its user store if it does not exist.

Recommended: set this before first boot if you want a known password:

```env
DEFAULT_ADMIN_PASSWORD=change-me-now
```

If you lose access, stop the app and repair/remove the private `data/users.json` file according to your deployment policy. Do not commit `data/`.

## Chat backend setup

NEXUS expects an OpenAI-compatible `/v1` backend.

### LM Studio

```env
BACKEND_BASE_URL=http://127.0.0.1:1234/v1
DEFAULT_PROVIDER_LABEL=LM Studio
DEFAULT_MODEL=your-loaded-model-id
```

### Ollama OpenAI-compatible endpoint

```env
BACKEND_BASE_URL=http://127.0.0.1:11434/v1
DEFAULT_PROVIDER_LABEL=Ollama
DEFAULT_MODEL=your-ollama-model
```

After startup, admins can open:

```text
Profile → Setup status
Profile → Model & endpoint settings
```

Use **Test connection** and model fetch controls there if the backend/model is wrong.

## Optional: Fish Audio voice

Voice is optional and manual. NEXUS does not need Fish Audio to chat.

```env
FISH_AUDIO_API_KEY=your-fish-key
FISH_AUDIO_BASE_URL=https://api.fish.audio
DEFAULT_FISH_REFERENCE_ID=optional-reference-id
DEFAULT_FISH_VOICE_LABEL=Default Fish Voice
FISH_TTS_BACKEND=s2-pro
```

Per-character voice settings and Test Voice live in character settings.

## Optional: image generation

Set one or more provider keys if you want image generation:

```env
REPLICATE_API_TOKEN=
OPENAI_API_KEY=
OPENROUTER_API_KEY=
```

If no image provider is configured, chat still works.

## Optional: OpenClaw bridge

Only needed for OpenClaw assistant-character routing:

```env
OPENCLAW_BRIDGE_URL=http://127.0.0.1:3101
OPENCLAW_BRIDGE_SECRET=shared-secret
OPENCLAW_AUTH_PROFILES_PATH=
```

If you are not using OpenClaw assistant characters, skip this.

## Runtime data: keep private

Never commit:

- `.env`
- `data/`
- `tmp/`
- `backups/`
- generated media/cache files
- private chat logs
- session cookies
- API keys

`data/` may contain users, password hashes, sessions, conversations, character assets, generated images, and TTS cache.

## Troubleshooting quick hits

### `npm run setup:check` says backend unreachable

Start LM Studio/Ollama/provider proxy, then re-run:

```bash
npm run setup:check
```

Also verify `BACKEND_BASE_URL` ends in `/v1` for OpenAI-compatible servers.

### Backend is reachable but default model is missing

Open the admin UI:

```text
Profile → Model & endpoint settings
```

Fetch models and choose one that exists.

### Fish Audio missing

That is not fatal. Voice is optional. Add `FISH_AUDIO_API_KEY` only if you want TTS.

### End-to-end quick sanity test (after login)

Use this minimal sequence to confirm the app can actually chat:

1. Create a local character
2. Create a conversation for that character
3. Send one chat message
4. Confirm a non-empty assistant response

If this fails while setup doctor is green, check conversation/character IDs and backend model routing in `Profile → Model & endpoint settings`.

### Docker cannot reach local LM Studio/Ollama

From Docker, `127.0.0.1` points inside the container. Use:

```env
BACKEND_BASE_URL=http://host.docker.internal:1234/v1
```

or the equivalent port for your backend.

### Production deploys

For production, review `docs/DEPLOYMENT.md` and the deployment-oriented `docker-compose.yml` before using it. The included production compose expects Traefik/proxy network assumptions.
