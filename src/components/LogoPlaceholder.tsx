import React from 'react';

interface LogoPlaceholderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'horizontal' | 'icon-only' | 'stacked' | 'full';
  className?: string;
  showBadge?: boolean;
  accent?: 'aqua' | 'white';
}

/**
 * IGNITRON BRAND LOGO COMPONENT
 * Renders the official Ignitron 2K26 circuit-tree emblem and identity mark.
 * Designed with bold visibility, Aqua Pastel aesthetics, and luminous glow.
 */
export const LogoPlaceholder: React.FC<LogoPlaceholderProps> = ({
  size = 'md',
  variant = 'horizontal',
  className = '',
  showBadge = false,
  accent = 'aqua',
}) => {
  const emblemSrc = accent === 'aqua' 
    ? '/ignitron-emblem-aqua.png' 
    : '/ignitron-emblem-white.png';

  const fullLogoSrc = accent === 'aqua'
    ? '/ignitron-logo-aqua.png'
    : '/ignitron-logo-white.png';

  // 1. Full Combined Logo (Circuit Tree + IGNITRON 2K26 in one lockup)
  if (variant === 'full') {
    const fullHeights = {
      xs: 'h-10',
      sm: 'h-14',
      md: 'h-20 sm:h-24',
      lg: 'h-28 sm:h-32',
      xl: 'h-36 sm:h-44',
    };
    return (
      <div className={`inline-flex items-center justify-center select-none ${className}`}>
        <img
          src={fullLogoSrc}
          alt="Ignitron 2K26"
          className={`${fullHeights[size]} w-auto object-contain drop-shadow-[0_0_24px_rgba(94,229,188,0.3)] transition-transform duration-200 hover:scale-[1.02]`}
          loading="eager"
        />
      </div>
    );
  }

  // 2. Icon / Emblem Only
  if (variant === 'icon-only') {
    const iconHeights = {
      xs: 'h-6',
      sm: 'h-8',
      md: 'h-11 sm:h-12',
      lg: 'h-16 sm:h-18',
      xl: 'h-24 sm:h-28',
    };
    return (
      <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
        <div className="relative flex items-center justify-center px-3 py-2 rounded-xl bg-[#1B1D20] border border-[#2B2E32] shadow-[0_0_20px_rgba(94,229,188,0.18)] transition-all duration-200 hover:border-[#5EE5BC]/50 hover:shadow-[0_0_28px_rgba(94,229,188,0.32)]">
          <img
            src={emblemSrc}
            alt="Ignitron Emblem"
            className={`${iconHeights[size]} w-auto object-contain drop-shadow-[0_0_12px_rgba(94,229,188,0.25)]`}
            loading="eager"
          />
        </div>
      </div>
    );
  }

  // 3. Stacked Hero Variant (Center emblem on top, large brand name below)
  if (variant === 'stacked') {
    const stackedHeights = {
      xs: 'h-8',
      sm: 'h-12',
      md: 'h-16 sm:h-20',
      lg: 'h-24 sm:h-28',
      xl: 'h-32 sm:h-36',
    };
    return (
      <div className={`flex flex-col items-center text-center select-none gap-3 ${className}`}>
        <div className="relative group">
          <div className="absolute -inset-2 bg-gradient-to-r from-[#5EE5BC]/20 via-[#5EE5BC]/30 to-[#5EE5BC]/20 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition duration-300" />
          <div className="relative flex items-center justify-center px-5 py-3 rounded-2xl bg-[#1B1D20] border border-[#2B2E32] shadow-[0_0_24px_rgba(94,229,188,0.2)]">
            <img
              src={emblemSrc}
              alt="Ignitron Emblem"
              className={`${stackedHeights[size]} w-auto object-contain drop-shadow-[0_0_16px_rgba(94,229,188,0.3)] transition-transform duration-200 group-hover:scale-105`}
              loading="eager"
            />
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black tracking-tight text-[#F7FAFC] text-2xl sm:text-3xl leading-none">
              IGNITRON
            </span>
            <span className="font-mono font-bold tracking-wider uppercase bg-[#5EE5BC]/15 text-[#5EE5BC] px-2 py-0.5 rounded border border-[#5EE5BC]/30 text-xs">
              2K26
            </span>
          </div>
          <span className="tracking-widest uppercase font-semibold text-[#94A3B8] text-xs mt-1">
            Hostel Stays &amp; Accommodation
          </span>
        </div>
      </div>
    );
  }

  // 4. Horizontal Variant (Navbar, Cards, Sidebars, Ticket headers)
  const sizeConfig = {
    xs: {
      gap: 'gap-2',
      imgH: 'h-6',
      pad: 'px-2 py-1',
      title: 'text-sm font-bold',
      sub: 'text-[9px]',
      badge: 'text-[8px] px-1 py-0.2',
    },
    sm: {
      gap: 'gap-2.5',
      imgH: 'h-8',
      pad: 'px-2.5 py-1.5',
      title: 'text-base font-extrabold',
      sub: 'text-[10px]',
      badge: 'text-[9px] px-1.5 py-0.5',
    },
    md: {
      gap: 'gap-3 sm:gap-3.5',
      imgH: 'h-9 sm:h-10',
      pad: 'px-3 py-1.5',
      title: 'text-lg sm:text-xl font-extrabold',
      sub: 'text-[11px]',
      badge: 'text-[10px] px-2 py-0.5',
    },
    lg: {
      gap: 'gap-3.5 sm:gap-4',
      imgH: 'h-12 sm:h-14',
      pad: 'px-4 py-2',
      title: 'text-xl sm:text-2xl font-black',
      sub: 'text-xs',
      badge: 'text-[11px] px-2.5 py-0.5',
    },
    xl: {
      gap: 'gap-4 sm:gap-5',
      imgH: 'h-16 sm:h-20',
      pad: 'px-5 py-2.5',
      title: 'text-2xl sm:text-3xl font-black',
      sub: 'text-sm',
      badge: 'text-xs px-3 py-1',
    },
  };

  const cfg = sizeConfig[size];

  return (
    <div className={`inline-flex items-center select-none ${cfg.gap} ${className}`}>
      {/* Circuit Tree Emblem Container */}
      <div className={`relative flex items-center justify-center bg-[#1B1D20] border border-[#2B2E32] rounded-xl ${cfg.pad} shadow-[0_0_18px_rgba(94,229,188,0.18)] transition-all duration-200 hover:border-[#5EE5BC]/50 hover:shadow-[0_0_24px_rgba(94,229,188,0.3)]`}>
        <img
          src={emblemSrc}
          alt="Ignitron Emblem"
          className={`${cfg.imgH} w-auto object-contain drop-shadow-[0_0_10px_rgba(94,229,188,0.25)] transition-transform duration-200 group-hover:scale-105`}
          loading="eager"
        />
      </div>

      {/* Brand Wordmark and Descriptor */}
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className={`font-heading tracking-tight text-[#F7FAFC] leading-none ${cfg.title}`}>
            IGNITRON
          </span>
          {showBadge && (
            <span className={`font-mono font-bold tracking-wider uppercase bg-[#5EE5BC]/15 text-[#5EE5BC] rounded border border-[#5EE5BC]/30 shadow-[0_0_8px_rgba(94,229,188,0.15)] ${cfg.badge}`}>
              2K26
            </span>
          )}
        </div>
        <span className={`tracking-widest uppercase font-semibold text-[#94A3B8] leading-tight mt-1 hidden xs:block ${cfg.sub}`}>
          Hostel Stays
        </span>
      </div>
    </div>
  );
};

// Also export as BrandLogo for clarity
export const BrandLogo = LogoPlaceholder;
