import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { OrderSummary } from '../components/OrderSummary';
import { TiltCard } from '../components/TiltCard';
import { calculateNights } from '../lib/formatters';
import { 
  getPublicSettings, 
  getPublishedAnnouncements, 
  createRegistration, 
  createTeamRegistrations,
  lookupPending 
} from '../lib/api';
import { useToast } from '../context/ToastContext';
import type { PublicSettings, Announcement } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  User, 
  Users,
  UserPlus,
  Trash2,
  Building, 
  ShieldAlert, 
  ArrowRight, 
  Megaphone,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  MapPin,
  HelpCircle,
  ShieldCheck
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

  // Team Registration State
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [teammates, setTeammates] = useState<Array<{
    id: string;
    fullName: string;
    phone: string;
    email: string;
    gender: 'Male' | 'Female';
    emergencyContact: string;
  }>>([]);

  const addTeammate = () => {
    setTeammates((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        fullName: '',
        phone: '',
        email: '',
        gender: 'Male',
        emergencyContact: '',
      },
    ]);
  };

  const updateTeammate = (index: number, field: string, value: string) => {
    setTeammates((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeTeammate = (index: number) => {
    setTeammates((prev) => prev.filter((_, i) => i !== index));
  };

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
  const totalMembersCount = isTeamMode ? 1 + teammates.length : 1;

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
      toastError('Please enter a valid 10-digit mobile number for Participant 1.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toastError('Please enter a valid email address for Participant 1.');
      return;
    }

    // Team registration flow
    if (isTeamMode) {
      for (let i = 0; i < teammates.length; i++) {
        const tm = teammates[i];
        if (!tm.fullName.trim()) {
          toastError(`Please enter full name for Teammate #${i + 2}.`);
          return;
        }
        if (!tm.phone.trim() || tm.phone.trim().length < 10) {
          toastError(`Please enter a valid 10-digit mobile number for Teammate #${i + 2}.`);
          return;
        }
        if (!tm.email.trim() || !tm.email.includes('@')) {
          toastError(`Please enter a valid email address for Teammate #${i + 2}.`);
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const allMembers = [
          {
            fullName: fullName.trim(),
            phone: phone.trim(),
            email: email.trim().toLowerCase(),
            gender,
            emergencyContact: emergencyContact.trim(),
          },
          ...teammates.map((tm) => ({
            fullName: tm.fullName.trim(),
            phone: tm.phone.trim(),
            email: tm.email.trim().toLowerCase(),
            gender: tm.gender,
            emergencyContact: tm.emergencyContact.trim(),
          })),
        ];

        const res = await createTeamRegistrations({
          checkInDate,
          checkOutDate,
          collegeOrOrganisation: collegeOrOrg.trim(),
          members: allMembers,
        });

        // Store all teammate tickets in localStorage so each can be viewed / printed
        if (res.allRegistrations && res.allRegistrations.length > 0) {
          const passPayload = JSON.stringify(res.allRegistrations);
          res.allRegistrations.forEach((r) => {
            localStorage.setItem(`team_${r.scanToken}`, passPayload);
          });
          localStorage.setItem(`team_${res.primaryRegistration.scanToken}`, passPayload);
        }

        if (res.primaryRegistration.paymentStatus === 'paid') {
          toastSuccess(`Team accommodation registered for ${allMembers.length} participants!`);
          navigate(`/confirmation/${res.primaryRegistration.scanToken}`);
        } else {
          navigate(`/checkout/${res.primaryRegistration.scanToken}`);
        }
      } catch (err: any) {
        console.error('Team registration error:', err);
        toastError(err.message || 'Failed to submit team registration.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Individual registration flow
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
    <div className="page-ambient-bg relative min-h-[calc(100vh-4rem)] py-8 sm:py-14 px-4 sm:px-6 lg:px-8 bg-transparent text-[#F0FDF9]">
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

        {/* Editorial Hero Header with Prominent Official Logo */}
        <div className="text-center space-y-5">
          {/* Official University & Fest Identity Showcase */}
          <div className="flex justify-center">
            <div className="relative group">
              <div className="absolute -inset-3 bg-gradient-to-r from-[#00F5B8]/20 via-[#38BDF8]/20 to-[#00F5B8]/20 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative flex items-center gap-4 sm:gap-6 px-5 sm:px-8 py-3 sm:py-4 rounded-2xl bg-[#061419]/90 backdrop-blur-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
                {/* GM University Authentic Gold Crest */}
                <img 
                  src="/gmu-logo.png" 
                  alt="GM University" 
                  className="h-12 sm:h-16 w-auto object-contain drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] transition-transform duration-200 group-hover:scale-105" 
                  loading="eager"
                />
                
                {/* Refined Divider */}
                <div className="h-10 sm:h-12 w-px bg-white/20" />
                
                {/* IGNITRON 2K26 Authentic Wordmark */}
                <div className="flex flex-col text-left">
                  <img 
                    src="/ignitron-2k26-logo.png" 
                    alt="IGNITRON 2K26" 
                    className="h-8 sm:h-11 w-auto object-contain drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)] transition-transform duration-200 group-hover:scale-105" 
                    loading="eager"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="tracking-wider uppercase font-semibold text-[#9FB9C1] text-[10px] sm:text-xs">
                      Campus Accommodation Portal
                    </span>
                    <span className="font-mono font-bold tracking-wider uppercase bg-[#00F5B8]/15 text-[#00F5B8] px-2 py-0.5 rounded border border-[#00F5B8]/30 text-[9px] sm:text-[10px] shadow-[0_0_8px_rgba(0,245,184,0.2)]">
                      OFFICIAL
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#F7FAFC] font-heading leading-tight">
            Hostel stay registration
          </h1>
          <p className="text-xs sm:text-base text-[#94A3B8] max-w-xl mx-auto leading-relaxed px-2">
            Reserve your campus accommodation for Ignitron 2K26. Verified stay allotment is generated immediately upon payment.
          </p>

          {/* Stepper (Details → Payment → Confirmed) */}
          <div className="pt-2 flex items-center justify-center gap-1.5 sm:gap-4 text-[11px] sm:text-xs font-medium">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[#F7FAFC] font-semibold">
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#5EE5BC] text-[#0C1D18] flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-[0_0_12px_rgba(94,229,188,0.35)]">
                1
              </span>
              <span>Details</span>
            </div>
            <div className="w-4 sm:w-8 h-px bg-[#2B2E32]" />
            <div className="flex items-center gap-1.5 sm:gap-2 text-[#94A3B8]">
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#24262A] border border-[#2B2E32] text-[#94A3B8] flex items-center justify-center text-[10px] sm:text-xs font-medium">
                2
              </span>
              <span>Payment</span>
            </div>
            <div className="w-4 sm:w-8 h-px bg-[#2B2E32]" />
            <div className="flex items-center gap-1.5 sm:gap-2 text-[#94A3B8]">
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#24262A] border border-[#2B2E32] text-[#94A3B8] flex items-center justify-center text-[10px] sm:text-xs font-medium">
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

        {/* REGISTRATION FORM CARD WITH ELEGANT INSTITUTIONAL WATERMARK */}
        <TiltCard className="p-4 sm:p-8 md:p-10 relative overflow-hidden">
          {/* Subtle Faded GM University Crest Watermark (Top Right) */}
          <img 
            src="/gmu-logo.png" 
            alt="" 
            aria-hidden="true" 
            className="pointer-events-none select-none absolute -right-12 -top-12 w-64 sm:w-80 opacity-[0.045] object-contain" 
          />
          {/* Subtle Faded IGNITRON 2K26 Wordmark Watermark (Bottom Left) */}
          <img 
            src="/ignitron-2k26-logo.png" 
            alt="" 
            aria-hidden="true" 
            className="pointer-events-none select-none absolute -left-16 -bottom-8 w-72 sm:w-96 opacity-[0.04] object-contain" 
          />

          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            
            {/* Registration Mode Selector: Individual vs Team */}
            <div className="space-y-2 pb-2">
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Select Booking Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1.5 rounded-xl bg-[#040E12]/80 backdrop-blur-md border border-[#00F5B8]/20">
                <button
                  type="button"
                  onClick={() => {
                    setIsTeamMode(false);
                    setTeammates([]);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                    !isTeamMode
                      ? 'bg-gradient-to-r from-[#00F5B8] to-[#00C49F] text-[#021713] shadow-[0_0_24px_rgba(0,245,184,0.35)] font-semibold'
                      : 'text-[#9FB9C1] hover:text-[#F0FDF9] hover:bg-[#061419]/70'
                  }`}
                >
                  <div className={`p-2 rounded-md ${!isTeamMode ? 'bg-[#021713]/15 text-[#021713]' : 'bg-[#0B1E26] text-[#00F5B8]'}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold">Individual Stay</div>
                    <div className={`text-[11px] ${!isTeamMode ? 'text-[#021713]/80' : 'text-[#5A7E88]'}`}>
                      Single pass &amp; QR code
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsTeamMode(true);
                    if (teammates.length === 0) {
                      addTeammate();
                    }
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                    isTeamMode
                      ? 'bg-gradient-to-r from-[#00F5B8] to-[#00C49F] text-[#021713] shadow-[0_0_24px_rgba(0,245,184,0.35)] font-semibold'
                      : 'text-[#9FB9C1] hover:text-[#F0FDF9] hover:bg-[#061419]/70'
                  }`}
                >
                  <div className={`p-2 rounded-md ${isTeamMode ? 'bg-[#021713]/15 text-[#021713]' : 'bg-[#0B1E26] text-[#00F5B8]'}`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold">Team / Group Stay</div>
                    <div className={`text-[11px] ${isTeamMode ? 'text-[#021713]/80' : 'text-[#5A7E88]'}`}>
                      Separate passes &amp; QRs for each member
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="text-left border-b border-[#2B2E32] pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#F7FAFC] font-heading tracking-tight flex items-center gap-2">
                  <span>{isTeamMode ? 'Participant 1 (Team Leader)' : 'Participant details'}</span>
                  {isTeamMode && (
                    <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#5EE5BC]/15 text-[#5EE5BC] border border-[#5EE5BC]/30">
                      Primary Contact
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[#94A3B8] mt-1">
                  {isTeamMode 
                    ? 'Fill the team leader details first. You can add as many teammates as you want below.'
                    : 'All accommodation is allocated individually per participant.'}
                </p>
              </div>
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

              {/* Gender (For hostel block segregation: strictly Male or Female) */}
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

            {/* DYNAMIC TEAMMATES SECTION (When Team Mode is Active) */}
            {isTeamMode && (
              <div className="pt-6 border-t border-[#2B2E32] space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#F7FAFC] flex items-center gap-2 font-heading tracking-tight">
                      <Users className="w-4 h-4 text-[#5EE5BC]" />
                      <span>Teammates ({teammates.length})</span>
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      Each teammate gets their own unique Reference ID, personal QR code, and email notification.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addTeammate}
                    className="btn-secondary inline-flex items-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-md border border-[#5EE5BC]/40 text-[#5EE5BC] hover:bg-[#5EE5BC]/10"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add Teammate</span>
                  </button>
                </div>

                {teammates.length === 0 ? (
                  <div className="p-5 rounded-lg border border-dashed border-[#2B2E32] bg-[#151618] text-center space-y-3">
                    <p className="text-xs text-[#94A3B8]">
                      No additional teammates added yet. Click below to add your first teammate.
                    </p>
                    <button
                      type="button"
                      onClick={addTeammate}
                      className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Add Teammate</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {teammates.map((tm, index) => (
                      <div
                        key={tm.id}
                        className="p-4 sm:p-5 rounded-lg bg-[#151618] border border-[#2B2E32] relative space-y-4"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-[#2B2E32]">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#5EE5BC]/15 text-[#5EE5BC] border border-[#5EE5BC]/30 flex items-center justify-center text-xs font-bold font-mono">
                              {index + 2}
                            </span>
                            <span className="text-xs font-bold text-[#F7FAFC]">
                              Teammate #{index + 2}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeTeammate(index)}
                            className="inline-flex items-center gap-1 text-xs text-[#F87171] hover:text-[#EF4444] p-1.5 rounded hover:bg-[#EF4444]/10 transition-colors"
                            title="Remove teammate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-medium">Remove</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Teammate Name */}
                          <div className="sm:col-span-2 space-y-1">
                            <label className="block text-xs font-medium text-[#F7FAFC]">
                              Full name *
                            </label>
                            <input
                              type="text"
                              required
                              value={tm.fullName}
                              onChange={(e) => updateTeammate(index, 'fullName', e.target.value)}
                              placeholder="Teammate full name"
                              className="w-full h-10 px-3 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-xs transition-all"
                            />
                          </div>

                          {/* Teammate Phone */}
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-[#F7FAFC]">
                              Mobile number *
                            </label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[11px] font-semibold text-[#94A3B8] select-none">
                                +91
                              </span>
                              <input
                                type="tel"
                                required
                                value={tm.phone}
                                onChange={(e) => updateTeammate(index, 'phone', e.target.value)}
                                placeholder="98401 00000"
                                className="w-full h-10 pl-11 pr-3 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-xs transition-all"
                              />
                            </div>
                          </div>

                          {/* Teammate Email */}
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-[#F7FAFC]">
                              Email address (for pass &amp; QR) *
                            </label>
                            <input
                              type="email"
                              required
                              value={tm.email}
                              onChange={(e) => updateTeammate(index, 'email', e.target.value)}
                              placeholder="teammate@college.ac.in"
                              className="w-full h-10 px-3 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-xs transition-all"
                            />
                          </div>

                          {/* Teammate Gender */}
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-[#F7FAFC]">
                              Gender (hostel block) *
                            </label>
                            <select
                              value={tm.gender}
                              onChange={(e) => updateTeammate(index, 'gender', e.target.value as 'Male' | 'Female')}
                              className="w-full h-10 px-3 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-xs transition-all"
                            >
                              <option value="Male">Male (Boys Hostel Block)</option>
                              <option value="Female">Female (Girls Hostel Block)</option>
                            </select>
                          </div>

                          {/* Teammate Emergency Contact */}
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-[#F7FAFC]">
                              Emergency contact
                            </label>
                            <input
                              type="text"
                              value={tm.emergencyContact}
                              onChange={(e) => updateTeammate(index, 'emergencyContact', e.target.value)}
                              placeholder="Parent / Guardian phone"
                              className="w-full h-10 px-3 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:border-[#5EE5BC] focus:ring-2 focus:ring-[#5EE5BC] focus:outline-none text-xs transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Bottom Add Teammate Button */}
                    <button
                      type="button"
                      onClick={addTeammate}
                      className="w-full py-3 px-4 rounded-lg border border-dashed border-[#5EE5BC]/40 hover:border-[#5EE5BC] bg-[#5EE5BC]/5 hover:bg-[#5EE5BC]/10 text-[#5EE5BC] text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>+ Add Another Teammate (Member #{teammates.length + 2})</span>
                    </button>
                  </div>
                )}
              </div>
            )}

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
              membersCount={totalMembersCount}
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
                    ? isTeamMode
                      ? `Continue to payment (${totalMembersCount} participants)`
                      : 'Continue to payment'
                    : isTeamMode
                    ? `Confirm team stay (${totalMembersCount} participants)`
                    : 'Confirm stay (free allotment)'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </TiltCard>

        {/* HELP & QUERY CONTACT SUPPORT DESK */}
        <div className="rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2B2E32]">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#5EE5BC] uppercase tracking-wider">
                <HelpCircle className="w-4 h-4 text-[#5EE5BC]" />
                <span>Accommodation Help Desk</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-heading text-[#F7FAFC]">
                Have queries about hostel allotment?
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Our student coordinators and accommodation staff are available to assist you.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#94A3B8] bg-[#24262A] px-3 py-1.5 rounded-md border border-[#2B2E32] w-fit">
              <Clock className="w-3.5 h-3.5 text-[#5EE5BC]" />
              <span>Desk Hours: 8:00 AM – 10:00 PM</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Phone Support */}
            <a
              href="tel:+919980745913"
              className="group p-4 rounded-lg bg-[#24262A] border border-[#2B2E32] hover:border-[#5EE5BC]/40 transition-all duration-200 block"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="p-2 rounded-md bg-[#5EE5BC]/10 text-[#5EE5BC] group-hover:scale-110 transition-transform">
                  <Phone className="w-4 h-4" />
                </span>
                <span className="text-xs font-medium text-[#94A3B8]">Helpline &amp; WhatsApp</span>
              </div>
              <div className="text-base font-bold text-[#F7FAFC] font-mono group-hover:text-[#5EE5BC] transition-colors">
                +91 99807 45913
              </div>
              <span className="text-[11px] text-[#5EE5BC] font-medium mt-1 inline-flex items-center gap-1">
                <span>Tap to call / message</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </a>

            {/* Email Support */}
            <a
              href="mailto:pavan.b.m1598@gmail.com?subject=Ignitron%202K26%20Hostel%20Accommodation%20Query"
              className="group p-4 rounded-lg bg-[#24262A] border border-[#2B2E32] hover:border-[#5EE5BC]/40 transition-all duration-200 block"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="p-2 rounded-md bg-[#5EE5BC]/10 text-[#5EE5BC] group-hover:scale-110 transition-transform">
                  <Mail className="w-4 h-4" />
                </span>
                <span className="text-xs font-medium text-[#94A3B8]">Official Inquiries</span>
              </div>
              <div className="text-sm font-bold text-[#F7FAFC] truncate group-hover:text-[#5EE5BC] transition-colors" title="pavan.b.m1598@gmail.com">
                pavan.b.m1598@gmail.com
              </div>
              <span className="text-[11px] text-[#5EE5BC] font-medium mt-1 inline-flex items-center gap-1">
                <span>Send direct email</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </a>

            {/* Campus Desk Location */}
            <div className="p-4 rounded-lg bg-[#24262A] border border-[#2B2E32] sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="p-2 rounded-md bg-[#5EE5BC]/10 text-[#5EE5BC]">
                  <MapPin className="w-4 h-4" />
                </span>
                <span className="text-xs font-medium text-[#94A3B8]">Campus Location</span>
              </div>
              <div className="text-xs font-semibold text-[#F7FAFC] leading-snug">
                Hostel Allocation Center
              </div>
              <div className="text-[11px] text-[#94A3B8] mt-0.5">
                Main Campus Reception &amp; Boys/Girls Blocks
              </div>
            </div>
          </div>
        </div>

        {/* REFINED BRAND FOOTER */}
        <footer className="pt-6 pb-8 border-t border-[#00F5B8]/15 text-center space-y-4">
          <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
            <img
              src="/gmu-logo.png"
              alt="GM University"
              className="h-10 w-auto object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
            />
            <div className="h-6 w-px bg-white/20" />
            <img
              src="/ignitron-2k26-logo.png"
              alt="IGNITRON 2K26"
              className="h-7 w-auto object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
            />
            <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#00F5B8]/15 text-[#00F5B8] border border-[#00F5B8]/30">
              Hostel Desk
            </span>
          </div>

          <p className="text-xs text-[#9FB9C1] max-w-md mx-auto leading-relaxed">
            GM University, Davangere · IGNITRON 2K26 National Technical Fest · For inquiries contact <a href="mailto:pavan.b.m1598@gmail.com" className="text-[#00F5B8] hover:underline">pavan.b.m1598@gmail.com</a> or call <a href="tel:+919980745913" className="text-[#00F5B8] hover:underline">+91 99807 45913</a>.
          </p>

          <div className="text-[11px] text-[#5A7E88] flex items-center justify-center gap-2">
            <span>© 2026 GM University &amp; Ignitron. All rights reserved.</span>
            <span>·</span>
            <Link to="/admin/login" className="hover:text-[#00F5B8] transition-colors">
              Staff Portal
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
};
