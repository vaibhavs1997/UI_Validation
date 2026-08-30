'use client';
import { useState } from 'react';

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  id?: string | undefined;
  label?: string | undefined;
  autoComplete?: 'current-password' | 'new-password' | undefined;
};

export function PasswordField({ value, onChange, error, id = 'password', label = 'Password', autoComplete = 'current-password' }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  return <div>
    <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#542060]">{label}</label>
    <div className="relative">
      <input id={id} name={id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="liquid-control h-12 w-full rounded-xl px-4 pr-20 text-[15px] text-[#4a1657] outline-none transition placeholder:text-[#9aa5b8]" />
      <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-[#ad08d1] hover:bg-[#faeaff] focus:outline-none focus:ring-2 focus:ring-[#ad08d1]">{visible ? 'Hide' : 'Show'}</button>
    </div>
    {error && <p id={errorId} className="mt-2 text-sm text-[#c43d4b]">{error}</p>}
  </div>;
}
