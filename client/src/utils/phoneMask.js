/**
 * Formats a phone number string as (XXX) XXX-XXXX while typing.
 * Strips non-digits, limits to 10 digits, and applies US phone mask.
 * @param {string} value - Raw input value
 * @returns {string} Formatted phone string
 */
export const formatPhone = (value) => {
  const digits = (value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

/**
 * Strips formatting from a phone string, returning only digits.
 * @param {string} value - Formatted phone string
 * @returns {string} Raw digits only
 */
export const unformatPhone = (value) => {
  return (value || '').replace(/\D/g, '').slice(0, 10);
};
