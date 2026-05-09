const fs = require('fs');
let css = fs.readFileSync('/root/.openclaw/workspaces/orchestrator/deployments/aichat-mvp/public/styles.css', 'utf8');

// The mobile header structure requires five locations: back, title, memory, tts, profile.
// Wait, looking at the layout the earlier grid-template-areas were back title tts profile
// Let's check how many elements we have.

// The mobile grid is defined as:
const searchString = `grid-template-areas: "back title tts profile" !important;`;
const replacementString = `grid-template-columns: 68px minmax(0, 1fr) 56px 56px 56px !important;
    grid-template-areas: "back title memory tts profile" !important;`;

css = css.replace(searchString, replacementString);

const cssOverrides = `
  #memory-header-toggle.floating-profile-button {
    grid-area: memory !important;
    width: 56px !important;
    height: 56px !important;
    min-width: 56px !important;
    min-height: 56px !important;
    padding: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    position: relative !important;
    overflow: visible !important;
    font-size: 1.5rem !important;
  }
`;

// Insert before the closing brace of the @media (max-width: 980px) block that handles the mobile header.
const targetMediaString = `  #open-library.floating-profile-button::before {`;
css = css.replace(targetMediaString, cssOverrides + `\n  #open-library.floating-profile-button::before {`);

fs.writeFileSync('/root/.openclaw/workspaces/orchestrator/deployments/aichat-mvp/public/styles.css', css);
console.log('Mobile header CSS patched');
