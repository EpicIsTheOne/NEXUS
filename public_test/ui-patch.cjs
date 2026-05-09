// Read content
const fs = require('fs');
let html = fs.readFileSync('/root/.openclaw/workspaces/orchestrator/deployments/aichat-mvp/public/index.html', 'utf8');

// Replace floating controls block
const floatingBlockRegex = /<div class="floating-profile-wrap profile-menu-wrap">[\s\S]*?<div id="profile-menu" class="profile-menu hidden">/;

const newDesktopHeader = `<div class="desktop-top-bar" id="desktop-top-bar">
      <div class="top-bar-left">
        <button id="open-library" class="profile-button secondary">Recents</button>
      </div>
      <div class="top-bar-center">
        <div id="current-character" class="floating-title">Choose a character</div>
        <div id="backend-status" class="subtitle floating-status">Checking backend…</div>
      </div>
      <div class="top-bar-right">
        <button id="memory-header-toggle" class="profile-button memory-header-toggle" title="Memory">🧠</button>
        <button id="tts-status-button" class="profile-button tts-status-button tts-unavailable" type="button" aria-label="Autoplay voice off" title="Autoplay voice off">TTS</button>
        <button id="profile-button" class="profile-button">Profile ▾</button>
      </div>
    </div>
    
    <div class="floating-profile-wrap profile-menu-wrap">
      <!-- Mobile header structure (mostly controlled by CSS grid) -->
      <button id="mobile-open-library" class="profile-button floating-profile-button secondary">Recents</button>
      <div id="mobile-current-character" class="floating-title">Choose a character</div>
      <button id="mobile-memory-toggle" class="profile-button floating-profile-button memory-header-toggle" title="Memory">🧠</button>
      <button id="mobile-tts-status-button" class="profile-button floating-profile-button tts-status-button tts-unavailable" type="button">TTS</button>
      <button id="mobile-profile-button" class="profile-button floating-profile-button">Profile ▾</button>

      <div id="profile-menu" class="profile-menu hidden">`;

// Instead of rewriting index.html completely and breaking JS bindings, let's keep the existing IDs
// and just restructure the HTML slightly, then use CSS to style it.

const improvedReplacement = `<div class="floating-profile-wrap profile-menu-wrap">
      <button id="open-library" class="profile-button floating-profile-button secondary">Recents</button>
      <div class="header-center-info">
        <div id="current-character" class="floating-title">Choose a character</div>
        <div id="backend-status" class="subtitle floating-status">Checking backend…</div>
      </div>
      <div class="header-right-controls">
        <button id="memory-header-toggle" class="profile-button floating-profile-button memory-header-toggle" title="Memory">🧠</button>
        <button id="tts-status-button" class="profile-button floating-profile-button tts-status-button tts-unavailable" type="button" aria-label="Autoplay voice off" title="Autoplay voice off">TTS</button>
        <button id="profile-button" class="profile-button floating-profile-button">Profile ▾</button>
      </div>
      <div id="profile-menu" class="profile-menu hidden">`;

html = html.replace(floatingBlockRegex, improvedReplacement);
fs.writeFileSync('/root/.openclaw/workspaces/orchestrator/deployments/aichat-mvp/public/index.html', html);
console.log('HTML patched');
