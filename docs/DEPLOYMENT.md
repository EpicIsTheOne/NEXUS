# Deployment Notes

NEXUS is designed to run as a Node.js app, usually behind HTTPS and login protection.

## Production checklist

Before exposing a deployment:

- Set a strong first admin password with `DEFAULT_ADMIN_PASSWORD` or create users manually after first boot.
- Use HTTPS.
- Keep `.env` private.
- Mount `APP_DATA_DIR` to persistent storage.
- Do not publish `data/`, session cookies, password hashes, generated private media, or provider keys.
- Review Traefik/nginx routes if changing `BASE_PATH`.
- Confirm provider keys only exist in env/config, not in committed files.

## Docker compose

```bash
cp .env.example .env
# edit .env
docker compose up -d --build
```

The committed compose file mirrors the live-style deployment. It includes:

- `BASE_PATH=/nexus`
- a writable `/app/data` mount
- optional OpenClaw auth profile mount
- Traefik labels for `your-domain.example/nexus`
- an external `proxy` network

Adjust those for other hosts.

## Reverse proxy

If you deploy behind a reverse proxy, preserve the base path:

```env
BASE_PATH=/nexus
PUBLIC_APP_ORIGIN=https://your-domain.example
```

Then route requests matching `/nexus` to the Node container/port.

## Data backups

Back up `APP_DATA_DIR`, not the repo checkout. Runtime data may contain private user/session/chat records.

## Updating

```bash
git pull
npm install
docker compose up -d --build
```

or, for local Node:

```bash
git pull
npm install
npm start
```
