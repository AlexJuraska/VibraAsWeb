Prerequisites
- Recommended Node.js: 16+ (check `package.json` `engines` if present)
- npm (bundled with Node) or Yarn
- Git

Quick install
1. Clone and enter repo (or download and extract the project from zip):
   git clone https://github.com/AlexJuraska/VibraAsWeb.git
   cd <repo>

2. Install exact deps from lockfile:
   npm ci

3. Build:
   npm run build
   Confirm output folder is `dist/` as defined by the `build` script in `package.json`.


Install only production runtime deps (on a server where you will run built assets)
   npm ci --omit=dev


Checks
- Verify Node/npm: node -v && npm -v
- Inspect `package.json` for `scripts` and `engines`
