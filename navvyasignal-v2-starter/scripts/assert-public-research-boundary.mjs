import {existsSync, lstatSync, readdirSync, readFileSync} from 'node:fs';
import {extname, join} from 'node:path';
import {pathToFileURL} from 'node:url';

const held = /(?:real-estate-intelligence|ns-rei-001)/i;
const textExtensions = new Set(['.html', '.json', '.xml', '.rss', '.atom', '.txt', '.js', '.mjs', '.webmanifest', '.map']);

export function assertPublicResearchBoundary(directory, inspectContents) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (held.test(entry.name) || entry.isSymbolicLink()) {
      throw new Error('Public research boundary rejected an output path');
    }
    if (entry.isDirectory()) {
      assertPublicResearchBoundary(path, inspectContents);
    } else if (inspectContents && textExtensions.has(extname(path).toLowerCase())
        && held.test(readFileSync(path, 'utf8'))) {
      throw new Error('Public research boundary rejected exported content');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const phase = process.argv[2];
  if (phase === 'source') {
    for (const directory of ['src/app', 'public']) {
      if (!lstatSync(directory).isDirectory()) throw new Error('Expected a public input directory');
      assertPublicResearchBoundary(directory, false);
    }
  } else if (phase === 'export') {
    if (!existsSync('out/index.html') || !lstatSync('out').isDirectory()) {
      throw new Error('Expected a completed static export');
    }
    assertPublicResearchBoundary('out', true);
  } else {
    throw new Error('Specify source or export');
  }
}
