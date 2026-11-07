/**
 * Design Tokens — Aqua Pastel Theme (shadcn/ui style)
 * Font: Figtree
 * Radius: 0.5rem (8px)
 * Palette: Aqua Pastel (#5EE5BC), Dark Obsidian (#151618), Slate Cards (#1B1D20), Hairlines (#2B2E32)
 */

export const tokens = {
  colors: {
    // Core Aqua Pastel tokens
    background: '#151618',
    card: '#1B1D20',
    cardSoft: '#24262A',
    secondary: '#24262A',
    accent: '#24262A',
    muted: '#24262A',
    border: '#2B2E32',
    line: '#2B2E32',
    
    // Primary Aqua
    primary: '#5EE5BC',
    primaryHover: '#48D9AD',
    primaryActive: '#36C79A',
    primaryForeground: '#0C1D18',
    primaryTint: 'rgba(94, 229, 188, 0.12)',
    primaryGlow: 'rgba(94, 229, 188, 0.25)',

    // Destructive
    destructive: '#AB252C',
    destructiveHover: '#C9323A',
    destructiveTint: 'rgba(171, 37, 44, 0.18)',

    // Text hierarchy
    textPrimary: '#F7FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',

    // Status mapping with Aqua Pastel accents
    status: {
      paid: '#5EE5BC',
      paidTint: 'rgba(94, 229, 188, 0.12)',
      paidText: '#5EE5BC',
      pending: '#F59E0B',
      pendingTint: 'rgba(245, 158, 11, 0.12)',
      pendingText: '#FBBF24',
      underReview: '#F59E0B',
      underReviewTint: 'rgba(245, 158, 11, 0.12)',
      underReviewText: '#FBBF24',
      failed: '#AB252C',
      failedTint: 'rgba(171, 37, 44, 0.18)',
      failedText: '#F87171',
      expired: '#AB252C',
      expiredTint: 'rgba(171, 37, 44, 0.18)',
      expiredText: '#F87171',
      refunded: '#64748B',
      refundedTint: 'rgba(100, 116, 139, 0.18)',
      refundedText: '#94A3B8',
      desk: '#38BDF8',
      deskTint: 'rgba(56, 189, 248, 0.12)',
      deskText: '#38BDF8',
    },

    // Legacy semantic aliases (redirected to Aqua Pastel system)
    skyMist: '#151618',
    paper: '#1B1D20',
    iceBlue: '#24262A',
    electricBlue: '#5EE5BC',
    electricBlueHover: '#48D9AD',
    neonBlue: '#5EE5BC',
    freshGreen: '#5EE5BC',
    freshGreenTint: 'rgba(94, 229, 188, 0.12)',
    navyInk: '#F7FAFC',
    navySecondary: '#94A3B8',
  },

  fonts: {
    heading: "'Figtree', system-ui, -apple-system, sans-serif",
    body: "'Figtree', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },

  radius: {
    base: '0.5rem', // 8px
    input: '0.5rem',
    button: '0.5rem',
    card: '0.5rem',
    modal: '0.75rem',
    hero: '0.75rem',
  },

  shadows: {
    soft: '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 4px 12px 0 rgba(0, 0, 0, 0.4)',
    floating: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px #2B2E32',
    glowAqua: '0 0 20px rgba(94, 229, 188, 0.25)',
    focusRing: '0 0 0 2px #151618, 0 0 0 4px #5EE5BC',
  },

  motion: {
    durationFast: '150ms',
    durationBase: '200ms',
    durationSlow: '300ms',
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;

export type DesignTokens = typeof tokens;
