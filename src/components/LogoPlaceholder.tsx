import React from 'react';
import { Building2 } from 'lucide-react';

interface LogoPlaceholderProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark' | 'auto';
  className?: string;
  showBadge?: boolean;
}

/**
 * PLACEHOLDER LOGO COMPONENT
 * Redesigned with Aqua Pastel identity and refined Figtree typography.
 * TODO: Replace with institution / festival vector logo asset.
 */
export const LogoPlaceholder: React.FC<LogoPlaceholderProps> = ({
  size = 'md',
  className = '',
  showBadge = true,
}) => {
  const sizeClasses = {
    sm: 'h-8 text-xs gap-2',
    md: 'h-10 text-sm gap-2.5',
    lg: 'h-12 text-base gap-3',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4.5 h-4.5',
    lg: 'w-5 h-5',
  };

  return (
    <div className={`inline-flex items-center select-none ${sizeClasses[size]} ${className}`}>
      {/* Icon badge - Aqua Pastel accent with subtle luminous aura */}
      <div className="relative flex items-center justify-center rounded-md bg-[#5EE5BC]/10 text-[#5EE5BC] p-2 border border-[#5EE5BC]/25 shadow-[0_0_12px_rgba(94,229,188,0.15)] transition-transform duration-150 hover:scale-105">
        <Building2 className={iconSizes[size]} />
        <span className="sr-only">Hostel Logo</span>
      </div>

      <div className="flex flex-col text-left">
        <span className="font-heading font-bold tracking-tight text-[#F7FAFC] leading-none text-sm sm:text-base">
          Ignitron
        </span>
        <span className="text-[10px] tracking-wide font-medium text-[#94A3B8] leading-tight mt-0.5">
          Hostel Stays
        </span>
      </div>

      {showBadge && (
        <span className="ml-1 text-[9px] font-mono font-medium uppercase bg-[#24262A] text-[#5EE5BC] px-1.5 py-0.5 rounded border border-[#2B2E32]">
          Logo
        </span>
      )}
    </div>
  );
};
