// Validation for the Join Our Network preview form. Pure and network-free: nothing here sends data anywhere.
export type JoinValues = { name: string; company: string; email: string; website: string; message: string };
export type JoinErrors = Partial<Record<keyof JoinValues, string>>;

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
  if (!t(v.message)) e.message = 'Please tell us a little about your publication or business.';
  else if (t(v.message).length < 20) e.message = 'Please add a little more detail (at least 20 characters).';
  else if (t(v.message).length > JOIN_LIMITS.message) e.message = `Please keep your message under ${JOIN_LIMITS.message} characters.`;
  return e;
}
