import React from 'react';
import { CountUp } from './CountUp';
import { formatINR } from '../lib/formatters';
import { ShieldCheck, Sparkles, Users } from 'lucide-react';

interface OrderSummaryProps {
  nights: number;
  ratePerNight: number;
  flatFee?: number;
  membersCount?: number;
  checkInDate?: string;
  checkOutDate?: string;
  paymentsEnabled?: boolean;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  nights,
  ratePerNight,
  flatFee = 0,
  membersCount = 1,
  paymentsEnabled = true,
}) => {
  const safeNights = Math.max(0, nights);
  const count = Math.max(1, membersCount);
  const basePerPerson = safeNights * ratePerNight;
  const baseTotal = basePerPerson * count;
  const totalFlatFee = flatFee * count;
  const grandTotal = baseTotal + totalFlatFee;

  return (
    <div className="rounded-xl bg-[#061419]/80 backdrop-blur-xl border border-[#00F5B8]/20 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_24px_rgba(0,245,184,0.06)] relative overflow-hidden transition-colors before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#00F5B8]/40 before:to-transparent">
      <div className="flex items-center justify-between pb-3.5 border-b border-[#00F5B8]/15">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#F0FDF9]">
          <img src="/gmu-logo.png" alt="GM University" className="w-5 h-5 object-contain drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
          <span>Stay summary</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {count > 1 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00F5B8] bg-[#00F5B8]/10 px-2 py-0.5 rounded-md border border-[#00F5B8]/25">
              <Users className="w-3 h-3" />
              <span>{count} members</span>
            </span>
          )}
          {safeNights > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00F5B8] bg-[#00F5B8]/10 px-2.5 py-0.5 rounded-md border border-[#00F5B8]/25">
              <Sparkles className="w-3 h-3 text-[#00F5B8]" />
              {safeNights} {safeNights === 1 ? 'night' : 'nights'}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3.5 space-y-2.5 text-sm">
        {safeNights > 0 ? (
          <div className="flex justify-between items-center text-[#9FB9C1]">
            <span>
              {safeNights} night(s) × {formatINR(ratePerNight)} {count > 1 ? `× ${count} members` : ''}
            </span>
            <span className="font-semibold text-[#F0FDF9] font-mono">
              <CountUp value={baseTotal} isCurrency />
            </span>
          </div>
        ) : (
          <div className="text-xs text-[#5A7E88] italic py-1">
            Select check-in and check-out dates to calculate duration and total.
          </div>
        )}

        {totalFlatFee > 0 && (
          <div className="flex justify-between items-center text-[#9FB9C1]">
            <span>Registration / Amenities fee {count > 1 ? `(${formatINR(flatFee)} × ${count})` : ''}</span>
            <span className="font-semibold text-[#F0FDF9] font-mono">{formatINR(totalFlatFee)}</span>
          </div>
        )}

        {!paymentsEnabled && (
          <div className="text-xs text-[#FCD34D] bg-[#F59E0B]/10 p-2.5 rounded-md border border-[#F59E0B]/25 mt-2 font-medium">
            Online payments currently paused by admin. Free or desk allotment applies.
          </div>
        )}
      </div>

      <div className="mt-4 pt-3.5 border-t border-[#00F5B8]/15 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-[#9FB9C1]">
            Total payable {count > 1 ? `(${count} members)` : ''}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#00F5B8] tracking-tight font-heading mt-0.5 drop-shadow-[0_0_16px_rgba(0,245,184,0.4)]">
            <CountUp value={grandTotal} isCurrency />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[#9FB9C1] bg-[#0B1E26]/90 px-3 py-1.5 rounded-md border border-[#00F5B8]/20 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00F5B8]" />
          <span>Official Tariff</span>
        </div>
      </div>
    </div>
  );
};
