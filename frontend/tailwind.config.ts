import type { Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--color-bg-app)',
          surface: 'var(--color-bg-surface)',
          subtle: 'var(--color-bg-subtle)',
          elevated: 'var(--color-bg-elevated)',
        },
        border: {
          subtle: 'var(--color-border-subtle)',
          default: 'var(--color-border-default)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          subtle: 'var(--color-accent-subtle)',
          fg: 'var(--color-accent-fg)',
        },
        risk: {
          low: 'var(--color-risk-low)',
          'low-bg': 'var(--color-risk-low-bg)',
          'low-border': 'var(--color-risk-low-border)',
          moderate: 'var(--color-risk-mod)',
          'moderate-bg': 'var(--color-risk-mod-bg)',
          'moderate-border': 'var(--color-risk-mod-border)',
          high: 'var(--color-risk-high)',
          'high-bg': 'var(--color-risk-high-bg)',
          'high-border': 'var(--color-risk-high-border)',
        },
        semantic: {
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        input: '8px',
        btn: '8px',
        card: '12px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['11px', '14px'],
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['20px', '28px'],
        stat: ['28px', '32px'],
      },
      maxWidth: {
        content: '1280px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        floating: '0 4px 12px 0 rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
