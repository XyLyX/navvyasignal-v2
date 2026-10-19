import policy from './regional-policy.json' with {type:'json'};
export const desks = policy.desks.map(({slug,name,notion,focus}) => ({slug,name,notion,focus}));
// Historical categories remain on their articles; never reinterpret topic desks as regions.
export function matchesDeskCategory(slug:string,category:string):boolean {
 const desk=desks.find(d=>d.slug===slug);
 return !!desk && (category===desk.notion ||
   (slug==='uae-middle-east' && ['UAE Desk','West Asia Desk'].includes(category)) ||
   (slug==='india-subcontinent' && category==='India Desk'));
}
