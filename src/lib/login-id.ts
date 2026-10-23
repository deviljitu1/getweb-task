export function resolveLoginEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();
  if (value.includes('@')) return value;
  return `${value}@admin.com`;
}

