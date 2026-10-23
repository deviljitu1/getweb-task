export function resolveLoginEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();
  if (value.includes('@')) return value;
  if (value === 'nahush') return 'nahush@internal.getwebdigital.com';
  if (value === 'anshu') return 'anshu@admin.com';
  return `${value}@admin.com`;
}
