import React from 'react';

export interface LogoPlaceholderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'horizontal' | 'icon-only' | 'stacked' | 'full' | 'dual' | 'gmu' | 'ignitron';
  className?: string;
  showBadge?: boolean;
  accent?: 'aqua' | 'white';
}

export const GMU_LOGO_PATH = '/gmu-logo.png';
export const IGNITRON_LOGO_PATH = '/ignitron-2k26-logo.png';

/**
 * Standalone GM University Crest Logo
 * Preserves authentic royal gold graphics and typography without alteration.
 */
export const GmuLogo: React.FC<{
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const heights = {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
    xl: 'h-20 sm:h-24',
  };
  return (
    <img
      src={GMU_LOGO_PATH}
      alt="GM University - Innovating Minds"
      className={`${heights[size]} w-auto object-contain select-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] transition-transform duration-200 hover:scale-[1.03] ${className}`}
      loading="eager"
    />
  );
};

/**
 * Standalone IGNITRON 2K26 Typographic Logo
 * Preserves authentic crisp white lettering and letterform star sparkle without alteration.
 */
export const IgnitronLogo: React.FC<{
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const heights = {
    xs: 'h-4 sm:h-5',
    sm: 'h-6 sm:h-7',
    md: 'h-8 sm:h-9',
    lg: 'h-11 sm:h-13',
    xl: 'h-14 sm:h-18',
  };
  return (
    <img
      src={IGNITRON_LOGO_PATH}
      alt="IGNITRON 2K26"
      className={`${heights[size]} w-auto object-contain select-none drop-shadow-[0_2px_16px_rgba(0,0,0,0.7)] transition-transform duration-200 hover:scale-[1.03] ${className}`}
      loading="eager"
    />
  );
};

/**
 * OFFICIAL BRAND IDENTITY LOCKUP
 * Showcases both GM University crest and IGNITRON 2K26 official logo
 * side-by-side with pristine sharpness, authentic coloring, and proportional alignment.
 */
export const LogoPlaceholder: React.FC<LogoPlaceholderProps> = ({
  size = 'md',
  variant = 'horizontal',
  className = '',
  showBadge = false,
}) => {
  // 1. GMU Logo Only
  if (variant === 'gmu') {
    return <GmuLogo size={size} className={className} />;
  }

  // 2. Ignitron Logo Only
  if (variant === 'ignitron') {
    return <IgnitronLogo size={size} className={className} />;
  }

  // 3. Icon Only (GMU Crest with subtle framed backdrop)
  if (variant === 'icon-only') {
    return (
      <div className={`inline-flex items-center justify-center p-1.5 rounded-xl bg-[#061419]/90 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] select-none ${className}`}>
        <GmuLogo size={size} />
      </div>
    );
  }

  // 4. Stacked Hero Variant (GM University on top, IGNITRON 2K26 below, centered)
  if (variant === 'stacked') {
    const gmuHeights = {
      xs: 'h-8',
      sm: 'h-12',
      md: 'h-16 sm:h-20',
      lg: 'h-24 sm:h-28',
      xl: 'h-32 sm:h-36',
    };
    const ignitronHeights = {
      xs: 'h-5',
      sm: 'h-7',
      md: 'h-10 sm:h-12',
      lg: 'h-14 sm:h-16',
      xl: 'h-18 sm:h-22',
    };

    return (
      <div className={`flex flex-col items-center text-center select-none gap-3.5 ${className}`}>
        {/* GM University Crest */}
        <div className="relative group">
          <div className="relative flex items-center justify-center p-3 sm:p-4 rounded-2xl bg-[#061419]/90 backdrop-blur-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
            <img
              src={GMU_LOGO_PATH}
              alt="GM University"
              className={`${gmuHeights[size]} w-auto object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-transform duration-200 group-hover:scale-105`}
              loading="eager"
            />
          </div>
        </div>

        {/* IGNITRON 2K26 Official Typography */}
        <div className="flex flex-col items-center pt-1">
          <img
            src={IGNITRON_LOGO_PATH}
            alt="IGNITRON 2K26"
            className={`${ignitronHeights[size]} w-auto object-contain drop-shadow-[0_2px_16px_rgba(0,0,0,0.7)]`}
            loading="eager"
          />
          <span className="tracking-widest uppercase font-semibold text-[#9FB9C1] text-[11px] sm:text-xs mt-2">
            Hostel Stays &amp; Accommodation
          </span>
        </div>
      </div>
    );
  }

  // 5. Full Hero Lockup (Horizontal pill with both logos)
  if (variant === 'full') {
    return (
      <div className={`inline-flex items-center gap-3 sm:gap-5 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl bg-[#061419]/85 backdrop-blur-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.65)] select-none ${className}`}>
        <img
          src={GMU_LOGO_PATH}
          alt="GM University"
          className="h-10 sm:h-14 w-auto object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
          loading="eager"
        />
        <div className="h-8 sm:h-10 w-px bg-white/20" />
        <img
          src={IGNITRON_LOGO_PATH}
          alt="IGNITRON 2K26"
          className="h-7 sm:h-10 w-auto object-contain drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]"
          loading="eager"
        />
      </div>
    );
  }

  // 6. Horizontal Dual Lockup (Navbar, Headers, Cards, Boarding Pass)
  const sizeConfig = {
    xs: {
      gap: 'gap-2',
      gmuH: 'h-6 sm:h-7',
      dividerH: 'h-4 sm:h-5',
      ignitronH: 'h-4 sm:h-5',
      badge: 'text-[8px] px-1 py-0.2',
      sub: 'text-[9px]',
    },
    sm: {
      gap: 'gap-2.5',
      gmuH: 'h-7 sm:h-8',
      dividerH: 'h-5 sm:h-6',
      ignitronH: 'h-5 sm:h-6',
      badge: 'text-[9px] px-1.5 py-0.5',
      sub: 'text-[10px]',
    },
    md: {
      gap: 'gap-3 sm:gap-3.5',
      gmuH: 'h-8 sm:h-10',
      dividerH: 'h-6 sm:h-7',
      ignitronH: 'h-6 sm:h-7',
      badge: 'text-[10px] px-2 py-0.5',
      sub: 'text-[11px]',
    },
    lg: {
      gap: 'gap-3.5 sm:gap-4',
      gmuH: 'h-12 sm:h-14',
      dividerH: 'h-8 sm:h-10',
      ignitronH: 'h-9 sm:h-11',
      badge: 'text-[11px] px-2.5 py-0.5',
      sub: 'text-xs',
    },
    xl: {
      gap: 'gap-4 sm:gap-6',
      gmuH: 'h-16 sm:h-20',
      dividerH: 'h-12 sm:h-14',
      ignitronH: 'h-12 sm:h-15',
      badge: 'text-xs px-3 py-1',
      sub: 'text-sm',
    },
  };

  const cfg = sizeConfig[size];

  return (
    <div className={`inline-flex items-center select-none ${cfg.gap} ${className}`}>
      {/* GM University Crest */}
      <img
        src={GMU_LOGO_PATH}
        alt="GM University"
        className={`${cfg.gmuH} w-auto object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] flex-shrink-0 transition-transform duration-200 hover:scale-105`}
        loading="eager"
      />

      {/* Elegant Vertical Divider */}
      <div className={`${cfg.dividerH} w-px bg-white/20 flex-shrink-0`} />

      {/* IGNITRON 2K26 Official Wordmark */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <img
          src={IGNITRON_LOGO_PATH}
          alt="IGNITRON 2K26"
          className={`${cfg.ignitronH} w-auto object-contain drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] transition-transform duration-200 hover:scale-105`}
          loading="eager"
        />
        {showBadge && (
          <span className={`font-mono font-bold tracking-wider uppercase bg-[#00F5B8]/15 text-[#00F5B8] rounded border border-[#00F5B8]/30 shadow-[0_0_8px_rgba(0,245,184,0.2)] hidden sm:inline-block ${cfg.badge}`}>
            STAYS
          </span>
        )}
      </div>
    </div>
  );
};

// Also export as BrandLogo for clarity
export const BrandLogo = LogoPlaceholder;
