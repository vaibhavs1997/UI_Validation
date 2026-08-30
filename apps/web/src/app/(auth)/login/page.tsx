import { AuthBrandPanel } from '@/features/auth/components/AuthBrandPanel';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-5 p-4 sm:p-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch lg:gap-6 lg:p-8 xl:p-10">
      <AuthBrandPanel />
      <section className="glass-form-panel flex min-h-[720px] flex-1 items-center justify-center rounded-[28px] border px-6 py-12 shadow-[0_24px_70px_rgba(125,32,143,0.12)] backdrop-blur-xl sm:px-10 lg:px-14 xl:px-20">
        <div className="w-full max-w-[430px]">
          <div className="mb-12 flex items-center gap-2 text-lg font-bold tracking-[-0.03em] text-[#4a1657] lg:hidden"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#ad08d1] text-xs text-white">V</span> VisionQA</div>
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-[#ad08d1]">Secure workspace access</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#4a1657] sm:text-[34px]">Welcome back</h1>
          <p className="mt-3 text-[15px] leading-6 text-[#7c5a84]">Sign in to continue to your VisionQA workspace.</p>
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
