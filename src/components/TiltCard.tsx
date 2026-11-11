import React from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}

/**
 * Frosted Cosmic Glass card container respecting the design-taste-frontend cosmic aurora theme:
 * - Frosted deep space glass: rgba(6, 20, 25, 0.8) with backdrop-blur-xl
 * - Hairline emerald aurora border: rgba(0, 245, 184, 0.20)
 * - Luminous top specular highlight: gradient via #00F5B8/40
 * - Deep spatial elevation shadow
 */
export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`rounded-xl bg-[#061419]/80 backdrop-blur-xl border border-[#00F5B8]/20 shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_24px_rgba(0,245,184,0.06)] relative overflow-hidden transition-all duration-200 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#00F5B8]/40 before:to-transparent ${className}`}
    >
      {children}
    </div>
  );
};
