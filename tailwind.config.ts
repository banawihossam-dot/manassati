import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        surface2: v('surface2'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        primary: v('primary'),
        'primary-ink': v('primary-ink'),
        accent: v('accent'),
        danger: v('danger'),
        success: v('success'),
      },
      fontFamily: { sans: ['var(--font-plex)', 'Tahoma', 'Arial', 'sans-serif'] },
      boxShadow: { lift: '0 1px 0 rgb(var(--line)), 0 8px 24px -12px rgb(var(--ink) / 0.18)' },
    },
  },
  plugins: [],
};
export default config;
