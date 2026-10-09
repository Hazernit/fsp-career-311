/** Public freeform fields cannot be used as an accidental bypass of contact gating. */
export function redactContactText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[контакт скрыт]')
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, match => (match.match(/\d/g)?.length || 0) >= 10 ? '[контакт скрыт]' : match);
}
