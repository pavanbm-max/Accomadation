import React from 'react';
import { CountUp } from './CountUp';
import { formatINR } from '../lib/formatters';
import { Moon, ShieldCheck, Sparkles } from 'lucide-react';

interface OrderSummaryProps {
  nights: number;
  ratePerNight: number;
  flatFee?: number;
  checkInDate?: string;
  checkOutDate?: string;
  paymentsEnabled?: boolean;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  nights,
  ratePerNight,
  flatFee = 0,
  paymentsEnabled = true,
}) => {
  const safeNights = Math.max(0, nights);
  const baseTotal = safeNights * ratePerNight;
  const grandTotal = baseTotal + flatFee;

  return (
    <div className="rounded-lg bg-[#1B1D20] border border-[#2B2E32] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-colors">
      <div className="flex items-center justify-between pb-3.5 border-b border-[#2B2E32]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#F7FAFC]">
          <img src="/ignitron-emblem-aqua.png" alt="" className="w-4 h-4 object-contain drop-shadow-[0_0_6px_rgba(94,229,188,0.3)]" />
          <span>Stay summary</span>
        </div>
        {safeNights > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5EE5BC] bg-[#5EE5BC]/10 px-2.5 py-0.5 rounded-md border border-[#5EE5BC]/25">
            <Sparkles className="w-3 h-3 text-[#5EE5BC]" />
            {safeNights} {safeNights === 1 ? 'night' : 'nights'} selected
          </span>
        )}
      </div>

      <div className="mt-3.5 space-y-2.5 text-sm">
        {safeNights > 0 ? (
          <div className="flex justify-between items-center text-[#94A3B8]">
            <span>
              {safeNights} {safeNights === 1 ? 'night' : 'nights'} × {formatINR(ratePerNight)}
            </span>
            <span className="font-semibold text-[#F7FAFC] font-mono">
              <CountUp value={baseTotal} isCurrency />
            </span>
          </div>
        ) : (
          <div className="text-xs text-[#64748B] italic py-1">
            Select check-in and check-out dates to calculate duration and total.
          </div>
        )}

        {flatFee > 0 && (
          <div className="flex justify-between items-center text-[#94A3B8]">
            <span>Registration / Amenities fee</span>
            <span className="font-semibold text-[#F7FAFC] font-mono">{formatINR(flatFee)}</span>
          </div>
        )}

        {!paymentsEnabled && (
          <div className="text-xs text-[#FCD34D] bg-[#F59E0B]/10 p-2.5 rounded-md border border-[#F59E0B]/25 mt-2 font-medium">
            Online payments currently paused by admin. Free or desk allotment applies.
          </div>
        )}
      </div>

      <div className="mt-4 pt-3.5 border-t border-[#2B2E32] flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-[#94A3B8]">
            Total payable
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#5EE5BC] tracking-tight font-heading mt-0.5 drop-shadow-[0_0_12px_rgba(94,229,188,0.25)]">
            <CountUp value={grandTotal} isCurrency />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] bg-[#24262A] px-3 py-1.5 rounded-md border border-[#2B2E32] font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[#5EE5BC]" />
          <span>Locked at booking</span>
        </div>
      </div>
    </div>
  );
};
