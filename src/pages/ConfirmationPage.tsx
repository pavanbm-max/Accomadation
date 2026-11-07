import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { LogoPlaceholder } from '../components/LogoPlaceholder';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { TiltCard } from '../components/TiltCard';
import { formatINR, formatDate } from '../lib/formatters';
import { getRegistrationPublic, sendConfirmationEmail } from '../lib/api';
import { useToast } from '../context/ToastContext';
import type { PublicRegistration } from '../types';
import { Skeleton } from '../components/Skeleton';
import { 
  CheckCircle2, 
  Send, 
  Copy, 
  QrCode, 
  MapPin, 
  AlertOctagon
} from 'lucide-react';

export const ConfirmationPage: React.FC = () => {
  const { scanToken } = useParams<{ scanToken: string }>();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();

  const [registration, setRegistration] = useState<PublicRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!scanToken) return;
      try {
        const data = await getRegistrationPublic(scanToken);
        setRegistration(data);

        // GOLDEN RULE ENFORCEMENT:
        // If unpaid, do NOT display the confirmation or QR pass!
        if (!data.isPaid && data.paymentStatus !== 'paid' && data.paymentStatus !== 'paid_at_desk') {
          navigate(`/checkout/${scanToken}`, { replace: true });
          return;
        }

        // Auto-trigger confirmation email in background to the guest's email
        sendConfirmationEmail(scanToken).catch((e) => {
          console.warn('Auto send confirmation email notice:', e);
        });
      } catch (err: any) {
        console.error('Failed to load confirmation details:', err);
        toastError('Failed to load confirmed booking pass.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [scanToken, navigate, toastError]);

  const handleResendEmail = async () => {
    if (!scanToken) return;
    setIsResending(true);
    try {
      const res = await sendConfirmationEmail(scanToken, true);
      toastSuccess(res.message || 'Confirmation email dispatched via SMTP!');
    } catch (err: any) {
      toastError(err.message || 'Failed to resend confirmation email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCopyLink = () => {
    if (!registration) return;
    const scanUrl = `${window.location.origin}/scan/${registration.scanToken}`;
    navigator.clipboard.writeText(scanUrl);
    toastSuccess('Check-in link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 space-y-6">
        <Skeleton className="h-12 w-64 mx-auto rounded-md bg-[#24262A]" />
        <Skeleton className="h-[500px] rounded-lg bg-[#1B1D20]" />
      </div>
    );
  }

  if (!registration || (!registration.isPaid && registration.paymentStatus !== 'paid' && registration.paymentStatus !== 'paid_at_desk')) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <div className="p-8 rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] space-y-4">
          <AlertOctagon className="w-12 h-12 text-[#AB252C] mx-auto" />
          <h3 className="text-xl font-bold text-[#F7FAFC] font-heading">
            Access restricted
          </h3>
          <p className="text-xs text-[#94A3B8]">
            QR check-in passes are strictly generated only for paid accommodation registrations.
          </p>
          <Link
            to="/"
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-md"
          >
            <span>Return to home</span>
          </Link>
        </div>
      </div>
    );
  }

  const scanUrl = `${window.location.origin}/scan/${registration.scanToken}`;

  return (
    <div className="page-ambient-bg relative min-h-[calc(100vh-4rem)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-[#151618] text-[#F7FAFC]">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Stepper (Step 3 active) */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs font-medium pb-2">
          <div className="flex items-center gap-2 text-[#5EE5BC]">
            <span className="w-6 h-6 rounded-md bg-[#5EE5BC]/15 text-[#5EE5BC] flex items-center justify-center text-xs font-bold border border-[#5EE5BC]/30">
              ✓
            </span>
            <span>Details</span>
          </div>
          <div className="w-8 h-0.5 bg-[#5EE5BC]" />
          <div className="flex items-center gap-2 text-[#5EE5BC]">
            <span className="w-6 h-6 rounded-md bg-[#5EE5BC]/15 text-[#5EE5BC] flex items-center justify-center text-xs font-bold border border-[#5EE5BC]/30">
              ✓
            </span>
            <span>Payment</span>
          </div>
          <div className="w-8 h-0.5 bg-[#5EE5BC]" />
          <div className="flex items-center gap-2 text-[#F7FAFC] font-semibold">
            <span className="w-6 h-6 rounded-md bg-[#5EE5BC] text-[#0C1D18] flex items-center justify-center text-xs font-bold shadow-[0_0_12px_rgba(94,229,188,0.35)]">
              3
            </span>
            <span>Confirmed</span>
          </div>
        </div>

        {/* Success Announcement Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#5EE5BC]/15 border border-[#5EE5BC]/30 text-[#5EE5BC] flex items-center justify-center shadow-[0_0_16px_rgba(94,229,188,0.2)]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F7FAFC] font-heading tracking-tight">
            Accommodation confirmed!
          </h1>
          <p className="text-xs text-[#94A3B8] max-w-sm mx-auto leading-relaxed">
            Paid {formatINR(registration.amount)} · Txn {registration.transactionId || 'Confirmed'} · {formatDate(registration.paidAt || registration.createdAt)}
          </p>
        </div>

        {/* Boarding Pass Ticket Card */}
        <TiltCard className="overflow-hidden border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          {/* Ticket Header */}
          <div className="p-6 bg-[#1B1D20] border-b border-[#2B2E32]">
            <div className="flex items-center justify-between">
              <LogoPlaceholder size="sm" />
              <PaymentStatusBadge status={registration.paymentStatus} size="sm" />
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <span className="text-[11px] font-medium text-[#94A3B8] block">
                  Allotment reference
                </span>
                <div className="font-mono text-2xl font-bold tracking-wider text-[#F7FAFC] mt-0.5">
                  {registration.referenceId}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-medium text-[#94A3B8] block">
                  Amount paid
                </span>
                <div className="text-xl font-bold text-[#5EE5BC] mt-0.5 font-heading drop-shadow-[0_0_12px_rgba(94,229,188,0.25)]">
                  {formatINR(registration.amount)}
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Notch & Dashed divider */}
          <div className="relative bg-[#1B1D20] py-2">
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#151618] border border-[#2B2E32]" />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#151618] border border-[#2B2E32]" />
            <div className="border-t border-dashed border-[#2B2E32] mx-6" />
          </div>

          {/* Ticket Body with QR Code */}
          <div className="p-6 bg-[#1B1D20] space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
              {/* QR Code Container */}
              <div className="p-3 bg-white rounded-md border border-[#2B2E32] shadow-soft flex flex-col items-center flex-shrink-0">
                <QRCodeSVG
                  value={scanUrl}
                  size={152}
                  level="H"
                  includeMargin={true}
                />
                <span className="text-[11px] text-[#0C1D18] font-mono mt-1 font-semibold">
                  {registration.referenceId}
                </span>
              </div>

              {/* Guest & Stay Details */}
              <div className="flex-1 space-y-3 text-left w-full">
                <div>
                  <div className="text-xs text-[#94A3B8] font-medium">Participant</div>
                  <div className="text-base font-bold text-[#F7FAFC] mt-0.5 font-heading">
                    {registration.fullName}
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    {registration.collegeOrOrganisation}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-[#2B2E32]">
                  <div>
                    <span className="text-[#94A3B8] block font-medium">Check-in</span>
                    <span className="font-semibold text-[#F7FAFC]">
                      {formatDate(registration.checkInDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block font-medium">Check-out</span>
                    <span className="font-semibold text-[#F7FAFC]">
                      {formatDate(registration.checkOutDate)}
                    </span>
                  </div>
                </div>

                <div className="text-xs pt-2.5 border-t border-[#2B2E32] flex justify-between">
                  <span className="text-[#94A3B8] font-medium">Stay duration</span>
                  <span className="font-semibold text-[#F7FAFC] font-mono">
                    {registration.nights} night(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Verification Links */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#2B2E32]">
              <button
                onClick={handleCopyLink}
                className="btn-secondary flex-1 py-2.5 px-3 text-xs flex items-center justify-center gap-1.5 rounded-md"
              >
                <Copy className="w-3.5 h-3.5 text-[#5EE5BC]" />
                <span>Copy check-in link</span>
              </button>

              <a
                href={`/scan/${registration.scanToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex-1 py-2.5 px-3 text-xs flex items-center justify-center gap-1.5 rounded-md"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Desk scanner preview ↗</span>
              </a>
            </div>

            {/* Check-in counter notice */}
            <div className="p-3.5 rounded-md bg-[#24262A] border border-[#2B2E32] flex items-start gap-2.5 text-xs text-[#94A3B8]">
              <MapPin className="w-4 h-4 text-[#5EE5BC] mt-0.5 flex-shrink-0" />
              <span>
                Reception desk opens at 8:00 AM. Show this QR code or mention Reference ID <strong className="font-mono text-[#F7FAFC]">{registration.referenceId}</strong> at the counter for room key allotment.
              </span>
            </div>
          </div>
        </TiltCard>

        {/* Resend Confirmation Email Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            onClick={handleResendEmail}
            disabled={isResending}
            className="btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5 text-xs disabled:opacity-50 rounded-md"
          >
            <Send className="w-3.5 h-3.5 text-[#5EE5BC]" />
            <span>{isResending ? 'Sending via SMTP...' : 'Resend confirmation email'}</span>
          </button>

          <Link
            to="/"
            className="text-xs text-[#94A3B8] hover:text-[#5EE5BC] transition-colors"
          >
            Register another participant →
          </Link>
        </div>
      </div>
    </div>
  );
};
