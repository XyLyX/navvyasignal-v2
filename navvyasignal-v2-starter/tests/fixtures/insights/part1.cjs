// The actual Part 1 record as stored in the Insights Notion database (page 41c11486-b145-8165-b4dc-f1b841fdc0f6),
// reproduced in Notion API shape. Status In Review, Ready to Post unchecked, Partially Verified.
const t = (s) => [{ plain_text: s }];
const sel = (n) => ({ select: n ? { name: n } : null });
const NOTES = "PRIVATE. Reliability/credibility: cover headings A1 (read directly from user's image). Publisher page economist.com/worldahead2027 blocked in our environment; official ten themes, artist, dates, launch details, full forecasts NOT verified and deliberately excluded. 'More than four decades' removed pending source. Hero image: use original NavvyaSignal artwork; do not reproduce the Economist cover (copyright); link to publisher page instead. 'Roughly even' is a qualitative lexicon term, not a measured 50% probability. Gemini cross-check not run. Outstanding before approval: publisher verification, original hero artwork, independent evidence review, Gemini cross-check. Do not publish, syndicate via RSS, index or distribute until complete.";
const BLUF = "The Economist's 2027 cover presents the year through overlapping political, technological, economic and environmental pressures rather than one defining crisis. We assess with low confidence that it is roughly even whether those pressures will actually dominate 2027. This series tests that framing against independent evidence and identifies developments that would change the assessment.";
const page = {
  id: '41c11486-b145-8165-b4dc-f1b841fdc0f6',
  properties: {
    'Title': { title: t("The Economist's 2027 cover frames the year as converging pressures, and the evidence is still being tested") },
    'Slug': { rich_text: t('the-world-ahead-2027-converging-risks') },
    'Subtitle / BLUF': { rich_text: t(BLUF) },
    'Category': sel('Analysis'),
    'Editorial Scope': { multi_select: [{ name: 'Cross-Desk' }] },
    'Series': { rich_text: t('The World Ahead 2027') }, 'Series Part': { number: 1 },
    'Status': sel('In Review'), 'Ready to Post': { checkbox: false },
    'Publish At': { date: null }, 'Published At': { date: null }, 'Updated At': { date: { start: '2026-11-19' } },
    'Author': { rich_text: t('NavvyaSignal Editorial') }, 'Editor': { rich_text: [] },
    'SEO Title': { rich_text: t('The World Ahead 2027: Why Converging Risks Matter') },
    'Meta Description': { rich_text: t("NavvyaSignal examines The Economist's 2027 cover and assesses how political, technological, energy and climate pressures could interact.") },
    'Hero Image URL': { url: null }, 'Hero Alt Text': { rich_text: [] },
    'Sources': { rich_text: t('The Economist, The World Ahead 2027 (cover headings).') },
    'Verification Status': sel('Partially Verified'),
    'Editorial Notes': { rich_text: t(NOTES) }
    // NOTE: 'Approval Fingerprint' does not exist in the database yet; its absence is part of the real record.
  }
};
const p = (s) => ({ type: 'paragraph', has_children: false, paragraph: { rich_text: t(s) } });
const h = (s) => ({ type: 'heading_2', has_children: false, heading_2: { rich_text: t(s) } });
const li = (s) => ({ type: 'bulleted_list_item', has_children: false, bulleted_list_item: { rich_text: t(s) } });
const blocks = [
  p("The Economist's 2027 cover presents the year through overlapping political, technological, economic and environmental pressures rather than one defining crisis. We assess with low confidence that it is roughly even whether those pressures will actually dominate 2027. This series tests that framing against independent evidence and identifies developments that would change the assessment."),
  p('By NavvyaSignal Editorial'),
  h('What the cover actually says'),
  p("The World Ahead 2027 is the latest edition of The Economist's annual future-looking series. Its cover lists six headings beneath the title:"),
  li("Trump's final chapter (\"Not going quietly\")"), li('Artificial intelligence ("Acceleration, risks and backlash")'), li('After Iran ("Regional and global reverberations")'),
  li('Climate change ("Hottest year ever, again")'), li('Populism on the rise ("What is mightier than Le Pen?")'), li('Hollywood reboots ("Franchise fatigue")'),
  p('Those headings are the firm ground. We have not verified an official symbol-by-symbol explanation from the publisher. We therefore treat the artwork as mood and the printed headings as the editorial agenda.'),
  h('Why the cover is a starting point, not evidence'),
  p('A cover compresses a year into one image, and readers naturally connect the symbols into a story. It is not a forecasting record.'),
  h('Our assessment, and the alternative'),
  p('We assess with low confidence that it is roughly even whether overlapping pressures will dominate the year. "Roughly even" here is a qualitative judgment expressing substantial uncertainty, not a measured probability.'),
  h('Gaps and what would change this assessment'),
  p('A single major shock would not by itself disprove the overlapping-pressures reading. We would revise only if evidence established that one event dominated the year\'s broader political and economic dynamics.'),
  h('Outlook'),
  p('Parts 2 to 7 will test the overlapping-pressures framing against independent evidence. These are monitoring priorities, not predictions that disruptions will occur together.')
];
module.exports = { page, blocks, NOTES, BLUF };
