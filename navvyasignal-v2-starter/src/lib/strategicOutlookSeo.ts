/** SEO/GEO contract for Strategic Outlook. HOLD content is never indexed or syndicated. */
export const outlookOrigin='https://navvyasignal.com';
export const outlookPath='/strategic-outlook';
export const outlookSeriesTitle='NavvyaSignal Strategic Outlook 2027–2030';
export const outlookDescription='Independent geopolitical and economic forecasts for 2027–2030, with dated baseline assessments and annual forecast-versus-outcome reviews.';
export const outlookCategories=['Global Politics','West Asia','India','UAE','Maritime & Energy','Markets','Technology & AI'] as const;
export const outlookNoIndex={index:false,follow:false,noarchive:true,nosnippet:true} as const;
export type ForecastReview={forecastId:string;baselineYear:2027;reviewYear:2028|2029|2030;status:'materialised'|'partially-materialised'|'not-materialised'|'unresolved';evidenceUrls:string[];reviewedAt:string;};
export const outlookRssPath='/strategic-outlook/rss.xml';
export const outlookAtomPath='/strategic-outlook/atom.xml';
export const outlookJsonFeedPath='/strategic-outlook/feed.json';
