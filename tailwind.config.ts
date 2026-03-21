import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-deep':     'var(--bg-deep)',
        'bg-card':     'var(--bg-card)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-panel':    'var(--bg-panel)',
        'gold':        'var(--gold)',
        'gold-light':  'var(--gold-light)',
        'gold-dim':    'var(--gold-dim)',
        'crimson':     'var(--crimson)',
        'border-dim':  'var(--border)',
        // 텍스트 위계
        'txt-primary':   'var(--text-primary)',
        'txt-secondary': 'var(--text-secondary)',
        'txt-tertiary':  'var(--text-tertiary)',
        'txt-muted':     'var(--text-muted)',
        'txt-accent':    'var(--text-accent)',
        // 상태
        'success': 'var(--success)',
        'warning': 'var(--warning)',
        'error':   'var(--error)',
        'info':    'var(--info)',
        sin: {
          wrath:    '#c83030',
          lust:     '#d06030',
          sloth:    '#d4b830',
          gluttony: '#88b028',
          gloom:    '#4898b0',
          pride:    '#3870b0',
          envy:     '#8058a8',
        },
      },
      borderRadius: {
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm:         'var(--shadow-sm)',
        md:         'var(--shadow-md)',
        lg:         'var(--shadow-lg)',
        glow:       'var(--shadow-glow)',
        'glow-hover': 'var(--shadow-glow-hover)',
      },
      fontFamily: {
        serif:   ['"Paperlogy"', '"KotraBold"', 'Georgia', 'serif'],
        mono:    ['"PerfectDOS"', '"JetBrains Mono"', 'monospace'],
        sans:    ['"SCDream"', '"Pretendard"', 'sans-serif'],
        logo:    ['"CorporateLogo"', '"BebasKai"', 'sans-serif'],
        title:   ['"BebasKai"', 'sans-serif'],
        display: ['var(--font-black-han)', '"SCDream"', 'sans-serif'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%':   { boxShadow: '0 0 5px #c8900a40' },
          '100%': { boxShadow: '0 0 20px #c8900a80, 0 0 40px #c8900a40' },
        },
      },
    },
  },
  plugins: [],
}

export default config
