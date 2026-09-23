// Independent, read-only V2 adapter. Never writes to Notion or touches Framer sync flags.
export type Story = {
 id: string; title: string; brief: string; category: string; contentType: string;
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
const source = process.env.NOTION_DATA_SOURCE_ID;
const token = process.env.NOTION_TOKEN;
export async function getStories(limit = 800):Promise<Story[]> {
 if (!token || !source) return [];
 const stories:Story[]=[];
 let cursor:string|undefined;
 do {
  const res = await fetch(`https://api.notion.com/v1/data_sources/${source}/query`,{
   method:'POST',
   headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'},
   body:JSON.stringify({page_size:100,...(cursor?{start_cursor:cursor}:{})}),
   next:{revalidate:900}
  });
  if(!res.ok) throw new Error(`V2 Notion read failed: HTTP ${res.status}`);
  const data = await res.json() as QueryResult;
  for(const page of data.results){
   const p=page.properties, title=text(p.Name);
   if(!title || title.startsWith('[TEST') || title.startsWith('[DUPLICATE')) continue;
   if(p['Ready to Post']?.checkbox !== true) continue;
   stories.push({id:page.id,title,brief:text(p['Signal Brief']),category:select(p.Category),
    contentType:select(p['Content Type']),today:p["Today's Intelligence"]?.checkbox===true,
    homepageDate:p['Homepage Date']?.date?.start?.slice(0,10)??null,
    homepagePriority:p['Homepage Priority']?.number??null,
    watchlist:p.Watchlist?.checkbox===true,watchStatus:select(p['Watch Status']),
    nextReview:p['Next Review']?.date?.start??null,createdAt:page.created_time,
    ready:true,coverageThemes:(p['Coverage Theme']?.multi_select??[]).map(x=>x.name)});
  }
  cursor=data.has_more && data.next_cursor ? data.next_cursor:undefined;
 }while(cursor && stories.length<limit);
 return stories.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
