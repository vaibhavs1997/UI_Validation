import Link from 'next/link';
export default function ForgotPasswordPage() {
  return <main className="flex min-h-screen items-center justify-center px-6"><div className="w-full max-w-md rounded-2xl border border-[#e1e6ef] bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-semibold text-[#172033]">Reset your password</h1><p className="mt-3 text-sm leading-6 text-[#738097]">Password recovery will be available when the authentication service is connected.</p><Link href="/login" className="mt-6 inline-block font-semibold text-[#ad08d1]">Back to sign in</Link></div></main>;
}
