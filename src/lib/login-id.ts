export function resolveLoginEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();
  if (value.includes('@')) return value;
  if (value === 'nahush') return 'nahush@internal.getwebdigital.com';
  return `${value}@admin.com`;
}
