/**
 * Core domain types for SafeShare JSON.
 *
 * Everything in `src/core` is pure, dependency-free TypeScript: it never
 * touches the DOM, the network or any storage API. That is what makes the
 * "your JSON never leaves your browser" promise testable.
 */

/** Any value that can appear in a parsed JSON document. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** A location inside a JSON document: object keys and array indices. */
export type JsonPath = ReadonlyArray<string | number>;

/** Category of sensitive data. Drives the replacement format and the summary. */
export type Category =
  | 'email'
  | 'phone'
  | 'identifier'
  | 'name'
  | 'address'
  | 'ip'
  | 'card'
  | 'cvv'
  | 'token'
  | 'secret'
  | 'other';

/** What the user decided to do with a finding group. */
export type Action = 'mask' | 'replace' | 'keep';

/** How a finding was detected. */
export type DetectionSource = 'field-name' | 'value-pattern';

/** A single sensitive value found at a single location. */
export interface Finding {
  /** Stable id, derived from the path. */
  readonly id: string;
  /** Path to the value inside the document. */
  readonly path: JsonPath;
  /** Human readable path, e.g. `customer.contacts[0].email`. */
  readonly pointer: string;
  /** Object key (or array index) the value is stored under. */
  readonly key: string;
  /** The raw value as it appears in the document. */
  readonly value: string | number;
  readonly category: Category;
  readonly detectedBy: DetectionSource;
  /** Short explanation shown in the UI, e.g. `field name "email"`. */
  readonly reason: string;
  /**
   * Findings that share a group key always receive the same replacement,
   * which is what keeps the sanitized payload debuggable.
   */
  readonly groupKey: string;
}

/** All findings that share one value+category, i.e. one replacement decision. */
export interface FindingGroup {
  readonly groupKey: string;
  readonly category: Category;
  readonly value: string | number;
  readonly reason: string;
  readonly detectedBy: DetectionSource;
  /** Label used to build the placeholder, e.g. `CUSTOMER_ID`. */
  readonly label: string;
  readonly findings: Finding[];
  /** Replacement decision; defaults come from `DEFAULT_ACTIONS`. */
  action: Action;
}

export interface ScanResult {
  readonly findings: Finding[];
  readonly groups: FindingGroup[];
  /** pointer -> finding, used by the UI to highlight the original document. */
  readonly byPointer: Map<string, Finding>;
}

export interface SummaryLine {
  readonly category: Category;
  readonly label: string;
  readonly occurrences: number;
  readonly distinctValues: number;
}

export interface Summary {
  readonly total: number;
  readonly distinctValues: number;
  readonly lines: SummaryLine[];
}

export interface SanitizeResult {
  /** A brand new document; the input is never mutated. */
  readonly value: JsonValue;
  /** pointer -> replacement value, for highlighting the sanitized pane. */
  readonly changed: Map<string, string | number>;
  /** original value -> replacement, in first-seen order. */
  readonly mapping: Array<{ from: string | number; to: string | number; category: Category }>;
}
