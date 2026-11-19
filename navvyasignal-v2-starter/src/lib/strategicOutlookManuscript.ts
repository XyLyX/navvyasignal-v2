import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {OutlookSection} from './strategicOutlook';

export function outlookManuscript(section: OutlookSection) {
 const directory = process.env.STRATEGIC_OUTLOOK_MANUSCRIPTS;
 if (!directory) throw new Error('Private Outlook manuscript directory is required');
 return readFileSync(join(directory, section.slug + '.html'), 'utf8');
}
