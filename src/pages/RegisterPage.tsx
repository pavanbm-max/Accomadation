import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrderSummary } from '../components/OrderSummary';
import { TiltCard } from '../components/TiltCard';
import { calculateNights } from '../lib/formatters';
import { 
  getPublicSettings, 
  getPublishedAnnouncements, 
  createRegistration, 
  lookupPending 
} from '../lib/api';
import { useToast } from '../context/ToastContext';
import type { PublicSettings, Announcement } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  User, 
  Building, 
  ShieldAlert, 
  ArrowRight, 
  Megaphone,
  CheckCircle2,
  Clock
} from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { error: toastError, success: toastSuccess } = useToast();

  const [settings, setSettings] = useState<PublicSettings>({
    per_night_fee: 300,
    flat_fee: 0,
    payments_enabled: true,
    expiry_minutes: 30,
    refund_policy_text: '',
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [, setLoadingSettings] = useState(true);

  // Form State
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('Male');
  const [collegeOrOrg, setCollegeOrOrg] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [checkInDate, setCheckInDate] = useState(tomorrow);
  const [checkOutDate, setCheckOutDate] = useState(dayAfter);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicatePaidError, setDuplicatePaidError] = useState<string | null>(null);

  // Unpaid pending registration banner
  const [unpaidPending, setUnpaidPending] = useState<{
    found: boolean;
    firstName?: string;
    referenceId?: string;
    scanToken?: string;
    expiresAt?: string;
  } | null>(null);

  // Fetch initial settings & announcements
  useEffect(() => {
    async function loadData() {
      try {
        const [s, a] = await Promise.all([
          getPublicSettings(),
          getPublishedAnnouncements(),
        ]);
        setSettings(s);
        setAnnouncements(a);
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoadingSettings(false);
      }
    }
    loadData();
  }, []);

  // Compute stay duration
  const nights = calculateNights(checkInDate, checkOutDate);

  // Check for pending unpaid registration on phone / email blur
  const checkPending = async (identifier: string) => {
    if (!identifier || identifier.length < 5) return;
    try {
      const res = await lookupPending(identifier);
      if (res.found && res.scanToken) {
        setUnpaidPending(res);
      } else {
        setUnpaidPending(null);
      }
    } catch {
      // Ignore lookup error
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicatePaidError(null);

    if (nights <= 0) {
      toastError('Check-out date must be after check-in date (minimum 1 night).');
      return;
    }

    if (!phone.trim() || phone.trim().length < 10) {
      toastError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createRegistration({
        fullName,
        phone,
        email,
        gender,
        collegeOrOrganisation: collegeOrOrg,
        emergencyContact,
        checkInDate,
        checkOutDate,
      });

      if (res.paymentStatus === 'paid') {
        toastSuccess('Registration confirmed! (Exempt or zero-fee stay)');
        navigate(`/confirmation/${res.scanToken}`);
      } else {
        navigate(`/checkout/${res.scanToken}`);
      }
    } catch (err: any) {
      console.error('Registration submission error:', err);
      if (err.message && (err.message.includes('already exists') || err.message.includes('confirmed accommodation'))) {
        setDuplicatePaidError(err.message);
      } else {
        toastError(err.message || 'Failed to initiate registration.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-ambient-bg relative min-h-[calc(100vh-4rem)] py-8 sm:py-14 px-4 sm:px-6 lg:px-8 bg-[#151618] text-[#F7FAFC]">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Published Announcements Banner */}
        {announcements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="p-4 rounded-lg bg-[#24262A] border border-[#2B2E32] shadow-[0_4px_20px_rgba(0,0,0,0.35)] flex items-start gap-3.5"
          >
            <Megaphone className="w-5 h-5 text-[#5EE5BC] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[#F7FAFC]">
              <span className="font-semibold block sm:inline mr-2">
                {announcements[0].title}:
              </span>
              <span className="text-[#94A3B8]">{announcements[0].body}</span>
            </div>
          </motion.div>
        )}

        {/* Editorial Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#24262A] border border-[#2B2E32] text-xs font-medium text-[#F7FAFC]">
            <span className="w-2 h-2 rounded-full bg-[#5EE5BC] shadow-[0_0_8px_#5EE5BC]" />
            <span>Campus tech fest 2026 · Accommodation desk</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#F7FAFC] font-heading leading-tight">
            Hostel stay registration
          </h1>
          <p className="text-sm sm:text-base text-[#94A3B8] max-w-xl mx-auto leading-relaxed">
            Reserve your campus accommodation. Verified stay allotment is generated immediately upon payment.
          </p>

          {/* Stepper (Details → Payment → Confirmed) */}
          <div className="pt-2 flex items-center justify-center gap-2 sm:gap-4 text-xs font-medium">
            <div className="flex items-center gap-2 text-[#F7FAFC] font-semibold">
              <span className="w-6 h-6 rounded-md bg-[#5EE5BC] text-[#0C1D18] flex items-center justify-center text-xs font-bold shadow-[0_0_12px_rgba(94,229,188,0.35)]">
                1
              </span>
              <span>Details</span>
            </div>
            <div className="w-8 h-px bg-[#2B2E32]" />
            <div className="flex items-center gap-2 text-[#94A3B8]">
              <span className="w-6 h-6 rounded-md bg-[#24262A] border border-[#2B2E32] text-[#94A3B8] flex items-center justify-center text-xs font-medium">
                2
              </span>
              <span>Payment</span>
            </div>
            <div className="w-8 h-px bg-[#2B2E32]" />
            <div className="flex items-center gap-2 text-[#94A3B8]">
              <span className="w-6 h-6 rounded-md bg-[#24262A] border border-[#2B2E32] text-[#94A3B8] flex items-center justify-center text-xs font-medium">
                3
              </span>
              <span>Confirmed</span>
            </div>
          </div>
        </div>

        {/* UNPAID PENDING BANNER */}
        <AnimatePresence>
          {unpaidPending && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="p-5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 shadow-[0_4px_20px_rgba(0,0,0,0.35)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <Clock className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[#FCD34D]">
                  <span className="font-semibold">You have an unpaid registration</span> ({unpaidPending.referenceId}) for{' '}
                  <span className="font-semibold">{unpaidPending.firstName}</span>.
                  <div className="text-xs text-[#F59E0B] mt-1">
                    Your spot is not reserved until payment is completed.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => navigate(`/checkout/${unpaidPending.scanToken}`)}
                  className="px-4 py-2 rounded-md bg-[#F59E0B] hover:bg-[#D97706] text-[#0C1D18] font-semibold text-xs shadow-soft transition-colors focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none"
                >
                  Resume payment
                </button>
                <button
                  type="button"
                  onClick={() => setUnpaidPending(null)}
                  className="px-3 py-2 rounded-md text-[#FCD34D] hover:bg-[#F59E0B]/20 text-xs font-medium transition-colors"
                >
                  Start fresh
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PAID DUPLICATE BANNER (Friendly already registered message) */}
        {duplicatePaidError && (
          <div className="p-5 rounded-lg bg-[#5EE5BC]/10 border border-[#5EE5BC]/30 shadow-[0_4px_20px_rgba(0,0,0,0.35)] flex items-start gap-3.5">
            <CheckCircle2 className="w-5 h-5 text-[#5EE5BC] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[#5EE5BC]">
              <span className="font-semibold text-[#F7FAFC]">Already registered &amp; confirmed:</span>
              <p className="mt-1 text-[#5EE5BC]">{duplicatePaidError}</p>
              <p className="text-xs text-[#94A3B8] mt-2">
                Need to retrieve your digital check-in QR code? Contact desk staff or check your confirmation email.
              </p>
            </div>
          </div>
        )}

        {/* REGISTRATION FORM CARD */}
        <TiltCard className="p-6 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-left border-b border-[#2B2E32] pb-4">
              <h2 className="text-xl font-bold text-[#F7FAFC] font-heading tracking-tight">
                Participant details
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                All accommodation is allocated individually per participant.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-[13px] font-medium text-[#F7FAFC]">
                  Full name (as per student or government ID) *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aravind Swaminathan"
                    className="w-full h-11 pl-10 pr-4 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-sm transition-all"
                  />
                </div>
              </div>

              {/* Mobile Phone (+91 Indian format) */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#F7FAFC]">
                  Mobile number *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-semibold text-[#94A3B8] select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onBlur={(e) => checkPending(e.target.value)}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98401 23456"
                    className="w-full h-11 pl-12 pr-4 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-sm transition-all"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#F7FAFC]">
                  Email address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onBlur={(e) => checkPending(e.target.value)}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.ac.in"
                  className="w-full h-11 px-4 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-sm transition-all"
                />
              </div>

              {/* Gender (For hostel block segregation) */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#F7FAFC]">
                  Gender (for block allotment) *
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-sm transition-all"
                >
                  <option value="Male">Male (Boys Hostel Block)</option>
                  <option value="Female">Female (Girls Hostel Block)</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              {/* College / Organisation */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#F7FAFC]">
                  College or organisation *
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={collegeOrOrg}
                    onChange={(e) => setCollegeOrOrg(e.target.value)}
                    placeholder="e.g. IIT Madras"
                    className="w-full h-11 pl-10 pr-4 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-sm transition-all"
                  />
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-[13px] font-medium text-[#F7FAFC]">
                  Emergency contact (name &amp; phone) *
                </label>
                <div className="relative">
                  <ShieldAlert className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="e.g. Father: +91 98401 99999"
                    className="w-full h-11 pl-10 pr-4 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-sm transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Check-in & Check-out Dates */}
            <div className="pt-5 border-t border-[#2B2E32] space-y-4">
              <h3 className="text-base font-bold text-[#F7FAFC] flex items-center gap-2 font-heading tracking-tight">
                <Calendar className="w-4 h-4 text-[#5EE5BC]" />
                <span>Stay dates</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#F7FAFC]">
                    Check-in date
                  </label>
                  <input
                    type="date"
                    required
                    min={today}
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#F7FAFC]">
                    Check-out date
                  </label>
                  <input
                    type="date"
                    required
                    min={checkInDate || today}
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* LIVE ORDER SUMMARY */}
            <OrderSummary
              nights={nights}
              ratePerNight={settings.per_night_fee}
              flatFee={settings.flat_fee}
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              paymentsEnabled={settings.payments_enabled}
            />

            {/* PRIMARY CTA BUTTON (Aqua Pastel fill #5EE5BC, 8px radius) */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting || nights <= 0}
                className="btn-primary w-full h-12 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold"
              >
                <span>
                  {isSubmitting
                    ? 'Creating registration...'
                    : settings.payments_enabled
                    ? 'Continue to payment'
                    : 'Confirm stay (free allotment)'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </TiltCard>
      </div>
    </div>
  );
};
