'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Languages, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { SUPPORTED_LANGS } from '@/lib/i18n/types';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SUPPORTED_LANGS.find(l => l.value === lang);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative" style={{ position: 'relative', zIndex: 0 }}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all duration-200"
        style={{
          border: '1px solid rgba(200,144,10,0.25)',
          background: open ? 'rgba(200,144,10,0.12)' : 'rgba(200,144,10,0.04)',
          color: '#e8dcc8',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Languages size={15} style={{ color: 'var(--gold-dim)' }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
          {current?.nativeLabel}
        </span>
        <ChevronDown
          size={11}
          style={{
            opacity: 0.4,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 rounded-lg overflow-hidden"
          style={{
            border: '1px solid rgba(200,144,10,0.2)',
            background: 'var(--bg-card)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,144,10,0.08)',
            zIndex: 50,
            minWidth: '9rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {SUPPORTED_LANGS.map(l => {
            const isActive = l.value === lang;
            return (
              <button
                key={l.value}
                role="option"
                aria-selected={isActive}
                onClick={() => { setLang(l.value); setOpen(false); router.refresh(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors"
                style={{
                  color: isActive ? 'var(--gold-light)' : '#a08a60',
                  background: isActive ? 'rgba(200,144,10,0.1)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.8125rem',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(200,144,10,0.06)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
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
