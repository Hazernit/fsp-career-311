/** Public freeform fields cannot be used as an accidental bypass of contact gating. */
export function redactContactText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[контакт скрыт]')
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, match => (match.match(/\d/g)?.length || 0) >= 10 ? '[контакт скрыт]' : match)
    .replace(/\b(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/[A-Z0-9_+@-]+(?:[/?#][A-Z0-9_+@/%?&=.#-]*)?/gi, '[контакт скрыт]')
    // Standalone Telegram handles have 5–32 characters. Do not consume npm
    // package scopes or decorators followed by a slash or opening parenthesis.
    .replace(/(^|[^\p{L}\p{N}_./@])@[A-Z][A-Z0-9_]{4,31}(?=$|[\s.,:;!?)[\]{}"'])/giu, '$1[контакт скрыт]');
}
