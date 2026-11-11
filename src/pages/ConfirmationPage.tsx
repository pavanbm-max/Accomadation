import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { LogoPlaceholder } from '../components/LogoPlaceholder';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { TiltCard } from '../components/TiltCard';
import { formatINR, formatDate } from '../lib/formatters';
import { getRegistrationPublic, sendConfirmationEmail, dispatchTeamConfirmationEmails } from '../lib/api';
import { useToast } from '../context/ToastContext';
import type { PublicRegistration } from '../types';
import { Skeleton } from '../components/Skeleton';
import { 
  CheckCircle2, 
  Send, 
  Copy, 
  QrCode, 
  MapPin, 
  AlertOctagon,
  Phone,
  Mail,
  Users,
  ExternalLink,
  BedDouble
} from 'lucide-react';

export const ConfirmationPage: React.FC = () => {
  const { scanToken } = useParams<{ scanToken: string }>();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const [registration, setRegistration] = useState<PublicRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [emailSendingMap, setEmailSendingMap] = useState<Record<string, boolean>>({});
  const [emailSentMap, setEmailSentMap] = useState<Record<string, boolean>>({});
  const [teamPasses, setTeamPasses] = useState<Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string;
    gender: string;
    referenceId: string;
    scanToken: string;
    amount: number;
  }> | null>(null);

  useEffect(() => {
    if (!scanToken) return;
    try {
      const raw = localStorage.getItem(`team_${scanToken}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTeamPasses(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [scanToken]);

  useEffect(() => {
    async function loadData() {
      if (!scanToken) return;
      try {
        const data = await getRegistrationPublic(scanToken);
        setRegistration(data);

        // Populate all team passes from secure database RPC
        if (data.teamMembers && Array.isArray(data.teamMembers) && data.teamMembers.length > 1) {
          setTeamPasses(data.teamMembers as any);
          try {
            localStorage.setItem(`team_${scanToken}`, JSON.stringify(data.teamMembers));
          } catch {}
        }

        // GOLDEN RULE ENFORCEMENT:
        // If unpaid, do NOT display the confirmation or QR pass!
        if (!data.isPaid && data.paymentStatus !== 'paid' && data.paymentStatus !== 'paid_at_desk') {
          const localOverride = typeof window !== 'undefined' ? localStorage.getItem(`payment_override_${scanToken}`) : null;
          if (!localOverride) {
            navigate(`/checkout/${scanToken}`, { replace: true });
            return;
          }
        }

        // Sequentially dispatch confirmation emails with individual QR passes to leader and all teammates
        dispatchTeamConfirmationEmails(scanToken, false, (token, success) => {
          if (success) {
            setEmailSentMap((prev) => ({ ...prev, [token]: true }));
          }
        }).catch((e) => {
          console.warn('Auto send team confirmation email notice:', e);
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
      setEmailSentMap((prev) => ({ ...prev, [scanToken]: true }));
      if (res.smtpDelivered) {
        toastSuccess(`Confirmation email sent via SMTP to ${registration?.email || 'your email'}!`);
      } else {
        toastSuccess(res.message || 'Confirmation email queued in outbox!');
        if (res.smtpError) toastInfo(`SMTP Note: ${res.smtpError}`);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to resend confirmation email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSendTeammateEmail = async (member: { scanToken: string; email: string; fullName: string }) => {
    setEmailSendingMap((prev) => ({ ...prev, [member.scanToken]: true }));
    try {
      const res = await sendConfirmationEmail(member.scanToken, true);
      setEmailSentMap((prev) => ({ ...prev, [member.scanToken]: true }));
      if (res.smtpDelivered) {
        toastSuccess(`Confirmation email with individual QR pass sent to ${member.email}!`);
      } else {
        toastSuccess(`Confirmation pass queued in outbox for ${member.fullName}!`);
        if (res.smtpError) toastInfo(`SMTP Note: ${res.smtpError}`);
      }
    } catch (err: any) {
      toastError(err.message || `Failed to dispatch email to ${member.email}`);
    } finally {
      setEmailSendingMap((prev) => ({ ...prev, [member.scanToken]: false }));
    }
  };

  const handleSendAllTeamEmails = async () => {
    if (!scanToken) return;
    setIsResending(true);
    try {
      const res = await dispatchTeamConfirmationEmails(scanToken, true, (token, success) => {
        if (success) {
          setEmailSentMap((prev) => ({ ...prev, [token]: true }));
        }
      });
      toastSuccess(`Individual confirmation emails with QR stay passes dispatched to all ${res.dispatched} team members!`);
    } catch (err: any) {
      toastError(err.message || 'Failed to dispatch team emails.');
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
    <div className="page-ambient-bg relative min-h-[calc(100vh-4rem)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-transparent text-[#F0FDF9]">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Stepper (Step 3 active) */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-4 text-[11px] sm:text-xs font-medium pb-2">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[#00F5B8]">
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#00F5B8]/15 text-[#00F5B8] flex items-center justify-center text-[10px] sm:text-xs font-bold border border-[#00F5B8]/30">
              ✓
            </span>
            <span>Details</span>
          </div>
          <div className="w-4 sm:w-8 h-0.5 bg-[#00F5B8]" />
          <div className="flex items-center gap-1.5 sm:gap-2 text-[#00F5B8]">
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#00F5B8]/15 text-[#00F5B8] flex items-center justify-center text-[10px] sm:text-xs font-bold border border-[#00F5B8]/30">
              ✓
            </span>
            <span>Payment</span>
          </div>
          <div className="w-4 sm:w-8 h-0.5 bg-[#00F5B8]" />
          <div className="flex items-center gap-1.5 sm:gap-2 text-[#F0FDF9] font-semibold">
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-gradient-to-r from-[#00F5B8] to-[#00C49F] text-[#021713] flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-[0_0_16px_rgba(0,245,184,0.4)]">
              3
            </span>
            <span>Confirmed</span>
          </div>
        </div>

        {/* Success Announcement Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#00F5B8]/15 border border-[#00F5B8]/30 text-[#00F5B8] flex items-center justify-center shadow-[0_0_20px_rgba(0,245,184,0.3)]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F0FDF9] font-heading tracking-tight">
            Accommodation confirmed!
          </h1>
          <p className="text-xs text-[#9FB9C1] max-w-sm mx-auto leading-relaxed">
            Paid {formatINR(registration.amount)} · Txn {registration.transactionId || 'Confirmed'} · {formatDate(registration.paidAt || registration.createdAt)}
          </p>
        </div>

        {/* Boarding Pass Ticket Card */}
        <TiltCard className="overflow-hidden border border-[#00F5B8]/20 shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
          {/* Ticket Header */}
          <div className="p-6 bg-[#061419]/90 backdrop-blur-xl border-b border-[#00F5B8]/15">
            <div className="flex items-center justify-between">
              <LogoPlaceholder size="sm" showBadge={true} />
              <PaymentStatusBadge status={registration.paymentStatus} size="sm" />
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <span className="text-[11px] font-medium text-[#9FB9C1] block">
                  Allotment reference
                </span>
                <div className="font-mono text-2xl font-bold tracking-wider text-[#F0FDF9] mt-0.5">
                  {registration.referenceId}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-medium text-[#9FB9C1] block">
                  Amount paid
                </span>
                <div className="text-xl font-bold text-[#00F5B8] mt-0.5 font-heading drop-shadow-[0_0_14px_rgba(0,245,184,0.35)]">
                  {formatINR(registration.amount)}
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Notch & Dashed divider */}
          <div className="relative bg-[#061419]/90 py-2">
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#020608] border border-[#00F5B8]/20" />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#020608] border border-[#00F5B8]/20" />
            <div className="border-t border-dashed border-[#00F5B8]/25 mx-6" />
          </div>

          {/* Ticket Body with QR Code */}
          <div className="relative p-6 bg-[#061419]/90 backdrop-blur-xl space-y-6 overflow-hidden">
            {/* Subtle GM University Crest Watermark */}
            <img 
              src="/gmu-logo.png" 
              alt="" 
              aria-hidden="true" 
              className="pointer-events-none absolute -right-6 -bottom-6 w-48 h-48 opacity-[0.08] object-contain select-none" 
            />
            {/* Subtle IGNITRON 2K26 Watermark */}
            <img 
              src="/ignitron-2k26-logo.png" 
              alt="" 
              aria-hidden="true" 
              className="pointer-events-none absolute -left-8 -top-4 w-52 opacity-[0.045] object-contain select-none" 
            />
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

                {/* Prominent Room Allotment Section */}
                <div className="pt-2.5 border-t border-[#2B2E32]">
                  {registration.roomNumber ? (
                    <div className="p-3 rounded-lg bg-[#5EE5BC]/15 border border-[#5EE5BC]/40 flex items-center justify-between shadow-[0_0_16px_rgba(94,229,188,0.15)]">
                      <div className="flex items-center gap-2">
                        <BedDouble className="w-4 h-4 text-[#5EE5BC]" />
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#5EE5BC] block font-bold">
                            Allotted Room
                          </span>
                          <span className="text-[11px] text-[#94A3B8]">
                            {registration.gender === 'Female' ? 'Girls Hostel Block' : 'Boys Hostel Block'}
                          </span>
                        </div>
                      </div>
                      <div className="font-mono text-lg font-black text-[#5EE5BC]">
                        {registration.roomNumber}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-[#24262A] border border-[#2B2E32] flex items-center justify-between text-xs text-[#94A3B8]">
                      <div className="flex items-center gap-2">
                        <BedDouble className="w-3.5 h-3.5 text-[#F59E0B]" />
                        <span>Room Allotment</span>
                      </div>
                      <span className="text-[11px] font-medium text-[#F59E0B]">
                        Key &amp; room allotted at reception
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-[#2B2E32]">
              <button
                onClick={handleCopyLink}
                className="btn-secondary flex-1 py-2.5 px-3 text-xs flex items-center justify-center gap-1.5 rounded-md"
              >
                <Copy className="w-3.5 h-3.5 text-[#5EE5BC]" />
                <span>Copy pass link</span>
              </button>

              <button
                onClick={() => window.print()}
                className="btn-primary flex-1 py-2.5 px-3 text-xs flex items-center justify-center gap-1.5 rounded-md"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Print / Save pass</span>
              </button>
            </div>

            {/* Check-in counter notice & desk support */}
            <div className="p-4 rounded-md bg-[#24262A] border border-[#2B2E32] space-y-2 text-xs text-[#94A3B8]">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#5EE5BC] mt-0.5 flex-shrink-0" />
                <span>
                  Reception desk opens at 8:00 AM. Show this QR code or mention Reference ID <strong className="font-mono text-[#F7FAFC]">{registration.referenceId}</strong> at the counter for room key allotment.
                </span>
              </div>
              <div className="pt-2 border-t border-[#2B2E32] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#5EE5BC]" />
                  <span>Desk Helpline: <a href="tel:+919980745913" className="font-mono text-[#F7FAFC] hover:text-[#5EE5BC] font-semibold">+91 99807 45913</a></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#5EE5BC]" />
                  <a href="mailto:pavan.b.m1598@gmail.com" className="text-[#94A3B8] hover:text-[#5EE5BC]">pavan.b.m1598@gmail.com</a>
                </div>
              </div>
            </div>
          </div>
        </TiltCard>

        {/* ALL TEAM MEMBER PASSES (When part of group registration) */}
        {teamPasses && teamPasses.length > 1 && (
          <div className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#2B2E32]">
              <div>
                <h2 className="text-lg font-bold text-[#F7FAFC] font-heading flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#5EE5BC]" />
                  <span>All Team Passes ({teamPasses.length} participants)</span>
                </h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Every teammate has an individual Reference ID, distinct QR code, and personalized email.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSendAllTeamEmails}
                disabled={isResending}
                className="btn-secondary py-2 px-3 text-xs flex items-center justify-center gap-1.5 rounded-md border border-[#5EE5BC]/40 text-[#5EE5BC] hover:bg-[#5EE5BC]/10 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isResending ? 'Dispatching...' : 'Resend emails to all members'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {teamPasses.map((m, idx) => {
                const isCurrent = m.scanToken === scanToken;
                const memberScanUrl = `${window.location.origin}/scan/${m.scanToken}`;
                const isSendingThis = emailSendingMap[m.scanToken];
                const isSentThis = emailSentMap[m.scanToken];

                return (
                  <div
                    key={m.id || idx}
                    className={`p-4 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-[#1B1D20] border-[#5EE5BC]/60 shadow-[0_0_24px_rgba(94,229,188,0.15)] ring-1 ring-[#5EE5BC]/30'
                        : 'bg-[#181A1D] border-[#2B2E32] hover:border-[#5EE5BC]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between pb-3 border-b border-[#2B2E32]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#F7FAFC]">{m.fullName}</span>
                          {idx === 0 && (
                            <span className="text-[10px] font-mono font-bold bg-[#5EE5BC]/15 text-[#5EE5BC] px-2 py-0.5 rounded border border-[#5EE5BC]/30">
                              Team Leader
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] font-mono font-bold bg-[#38BDF8]/15 text-[#38BDF8] px-2 py-0.5 rounded border border-[#38BDF8]/30">
                              Active Ticket
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-[#5EE5BC] mt-0.5 font-bold">
                          {m.referenceId}
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-[#94A3B8] bg-[#24262A] px-2.5 py-1 rounded border border-[#2B2E32]">
                        {m.gender === 'Female' ? 'Girls Block' : 'Boys Block'}
                      </span>
                    </div>

                    <div className="py-3 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                      <div className="p-2 bg-white rounded-md flex-shrink-0 shadow-soft">
                        <QRCodeSVG value={memberScanUrl} size={90} level="M" includeMargin={false} />
                      </div>
                      <div className="flex-1 text-xs space-y-1.5 text-center sm:text-left">
                        <div className="text-[#F7FAFC] font-semibold">{m.fullName}</div>
                        <div className="text-[#94A3B8] font-mono">{m.phone}</div>
                        <div className="text-[#64748B] truncate">{m.email}</div>
                        <div className="text-[11px] text-[#5EE5BC] font-medium pt-1 flex items-center justify-center sm:justify-start gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isSentThis ? `Email sent to ${m.email}` : `Individual QR pass sent to ${m.email}`}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#2B2E32] flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/confirmation/${m.scanToken}`);
                          toastSuccess(`Pass link copied for ${m.fullName}!`);
                        }}
                        className="btn-secondary flex-1 py-2 px-3 text-xs flex items-center justify-center gap-1.5 rounded-md min-w-[130px]"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#5EE5BC]" />
                        <span>Copy pass link</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSendingThis}
                        onClick={() => handleSendTeammateEmail(m)}
                        className="btn-secondary py-2 px-3 text-xs flex items-center justify-center gap-1.5 rounded-md text-[#5EE5BC] border border-[#5EE5BC]/30 hover:bg-[#5EE5BC]/10 disabled:opacity-50 min-w-[140px]"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{isSendingThis ? 'Sending...' : isSentThis ? 'Email Dispatched ✓' : 'Send to Email'}</span>
                      </button>

                      {!isCurrent && (
                        <Link
                          to={`/confirmation/${m.scanToken}`}
                          className="btn-primary py-2 px-4 text-xs flex items-center justify-center gap-1.5 rounded-md font-semibold"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Pass</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
