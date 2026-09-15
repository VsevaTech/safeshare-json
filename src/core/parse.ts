import type { JsonValue } from './types';

export type ParseResult =
  | { readonly ok: true; readonly value: JsonValue }
  | { readonly ok: false; readonly error: string };

/** JSON.parse with a message a human can act on. */
export function parseJson(text: string): ParseResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Nothing to parse — the input is empty.' };
  try {
    return { ok: true, value: JSON.parse(trimmed) as JsonValue };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Invalid JSON: ${message}` };
  }
}
