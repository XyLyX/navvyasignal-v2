import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const slugs = ['opening', ...Array.from({length:8}, (_, i) => `part-0${i + 1}`), 'closing'];
const categories = new Set(['Special Report']);
const editorialScopes = new Set(['Cross-Desk', 'North America Desk', 'Europe Desk', 'India & Subcontinent Desk', 'UAE & Middle East Desk']);
const requiredFiles = ['title.txt', 'bluf.txt', 'body.html', 'sources.json', 'hero.webp'];

export function outlookRevision(read, slug) {
 const hash = createHash('sha256');
 for (const name of requiredFiles) {
  const bytes = read(slug, name);
  if (!bytes.length || !bytes.toString('utf8').trim()) throw Error(`empty ${name}`);
  hash.update(`${name}\0${bytes.length}\0`);
  hash.update(bytes);
 }
 return hash.digest('hex');
}

export function validateOutlookRelease(manifest, read) {
 if (!Array.isArray(manifest?.sections)) return ['Missing edition manifest sections'];
 const errors = [];
 const records = new Map();
 for (const entry of manifest.sections) {
  const slug = entry?.slug;
  if (!slugs.includes(slug) || records.has(slug)) errors.push(`Unexpected or repeated section: ${String(slug)}`);
  else records.set(slug, entry);
 }
 for (const slug of slugs) {
  const entry = records.get(slug);
  if (!entry) {
   errors.push(`${slug}: missing editorial record`);
   continue;
  }
  if (entry.status !== 'Approved' || entry.readyToPost !== true || entry.verificationStatus !== 'Verified') {
   errors.push(`${slug}: requires Approved, Ready to Post and Verified`);
  }
  if (!categories.has(entry.category) || !editorialScopes.has(entry.editorialScope)) {
   errors.push(`${slug}: unknown category or editorial scope`);
  }
  if (typeof entry.approvedBy !== 'string' || !entry.approvedBy.trim()) errors.push(`${slug}: missing editorial approver`);
  if (typeof entry.imageRightsReference !== 'string' || !entry.imageRightsReference.trim()) {
   errors.push(`${slug}: missing public image rights record`);
  }
  try {
   if (entry.approvedRevision !== outlookRevision(read, slug)) errors.push(`${slug}: content has changed since approval`);
   const sources = JSON.parse(read(slug, 'sources.json'));
   if (!Array.isArray(sources) || sources.length === 0 || sources.some(source => {
    try { return new URL(source).protocol !== 'https:'; } catch { return true; }
   })) errors.push(`${slug}: requires HTTPS source references`);
  } catch (error) {
   errors.push(`${slug}: ${error.message}`);
  }
 }
 return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 const [manifestPath, contentDirectory] = process.argv.slice(2);
 try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const errors = validateOutlookRelease(manifest, (slug, file) => readFileSync(join(contentDirectory, slug, file)));
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Strategic Outlook editorial release checks passed.');
 } catch (error) {
  console.error(error.message);
  process.exitCode = 1;
 }
}
