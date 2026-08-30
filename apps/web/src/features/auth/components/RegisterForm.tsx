'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '../auth.service';
import { validateRegister, type RegisterErrors } from '../validation';
import { PasswordField } from './PasswordField';

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { name, email, password, confirmPassword, acceptedTerms };
    const nextErrors = validateRegister(values);
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0 || loading) return;
    setLoading(true);
    const result = await register(values);
    if (result.ok) router.replace('/dashboard');
    else setFormError(result.message ?? (result.code === 'duplicate_email' ? 'An account with this email already exists. Try signing in instead.' : result.code === 'auth_not_enabled' ? 'Email and password sign-in is not enabled in Firebase Authentication.' : result.code === 'configuration' ? 'Firebase is not configured. Check the local environment settings.' : result.code === 'session_error' ? 'Your account was created, but we could not start your workspace session. Please sign in again.' : 'We could not reach the registration service. Check your connection and try again.'));
    setLoading(false);
  }

  return <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
    {formError && <div role="alert" className="rounded-xl border border-[#f2c8cd] bg-[#fff5f6] px-4 py-3 text-sm text-[#a72f3d]">{formError}</div>}
    <div>
      <label htmlFor="name" className="mb-2 block text-sm font-semibold text-[#542060]">Full name</label>
      <input id="name" name="name" type="text" required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} className="liquid-control h-12 w-full rounded-xl px-4 text-[15px] text-[#4a1657] outline-none transition placeholder:text-[#9aa5b8]" placeholder="Your full name" />
      {errors.name && <p id="name-error" className="mt-2 text-sm text-[#c43d4b]">{errors.name}</p>}
    </div>
    <div>
      <label htmlFor="register-email" className="mb-2 block text-sm font-semibold text-[#542060]">Work email</label>
      <input id="register-email" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'register-email-error' : undefined} className="liquid-control h-12 w-full rounded-xl px-4 text-[15px] text-[#4a1657] outline-none transition placeholder:text-[#9aa5b8]" placeholder="you@company.com" />
      {errors.email && <p id="register-email-error" className="mt-2 text-sm text-[#c43d4b]">{errors.email}</p>}
    </div>
    <PasswordField id="register-password" label="Password" autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} />
    <p className="-mt-2 text-xs text-[#7c5a84]">Use at least 8 characters, including one letter and one number.</p>
    <PasswordField id="confirm-password" label="Confirm password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} error={errors.confirmPassword} />
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-[#7c5a84]"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} aria-invalid={Boolean(errors.acceptedTerms)} aria-describedby={errors.acceptedTerms ? 'terms-error' : undefined} className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#cbd4e3] accent-[#ad08d1]" /> <span>I agree to the Terms of Service and Privacy Policy.</span></label>
      {errors.acceptedTerms && <p id="terms-error" className="mt-2 text-sm text-[#c43d4b]">{errors.acceptedTerms}</p>}
    </div>
    <button type="submit" disabled={loading} className="liquid-primary h-12 w-full rounded-xl text-sm font-bold text-white transition focus:outline-none focus:ring-4 focus:ring-[#ad08d1]/30 disabled:cursor-not-allowed disabled:opacity-60"><span className="relative">{loading ? 'Creating account...' : 'Create account'}</span></button>
    <p className="pt-2 text-center text-sm text-[#6b7890]">Already have an account? <Link href="/login" className="font-bold text-[#ad08d1] hover:text-[#790493]">Sign in</Link></p>
  </form>;
}
