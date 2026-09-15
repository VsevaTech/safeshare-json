/**
 * SafeShare JSON - browser-only entry point.
 *
 * There is no backend, no analytics, no telemetry and no remote logging.
 * The document you paste is held in a module-level variable only; it is never
 * written to localStorage/sessionStorage/IndexedDB and disappears on refresh.
 */
import './styles.css';
import demoPayload from '../../examples/payment-event.json?raw';
import type { Action, FindingGroup, JsonValue, ScanResult } from '../core/types';
import { parseJson } from '../core/parse';
import { scan, DEFAULT_ACTIONS } from '../core/scan';
import { sanitize } from '../core/sanitize';
import { summarize } from '../core/summary';
import { CATEGORY_LABELS } from '../core/detectors';
import { renderJson, type HighlightInfo } from './render-json';

interface State {
  document: JsonValue | null;
  scanResult: ScanResult | null;
  sanitizedText: string;
}

const state: State = { document: null, scanResult: null, sanitizedText: '' };

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app container is missing');

app.innerHTML = `
  <header class="masthead">
    <div class="brand">
      <svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 6 54 14v16c0 14-9 23-22 27C19 53 10 44 10 30V14z" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linejoin="round"/>
        <path d="M23 30h18M23 39h11" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
      </svg>
      <h1>SafeShare JSON</h1>
    </div>
    <span class="privacy-badge" id="privacy-badge">🔒 Processed locally — your JSON is not uploaded anywhere.</span>
  </header>
  <p class="tagline">Sanitize production JSON before sharing it with developers, QA or support — entirely in your browser.</p>

  <div class="toolbar">
    <label class="file-label" for="file-input">Upload .json</label>
    <input id="file-input" type="file" accept="application/json,.json,.txt" />
    <button id="btn-demo" class="ghost" type="button">Load demo payload</button>
    <button id="btn-sanitize" class="primary" type="button">Sanitize All</button>
    <button id="btn-keep" class="ghost" type="button">Keep All</button>
    <button id="btn-copy" type="button">Copy Sanitized JSON</button>
    <button id="btn-download" type="button">Download Sanitized JSON</button>
    <button id="btn-clear" class="ghost" type="button">Clear</button>
  </div>

  <label class="visually-hidden" for="input">Paste JSON</label>
  <textarea id="input" spellcheck="false" autocomplete="off" placeholder='Paste a production JSON payload here, e.g. {"customer": {"email": "john@example.com"}}'></textarea>
  <div class="status" id="status" role="status" aria-live="polite"></div>

  <div class="grid">
    <section class="panel">
      <h2>Original JSON <span class="hint" id="original-hint"></span></h2>
      <pre class="json" id="original"><span class="tok-null">Paste or upload a JSON payload to begin.</span></pre>
    </section>
    <section class="panel">
      <h2>Sanitized JSON <span class="hint" id="sanitized-hint"></span></h2>
      <pre class="json" id="sanitized"><span class="tok-null">The safe copy will appear here.</span></pre>
    </section>
  </div>

  <section class="summary" id="summary"><span class="empty">No document loaded yet.</span></section>

  <section class="panel findings">
    <h2>Findings <span class="hint">choose Mask, Replace or Keep per value</span></h2>
    <div id="findings-body"><p style="padding:14px;margin:0;color:var(--muted)">Nothing detected yet.</p></div>
  </section>

  <footer>
    SafeShare JSON runs 100% client-side: no backend, no analytics, no telemetry, no cloud storage.
    Open your browser DevTools → Network while you work — there is no request carrying your payload.
  </footer>
`;

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = app.querySelector<T>(selector);
  if (!element) throw new Error(`missing element: ${selector}`);
  return element;
};

const inputEl = $<HTMLTextAreaElement>('#input');
const fileEl = $<HTMLInputElement>('#file-input');
const statusEl = $<HTMLDivElement>('#status');
const originalEl = $<HTMLPreElement>('#original');
const sanitizedEl = $<HTMLPreElement>('#sanitized');
const summaryEl = $<HTMLElement>('#summary');
const findingsEl = $<HTMLDivElement>('#findings-body');
const originalHint = $<HTMLSpanElement>('#original-hint');
const sanitizedHint = $<HTMLSpanElement>('#sanitized-hint');

function setStatus(message: string, kind: 'ok' | 'error' | 'muted' = 'muted'): void {
  statusEl.textContent = message;
  statusEl.className = `status ${kind === 'muted' ? '' : kind}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(text: string, max = 64): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/** Re-runs detection for the current input and repaints everything. */
function analyze(text: string): void {
  if (text.trim().length === 0) {
    resetView('Paste or upload a JSON payload to begin.');
    return;
  }
  const parsed = parseJson(text);
  if (!parsed.ok) {
    state.document = null;
    state.scanResult = null;
    state.sanitizedText = '';
    setStatus(parsed.error, 'error');
    originalEl.innerHTML = '<span class="tok-null">Invalid JSON.</span>';
    sanitizedEl.innerHTML = '<span class="tok-null">—</span>';
    summaryEl.innerHTML = '<span class="empty">Fix the JSON syntax to see findings.</span>';
    findingsEl.innerHTML = '<p style="padding:14px;margin:0;color:var(--muted)">Nothing detected yet.</p>';
    originalHint.textContent = '';
    sanitizedHint.textContent = '';
    return;
  }

  state.document = parsed.value;
  state.scanResult = scan(parsed.value);
  const count = state.scanResult.findings.length;
  setStatus(count === 0 ? 'Valid JSON. No sensitive values detected.' : `Valid JSON. ${count} sensitive value${count === 1 ? '' : 's'} detected.`, 'ok');
  repaint();
}

function resetView(message: string): void {
  state.document = null;
  state.scanResult = null;
  state.sanitizedText = '';
  setStatus('');
  originalEl.innerHTML = `<span class="tok-null">${escapeHtml(message)}</span>`;
  sanitizedEl.innerHTML = '<span class="tok-null">The safe copy will appear here.</span>';
  summaryEl.innerHTML = '<span class="empty">No document loaded yet.</span>';
  findingsEl.innerHTML = '<p style="padding:14px;margin:0;color:var(--muted)">Nothing detected yet.</p>';
  originalHint.textContent = '';
  sanitizedHint.textContent = '';
}

function repaint(): void {
  const { document: doc, scanResult } = state;
  if (!doc || !scanResult) return;

  const originalHighlights = new Map<string, HighlightInfo>();
  for (const finding of scanResult.findings) {
    originalHighlights.set(finding.pointer, {
      className: finding.category,
      title: `${CATEGORY_LABELS[finding.category]} — ${finding.reason}`,
    });
  }
  originalEl.innerHTML = renderJson(doc, originalHighlights);

  const result = sanitize(doc, scanResult);
  const sanitizedHighlights = new Map<string, HighlightInfo>();
  for (const pointer of result.changed.keys()) {
    sanitizedHighlights.set(pointer, { className: 'changed', title: 'sanitized value' });
  }
  sanitizedEl.innerHTML = renderJson(result.value, sanitizedHighlights);
  state.sanitizedText = `${JSON.stringify(result.value, null, 2)}\n`;

  const kept = scanResult.groups.filter((group) => group.action === 'keep').length;
  originalHint.textContent = `${scanResult.findings.length} flagged`;
  sanitizedHint.textContent = `${result.changed.size} replaced · ${kept} group${kept === 1 ? '' : 's'} kept`;

  renderSummary();
  renderFindings();
}

function renderSummary(): void {
  const { scanResult } = state;
  if (!scanResult) return;
  const summary = summarize(scanResult);
  if (summary.total === 0) {
    summaryEl.innerHTML = '<span class="empty">No sensitive values detected in this document.</span>';
    return;
  }
  const items = summary.lines
    .map((line) => `<li><strong>${line.occurrences}</strong> ${escapeHtml(line.label)} <span style="color:var(--muted)">(${line.distinctValues} distinct)</span></li>`)
    .join('');
  summaryEl.innerHTML = `<h3>${summary.total} sensitive value${summary.total === 1 ? '' : 's'} detected — ${summary.distinctValues} distinct</h3><ul>${items}</ul>`;
}

function renderFindings(): void {
  const { scanResult } = state;
  if (!scanResult) return;
  if (scanResult.groups.length === 0) {
    findingsEl.innerHTML = '<p style="padding:14px;margin:0;color:var(--muted)">Nothing detected yet.</p>';
    return;
  }

  const rows = scanResult.groups
    .map((group, index) => {
      const paths = group.findings
        .map((finding) => `<button type="button" data-goto="${escapeHtml(finding.pointer)}">${escapeHtml(finding.pointer)}</button>`)
        .join('');
      return `
        <tr>
          <td><span class="chip ${group.category}">${escapeHtml(group.category)}</span></td>
          <td class="value-cell">
            <code>${escapeHtml(truncate(String(group.value)))}</code>
            <div class="paths">${group.findings.length} occurrence${group.findings.length === 1 ? '' : 's'}: ${paths}</div>
          </td>
          <td>${escapeHtml(group.reason)}<div class="paths">${group.detectedBy}</div></td>
          <td>${actionButtons(group, index)}</td>
        </tr>`;
    })
    .join('');

  findingsEl.innerHTML = `
    <table>
      <thead><tr><th>Category</th><th>Value &amp; locations</th><th>Why</th><th>Action</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function actionButtons(group: FindingGroup, index: number): string {
  const options: Action[] = ['mask', 'replace', 'keep'];
  const buttons = options
    .map(
      (action) =>
        `<button type="button" data-action="${action}" data-group="${index}" aria-pressed="${group.action === action}">${action[0]?.toUpperCase()}${action.slice(1)}</button>`,
    )
    .join('');
  return `<div class="actions" role="group" aria-label="Action for ${escapeHtml(String(group.value))}">${buttons}</div>`;
}

findingsEl.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const actionButton = target.closest<HTMLButtonElement>('button[data-action]');
  if (actionButton && state.scanResult) {
    const index = Number(actionButton.dataset['group']);
    const group = state.scanResult.groups[index];
    if (group) {
      group.action = actionButton.dataset['action'] as Action;
      repaint();
    }
    return;
  }

  const gotoButton = target.closest<HTMLButtonElement>('button[data-goto]');
  if (gotoButton) {
    const pointer = gotoButton.dataset['goto'];
    const node = pointer ? originalEl.querySelector<HTMLElement>(`mark[data-pointer="${CSS.escape(pointer)}"]`) : null;
    if (node) {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
      node.classList.remove('flash');
      void node.offsetWidth;
      node.classList.add('flash');
    }
  }
});

inputEl.addEventListener('input', () => analyze(inputEl.value));

fileEl.addEventListener('change', () => {
  const file = fileEl.files?.[0];
  if (!file) return;
  // FileReader is local to the browser: the file is never uploaded.
  const reader = new FileReader();
  reader.onload = () => {
    inputEl.value = typeof reader.result === 'string' ? reader.result : '';
    analyze(inputEl.value);
  };
  reader.onerror = () => setStatus('Could not read that file.', 'error');
  reader.readAsText(file);
  fileEl.value = '';
});

$<HTMLButtonElement>('#btn-demo').addEventListener('click', () => {
  inputEl.value = demoPayload.trim();
  analyze(inputEl.value);
});

$<HTMLButtonElement>('#btn-sanitize').addEventListener('click', () => {
  if (!state.scanResult) return;
  for (const group of state.scanResult.groups) group.action = DEFAULT_ACTIONS[group.category];
  repaint();
  setStatus('Sanitized every detected value using the default action for its category.', 'ok');
});

$<HTMLButtonElement>('#btn-keep').addEventListener('click', () => {
  if (!state.scanResult) return;
  for (const group of state.scanResult.groups) group.action = 'keep';
  repaint();
  setStatus('All findings set to Keep — the sanitized copy now equals the original.', 'ok');
});

$<HTMLButtonElement>('#btn-copy').addEventListener('click', async () => {
  if (!state.sanitizedText) {
    setStatus('Nothing to copy yet.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(state.sanitizedText);
    setStatus('Sanitized JSON copied to the clipboard.', 'ok');
  } catch {
    inputEl.focus();
    setStatus('Clipboard permission denied — select the sanitized pane and copy manually.', 'error');
  }
});

$<HTMLButtonElement>('#btn-download').addEventListener('click', () => {
  if (!state.sanitizedText) {
    setStatus('Nothing to download yet.', 'error');
    return;
  }
  // Blob + object URL: the download is produced locally, no server involved.
  const blob = new Blob([state.sanitizedText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sanitized.json';
  link.click();
  URL.revokeObjectURL(url);
  setStatus('Sanitized JSON downloaded.', 'ok');
});

$<HTMLButtonElement>('#btn-clear').addEventListener('click', () => {
  inputEl.value = '';
  resetView('Paste or upload a JSON payload to begin.');
  inputEl.focus();
});
