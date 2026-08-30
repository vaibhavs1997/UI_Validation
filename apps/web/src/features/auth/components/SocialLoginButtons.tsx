export function SocialLoginButtons() {
  return <div className="space-y-3">
    <button type="button" disabled title="OAuth is not configured yet" className="liquid-social flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#7c5a84] opacity-70"><span className="text-base font-bold text-[#ad08d1]">G</span> Continue with Google</button>
    <button type="button" disabled title="OAuth is not configured yet" className="liquid-social flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#7c5a84] opacity-70"><span className="text-base font-bold text-[#ad08d1]">▦</span> Continue with Microsoft</button>
  </div>;
}
