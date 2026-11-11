import React, { useState, useEffect } from 'react';
import { LogoPlaceholder } from './LogoPlaceholder';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { CountUp } from './CountUp';
import { formatINR, formatDate } from '../lib/formatters';
import type { PublicRegistration } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Upload, 
  Calendar,
  Lock,
  ArrowRight,
  Phone,
  Mail
} from 'lucide-react';

interface CheckoutCardProps {
  registration: PublicRegistration;
  onPay: () => Promise<void>;
  onSimulate: (outcome: 'success' | 'failure' | 'timeout') => Promise<void>;
  onOpenScreenshotUpload: () => void;
  onRefresh: () => Promise<void>;
  isProcessing: boolean;
  simulationEnabled?: boolean;
}

export const CheckoutCard: React.FC<CheckoutCardProps> = ({
  registration,
  onPay,
  onSimulate,
  onOpenScreenshotUpload,
  onRefresh,
  isProcessing,
  simulationEnabled = true,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const totalDuration = 30 * 60; // 30 minutes in seconds

  useEffect(() => {
    const calcRemaining = () => {
      const expires = new Date(registration.expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };

    calcRemaining();
    const interval = setInterval(calcRemaining, 1000);
    return () => clearInterval(interval);
  }, [registration.expiresAt]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isExpired = secondsRemaining <= 0 || registration.paymentStatus === 'expired';
  const isFailed = registration.paymentStatus === 'failed';
  const isUnderReview = registration.paymentStatus === 'under_review';
  const isPaid = registration.paymentStatus === 'paid' || registration.paymentStatus === 'paid_at_desk';

  // SVG Circular progress
  const strokeDashoffset = totalDuration > 0
    ? 283 - (283 * Math.min(secondsRemaining, totalDuration)) / totalDuration
    : 283;

  const ringColor = minutes < 5 ? '#AB252C' : minutes < 10 ? '#F59E0B' : '#5EE5BC';

  return (
    <div className="relative w-full max-w-xl mx-auto rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-4 sm:p-8 overflow-hidden text-[#F7FAFC]">
      {/* Header with Logo & Status Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#2B2E32]">
        <LogoPlaceholder size="md" showBadge={true} />
        <div className="flex items-center gap-2">
          <PaymentStatusBadge status={registration.paymentStatus} size="md" />
        </div>
      </div>

      {/* Booking Identifier & Guest info */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#24262A] p-4 rounded-md border border-[#2B2E32]">
        <div>
          <div className="text-xs text-[#94A3B8] font-medium font-sans">
            Booking reference
          </div>
          <div className="font-mono text-xl font-bold text-[#F7FAFC] tracking-wide mt-0.5">
            {registration.referenceId}
          </div>
        </div>

        <div className="sm:text-right">
          <div className="text-xs text-[#94A3B8] font-medium font-sans">
            Guest name
          </div>
          <div className="font-semibold text-[#F7FAFC] mt-0.5">
            {registration.fullName}
          </div>
        </div>
      </div>

      {/* Stay details itemization */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between text-sm text-[#94A3B8]">
          <span className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-4 h-4 text-[#94A3B8]" />
            Dates
          </span>
          <span className="font-semibold text-[#F7FAFC]">
            {formatDate(registration.checkInDate)} → {formatDate(registration.checkOutDate)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm text-[#94A3B8]">
          <span className="font-medium">Stay Duration</span>
          <span className="font-semibold text-[#F7FAFC] font-mono">
            {registration.nights} {registration.nights === 1 ? 'night' : 'nights'} × {formatINR(registration.ratePerNight)}
          </span>
        </div>

        {registration.flatFee > 0 && (
          <div className="flex items-center justify-between text-sm text-[#94A3B8]">
            <span className="font-medium">Amenities Fee</span>
            <span className="font-semibold text-[#F7FAFC] font-mono">
              {formatINR(registration.flatFee)}
            </span>
          </div>
        )}

        <div className="pt-4 border-t border-[#2B2E32] flex items-center justify-between">
          <span className="font-semibold text-[#F7FAFC] text-base">Total amount</span>
          <span className="text-2xl sm:text-3xl font-bold text-[#5EE5BC] font-heading tracking-tight drop-shadow-[0_0_12px_rgba(94,229,188,0.25)]">
            <CountUp value={registration.amount} isCurrency />
          </span>
        </div>
      </div>

      {/* COUNTDOWN TIMER (Only for unexpired pending status) */}
      {!isPaid && !isExpired && !isFailed && !isUnderReview && (
        <div className="mt-6 flex items-center justify-center gap-4 py-3.5 px-4 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#FCD34D]">
          <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
            <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                className="stroke-[#F59E0B]/20 fill-none"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                style={{ stroke: ringColor }}
                className="fill-none transition-all duration-1000 ease-linear"
                strokeWidth="8"
                strokeDasharray="283"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <Clock className="w-4 h-4 text-[#F59E0B] absolute" />
          </div>
          <div>
            <div className="text-xs font-medium text-[#FCD34D]">
              Payment session window
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-[#FDE68A]">
              {timeFormatted} <span className="text-xs font-normal text-[#F59E0B]">minutes remaining</span>
            </div>
          </div>
        </div>
      )}

      {/* PRIMARY ACTIONS & STATES */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          {/* STATE 1: PROCESSING */}
          {isProcessing ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-3 border-[#5EE5BC] border-t-transparent animate-spin" />
              </div>
              <h4 className="mt-4 text-base font-bold text-[#F7FAFC] font-heading">
                Confirming your payment…
              </h4>
              <p className="mt-1 text-xs text-[#94A3B8] max-w-xs leading-relaxed">
                Communicating securely with server. Please do not close or refresh this tab.
              </p>
            </motion.div>
          ) : isPaid ? (
            /* STATE 2: SUCCESS */
            <motion.div
              key="paid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-4 space-y-4"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-[#5EE5BC]/15 border border-[#5EE5BC]/30 flex items-center justify-center text-[#5EE5BC] shadow-[0_0_16px_rgba(94,229,188,0.2)]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#F7FAFC] font-heading">
                  Payment successfully confirmed!
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1 max-w-sm mx-auto">
                  Your accommodation booking is confirmed. Your check-in pass &amp; QR are ready.
                </p>
              </div>
              <a
                href={`/confirmation/${registration.scanToken}`}
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-md bg-[#5EE5BC] hover:bg-[#48D9AD] text-[#0C1D18] font-semibold text-sm shadow-[0_0_20px_rgba(94,229,188,0.3)] transition-all"
              >
                <span>View check-in pass &amp; QR code</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
          ) : isUnderReview ? (
            /* STATE 3: UNDER REVIEW */
            <motion.div
              key="under_review"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-4 bg-[#F59E0B]/10 p-5 rounded-md border border-[#F59E0B]/30"
            >
              <div className="mx-auto w-10 h-10 rounded-full bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] mb-3">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#FCD34D] font-heading">
                Payment proof under review
              </h3>
              <p className="text-xs text-[#FCD34D] mt-1">
                Your screenshot has been received. Our accommodation desk is verifying the transaction UTR.
              </p>
              <button
                onClick={onRefresh}
                className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[#F7FAFC] bg-[#24262A] px-4 py-2.5 rounded-md border border-[#2B2E32] hover:bg-[#2B2E32] hover:border-[#5EE5BC]/40 transition-colors shadow-soft"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#5EE5BC]" />
                <span>Check status</span>
              </button>
            </motion.div>
          ) : isFailed || isExpired ? (
            /* STATE 4: FAILED OR TIMED OUT */
            <motion.div
              key="failed_or_expired"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-4"
            >
              <div className="p-4 rounded-md bg-[#AB252C]/15 border border-[#AB252C]/30 text-center mb-5">
                <AlertCircle className="w-6 h-6 text-[#F87171] mx-auto mb-2" />
                <h4 className="font-bold text-sm text-[#F87171] font-heading">
                  {isExpired ? 'Registration session expired' : 'Payment not completed'}
                </h4>
                <p className="text-xs text-[#F87171] mt-1 max-w-sm mx-auto">
                  {registration.screenshotReviewReason
                    ? `Admin review note: ${registration.screenshotReviewReason}`
                    : 'The payment could not be confirmed within the session or was declined.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={onPay}
                  className="w-full py-3 px-4 rounded-md bg-[#5EE5BC] hover:bg-[#48D9AD] text-[#0C1D18] font-semibold text-xs shadow-soft transition-all"
                >
                  Try again
                </button>
                <button
                  onClick={onOpenScreenshotUpload}
                  className="w-full py-3 px-4 rounded-md bg-[#24262A] border border-[#2B2E32] hover:bg-[#2B2E32] hover:border-[#5EE5BC]/40 text-[#F7FAFC] font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-soft"
                >
                  <Upload className="w-4 h-4 text-[#5EE5BC]" />
                  <span>Upload screenshot</span>
                </button>
              </div>

              <div className="mt-4 text-center">
                <a href="/" className="text-xs text-[#94A3B8] hover:text-[#5EE5BC] underline">
                  Or start a fresh registration
                </a>
              </div>
            </motion.div>
          ) : (
            /* STATE 5: PENDING (READY TO PAY) - Aqua Pastel primary action */
            <motion.div key="ready_to_pay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button
                onClick={onPay}
                disabled={isProcessing}
                className="btn-primary w-full py-3.5 px-6 font-semibold text-base flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(94,229,188,0.25)] rounded-md"
              >
                <CreditCard className="w-5 h-5 text-[#0C1D18]" />
                <span>Pay {formatINR(registration.amount)}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mandatory Golden Rule Note */}
      <div className="mt-6 pt-5 border-t border-[#2B2E32] space-y-2">
        <div className="flex items-start gap-2 text-xs text-[#94A3B8]">
          <Lock className="w-3.5 h-3.5 text-[#94A3B8] mt-0.5 flex-shrink-0" />
          <span>
            <strong className="text-[#F7FAFC]">The Golden Rule:</strong> Your accommodation is confirmed only after payment succeeds. Spot is not reserved until payment is captured.
          </span>
        </div>
      </div>

      {/* Accommodation Desk Support Footer */}
      <div className="mt-6 pt-4 border-t border-[#2B2E32] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#94A3B8]">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-[#5EE5BC]" />
          <span>Desk Helpline: <a href="tel:+919980745913" className="text-[#F7FAFC] font-mono hover:text-[#5EE5BC] font-semibold">+91 99807 45913</a></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-[#5EE5BC]" />
          <a href="mailto:pavan.b.m1598@gmail.com" className="hover:text-[#5EE5BC] transition-colors truncate">pavan.b.m1598@gmail.com</a>
        </div>
      </div>

      {/* TEST MODE PANEL (DEV ONLY) */}
      {simulationEnabled && !isPaid && (
        <div className="mt-6 pt-4 border-t border-dashed border-[#2B2E32] bg-[#24262A]/50 -mx-6 -mb-6 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#F7FAFC]">
              ⚡ Test mode gateway simulator (dev only)
            </span>
            <span className="text-[10px] font-mono bg-[#1B1D20] text-[#94A3B8] border border-[#2B2E32] px-2 py-0.5 rounded font-medium">
              DEV_SIMULATE_PAYMENTS
            </span>
          </div>
          <p className="text-xs text-[#94A3B8] mb-3">
            Test server-side payment state transitions without connecting external Razorpay keys:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onSimulate('success')}
              className="py-2 px-2 bg-[#5EE5BC] hover:bg-[#48D9AD] text-[#0C1D18] rounded-md text-xs font-semibold shadow-soft transition-colors"
            >
              Simulate success
            </button>
            <button
              onClick={() => onSimulate('failure')}
              className="py-2 px-2 bg-[#AB252C] hover:bg-[#C9323A] text-white rounded-md text-xs font-medium shadow-soft transition-colors"
            >
              Simulate failure
            </button>
            <button
              onClick={() => onSimulate('timeout')}
              className="py-2 px-2 bg-[#1B1D20] hover:bg-[#24262A] text-[#F7FAFC] rounded-md text-xs font-medium shadow-soft transition-colors border border-[#2B2E32]"
            >
              Simulate timeout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
