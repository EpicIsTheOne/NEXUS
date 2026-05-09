# NEXUS Feature Guide

NEXUS is more than a simple chat page. This file tracks the major capability areas so the public repo has a clean product-facing overview.

## Character chat

- Login-gated chat app.
- Character library with filters, tabs, search, featured/new sections, and recent chats.
- Saved histories and resumable conversations.
- Character-specific settings.
- Message images and lightbox previews.
- Streaming and non-streaming chat routes.

## Characters

- Create/edit/delete characters.
- Import character cards from uploaded files or URLs.
- Export character data.
- Store avatars and local character assets.
- Chub/Character Hub acquisition pipeline with score filters, batch size controls, and import summaries.
- Metadata backfill scripts for imported characters.

## Personas

- Create and edit personas.
- Select persona per chat context.
- Admin/local profile support.

## Memory

- Conversation memory panel.
- Memory extraction/refresh endpoint.
- Memory seed endpoint for characters.
- Promote/dismiss/edit memory workflows.

## Providers and models

- OpenAI-compatible backend support through `BACKEND_BASE_URL`.
- Provider configuration for OpenAI, OpenRouter, Anthropic, Gemini, and xAI.
- Provider model listing.
- Admin connection test route.
- Fallback endpoint/provider configuration.

## Voice / TTS

- Fish Audio integration via `fish-audio`.
- Fish voice/model search.
- Per-character Fish reference ID settings.
- Tagged Fish text generation.
- Tagged audio endpoint that supports cached, full, and realtime streamed output.
- `X-TTS-Mode` header reports whether output came from cache/full/stream.
- TTS emotion/narration processing and optional asterisk narration behavior.
- Audio cache pruning by age, count, and byte size.

## Images

- Character image prompt generation.
- Image generation through configured providers.
- Replicate SDXL support.
- OpenAI/OpenRouter image options.
- Generated/public asset serving routes.

## Admin

- User/session auth.
- Admin user creation/editing.
- Role/password updates.
- UI config.
- Endpoint/provider config.
- Chub acquisition controls.

## Mobile and PWA

- Mobile-first cyberpunk UI.
- PWA manifest and service worker.
- Touch-friendly chat composer/library/recents.
- Install hint support.
- Mobile header controls for profile/settings/memory/voice/recents.

## OpenClaw bridge

- Optional bridge helper app.
- Shared-secret bridge auth.
- Can route configured chat work to OpenClaw when `OPENCLAW_BRIDGE_URL` and `OPENCLAW_BRIDGE_SECRET` are set.
