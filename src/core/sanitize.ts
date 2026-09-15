import type { JsonPath, JsonValue, SanitizeResult, ScanResult } from './types';
import { buildReplacement, createCounter } from './replacements';
import { maskValue } from './mask';
import { formatPointer } from './pointer';

/**
 * Applies the decisions stored on each finding group and returns a brand new
 * document. The input document is never mutated.
 *
 * Consistency guarantee: the replacement is computed once per
 * (category, value) group, so the same sensitive value is replaced by the
 * same placeholder in every location it appears in.
 */
export function sanitize(document: JsonValue, scanResult: ScanResult): SanitizeResult {
  const nextIndex = createCounter();
  const replacementByGroup = new Map<string, string>();
  const mapping: SanitizeResult['mapping'] = [];

  for (const group of scanResult.groups) {
    if (group.action === 'keep') continue;
    const replacement =
      group.action === 'mask'
        ? maskValue(group.value, group.category)
        : buildReplacement(group, nextIndex(group.category));
    replacementByGroup.set(group.groupKey, replacement);
    mapping.push({ from: group.value, to: replacement, category: group.category });
  }

  const changed = new Map<string, string | number>();

  const clone = (value: JsonValue, path: JsonPath): JsonValue => {
    if (Array.isArray(value)) {
      return value.map((item, index) => clone(item, [...path, index]));
    }
    if (value !== null && typeof value === 'object') {
      const out: { [key: string]: JsonValue } = {};
      for (const [key, child] of Object.entries(value)) {
        out[key] = clone(child, [...path, key]);
      }
      return out;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      return value; // null and boolean are preserved as-is
    }

    const pointer = formatPointer(path);
    const finding = scanResult.byPointer.get(pointer);
    if (!finding) return value;

    const replacement = replacementByGroup.get(finding.groupKey);
    if (replacement === undefined) return value; // "keep"

    changed.set(pointer, replacement);
    return replacement;
  };

  return { value: clone(document, []), changed, mapping };
}

/** Convenience helper: sets the same action on every group. */
export function setAllActions(scanResult: ScanResult, action: 'mask' | 'replace' | 'keep'): void {
  for (const group of scanResult.groups) group.action = action;
}
