import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateJoin, joinPayload, submitJoin, ENQUIRY_TYPES, JOIN_FORM_NAME, JOIN_FORM_ENDPOINT, JOIN_HONEYPOT, JOIN_FIELD_NAMES, type JoinValues,
} from '../src/lib/joinForm.ts';

const root = path.join(import.meta.dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
const ok: JoinValues = { name: 'A Person', company: 'Example Publishing', email: 'a.person@example.com', website: 'https://example.com', type: 'Editorial publication', message: 'We publish weekly market notes and would like to talk.' };

type Call = { url: string; init: RequestInit };
function fake(status: number | Error, opts: { type?: string } = {}) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (status instanceof Error) throw status;
    const r = new Response('', { status: status === 0 ? 200 : status });
    return opts.type ? Object.defineProperty(r, 'type', { value: opts.type }) : r;
  }) as unknown as typeof fetch;
  return { f, calls };
}

// ---- validation ----

test('validation: required fields, email, https website, enquiry type and message length', () => {
  assert.deepEqual(validateJoin(ok), {});
  assert.deepEqual(validateJoin({ ...ok, website: '' }), {}, 'website is optional');
  assert.deepEqual(Object.keys(validateJoin({ name: ' ', company: '', email: '', website: '', type: '', message: '' })).sort(), ['company', 'email', 'message', 'name', 'type']);
  for (const email of ['nope', 'a@b', 'a b@c.com', '<x>@c.com', 'a@b.c']) assert.ok(validateJoin({ ...ok, email }).email, email);
  for (const website of ['example.com', 'http://example.com', 'javascript:alert(1)', 'https://u:p@example.com', 'https://localhost']) assert.ok(validateJoin({ ...ok, website }).website, website);
  assert.ok(validateJoin({ ...ok, message: 'too short' }).message);
  assert.ok(validateJoin({ ...ok, message: 'x'.repeat(2001) }).message);
  assert.ok(validateJoin({ ...ok, name: 'n'.repeat(121) }).name);
});

test('enquiry type: exactly the four approved options and nothing else is accepted', () => {
  assert.deepEqual([...ENQUIRY_TYPES], ['Editorial publication', 'Affiliated business', 'Content collaboration', 'Other partnership']);
  for (const t of ENQUIRY_TYPES) assert.deepEqual(validateJoin({ ...ok, type: t }), {}, t);
  for (const t of ['', 'Sponsorship', 'editorial publication', ' Other partnership']) assert.ok(validateJoin({ ...ok, type: t }).type, JSON.stringify(t));
});

// ---- submission truthfulness ----

test('a 2xx response is the only success; the POST targets the static Netlify declaration with every field', async () => {
  const { f, calls } = fake(200);
  assert.deepEqual(await submitJoin(ok, { fetchImpl: f }), { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, JOIN_FORM_ENDPOINT);
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(calls[0].init.headers, { 'Content-Type': 'application/x-www-form-urlencoded' });
  assert.equal(calls[0].init.redirect, 'manual');
  const body = new URLSearchParams(String(calls[0].init.body));
  assert.equal(body.get('form-name'), JOIN_FORM_NAME);
  assert.equal(body.get(JOIN_HONEYPOT), '', 'honeypot is sent empty for real submissions');
  assert.equal(body.get('name'), 'A Person');
  assert.equal(body.get('company'), 'Example Publishing');
  assert.equal(body.get('email'), 'a.person@example.com');
  assert.equal(body.get('website'), 'https://example.com');
  assert.equal(body.get('enquiry-type'), 'Editorial publication');
  assert.equal(body.get('message'), ok.message);
  assert.equal([...body.keys()].length, 8);
});

test('every failure mode is reported as a failure, never as success', async () => {
  for (const status of [400, 401, 403, 404, 405, 413, 429, 500, 502, 503]) {
    const r = await submitJoin(ok, { fetchImpl: fake(status).f });
    assert.equal(r.ok, false, String(status));
    assert.equal((r as any).reason, 'http');
    assert.equal((r as any).status, status);
  }
  for (const status of [301, 302, 303, 307]) assert.equal((await submitJoin(ok, { fetchImpl: fake(status).f })).ok, false, `redirect ${status}`);
  assert.equal((await submitJoin(ok, { fetchImpl: fake(200, { type: 'opaqueredirect' }).f })).ok, false, 'opaque redirect');
  assert.deepEqual(await submitJoin(ok, { fetchImpl: fake(new TypeError('offline')).f }), { ok: false, reason: 'network' });
  const hang = ((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(init.signal!.reason)))) as unknown as typeof fetch;
  assert.deepEqual(await submitJoin(ok, { fetchImpl: hang, timeoutMs: 20 }), { ok: false, reason: 'timeout' });
});

test('invalid input never reaches the network', async () => {
  const { f, calls } = fake(200);
  const r = await submitJoin({ ...ok, email: 'bad' }, { fetchImpl: f });
  assert.equal(r.ok, false);
  assert.equal((r as any).reason, 'invalid');
  assert.ok((r as any).errors.email);
  assert.equal(calls.length, 0);
});

test('spam protection: a filled honeypot sends nothing and is never a success', async () => {
  const { f, calls } = fake(200);
  const r = await submitJoin(ok, { fetchImpl: f, honeypot: 'http://spam.example' });
  assert.deepEqual(r, { ok: false, reason: 'spam' });
  assert.equal(calls.length, 0);
  assert.equal((await submitJoin(ok, { fetchImpl: fake(200).f, honeypot: '   ' })).ok, true, 'whitespace-only autofill is not treated as spam');
});

test('payload is form-encoded safely (special characters, newlines)', () => {
  const body = new URLSearchParams(joinPayload({ ...ok, message: 'Line one & "quotes"\nLine two = 100%' }));
  assert.equal(body.get('message'), 'Line one & "quotes"\nLine two = 100%');
});

// ---- static Netlify declaration ----

test('static form declaration matches the visible form for Netlify detection on a static export', () => {
  const html = read('public/__forms.html');
  assert.match(html, new RegExp(`<form name="${JOIN_FORM_NAME}"[^>]*method="POST"[^>]*data-netlify="true"[^>]*netlify-honeypot="${JOIN_HONEYPOT}"`));
  assert.doesNotMatch(html, /\baction=/, 'no third-party action');
  assert.match(html, new RegExp(`<input type="hidden" name="form-name" value="${JOIN_FORM_NAME}">`));
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  for (const [key, name] of Object.entries(JOIN_FIELD_NAMES)) assert.match(html, new RegExp(`name="${name}"`), key);
  assert.match(html, new RegExp(`name="${JOIN_HONEYPOT}"`));
  const options = [...html.matchAll(/<option>([^<]*)<\/option>/g)].map(m => m[1]);
  assert.deepEqual(options, [...ENQUIRY_TYPES]);
  assert.equal(JOIN_FORM_ENDPOINT, '/__forms.html');
});

// ---- accessible states in the component ----

test('component shows success only after a successful submission and exposes accessible states', () => {
  const src = read('src/components/JoinForm.tsx');
  assert.equal((src.match(/setPhase\('success'\)/g) ?? []).length, 1, 'exactly one place can set success');
  assert.match(src, /if \(result\.ok\) \{\s*setValues\(empty\)[^\n]*setPhase\('success'\)/, 'and it sits inside the result.ok branch');
  assert.match(src, /\{phase === 'success' \?/);
  assert.match(src, /role="alert"[^>]*>[^<]*<strong>Your enquiry could not be sent\./, 'errors use role=alert');
  assert.match(src, /Nothing was submitted\./);
  assert.match(src, /role="status"/);
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /aria-busy=\{phase === 'submitting'\}/);
  assert.match(src, /disabled=\{phase === 'submitting'\}/);
  assert.match(src, /statusRef\.current\?\.focus\(\)/, 'focus moves to the result');
  assert.match(src, /What you typed has been kept\./);
  assert.match(src, /aria-hidden="true"><label>Leave this field empty<input ref=\{honeypot\} name=\{JOIN_HONEYPOT\} tabIndex=\{-1\} autoComplete="off"/);
  assert.match(src, /<label htmlFor=\{id\}>/);
  assert.match(src, /htmlFor="join-type"/);
  assert.match(src, /htmlFor="join-message"/);
  assert.match(src, /aria-invalid=/);
  assert.match(src, /aria-describedby=/);
  assert.match(src, /<option value="">Choose one…<\/option>/);
  assert.match(src, /ENQUIRY_TYPES\.map/);
  assert.match(read('src/app/globals.css'), /\.join-hp\{position:absolute;left:-10000px/);
  assert.doesNotMatch(src, /Preview only|not connected/i);
});

test('no secrets, tokens or notification configuration are committed for Netlify', () => {
  for (const file of ['src/components/JoinForm.tsx', 'src/lib/joinForm.ts', 'public/__forms.html', 'netlify.toml']) {
    const s = read(file).replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(s, /NETLIFY_AUTH|api\.netlify\.com|build_hooks|access[_-]?token|Bearer /i, file);
    assert.doesNotMatch(s, /notification|notify|email_to|emailTo/i, `${file}: notifications are configured in the Netlify UI, not code`);
  }
  assert.doesNotMatch(read('netlify.toml'), /forms|redirects|headers/i, 'netlify.toml unchanged');
  assert.doesNotMatch(read('src/app/network/join/page.tsx'), /fetch\s*\(/);
});
