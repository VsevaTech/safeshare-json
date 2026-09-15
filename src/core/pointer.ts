import type { JsonPath } from './types';

/** `["customer","contacts",0,"email"]` -> `customer.contacts[0].email` */
export function formatPointer(path: JsonPath): string {
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment}]`;
    } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) {
      out += out.length === 0 ? segment : `.${segment}`;
    } else {
      out += `[${JSON.stringify(segment)}]`;
    }
  }
  return out.length === 0 ? '$' : out;
}
