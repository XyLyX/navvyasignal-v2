// Independent, read-only V2 adapter. Never writes to Notion or touches Framer sync flags.
export type Story = {
 id: string; title: string; brief: string; body: string; category: string; contentType: string;
 today: boolean; homepageDate: string | null; homepagePriority: number | null;
 watchlist: boolean; watchStatus: string; nextReview: string | null;
 createdAt: string; ready: boolean; coverageThemes: string[];
};
type Text = { plain_text?: string };
type Prop = { title?: Text[]; rich_text?: Text[]; select?: {name:string}|null;
 checkbox?: boolean; date?: {start:string}|null; number?: number|null;
 multi_select?: {name:string}[] };
type Page = {id:string; created_time:string; properties:Record<string,Prop>};
type QueryResult = {results:Page[]; has_more:boolean; next_cursor:string|null};
const text = (p?:Prop) => (p?.title ?? p?.rich_text ?? []).map(x=>x.plain_text??'').join('');
const select = (p?:Prop) => p?.select?.name ?? '';

/** Injectable for tests; production uses the real environment and global fetch. */
export type NotionDeps = {
 env?: Record<string, string | undefined>;
 fetchImpl?: typeof fetch;
 sleep?: (ms: number) => Promise<void>;
};

const PAGE_SIZE = 100;
/** Hard safety ceiling, not a silent cap: exceeding it FAILS the build instead of dropping stories. */
export const MAX_NOTION_PAGES = 500;
const RETRYABLE = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;

const CI_FIXTURE: Story = { id:'ci-static-fixture', title:'CI static export fixture', brief:'Build-only test record.', body:'',
 category:'West Asia Desk', contentType:'', today:false, homepageDate:null, homepagePriority:null,
 watchlist:false, watchStatus:'', nextReview:null, createdAt:'2026-01-01T00:00:00.000Z',
 ready:true, coverageThemes:[] };

/** Credentials are mandatory for production builds: a missing token must FAIL the build,
 *  never silently generate an empty site. Returns null only in the two explicitly allowed cases. */
function credentials(env: Record<string, string | undefined>): { token: string; source: string } | 'fixture' | 'dev-empty' {
 const token = env.NOTION_TOKEN, source = env.NOTION_DATA_SOURCE_ID;
 if (token && source) return { token, source };
 // CI-only static-export fixture: Next requires at least one generated dynamic route.
 // Never enabled in Netlify previews or production; no external Notion writes.
 if (env.V2_CI_STATIC_FIXTURE === '1' && env.CI === 'true') return 'fixture';
 if (env.NODE_ENV !== 'production') return 'dev-empty';   // `next dev` / unit tests without credentials
 const missing = [!token && 'NOTION_TOKEN', !source && 'NOTION_DATA_SOURCE_ID'].filter(Boolean).join(' and ');
 throw new Error(`V2 build refused: ${missing} not configured. A production build without Notion credentials would publish an empty site.`);
}

async function notionFetch(url: string, init: RequestInit & { next?: unknown }, deps: Required<NotionDeps>): Promise<Response> {
 let attempt = 0;
 for (;;) {
  // Netlify restores build caches. A unique deployment header prevents a new\n  // publication build from reusing the previous deployment's Notion snapshot.\n  const headers = new Headers(init.headers);\n  if (deps.env.DEPLOY_ID) headers.set('X-Navvya-Build', deps.env.DEPLOY_ID);\n  const res = await deps.fetchImpl(url, { ...init, headers } as RequestInit);
  if (res.ok) return res;
  if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
   const retryAfter = Number(res.headers?.get?.('retry-after'));
   await deps.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 500 * 2 ** attempt);
   attempt++; continue;
  }
  throw new Error(`V2 Notion read failed: HTTP ${res.status}`);   // fail closed
 }
}

function resolveDeps(deps: NotionDeps = {}): Required<NotionDeps> {
 return {
  env: deps.env ?? process.env,
  fetchImpl: deps.fetchImpl ?? fetch,
  sleep: deps.sleep ?? (ms => new Promise(r => setTimeout(r, ms))),
 };
}

/** Every approved (`Ready to Post`) story, retrieved deterministically:
 *  server-side filter, explicit created_time sort, cursor pagination to the end (no story-count cap),
 *  de-duplicated by id. Any failure or anomaly throws; it never returns a partial list. */
export async function getStories(depsIn: NotionDeps = {}):Promise<Story[]> {
 const deps = resolveDeps(depsIn);
 const creds = credentials(deps.env);
 if (creds === 'fixture') return [{ ...CI_FIXTURE }];
 if (creds === 'dev-empty') return [];
 const byId = new Map<string, Story>();
 const seenCursors = new Set<string>();
 let cursor:string|undefined;
 for (let pageNo = 0; ; pageNo++) {
  if (pageNo >= MAX_NOTION_PAGES) throw new Error(`V2 Notion read aborted: more than ${MAX_NOTION_PAGES * PAGE_SIZE} approved stories; raise the ceiling deliberately rather than truncating.`);
  const res = await notionFetch(`https://api.notion.com/v1/data_sources/${creds.source}/query`, {
   method:'POST',
   headers:{Authorization:`Bearer ${creds.token}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'},
   body:JSON.stringify({
    page_size:PAGE_SIZE,
    filter:{property:'Ready to Post',checkbox:{equals:true}},
    sorts:[{timestamp:'created_time',direction:'descending'}],
    ...(cursor?{start_cursor:cursor}:{}),
   }),
   next:{revalidate:900}
  }, deps);
  const data = await res.json() as QueryResult;
  for(const page of data.results){
   const p=page.properties, title=text(p.Name);
   if(!title || title.startsWith('[TEST') || title.startsWith('[DUPLICATE')) continue;
   if(p['Ready to Post']?.checkbox !== true) continue;   // defence in depth; the query already filters
   byId.set(page.id,{id:page.id,title,brief:text(p['Signal Brief']),body:text(p['Text 1']),category:select(p.Category),
    contentType:select(p['Content Type']),today:p["Today's Intelligence"]?.checkbox===true,
    homepageDate:p['Homepage Date']?.date?.start?.slice(0,10)??null,
    homepagePriority:p['Homepage Priority']?.number??null,
    watchlist:p.Watchlist?.checkbox===true,watchStatus:select(p['Watch Status']),
    nextReview:p['Next Review']?.date?.start??null,createdAt:page.created_time,
    ready:true,coverageThemes:(p['Coverage Theme']?.multi_select??[]).map(x=>x.name)});
  }
  if (!data.has_more) break;
  if (!data.next_cursor) throw new Error('V2 Notion read aborted: has_more without next_cursor (would truncate results).');
  if (seenCursors.has(data.next_cursor)) throw new Error('V2 Notion read aborted: pagination cursor repeated.');
  seenCursors.add(data.next_cursor); cursor = data.next_cursor;
 }
 return [...byId.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

/** Read the original Notion page blocks for a selected long read whose legacy Text 1 is empty.
 *  Read-only: never mutates V1 sync flags or the underlying editorial document.
 */
export async function getLongReadBlocks(pageId: string, depsIn: NotionDeps = {}): Promise<string[]> {
 const deps = resolveDeps(depsIn);
 const creds = credentials(deps.env);
 if (typeof creds === 'string' || !/^[0-9a-f-]{36}$/i.test(pageId)) return [];
 const token = creds.token;
 const blocks: string[] = [];
 let cursor: string | undefined;
 do {
  const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
  url.searchParams.set('page_size', '100');
  if (cursor) url.searchParams.set('start_cursor', cursor);
  const response = await notionFetch(url.toString(), {
   headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2025-09-03' },
   next: { revalidate: 900 },
  }, deps);
  const result = await response.json() as {
   results: { type: string; [key: string]: unknown }[];
   has_more: boolean; next_cursor: string | null;
  };
  for (const block of result.results) {
   const data = block[block.type] as { rich_text?: { plain_text?: string }[] } | undefined;
   const line = (data?.rich_text ?? []).map(t => t.plain_text ?? '').join('').trim();
   if (line) blocks.push(line);
  }
  cursor = result.has_more && result.next_cursor ? result.next_cursor : undefined;
 } while (cursor);
 return blocks;
}
