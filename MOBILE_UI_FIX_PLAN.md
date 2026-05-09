# AIChat Mobile UI Fix Plan

Scope: plan only. Do not implement in this pass.

App inspected:
- `public/index.html`
- `public/styles.css`
- `public/app.js`

## Diagnosis

The mobile UI problems are mostly layout/state issues, not backend problems.

Current structure:
- Desktop shell uses a 3-column grid: recents sidebar / main chat / character panel.
- Library is an absolute overlay inside `.main-panel`.
- Recents sidebar becomes a left drawer under `@media (max-width: 980px)`.
- Character details panel becomes a right drawer under `@media (max-width: 1280px)`.
- Composer becomes a one-column grid on mobile.
- Floating profile buttons stay fixed at top-right on all widths.

Likely symptoms on phones:
1. Main panel is assigned `grid-column: 2` globally, even when mobile shell has only one column.
2. App uses `height: 100vh`, which is unreliable on mobile browser chrome/keyboards.
3. Floating profile controls can overlap library/header/chat content.
4. Drawer handle stays mid-right and fights the right character drawer on small screens.
5. Composer stacks every control vertically, wasting space and making chat feel broken.
6. Library header/admin controls wrap messily because all actions are visible and equally important.
7. Hover-only preview behavior does nothing useful on touch screens.
8. Side drawers use `100vh`, not dynamic/safe-area height.
9. No scroll locking/body overflow policy when drawers/overlays are open.
10. Touch target spacing is inconsistent: cards are okay, but action clusters can become cramped.

## High-level target

Make mobile a proper app layout:

- One viewport-height shell.
- Chat as the primary screen.
- Library as a full-screen mobile route/overlay.
- Recents as a left drawer only.
- Character details as a right/bottom drawer with clear close behavior.
- Composer as a compact 2-row control, not a vertical stack.
- Profile/menu as a mobile-safe dropdown/sheet.

## Implementation order

### Phase 1 — Fix mobile shell geometry

File: `public/styles.css`

1. Replace rigid viewport sizing:
   - `.app-shell { height: 100vh; }` should become mobile-safe.
   - Use `height: 100dvh` with fallback `min-height: 100vh`.
   - Also set `overflow: hidden` on the shell so the internal panels scroll instead of the page.

2. In `@media (max-width: 980px)`, explicitly reset grid placement:
   - `.main-panel { grid-column: 1; }`
   - `.character-panel { grid-column: 1; }` if needed.

3. Add safe-area padding variables:
   - Use `env(safe-area-inset-top)`, `right`, `bottom`, `left` for fixed overlays and composer.

Acceptance:
- On 390x844 and 375x667, the main chat occupies the visible screen and does not render off-canvas.

### Phase 2 — Redesign mobile top controls

Files: `public/index.html`, `public/styles.css`, maybe `public/app.js`

Problem: `.floating-profile-wrap` stays fixed top-right and can overlap library/chat.

Plan:
1. On mobile, turn `.floating-profile-wrap` into a compact top bar:
   - Position: fixed top, left/right safe-area.
   - Layout: row, not column.
   - Show only: current title truncated, Recents button, Profile button.
   - Hide backend status or move it into profile menu.

2. Add top padding to `.chat-view` and `.library-hub` so content starts below this mobile top bar.

3. Clamp the title:
   - `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;`

Acceptance:
- Current character/profile controls no longer cover the library search/header or first chat message.

### Phase 3 — Make library full-screen on mobile

File: `public/styles.css`

Current library overlay is absolute inside the main panel. On mobile, make it feel intentional:

1. Under `@media (max-width: 980px)`, set `.library-hub` to:
   - `position: fixed; inset: 0;`
   - `height: 100dvh;`
   - high z-index below profile/menu if profile remains accessible, or above everything if library should own the screen.
   - `padding-top` large enough for safe area + mobile top bar.

2. Improve mobile library controls:
   - `.library-hub-header { display: grid; grid-template-columns: 1fr; }`
   - `.library-hub-header .section-actions { display: grid; grid-template-columns: 1fr 1fr; }`
   - Make `Add more characters` full width or admin-only visually de-emphasized.
   - Keep `Create` easy to tap.

3. Character list:
   - Keep single column for phones.
   - Consider compact card mode: avatar 48px, hide hover preview, limit tags to 2.

Acceptance:
- Library is scrollable, search/filter tabs remain reachable, and action buttons do not spill horizontally.

### Phase 4 — Fix recents drawer behavior

Files: `public/styles.css`, `public/app.js`

Current `openRecentsSidebar()` adds `.library-open`, which also activates `.library-backdrop`. Naming is confusing because `.library-open` actually means recents drawer open on mobile.

Plan:
1. Leave behavior if minimizing JS changes, but document it.
2. Better: rename/add clearer class in JS:
   - `recents-open` for the sidebar drawer.
   - Keep `library-collapsed` for library page visibility.
3. Under mobile CSS:
   - `.app-shell.recents-open .sidebar { transform: translateX(0); }`
   - `.app-shell.recents-open .library-backdrop { opacity: 1; pointer-events: auto; }`
4. Ensure backdrop click closes only recents/details overlays, not accidentally hides the library page unless intended.

Acceptance:
- Recents drawer opens/closes predictably from the Recents button and backdrop.

### Phase 5 — Make character details drawer phone-safe

File: `public/styles.css`

Current drawer:
- right fixed
- width `min(400px, 96vw)`
- height `100vh`
- drawer handle is a vertical pill at screen center

Plan:
1. On phone widths, choose one:
   - Recommended: keep right drawer but width `min(420px, 100vw)` and height `100dvh`.
   - Alternative: bottom sheet at `max-height: 88dvh`; more mobile-native but bigger change.

2. Replace/adjust drawer handle on mobile:
   - Move it to bottom-right above composer, or make it a normal button in the top mobile bar.
   - Avoid a mid-screen vertical handle that overlaps content and the right drawer.

3. Add backdrop for character panel when open on mobile:
   - Reuse `.library-backdrop` or create `.panel-backdrop`.
   - Backdrop click closes panel.

4. Add safe-area padding to panel content/header.

Acceptance:
- Details panel is reachable, closable, and does not leave hidden offscreen content.

### Phase 6 — Rebuild mobile composer

File: `public/styles.css`

Current mobile rule makes `.composer { grid-template-columns: 1fr; }`, which stacks New chat, Upload, textarea, Send vertically.

Plan:
1. Use a 2-row mobile grid:
   - Row 1: textarea full width.
   - Row 2: New Chat / Upload / Send in a 3-column button row.

2. CSS approach:
   - On mobile: `.composer { grid-template-columns: auto auto 1fr; grid-template-areas: "input input input" "new upload send"; }`
   - Assign areas to `#new-chat`, `.image-upload-button`, `textarea`, `#send-btn`.
   - `#send-btn` should be the strongest visual element.

3. Make composer sticky/fixed-safe:
   - Keep in grid bottom row if shell uses `100dvh` and `overflow:hidden`.
   - Add `padding-bottom: max(10px, env(safe-area-inset-bottom));`

4. Optional JS improvement:
   - Auto-grow textarea up to ~120px then scroll inside it.

Acceptance:
- Composer is usable with one thumb and does not eat half the phone screen.

### Phase 7 — Touch-specific card behavior

File: `public/styles.css`

1. Disable hover expansion on touch/mobile:
   - Under `@media (hover: none)`, set `.hover-preview { display: none; }`.
   - Disable hover transform/scale on cards to reduce weird touch flicker.

2. Make nested buttons easier to tap:
   - `.start-chat-btn`, `.favorite-toggle`, `.tag-chip` min-height 36–40px on mobile.

3. Consider moving Start/Favorite into a clearer card footer on mobile.

Acceptance:
- Tapping cards does not trigger weird hover-ish animation or cramped accidental actions.

### Phase 8 — Dialogs/settings mobile polish

File: `public/styles.css`

1. For dialogs on small screens:
   - `width: calc(100vw - 16px)`
   - `max-height: calc(100dvh - 16px)`
   - `overflow: auto`
   - less aggressive border radius, maybe 20px.

2. Settings header should be sticky inside dialog.

3. User management cards should stack controls vertically on mobile.

Acceptance:
- Create/settings/admin dialogs are usable without horizontal scrolling.

## Specific code hotspots

- `public/styles.css`
  - `.app-shell` around lines 204–209
  - `.main-panel` around lines 504–510
  - `.library-hub` around lines 378–397
  - `.horizontal-strip` / `#character-list` around lines 440–459
  - `.composer` around lines 637–647
  - `.floating-profile-wrap` around lines 743–760
  - `.drawer-handle` around lines 761–779
  - `@media (max-width: 980px)` around lines 905–944

- `public/app.js`
  - `openLibraryPage`, `openRecentsSidebar`, `closeLibraryPage` around lines 261–283
  - Event wiring for recents/backdrop/drawer around lines 1808–1825

## Recommended minimal implementation path

If the cheaper model needs the lowest-risk patch:

1. CSS-only first:
   - mobile `100dvh` shell
   - reset `.main-panel { grid-column: 1; }`
   - fixed full-screen `.library-hub`
   - mobile top bar styling for `.floating-profile-wrap`
   - composer grid areas
   - phone-safe character panel width/height
   - disable hover previews on touch

2. Then tiny JS cleanup only if needed:
   - close profile menu when opening recents/library/details
   - maybe use a clearer `recents-open` class instead of overloading `library-open`

Avoid rewriting render functions unless a CSS-only pass fails.

## Test plan

Manual mobile checks:

1. 390x844 iPhone-ish viewport:
   - Login page fits.
   - Library opens by default or via Library button.
   - Search, source filter, tag filter, tabs are usable.
   - Character cards stack cleanly.
   - Start a chat.
   - Composer is compact and send works.
   - Recents drawer opens/closes.
   - Character details panel opens/closes.
   - Profile menu does not overflow offscreen.

2. 375x667 small phone viewport:
   - Same checks, especially composer and dialogs.

3. 768x1024 tablet viewport:
   - Confirm tablet still feels okay with drawer behavior.

4. Desktop regression:
   - 1440x900 still has three-column/overlay behavior as before.

Suggested command after dependencies exist:
- `npm install`
- `PORT=3300 node server.mjs`
- Open `http://localhost:3300/aichat/` or whatever `BASE_PATH` is configured for.

Note: In this workspace, `node_modules` for `aichat-mvp` was missing, so I could not run the server locally without installing dependencies.

## Definition of done

- No horizontal scrolling on common phone widths.
- No important controls hidden under fixed overlays.
- Chat input/send usable without excessive vertical stacking.
- Library and recents behavior is obvious.
- Character details panel is reachable and closable.
- Desktop/tablet layouts are not broken.
