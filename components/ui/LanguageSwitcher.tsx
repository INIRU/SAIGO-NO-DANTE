'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { SUPPORTED_LANGS } from '@/lib/i18n/types';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = SUPPORTED_LANGS.find(l => l.value === lang);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-2 py-1 text-sm rounded border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-xs">{current?.nativeLabel}</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 w-36 rounded border border-neutral-700 bg-neutral-900 shadow-lg z-50 overflow-hidden"
        >
          {SUPPORTED_LANGS.map(l => (
            <button
              key={l.value}
              role="option"
              aria-selected={l.value === lang}
              onClick={() => {
                setLang(l.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-800 transition-colors ${
                l.value === lang ? 'text-amber-400 bg-neutral-800/50' : 'text-neutral-300'
              }`}
            >
              {l.nativeLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
