const fs = require('fs');
let js = fs.readFileSync('/root/.openclaw/workspaces/orchestrator/deployments/aichat-mvp/public/app.js', 'utf8');

// It looks like app.js might already have code to dynamically inject `#memory-header-toggle` if it's missing, let's replace that logic with something that just bounds whatever memory toggle buttons exist.
const oldInit = `if (!document.getElementById('memory-header-toggle')) {
    const button = document.createElement('button');
    button.id = 'memory-header-toggle';
    button.textContent = '🧠 Memory';`;

// Find how it handles memory toggles currently
const bindRegex = /document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\}\);/m;

const patchLogic = `
function initMemoryToggles() {
  const memoryEls = getMemoryEls();
  memoryEls.handle?.addEventListener('click', () => toggleMemoryPanel());
  memoryEls.close?.addEventListener('click', () => toggleMemoryPanel(false));
  
  // Wire up the new header button(s) added directly to HTML
  const headerToggles = document.querySelectorAll('.memory-header-toggle');
  headerToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleMemoryPanel();
    });
  });
}

// Ensure the memory buttons are hooked up
document.addEventListener('DOMContentLoaded', initMemoryToggles);
`;

// Looking for the DOMContentLoaded block for memoryEls:
const match = js.match(/(document\.addEventListener\('DOMContentLoaded', \(\) => \{\s*const memoryEls = getMemoryEls\(\);[\s\S]*?\}\);)/);

if (match) {
    js = js.replace(match[0], match[0] + "\\n" + patchLogic); // Actually just append/replace
}

// simpler general replace
js += `\n
// DOM Patch for memory toggles added manually
document.addEventListener('DOMContentLoaded', () => {
  const toggles = document.querySelectorAll('.memory-header-toggle, #memory-header-toggle');
  toggles.forEach(toggle => {
    if (!toggle.dataset.memoryBound) {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        toggleMemoryPanel();
      });
      toggle.dataset.memoryBound = 'true';
    }
  });
});\n`;


fs.writeFileSync('/root/.openclaw/workspaces/orchestrator/deployments/aichat-mvp/public/app.js', js);
console.log('JS patched');
