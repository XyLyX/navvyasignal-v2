// V2 read-only adapter. It never touches the existing 'Synced to Framer' checkbox.
// No Notion writes, Framer calls, Kit sends or automation triggers are implemented.
export type Story = {
  id: string; title: string; brief: string; category: string;
  contentType: string; today: boolean; watchlist: boolean;
  watchStatus: string; nextReview: string | null; createdAt: string;
};
type NotionProp = { type?: string; title?: { plain_text: string }[]; rich_text?: { plain_text: string }[]; select?: { name: string } | null; checkbox?: boolean; date?: { start: string } | null };
type NotionPage = { id: string; created_time: string; properties: Record<string, NotionProp> };
const txt = (p?: NotionProp) => (p?.title ?? p?.rich_text ?? []).map(x => x.plain_text).join('');
const selected = (p?: NotionProp) => p?.select?.name ?? '';
export async function getStories(limit = 100): Promise<Story[]> {
  const token = process.env.NOTION_TOKEN;
  const database = process.env.NOTION_DATABASE_ID;
  if (!token || !database) return []; // Empty preview until V2-only credentials are configured.
  const stories: Story[] = [];
  let cursor: string | undefined;
  do {
    const response = await fetch(`https://api.notion.com/v1/databases/${database}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_size: Math.min(100, limit - stories.length), ...(cursor ? { start_cursor: cursor } : {}) }),
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`Notion read failed: HTTP ${response.status}`);
    const payload = await response.json() as { results: NotionPage[]; has_more: boolean; next_cursor: string | null };
    for (const page of payload.results) {
      const p = page.properties;
      const title = txt(p.Name);
      if (!title || title.startsWith('[TEST') || title.startsWith('[DUPLICATE')) continue;
      stories.push({ id: page.id, title, brief: txt(p['Signal Brief']), category: selected(p.Category),
        contentType: selected(p['Content Type']), today: p["Today's Intelligence"]?.checkbox ?? false,
        watchlist: p.Watchlist?.checkbox ?? false, watchStatus: selected(p['Watch Status']),
        nextReview: p['Next Review']?.date?.start ?? null, createdAt: page.created_time });
    }
    cursor = payload.has_more && payload.next_cursor ? payload.next_cursor : undefined;
  } while (cursor && stories.length < limit);
  return stories;
}
