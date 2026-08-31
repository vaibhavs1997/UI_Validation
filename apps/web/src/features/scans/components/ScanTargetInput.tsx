'use client';

import { useEffect } from 'react';

export function ScanTargetInput({ value, onChange, error, disabled = false }: { value: string; onChange: (value: string) => void; error?: string | null; disabled?: boolean }) {
  useEffect(() => {
    if (value) return;
    const target = new URLSearchParams(window.location.search).get('url');
    if (target) onChange(target);
  }, [onChange, value]);
  return <label className="block text-sm font-semibold text-[#542064]">Target URL<input required type="url" className="liquid-control mt-2 block w-full rounded-xl px-4 py-3 text-[#32133f] outline-none" placeholder="https://example.com" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />{error && <span className="mt-2 block text-sm font-normal text-red-700" role="alert">{error}</span>}</label>;
}
