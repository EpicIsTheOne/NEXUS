const fs = require('fs');
let css = fs.readFileSync('/root/.openclaw/workspaces/orchestrator/deployments/aichat-mvp/public/styles.css', 'utf8');

const oldDesktopCSS = /\.floating-profile-wrap \{\s*position: fixed;\s*top: 14px;\s*right: 16px;\s*z-index: 75;\s*display: flex;\s*flex-direction: column;\s*align-items: flex-end;\s*gap: 8px;\s*\}/;

const newDesktopCSS = `.floating-profile-wrap {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: rgba(11, 13, 19, 0.85);
  backdrop-filter: blur(var(--surface-blur));
  -webkit-backdrop-filter: blur(var(--surface-blur));
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 75;
  display: flex !important;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  gap: 16px;
}
.floating-profile-wrap .header-center-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.floating-profile-wrap .header-right-controls {
  display: flex;
  gap: 8px;
}
.floating-title,
.floating-status {
  display: block; /* Override previous display: none; */
}
`;

css = css.replace(oldDesktopCSS, newDesktopCSS);

// Also fix the tablet/mobile rules that assume .floating-profile-wrap is column or absolute
const tabletCSSOld = /\.floating-profile-wrap \{\s*top: max\(8px, env\(safe-area-inset-top\)\);\s*left: auto;\s*right: max\(10px, env\(safe-area-inset-right\)\);\s*display: flex;\s*align-items: center;\s*justify-content: flex-end;\s*gap: 8px;\s*z-index: 75;\s*padding: 0;\s*\}/;

const tabletCSSNew = `.floating-profile-wrap {
    /* Tablet overrides */
}`;
css = css.replace(tabletCSSOld, tabletCSSNew);

fs.writeFileSync('/root/.openclaw/workspaces/orchestrator/deployments/aichat-mvp/public/styles.css', css);
console.log('CSS patched');
