/** Independent editorial stream. Never reads or writes the Signal Feed or Insights snapshot. */
export type OutlookSection = {slug:string;label:string;title:string;summary:string;asset:string;};
export const outlookSections: OutlookSection[] = [
{slug:'opening',label:'Opening editorial',title:'Strategic Outlook 2027–2030',summary:'The independent NavvyaSignal introduction to a four-year forecasting and accountability project.',asset:'/strategic-outlook/opening-cover.jpg'},
{slug:'part-01',label:'Part 1 of 8',title:'The World Ahead 2027: A World at the Crossroads',summary:'Interconnected global risks and opportunities.',asset:'/strategic-outlook/part-01-world-crossroads.png'},
{slug:'part-02',label:'Part 2 of 8',title:'The New Global Power Struggle: America, China, Russia and Europe',summary:'The changing balance of power and the risks of strategic rivalry.',asset:'/strategic-outlook/part-02-global-power.png'},
{slug:'part-03',label:'Part 3 of 8',title:'The Iran War Is Not Over. The Gulf Is Already Paying the Price.',summary:'Regional security, energy markets and maritime exposure.',asset:'/strategic-outlook/part-03-gulf-security.png'},
{slug:'part-04',label:'Part 4 of 8',title:'The Global Financial Fault Line: Debt, Bond Markets and the Economics of Instability',summary:'Debt, bond-market fragility and financial contagion.',asset:'/strategic-outlook/part-04-financial-fault-line.png'},
{slug:'part-05',label:'Part 5 of 8',title:'Artificial Intelligence, Autonomous Warfare and the New Technological Power Structure',summary:'AI capabilities, strategic competition and military autonomy.',asset:'/strategic-outlook/part-05-ai-autonomous-warfare.png'},
{slug:'part-06',label:'Part 6 of 8',title:'Climate, Healthcare, Space and the Next Economic Transformation',summary:'Three frontiers reshaping long-term resilience and growth.',asset:'/strategic-outlook/part-06-climate-health-space.png'},
{slug:'part-07',label:'Part 7 of 8',title:'India, the UAE and the Middle East: Strategic Risks and Opportunities in a Fragmenting World',summary:'Trade corridors, strategic autonomy and regional opportunity.',asset:'/strategic-outlook/part-07-india-uae-trade.png'},
{slug:'part-08',label:'Part 8 of 8',title:'The 2027 Strategic Outlook: Ten Scenarios That Could Define the Decade',summary:'Scenario pathways, indicators and alternative futures.',asset:'/strategic-outlook/part-08-ten-scenarios.png'},
{slug:'closing',label:'Closing synthesis',title:'The 2027–2030 Outlook: What to Watch and How to Measure It',summary:'The permanent baseline for annual forecast-versus-outcome reviews.',asset:'/strategic-outlook/closing-2030-synthesis.png'}
];
export const outlookYears = [2027,2028,2029,2030] as const;
export const outlookPreviewEnabled = () => process.env.STRATEGIC_OUTLOOK_PRIVATE_PREVIEW === 'true' && process.env.NEXT_PUBLIC_V2_PRODUCTION !== 'true';
