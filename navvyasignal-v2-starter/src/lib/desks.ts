export const desks = [
  { slug: 'west-asia', name: 'West Asia', notion: 'West Asia Desk' },
  { slug: 'india', name: 'India', notion: 'India Desk' },
  { slug: 'uae', name: 'UAE', notion: 'UAE Desk' },
  { slug: 'global-politics', name: 'Global Politics', notion: 'Global Politics Desk' },
  { slug: 'markets-capital', name: 'Markets & Capital', notion: 'Markets & Capital Desk' },
  { slug: 'technology-ai', name: 'Technology & AI', notion: 'Technology & AI Desk' },
  { slug: 'maritime-energy-supply-chains', name: 'Maritime, Energy & Supply Chains', notion: 'Maritime Energy & Supply Chains Desk' },
] as const;

// Read-only compatibility: do not recategorize historical Notion records.
export function matchesDeskCategory(slug: string, category: string): boolean {
  const desk = desks.find(d => d.slug === slug);
  if (!desk) return false;
  return category === desk.notion ||
    (slug === 'maritime-energy-supply-chains' && category === 'Maritime & Energy Desk');
}
