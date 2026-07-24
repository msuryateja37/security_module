export const PROVINCE_SHORT_CODES: Record<string, string> = {
  'Gauteng': 'GAU',
  'Western Cape': 'WCP',
  'Eastern Cape': 'ECP',
  'KwaZulu Natal': 'KZN',
  'KwaZulu-Natal': 'KZN',
  'Limpopo': 'LIM',
  'Mpumalanga': 'MPU',
  'Free State': 'FST',
  'North West': 'NWP',
  'Northern Cape': 'NCP',
  'National': 'NAT',
};

/**
 * Returns the 3-letter province short code for a given province name.
 */
export function getProvinceShortCode(province?: string): string {
  if (!province) return 'NAT';
  if (PROVINCE_SHORT_CODES[province]) return PROVINCE_SHORT_CODES[province];
  const cleaned = province.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (cleaned.length >= 3) return cleaned.substring(0, 3);
  return (cleaned + 'NAT').substring(0, 3);
}

/**
 * Generates an incident reference number in the required format:
 * [3-LETTER PROVINCE SHORT FORM]/[MONTH-YEAR]/[RANDOM NUMBER]
 * Example: GAU/07-2026/4829
 */
export function generateIncidentRefNo(province?: string, date: Date = new Date()): string {
  const code = getProvinceShortCode(province);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `${code}/${month}-${year}/${randNum}`;
}
