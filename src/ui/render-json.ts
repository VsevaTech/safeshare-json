import type { JsonPath, JsonValue } from '../core/types';
import { formatPointer } from '../core/pointer';

export interface HighlightInfo {
  readonly className: string;
  readonly title: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scalarHtml(value: JsonValue): string {
  if (typeof value === 'string') return `<span class="tok-str">${escapeHtml(JSON.stringify(value))}</span>`;
  if (typeof value === 'number') return `<span class="tok-num">${escapeHtml(String(value))}</span>`;
  if (typeof value === 'boolean') return `<span class="tok-bool">${String(value)}</span>`;
  return '<span class="tok-null">null</span>';
}

/**
 * Pretty-prints a JSON document as HTML, wrapping flagged leaves in a
 * highlight element so the user can see exactly what was detected.
 * Rendering happens entirely in the browser; nothing is transmitted.
 */
export function renderJson(value: JsonValue, highlights: Map<string, HighlightInfo>): string {
  const out: string[] = [];

  const walk = (node: JsonValue, path: JsonPath, indent: string): void => {
    if (Array.isArray(node)) {
      if (node.length === 0) {
        out.push('[]');
        return;
      }
      out.push('[\n');
      node.forEach((item, index) => {
        out.push(`${indent}  `);
        walk(item, [...path, index], `${indent}  `);
        out.push(index === node.length - 1 ? '\n' : ',\n');
      });
      out.push(`${indent}]`);
      return;
    }
    if (node !== null && typeof node === 'object') {
      const entries = Object.entries(node);
      if (entries.length === 0) {
        out.push('{}');
        return;
      }
      out.push('{\n');
      entries.forEach(([key, child], index) => {
        out.push(`${indent}  <span class="tok-key">${escapeHtml(JSON.stringify(key))}</span>: `);
        walk(child, [...path, key], `${indent}  `);
        out.push(index === entries.length - 1 ? '\n' : ',\n');
      });
      out.push(`${indent}}`);
      return;
    }

    const pointer = formatPointer(path);
    const highlight = highlights.get(pointer);
    if (highlight) {
      out.push(
        `<mark class="hl ${highlight.className}" data-pointer="${escapeHtml(pointer)}" title="${escapeHtml(highlight.title)}">${scalarHtml(node)}</mark>`,
      );
    } else {
      out.push(scalarHtml(node));
    }
  };

  walk(value, [], '');
  return out.join('');
}
