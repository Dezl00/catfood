/**
 * Input sanitization helpers for MCP tools and catalog data.
 * Adheres to strict TypeScript without `any`.
 */

// Strip ASCII control characters except \r, \n, and \t
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
// Strip potential script tags and unsafe HTML wrappers
const SCRIPT_TAG_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

export function sanitizeText(value: unknown, maxLength = 2000): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(SCRIPT_TAG_REGEX, '')
    .replace(CONTROL_CHARS_REGEX, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeBarcode(value: unknown): string {
  if (value === null || value === undefined) return '';
  // Barcodes: alphanumeric, dashes, dots, spaces, uppercase/lowercase
  return String(value)
    .replace(CONTROL_CHARS_REGEX, '')
    .trim()
    .slice(0, 64);
}

export function sanitizeNumberString(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';
  // Check if it's a valid numeric representation (integer or float)
  const num = Number(str);
  if (Number.isNaN(num) || num < 0) return '';
  return String(num);
}

export function sanitizeUrl(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';
  try {
    const url = new URL(str);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
    return '';
  } catch {
    return '';
  }
}
