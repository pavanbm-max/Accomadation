import React from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}

/**
 * Clean card container respecting the Aqua Pastel design rules:
 * - 0.5rem (8px) radius
 * - Slate Card surface (#1B1D20) with Hairline border (#2B2E32)
 * - Soft dark elevation shadow with subtle border definition
 */
export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
};
