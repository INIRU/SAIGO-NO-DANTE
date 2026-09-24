'use client';

import { useState, useRef, useEffect } from 'react';
import { Languages, ChevronDown, Check } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/lib/i18n/navigation';
import { SUPPORTED_LANGS } from '@/lib/i18n/types';

export default function LanguageSwitcher({ up = false }: { up?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SUPPORTED_LANGS.find(l => l.value === locale);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative" style={{ position: 'relative', zIndex: open ? 60 : 0 }}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[0.875rem] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-[rgba(200,144,10,0.06)] hover:text-[var(--gold-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)] ${open ? 'bg-[rgba(200,144,10,0.06)] text-[var(--gold-light)]' : 'text-[var(--text-secondary)]'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Languages size={16} aria-hidden="true" />
        {current?.nativeLabel}
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{
            opacity: 0.5,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className={`absolute right-0 z-50 min-w-[9rem] rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-[var(--shadow-lg)] ${up ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          {SUPPORTED_LANGS.map(l => {
            const isActive = l.value === locale;
            return (
              <button
                key={l.value}
                role="option"
                aria-selected={isActive}
                onClick={() => { router.replace(pathname, { locale: l.value }); setOpen(false); }}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[0.3125rem] px-3 py-2 text-[0.875rem] transition-colors hover:bg-[rgba(200,144,10,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)] ${isActive ? 'text-[var(--gold-light)]' : 'text-[var(--text-secondary)] hover:text-[var(--gold-light)]'}`}
              >
                <span className="flex-1 text-left">{l.nativeLabel}</span>
                {isActive && <Check size={14} style={{ color: 'var(--gold)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
