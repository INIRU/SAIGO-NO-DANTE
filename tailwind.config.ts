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
        'bg-deep':     '#0d0b08',
        'bg-card':     '#1a1510',
        'bg-elevated': '#241c12',
        'bg-panel':    '#120e09',
        'gold':        '#c8900a',
        'gold-light':  '#e8b030',
        'gold-dim':    '#8a6010',
        'crimson':     '#8b1a1a',
        'border-dim':  '#3a2a15',
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
      fontFamily: {
        serif:   ['var(--font-song-myung)', '"KotraBold"', 'Georgia', 'serif'],
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
