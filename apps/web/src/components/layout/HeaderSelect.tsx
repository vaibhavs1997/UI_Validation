'use client';

import { useEffect, useRef, useState } from 'react';

type Option = { value: string; label: string };
export function HeaderSelect({ label, value, options, onChange, dot = false }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; dot?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value)?.label ?? 'Select';
  useEffect(() => { const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; document.addEventListener('mousedown', close); document.addEventListener('keydown', escape); return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); }; }, []);
  return <div className="header-select" ref={root}><button className="header-select-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((currentOpen) => !currentOpen)}>{dot && <span className="header-select-dot" aria-hidden="true" />}<small>{label}</small><strong>{current}</strong><span className="header-select-chevron" aria-hidden="true">v</span></button>{open && <div className="header-select-menu" role="listbox" aria-label={label}>{options.map((option) => <button className={`header-select-option ${option.value === value ? 'header-select-option-active' : ''}`} role="option" aria-selected={option.value === value} type="button" key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}</div>}</div>;
}
