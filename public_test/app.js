const state = {
  authUser: null,
  bootstrap: null,
  selectedCharacterId: null,
  selectedPersonaId: null,
  selectedModel: null,
  selectedConversationId: null,
  selectedCharacterSettings: null,
  models: [],
  backendReachable: false,
  ui: { backgroundFavorites: [] },
  pendingImages: [],
  characterDialogMode: 'create',
  editingCharacterId: null,
  appConfig: { endpoints: null, providers: null },
  appUi: null,
  providerConfig: null,
  providerModelCache: {},
  favorites: [],
  sessionPrefs: {},
  currentConversationList: [],
  users: [],
  activeLibraryTab: 'all',
  renderedChatSignatures: [],
  renderedConversationId: null,
  isStreaming: false,
  memoryBundle: null,
  deferredInstallPrompt: null,
  headerSignature: '',
  headerAnimationTimer: null,
  messageActions: {
    activeKey: null,
    editingKey: null,
    draft: '',
    touchTimer: null,
    touchKey: null,
    busyKey: null,
    rewindPendingKey: null,
  },
  tts: {
    loadingKeys: {},
    objectUrls: {},
    currentKey: null,
    currentAudio: null,
    currentPaused: false,
    lastErrorKey: null,
    playbackToken: 0,
    chunkedSessions: {},
    fullAudioPromises: {},
    mediaSourceSessions: {},
    liveAutoplaySessions: {},
    debugTags: {},
  },
  voiceSearch: null,
  voicePreview: {
    url: '',
    audio: null,
    loadingUrl: '',
  },
};

const el = {
  authScreen: document.getElementById('auth-screen'),
  appShell: document.getElementById('app-shell'),
  loginForm: document.getElementById('login-form'),
  loginUsername: document.getElementById('login-username'),
  loginPassword: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  loginSubmit: document.getElementById('login-submit'),
  authUserChip: document.getElementById('auth-user-chip'),
  logoutBtn: document.getElementById('logout-btn'),
  list: document.getElementById('character-list'),
  featuredList: document.getElementById('featured-list'),
  recentList: document.getElementById('recent-list'),
  search: document.getElementById('character-search'),
  sourceFilter: document.getElementById('source-filter'),
  tagFilter: document.getElementById('tag-filter'),
  libraryTabs: document.getElementById('library-tabs'),
  currentCharacter: document.getElementById('current-character'),
  characterPanelTitle: document.getElementById('character-panel-title'),
  backendStatus: document.getElementById('backend-status'),
  characterCount: document.getElementById('character-count'),
  localProfileSelect: document.getElementById('local-profile-select'),
  modelSelect: document.getElementById('model-select'),
  refreshModels: document.getElementById('refresh-models'),
  personaSelect: document.getElementById('persona-select'),
  conversationSelect: document.getElementById('conversation-select'),
  chatView: document.getElementById('chat-view'),
  composer: document.querySelector('.composer'),
  input: document.getElementById('chat-input'),
  imageBtn: document.getElementById('image-btn'),
  imageBtnLabel: document.getElementById('image-btn-label'),
  imageInput: document.getElementById('image-input'),
  send: document.getElementById('send-btn'),
  newChat: document.getElementById('new-chat'),
  openLibrary: document.getElementById('open-library'),
  profileButton: document.getElementById('profile-button'),
  ttsStatusButton: document.getElementById('tts-status-button'),
  profileMenu: document.getElementById('profile-menu'),
  closeProfilePage: document.getElementById('close-profile-page'),
  libraryBackdrop: document.getElementById('library-backdrop'),
  libraryClose: document.getElementById('library-close'),
  sidebarRecentsBtn: document.getElementById('sidebar-recents-btn'),
  sidebarLibraryBtn: document.getElementById('sidebar-library-btn'),
  libraryBackToRecents: document.getElementById('library-back-to-recents'),
  libraryCurrentViewBtn: document.getElementById('library-current-view-btn'),
  drawerHandle: document.getElementById('drawer-handle'),
  closeCharacterPanel: document.getElementById('close-character-panel'),
  characterPanelContent: document.getElementById('character-panel-content'),
  uiSettingsBtn: document.getElementById('ui-settings-btn'),
  installAppBtn: document.getElementById('install-app-btn'),
  installAppHint: document.getElementById('install-app-hint'),
  endpointSettingsBtn: document.getElementById('endpoint-settings-btn'),
  providerSettingsBtn: document.getElementById('provider-settings-btn'),
  userManagementBtn: document.getElementById('user-management-btn'),
  settingsDialog: document.getElementById('settings-dialog'),
  settingsTitle: document.getElementById('settings-title'),
  closeSettings: document.getElementById('close-settings'),
  settingDisplayName: document.getElementById('setting-display-name'),
  settingAccent: document.getElementById('setting-accent'),
  settingPoll: document.getElementById('setting-poll'),
  settingAnimation: document.getElementById('setting-animation'),
  settingReduceMotion: document.getElementById('setting-reduce-motion'),
  settingBlurStrength: document.getElementById('setting-blur-strength'),
  settingTransparencyStrength: document.getElementById('setting-transparency-strength'),
  settingBackgroundIntensity: document.getElementById('setting-background-intensity'),
  settingDensity: document.getElementById('setting-density'),
  endpointSettingsDialog: document.getElementById('endpoint-settings-dialog'),
  closeEndpointSettings: document.getElementById('close-endpoint-settings'),
  endpointLocalProfiles: document.getElementById('endpoint-local-profiles'),
  endpointActiveLocalProfile: document.getElementById('endpoint-active-local-profile'),
  endpointLocalBaseUrl: document.getElementById('endpoint-local-base-url'),
  endpointProviderLabel: document.getElementById('endpoint-provider-label'),
  endpointDefaultModel: document.getElementById('endpoint-default-model'),
  endpointMainModel: document.getElementById('endpoint-main-model'),
  endpointFallbackProvider1: document.getElementById('endpoint-fallback-provider-1'),
  endpointFallbackModel1: document.getElementById('endpoint-fallback-model-1'),
  endpointFallbackKeyRow1: document.getElementById('endpoint-fallback-key-row-1'),
  endpointFallbackKey1: document.getElementById('endpoint-fallback-key-1'),
  endpointFallbackOverrideProvider1: document.getElementById('endpoint-fallback-override-provider-1'),
  endpointFallbackOverrideBase1: document.getElementById('endpoint-fallback-override-base-1'),
  endpointFallbackOverrideModel1: document.getElementById('endpoint-fallback-override-model-1'),
  endpointFallbackOverrideKey1: document.getElementById('endpoint-fallback-override-key-1'),
  endpointFallbackProvider2: document.getElementById('endpoint-fallback-provider-2'),
  endpointFallbackModel2: document.getElementById('endpoint-fallback-model-2'),
  endpointFallbackKeyRow2: document.getElementById('endpoint-fallback-key-row-2'),
  endpointFallbackKey2: document.getElementById('endpoint-fallback-key-2'),
  endpointFallbackOverrideProvider2: document.getElementById('endpoint-fallback-override-provider-2'),
  endpointFallbackOverrideBase2: document.getElementById('endpoint-fallback-override-base-2'),
  endpointFallbackOverrideModel2: document.getElementById('endpoint-fallback-override-model-2'),
  endpointFallbackOverrideKey2: document.getElementById('endpoint-fallback-override-key-2'),
  endpointRequestTimeout: document.getElementById('endpoint-request-timeout'),
  testEndpointBtn: document.getElementById('test-endpoint-btn'),
  saveEndpointSettings: document.getElementById('save-endpoint-settings'),
  endpointTestResult: document.getElementById('endpoint-test-result'),
  providerSettingsDialog: document.getElementById('provider-settings-dialog'),
  closeProviderSettings: document.getElementById('close-provider-settings'),
  providerOpenaiKey: document.getElementById('provider-openai-key'),
  providerOpenrouterKey: document.getElementById('provider-openrouter-key'),
  providerAnthropicKey: document.getElementById('provider-anthropic-key'),
  providerGeminiKey: document.getElementById('provider-gemini-key'),
  providerXaiKey: document.getElementById('provider-xai-key'),
  saveProviderSettings: document.getElementById('save-provider-settings'),
  acquireCount: document.getElementById('acquire-count'),
  acquireStrictness: document.getElementById('acquire-strictness'),
  acquireChubBtn: document.getElementById('acquire-chub-btn'),
  acquireChubStatus: document.getElementById('acquire-chub-status'),
  acquireRejectionSummary: document.getElementById('acquire-rejection-summary'),
  acquireRejectionSummaryList: document.getElementById('acquire-rejection-summary-list'),
  createCharacterBtn: document.getElementById('create-character-btn'),
  characterCreateDialog: document.getElementById('character-create-dialog'),
  closeCharacterCreate: document.getElementById('close-character-create'),
  characterCreateForm: document.getElementById('character-create-form'),
  characterCreateTitle: document.getElementById('character-create-title'),
  createCharacterName: document.getElementById('create-character-name'),
  createCharacterDescription: document.getElementById('create-character-description'),
  createCharacterPersonality: document.getElementById('create-character-personality'),
  createCharacterScenario: document.getElementById('create-character-scenario'),
  createCharacterGreeting: document.getElementById('create-character-greeting'),
  createCharacterTags: document.getElementById('create-character-tags'),
  createCharacterAvatar: document.getElementById('create-character-avatar'),
  createCharacterAvatarPreview: document.getElementById('create-character-avatar-preview'),
  importCharacterFile: document.getElementById('import-character-file'),
  duplicateCharacterBtn: document.getElementById('duplicate-character-btn'),
  createCharacterSubmit: document.getElementById('create-character-submit'),
  userManagementDialog: document.getElementById('user-management-dialog'),
  closeUserManagement: document.getElementById('close-user-management'),
  userList: document.getElementById('user-list'),
  rewindConfirmDialog: document.getElementById('rewind-confirm-dialog'),
  closeRewindConfirm: document.getElementById('close-rewind-confirm'),
  cancelRewindConfirm: document.getElementById('cancel-rewind-confirm'),
  confirmRewindConfirm: document.getElementById('confirm-rewind-confirm'),
  rewindConfirmTarget: document.getElementById('rewind-confirm-target'),
  userCreateForm: document.getElementById('user-create-form'),
  newUserUsername: document.getElementById('new-user-username'),
  newUserDisplayName: document.getElementById('new-user-display-name'),
  newUserPassword: document.getElementById('new-user-password'),
  newUserRole: document.getElementById('new-user-role'),
  createUserSubmit: document.getElementById('create-user-submit'),
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  let json = null;
  try { json = await response.json(); } catch { json = null; }
  if (!response.ok) {
    const error = new Error(json?.error || json?.detail || `Request failed (${response.status})`);
    error.response = response;
    error.payload = json;
    throw error;
  }
  return json;
}

function getVoiceSearchState() {
  if (!state.voiceSearch || state.voiceSearch.characterId !== state.selectedCharacterId) {
    state.voiceSearch = {
      characterId: state.selectedCharacterId,
      query: '',
      loading: false,
      items: [],
      bestMatch: null,
      error: '',
      searched: false,
      hints: null,
    };
  }
  return state.voiceSearch;
}

function stopVoicePreview(resetRender = true) {
  if (state.voicePreview.audio) {
    state.voicePreview.audio.pause();
    state.voicePreview.audio = null;
  }
  state.voicePreview.url = '';
  state.voicePreview.loadingUrl = '';
  if (resetRender) renderVoiceSearchResults();
}

async function toggleVoicePreview(url) {
  if (!url) return;
  if (state.voicePreview.url === url && state.voicePreview.audio) {
    stopVoicePreview();
    return;
  }

  stopVoicePreview(false);
  state.voicePreview.loadingUrl = url;
  renderVoiceSearchResults();

  try {
    const audio = new Audio(url);
    state.voicePreview.audio = audio;
    state.voicePreview.url = url;
    state.voicePreview.loadingUrl = '';
    audio.addEventListener('ended', () => stopVoicePreview());
    audio.addEventListener('error', () => stopVoicePreview());
    renderVoiceSearchResults();
    await audio.play();
  } catch {
    stopVoicePreview();
  }
}

function renderVoiceSearchResults() {
  const panel = el.characterPanelContent;
  if (!panel) return;
  const resultsEl = panel.querySelector('#character-voice-results');
  const statusEl = panel.querySelector('#character-voice-search-status');
  if (!resultsEl || !statusEl) return;

  const voiceState = getVoiceSearchState();
  if (voiceState.loading) {
    statusEl.textContent = 'Searching Fish voices…';
    statusEl.classList.remove('hidden');
  } else if (voiceState.error) {
    statusEl.textContent = voiceState.error;
    statusEl.classList.remove('hidden');
  } else if (voiceState.searched) {
    const top = voiceState.bestMatch?.title ? `Best match: ${voiceState.bestMatch.title}` : 'No close matches found.';
    const hintBits = [];
    if (voiceState.hints?.genders?.length) hintBits.push(voiceState.hints.genders.join('/'));
    if (voiceState.hints?.languages?.length) hintBits.push(voiceState.hints.languages.join('/'));
    statusEl.textContent = `${top}${voiceState.items.length ? ` · ${voiceState.items.length} result${voiceState.items.length === 1 ? '' : 's'}` : ''}${hintBits.length ? ` · tuned for ${hintBits.join(' + ')}` : ''}`;
    statusEl.classList.remove('hidden');
  } else {
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
  }

  if (!voiceState.items.length) {
    resultsEl.innerHTML = voiceState.searched && !voiceState.loading && !voiceState.error
      ? '<div class="meta-line">No voice matches yet. Try another name.</div>'
      : '';
    return;
  }

  resultsEl.innerHTML = voiceState.items.map((item, index) => {
    const active = String(state.selectedCharacterSettings?.fishReferenceId || '') === String(item._id || '');
    const tags = [
      ...(Array.isArray(item.languages) ? item.languages : []),
      ...(Array.isArray(item.tags) ? item.tags.slice(0, 3) : []),
    ].filter(Boolean);
    const previewUrl = item.samples?.[0]?.audio || '';
    const previewing = state.voicePreview.url === previewUrl && !!previewUrl;
    const previewLoading = state.voicePreview.loadingUrl === previewUrl && !!previewUrl;
    return `
      <div class="voice-search-result ${active ? 'active' : ''}">
        <div class="voice-search-main">
          <strong>${escapeHtml(item.title || 'Untitled voice')}</strong>
          <span>${index === 0 && voiceState.bestMatch?._id === item._id ? 'Best match' : 'Use voice'}</span>
        </div>
        <div class="meta-line">${escapeHtml(item.author?.nickname || 'Fish Audio')}${tags.length ? ` · ${escapeHtml(tags.join(' · '))}` : ''}</div>
        ${Array.isArray(item.matchReasons) && item.matchReasons.length ? `<div class="meta-line voice-match-reasons">${escapeHtml(item.matchReasons.slice(0, 2).join(' · '))}</div>` : ''}
        <div class="voice-search-actions">
          <button class="secondary mini-btn" type="button" data-voice-pick="${escapeHtml(String(item._id || ''))}" data-voice-label="${escapeHtml(String(item.title || ''))}">${active ? 'Applied' : 'Use voice'}</button>
          ${previewUrl ? `<button class="secondary mini-btn" type="button" data-voice-preview="${escapeHtml(previewUrl)}">${previewLoading ? 'Loading…' : previewing ? 'Stop preview' : 'Preview sample'}</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function searchFishVoices(query, options = {}) {
  const voiceState = getVoiceSearchState();
  voiceState.query = query;
  voiceState.loading = true;
  voiceState.error = '';
  voiceState.searched = true;
  renderVoiceSearchResults();

  try {
    const params = new URLSearchParams({ q: query.trim() || getSelectedCharacter()?.name || '', limit: String(options.limit || 8) });
    if (state.selectedCharacterId) params.set('characterId', state.selectedCharacterId);
    const result = await api(`./api/fish/models?${params.toString()}`);
    voiceState.items = Array.isArray(result.items) ? result.items : [];
    voiceState.bestMatch = result.bestMatch || voiceState.items[0] || null;
    voiceState.hints = result.hints || null;
  } catch (error) {
    voiceState.items = [];
    voiceState.bestMatch = null;
    voiceState.error = error.message || 'Voice search failed.';
    voiceState.hints = null;
  } finally {
    voiceState.loading = false;
    renderVoiceSearchResults();
  }
}

async function applyFishVoiceSelection(referenceId, voiceLabel) {
  if (!state.selectedCharacterId) return;
  const picked = getVoiceSearchState().items.find((item) => String(item._id || '') === String(referenceId || '')) || null;
  state.selectedCharacterSettings = await api(`./api/character/${encodeURIComponent(state.selectedCharacterId)}/settings`, {
    method: 'PUT',
    body: JSON.stringify({
      fishReferenceId: referenceId,
      voiceLabel,
      ttsProvider: 'fish',
      voiceMatchSource: 'manual-search',
      voiceMatchQuery: getVoiceSearchState().query || getSelectedCharacter()?.name || '',
      voiceMatchReason: picked?.matchReasons?.[0] || 'manual voice selection',
    }),
  });
  const panel = el.characterPanelContent;
  panel?.querySelector('#character-voice-label')?.setAttribute('value', state.selectedCharacterSettings.voiceLabel || '');
  if (panel?.querySelector('#character-voice-label')) panel.querySelector('#character-voice-label').value = state.selectedCharacterSettings.voiceLabel || '';
  if (panel?.querySelector('#character-fish-reference-id')) panel.querySelector('#character-fish-reference-id').value = state.selectedCharacterSettings.fishReferenceId || '';
  updateTtsStatusButton();
  rerenderChatIfMounted();
  renderVoiceSearchResults();
}

async function rematchAllLegacyVoices() {
  const status = el.characterPanelContent?.querySelector('#character-voice-search-status');
  if (status) {
    status.textContent = 'Refreshing legacy defaults…';
    status.classList.remove('hidden');
  }
  const result = await api('./api/fish/rematch-default-voices', { method: 'POST', body: JSON.stringify({}) });
  await loadCharacterSettings();
  renderCharacterPanel();
  if (status) status.textContent = `Updated ${result.updated || 0} character voice default${(result.updated || 0) === 1 ? '' : 's'}.`;
}

function debounce(fn, wait = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function hexToRgba(hex, alpha) {
  const value = String(hex || '#8b5cf6').replace('#', '');
  const bigint = parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getUiSettings() {
  return {
    displayName: 'Jen',
    accent: '#8b5cf6',
    animationLevel: 'medium',
    reduceMotion: false,
    blurStrength: 18,
    transparencyStrength: 0.72,
    backgroundIntensity: 0.16,
    density: 'cozy',
    fontScale: 1,
    autoPollModels: true,
    ...(state.appUi || {}),
  };
}

function getSelectedCharacter() { return state.bootstrap?.characters?.find((c) => c.id === state.selectedCharacterId); }
function getSelectedPersona() { return state.bootstrap?.personas?.find((p) => p.id === state.selectedPersonaId); }
function getCharacterModel() { return state.selectedCharacterSettings?.modelOverride || state.selectedModel || state.bootstrap?.defaultModel; }
function getCharacterTemperature() { return typeof state.selectedCharacterSettings?.temperature === 'number' ? state.selectedCharacterSettings.temperature : 0.85; }
function getCharacterAutoplayVoiceEnabled() { return !!state.selectedCharacterSettings?.autoplayVoice; }
function getCharacterFishReferenceId() { return String(state.selectedCharacterSettings?.fishReferenceId || '').trim(); }
function getCharacterTtsFormat() { return state.selectedCharacterSettings?.ttsFormat || 'mp3'; }
function getCharacterTtsLatency() { return state.selectedCharacterSettings?.ttsLatency || 'low'; }
function getCharacterTtsPlaybackMode() { return state.selectedCharacterSettings?.ttsPlaybackMode || 'stream'; }
function characterHasVoice() { return !!getCharacterFishReferenceId(); }
function characterCanSpeak() { return characterHasVoice(); }
function getCurrentConversationList() { return state.currentConversationList || []; }
function getSelectedConversation() { return getCurrentConversationList().find((item) => item.id === state.selectedConversationId) || null; }
function getCurrentSelectionBucket() {
  return {
    characterId: state.selectedCharacterId || '',
    personaId: state.selectedPersonaId || '',
  };
}
function isSameSelectionBucket(selection = {}) {
  return (selection.characterId || '') === (state.selectedCharacterId || '')
    && (selection.personaId || '') === (state.selectedPersonaId || '');
}
function modelSupportsImages(modelId = '') { return /(vision|vl|gpt-4o|gpt-4\.1|gemini|claude-3|claude-sonnet|llava|qwen.*vl|minicpm|pixtral|molmo)/i.test(String(modelId || '')); }
function favoriteIds() { return new Set(state.favorites || []); }
function isAdmin() { return !!state.authUser?.isAdmin; }
function getEffectiveUserName() {
  return String(getSelectedPersona()?.name || state.authUser?.displayName || state.authUser?.username || 'User').trim();
}
function replaceCharacterPlaceholdersClient(value = '', character = getSelectedCharacter()) {
  const userName = getEffectiveUserName();
  const charName = String(character?.name || 'Character').trim();
  return String(value || '')
    .replace(/\{\{\s*user\s*\}\}/gi, userName)
    .replace(/\{\{\s*char\s*\}\}/gi, charName)
    .replace(/<\s*user\s*>/gi, userName)
    .replace(/<\s*char\s*>/gi, charName);
}
function characterSourceLabel(character) { return character.importSource || character.source || 'unknown'; }
function getCharacterTier(character) {
  const score = Number(character?.score || 0);
  if (score >= 75) return 'elite';
  if (score >= 60) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

function getMessageText(message) {
  if (typeof message?.content === 'string') return message.content;
  if (Array.isArray(message?.content)) return message.content.filter((part) => part?.type === 'text').map((part) => part.text || '').join('\n').trim();
  return '';
}

function getMessageImages(message) {
  if (Array.isArray(message?.images)) return message.images.map((item) => typeof item === 'string' ? item : item.url).filter(Boolean);
  if (Array.isArray(message?.content)) return message.content.filter((part) => part?.type === 'image_url').map((part) => part.image_url?.url).filter(Boolean);
  return [];
}

function getMemoryEls() {
  return {
    panel: document.getElementById('memory-panel'),
    close: document.getElementById('close-memory-panel'),
    handle: document.getElementById('memory-drawer-handle'),
    charName: document.getElementById('memory-char-name'),
    charAvatar: document.getElementById('memory-char-avatar'),
    charHealth: document.getElementById('memory-char-health'),
    relationship: document.getElementById('mem-relationship'),
    emotions: document.getElementById('mem-emotions'),
    scenario: document.getElementById('mem-scenario'),
    pinned: document.getElementById('mem-pinned'),
    auto: document.getElementById('mem-auto'),
    canon: document.getElementById('mem-canon'),
    conflicts: document.getElementById('mem-conflicts'),
  };
}

function toggleMemoryPanel(force) {
  const open = typeof force === 'boolean' ? force : !el.appShell.classList.contains('memory-panel-open');
  el.appShell.classList.toggle('memory-panel-open', open);
  const memoryEls = getMemoryEls();
  memoryEls.handle?.classList.toggle('open', open);
}

function renderMemoryList(items = [], options = {}) {
  if (!items.length) return `<div class="memory-empty">${options.empty || 'Nothing useful yet.'}</div>`;
  return items.map((item) => {
    const actions = [];
    if (options.allowPromote) actions.push(`<button class="mini-btn" data-memory-promote="${item.id}">Pin</button>`);
    if (options.allowDismiss) actions.push(`<button class="mini-btn danger" data-memory-dismiss="${item.id}">Dismiss</button>`);
    const meta = [item.priority, item.confidence != null ? `${Math.round(item.confidence * 100)}%` : '', item.locked ? 'locked' : ''].filter(Boolean).join(' · ');
    return `
      <div class="memory-item ${item.type === 'conflict' ? 'memory-item-conflict' : ''}">
        <div class="memory-item-text">${escapeHtml(item.text)}</div>
        ${meta ? `<div class="memory-item-meta">${escapeHtml(meta)}</div>` : ''}
        ${actions.length ? `<div class="memory-item-actions">${actions.join('')}</div>` : ''}
      </div>`;
  }).join('');
}

async function loadMemoryBundle() {
  if (!state.selectedCharacterId || !state.selectedConversationId) {
    state.memoryBundle = null;
    renderMemoryPanel();
    return null;
  }
  const params = new URLSearchParams({ characterId: state.selectedCharacterId, personaId: state.selectedPersonaId || '' });
  state.memoryBundle = await api(`./api/conversations/${encodeURIComponent(state.selectedConversationId)}/memory?${params.toString()}`);
  renderMemoryPanel();
  return state.memoryBundle;
}

function renderMemoryPanel() {
  const memoryEls = getMemoryEls();
  const character = getSelectedCharacter();
  const bundle = state.memoryBundle;
  if (memoryEls.charName) memoryEls.charName.textContent = character?.name || 'No Character Context';
  if (memoryEls.charAvatar) {
    memoryEls.charAvatar.src = character?.imageUrl || fallbackAvatarDataUrl(character?.name || '?');
    memoryEls.charAvatar.style.display = character ? 'block' : 'none';
  }
  if (memoryEls.charHealth) {
    memoryEls.charHealth.style.display = character ? 'block' : 'none';
    memoryEls.charHealth.style.background = bundle?.health === 'conflicted' ? 'var(--bad)' : bundle?.health === 'evolving' ? '#f59e0b' : 'var(--good)';
  }
  if (!bundle) {
    if (memoryEls.relationship) memoryEls.relationship.textContent = 'Pick a character and conversation to build memory.';
    if (memoryEls.emotions) memoryEls.emotions.textContent = '—';
    if (memoryEls.scenario) memoryEls.scenario.textContent = '—';
    if (memoryEls.pinned) memoryEls.pinned.innerHTML = '<div class="memory-empty">No pinned memory yet.</div>';
    if (memoryEls.auto) memoryEls.auto.innerHTML = '<div class="memory-empty">No auto memory yet.</div>';
    if (memoryEls.canon) memoryEls.canon.innerHTML = '<div class="memory-empty">No canon memory yet.</div>';
    if (memoryEls.conflicts) memoryEls.conflicts.innerHTML = '<div class="memory-empty">No conflicts detected.</div>';
    return;
  }
  const relationship = bundle.relationship || {};
  if (memoryEls.relationship) memoryEls.relationship.innerHTML = `Trust <strong>${relationship.trust ?? '—'}%</strong><br/>Closeness: ${escapeHtml(relationship.closeness || 'unknown')}<br/>${escapeHtml(relationship.attitude || 'No relationship summary yet.')}<br/><span class="memory-subtle">${escapeHtml(relationship.lastShift || '')}</span>`;
  if (memoryEls.emotions) memoryEls.emotions.innerHTML = (bundle.emotions || []).map((emotion) => `<span class="tag-pill">${escapeHtml(emotion)}</span>`).join('') || '<span class="memory-empty">No active tone yet.</span>';
  if (memoryEls.scenario) {
    const scenario = bundle.scenario || {};
    memoryEls.scenario.innerHTML = [scenario.location, scenario.situation, scenario.objective, scenario.risk ? `Risk: ${scenario.risk}` : ''].filter(Boolean).map((line) => `<div>${escapeHtml(line)}</div>`).join('');
  }
  if (memoryEls.pinned) memoryEls.pinned.innerHTML = renderMemoryList(bundle.pinned || [], { empty: 'No pinned memory yet.' });
  if (memoryEls.auto) memoryEls.auto.innerHTML = renderMemoryList(bundle.auto || [], { allowPromote: true, allowDismiss: true, empty: 'No auto memory suggestions yet.' });
  if (memoryEls.canon) memoryEls.canon.innerHTML = renderMemoryList(bundle.canon || [], { empty: 'No canon rules available.' });
  if (memoryEls.conflicts) memoryEls.conflicts.innerHTML = renderMemoryList(bundle.conflicts || [], { empty: 'No contradictions detected.' });

  memoryEls.auto?.querySelectorAll('[data-memory-promote]').forEach((node) => node.addEventListener('click', async () => {
    await api(`./api/memory/${encodeURIComponent(node.dataset.memoryPromote)}/promote`, {
      method: 'POST',
      body: JSON.stringify({ conversationId: state.selectedConversationId, characterId: state.selectedCharacterId, personaId: state.selectedPersonaId || '' }),
    });
    await loadMemoryBundle();
  }));
  memoryEls.auto?.querySelectorAll('[data-memory-dismiss]').forEach((node) => node.addEventListener('click', async () => {
    await api(`./api/memory/${encodeURIComponent(node.dataset.memoryDismiss)}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ conversationId: state.selectedConversationId, characterId: state.selectedCharacterId, personaId: state.selectedPersonaId || '' }),
    }).catch(() => null);
    await loadMemoryBundle();
  }));
}

function fallbackAvatarDataUrl(name = '?') {
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#24193d"/><circle cx="256" cy="196" r="94" fill="#8b5cf6"/><rect x="106" y="322" width="300" height="118" rx="58" fill="#6d28d9"/><text x="256" y="226" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="120" font-weight="700" fill="#ffffff">${initial.replace(/[<>&]/g, '')}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function wireImageFallbacks(root = document) {
  root.querySelectorAll('img').forEach((img) => {
    if (img.dataset.fallbackReady) return;
    img.dataset.fallbackReady = '1';
    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = '1';
      img.src = img.dataset.fallback || fallbackAvatarDataUrl(img.alt || '?');
    });
  });
}

function setAuthMode(authenticated) {
  el.authScreen.classList.toggle('hidden', authenticated);
  el.appShell.classList.toggle('hidden', !authenticated);
  if (el.loginForm) {
    el.loginForm.setAttribute('autocomplete', 'off');
    if (authenticated) {
      el.loginForm.setAttribute('inert', '');
      el.loginForm.setAttribute('aria-hidden', 'true');
    } else {
      el.loginForm.removeAttribute('inert');
      el.loginForm.removeAttribute('aria-hidden');
    }
  }
  if (el.authScreen) {
    if (authenticated) {
      el.authScreen.setAttribute('inert', '');
      el.authScreen.setAttribute('aria-hidden', 'true');
    } else {
      el.authScreen.removeAttribute('inert');
      el.authScreen.removeAttribute('aria-hidden');
    }
  }
  if (el.loginUsername) {
    el.loginUsername.disabled = authenticated;
    el.loginUsername.readOnly = authenticated;
  }
  if (el.loginPassword) {
    el.loginPassword.disabled = authenticated;
    el.loginPassword.readOnly = authenticated;
  }
  if (el.input) {
    el.input.setAttribute('name', 'nexus-message');
    el.input.setAttribute('autocomplete', 'off');
    el.input.setAttribute('autocorrect', 'off');
    el.input.setAttribute('autocapitalize', 'sentences');
    el.input.setAttribute('spellcheck', 'true');
    el.input.setAttribute('data-lpignore', 'true');
    el.input.setAttribute('data-1p-ignore', 'true');
  }
}

function isStandaloneDisplay() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosBrowser() {
  const ua = window.navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua);
}

function shouldUseStreamingChat() {
  return true;
}

function updateInstallUi() {
  const standalone = isStandaloneDisplay();
  el.installAppBtn?.classList.toggle('hidden', !state.deferredInstallPrompt || standalone);
  el.installAppHint?.classList.toggle('hidden', !(isIosBrowser() && !standalone));
}

async function clearLegacyAppCaches() {
  if (!('caches' in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => /^nexus-/.test(name)).map((name) => caches.delete(name)));
  } catch {}
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {}
  await clearLegacyAppCaches();
}

async function promptInstallApp() {
  if (!state.deferredInstallPrompt) return;
  const promptEvent = state.deferredInstallPrompt;
  state.deferredInstallPrompt = null;
  updateInstallUi();
  try {
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
  } catch {}
}

function isMobileLibraryMode() {
  return window.matchMedia('(max-width: 980px)').matches;
}

function syncMobileLibraryNav() {
  const showingRecents = isMobileLibraryMode() && el.appShell.classList.contains('library-open') && el.appShell.classList.contains('library-collapsed');
  el.sidebarRecentsBtn?.classList.toggle('is-active', showingRecents);
  el.sidebarRecentsBtn?.setAttribute('aria-current', showingRecents ? 'page' : 'false');
  el.sidebarLibraryBtn?.classList.toggle('is-active', !showingRecents);
  el.sidebarLibraryBtn?.setAttribute('aria-current', showingRecents ? 'false' : 'page');
  el.libraryBackToRecents?.classList.toggle('is-active', showingRecents);
  el.libraryBackToRecents?.setAttribute('aria-current', showingRecents ? 'page' : 'false');
  el.libraryCurrentViewBtn?.classList.toggle('is-active', !showingRecents);
  el.libraryCurrentViewBtn?.setAttribute('aria-current', showingRecents ? 'false' : 'page');
}

function openLibraryPage() {
  el.profileMenu.classList.add('hidden');
  el.appShell.classList.remove('library-collapsed');
  el.appShell.classList.remove('library-open', 'left-open');
  syncMobileLibraryNav();
  if (!isMobileLibraryMode()) {
    el.search?.focus();
  } else {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  document.querySelector('.library-hub')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openRecentsSidebar() {
  closeProfilePage();
  if (isMobileLibraryMode()) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
    el.appShell.classList.add('library-open');
    el.appShell.classList.add('library-collapsed');
    syncMobileLibraryNav();
    document.querySelector('.recent-sidebar .recent-list')?.scrollTo({ top: 0, behavior: 'instant' });
    return;
  }
  closeLibraryPage();
}

function openProfilePage() {
  el.profileMenu.classList.remove('hidden');
  if (isMobileLibraryMode()) {
    el.appShell.classList.add('library-collapsed');
    el.appShell.classList.remove('library-open', 'left-open', 'panel-open', 'memory-panel-open');
    el.appShell.classList.add('profile-open');
  }
}

function closeProfilePage() {
  el.profileMenu.classList.add('hidden');
  el.appShell.classList.remove('profile-open');
}

function closeLibraryPage() {
  closeProfilePage();
  el.appShell.classList.add('library-collapsed');
  el.appShell.classList.remove('library-open', 'left-open');
  syncMobileLibraryNav();
}

function applyAdminVisibility() {
  document.querySelectorAll('.admin-only').forEach((node) => node.classList.toggle('hidden', !isAdmin()));
  el.authUserChip.textContent = state.authUser ? `${state.authUser.displayName} · ${isAdmin() ? 'Admin' : 'User'}` : '';
}

function applySettings(settings = getUiSettings()) {
  const animationLevel = settings.animationLevel || 'medium';
  const reduceMotion = settings.reduceMotion === true || settings.reduceMotion === 'on';
  document.documentElement.style.setProperty('--accent', settings.accent || '#8b5cf6');
  document.documentElement.style.setProperty('--accent-soft', hexToRgba(settings.accent || '#8b5cf6', 0.16));
  const blurStrength = Math.min(Number(settings.blurStrength ?? 18), 10);
  document.documentElement.style.setProperty('--surface-blur', `${blurStrength}px`);
  document.documentElement.style.setProperty('--surface-alpha', `${settings.transparencyStrength ?? 0.72}`);
  document.documentElement.style.setProperty('--chat-bg-opacity', `${settings.backgroundIntensity ?? 0.16}`);
  document.documentElement.style.setProperty('--font-scale', `${settings.fontScale || 1}`);
  document.body.classList.toggle('compact-ui', settings.density === 'compact');
  document.body.classList.toggle('reduce-motion', reduceMotion);
  document.body.classList.toggle('motion-off', animationLevel === 'off');
  document.body.classList.toggle('motion-low', animationLevel === 'low');
  document.body.classList.toggle('motion-medium', animationLevel === 'medium');
  document.body.classList.toggle('motion-high', animationLevel === 'high');
  document.body.dataset.animation = animationLevel;
  el.settingDisplayName.value = settings.displayName || 'Jen';
  el.settingAccent.value = settings.accent || '#8b5cf6';
  el.settingPoll.value = (settings.autoPollModels === false || settings.autoPollModels === 'off') ? 'off' : 'on';
  el.settingAnimation.value = animationLevel;
  el.settingReduceMotion.value = reduceMotion ? 'on' : 'off';
  el.settingBlurStrength.value = settings.blurStrength ?? 18;
  el.settingTransparencyStrength.value = settings.transparencyStrength ?? 0.72;
  el.settingBackgroundIntensity.value = settings.backgroundIntensity ?? 0.16;
  el.settingDensity.value = settings.density || 'cozy';

  if (state.appConfig?.endpoints && isAdmin()) {
    const profiles = normalizeLocalProfiles(state.appConfig.endpoints.localProfiles, state.appConfig.endpoints.localBaseUrl, state.appConfig.endpoints.providerLabel || 'local');
    el.endpointLocalProfiles.value = profiles.map((profile) => `${profile.label}|${profile.baseUrl}`).join('\n');
    el.endpointLocalBaseUrl.value = state.appConfig.endpoints.localBaseUrl || '';
    el.endpointProviderLabel.value = state.appConfig.endpoints.providerLabel || '';
    el.endpointDefaultModel.value = state.appConfig.endpoints.defaultModel || '';
    el.endpointRequestTimeout.value = state.appConfig.endpoints.requestTimeoutMs || 120000;
    renderEndpointModelSelect(el.endpointMainModel, state.appConfig.endpoints.mainModel, `Use default (${state.appConfig.endpoints.defaultModel || state.bootstrap?.defaultModel || 'default'})`);
    el.endpointFallbackProvider1.value = state.appConfig.endpoints.fallbackProvider1 || 'local';
    el.endpointFallbackProvider2.value = state.appConfig.endpoints.fallbackProvider2 || 'local';
    const override1 = state.appConfig.endpoints.fallbackOverride1 || {};
    const override2 = state.appConfig.endpoints.fallbackOverride2 || {};
    el.endpointFallbackOverrideProvider1.value = override1.provider || '';
    el.endpointFallbackOverrideBase1.value = override1.baseUrl || '';
    el.endpointFallbackOverrideModel1.value = override1.model || '';
    el.endpointFallbackOverrideKey1.value = '';
    el.endpointFallbackOverrideProvider2.value = override2.provider || '';
    el.endpointFallbackOverrideBase2.value = override2.baseUrl || '';
    el.endpointFallbackOverrideModel2.value = override2.model || '';
    el.endpointFallbackOverrideKey2.value = '';
    refreshFallbackModelSelectors();
  }
}

function setBackendStatus(text, online) {
  el.backendStatus.innerHTML = `<span class="dot ${online ? 'online' : 'offline'}"></span>${text}`;
}

function renderEndpointModelSelect(selectEl, value, placeholder, models = state.models) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = placeholder;
  selectEl.appendChild(defaultOption);
  for (const model of models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    selectEl.appendChild(option);
  }
  selectEl.value = value || '';
}

async function fetchProviderModelsClient(provider = 'local') {
  if (state.providerModelCache[provider]) return state.providerModelCache[provider];
  const json = await api(`./api/provider-models?provider=${encodeURIComponent(provider)}`);
  state.providerModelCache[provider] = json.models || [];
  return state.providerModelCache[provider];
}

const HIDDEN_UI_TAG_PATTERNS = [
  /\bnsfw\b/i,
  /\bsex\b/i,
  /\bsex[-_ ]?toy/i,
  /\btoys?\b/i,
  /\bdildo/i,
  /\bvibrator/i,
  /\bfetish/i,
  /\bbdsm\b/i,
  /\bporn/i,
  /\bhentai/i,
  /\bsmut\b/i,
  /\bcock\b/i,
  /\bcunt\b/i,
  /\bcum\b/i,
];

function isHiddenUiTag(tag) {
  const value = String(tag || '').trim();
  return !value || HIDDEN_UI_TAG_PATTERNS.some((pattern) => pattern.test(value));
}

function visibleCharacterTags(character, limit = Infinity) {
  return (character.tags || []).filter((tag) => !isHiddenUiTag(tag)).slice(0, limit);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderImmersionText(value = '') {
  const source = String(value || '');
  const placeholders = [];
  const stash = (html) => {
    const token = `\u0000${placeholders.length}\u0000`;
    placeholders.push(html);
    return token;
  };

  let text = escapeHtml(source);
  text = text.replace(/`([^`\n]+?)`/g, (_, content) => stash(`<code class="immersion-code">${content}</code>`));
  text = text.replace(/\*\*\*([\s\S]+?)\*\*\*/g, (_, content) => stash(`<strong class="immersion-strong"><em class="immersion-action immersion-action-strong">${content}</em></strong>`));
  text = text.replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, (_, content) => stash(`<strong class="immersion-strong">${content}</strong>`));
  text = text.replace(/(^|[\s([{“"'—-])\*([^*\n][\s\S]*?[^*\n])\*(?=$|[\s.,!?;:)}\]”"'—-])/g, (match, prefix, content) => `${prefix}${stash(`<em class="immersion-action">${content}</em>`)}`);
  text = text.replace(/\n/g, '<br>');

  return placeholders.reduce((html, replacement, index) => html.replaceAll(`\u0000${index}\u0000`, replacement), text);
}

function getOrCreateCharacterPreviewModal() {
  let modal = document.getElementById('character-preview-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'character-preview-modal';
  modal.className = 'character-preview-modal hidden';
  modal.innerHTML = '<div class="character-preview-backdrop" data-close-preview></div><div class="character-preview-card" role="dialog" aria-modal="true" aria-label="Character preview"></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-preview]')) closeCharacterPreviewModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCharacterPreviewModal();
  });
  return modal;
}

function closeCharacterPreviewModal() {
  document.getElementById('character-preview-modal')?.classList.add('hidden');
}

function openCharacterPreviewModal(character) {
  if (!character?.id) return;
  const modal = getOrCreateCharacterPreviewModal();
  const tags = visibleCharacterTags(character, 6);
  const tier = getCharacterTier(character);
  const summary = character.shortDescription || character.summary || 'Ready to chat.';
  const greeting = character.first_mes || 'No starter message yet.';
  modal.querySelector('.character-preview-card').innerHTML = `
    <button class="character-preview-close icon-button" data-close-preview title="Close preview">×</button>
    <div class="character-preview-hero">
      <img src="${escapeHtml(character.imageUrl || '')}" alt="${escapeHtml(character.name || 'Character')}" loading="lazy" decoding="async" />
      <div class="character-preview-copy">
        <div class="eyebrow">${escapeHtml(tier)} preview</div>
        <h2>${escapeHtml(character.name || 'Character')}</h2>
        <p>${escapeHtml(summary)}</p>
        <div class="character-preview-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('') || '<span>Featured</span>'}</div>
      </div>
    </div>
    <div class="character-preview-starter">
      <div class="sidebar-section-label">Starter vibe</div>
      <p>${escapeHtml(greeting).slice(0, 520)}</p>
    </div>
    <div class="character-preview-actions">
      <button class="secondary" data-close-preview>Keep browsing</button>
      <button id="character-preview-start" class="primary">Start chat</button>
    </div>`;
  modal.querySelector('#character-preview-start')?.addEventListener('click', async () => {
    closeCharacterPreviewModal();
    await selectCharacter(character, { focusComposer: true });
  });
  modal.classList.remove('hidden');
}

function updateFallbackProviderVisibility() {
  el.endpointFallbackKeyRow1.classList.toggle('hidden', (el.endpointFallbackProvider1.value || 'local') === 'local');
  el.endpointFallbackKeyRow2.classList.toggle('hidden', (el.endpointFallbackProvider2.value || 'local') === 'local');
}

async function refreshFallbackModelSelectors() {
  if (!isAdmin() || !state.appConfig?.endpoints) return;
  const provider1 = el.endpointFallbackProvider1.value || 'local';
  const provider2 = el.endpointFallbackProvider2.value || 'local';
  const models1 = provider1 === 'local' ? state.models : await fetchProviderModelsClient(provider1).catch(() => []);
  const models2 = provider2 === 'local' ? state.models : await fetchProviderModelsClient(provider2).catch(() => []);
  renderEndpointModelSelect(el.endpointFallbackModel1, state.appConfig?.endpoints?.fallbackModel1, `No ${provider1} fallback selected`, models1);
  renderEndpointModelSelect(el.endpointFallbackModel2, state.appConfig?.endpoints?.fallbackModel2, `No ${provider2} fallback selected`, models2);
  updateFallbackProviderVisibility();
}

function updateTtsStatusButton() {
  if (!el.ttsStatusButton) return;
  const hasVoice = characterHasVoice();
  const autoplayEnabled = getCharacterAutoplayVoiceEnabled();
  el.ttsStatusButton.classList.toggle('tts-ready', hasVoice);
  el.ttsStatusButton.classList.toggle('tts-unavailable', !hasVoice);
  el.ttsStatusButton.classList.toggle('tts-autoplay-on', hasVoice && autoplayEnabled);
  el.ttsStatusButton.setAttribute('aria-label', hasVoice ? `Autoplay voice ${autoplayEnabled ? 'on' : 'off'} for this character` : 'Voice unavailable for this character');
  el.ttsStatusButton.title = hasVoice
    ? `Autoplay voice ${autoplayEnabled ? 'on' : 'off'} · ${state.selectedCharacterSettings?.voiceLabel || 'Voice configured'}`
    : 'Voice unavailable';
}

function updateHeader() {
  const character = getSelectedCharacter();
  const title = character ? character.name : 'Choose a character';
  const nextHeaderSignature = character ? `${character.id || title}:${character.imageUrl || ''}:${title}` : title;
  const headerChanged = Boolean(state.headerSignature) && state.headerSignature !== nextHeaderSignature;
  if (el.characterPanelTitle) el.characterPanelTitle.textContent = character ? `${character.name} settings` : 'Character settings';
  if (!el.currentCharacter) return;
  el.currentCharacter.classList.toggle('is-clickable', Boolean(character));
  el.currentCharacter.setAttribute('role', character ? 'button' : 'text');
  el.currentCharacter.setAttribute('aria-label', character ? `Open ${character.name} settings` : 'Choose a character');
  el.currentCharacter.tabIndex = character ? 0 : -1;
  if (character) {
    const avatar = character.imageUrl || fallbackAvatarDataUrl(character.name || '?');
    el.currentCharacter.innerHTML = `<img class="mobile-chat-header-avatar" src="${escapeHtml(avatar)}" alt="" loading="lazy" decoding="async" /><span>${escapeHtml(title)}</span>`;
  } else {
    el.currentCharacter.innerHTML = `<span>${escapeHtml(title)}</span>`;
  }
  state.headerSignature = nextHeaderSignature;
  if (headerChanged) {
    el.currentCharacter.classList.remove('header-swap');
    void el.currentCharacter.offsetWidth;
    el.currentCharacter.classList.add('header-swap');
    clearTimeout(state.headerAnimationTimer);
    state.headerAnimationTimer = window.setTimeout(() => {
      el.currentCharacter?.classList.remove('header-swap');
    }, 360);
  }
  updateTtsStatusButton();
}

function showCharacterLoading(character) {
  clearRenderedChatState();
  el.chatView.innerHTML = `
    <div class="empty-state">
      <div class="eyebrow">Loading chat</div>
      <h2>${character?.name || 'Character'}</h2>
      <p>Opening this character…</p>
    </div>`;
}

async function selectCharacter(character, options = {}) {
  if (!character?.id) return;
  state.selectedCharacterId = character.id;
  if (options.personaId) state.selectedPersonaId = options.personaId;
  state.selectedConversationId = options.conversationId || null;
  state.selectedCharacterSettings = null;
  state.currentConversationList = [];
  closeLibraryPage();
  updateHeader();
  showCharacterLoading(character);
  await savePreferences({ session: { activeCharacterId: state.selectedCharacterId, activeConversationId: state.selectedConversationId || '', activePersonaId: state.selectedPersonaId || '' } });
  await hydrateSelectedWorkspace({ keepSelection: true });
  if (options.focusComposer) el.input.focus();
}

function syncRecentConversationsFromCurrentList() {
  if (!state.bootstrap) return;
  const bucketKey = `${state.selectedCharacterId || 'none'}::${state.selectedPersonaId || 'none'}`;
  const others = (state.bootstrap.recentConversations || []).filter((item) => item.bucketKey !== bucketKey);
  const current = getCurrentConversationList().map((item) => ({
    id: item.id,
    name: item.name,
    updatedAt: item.updatedAt,
    preview: item.preview,
    bucketKey,
  }));
  state.bootstrap.recentConversations = [...current, ...others].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 20);
}

function renderRecentChats() {
  const recent = (state.bootstrap?.recentConversations || []).slice(0, 8);
  el.recentList.innerHTML = '';
  if (!recent.length) {
    el.recentList.innerHTML = '<div class="info-card"><div class="meta-line">No recent chats yet. Pick a gremlin from the library and start one.</div></div>';
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const [index, item] of recent.entries()) {
    const [characterId, personaId] = String(item.bucketKey || '').split('::');
    const character = state.bootstrap?.characters?.find((c) => c.id === characterId);
    if (!character) continue;
    const card = document.createElement('button');
    card.className = 'recent-card rich-recent-card motion-enter-card';
    card.style.setProperty('--stagger-index', String(Math.min(index, 7)));
    const lastUpdated = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
    const previewText = item.preview ? (item.preview.length > 70 ? item.preview.substring(0, 67) + '...' : item.preview) : 'Pick up where you left off';
    card.innerHTML = `
      <div class="recent-card-avatar-wrap">
        <img src="${character.imageUrl}" alt="${character.name}" loading="lazy" decoding="async" class="recent-card-img" />
      </div>
      <div class="recent-card-content">
        <div class="recent-card-header">
          <span class="recent-card-name">${character.name}</span>
          <span class="recent-card-date">${lastUpdated}</span>
        </div>
        <div class="recent-card-meta">${item.name || 'Resume chat'}</div>
        <div class="recent-card-preview">${previewText}</div>
      </div>
    `;
    card.addEventListener('click', async () => {
      await selectCharacter(character, { personaId: personaId || state.selectedPersonaId, conversationId: item.id, force: true });
    });
    fragment.appendChild(card);
  }
  el.recentList.appendChild(fragment);
}

function renderLibraryTabs() {
  el.libraryTabs?.querySelectorAll('[data-library-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.libraryTab === state.activeLibraryTab);
  });
}

function renderFilters() {
  const characters = state.bootstrap?.characters || [];
  const currentSource = el.sourceFilter.value || '';
  const currentTag = el.tagFilter.value || '';
  const sources = Array.from(new Set(characters.map(characterSourceLabel))).filter(Boolean).sort();
  const tags = Array.from(new Set(characters.flatMap((character) => visibleCharacterTags(character)))).filter(Boolean).sort((a, b) => a.localeCompare(b));

  el.sourceFilter.innerHTML = '<option value="">All sources</option>';
  for (const source of sources) {
    const option = document.createElement('option');
    option.value = source;
    option.textContent = source;
    el.sourceFilter.appendChild(option);
  }
  el.sourceFilter.value = sources.includes(currentSource) ? currentSource : '';

  el.tagFilter.innerHTML = '<option value="">All tags</option>';
  for (const tag of tags) {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    el.tagFilter.appendChild(option);
  }
  el.tagFilter.value = tags.includes(currentTag) ? currentTag : '';
}

function renderCharacterCount() {
  const total = state.bootstrap?.characters?.length || 0;
  if (el.characterCount) el.characterCount.textContent = `${total} character${total === 1 ? '' : 's'}`;
}

function characterLibraryPriority(character) {
  const tags = character.tags || [];
  const avatar = String(character.avatar || '').trim().toLowerCase();
  const isOriginal = tags.includes('original') || character.source === 'original';
  const isChubImport = tags.includes('external-import') || tags.includes('chubvenus') || characterSourceLabel(character) === 'chub' || String(character.sourceUrl || '').includes('chub.ai/characters/');
  const isExternal = !!character.sourceUrl || isChubImport;
  const hasRasterAvatar = /\.(png|jpe?g|webp|gif)$/i.test(avatar);
  const hasVectorAvatar = /\.svg$/i.test(avatar);
  if (isChubImport && hasRasterAvatar) return 4;
  if (isExternal && hasRasterAvatar) return 3;
  if (isExternal && hasVectorAvatar) return 2;
  if (!isOriginal && hasRasterAvatar) return 1;
  return 0;
}

function sortLibraryCharacters(a, b, favorites) {
  return characterLibraryPriority(b) - characterLibraryPriority(a)
    || Number(b.score || 0) - Number(a.score || 0)
    || Number(favorites?.has?.(b.id) || 0) - Number(favorites?.has?.(a.id) || 0)
    || a.name.localeCompare(b.name);
}

function renderFeatured() {
  const featured = (state.bootstrap?.characters || [])
    .filter((character) => Number.isFinite(Number(character.score)) && Number(character.score) > 0)
    .sort((a, b) => sortLibraryCharacters(a, b))
    .slice(0, 4);
  el.featuredList.innerHTML = '';
  if (!featured.length) {
    el.featuredList.innerHTML = '<div class="meta-line">No scored characters yet. Patience, mortal.</div>';
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const [index, character] of featured.entries()) {
    const card = document.createElement('button');
    card.className = 'recent-card rich-recent-card featured-card motion-enter-card';
    card.style.setProperty('--stagger-index', String(Math.min(index, 5)));
    const tier = getCharacterTier(character);
    const scoreBadge = Number.isFinite(Number(character.score)) && Number(character.score) > 0 ? `<span class="score-badge tier-${tier}">${character.score}</span>` : '';
    card.innerHTML = `
      <div class="recent-card-avatar-wrap"><img src="${character.imageUrl}" alt="${character.name}" loading="lazy" decoding="async" class="recent-card-img" /></div>
      <div class="recent-card-content">
        <div class="recent-card-header"><span class="recent-card-name">${character.name}</span>${scoreBadge}</div>
        <div class="recent-card-meta">${visibleCharacterTags(character, 2).join(', ') || 'Featured'}</div>
        <div class="recent-card-preview clamp-1">${character.shortDescription || character.summary || 'Ready to chat'}</div>
      </div>
    `;
    card.addEventListener('click', async () => {
      await selectCharacter(character);
    });
    fragment.appendChild(card);
  }
  el.featuredList.appendChild(fragment);
}

function renderCharacters() {
  const term = el.search.value.trim().toLowerCase();
  const sourceFilter = el.sourceFilter.value || '';
  const tagFilter = el.tagFilter.value || '';
  const favorites = favoriteIds();
  let characters = [...(state.bootstrap?.characters || [])]
    .filter((character) => !term || `${character.name} ${character.summary} ${character.first_mes || ''} ${(character.tags || []).join(' ')}`.toLowerCase().includes(term))
    .filter((character) => !sourceFilter || characterSourceLabel(character) === sourceFilter)
    .filter((character) => !tagFilter || (character.tags || []).includes(tagFilter));

  if (state.activeLibraryTab === 'featured') {
    characters = characters.filter((character) => Number(character.score || 0) > 0)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 12);
  } else if (state.activeLibraryTab === 'new') {
    characters = characters.filter((character) => !!character.importedAt)
      .sort((a, b) => new Date(b.importedAt || 0).getTime() - new Date(a.importedAt || 0).getTime());
  } else if (state.activeLibraryTab === 'chub') {
    characters = characters.filter((character) => characterSourceLabel(character) === 'chub');
  }

  if (state.activeLibraryTab === 'new') {
    characters = characters.sort((a, b) => new Date(b.importedAt || 0).getTime() - new Date(a.importedAt || 0).getTime() || sortLibraryCharacters(a, b, favorites));
  } else {
    characters = characters.sort((a, b) => sortLibraryCharacters(a, b, favorites));
  }

  el.list.innerHTML = '';

  if (!characters.length) {
    el.list.innerHTML = '<div class="info-card"><div class="meta-line">No characters match that filter set. Tragic, but fixable.</div></div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const [index, character] of characters.entries()) {
    const card = document.createElement('div');
    const tier = getCharacterTier(character);
    card.className = `character-card motion-enter-card tier-${tier} ${character.id === state.selectedCharacterId ? 'active' : ''}`;
    card.style.setProperty('--stagger-index', String(Math.min(index, 11)));
    const isFav = favorites.has(character.id);
    const scoreBadge = Number.isFinite(Number(character.score)) && Number(character.score) > 0 ? `<span class="score-badge tier-${tier}">${character.score}</span>` : '';
    const previewSnippet = (character.first_mes || character.shortDescription || character.summary || 'Ready to chat').slice(0, 220);
    card.innerHTML = `
      <img src="${character.imageUrl}" alt="${character.name}" loading="lazy" decoding="async" />
      <div class="card-main">
        <div class="card-topline">
          <div class="name-row"><div class="name">${character.name}</div>${scoreBadge}</div>
          <div class="card-actions-inline">
            <button class="start-chat-btn mini-btn" title="Start with this character">Start</button>
            <button class="favorite-toggle ${isFav ? 'is-favorite' : ''}" title="Favorite">★</button>
          </div>
        </div>
        <div class="desc clamp-2">${character.shortDescription || character.summary || 'Start a chat'}</div>
        <div class="card-meta-row"><span>${characterSourceLabel(character)}</span>${visibleCharacterTags(character, 3).map((tag) => `<button class="tag-chip ${tagFilter === tag ? 'active' : ''}" data-tag="${tag}">${tag}</button>`).join('')}</div>
        <div class="hover-preview"><strong>${tier.toUpperCase()}</strong> · ${previewSnippet}</div>
      </div>
    `;
    card.addEventListener('click', async (event) => {
      if (event.target.closest('.favorite-toggle') || event.target.closest('.tag-chip') || event.target.closest('.start-chat-btn')) return;
      openCharacterPreviewModal(character);
    });
    card.querySelector('.favorite-toggle').addEventListener('click', async (event) => {
      event.stopPropagation();
      await toggleFavorite(character.id);
    });
    card.querySelector('.start-chat-btn').addEventListener('click', async (event) => {
      event.stopPropagation();
      await selectCharacter(character, { focusComposer: true });
    });
    card.querySelectorAll('[data-tag]').forEach((chip) => chip.addEventListener('click', (event) => {
      event.stopPropagation();
      el.tagFilter.value = chip.dataset.tag;
      renderCharacters();
    }));
    fragment.appendChild(card);
  }
  el.list.appendChild(fragment);
}

const renderCharactersDebounced = debounce(renderCharacters, 140);

function setAcquireStatus(message = '', isError = false) {
  if (!el.acquireChubStatus) return;
  if (!message) {
    el.acquireChubStatus.textContent = '';
    el.acquireChubStatus.classList.add('hidden');
    el.acquireChubStatus.style.color = '';
    return;
  }
  el.acquireChubStatus.textContent = message;
  el.acquireChubStatus.classList.remove('hidden');
  el.acquireChubStatus.style.color = isError ? 'var(--danger, #fda4af)' : '';
}

function clearAcquireRejectionSummary() {
  if (!el.acquireRejectionSummary || !el.acquireRejectionSummaryList) return;
  el.acquireRejectionSummary.classList.add('hidden');
  el.acquireRejectionSummary.open = false;
  el.acquireRejectionSummaryList.innerHTML = '';
}

function normalizeRejectReason(reason = '') {
  const text = String(reason || '').trim();
  if (!text) return 'Unknown reason';
  if (/near-duplicate|duplicate/i.test(text)) return 'Duplicate / too similar';
  if (/unsafe/i.test(text)) return 'Unsafe source pattern';
  if (/generic\/bad|generic/i.test(text)) return 'Generic or low-value card type';
  if (/diversity cap/i.test(text)) return 'Too many similar tags already';
  if (/score below/i.test(text)) return 'Quality score too low';
  if (/usable avatar|required avatar|missing usable avatar/i.test(text)) return 'Missing usable avatar';
  if (/validation failed/i.test(text)) {
    const detail = text.replace(/^Validation failed:\s*/i, '').split(',').map((item) => item.trim()).filter(Boolean);
    return detail.length ? detail.join(' + ') : 'Incomplete card fields';
  }
  if (/gateway failed|404|403|timeout|network/i.test(text)) return 'Source fetch failed';
  return text.slice(0, 120);
}

function renderAcquireRejectionSummary(run) {
  if (!el.acquireRejectionSummary || !el.acquireRejectionSummaryList) return;
  const rejected = Array.isArray(run?.rejected) ? run.rejected : [];
  if (!rejected.length) {
    clearAcquireRejectionSummary();
    return;
  }
  const counts = new Map();
  for (const item of rejected) {
    const reason = normalizeRejectReason(item.reason || item.error || item.line || '');
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  el.acquireRejectionSummary.classList.remove('hidden');
  el.acquireRejectionSummary.querySelector('summary').textContent = `Rejected card reasons (${rejected.length})`;
  el.acquireRejectionSummaryList.innerHTML = rows.map(([reason, count]) => `
    <div class="rejection-summary-row">
      <span>${reason}</span>
      <strong>${count}</strong>
    </div>
  `).join('');
}

function getAcquireStrictnessConfig() {
  const mode = el.acquireStrictness?.value || 'medium';
  if (mode === 'best') return { label: 'Best', scoreThreshold: 65 };
  if (mode === 'low') return { label: 'Low', scoreThreshold: 45 };
  if (mode === 'none') return { label: 'No quality checks', scoreThreshold: 0, noQuality: true };
  return { label: 'Medium', scoreThreshold: 50 };
}

function getAcquireCount() {
  const value = Math.round(Number(el.acquireCount?.value || 6));
  const clamped = Math.max(1, Math.min(50, Number.isFinite(value) ? value : 6));
  if (el.acquireCount) el.acquireCount.value = String(clamped);
  return clamped;
}

function formatAcquireProgress(run) {
  const progress = run?.progress || {};
  const processed = Number(progress.processed || 0);
  const accepted = Number(progress.accepted || 0);
  const rejected = Number(progress.rejected || 0);
  const duplicates = Number(progress.duplicates || 0);
  const target = Number(progress.target || 0);
  const targetText = target ? `${accepted}/${target} accepted` : `${accepted} accepted`;
  return `${targetText} · ${rejected} rejected · ${duplicates} duplicates · ${processed} checked`;
}

async function watchAcquireProgress() {
  let lastProcessed = -1;
  while (true) {
    const run = await api('./api/acquisition/chub');
    const processed = Number(run?.progress?.processed || 0);
    const tail = Array.isArray(run?.output) ? run.output[run.output.length - 1] : '';
    if (run?.running) {
      if (processed !== lastProcessed) {
        const detail = tail ? ` · ${tail.replace(/^((IMPORTED|SKIPPED) ::\s*)/, '')}` : '';
        setAcquireStatus(`Adding characters… ${formatAcquireProgress(run)}${detail}`);
        lastProcessed = processed;
      }
      await new Promise((resolve) => setTimeout(resolve, 1800));
      continue;
    }
    const accepted = Array.isArray(run?.accepted) ? run.accepted.length : 0;
    const rejected = Array.isArray(run?.rejected) ? run.rejected.length : 0;
    renderAcquireRejectionSummary(run);
    if (run?.error) {
      setAcquireStatus(run.error, true);
    } else if (!accepted) {
      setAcquireStatus(`No new Chub characters passed the filters this run. ${rejected} rejected, ${run.duplicateCount || 0} duplicates. Try again later or loosen the filters.`);
    } else {
      setAcquireStatus(`Added more characters: ${accepted} accepted, ${rejected} rejected, ${run.duplicateCount || 0} duplicates, avg score ${run.averageScore || 0}.`);
    }
    await loadBootstrap();
    return run;
  }
}

async function acquireFreshBatch() {
  if (!isAdmin()) {
    setAcquireStatus('Add more characters is admin-only right now. Tragic.', true);
    return;
  }
  const strictness = getAcquireStrictnessConfig();
  const requestedCount = getAcquireCount();
  const previous = el.acquireChubBtn.textContent;
  el.acquireChubBtn.disabled = true;
  if (el.acquireCount) el.acquireCount.disabled = true;
  el.acquireChubBtn.textContent = 'Adding…';
  clearAcquireRejectionSummary();
  setAcquireStatus(`Starting character hunt… target: ${requestedCount}, strictness: ${strictness.label}.`);
  try {
    const started = await api('./api/acquisition/chub/start', {
      method: 'POST',
      body: JSON.stringify({ batchSize: requestedCount, scoreThreshold: strictness.scoreThreshold, noQuality: !!strictness.noQuality }),
    });
    setAcquireStatus(`Adding characters… ${formatAcquireProgress(started)}`);
    await watchAcquireProgress();
  } catch (error) {
    setAcquireStatus(error.message || 'Fresh batch failed. Rude.', true);
  } finally {
    el.acquireChubBtn.disabled = false;
    if (el.acquireCount) el.acquireCount.disabled = false;
    el.acquireChubBtn.textContent = previous;
  }
}

function renderPersonas() {
  el.personaSelect.innerHTML = '';
  for (const persona of state.bootstrap.personas) {
    const option = document.createElement('option');
    option.value = persona.id;
    option.textContent = persona.name;
    el.personaSelect.appendChild(option);
  }
  if (state.selectedPersonaId) el.personaSelect.value = state.selectedPersonaId;
}

function normalizeLocalProfiles(profiles = [], fallbackBaseUrl = '', fallbackLabel = 'local') {
  const list = Array.isArray(profiles) ? profiles.filter((profile) => profile?.baseUrl).map((profile, index) => ({
    id: String(profile.id || profile.label || `local-${index + 1}`),
    label: String(profile.label || `Local ${index + 1}`),
    baseUrl: String(profile.baseUrl || ''),
  })) : [];
  if (list.length) return list;
  return fallbackBaseUrl ? [{ id: 'primary-local', label: fallbackLabel || 'local', baseUrl: fallbackBaseUrl }] : [];
}

function renderLocalProfiles() {
  const endpoints = state.appConfig?.endpoints || {};
  const profiles = normalizeLocalProfiles(endpoints.localProfiles, endpoints.localBaseUrl, endpoints.providerLabel || 'local');
  const activeId = endpoints.activeLocalProfileId || profiles[0]?.id || '';
  if (el.localProfileSelect) {
    el.localProfileSelect.innerHTML = '';
    for (const profile of profiles) {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.label;
      el.localProfileSelect.appendChild(option);
    }
    if (profiles.length) el.localProfileSelect.value = activeId;
    el.localProfileSelect.closest('.field')?.classList.toggle('hidden', !isAdmin() || profiles.length <= 1);
  }
  if (el.endpointActiveLocalProfile) {
    el.endpointActiveLocalProfile.innerHTML = '';
    for (const profile of profiles) {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = `${profile.label} · ${profile.baseUrl}`;
      el.endpointActiveLocalProfile.appendChild(option);
    }
    if (profiles.length) el.endpointActiveLocalProfile.value = activeId;
  }
}

function syncEndpointLocalProfileOptionsFromTextarea() {
  if (!el.endpointLocalProfiles || !el.endpointActiveLocalProfile) return;
  const profiles = el.endpointLocalProfiles.value.split('\n').map((line, index) => {
    const [label, baseUrl] = line.split('|').map((part) => part.trim());
    if (!label || !baseUrl) return null;
    return { id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `local-${index + 1}`, label, baseUrl };
  }).filter(Boolean);
  const current = el.endpointActiveLocalProfile.value;
  el.endpointActiveLocalProfile.innerHTML = '';
  for (const profile of profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = `${profile.label} · ${profile.baseUrl}`;
    el.endpointActiveLocalProfile.appendChild(option);
  }
  if (profiles.length) el.endpointActiveLocalProfile.value = profiles.find((profile) => profile.id === current)?.id || profiles[0].id;
}

function renderModels() {
  el.modelSelect.innerHTML = '';
  for (const model of state.models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    el.modelSelect.appendChild(option);
  }
  if (state.selectedModel) el.modelSelect.value = state.selectedModel;
  renderLocalProfiles();
  if (isAdmin() && state.appConfig?.endpoints) {
    renderEndpointModelSelect(el.endpointMainModel, state.appConfig?.endpoints?.mainModel, `Use default (${state.appConfig?.endpoints?.defaultModel || state.bootstrap?.defaultModel || 'default'})`);
    el.endpointFallbackProvider1.value = state.appConfig?.endpoints?.fallbackProvider1 || 'local';
    el.endpointFallbackProvider2.value = state.appConfig?.endpoints?.fallbackProvider2 || 'local';
    refreshFallbackModelSelectors();
  }
  updateComposerState();
}

function getMessageSignature(message, index = 0) {
  return JSON.stringify({
    index,
    role: message?.role || '',
    text: getMessageText(message),
    images: getMessageImages(message),
  });
}

function escapeAttribute(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isAssistantMessageActionable(message) {
  return message?.role === 'assistant' && !!normalizeTtsRequestText(getMessageText(message));
}

function closeMessageActions({ preserveEdit = false } = {}) {
  if (state.messageActions.activeKey) {
    const activeRow = el.chatView?.querySelector(`.message-row[data-message-key="${CSS.escape(state.messageActions.activeKey)}"]`);
    if (activeRow) activeRow.classList.remove('message-actions-open');
  }
  state.messageActions.activeKey = null;
  if (!preserveEdit) {
    state.messageActions.editingKey = null;
    state.messageActions.draft = '';
  }
}

function openMessageActions(key) {
  if (!key) return;
  state.messageActions.activeKey = key;
  const nextRow = el.chatView?.querySelector(`.message-row[data-message-key="${CSS.escape(key)}"]`);
  if (nextRow) nextRow.classList.add('message-actions-open');
}

function startEditingMessage(key, text = '') {
  if (!key) return;
  state.messageActions.activeKey = key;
  state.messageActions.editingKey = key;
  state.messageActions.draft = String(text || '');
}

function getConversationMessageByKey(conversation, key) {
  const messages = conversation?.messages || [];
  const index = messages.findIndex((message, messageIndex) => getMessageSignature(message, messageIndex) === key);
  if (index === -1) return { index: -1, message: null, messages };
  return { index, message: messages[index], messages };
}

async function generateAssistantTurn(messages, { conversationId, model, temperature, stream = true, onDelta = null, onDone = null } = {}) {
  const response = await fetch('./api/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      characterId: state.selectedCharacterId,
      personaId: state.selectedPersonaId,
      conversationId,
      model: model || getCharacterModel(),
      temperature: typeof temperature === 'number' ? temperature : getCharacterTemperature(),
      messages,
      stream,
    }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.detail || json.error || `Backend unavailable (${response.status})`);
  }

  if (stream && response.body) {
    let streamedText = '';
    let streamError = '';
    await readEventStream(response, {
      delta: ({ delta }) => {
        streamedText += delta || '';
        if (typeof onDelta === 'function') onDelta(streamedText, delta || '');
      },
      done: ({ content }) => {
        if (!streamedText && content) streamedText = content;
        if (typeof onDone === 'function') onDone(streamedText);
      },
      error: ({ detail, error }) => {
        streamError = detail || error || 'Backend unavailable.';
      },
    });
    if (!streamedText) throw new Error(streamError || 'Backend returned an empty response');
    return streamedText;
  }

  const json = await response.json().catch(() => ({}));
  const content = String(json.content || '').trim();
  if (!content) throw new Error(json.detail || json.error || 'Backend returned an empty response');
  return content;
}

async function saveEditedAssistantMessage(messageKey) {
  const draft = String(state.messageActions.draft || '').trim();
  if (!draft || !state.selectedConversationId) return;
  const conversation = await fetchConversation(state.selectedConversationId);
  const { index, messages } = getConversationMessageByKey(conversation, messageKey);
  if (index === -1) return;
  const nextMessages = messages.map((message, messageIndex) => messageIndex === index ? { ...message, content: draft } : message);
  state.messageActions.busyKey = messageKey;
  await updateConversation(state.selectedConversationId, { messages: nextMessages });
  state.messageActions.busyKey = null;
  closeMessageActions();
  await hydrateSelectedWorkspace({ keepSelection: true, skipCharacterList: true });
}

async function streamAssistantMutation({ messageKey, anchorKey, replaceKey = '', baseMessages, buildNextMessages }) {
  if (!state.selectedConversationId || state.isStreaming) return;
  state.messageActions.busyKey = messageKey;
  state.isStreaming = true;
  updateComposerState();

  const typingRow = renderMessage({ role: 'assistant', content: state.backendReachable ? 'Thinking…' : 'Backend is offline. I will still try once.' }, { animate: false, index: baseMessages.length });
  typingRow.classList.add('streaming-row', 'inline-streaming-row');

  const replaceRow = replaceKey ? el.chatView?.querySelector(`.message-row[data-message-key="${CSS.escape(replaceKey)}"]`) : null;
  const anchorRow = anchorKey ? el.chatView?.querySelector(`.message-row[data-message-key="${CSS.escape(anchorKey)}"]`) : null;
  if (replaceRow?.parentNode) {
    replaceRow.replaceWith(typingRow);
  } else if (anchorRow?.parentNode) {
    anchorRow.insertAdjacentElement('afterend', typingRow);
  } else if (el.chatView) {
    el.chatView.appendChild(typingRow);
  }

  try {
    const streamedText = await generateAssistantTurn(baseMessages, {
      conversationId: null,
      stream: true,
      onDelta: (fullText) => {
        applyStreamedText(typingRow, fullText);
      },
      onDone: (fullText) => {
        applyStreamedText(typingRow, fullText);
      },
    });
    const finalAssistantMessage = { role: 'assistant', content: streamedText };
    const finalRow = renderMessage(finalAssistantMessage, { animate: false, index: baseMessages.length, totalMessages: baseMessages.length + 1 });
    typingRow.replaceWith(finalRow);
    const nextMessages = buildNextMessages(finalAssistantMessage);
    await updateConversation(state.selectedConversationId, { messages: nextMessages });
    closeMessageActions();
    await hydrateSelectedWorkspace({ keepSelection: true, skipCharacterList: true });
  } catch (error) {
    typingRow.remove();
    console.error(error);
  } finally {
    state.messageActions.busyKey = null;
    state.isStreaming = false;
    updateComposerState();
  }
}

async function continueAssistantMessage(messageKey) {
  if (!state.selectedConversationId || state.isStreaming) return;
  const conversation = await fetchConversation(state.selectedConversationId);
  const { index, messages } = getConversationMessageByKey(conversation, messageKey);
  if (index === -1) return;
  const baseMessages = messages.slice(0, index + 1);
  await streamAssistantMutation({
    messageKey,
    anchorKey: messageKey,
    baseMessages,
    buildNextMessages: (assistantMessage) => [...baseMessages, assistantMessage],
  });
}

async function regenerateAssistantMessage(messageKey) {
  if (!state.selectedConversationId || state.isStreaming) return;
  const conversation = await fetchConversation(state.selectedConversationId);
  const { index, messages } = getConversationMessageByKey(conversation, messageKey);
  if (index === -1) return;
  const baseMessages = messages.slice(0, index).filter((message) => message.role !== 'system');
  const anchorKey = index > 0 ? getMessageSignature(messages[index - 1], index - 1) : '';
  await streamAssistantMutation({
    messageKey,
    anchorKey,
    replaceKey: messageKey,
    baseMessages,
    buildNextMessages: (assistantMessage) => [...baseMessages, assistantMessage],
  });
}

function closeRewindConfirmDialog() {
  state.messageActions.rewindPendingKey = null;
  if (el.rewindConfirmDialog?.open) el.rewindConfirmDialog.close();
}

async function rewindConversationToMessage(messageKey, { confirmed = false } = {}) {
  if (!state.selectedConversationId || state.isStreaming) return;
  const conversation = await fetchConversation(state.selectedConversationId);
  const { index, messages, message } = getConversationMessageByKey(conversation, messageKey);
  if (index === -1 || !message) return;
  if (index >= messages.length - 1) return;
  const preview = normalizeTtsRequestText(getMessageText(message)).slice(0, 220) || 'this message';

  if (!confirmed) {
    state.messageActions.rewindPendingKey = messageKey;
    if (el.rewindConfirmTarget) {
      el.rewindConfirmTarget.textContent = preview + (preview.length >= 220 ? '…' : '');
    }
    el.rewindConfirmDialog?.showModal();
    return;
  }

  const nextMessages = messages.slice(0, index + 1);
  await updateConversation(state.selectedConversationId, { messages: nextMessages });
  closeRewindConfirmDialog();
  closeMessageActions();
  await hydrateSelectedWorkspace({ keepSelection: true, skipCharacterList: true });
}

function renderMessage(message, options = {}) {
  const character = getSelectedCharacter();
  const persona = getSelectedPersona();
  const displayName = getUiSettings().displayName || state.authUser?.displayName || 'You';
  const row = document.createElement('div');
  row.className = `message-row ${message.role}${options.animate === false ? '' : ' message-enter'}`;
  const imageUrl = message.role === 'assistant' ? character?.imageUrl : persona?.imageUrl;
  const name = message.role === 'assistant' ? character?.name : message.role === 'user' ? (persona?.name || displayName) : 'System';
  const text = getMessageText(message);
  const images = getMessageImages(message);
  const messageKey = getMessageSignature(message, options.index || 0);
  const showTts = message.role === 'assistant' && !!text.trim() && !!getCharacterFishReferenceId();
  const actionAvailable = isAssistantMessageActionable(message);
  const canRewind = actionAvailable && typeof options.index === 'number' && options.index < ((options.totalMessages || 0) - 1);
  const actionOpen = actionAvailable && state.messageActions.activeKey === messageKey;
  const actionEditing = actionAvailable && state.messageActions.editingKey === messageKey;
  const actionBusy = actionAvailable && state.messageActions.busyKey === messageKey;
  const ttsState = state.tts.loadingKeys[messageKey]
    ? 'loading'
    : state.tts.currentKey === messageKey && state.tts.currentPaused
      ? 'paused'
      : state.tts.currentKey === messageKey
        ? 'playing'
        : state.tts.lastErrorKey === messageKey
          ? 'error'
          : 'idle';
  const ttsLabel = ttsState === 'loading' ? '…' : ttsState === 'playing' ? '⏸' : ttsState === 'error' ? '!' : '▶';
  const debugTag = state.tts.debugTags[messageKey] || '';
  row.dataset.messageKey = messageKey;
  if (actionAvailable) row.dataset.messageActionable = 'true';
  if (actionOpen) row.classList.add('message-actions-open');
  row.innerHTML = `
    ${message.role === 'user' ? '' : imageUrl ? `<img class="avatar-bubble" src="${imageUrl}" alt="${name}" />` : ''}
    <div class="message-wrap ${showTts ? 'has-tts' : ''} ${actionAvailable ? 'message-wrap-actionable' : ''}">
      <div class="message-topline">
        <div class="message-name">${name}</div>
        ${showTts && debugTag ? `<div class="message-meta">TTS tag: ${escapeHtml(debugTag)}</div>` : ''}
      </div>
      ${showTts ? `<button class="message-tts-btn ${ttsState}" data-tts="${encodeURIComponent(messageKey)}" aria-label="Play voice" title="Play voice">${ttsLabel}</button>` : ''}
      <div class="message ${message.role} ${showTts ? 'has-tts' : ''}"></div>
      ${actionAvailable ? `
        <div class="message-actions${actionOpen ? ' open' : ''}${actionBusy ? ' busy' : ''}" data-message-actions="${encodeURIComponent(messageKey)}">
          ${canRewind ? `<button class="message-action-btn icon-btn rewind-btn" data-message-action="rewind" data-message-key="${encodeURIComponent(messageKey)}" aria-label="Rewind to here" title="Rewind">⏮</button>` : ''}
          <button class="message-action-btn icon-btn" data-message-action="regenerate" data-message-key="${encodeURIComponent(messageKey)}" aria-label="Regenerate reply" title="Regenerate">↻</button>
          <button class="message-action-btn icon-btn" data-message-action="edit" data-message-key="${encodeURIComponent(messageKey)}" aria-label="Edit reply" title="Edit">✎</button>
          <button class="message-action-btn text-btn" data-message-action="continue" data-message-key="${encodeURIComponent(messageKey)}">Continue</button>
        </div>
      ` : ''}
      ${actionEditing ? `
        <div class="message-edit-panel" data-message-edit="${encodeURIComponent(messageKey)}">
          <textarea class="message-edit-input" data-message-edit-input="${encodeURIComponent(messageKey)}" placeholder="Edit reply...">${escapeHtml(state.messageActions.draft || text)}</textarea>
          <div class="message-edit-actions">
            <button class="message-action-btn text-btn" data-message-action="save-edit" data-message-key="${encodeURIComponent(messageKey)}">Save</button>
            <button class="message-action-btn text-btn secondary" data-message-action="cancel-edit" data-message-key="${encodeURIComponent(messageKey)}">Cancel</button>
          </div>
        </div>
      ` : ''}
      ${images.length ? `<div class="message-images">${images.map((src) => `<img src="${src}" alt="attachment" />`).join('')}</div>` : ''}
    </div>
    ${message.role === 'user' && imageUrl ? `<img class="avatar-bubble" src="${imageUrl}" alt="${name}" />` : ''}
  `;
  row.querySelector('.message').innerHTML = renderImmersionText(text);
  return row;
}

function clearRenderedChatState() {
  state.renderedChatSignatures = [];
  state.renderedConversationId = null;
}

function rerenderChatIfMounted(options = {}) {
  if (!el.chatView?.children?.length) return;
  if (state.isStreaming) return;
  const preserveScroll = options.preserveScroll !== false;
  const scrollTop = preserveScroll ? el.chatView.scrollTop : 0;
  const scrollHeight = preserveScroll ? el.chatView.scrollHeight : 0;
  clearRenderedChatState();
  renderChat().then(() => {
    if (!preserveScroll) return;
    const heightDelta = el.chatView.scrollHeight - scrollHeight;
    el.chatView.scrollTop = scrollTop + Math.max(0, heightDelta);
  }).catch(() => {});
}

function scheduleMessageActionsClose() {
  clearTimeout(state.messageActions.touchTimer);
  state.messageActions.touchTimer = null;
  state.messageActions.touchKey = null;
}

function focusMessageEditor(messageKey) {
  requestAnimationFrame(() => {
    const input = el.chatView?.querySelector(`[data-message-edit-input="${CSS.escape(encodeURIComponent(messageKey))}"]`);
    if (!input) return;
    input.focus();
    const length = input.value.length;
    input.setSelectionRange(length, length);
  });
}

function stopCurrentTts({ reset = true } = {}) {
  state.tts.playbackToken += 1;
  if (state.tts.currentAudio) {
    state.tts.currentAudio.pause();
    if (reset) state.tts.currentAudio.currentTime = 0;
  }
  if (state.tts.currentKey) clearChunkedTtsSession(state.tts.currentKey);
  if (reset) {
    state.tts.currentAudio = null;
    state.tts.currentKey = null;
    state.tts.currentPaused = false;
    state.tts.liveAutoplaySessions = {};
  }
  rerenderChatIfMounted();
}

function normalizeTtsRequestText(text) {
  return String(text || '')
    .replace(/\*([^*\n][\s\S]*?[^*\n])\*/g, ' ')
    .replace(/_([^_\n][\s\S]*?[^_\n])_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchTtsAudio({ characterId, text, stream = false }) {
  const normalizedText = normalizeTtsRequestText(text);
  if (!characterId) throw new Error('Character is required');
  if (!normalizedText) throw new Error('Text is required');
  const response = await fetch('./api/tts', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, text: normalizedText, stream }),
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.detail || json.error || `TTS failed (${response.status})`);
  }
  return response;
}

async function fetchTtsAudioBlob(options) {
  const response = await fetchTtsAudio(options);
  const emotionTag = String(response.headers.get('X-TTS-Emotion-Tag') || '').trim();
  const blob = await response.blob();
  return { blob, emotionTag };
}

function splitTtsTextIntoChunks(text, options = {}) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const maxChars = Math.max(40, Number(options.maxChars || 260));
  const slack = Math.max(0, Number(options.slack ?? 40));
  const chunks = [];
  let remainder = normalized;

  while (remainder.length > maxChars + slack) {
    let splitAt = -1;
    const punctuationMatches = [...remainder.slice(0, maxChars + 1).matchAll(/[.!?](?:["')\]]+)?(?=\s|$)/g)];
    if (punctuationMatches.length) {
      const last = punctuationMatches[punctuationMatches.length - 1];
      splitAt = last.index + last[0].length - 1;
    }
    if (splitAt < Math.floor(maxChars * 0.55)) splitAt = remainder.lastIndexOf(',', maxChars);
    if (splitAt < Math.floor(maxChars * 0.55)) splitAt = remainder.lastIndexOf(';', maxChars);
    if (splitAt < Math.floor(maxChars * 0.55)) splitAt = remainder.lastIndexOf(':', maxChars);
    if (splitAt < Math.floor(maxChars * 0.45)) splitAt = remainder.lastIndexOf(' ', maxChars);
    if (splitAt < Math.floor(maxChars * 0.35)) splitAt = maxChars;

    const piece = remainder.slice(0, splitAt + 1).trim();
    if (piece) chunks.push(piece);
    remainder = remainder.slice(splitAt + 1).trim();
  }

  if (remainder) chunks.push(remainder);
  return chunks.filter(Boolean);
}

function revokeTtsSessionUrls(session) {
  if (!session?.chunkObjectUrls?.length) return;
  for (const url of session.chunkObjectUrls) {
    try { URL.revokeObjectURL(url); } catch {}
  }
  session.chunkObjectUrls = [];
}

function clearChunkedTtsSession(key) {
  const session = state.tts.chunkedSessions[key];
  if (!session) return;
  revokeTtsSessionUrls(session);
  delete state.tts.chunkedSessions[key];
}

function getStreamingTtsKey(conversationId, messageIndex) {
  return `__stream_tts__:${conversationId}:${messageIndex}`;
}

function getLiveAutoplayReadyText(text, options = {}) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (options.final) return normalized;
  const matches = [...normalized.matchAll(/[.!?](?:["')\]]+)?(?=\s|$)/g)];
  const last = matches[matches.length - 1];
  if (!last) return '';
  return normalized.slice(0, last.index + last[0].length).trim();
}

async function runLiveAutoplayQueue(session) {
  if (!session || session.running) return;
  session.running = true;
  const playbackToken = session.playbackToken;

  try {
    while (state.tts.playbackToken === playbackToken) {
      const nextText = normalizeTtsRequestText(session.queue.shift());
      if (!nextText) continue;
      const { blob } = await fetchTtsAudioBlob({ characterId: session.characterId, text: nextText });
      if (state.tts.playbackToken !== playbackToken) break;

      const objectUrl = URL.createObjectURL(blob);
      try {
        const audio = new Audio(objectUrl);
        state.tts.currentAudio = audio;
        state.tts.currentKey = session.messageKey;
        state.tts.currentPaused = false;
        rerenderChatIfMounted();

        await new Promise((resolve, reject) => {
          audio.addEventListener('ended', resolve, { once: true });
          audio.addEventListener('error', () => reject(new Error('Audio playback failed')), { once: true });
          audio.play().catch(reject);
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }

      if (state.tts.playbackToken !== playbackToken) break;
      state.tts.currentAudio = null;
      state.tts.currentPaused = false;
      rerenderChatIfMounted();
    }
  } catch (error) {
    if (state.tts.playbackToken === playbackToken) {
      state.tts.currentAudio = null;
      state.tts.currentKey = null;
      state.tts.currentPaused = false;
      state.tts.lastErrorKey = session.messageKey;
      rerenderChatIfMounted();
    }
    throw error;
  } finally {
    session.running = false;
    if (!session.queue.length && state.tts.currentKey === session.messageKey) {
      state.tts.currentKey = null;
      state.tts.currentPaused = false;
      rerenderChatIfMounted();
    }
  }
}

function queueLiveAutoplayTts({ conversationId, characterId, messageKey, text, final = false }) {
  if (!conversationId || !characterId || !messageKey) return null;
  const readyText = getLiveAutoplayReadyText(text, { final });
  const existing = state.tts.liveAutoplaySessions[conversationId];
  const session = existing || {
    conversationId,
    characterId,
    messageKey,
    queue: [],
    emittedText: '',
    running: false,
    playbackToken: state.tts.playbackToken,
  };

  if (session.messageKey !== messageKey) {
    const previousKey = session.messageKey;
    session.messageKey = messageKey;
    if (state.tts.currentKey === previousKey) state.tts.currentKey = messageKey;
  }

  if (!state.tts.liveAutoplaySessions[conversationId] || state.tts.liveAutoplaySessions[conversationId] !== session) {
    state.tts.liveAutoplaySessions[conversationId] = session;
  }

  if (readyText && readyText.startsWith(session.emittedText)) {
    const deltaText = readyText.slice(session.emittedText.length).trim();
    if (deltaText) {
      session.queue.push(...splitTtsTextIntoChunks(deltaText, { maxChars: 90, slack: 0 }));
      session.emittedText = readyText;
    }
  } else if (readyText && readyText !== session.emittedText) {
    session.queue.push(...splitTtsTextIntoChunks(readyText, { maxChars: 90, slack: 0 }));
    session.emittedText = readyText;
  }

  if (final) {
    primeFullMessageTts({ characterId, text, key: messageKey }).catch(() => {});
  }

  if (session.queue.length && !session.running) {
    runLiveAutoplayQueue(session).catch((error) => console.error(error));
  }

  return session;
}

function isLongTtsText(text) {
  return splitTtsTextIntoChunks(text).length > 1;
}

function primeFullMessageTts({ characterId, text, key }) {
  const normalizedText = normalizeTtsRequestText(text);
  if (!characterId || !normalizedText || !key) return state.tts.fullAudioPromises[key] || null;
  if (state.tts.objectUrls[key]) return null;
  if (state.tts.fullAudioPromises[key]) return state.tts.fullAudioPromises[key];
  const promise = fetchTtsAudioBlob({ characterId, text: normalizedText })
    .then(({ blob, emotionTag }) => {
      if (emotionTag) state.tts.debugTags[key] = emotionTag;
      if (state.tts.objectUrls[key]) return state.tts.objectUrls[key];
      const objectUrl = URL.createObjectURL(blob);
      state.tts.objectUrls[key] = objectUrl;
      return objectUrl;
    })
    .finally(() => {
      delete state.tts.fullAudioPromises[key];
    });
  state.tts.fullAudioPromises[key] = promise;
  return promise;
}

async function playChunkedMessageTts({ characterId, text, key, chunks }) {
  const playbackToken = ++state.tts.playbackToken;
  clearChunkedTtsSession(key);
  const session = { playbackToken, chunkObjectUrls: [] };
  state.tts.chunkedSessions[key] = session;
  state.tts.currentKey = key;
  state.tts.currentPaused = false;

  let nextChunkPromise = null;
  const loadChunk = async (index) => {
    if (index >= chunks.length) return null;
    const chunkText = normalizeTtsRequestText(chunks[index]);
    if (!chunkText) return null;
    const { blob } = await fetchTtsAudioBlob({ characterId, text: chunkText });
    if (state.tts.playbackToken !== playbackToken) return null;
    const objectUrl = URL.createObjectURL(blob);
    session.chunkObjectUrls.push(objectUrl);
    return objectUrl;
  };

  try {
    let currentUrl = await loadChunk(0);
    if (!currentUrl) return;

    for (let index = 0; index < chunks.length; index += 1) {
      if (state.tts.playbackToken !== playbackToken) return;
      if (index + 1 < chunks.length && !nextChunkPromise) nextChunkPromise = loadChunk(index + 1);

      const audio = new Audio(currentUrl);
      state.tts.currentAudio = audio;
      state.tts.currentKey = key;
      state.tts.currentPaused = false;
      rerenderChatIfMounted();

      await new Promise((resolve, reject) => {
        audio.addEventListener('ended', resolve, { once: true });
        audio.addEventListener('error', () => reject(new Error('Audio playback failed')), { once: true });
        audio.play().catch(reject);
      });

      if (state.tts.playbackToken !== playbackToken) return;
      state.tts.currentAudio = null;
      state.tts.currentPaused = false;

      currentUrl = nextChunkPromise ? await nextChunkPromise : null;
      nextChunkPromise = null;
      if (!currentUrl && index + 1 < chunks.length) {
        continue;
      }
    }

    if (state.tts.playbackToken === playbackToken) {
      state.tts.currentAudio = null;
      state.tts.currentKey = null;
      state.tts.currentPaused = false;
      rerenderChatIfMounted();
    }
  } catch (error) {
    if (state.tts.playbackToken === playbackToken) {
      state.tts.currentAudio = null;
      state.tts.currentKey = null;
      state.tts.currentPaused = false;
      state.tts.lastErrorKey = key;
      rerenderChatIfMounted();
    }
    throw error;
  } finally {
    clearChunkedTtsSession(key);
  }
}

async function testCurrentCharacterVoice() {
  const character = getSelectedCharacter();
  if (!character) throw new Error('Choose a character first');
  const line = `${character.name}. Voice link check. If you can hear this, Fish Audio is working.`;
  const { blob } = await fetchTtsAudioBlob({ characterId: character.id, text: line });
  const objectUrl = URL.createObjectURL(blob);
  try {
    stopCurrentTts();
    const audio = new Audio(objectUrl);
    state.tts.currentAudio = audio;
    state.tts.currentKey = '__voice_test__';
    state.tts.currentPaused = false;
    audio.addEventListener('ended', () => {
      if (state.tts.currentAudio === audio) {
        state.tts.currentAudio = null;
        state.tts.currentKey = null;
        state.tts.currentPaused = false;
        rerenderChatIfMounted();
      }
      URL.revokeObjectURL(objectUrl);
    }, { once: true });
    audio.addEventListener('error', () => {
      if (state.tts.currentAudio === audio) {
        state.tts.currentAudio = null;
        state.tts.currentKey = null;
        state.tts.currentPaused = false;
      }
      URL.revokeObjectURL(objectUrl);
      rerenderChatIfMounted();
    }, { once: true });
    await audio.play();
    rerenderChatIfMounted();
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    state.tts.currentAudio = null;
    state.tts.currentKey = null;
    state.tts.currentPaused = false;
    rerenderChatIfMounted();
    throw error;
  }
}

async function streamAudioResponseToObjectUrl(response, key) {
  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  const reader = response.body?.getReader?.();
  if (!reader) return objectUrl;

  const session = { mediaSource, objectUrl, sourceBuffer: null, queue: [], done: false, failed: false };
  state.tts.mediaSourceSessions[key] = session;

  const appendNextChunk = () => {
    if (!session.sourceBuffer || session.sourceBuffer.updating) return;
    if (session.queue.length) {
      const chunk = session.queue.shift();
      try {
        session.sourceBuffer.appendBuffer(chunk);
      } catch (error) {
        session.failed = true;
        try { mediaSource.endOfStream('decode'); } catch {}
      }
      return;
    }
    if (session.done && mediaSource.readyState === 'open') {
      try { mediaSource.endOfStream(); } catch {}
    }
  };

  mediaSource.addEventListener('sourceopen', () => {
    if (session.sourceBuffer || mediaSource.readyState !== 'open') return;
    session.sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
    session.sourceBuffer.mode = 'sequence';
    session.sourceBuffer.addEventListener('updateend', appendNextChunk);
    appendNextChunk();
  }, { once: true });

  (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value?.length) {
          session.queue.push(value instanceof Uint8Array ? value : new Uint8Array(value));
          appendNextChunk();
        }
      }
      session.done = true;
      appendNextChunk();
    } catch {
      session.failed = true;
      try {
        if (mediaSource.readyState === 'open') mediaSource.endOfStream('network');
      } catch {}
    }
  })();

  return objectUrl;
}

async function playMessageTts(message, key) {
  const text = normalizeTtsRequestText(getMessageText(message));
  if (!text || !state.selectedCharacterId) return;

  if (state.tts.currentKey === key && state.tts.currentAudio) {
    if (state.tts.currentPaused) {
      await state.tts.currentAudio.play();
      state.tts.currentPaused = false;
    } else {
      state.tts.currentAudio.pause();
      state.tts.currentPaused = true;
    }
    rerenderChatIfMounted();
    return;
  }

  state.tts.lastErrorKey = null;
  stopCurrentTts();

  let objectUrl = state.tts.objectUrls[key];
  const playbackMode = getCharacterTtsPlaybackMode();
  const fastStartChunks = playbackMode === 'stream' ? splitTtsTextIntoChunks(text, { maxChars: 90, slack: 0 }) : [];
  const shouldChunk = playbackMode === 'stream' && !objectUrl && fastStartChunks.length > 1;

  if (shouldChunk) {
    state.tts.loadingKeys[key] = true;
    rerenderChatIfMounted();
    primeFullMessageTts({ characterId: state.selectedCharacterId, text, key }).catch(() => {});
    try {
      await playChunkedMessageTts({ characterId: state.selectedCharacterId, text, key, chunks: fastStartChunks });
    } finally {
      delete state.tts.loadingKeys[key];
      rerenderChatIfMounted();
    }
    return;
  }

  if (!objectUrl) {
    state.tts.loadingKeys[key] = true;
    rerenderChatIfMounted();
    try {
      const { blob, emotionTag } = await fetchTtsAudioBlob({ characterId: state.selectedCharacterId, text });
      if (emotionTag) state.tts.debugTags[key] = emotionTag;
      objectUrl = URL.createObjectURL(blob);
      state.tts.objectUrls[key] = objectUrl;
    } finally {
      delete state.tts.loadingKeys[key];
      rerenderChatIfMounted();
    }
  }

  try {
    const audio = new Audio(objectUrl);
    state.tts.currentAudio = audio;
    state.tts.currentKey = key;
    state.tts.currentPaused = false;
    audio.addEventListener('ended', () => {
      if (state.tts.currentAudio === audio) {
        state.tts.currentAudio = null;
        state.tts.currentKey = null;
        state.tts.currentPaused = false;
        rerenderChatIfMounted();
      }
    });
    audio.addEventListener('error', () => {
      if (state.tts.currentAudio === audio) {
        state.tts.currentAudio = null;
        state.tts.currentKey = null;
        state.tts.currentPaused = false;
        state.tts.lastErrorKey = key;
        rerenderChatIfMounted();
      }
    });
    await audio.play();
    rerenderChatIfMounted();
  } catch (error) {
    state.tts.currentAudio = null;
    state.tts.currentKey = null;
    state.tts.currentPaused = false;
    state.tts.lastErrorKey = key;
    rerenderChatIfMounted();
    throw error;
  }
}

function applyStreamedText(row, text) {
  const message = row?.querySelector('.message');
  if (message) message.innerHTML = renderImmersionText(text);
}

let scrollFrame = 0;
function scrollChatToBottom() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    el.chatView.scrollTop = el.chatView.scrollHeight;
  });
}

async function readEventStream(response, handlers = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const eventBlock of events) {
      let event = 'message';
      let data = '';
      for (const line of eventBlock.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        handlers[event]?.(JSON.parse(data));
      } catch {}
    }
  }
}

function applyCharacterBackground() {
  const bgId = state.selectedCharacterSettings?.background || '';
  const bg = state.bootstrap?.backgrounds?.find((item) => item.id === bgId);
  document.documentElement.style.setProperty('--chat-bg', bg ? `url("${bg.imageUrl}")` : 'none');
}

function updateComposerState() {
  const supportsImages = modelSupportsImages(getCharacterModel());
  const hasDraft = Boolean((el.input?.value || '').trim());
  const hasAttachments = state.pendingImages.length > 0;
  const sendReady = !state.isStreaming && (hasDraft || hasAttachments);
  el.imageBtnLabel.textContent = state.pendingImages.length ? `🖼 Upload (${state.pendingImages.length})` : '🖼 Upload';
  el.imageBtn.title = supportsImages
    ? (state.pendingImages.length ? `${state.pendingImages.length} image(s) queued` : 'Upload image')
    : 'Upload image (current model may not support vision, but you can still pick files)';
  el.send.disabled = Boolean(state.isStreaming);
  el.input.disabled = Boolean(state.isStreaming);
  el.imageBtn.disabled = Boolean(state.isStreaming);
  el.send.textContent = state.isStreaming ? (shouldUseStreamingChat() ? 'Streaming…' : 'Sending…') : 'Send';
  el.composer?.classList.toggle('has-draft', hasDraft);
  el.composer?.classList.toggle('has-attachments', hasAttachments);
  el.composer?.classList.toggle('is-busy', Boolean(state.isStreaming));
  el.send.classList.toggle('is-ready', sendReady);
  el.drawerHandle.classList.toggle('open', el.appShell.classList.contains('panel-open'));
}

function isBackgroundFavorite(id) {
  return (state.ui?.backgroundFavorites || []).includes(id);
}

async function toggleBackgroundFavorite(id) {
  const set = new Set(state.ui?.backgroundFavorites || []);
  set.has(id) ? set.delete(id) : set.add(id);
  state.ui = { ...(state.ui || {}), backgroundFavorites: [...set] };
  await api('./api/ui', { method: 'PUT', body: JSON.stringify({ backgroundFavorites: state.ui.backgroundFavorites }) });
  renderCharacterPanel();
}

async function toggleFavorite(id) {
  const set = new Set(state.favorites || []);
  set.has(id) ? set.delete(id) : set.add(id);
  state.favorites = [...set];
  await savePreferences({ favorites: state.favorites });
  renderCharacters();
}

function buildBackgroundCards() {
  const selectedBg = state.selectedCharacterSettings?.background || '';
  const bgSearch = (state.selectedCharacterSettings?.backgroundSearch || '').toLowerCase();
  const backgrounds = (state.bootstrap?.backgrounds || [])
    .filter((bg) => !bgSearch || bg.name.toLowerCase().includes(bgSearch))
    .sort((a, b) => Number(isBackgroundFavorite(b.id)) - Number(isBackgroundFavorite(a.id)) || a.name.localeCompare(b.name));

  if (!backgrounds.length) return '<div class="meta-line">No backgrounds match that search. Tragic.</div>';

  return backgrounds.slice(0, 24).map((bg) => `
    <div class="bg-option ${selectedBg === bg.id ? 'active' : ''}" data-bg="${bg.id}" role="button" tabindex="0">
      <img src="${bg.imageUrl}" alt="${bg.name}" />
      <span>${bg.name}</span>
      <button class="bg-favorite ${isBackgroundFavorite(bg.id) ? 'active' : ''}" data-bg-favorite="${bg.id}" title="Favorite background">★</button>
    </div>
  `).join('');
}

function syncConversationSelect() {
  el.conversationSelect.innerHTML = '';
  for (const convo of getCurrentConversationList()) {
    const option = document.createElement('option');
    option.value = convo.id;
    option.textContent = convo.name;
    el.conversationSelect.appendChild(option);
  }
  if (state.selectedConversationId) el.conversationSelect.value = state.selectedConversationId;
}

function filesToDataUrls(files) {
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, url: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

function updateCharacterAvatarPreview(src = '') {
  el.createCharacterAvatarPreview.src = src || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMzIwIiB2aWV3Qm94PSIwIDAgMzIwIDMyMCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIzMjAiIHJ4PSI2NCIgZmlsbD0iIzFkMjEzMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTIlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOWFhNWJjIiBmb250LXNpemU9IjI4IiBmb250LWZhbWlseT0iSW50ZXIsQXJpYWwiPk5vIGF2YXRhcjwvdGV4dD48L3N2Zz4=';
}

function openCreateCharacterDialog(prefill = {}, mode = 'create', editingCharacterId = null) {
  state.characterDialogMode = mode;
  state.editingCharacterId = editingCharacterId;
  el.characterCreateTitle.textContent = mode === 'edit' ? 'Edit character' : 'Create character';
  el.createCharacterSubmit.textContent = mode === 'edit' ? 'Save changes' : 'Create character';
  el.duplicateCharacterBtn.classList.toggle('hidden', mode !== 'edit');
  el.characterCreateForm.reset();
  el.createCharacterName.value = prefill.name || '';
  el.createCharacterDescription.value = prefill.description || '';
  el.createCharacterPersonality.value = prefill.personality || '';
  el.createCharacterScenario.value = prefill.scenario || '';
  el.createCharacterGreeting.value = prefill.first_mes || '';
  el.createCharacterTags.value = Array.isArray(prefill.tags) ? prefill.tags.join(', ') : '';
  el.createCharacterAvatar.required = mode !== 'edit' || !prefill.imageUrl;
  updateCharacterAvatarPreview(prefill.imageUrl || '');
  el.characterCreateDialog.showModal();
}

async function importCharacterToDialog(file) {
  const converted = await filesToDataUrls([file]);
  const json = await api('./api/characters/import', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, dataUrl: converted[0].url }),
  });
  const imported = json.imported || {};
  el.createCharacterName.value = imported.name || '';
  el.createCharacterDescription.value = imported.description || '';
  el.createCharacterPersonality.value = imported.personality || '';
  el.createCharacterScenario.value = imported.scenario || '';
  el.createCharacterGreeting.value = imported.first_mes || '';
  el.createCharacterTags.value = Array.isArray(imported.tags) ? imported.tags.join(', ') : '';
}

async function createCharacterFromDialog() {
  const avatarFile = el.createCharacterAvatar.files?.[0] || null;
  const avatarDataUrl = avatarFile ? (await filesToDataUrls([avatarFile]))[0]?.url : '';
  const hasExistingAvatar = !!(el.createCharacterAvatarPreview?.src && !el.createCharacterAvatarPreview.src.includes('NoIGF2YXRhcg'));
  if (!avatarDataUrl && !hasExistingAvatar) {
    throw new Error('Avatar image is required');
  }
  const payload = {
    name: el.createCharacterName.value.trim(),
    description: el.createCharacterDescription.value.trim(),
    personality: el.createCharacterPersonality.value.trim(),
    scenario: el.createCharacterScenario.value.trim(),
    first_mes: el.createCharacterGreeting.value.trim(),
    avatarDataUrl,
    tags: el.createCharacterTags.value.split(',').map((item) => item.trim()).filter(Boolean),
  };
  el.createCharacterSubmit.disabled = true;
  el.createCharacterSubmit.textContent = state.characterDialogMode === 'edit' ? 'Saving…' : 'Creating…';
  try {
    const json = await api(state.characterDialogMode === 'edit' ? `./api/characters/${encodeURIComponent(state.editingCharacterId)}` : './api/characters', {
      method: state.characterDialogMode === 'edit' ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    await refreshBootstrapPreserveSelection();
    state.selectedCharacterId = json.character.id;
    state.selectedConversationId = null;
    el.characterCreateForm.reset();
    el.characterCreateDialog.close();
    await hydrateSelectedWorkspace({ keepSelection: true });
  } finally {
    el.createCharacterSubmit.disabled = false;
    el.createCharacterSubmit.textContent = state.characterDialogMode === 'edit' ? 'Save changes' : 'Create character';
  }
}

async function loadProviderConfig() {
  if (!isAdmin()) return null;
  state.providerConfig = await api('./api/config/providers');
  el.providerOpenaiKey.value = '';
  el.providerOpenrouterKey.value = '';
  el.providerAnthropicKey.value = '';
  el.providerGeminiKey.value = '';
  el.providerXaiKey.value = '';
  return state.providerConfig;
}

async function saveProviderSettings() {
  if (!isAdmin()) return;
  state.providerConfig = await api('./api/config/providers', {
    method: 'PUT',
    body: JSON.stringify({
      openai: { apiKey: el.providerOpenaiKey.value.trim() },
      openrouter: { apiKey: el.providerOpenrouterKey.value.trim() },
      anthropic: { apiKey: el.providerAnthropicKey.value.trim() },
      gemini: { apiKey: el.providerGeminiKey.value.trim() },
      xai: { apiKey: el.providerXaiKey.value.trim() },
    }),
  });
  await loadProviderConfig();
  el.providerSettingsDialog.close();
}

async function saveEndpointSettings() {
  if (!isAdmin()) return;
  const fallbackProvider1 = el.endpointFallbackProvider1.value || 'local';
  const fallbackProvider2 = el.endpointFallbackProvider2.value || 'local';
  const localProfiles = el.endpointLocalProfiles.value.split('\n').map((line, index) => {
    const [label, baseUrl] = line.split('|').map((part) => part.trim());
    if (!label || !baseUrl) return null;
    return { id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `local-${index + 1}`, label, baseUrl };
  }).filter(Boolean);
  const activeLocalProfileId = el.endpointActiveLocalProfile.value || localProfiles[0]?.id || 'primary-local';
  const activeLocalProfile = localProfiles.find((profile) => profile.id === activeLocalProfileId) || localProfiles[0] || null;
  state.appConfig.endpoints = await api('./api/config/endpoints', {
    method: 'PUT',
    body: JSON.stringify({
      localProfiles,
      activeLocalProfileId,
      localBaseUrl: activeLocalProfile?.baseUrl || el.endpointLocalBaseUrl.value.trim(),
      providerLabel: el.endpointProviderLabel.value.trim(),
      defaultModel: el.endpointDefaultModel.value.trim(),
      mainModel: el.endpointMainModel.value,
      fallbackProvider1,
      fallbackModel1: el.endpointFallbackModel1.value,
      fallbackOverride1: {
        enabled: Boolean(el.endpointFallbackOverrideModel1.value.trim() || el.endpointFallbackOverrideBase1.value.trim() || el.endpointFallbackOverrideProvider1.value.trim() || el.endpointFallbackOverrideKey1.value.trim()),
        provider: el.endpointFallbackOverrideProvider1.value.trim(),
        baseUrl: el.endpointFallbackOverrideBase1.value.trim(),
        model: el.endpointFallbackOverrideModel1.value.trim(),
        apiKey: el.endpointFallbackOverrideKey1.value.trim(),
      },
      fallbackProvider2,
      fallbackModel2: el.endpointFallbackModel2.value,
      fallbackOverride2: {
        enabled: Boolean(el.endpointFallbackOverrideModel2.value.trim() || el.endpointFallbackOverrideBase2.value.trim() || el.endpointFallbackOverrideProvider2.value.trim() || el.endpointFallbackOverrideKey2.value.trim()),
        provider: el.endpointFallbackOverrideProvider2.value.trim(),
        baseUrl: el.endpointFallbackOverrideBase2.value.trim(),
        model: el.endpointFallbackOverrideModel2.value.trim(),
        apiKey: el.endpointFallbackOverrideKey2.value.trim(),
      },
      requestTimeoutMs: Number(el.endpointRequestTimeout.value || 120000),
    }),
  });

  const providerPatch = {};
  if (fallbackProvider1 !== 'local' && el.endpointFallbackKey1.value.trim()) providerPatch[fallbackProvider1] = { apiKey: el.endpointFallbackKey1.value.trim() };
  if (fallbackProvider2 !== 'local' && el.endpointFallbackKey2.value.trim()) providerPatch[fallbackProvider2] = { ...(providerPatch[fallbackProvider2] || {}), apiKey: el.endpointFallbackKey2.value.trim() };
  if (Object.keys(providerPatch).length) state.providerConfig = await api('./api/config/providers', { method: 'PUT', body: JSON.stringify(providerPatch) });

  el.endpointFallbackKey1.value = '';
  el.endpointFallbackKey2.value = '';
  el.endpointFallbackOverrideKey1.value = '';
  el.endpointFallbackOverrideKey2.value = '';
  state.selectedModel = state.appConfig.endpoints.mainModel || state.appConfig.endpoints.defaultModel;
  await refreshBootstrapPreserveSelection();
  await pollModels();
  applySettings();
}

const saveCharacterSettingsDebounced = debounce(async (patch) => {
  if (!state.selectedCharacterId) return;
  state.selectedCharacterSettings = await api(`./api/character/${encodeURIComponent(state.selectedCharacterId)}/settings`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  applyCharacterBackground();
  updateHeader();
  renderRecentChats();
}, 250);

const saveAppUiSettingsDebounced = debounce(async (patch) => {
  state.appUi = await api('./api/config/ui', { method: 'PUT', body: JSON.stringify(patch) });
  applySettings();
}, 250);

async function loadCharacterSettings() {
  const characterId = state.selectedCharacterId;
  if (!characterId) {
    state.selectedCharacterSettings = null;
    return null;
  }
  const settings = await api(`./api/character/${encodeURIComponent(characterId)}/settings`);
  if (characterId !== state.selectedCharacterId) return state.selectedCharacterSettings;
  state.selectedCharacterSettings = settings;
  return state.selectedCharacterSettings;
}

async function loadConversations() {
  const selection = getCurrentSelectionBucket();
  if (!selection.characterId) {
    state.currentConversationList = [];
    return [];
  }
  const params = new URLSearchParams({ characterId: selection.characterId, personaId: selection.personaId });
  const json = await api(`./api/conversations?${params.toString()}`);
  if (!isSameSelectionBucket(selection)) return state.currentConversationList;
  state.currentConversationList = json.conversations || [];
  if (!state.currentConversationList.find((item) => item.id === state.selectedConversationId)) {
    state.selectedConversationId = state.currentConversationList[0]?.id || null;
  }
  syncRecentConversationsFromCurrentList();
  syncConversationSelect();
  return state.currentConversationList;
}

async function ensureConversation(preferredName = null) {
  const selection = getCurrentSelectionBucket();
  await loadConversations();
  if (!isSameSelectionBucket(selection)) return null;
  const selected = getSelectedConversation();
  if (selected) return selected;
  if (state.currentConversationList.length) {
    state.selectedConversationId = state.currentConversationList[0]?.id || null;
    if (state.selectedConversationId) {
      await savePreferences({ session: { activeConversationId: state.selectedConversationId || '' } });
      return getSelectedConversation() || state.currentConversationList[0] || null;
    }
  }
  const created = await api('./api/conversations', {
    method: 'POST',
    body: JSON.stringify({ characterId: selection.characterId, personaId: selection.personaId, name: preferredName || 'New chat' }),
  });
  if (!isSameSelectionBucket(selection)) return created.conversation || null;
  state.selectedConversationId = created.conversation.id;
  state.currentConversationList = [created.conversation, ...(state.currentConversationList || []).filter((item) => item.id !== created.conversation.id)];
  syncRecentConversationsFromCurrentList();
  syncConversationSelect();
  await savePreferences({ session: { activeConversationId: state.selectedConversationId || '' } });
  return created.conversation;
}

async function fetchConversation(id = state.selectedConversationId) {
  const selection = getCurrentSelectionBucket();
  if (!id || !selection.characterId) return null;
  const params = new URLSearchParams({ characterId: selection.characterId, personaId: selection.personaId });
  const json = await api(`./api/conversations/${encodeURIComponent(id)}?${params.toString()}`);
  return json.conversation;
}

async function updateConversation(id, patch) {
  const json = await api(`./api/conversations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ characterId: state.selectedCharacterId, personaId: state.selectedPersonaId || '', ...patch }),
  });
  await loadConversations();
  return json.conversation;
}

async function deleteConversation(id) {
  const params = new URLSearchParams({ characterId: state.selectedCharacterId, personaId: state.selectedPersonaId || '' });
  await api(`./api/conversations/${encodeURIComponent(id)}?${params.toString()}`, { method: 'DELETE' });
  await loadConversations();
  if (!state.selectedConversationId) await ensureConversation();
}

async function renderChat() {
  const selection = getCurrentSelectionBucket();
  const character = getSelectedCharacter();
  if (!character) {
    clearRenderedChatState();
    el.chatView.innerHTML = `
      <div class="empty-state premium-empty-state">
        <div class="empty-state-icon">⚡️</div>
        <h2>No Active Connection</h2>
        <p>Pick a character from the library or resume a recent chat to begin a session.</p>
        <div class="empty-actions">
          <button id="premium-empty-library-btn" class="primary">Browse Library</button>
        </div>
      </div>`;
    
    // Defer attaching event listener until DOM updates
    setTimeout(() => {
      document.getElementById('premium-empty-library-btn')?.addEventListener('click', openLibraryPage);
    }, 0);
    return;
  }

  if (!state.selectedConversationId) await ensureConversation();
  if (!isSameSelectionBucket(selection)) return;
  const conversationId = state.selectedConversationId;
  const conversation = await fetchConversation(conversationId);
  if (!isSameSelectionBucket(selection) || conversationId !== state.selectedConversationId) return;
  const messages = conversation?.messages || [];
  const nextSignatures = messages.map((message, index) => getMessageSignature(message, index));
  const sameConversation = state.renderedConversationId === state.selectedConversationId;
  const prefixMatches = sameConversation
    && state.renderedChatSignatures.length <= nextSignatures.length
    && state.renderedChatSignatures.every((signature, index) => signature === nextSignatures[index]);

  if (messages.length === 0) {
    clearRenderedChatState();
    el.chatView.innerHTML = `
      <div class="empty-state">
        <div class="eyebrow">Ready when you are</div>
        <h2>${character.name}</h2>
        <p>${character.summary || 'Ready to chat.'}</p>
        ${character.first_mes ? `<p><strong>Starter:</strong> ${escapeHtml(replaceCharacterPlaceholdersClient(character.first_mes, character))}</p>` : ''}
        <div class="empty-actions">
          <button id="start-with-greeting">Use greeting</button>
          <button id="focus-composer" class="secondary">Write my own opener</button>
        </div>
      </div>`;

    document.getElementById('start-with-greeting')?.addEventListener('click', async () => {
      const initial = replaceCharacterPlaceholdersClient(character.first_mes || `Hello. I'm ${character.name}.`, character);
      await updateConversation(state.selectedConversationId, { messages: [{ role: 'assistant', content: initial }] });
      await hydrateSelectedWorkspace({ keepSelection: true, skipCharacterList: true });
    });
    document.getElementById('focus-composer')?.addEventListener('click', () => el.input.focus());
    return;
  }

  if (prefixMatches) {
    for (let index = state.renderedChatSignatures.length; index < messages.length; index += 1) {
      el.chatView.appendChild(renderMessage(messages[index], { index, totalMessages: messages.length }));
    }
    state.renderedChatSignatures = nextSignatures;
    state.renderedConversationId = state.selectedConversationId;
    scrollChatToBottom();
    return;
  }

  el.chatView.innerHTML = '';
  for (const [index, message] of messages.entries()) el.chatView.appendChild(renderMessage(message, { animate: false, index, totalMessages: messages.length }));
  state.renderedChatSignatures = nextSignatures;
  state.renderedConversationId = state.selectedConversationId;
  scrollChatToBottom();
}

function renderCharacterPanel() {
  const character = getSelectedCharacter();
  if (!character) {
    el.characterPanelContent.innerHTML = '<div class="info-card">Pick a character to see settings.</div>';
    return;
  }

  const convoList = getCurrentConversationList();
  const modelOptions = state.models.map((m) => `<option value="${m.id}" ${state.selectedCharacterSettings?.modelOverride === m.id ? 'selected' : ''}>${m.label}</option>`).join('');
  const conversationItems = convoList.map((c) => `
    <div class="conversation-item ${c.id === state.selectedConversationId ? 'active' : ''}" data-convo="${c.id}">
      <div class="conversation-copy">
        <div class="name">${c.name}</div>
        <div class="desc clamp-2">${c.preview || 'Empty chat'}</div>
      </div>
      <div class="conversation-actions">
        <button data-rename="${c.id}" class="mini-btn">Rename</button>
        <button data-delete="${c.id}" class="mini-btn danger">Delete</button>
      </div>
    </div>
  `).join('');

  const temp = getCharacterTemperature();
  const voiceSearch = getVoiceSearchState();
  el.characterPanelContent.innerHTML = `
    <img class="character-hero" src="${character.imageUrl}" alt="${character.name}" />

    <section class="info-card">
      <div class="section-head section-head-split">
        <div>
          <div class="eyebrow">Character overview</div>
          <h3>${character.name}</h3>
        </div>
        <div class="dialog-inline-actions">
          ${character.source === 'local' ? '<button id="edit-local-character" class="mini-btn">Edit</button><button id="export-local-character" class="mini-btn">Export</button><button id="delete-local-character" class="mini-btn danger">Delete</button>' : ''}
          <button id="duplicate-current-character" class="mini-btn">Duplicate</button>
        </div>
      </div>
      <div class="meta-line">${character.summary || 'Ready to chat.'}</div>
      ${(character.tags || []).length ? `<div class="tag-row">${character.tags.map((tag) => `<span class="tag-pill">${tag}</span>`).join('')}</div>` : ''}
      <div class="overview-grid">
        <div>
          <div class="mini-label">Scenario</div>
          <div class="meta-line clamp-3">${character.scenario || 'No scenario set.'}</div>
        </div>
        <div>
          <div class="mini-label">Greeting</div>
          <div class="meta-line clamp-3">${escapeHtml(replaceCharacterPlaceholdersClient(character.first_mes || 'No greeting set.', character))}</div>
        </div>
      </div>
    </section>

    <section class="info-card">
      <div class="section-head">
        <div>
          <div class="eyebrow">Private notes</div>
          <h3>Workspace notes</h3>
        </div>
      </div>
      <textarea id="character-notes" rows="5" placeholder="Private notes for this character...">${state.selectedCharacterSettings?.notes || ''}</textarea>
    </section>

    <section class="info-card">
      <div class="section-head">
        <div>
          <div class="eyebrow">Chat settings</div>
          <h3>Model + temperature</h3>
        </div>
      </div>
      <label class="field">
        <span>Model override</span>
        <select id="character-model-override">
          <option value="">Use global model</option>
          ${modelOptions}
        </select>
      </label>
      <label class="field">
        <span>Temperature <strong id="temp-value">${temp.toFixed(2)}</strong></span>
        <input id="character-temperature" type="range" min="0.2" max="1.4" step="0.05" value="${temp}" />
      </label>
    </section>

    <section class="info-card">
      <div class="section-head">
        <div>
          <div class="eyebrow">Voice</div>
          <h3>Fish Audio</h3>
        </div>
      </div>
      <label class="field">
        <span>Voice label</span>
        <input id="character-voice-label" value="${escapeHtml(state.selectedCharacterSettings?.voiceLabel || '')}" placeholder="Main voice" />
      </label>
      <div class="meta-line ${state.selectedCharacterSettings?.voiceMatchReason ? '' : 'hidden'}" id="character-voice-match-reason">
        ${escapeHtml(state.selectedCharacterSettings?.voiceMatchReason ? `Recommended: ${state.selectedCharacterSettings.voiceMatchReason}` : '')}
      </div>
      <label class="field">
        <span>Fish reference ID</span>
        <input id="character-fish-reference-id" value="${escapeHtml(state.selectedCharacterSettings?.fishReferenceId || '')}" placeholder="Paste Fish voice/reference id" />
      </label>
      <label class="field">
        <span>Find voice by name</span>
        <div class="voice-search-toolbar">
          <input id="character-voice-search" value="${escapeHtml(voiceSearch.query || '')}" placeholder="Search Fish voices by name" />
          <button id="character-voice-search-btn" class="secondary" type="button">Search</button>
          <button id="character-auto-voice" class="secondary" type="button">Match character</button>
        </div>
      </label>
      <button id="character-rematch-all-voices" class="secondary wide-btn" type="button">Refresh all legacy defaults</button>
      <div id="character-voice-search-status" class="meta-line ${voiceSearch.loading || voiceSearch.error || voiceSearch.searched ? '' : 'hidden'}"></div>
      <div id="character-voice-results" class="voice-search-results"></div>
      <label class="field">
        <span>Playback mode</span>
        <select id="character-tts-playback-mode">
          <option value="stream" ${getCharacterTtsPlaybackMode() === 'stream' ? 'selected' : ''}>Stream immediately</option>
          <option value="full" ${getCharacterTtsPlaybackMode() === 'full' ? 'selected' : ''}>Wait for full audio</option>
        </select>
      </label>
      <div class="meta-line">Default is streaming. Switch to full if you want Fish Audio to finish generating before playback starts.</div>
      <button id="character-test-voice" class="secondary wide-btn" type="button">Test voice</button>
      <div id="character-test-voice-status" class="meta-line hidden"></div>
    </section>

    <section class="info-card">
      <div class="section-head section-head-split">
        <div>
          <div class="eyebrow">Conversations</div>
          <h3>Named chats</h3>
        </div>
        <button id="new-conversation-panel" class="secondary">New</button>
      </div>
      <div class="conversation-list">${conversationItems || '<div class="meta-line">No chats yet. Extremely fixable.</div>'}</div>
    </section>

    <section class="info-card">
      <div class="section-head">
        <div>
          <div class="eyebrow">Backgrounds</div>
          <h3>Scene picker</h3>
        </div>
      </div>
      <label class="field">
        <span>Search backgrounds</span>
        <input id="background-search" value="${state.selectedCharacterSettings?.backgroundSearch || ''}" placeholder="Search backgrounds" />
      </label>
      <div class="background-thumb-grid">${buildBackgroundCards()}</div>
    </section>
  `;

  el.characterPanelContent.querySelector('#character-notes')?.addEventListener('input', (e) => {
    state.selectedCharacterSettings.notes = e.target.value;
    saveCharacterSettingsDebounced({ notes: e.target.value });
  });

  el.characterPanelContent.querySelector('#character-model-override')?.addEventListener('change', async (e) => {
    state.selectedCharacterSettings.modelOverride = e.target.value || '';
    state.selectedCharacterSettings = await api(`./api/character/${encodeURIComponent(state.selectedCharacterId)}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ modelOverride: e.target.value || '' }),
    });
    updateHeader();
    pollModels();
  });

  el.characterPanelContent.querySelector('#character-temperature')?.addEventListener('input', (e) => {
    const value = Number(e.target.value);
    state.selectedCharacterSettings.temperature = value;
    el.characterPanelContent.querySelector('#temp-value').textContent = value.toFixed(2);
    saveCharacterSettingsDebounced({ temperature: value });
  });

  el.characterPanelContent.querySelector('#character-voice-label')?.addEventListener('input', (e) => {
    state.selectedCharacterSettings.voiceLabel = e.target.value;
    saveCharacterSettingsDebounced({ voiceLabel: e.target.value });
  });

  el.characterPanelContent.querySelector('#character-fish-reference-id')?.addEventListener('input', (e) => {
    state.selectedCharacterSettings.fishReferenceId = e.target.value;
    saveCharacterSettingsDebounced({ fishReferenceId: e.target.value, ttsProvider: 'fish' });
    updateTtsStatusButton();
    rerenderChatIfMounted();
  });

  el.characterPanelContent.querySelector('#character-tts-playback-mode')?.addEventListener('change', (e) => {
    state.selectedCharacterSettings.ttsPlaybackMode = e.target.value || 'stream';
    saveCharacterSettingsDebounced({ ttsPlaybackMode: state.selectedCharacterSettings.ttsPlaybackMode });
  });

  el.characterPanelContent.querySelector('#character-test-voice')?.addEventListener('click', async () => {
    const status = el.characterPanelContent.querySelector('#character-test-voice-status');
    if (status) {
      status.textContent = 'Generating voice sample…';
      status.classList.remove('hidden');
    }
    try {
      await testCurrentCharacterVoice();
      if (status) status.textContent = 'Voice sample playing.';
    } catch (error) {
      if (status) status.textContent = `Voice test failed: ${error.message}`;
    }
  });

  el.characterPanelContent.querySelector('#character-voice-search')?.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const query = event.target.value.trim();
    if (!query) return;
    await searchFishVoices(query);
  });

  el.characterPanelContent.querySelector('#character-voice-search-btn')?.addEventListener('click', async () => {
    const query = el.characterPanelContent.querySelector('#character-voice-search')?.value?.trim() || '';
    await searchFishVoices(query || getSelectedCharacter()?.name || '');
  });

  el.characterPanelContent.querySelector('#character-auto-voice')?.addEventListener('click', async () => {
    const query = getSelectedCharacter()?.name || el.characterPanelContent.querySelector('#character-voice-search')?.value?.trim() || '';
    await searchFishVoices(query, { limit: 6 });
    const match = getVoiceSearchState().bestMatch;
    if (!match?._id) return;
    await applyFishVoiceSelection(String(match._id || ''), String(match.title || query));
  });

  el.characterPanelContent.querySelector('#character-rematch-all-voices')?.addEventListener('click', async () => {
    await rematchAllLegacyVoices();
  });

  el.characterPanelContent.querySelector('#character-voice-results')?.addEventListener('click', async (event) => {
    const previewButton = event.target.closest('[data-voice-preview]');
    if (previewButton) {
      event.preventDefault();
      await toggleVoicePreview(previewButton.dataset.voicePreview || '');
      return;
    }
    const button = event.target.closest('[data-voice-pick]');
    if (!button) return;
    await applyFishVoiceSelection(button.dataset.voicePick || '', button.dataset.voiceLabel || '');
  });

  el.characterPanelContent.querySelector('#background-search')?.addEventListener('input', (e) => {
    state.selectedCharacterSettings.backgroundSearch = e.target.value;
    saveCharacterSettingsDebounced({ backgroundSearch: e.target.value });
    renderCharacterPanel();
  });

  el.characterPanelContent.querySelectorAll('[data-bg]').forEach((node) => node.addEventListener('click', async (event) => {
    if (event.target.closest('[data-bg-favorite]')) return;
    const bg = node.dataset.bg;
    state.selectedCharacterSettings.background = bg;
    state.selectedCharacterSettings = await api(`./api/character/${encodeURIComponent(state.selectedCharacterId)}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ background: bg }),
    });
    applyCharacterBackground();
    renderCharacterPanel();
  }));

  el.characterPanelContent.querySelectorAll('[data-bg-favorite]').forEach((node) => node.addEventListener('click', async (event) => {
    event.stopPropagation();
    await toggleBackgroundFavorite(node.dataset.bgFavorite);
  }));

  el.characterPanelContent.querySelector('#edit-local-character')?.addEventListener('click', async () => {
    const json = await api(`./api/characters/${encodeURIComponent(character.id)}`);
    openCreateCharacterDialog({ ...json.character, imageUrl: character.imageUrl }, 'edit', character.id);
  });

  el.characterPanelContent.querySelector('#export-local-character')?.addEventListener('click', () => window.open(`./api/characters/${encodeURIComponent(character.id)}/export`, '_blank'));

  el.characterPanelContent.querySelector('#delete-local-character')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${character.name}?`)) return;
    await api(`./api/characters/${encodeURIComponent(character.id)}`, { method: 'DELETE' });
    await refreshBootstrapPreserveSelection();
    state.selectedCharacterId = state.bootstrap.characters[0]?.id || null;
    state.selectedConversationId = null;
    await hydrateSelectedWorkspace({ keepSelection: true });
  });

  el.characterPanelContent.querySelector('#duplicate-current-character')?.addEventListener('click', () => {
    openCreateCharacterDialog({
      name: `${character.name} Copy`,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      first_mes: character.first_mes,
      tags: character.tags || [],
      imageUrl: character.imageUrl,
    }, 'create');
  });

  el.characterPanelContent.querySelector('#new-conversation-panel')?.addEventListener('click', async () => {
    const name = prompt('Name this chat:', `Chat ${getCurrentConversationList().length + 1}`);
    const created = await api('./api/conversations', {
      method: 'POST',
      body: JSON.stringify({ characterId: state.selectedCharacterId, personaId: state.selectedPersonaId || '', name: name || undefined }),
    });
    state.selectedConversationId = created.conversation.id;
    await savePreferences({ session: { activeConversationId: state.selectedConversationId } });
    await hydrateSelectedWorkspace();
  });

  el.characterPanelContent.querySelectorAll('[data-convo]').forEach((node) => node.addEventListener('click', async (e) => {
    if (e.target.closest('[data-rename]') || e.target.closest('[data-delete]')) return;
    state.selectedConversationId = node.dataset.convo;
    await savePreferences({ session: { activeConversationId: state.selectedConversationId } });
    renderCharacterPanel();
    await renderChat();
    updateHeader();
    syncConversationSelect();
  }));

  el.characterPanelContent.querySelectorAll('[data-rename]').forEach((node) => node.addEventListener('click', async (e) => {
    e.stopPropagation();
    const current = getCurrentConversationList().find((c) => c.id === node.dataset.rename);
    const name = prompt('Rename chat:', current?.name || 'Chat');
    if (!name) return;
    await updateConversation(node.dataset.rename, { name });
    renderCharacterPanel();
    updateHeader();
    syncConversationSelect();
  }));

  el.characterPanelContent.querySelectorAll('[data-delete]').forEach((node) => node.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;
    await deleteConversation(node.dataset.delete);
    await savePreferences({ session: { activeConversationId: state.selectedConversationId || '' } });
    renderCharacterPanel();
    await renderChat();
    updateHeader();
    syncConversationSelect();
  }));

  renderVoiceSearchResults();
}

async function savePreferences(patch) {
  const json = await api('./api/preferences', { method: 'PUT', body: JSON.stringify(patch) });
  state.favorites = json.favorites || state.favorites;
  state.sessionPrefs = json.session || state.sessionPrefs;
  return json;
}

async function refreshBootstrapPreserveSelection() {
  const bootstrap = await api('./api/bootstrap');
  state.bootstrap = bootstrap;
  state.authUser = bootstrap.user;
  state.ui = bootstrap.ui || { backgroundFavorites: [] };
  state.appUi = bootstrap.appUi || state.appUi;
  state.sessionPrefs = bootstrap.session || state.sessionPrefs;
  state.favorites = bootstrap.favorites || state.favorites;
  state.appConfig = bootstrap.appConfig || state.appConfig;
  applyAdminVisibility();
  syncMobileLibraryNav();
}

async function hydrateSelectedWorkspace(options = {}) {
  await loadCharacterSettings();
  await ensureConversation();
  renderFilters();
  renderLibraryTabs();
  renderCharacterCount();
  renderFeatured();
  renderCharacters();
  renderPersonas();
  renderModels();
  renderRecentChats();
  syncConversationSelect();
  updateHeader();
  renderCharacterPanel();
  applyCharacterBackground();
  updateComposerState();
  await renderChat();
  await loadMemoryBundle().catch(() => {
    state.memoryBundle = null;
    renderMemoryPanel();
  });
  if (!options.keepSelection) {
    await savePreferences({ session: { activeCharacterId: state.selectedCharacterId || '', activeConversationId: state.selectedConversationId || '', activePersonaId: state.selectedPersonaId || '' } });
  }
}

async function loadBootstrap() {
  await refreshBootstrapPreserveSelection();
  state.selectedCharacterId = state.sessionPrefs.activeCharacterId || state.bootstrap.characters[0]?.id || null;
  state.selectedPersonaId = state.sessionPrefs.activePersonaId || state.bootstrap.personas.find((p) => p.isDefault)?.id || state.bootstrap.personas[0]?.id || null;
  state.selectedConversationId = state.sessionPrefs.activeConversationId || null;
  state.selectedModel = state.appConfig?.endpoints?.mainModel || state.bootstrap.defaultModel;
  state.models = [{ id: state.bootstrap.defaultModel, label: state.bootstrap.defaultModel }];
  applySettings(getUiSettings());
  el.appShell.classList.toggle('panel-open', state.sessionPrefs.panelOpen !== false);
  closeLibraryPage();
  await hydrateSelectedWorkspace({ keepSelection: true });
}

let pollingModels = false;
async function pollModels() {
  if (pollingModels || document.hidden) return;
  pollingModels = true;
  try {
    const json = await api('./api/models');
    state.backendReachable = !!json.backendReachable;
    state.models = json.models || [{ id: state.bootstrap.defaultModel, label: state.bootstrap.defaultModel }];
    if (!state.models.find((m) => m.id === state.selectedModel)) state.selectedModel = state.models[0]?.id || state.bootstrap.defaultModel;
    renderModels();
    renderCharacterPanel();
    setBackendStatus(json.backendReachable
      ? `${state.bootstrap.providerLabel} backend online • ${getCharacterModel()}${state.selectedCharacterSettings?.modelOverride ? ' (character override)' : ''}`
      : `${state.bootstrap.providerLabel} backend offline • model list will retry automatically`,
    !!json.backendReachable);
  } catch {
    state.backendReachable = false;
    setBackendStatus(`${state.bootstrap?.providerLabel || 'Backend'} offline • model list will retry automatically`, false);
  } finally {
    pollingModels = false;
  }
}

async function sendMessage() {
  if (state.isStreaming) return;
  closeMessageActions();
  const selection = getCurrentSelectionBucket();
  const text = el.input.value.trim();
  if ((!text && state.pendingImages.length === 0) || !selection.characterId) return;
  await ensureConversation();
  if (!isSameSelectionBucket(selection) || !state.selectedConversationId) return;
  const conversationId = state.selectedConversationId;
  const conversation = await fetchConversation(conversationId);
  if (!isSameSelectionBucket(selection) || conversationId !== state.selectedConversationId) return;
  const userMessage = { role: 'user', content: text };
  if (state.pendingImages.length) userMessage.images = [...state.pendingImages];
  const messages = [...(conversation?.messages || []), userMessage];
  await updateConversation(conversationId, { messages });
  await renderChat();
  el.input.value = '';
  state.pendingImages = [];
  el.imageInput.value = '';
  updateComposerState();

  state.isStreaming = true;
  updateComposerState();
  const typingRow = renderMessage({ role: 'assistant', content: state.backendReachable ? 'Thinking…' : 'Backend is offline. I will still try once.' });
  typingRow.classList.add('streaming-row');
  el.chatView.appendChild(typingRow);
  scrollChatToBottom();

  try {
    const useStreaming = shouldUseStreamingChat();
    const response = await fetch('./api/chat', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId: state.selectedCharacterId,
        personaId: state.selectedPersonaId,
        conversationId: state.selectedConversationId,
        model: getCharacterModel(),
        temperature: getCharacterTemperature(),
        messages,
        stream: useStreaming,
      }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      typingRow.remove();
      await updateConversation(state.selectedConversationId, { messages: [...messages, { role: 'system', content: json.detail || json.error || 'Backend unavailable.' }] });
      await hydrateSelectedWorkspace({ keepSelection: true, skipCharacterList: true });
      return;
    }

    let streamedText = '';
    let streamError = '';

    if (useStreaming && response.body) {
      let pendingStreamText = '';
      let streamFrame = 0;
      const scheduleStreamUpdate = (textValue) => {
        pendingStreamText = textValue;
        if (streamFrame) return;
        streamFrame = requestAnimationFrame(() => {
          streamFrame = 0;
          applyStreamedText(typingRow, pendingStreamText);
          scrollChatToBottom();
        });
      };
      await readEventStream(response, {
        delta: ({ delta }) => {
          if (!streamedText) applyStreamedText(typingRow, '');
          streamedText += delta || '';
          scheduleStreamUpdate(streamedText);
          if (getCharacterAutoplayVoiceEnabled() && characterHasVoice() && state.selectedConversationId === conversationId) {
            const liveAssistantKey = getStreamingTtsKey(conversationId, messages.length);
            state.tts.lastStreamedAssistantKey = liveAssistantKey;
            queueLiveAutoplayTts({
              conversationId,
              characterId: state.selectedCharacterId,
              messageKey: liveAssistantKey,
              text: streamedText,
            });
          }
        },
        done: ({ content }) => {
          if (!streamedText && content) {
            streamedText = content;
            scheduleStreamUpdate(streamedText);
          }
        },
        error: ({ detail, error }) => {
          streamError = detail || error || 'Backend unavailable.';
        },
        retry: ({ detail }) => {
          applyStreamedText(typingRow, `Retrying fallback… ${detail || ''}`.trim());
        },
      });
    } else {
      const json = await response.json().catch(() => ({}));
      streamedText = String(json.content || '').trim();
      streamError = json.detail || json.error || '';
    }

    if (streamedText && state.selectedConversationId === conversationId) {
      const finalAssistantMessage = { role: 'assistant', content: streamedText };
      typingRow.classList.remove('streaming-row');
      const finalRow = renderMessage(finalAssistantMessage, { animate: false, index: messages.length });
      typingRow.replaceWith(finalRow);
      await updateConversation(conversationId, { messages: [...messages, finalAssistantMessage] });
      state.renderedChatSignatures = [...messages, finalAssistantMessage].map((message, index) => getMessageSignature(message, index));
      state.renderedConversationId = conversationId;
      syncConversationSelect();
      renderRecentChats();
      renderCharacterPanel();
      updateHeader();
      await loadMemoryBundle().catch(() => {
        state.memoryBundle = null;
        renderMemoryPanel();
      });
    } else {
      typingRow.remove();
      if (streamError && !streamedText && state.selectedConversationId === conversationId) {
        await updateConversation(conversationId, { messages: [...messages, { role: 'system', content: streamError }] });
      }
      await hydrateSelectedWorkspace({ keepSelection: true, skipCharacterList: true });
    }
    if (streamedText && getCharacterAutoplayVoiceEnabled() && characterHasVoice()) {
      const assistantMessage = { role: 'assistant', content: streamedText };
      const assistantKey = getMessageSignature(assistantMessage, messages.length);
      state.tts.lastStreamedAssistantKey = assistantKey;
      queueLiveAutoplayTts({
        conversationId,
        characterId: state.selectedCharacterId,
        messageKey: assistantKey,
        text: streamedText,
        final: true,
      });
    }

    if (streamedText && state.selectedCharacterId) {
      const finalAssistantMessage = { role: 'assistant', content: streamedText };
      const finalAssistantKey = getMessageSignature(finalAssistantMessage, messages.length);
      primeFullMessageTts({ characterId: state.selectedCharacterId, text: streamedText, key: finalAssistantKey }).catch(() => {});
    }
  } catch (error) {
    typingRow.remove();
    if (state.selectedConversationId === conversationId) {
      await updateConversation(conversationId, { messages: [...messages, { role: 'system', content: `Could not reach backend: ${error.message}` }] });
    }
    await hydrateSelectedWorkspace({ keepSelection: true, skipCharacterList: true });
  } finally {
    state.isStreaming = false;
    updateComposerState();
  }
}

function openSettings(kind = 'ui') {
  if (kind === 'ui') el.settingsDialog.showModal();
  if (kind === 'endpoint' && isAdmin()) el.endpointSettingsDialog.showModal();
  if (kind === 'providers' && isAdmin()) el.providerSettingsDialog.showModal();
  if (kind === 'users' && isAdmin()) el.userManagementDialog.showModal();
}

async function loadUsersAdmin() {
  if (!isAdmin()) return [];
  const json = await api('./api/admin/users');
  state.users = json.users || [];
  renderUsersAdmin();
  return state.users;
}

function renderUsersAdmin() {
  if (!isAdmin()) return;
  el.userList.innerHTML = state.users.map((user) => `
    <div class="user-card" data-user="${user.username}">
      <div>
        <div class="name">${user.displayName}</div>
        <div class="desc">@${user.username} · ${user.isAdmin ? 'Admin' : 'User'}</div>
      </div>
      <div class="user-actions">
        <select data-role-select="${user.username}">
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
        <button class="mini-btn" data-save-user="${user.username}">Save</button>
        <button class="mini-btn" data-password-user="${user.username}">Reset password</button>
      </div>
    </div>
  `).join('') || '<div class="meta-line">No users? That would be impressive.</div>';

  el.userList.querySelectorAll('[data-save-user]').forEach((button) => button.addEventListener('click', async () => {
    const username = button.dataset.saveUser;
    const select = el.userList.querySelector(`[data-role-select="${username}"]`);
    const current = state.users.find((item) => item.username === username);
    const displayName = prompt('Display name:', current?.displayName || username);
    if (displayName === null) return;
    await api(`./api/admin/users/${encodeURIComponent(username)}`, {
      method: 'PUT',
      body: JSON.stringify({ displayName, role: select.value }),
    });
    await loadUsersAdmin();
  }));

  el.userList.querySelectorAll('[data-password-user]').forEach((button) => button.addEventListener('click', async () => {
    const username = button.dataset.passwordUser;
    const password = prompt(`New password for ${username}:`);
    if (!password) return;
    const select = el.userList.querySelector(`[data-role-select="${username}"]`);
    const current = state.users.find((item) => item.username === username);
    await api(`./api/admin/users/${encodeURIComponent(username)}`, {
      method: 'PUT',
      body: JSON.stringify({ displayName: current?.displayName || username, role: select.value, password }),
    });
    await loadUsersAdmin();
  }));
}

async function login(username, password) {
  const json = await api('./api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  state.authUser = json.user;
  setAuthMode(true);
  applyAdminVisibility();
  await loadBootstrap();
  await loadProviderConfig();
  await pollModels();
}

async function logout() {
  await api('./api/auth/logout', { method: 'POST' }).catch(() => {});
  state.authUser = null;
  state.bootstrap = null;
  state.pendingImages = [];
  setAuthMode(false);
  el.loginPassword.value = '';
  el.loginError.classList.add('hidden');
  el.profileMenu.classList.add('hidden');
}

function wireEvents() {
  el.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    el.loginError.classList.add('hidden');
    el.loginSubmit.disabled = true;
    el.loginSubmit.textContent = 'Logging in…';
    try {
      await login(el.loginUsername.value.trim(), el.loginPassword.value);
    } catch (error) {
      el.loginError.textContent = error.message;
      el.loginError.classList.remove('hidden');
    } finally {
      el.loginSubmit.disabled = false;
      el.loginSubmit.textContent = 'Log in';
    }
  });

  el.logoutBtn.addEventListener('click', logout);
  el.installAppBtn?.addEventListener('click', promptInstallApp);
  el.search.addEventListener('input', renderCharactersDebounced);
  el.sourceFilter.addEventListener('change', renderCharacters);
  el.tagFilter.addEventListener('change', renderCharacters);
  el.libraryTabs?.querySelectorAll('[data-library-tab]').forEach((button) => button.addEventListener('click', () => {
    state.activeLibraryTab = button.dataset.libraryTab || 'all';
    renderLibraryTabs();
    renderCharacters();
  }));
  el.send.addEventListener('click', sendMessage);
  el.ttsStatusButton?.addEventListener('click', async () => {
    if (!state.selectedCharacterId || !state.selectedCharacterSettings || !characterHasVoice()) return;
    const nextEnabled = !getCharacterAutoplayVoiceEnabled();
    state.selectedCharacterSettings.autoplayVoice = nextEnabled;
    state.selectedCharacterSettings.ttsProvider = 'fish';
    state.selectedCharacterSettings = await api(`./api/character/${encodeURIComponent(state.selectedCharacterId)}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ autoplayVoice: nextEnabled, ttsProvider: 'fish' }),
    });
    updateTtsStatusButton();
    updateHeader();
  });
  el.chatView.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-message-action]');
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();
      const key = decodeURIComponent(actionButton.dataset.messageKey || '');
      const action = actionButton.dataset.messageAction || '';
      try {
        if (action === 'rewind') {
          await rewindConversationToMessage(key);
        } else if (action === 'regenerate') {
          await regenerateAssistantMessage(key);
        } else if (action === 'edit') {
          const conversation = await fetchConversation();
          const { message } = getConversationMessageByKey(conversation, key);
          if (!message) return;
          startEditingMessage(key, getMessageText(message));
          rerenderChatIfMounted({ preserveScroll: true });
          focusMessageEditor(key);
        } else if (action === 'continue') {
          await continueAssistantMessage(key);
        } else if (action === 'save-edit') {
          await saveEditedAssistantMessage(key);
        } else if (action === 'cancel-edit') {
          closeMessageActions();
          rerenderChatIfMounted({ preserveScroll: true });
        }
      } catch (error) {
        console.error(error);
      }
      return;
    }

    const button = event.target.closest('[data-tts]');
    if (button) {
      const key = decodeURIComponent(button.dataset.tts || '');
      const conversation = await fetchConversation();
      const messages = conversation?.messages || [];
      const messageIndex = messages.findIndex((message, index) => getMessageSignature(message, index) === key);
      if (messageIndex === -1) return;
      try {
        await playMessageTts(messages[messageIndex], key);
      } catch (error) {
        console.error(error);
      }
      return;
    }

    const actionableRow = event.target.closest('.message-row[data-message-actionable="true"]');
    if (actionableRow && window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (state.messageActions.activeKey) {
      closeMessageActions();
      rerenderChatIfMounted({ preserveScroll: true });
    }
  });

  el.chatView.addEventListener('input', (event) => {
    const input = event.target.closest('[data-message-edit-input]');
    if (!input) return;
    state.messageActions.draft = input.value;
  });

  el.chatView.addEventListener('mouseover', (event) => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const row = event.target.closest('.message-row[data-message-actionable="true"]');
    if (!row) return;
    const key = row.dataset.messageKey || '';
    if (!key || state.messageActions.editingKey === key) return;
    if (state.messageActions.activeKey === key) return;
    openMessageActions(key);
  });

  el.chatView.addEventListener('mouseleave', (event) => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (!el.chatView.contains(event.relatedTarget) && !state.messageActions.editingKey && state.messageActions.activeKey) {
      closeMessageActions();
    }
  });

  el.chatView.addEventListener('pointerdown', (event) => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const row = event.target.closest('.message-row[data-message-actionable="true"]');
    if (!row) {
      scheduleMessageActionsClose();
      return;
    }
    const key = row.dataset.messageKey || '';
    scheduleMessageActionsClose();
    state.messageActions.touchKey = key;
    state.messageActions.touchTimer = setTimeout(() => {
      openMessageActions(key);
      state.messageActions.touchTimer = null;
      state.messageActions.touchKey = null;
    }, 420);
  });

  el.chatView.addEventListener('pointerup', scheduleMessageActionsClose);
  el.chatView.addEventListener('pointercancel', scheduleMessageActionsClose);
  el.chatView.addEventListener('pointermove', scheduleMessageActionsClose);
  el.imageBtn.addEventListener('click', (event) => event.stopPropagation());
  el.imageInput.addEventListener('click', (event) => event.stopPropagation());
  el.imageInput.addEventListener('change', async () => {
    const files = [...(el.imageInput.files || [])].filter((file) => file.type.startsWith('image/'));
    if (!files.length) {
      renderCharacters();
      return;
    }
    const converted = await filesToDataUrls(files);
    state.pendingImages = [...state.pendingImages, ...converted].slice(0, 4);
    updateComposerState();
    renderCharacters();
  });

  el.newChat.addEventListener('click', async () => {
    const created = await api('./api/conversations', {
      method: 'POST',
      body: JSON.stringify({ characterId: state.selectedCharacterId, personaId: state.selectedPersonaId || '', name: `Chat ${getCurrentConversationList().length + 1}` }),
    });
    state.selectedConversationId = created.conversation.id;
    await savePreferences({ session: { activeConversationId: state.selectedConversationId } });
    await hydrateSelectedWorkspace({ keepSelection: true });
  });

  el.input.addEventListener('keydown', (event) => {
    const enterToSend = getUiSettings().enterToSend !== false;
    if (enterToSend && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  el.input.addEventListener('input', updateComposerState);

  el.personaSelect.addEventListener('change', async () => {
    state.selectedPersonaId = el.personaSelect.value;
    state.selectedConversationId = null;
    await savePreferences({ session: { activePersonaId: state.selectedPersonaId, activeConversationId: null } });
    await hydrateSelectedWorkspace({ keepSelection: true });
  });

  el.conversationSelect.addEventListener('change', async () => {
    state.selectedConversationId = el.conversationSelect.value;
    await savePreferences({ session: { activeConversationId: state.selectedConversationId } });
    renderCharacterPanel();
    await renderChat();
    updateHeader();
  });

  el.modelSelect.addEventListener('change', () => {
    state.selectedModel = el.modelSelect.value;
    renderCharacterPanel();
    updateHeader();
    updateComposerState();
  });

  el.refreshModels.addEventListener('click', pollModels);
  el.openLibrary?.addEventListener('click', openRecentsSidebar);
  el.sidebarRecentsBtn?.addEventListener('click', openRecentsSidebar);
  el.sidebarLibraryBtn?.addEventListener('click', openLibraryPage);
  el.libraryBackToRecents?.addEventListener('click', openRecentsSidebar);
  el.libraryCurrentViewBtn?.addEventListener('click', openLibraryPage);
  el.libraryClose?.addEventListener('click', closeLibraryPage);
  el.libraryBackdrop?.addEventListener('click', async () => {
    closeLibraryPage();
    if (isMobileLibraryMode() && el.appShell.classList.contains('panel-open')) {
      el.appShell.classList.remove('panel-open');
      await savePreferences({ session: { panelOpen: false } });
      updateComposerState();
    }
  });
  el.profileButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!el.profileMenu.classList.contains('hidden')) {
      closeProfilePage();
    } else {
      openProfilePage();
    }
  });
  el.closeProfilePage?.addEventListener('click', closeProfilePage);

  const openCharacterSettingsFromHeader = async () => {
    if (!getSelectedCharacter()) return;
    closeProfilePage();
    closeLibraryPage();
    el.appShell.classList.add('panel-open');
    await savePreferences({ session: { panelOpen: true } });
    updateComposerState();
  };
  el.currentCharacter?.addEventListener('click', openCharacterSettingsFromHeader);
  el.currentCharacter?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCharacterSettingsFromHeader();
    }
  });

  el.drawerHandle.addEventListener('click', async () => {
    el.appShell.classList.toggle('panel-open');
    await savePreferences({ session: { panelOpen: el.appShell.classList.contains('panel-open') } });
    updateComposerState();
  });

  el.closeCharacterPanel.addEventListener('click', async () => {
    el.appShell.classList.remove('panel-open');
    await savePreferences({ session: { panelOpen: false } });
    updateComposerState();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.profile-menu-wrap')) closeProfilePage();
  });

  window.matchMedia('(max-width: 980px)').addEventListener?.('change', () => syncMobileLibraryNav());

  el.uiSettingsBtn.addEventListener('click', () => openSettings('ui'));
  el.endpointSettingsBtn.addEventListener('click', () => openSettings('endpoint'));
  el.providerSettingsBtn.addEventListener('click', async () => { if (!isAdmin()) return; await loadProviderConfig(); openSettings('providers'); });
  el.userManagementBtn.addEventListener('click', async () => { if (!isAdmin()) return; await loadUsersAdmin(); openSettings('users'); });
  el.closeSettings.addEventListener('click', () => el.settingsDialog.close());
  el.closeEndpointSettings.addEventListener('click', () => el.endpointSettingsDialog.close());
  el.closeProviderSettings.addEventListener('click', () => el.providerSettingsDialog.close());
  el.closeUserManagement.addEventListener('click', () => el.userManagementDialog.close());
  el.closeRewindConfirm?.addEventListener('click', closeRewindConfirmDialog);
  el.cancelRewindConfirm?.addEventListener('click', closeRewindConfirmDialog);
  el.confirmRewindConfirm?.addEventListener('click', async () => {
    const pendingKey = state.messageActions.rewindPendingKey;
    if (!pendingKey) return closeRewindConfirmDialog();
    await rewindConversationToMessage(pendingKey, { confirmed: true });
  });

  el.settingDisplayName.addEventListener('input', () => saveAppUiSettingsDebounced({ displayName: el.settingDisplayName.value }));
  el.settingAccent.addEventListener('input', () => saveAppUiSettingsDebounced({ accent: el.settingAccent.value }));
  el.settingPoll.addEventListener('change', () => saveAppUiSettingsDebounced({ autoPollModels: el.settingPoll.value === 'on' }));
  el.settingAnimation.addEventListener('change', () => saveAppUiSettingsDebounced({ animationLevel: el.settingAnimation.value }));
  el.settingReduceMotion.addEventListener('change', () => saveAppUiSettingsDebounced({ reduceMotion: el.settingReduceMotion.value === 'on' }));
  el.settingBlurStrength.addEventListener('input', () => saveAppUiSettingsDebounced({ blurStrength: Number(el.settingBlurStrength.value) }));
  el.settingTransparencyStrength.addEventListener('input', () => saveAppUiSettingsDebounced({ transparencyStrength: Number(el.settingTransparencyStrength.value) }));
  el.settingBackgroundIntensity.addEventListener('input', () => saveAppUiSettingsDebounced({ backgroundIntensity: Number(el.settingBackgroundIntensity.value) }));
  el.settingDensity.addEventListener('change', () => saveAppUiSettingsDebounced({ density: el.settingDensity.value }));

  el.endpointFallbackProvider1.addEventListener('change', refreshFallbackModelSelectors);
  el.endpointFallbackProvider2.addEventListener('change', refreshFallbackModelSelectors);
  el.endpointLocalProfiles?.addEventListener('input', syncEndpointLocalProfileOptionsFromTextarea);
  el.localProfileSelect?.addEventListener('change', async () => {
    if (!isAdmin()) return;
    const profiles = normalizeLocalProfiles(state.appConfig?.endpoints?.localProfiles, state.appConfig?.endpoints?.localBaseUrl, state.appConfig?.endpoints?.providerLabel || 'local');
    const active = profiles.find((profile) => profile.id === el.localProfileSelect.value) || profiles[0];
    state.appConfig.endpoints = await api('./api/config/endpoints', {
      method: 'PUT',
      body: JSON.stringify({ activeLocalProfileId: active?.id || '', localBaseUrl: active?.baseUrl || state.appConfig.endpoints.localBaseUrl }),
    });
    renderLocalProfiles();
    await pollModels();
  });
  el.testEndpointBtn.addEventListener('click', async () => {
    el.endpointTestResult.textContent = 'Testing connection…';
    try {
      const result = await api('./api/config/test-connection', { method: 'POST' });
      el.endpointTestResult.textContent = result.ok ? `Connection looks good (${result.status})` : `Connection responded but not clean (${result.status})`;
    } catch (error) {
      el.endpointTestResult.textContent = `Connection failed: ${error.message}`;
    }
  });
  el.saveEndpointSettings.addEventListener('click', async () => { await saveEndpointSettings(); el.endpointSettingsDialog.close(); });
  el.saveProviderSettings.addEventListener('click', saveProviderSettings);
  el.acquireChubBtn?.addEventListener('click', acquireFreshBatch);
  el.createCharacterBtn.addEventListener('click', () => openCreateCharacterDialog());
  el.closeCharacterCreate.addEventListener('click', () => el.characterCreateDialog.close());

  el.createCharacterAvatar.addEventListener('change', async () => {
    const file = el.createCharacterAvatar.files?.[0];
    if (!file) return updateCharacterAvatarPreview('');
    const converted = await filesToDataUrls([file]);
    updateCharacterAvatarPreview(converted[0].url);
  });

  el.importCharacterFile.addEventListener('change', async () => {
    const file = el.importCharacterFile.files?.[0];
    if (!file) return;
    await importCharacterToDialog(file);
    el.importCharacterFile.value = '';
  });

  el.duplicateCharacterBtn.addEventListener('click', async () => {
    const json = await api(`./api/characters/${encodeURIComponent(state.editingCharacterId)}`);
    openCreateCharacterDialog({ ...json.character, name: `${json.character.name} Copy`, imageUrl: getSelectedCharacter()?.imageUrl }, 'create');
  });

  el.characterCreateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await createCharacterFromDialog();
    } catch (error) {
      alert(error.message || 'Could not create character');
    }
  });

  el.userCreateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    el.createUserSubmit.disabled = true;
    el.createUserSubmit.textContent = 'Creating…';
    try {
      await api('./api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: el.newUserUsername.value.trim(),
          displayName: el.newUserDisplayName.value.trim(),
          password: el.newUserPassword.value,
          role: el.newUserRole.value,
        }),
      });
      el.userCreateForm.reset();
      await loadUsersAdmin();
    } finally {
      el.createUserSubmit.disabled = false;
      el.createUserSubmit.textContent = 'Create user';
    }
  });
}

(async function init() {
  wireImageFallbacks();
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) wireImageFallbacks(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  wireEvents();
  try {
    const session = await api('./api/auth/session');
    if (!session.authenticated) {
      setAuthMode(false);
      return;
    }
    state.authUser = session.user;
    setAuthMode(true);
    applyAdminVisibility();
    await loadBootstrap();
    if (isAdmin()) {
      const run = await api('./api/acquisition/chub').catch(() => null);
      if (run?.running) {
        el.acquireChubBtn.disabled = true;
        el.acquireChubBtn.textContent = 'Adding…';
        setAcquireStatus(`Adding characters… ${formatAcquireProgress(run)}`);
        watchAcquireProgress().finally(() => {
          el.acquireChubBtn.disabled = false;
          el.acquireChubBtn.textContent = 'Add more characters';
        });
      }
    }
    await loadProviderConfig();
    await pollModels();
    if (getUiSettings().autoPollModels !== false) setInterval(pollModels, 60000);
  } catch {
    setAuthMode(false);
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const memoryEls = getMemoryEls();
  memoryEls.handle?.addEventListener('click', () => toggleMemoryPanel());
  memoryEls.close?.addEventListener('click', () => toggleMemoryPanel(false));

  document.querySelectorAll('.memory-header-toggle').forEach((toggle) => {
    if (toggle.dataset.memoryBound) return;
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      toggleMemoryPanel();
    });
    toggle.dataset.memoryBound = 'true';
  });

  renderMemoryPanel();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
  updateInstallUi();
});

window.addEventListener('appinstalled', () => {
  state.deferredInstallPrompt = null;
  updateInstallUi();
});

registerServiceWorker();
updateInstallUi();
