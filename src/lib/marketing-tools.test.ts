import { expect, it } from 'vitest';
import { campaignUrl } from './marketing-tools';
it('preserves destination parameters and safely encodes campaign values', () => {
  const url = new URL(campaignUrl({ url: 'https://example.com/offer?ref=agency&utm_content=old#pricing', source: 'instagram', medium: 'paid_social', campaign: 'Summer & Growth' }));
  expect(url.searchParams.get('ref')).toBe('agency');
  expect(url.searchParams.get('utm_campaign')).toBe('Summer & Growth');
  expect(url.searchParams.has('utm_content')).toBe(false);
  expect(url.hash).toBe('#pricing');
});
it('rejects executable URLs and missing campaign identifiers', () => {
  expect(() => campaignUrl({ url: 'javascript:alert(1)', source: 'x', medium: 'x', campaign: 'x' })).toThrow();
  expect(() => campaignUrl({ url: 'https://example.com', source: '', medium: 'x', campaign: 'x' })).toThrow();
});
