import React from 'react';
import type { PaymentStatus } from '../types';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}

/**
 * PaymentStatusBadge
 * Follows Aqua Pastel design direction:
 * Small dot plus text on soft tint with 8px radius or pill shape.
 * - Paid: #5EE5BC (Aqua Pastel)
 * - Paid at desk: #38BDF8 (Sky Aqua)
 * - Pending / Under review: #F59E0B (Amber)
 * - Failed / Expired: #AB252C (Destructive)
 * - Refunded: #64748B (Slate)
 */
export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const configs: Record<
    PaymentStatus,
    { label: string; dot: string; bg: string; text: string; border: string }
  > = {
    paid: {
      label: 'Paid',
      dot: 'bg-[#5EE5BC]',
      bg: 'bg-[#5EE5BC]/10',
      text: 'text-[#5EE5BC]',
      border: 'border-[#5EE5BC]/25',
    },
    paid_at_desk: {
      label: 'Paid at desk',
      dot: 'bg-[#38BDF8]',
      bg: 'bg-[#38BDF8]/10',
      text: 'text-[#38BDF8]',
      border: 'border-[#38BDF8]/25',
    },
    pending: {
      label: 'Pending',
      dot: 'bg-[#F59E0B]',
      bg: 'bg-[#F59E0B]/10',
      text: 'text-[#FBBF24]',
      border: 'border-[#F59E0B]/25',
    },
    under_review: {
      label: 'Under review',
      dot: 'bg-[#F59E0B]',
      bg: 'bg-[#F59E0B]/10',
      text: 'text-[#FBBF24]',
      border: 'border-[#F59E0B]/25',
    },
    failed: {
      label: 'Failed',
      dot: 'bg-[#AB252C]',
      bg: 'bg-[#AB252C]/15',
      text: 'text-[#F87171]',
      border: 'border-[#AB252C]/30',
    },
    expired: {
      label: 'Expired',
      dot: 'bg-[#AB252C]',
      bg: 'bg-[#AB252C]/15',
      text: 'text-[#F87171]',
      border: 'border-[#AB252C]/30',
    },
    refunded: {
      label: 'Refunded',
      dot: 'bg-[#64748B]',
      bg: 'bg-[#24262A]',
      text: 'text-[#94A3B8]',
      border: 'border-[#2B2E32]',
    },
  };

  const config = configs[status] || configs.pending;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]} ${className}`}
    >
      <span className={`rounded-full shrink-0 ${config.dot} ${dotSizes[size]}`} />
      <span>{config.label}</span>
    </span>
  );
};
