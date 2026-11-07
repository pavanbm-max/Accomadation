/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Aqua Pastel Theme System (shadcn/ui style)
        background: '#151618',
        card: '#1B1D20',
        'card-soft': '#24262A',
        secondary: '#24262A',
        accent: '#24262A',
        muted: '#24262A',
        border: '#2B2E32',
        line: '#2B2E32',

        primary: {
          DEFAULT: '#5EE5BC',
          hover: '#48D9AD',
          active: '#36C79A',
          foreground: '#0C1D18',
          tint: 'rgba(94, 229, 188, 0.12)',
          glow: 'rgba(94, 229, 188, 0.25)',
        },

        destructive: {
          DEFAULT: '#AB252C',
          hover: '#C9323A',
          tint: 'rgba(171, 37, 44, 0.18)',
        },

        // Text hierarchy
        'text-primary': '#F7FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',

        // Legacy palette mapped directly to Aqua Pastel
        'sky-mist': '#151618',
        'paper': '#1B1D20',
        'ice-blue': '#24262A',
        'electric-blue': '#5EE5BC',
        'electric-blue-hover': '#48D9AD',
        'neon-blue': '#5EE5BC',
        'fresh-green': '#5EE5BC',
        'fresh-green-tint': 'rgba(94, 229, 188, 0.12)',
        'navy-ink': '#F7FAFC',
        'navy-secondary': '#94A3B8',

        // Dark mode surfaces (matched to unified theme)
        'dark-page': '#151618',
        'dark-card': '#1B1D20',
        'dark-card-soft': '#24262A',
        'dark-line': '#2B2E32',
        'dark-text-primary': '#F7FAFC',
        'dark-text-secondary': '#94A3B8',

        // Status colours mapped to Aqua Pastel and clear semantic tones
        status: {
          paid: '#5EE5BC',
          'paid-tint': 'rgba(94, 229, 188, 0.12)',
          pending: '#F59E0B',
          'pending-tint': 'rgba(245, 158, 11, 0.12)',
          review: '#F59E0B',
          'review-tint': 'rgba(245, 158, 11, 0.12)',
          failed: '#AB252C',
          'failed-tint': 'rgba(171, 37, 44, 0.18)',
          expired: '#AB252C',
          'expired-tint': 'rgba(171, 37, 44, 0.18)',
          refunded: '#64748B',
          'refunded-tint': 'rgba(100, 116, 139, 0.18)',
          desk: '#38BDF8',
          'desk-tint': 'rgba(56, 189, 248, 0.12)',
        },

        // Backward-compatible brand alias
        brand: {
          50: '#151618',
          100: '#1B1D20',
          200: '#24262A',
          300: '#2B2E32',
          400: '#36C79A',
          500: '#5EE5BC',
          600: '#5EE5BC',
          700: '#48D9AD',
          800: '#36C79A',
          900: '#0C1D18',
        },
        surface: {
          light: '#151618',
          card: '#1B1D20',
          subtle: '#24262A',
          border: '#2B2E32',
        },
      },
      fontFamily: {
        heading: ['Figtree', 'system-ui', 'sans-serif'],
        display: ['Figtree', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '0.75rem',
        'input': '0.5rem',
        'btn': '0.5rem',
        'card': '0.5rem',
        'modal': '0.75rem',
        'hero': '0.75rem',
      },
      boxShadow: {
        'soft': '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 4px 12px 0 rgba(0, 0, 0, 0.4)',
        'floating': '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px #2B2E32',
        'glow-aqua': '0 0 24px rgba(94, 229, 188, 0.22)',
        'focus-neon': '0 0 0 2px #151618, 0 0 0 4px #5EE5BC',
        'focus-neon-dark': '0 0 0 2px #151618, 0 0 0 4px #5EE5BC',
      },
      transitionTimingFunction: {
        'ease-out-custom': 'cubic-bezier(0.16, 1, 0.3, 1)',
      }
    },
  },
  plugins: [],
}
