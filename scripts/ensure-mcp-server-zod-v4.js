'use strict';

/**
 * Ensures `mongodb-mcp-server` resolves zod v4 at Node module-resolution time.
 *
 * Background: this repo is installed with yarn, whose flat hoisting + the
 * root `resolutions` pin force a single zod v3 (`zod@3.25.76`) at the top of
 * node_modules (compass-generative-ai and the `ai` SDK are written against
 * zod v3). However `mongodb-mcp-server` requires zod v4 and calls v4-only
 * APIs (e.g. `z.string().ipv4()`) at module load. The webpack build already
 * remaps this via a resolve alias, but ts-node/mocha and any other Node
 * runtime have no such alias and would crash with
 * `z.string(...).ipv4 is not a function`.
 *
 * npm's lockfile expressed this as a nested `mongodb-mcp-server/node_modules/zod`
 * (v4). yarn's resolution flattens that away, so we recreate the nested copy
 * here from the dedicated `zod-v4` alias dependency (`npm:zod@4.3.6`). This is
 * idempotent and a no-op when the packages are absent or already correct.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const source = path.join(repoRoot, 'node_modules', 'zod-v4');
const mcpServer = path.join(repoRoot, 'node_modules', 'mongodb-mcp-server');
const target = path.join(mcpServer, 'node_modules', 'zod');

function readVersion(pkgDir) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')
    ).version;
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(source) || !fs.existsSync(mcpServer)) {
    // Nothing to do (dependency not installed in this context).
    return;
  }

  const sourceVersion = readVersion(source);
  const targetVersion = readVersion(target);
  if (sourceVersion && sourceVersion === targetVersion) {
    // Already nested at the right version.
    return;
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });

  // eslint-disable-next-line no-console
  console.log(
    `ensure-mcp-server-zod-v4: nested zod@${String(
      sourceVersion
    )} for mongodb-mcp-server`
  );
}

main();
