export type NetworkVenture = {
  slug: string; name: string; url: string; category: string; description: string;
  feedStatus: 'unverified' | 'verified';
};
export const networkVentures: NetworkVenture[] = [
  {slug:'navyaa',name:'Navyaa',url:'https://navyaa.blog/',category:'Independent editorial',description:'Essays and perspectives from a separate publication.',feedStatus:'verified'},
  {slug:'zen-homes',name:'Zen Homes Global',url:'https://zenhomesglobal.com/',category:'Property advisory',description:'Property research, portfolio intelligence and advisory.',feedStatus:'verified'},
  {slug:'rate-manifest',name:'Rate Manifest',url:'https://ratemanifest.com/',category:'Travel intelligence',description:'Travel decision intelligence and destination guides.',feedStatus:'unverified'},
  {slug:'om4biz',name:'OM4BIZ',url:'https://om4biz.com/',category:'Business technology',description:'Digital services and business automation.',feedStatus:'verified'},
  {slug:'design-code',name:'Design Code Studios',url:'https://designcode.ae/',category:'Design and fit-out',description:'Interiors and turnkey fit-out.',feedStatus:'verified'},
  {slug:'fils-only',name:'FilsOnly',url:'https://filsonly.com/',category:'AI productivity',description:'AI-powered business productivity.',feedStatus:'unverified'},
  {slug:'d6-kitchens',name:'D6 Kitchens',url:'https://d6kitchens.com/',category:'Kitchens and interiors',description:'Kitchen design, projects and product updates.',feedStatus:'verified'},
  {slug:'the-wasam',name:'The Wasam',url:'https://thewasam.com/',category:'The Navvya Network',description:'Explore The Wasam.',feedStatus:'unverified'},
];
