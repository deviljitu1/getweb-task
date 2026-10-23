export function campaignUrl(input: { url: string; source: string; medium: string; campaign: string; content?: string; term?: string }) {
  const url = new URL(input.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an http or https website URL.');
  if (!input.source.trim() || !input.medium.trim() || !input.campaign.trim()) throw new Error('Source, medium and campaign are required.');
  for (const key of ['source', 'medium', 'campaign', 'content', 'term'] as const) {
    const value = (input[key] || '').trim();
    if (value) url.searchParams.set(`utm_${key}`, value);
    else url.searchParams.delete(`utm_${key}`);
  }
  return url.toString();
}
