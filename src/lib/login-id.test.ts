import { describe, expect, it } from 'vitest';
import { resolveLoginEmail } from './login-id';

describe('workspace login identifiers', () => {
  it('resolves the approved Nahush username without changing full email logins', () => {
    expect(resolveLoginEmail(' Nahush ')).toBe('nahush@internal.getwebdigital.com');
    expect(resolveLoginEmail(' User@Company.com ')).toBe('user@company.com');
  });
  it('preserves the existing admin login alias', () => {
    expect(resolveLoginEmail('admin')).toBe('admin@admin.com');
    expect(resolveLoginEmail('anshu')).toBe('anshu@admin.com');
  });
});
