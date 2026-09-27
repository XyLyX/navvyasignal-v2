// Loads production TypeScript modules (no Next, no network) by transpiling them in-process.
// Sibling imports resolve to the real source files; `process` and `fetch` are injectable.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.join(__dirname, '../../src/lib');

function load(name, globals = {}, cache = {}) {
  if (cache[name]) return cache[name].exports;
  const source = fs.readFileSync(path.join(root, `${name}.ts`), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} }; cache[name] = mod;
  const req = spec => spec.startsWith('./') ? load(spec.slice(2), globals, cache) : require(spec);
  const g = { process: { env: {} }, fetch: undefined, setTimeout, console, ...globals };
  new Function('exports', 'require', 'process', 'fetch', 'setTimeout', 'console', js)(mod.exports, req, g.process, g.fetch, g.setTimeout, g.console);
  return mod.exports;
}
module.exports = { load };
