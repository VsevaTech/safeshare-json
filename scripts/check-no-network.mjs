/**
 * Static privacy guard, executed in CI against the production bundle.
 *
 * SafeShare JSON must never contain code that can ship a payload somewhere:
 * no fetch/XHR/WebSocket/sendBeacon, no persistent browser storage, and no
 * third-party origins in the emitted HTML.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

const FORBIDDEN = [
  { pattern: /\bfetch\s*\(/, label: 'fetch()' },
  { pattern: /XMLHttpRequest/, label: 'XMLHttpRequest' },
  { pattern: /\bnew\s+WebSocket\b/, label: 'WebSocket' },
  { pattern: /sendBeacon/, label: 'navigator.sendBeacon' },
  { pattern: /EventSource/, label: 'EventSource' },
  { pattern: /localStorage/, label: 'localStorage' },
  { pattern: /sessionStorage/, label: 'sessionStorage' },
  { pattern: /indexedDB/, label: 'indexedDB' },
  { pattern: /document\.cookie/, label: 'document.cookie' },
  { pattern: /https?:\/\/(?!www\.w3\.org)[a-z0-9.-]+/i, label: 'absolute external URL' },
];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(DIST).filter((file) => /\.(js|css|html)$/.test(file));
if (files.length === 0) {
  console.error('No build output found - run `npm run build` first.');
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const { pattern, label } of FORBIDDEN) {
    const match = source.match(pattern);
    if (match) {
      console.error(`${file}: forbidden reference to ${label} -> ${match[0]}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('\nPrivacy guard failed: the bundle must stay fully offline after load.');
  process.exit(1);
}
console.log(`Privacy guard passed for ${files.length} build artefact(s): no network or storage APIs, no external origins.`);
