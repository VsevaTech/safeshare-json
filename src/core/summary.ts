import type { Category, ScanResult, Summary, SummaryLine } from './types';
import { CATEGORY_LABELS } from './detectors';

const ORDER: Category[] = [
  'email', 'phone', 'identifier', 'name', 'address', 'ip', 'card', 'cvv', 'token', 'secret', 'other',
];

/** Counts for the "17 sensitive values detected" block. */
export function summarize(scanResult: ScanResult): Summary {
  const occurrences = new Map<Category, number>();
  const distinct = new Map<Category, number>();

  for (const finding of scanResult.findings) {
    occurrences.set(finding.category, (occurrences.get(finding.category) ?? 0) + 1);
  }
  for (const group of scanResult.groups) {
    distinct.set(group.category, (distinct.get(group.category) ?? 0) + 1);
  }

  const lines: SummaryLine[] = ORDER.filter((category) => occurrences.has(category)).map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    occurrences: occurrences.get(category) ?? 0,
    distinctValues: distinct.get(category) ?? 0,
  }));

  return {
    total: scanResult.findings.length,
    distinctValues: scanResult.groups.length,
    lines,
  };
}
