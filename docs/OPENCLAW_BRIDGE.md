# OpenClaw Bridge (Alpha)

> ⚠️ **Alpha feature:** the OpenClaw bridge is still experimental and may be unreliable in some flows.

NEXUS can optionally send work to an OpenClaw bridge service. This is useful when character/chat actions should be handled by OpenClaw rather than only the configured chat backend.

## Environment

```env
OPENCLAW_BRIDGE_URL=http://127.0.0.1:3101
OPENCLAW_BRIDGE_SECRET=change-me
OPENCLAW_AUTH_PROFILES_PATH=/openclaw-auth-profiles.json
```

The bridge secret must match between NEXUS and the bridge service.

## Bridge app

The optional bridge helper lives in `bridge-app/`.

```bash
cd bridge-app
npm install
AICHAT_BRIDGE_SECRET=change-me npm start
```

The bridge exposes:

- `GET /health`
- `POST /run`

`POST /run` requires `x-aichat-bridge-secret`.

## Security

- Never commit real bridge secrets.
- Keep bridge endpoints private or protected.
- Do not expose mounted OpenClaw auth profiles publicly.
- Prefer local/private networking between NEXUS and bridge services.
