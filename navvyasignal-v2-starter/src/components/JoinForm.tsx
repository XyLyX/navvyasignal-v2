'use client';
import { useState, type FormEvent } from 'react';
import { validateJoin, JOIN_LIMITS, type JoinErrors, type JoinValues } from '@/lib/joinForm';

// PREVIEW ONLY: this form validates input in the browser and never transmits it. There is deliberately no
// action, fetch or mailto here until an approved destination exists (see docs/rss-integration.md).
const empty: JoinValues = { name: '', company: '', email: '', website: '', message: '' };

export default function JoinForm() {
  const [values, setValues] = useState<JoinValues>(empty);
  const [errors, setErrors] = useState<JoinErrors>({});
  const [checked, setChecked] = useState(false);
  const set = (k: keyof JoinValues) => (e: { target: { value: string } }) => {
    const next = { ...values, [k]: e.target.value };
    setValues(next);
    if (checked) setErrors(validateJoin(next));
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrors(validateJoin(values));
    setChecked(true);
  };
  const valid = checked && Object.keys(errors).length === 0;
  const field = (k: keyof JoinValues, label: string, opts: { type?: string; autoComplete?: string; required?: boolean; hint?: string; placeholder?: string }) => {
    const id = `join-${k}`;
    return <div className="join-field">
      <label htmlFor={id}>{label}{opts.required ? <span aria-hidden="true"> *</span> : <span className="join-optional"> (optional)</span>}</label>
      <input id={id} name={k} type={opts.type ?? 'text'} value={values[k]} onChange={set(k)} autoComplete={opts.autoComplete} placeholder={opts.placeholder}
        maxLength={JOIN_LIMITS[k]} required={opts.required} aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? `${id}-err` : opts.hint ? `${id}-hint` : undefined} />
      {opts.hint && !errors[k] ? <small id={`${id}-hint`}>{opts.hint}</small> : null}
      {errors[k] ? <small id={`${id}-err`} className="join-error" role="alert">{errors[k]}</small> : null}
    </div>;
  };
  return <form className="join-form" onSubmit={onSubmit} noValidate aria-describedby="join-preview-note">
    {field('name', 'Your name', { required: true, autoComplete: 'name' })}
    {field('company', 'Company or publication', { required: true, autoComplete: 'organization' })}
    {field('email', 'Email address', { type: 'email', required: true, autoComplete: 'email' })}
    {field('website', 'Website', { type: 'url', autoComplete: 'url', placeholder: 'https://', hint: 'Full address, starting with https://' })}
    <div className="join-field">
      <label htmlFor="join-message">Message<span aria-hidden="true"> *</span></label>
      <textarea id="join-message" name="message" rows={6} value={values.message} onChange={set('message')} maxLength={JOIN_LIMITS.message} required
        aria-invalid={errors.message ? true : undefined} aria-describedby={errors.message ? 'join-message-err' : undefined} />
      {errors.message ? <small id="join-message-err" className="join-error" role="alert">{errors.message}</small> : null}
    </div>
    <button type="submit" className="join-submit">Check my enquiry</button>
    {valid ? <p className="join-result" role="status">Thank you. Your details look complete. <strong>Preview only: nothing has been sent or stored.</strong> This form is not connected to a destination yet, so please email us directly using the address above.</p> : null}
  </form>;
}
