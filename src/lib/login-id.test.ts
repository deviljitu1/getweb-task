import { describe, expect, it } from 'vitest';
import { resolveLoginEmail } from './login-id';

describe('workspace login identifiers', () => {
  it('resolves simple username IDs to @admin.com', () => {
    expect(resolveLoginEmail('nahush')).toBe('nahush@admin.com');
    expect(resolveLoginEmail('anshu')).toBe('anshu@admin.com');
    expect(resolveLoginEmail('admin')).toBe('admin@admin.com');
  });

  it('preserves full email logins as entered', () => {
    expect(resolveLoginEmail(' User@Company.com ')).toBe('user@company.com');
  });
});
