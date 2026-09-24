// Join Our Network form: shared definition, validation and the Netlify Forms submission. Pure and injectable so the
// behaviour is testable offline. Nothing here reports success unless a real submission request succeeds.
export const JOIN_FORM_NAME = 'join-network';
/** Static declaration served by Netlify so form detection registers the form (see public/__forms.html). */
export const JOIN_FORM_ENDPOINT = '/__forms.html';
export const JOIN_HONEYPOT = 'bot-field';

export const ENQUIRY_TYPES = ['Editorial publication', 'Affiliated business', 'Content collaboration', 'Other partnership'] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

export type JoinValues = { name: string; company: string; email: string; website: string; type: string; message: string };
export type JoinErrors = Partial<Record<keyof JoinValues, string>>;

/** Field names exactly as posted to Netlify; public/__forms.html must declare the same names. */
export const JOIN_FIELD_NAMES = { name: 'name', company: 'company', email: 'email', website: 'website', type: 'enquiry-type', message: 'message' } as const;

export const JOIN_LIMITS = { name: 120, company: 160, email: 254, website: 300, message: 2000 } as const;
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

export function validateJoin(v: JoinValues): JoinErrors {
  const e: JoinErrors = {};
  const t = (s: string) => s.trim();
  if (!t(v.name)) e.name = 'Please enter your name.';
  else if (t(v.name).length > JOIN_LIMITS.name) e.name = `Please keep your name under ${JOIN_LIMITS.name} characters.`;
  if (!t(v.company)) e.company = 'Please enter your company or publication.';
  else if (t(v.company).length > JOIN_LIMITS.company) e.company = `Please keep this under ${JOIN_LIMITS.company} characters.`;
  if (!t(v.email)) e.email = 'Please enter your email address.';
  else if (t(v.email).length > JOIN_LIMITS.email || !EMAIL.test(t(v.email))) e.email = 'Please enter a valid email address.';
  if (t(v.website)) {
    let ok = false;
    try { const u = new URL(t(v.website)); ok = u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.'); } catch { /* invalid */ }
    if (!ok || t(v.website).length > JOIN_LIMITS.website) e.website = 'Please enter a full website address starting with https://';
  }
  if (!(ENQUIRY_TYPES as readonly string[]).includes(v.type)) e.type = 'Please choose the type of enquiry.';
  if (!t(v.message)) e.message = 'Please tell us a little about your publication or business.';
  else if (t(v.message).length < 20) e.message = 'Please add a little more detail (at least 20 characters).';
  else if (t(v.message).length > JOIN_LIMITS.message) e.message = `Please keep your message under ${JOIN_LIMITS.message} characters.`;
  return e;
}

/** application/x-www-form-urlencoded body exactly as Netlify Forms expects it (form-name plus every field). */
export function joinPayload(v: JoinValues, honeypot = ''): string {
  return new URLSearchParams({
    'form-name': JOIN_FORM_NAME,
    [JOIN_HONEYPOT]: honeypot,
    [JOIN_FIELD_NAMES.name]: v.name.trim(),
    [JOIN_FIELD_NAMES.company]: v.company.trim(),
    [JOIN_FIELD_NAMES.email]: v.email.trim(),
    [JOIN_FIELD_NAMES.website]: v.website.trim(),
    [JOIN_FIELD_NAMES.type]: v.type,
    [JOIN_FIELD_NAMES.message]: v.message.trim(),
  }).toString();
}

export type JoinResult = { ok: true } | { ok: false; reason: 'invalid' | 'spam' | 'http' | 'network' | 'timeout'; status?: number; errors?: JoinErrors };

/**
 * Validate, then POST to Netlify Forms. Returns ok:true ONLY when the request completed with a 2xx response;
 * validation failures, a filled honeypot, any HTTP error, redirect, timeout or network failure is never a success.
 */
export async function submitJoin(
  v: JoinValues,
  opts: { honeypot?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<JoinResult> {
  const errors = validateJoin(v);
  if (Object.keys(errors).length) return { ok: false, reason: 'invalid', errors };
  if (opts.honeypot && opts.honeypot.trim()) return { ok: false, reason: 'spam' }; // bots fill the hidden field; send nothing
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(JOIN_FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: joinPayload(v, ''),
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return { ok: false, reason: 'http', status: res.status };
    return res.status >= 200 && res.status < 300 ? { ok: true } : { ok: false, reason: 'http', status: res.status };
  } catch (e) {
    return { ok: false, reason: e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'timeout' : 'network' };
  }
}
