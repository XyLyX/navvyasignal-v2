'use client';
import { useRef, useState, type FormEvent } from 'react';
import { validateJoin, submitJoin, JOIN_LIMITS, JOIN_FORM_NAME, JOIN_HONEYPOT, ENQUIRY_TYPES, type JoinErrors, type JoinValues } from '@/lib/joinForm';

// Submits to Netlify Forms (declared statically in public/__forms.html). Success is shown ONLY after the request
// itself returns 2xx; every other outcome shows an error and keeps what the person typed.
const empty: JoinValues = { name: '', company: '', email: '', website: '', type: '', message: '' };
type Phase = 'idle' | 'submitting' | 'success' | 'error';

export default function JoinForm() {
  const [values, setValues] = useState<JoinValues>(empty);
  const [errors, setErrors] = useState<JoinErrors>({});
  const [checked, setChecked] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const statusRef = useRef<HTMLDivElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const set = (k: keyof JoinValues) => (e: { target: { value: string } }) => {
    const next = { ...values, [k]: e.target.value };
    setValues(next);
    if (checked) setErrors(validateJoin(next));
    if (phase === 'success' || phase === 'error') setPhase('idle');
  };
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (phase === 'submitting') return;
    const found = validateJoin(values);
    setErrors(found);
    setChecked(true);
    if (Object.keys(found).length) {
      setPhase('idle');
      const first = (Object.keys(found) as (keyof JoinValues)[])[0];
      document.getElementById(`join-${first}`)?.focus();
      return;
    }
    setPhase('submitting');
    const result = await submitJoin(values, { honeypot: honeypot.current?.value ?? '' });
    if (result.ok) {
      setValues(empty); setErrors({}); setChecked(false); setPhase('success');
    } else if (result.reason === 'spam') {
      setPhase('idle'); // a bot filled the hidden field: send nothing and say nothing
    } else {
      setPhase('error');
    }
    statusRef.current?.focus();
  };
  const field = (k: Exclude<keyof JoinValues, 'type' | 'message'>, label: string, opts: { type?: string; autoComplete?: string; required?: boolean; hint?: string; placeholder?: string }) => {
    const id = `join-${k}`;
    return <div className="join-field">
      <label htmlFor={id}>{label}{opts.required ? <span aria-hidden="true"> *</span> : <span className="join-optional"> (optional)</span>}</label>
      <input id={id} name={k} type={opts.type ?? 'text'} value={values[k]} onChange={set(k)} autoComplete={opts.autoComplete} placeholder={opts.placeholder}
        maxLength={JOIN_LIMITS[k]} required={opts.required} aria-required={opts.required || undefined} aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `${id}-err` : opts.hint ? `${id}-hint` : undefined} disabled={phase === 'submitting'} />
      {opts.hint && !errors[k] ? <small id={`${id}-hint`}>{opts.hint}</small> : null}
      {errors[k] ? <small id={`${id}-err`} className="join-error">{errors[k]}</small> : null}
    </div>;
  };
  return <form className="join-form" name={JOIN_FORM_NAME} onSubmit={onSubmit} noValidate aria-busy={phase === 'submitting'}>
    {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
    <div className="join-hp" aria-hidden="true"><label>Leave this field empty<input ref={honeypot} name={JOIN_HONEYPOT} tabIndex={-1} autoComplete="off" /></label></div>
    {field('name', 'Your name', { required: true, autoComplete: 'name' })}
    {field('company', 'Company or publication', { required: true, autoComplete: 'organization' })}
    {field('email', 'Email address', { type: 'email', required: true, autoComplete: 'email' })}
    {field('website', 'Website', { type: 'url', autoComplete: 'url', placeholder: 'https://', hint: 'Full address, starting with https://' })}
    <div className="join-field">
      <label htmlFor="join-type">Type of enquiry<span aria-hidden="true"> *</span></label>
      <select id="join-type" name="enquiry-type" value={values.type} onChange={set('type')} required aria-required="true" aria-invalid={errors.type ? true : undefined}
        aria-describedby={errors.type ? 'join-type-err' : undefined} disabled={phase === 'submitting'}>
        <option value="">Choose one…</option>
        {ENQUIRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {errors.type ? <small id="join-type-err" className="join-error">{errors.type}</small> : null}
    </div>
    <div className="join-field">
      <label htmlFor="join-message">Message<span aria-hidden="true"> *</span></label>
      <textarea id="join-message" name="message" rows={6} value={values.message} onChange={set('message')} maxLength={JOIN_LIMITS.message} required aria-required="true"
        aria-invalid={errors.message ? true : undefined} aria-describedby={errors.message ? 'join-message-err' : undefined} disabled={phase === 'submitting'} />
      {errors.message ? <small id="join-message-err" className="join-error">{errors.message}</small> : null}
    </div>
    {Object.keys(errors).length > 0 && checked ? <p className="join-summary" role="alert">Please correct the {Object.keys(errors).length === 1 ? 'highlighted field' : 'highlighted fields'} and try again.</p> : null}
    <button type="submit" className="join-submit" disabled={phase === 'submitting'}>{phase === 'submitting' ? 'Sending…' : 'Send enquiry'}</button>
    <div ref={statusRef} tabIndex={-1} className="join-status" aria-live="polite">
      {phase === 'submitting' ? <p className="join-sending" role="status">Sending your enquiry…</p> : null}
      {phase === 'success' ? <p className="join-result" role="status"><strong>Thank you: your enquiry has been submitted.</strong> We will be in touch. No automatic confirmation email is sent.</p> : null}
      {phase === 'error' ? <p className="join-failure" role="alert"><strong>Your enquiry could not be sent.</strong> Nothing was submitted. Please try again in a moment, or email <a href="mailto:hello@navvyasignal.com">hello@navvyasignal.com</a>. What you typed has been kept.</p> : null}
    </div>
  </form>;
}
