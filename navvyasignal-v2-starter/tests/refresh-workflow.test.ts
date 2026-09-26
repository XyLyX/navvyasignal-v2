import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Static and simulated checks of the staged V2-only refresh workflow. Nothing here contacts Netlify or GitHub:
// curl is replaced by a shell function that only records that it was called.
const wf = fs.readFileSync(path.join(import.meta.dirname, '../../.github/workflows/v2-static-refresh.yml'), 'utf8');
const validation = fs.readFileSync(path.join(import.meta.dirname, '../../.github/workflows/v2-preview-validation.yml'), 'utf8');

function runScript(): string {
  const lines = wf.split('\n');
  const i = lines.findIndex(l => /^\s+run: \|\s*$/.test(l));
  assert.ok(i > 0, 'run block found');
  const indent = lines[i + 1].match(/^\s*/)![0].length;
  const out: string[] = [];
  for (const l of lines.slice(i + 1)) { if (l.trim() && l.match(/^\s*/)![0].length < indent) break; out.push(l.slice(indent)); }
  return out.join('\n');
}

const HOOK = 'https://api.netlify.com/build_hooks/abc123DEF456secretvalue';
const bash = spawnSync('bash', ['-c', 'echo ok']);
const haveBash = !bash.error && bash.status === 0;

function simulate(env: Record<string, string>) {
  const script = `CURL_LOG=$(mktemp); curl() { echo "$@" >> "$CURL_LOG"; }\n(\n${runScript()}\n)\nrc=$?\necho "CURL_CALLS=$(wc -l < "$CURL_LOG" | tr -d ' ')"\nexit $rc`;
  const r = spawnSync('bash', ['-c', script], { env: { PATH: process.env.PATH ?? '', ...env } as unknown as NodeJS.ProcessEnv, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, calls: Number(/CURL_CALLS=(\d+)/.exec(r.stdout)?.[1] ?? -1) };
}

test('schedule: every four hours at :10 UTC, from the default branch only, V2 repository only', () => {
  assert.match(wf, /cron: '10 0,4,8,12,16,20 \* \* \*'/);
  assert.match(wf, /GitHub scheduled workflows only run from the repository default branch \(main\)/);
  assert.match(wf, /if: github\.repository == 'XyLyX\/navvyasignal-v2'/);
  assert.match(wf, /timeout-minutes: 5/);
  assert.match(wf, /concurrency:\s+group: v2-static-content-refresh\s+cancel-in-progress: false/);
  assert.match(wf, /permissions:\s+contents: read/);
  assert.match(wf, /environment: v2-preview/);
});

test('destination: only the V2 secret and a Netlify build-hook URL; no other system is referenced', () => {
  assert.match(wf, /V2_NETLIFY_BUILD_HOOK: \$\{\{ secrets\.V2_NETLIFY_BUILD_HOOK \}\}/);
  assert.equal((wf.match(/secrets\./g) ?? []).length, 1, 'exactly one secret is used');
  const noComments = wf.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(noComments, /framer|kit\.com|whapi|notion|ratemanifest|filsonly|zenhomes/i);
  assert.doesNotMatch(wf, /build_hooks\/[A-Za-z0-9]{6,}/, 'no hook id is committed');
  assert.match(wf, /\^https:\\\/\\\/api\\\.netlify\\\.com\/build_hooks\/|https:\/\/api\\\.netlify\\\.com\/build_hooks\//);
  assert.equal((wf.match(/curl /g) ?? []).length, 1);
});

test('manual runs default to a dry run; scheduled runs always trigger', () => {
  assert.match(wf, /dry_run:\s+description: [^\n]*\n\s+type: boolean\s+default: true/);
  assert.match(wf, /DRY_RUN: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.dry_run \}\}/);
});

test('the CI validation workflow is unchanged in purpose: tests, typecheck and a credential-free build', () => {
  assert.match(validation, /run: npm test/);
  assert.match(validation, /run: npm run typecheck/);
  assert.match(validation, /V2_CI_STATIC_FIXTURE: '1'/);
  assert.doesNotMatch(validation, /secrets\./);
});

test('script behaviour (curl stubbed): dry run, missing secret, bad URL, real trigger; secret never printed', { skip: !haveBash && 'bash not available' }, () => {
  const missing = simulate({ V2_NETLIFY_BUILD_HOOK: '', DRY_RUN: 'false' });
  assert.equal(missing.status, 1); assert.equal(missing.calls, 0);
  assert.match(missing.out, /not configured; no deployment triggered/);

  for (const bad of ['http://api.netlify.com/build_hooks/abc123', 'https://evil.example/build_hooks/abc123', 'https://api.netlify.com/build_hooks/abc/../x', 'https://api.netlify.com.evil.example/build_hooks/abc123', 'https://api.netlify.com/build_hooks/', 'https://api.netlify.com/other/abc123']) {
    const r = simulate({ V2_NETLIFY_BUILD_HOOK: bad, DRY_RUN: 'false' });
    assert.equal(r.status, 1, bad); assert.equal(r.calls, 0, bad);
    assert.match(r.out, /Invalid Netlify build hook URL format/);
    assert.ok(!r.out.includes(bad), 'the rejected value is not echoed');
  }

  const dry = simulate({ V2_NETLIFY_BUILD_HOOK: HOOK, DRY_RUN: 'true' });
  assert.equal(dry.status, 0); assert.equal(dry.calls, 0, 'dry run never calls curl');
  assert.match(dry.out, /Dry run: the secret is configured and well formed\. No build was triggered\./);

  const live = simulate({ V2_NETLIFY_BUILD_HOOK: HOOK, DRY_RUN: 'false' });
  assert.equal(live.status, 0); assert.equal(live.calls, 1, 'exactly one POST');
  assert.match(live.out, /V2 preview build queued/);

  const scheduled = simulate({ V2_NETLIFY_BUILD_HOOK: HOOK });
  assert.equal(scheduled.calls, 1, 'no DRY_RUN variable (scheduled) means trigger');

  for (const r of [missing, dry, live, scheduled]) assert.ok(!r.out.includes('secretvalue') && !r.out.includes(HOOK), 'secret never appears in output');
});
