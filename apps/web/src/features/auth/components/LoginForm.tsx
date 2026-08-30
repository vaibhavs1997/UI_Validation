'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '../auth.service';
import { validateLogin, type LoginErrors } from '../validation';
import { PasswordField } from './PasswordField';
import { SocialLoginButtons } from './SocialLoginButtons';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({}); const [formError, setFormError] = useState(''); const [loading, setLoading] = useState(false);
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const nextErrors = validateLogin({ email, password }); setErrors(nextErrors); setFormError('');
    if (Object.keys(nextErrors).length > 0 || loading) return; setLoading(true);
    const result = await signIn({ email, password });
    if (result.ok) router.replace('/dashboard'); else setFormError(result.message ?? (result.code === 'invalid_credentials' ? 'The email or password is incorrect. Check both and try again.' : result.code === 'auth_not_enabled' ? 'Email and password sign-in is not enabled in Firebase Authentication.' : result.code === 'configuration' ? 'Firebase is not configured. Check the local environment settings.' : result.code === 'session_error' ? 'Your credentials were accepted, but we could not start your workspace session. Please try again in a moment.' : 'We could not reach the sign-in service. Check your connection and try again.'));
    setLoading(false);
  }
  return <form onSubmit={handleSubmit} noValidate className="mt-9 space-y-5">
    {formError && <div role="alert" className="rounded-xl border border-[#f2c8cd] bg-[#fff5f6] px-4 py-3 text-sm text-[#a72f3d]">{formError}</div>}
    <div><label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#542060]">Email address</label><input id="email" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} className="liquid-control h-12 w-full rounded-xl px-4 text-[15px] text-[#4a1657] outline-none transition placeholder:text-[#9aa5b8]" placeholder="you@company.com" />{errors.email && <p id="email-error" className="mt-2 text-sm text-[#c43d4b]">{errors.email}</p>}</div>
    <PasswordField value={password} onChange={setPassword} error={errors.password} />
    <div className="flex items-center justify-between text-sm"><label className="flex cursor-pointer items-center gap-2 text-[#7c5a84]"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-[#cbd4e3] accent-[#ad08d1]" /> Remember me</label><Link href="/forgot-password" className="font-semibold text-[#ad08d1] hover:text-[#790493] focus:outline-none focus:ring-2 focus:ring-[#ad08d1]">Forgot password?</Link></div>
    <button type="submit" disabled={loading} className="liquid-primary h-12 w-full rounded-xl text-sm font-bold text-white transition focus:outline-none focus:ring-4 focus:ring-[#ad08d1]/30 disabled:cursor-not-allowed disabled:opacity-60"><span className="relative">{loading ? 'Signing in...' : 'Sign in'}</span></button>
    <div className="flex items-center gap-3 py-1 text-xs font-medium text-[#8b96aa]"><span className="h-px flex-1 bg-[#e4e8f0]" /> or continue with <span className="h-px flex-1 bg-[#e4e8f0]" /></div><SocialLoginButtons />
    <p className="pt-2 text-center text-sm text-[#7c5a84]">Don&apos;t have an account? <Link href="/register" className="font-bold text-[#ad08d1] hover:text-[#790493]">Create an account</Link></p>
  </form>;
}
