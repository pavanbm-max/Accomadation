import React, { useState } from 'react';
import type { Settings } from '../types';
import { formatINR } from '../lib/formatters';
import { 
  CreditCard, 
  Clock, 
  ShieldCheck, 
  Save, 
  Lock
} from 'lucide-react';

interface PricingSettingsCardProps {
  settings: Settings;
  onSave: (updates: Partial<Settings>) => Promise<void>;
  isAdmin: boolean;
}

export const PricingSettingsCard: React.FC<PricingSettingsCardProps> = ({
  settings,
  onSave,
  isAdmin,
}) => {
  const [perNightFee, setPerNightFee] = useState<number>(settings.per_night_fee);
  const [flatFee, setFlatFee] = useState<number>(settings.flat_fee);
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean>(settings.payments_enabled);
  const [expiryMinutes, setExpiryMinutes] = useState<number>(settings.expiry_minutes);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSave({
        per_night_fee: Number(perNightFee),
        flat_fee: Number(flatFee),
        payments_enabled: paymentsEnabled,
        expiry_minutes: Number(expiryMinutes),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-6 sm:p-8 text-[#F7FAFC]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#2B2E32] gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#5EE5BC]" />
            <h3 className="text-xl font-bold font-heading tracking-tight text-[#F7FAFC]">
              Accommodation pricing &amp; payment rules
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Configure default per-night stay tariffs and check-out timeout window.
          </p>
        </div>

        {/* Read-only Gateway Status Indicator */}
        <div className="flex flex-col sm:items-end">
          <span className="text-[11px] font-medium text-[#94A3B8]">
            Payment gateway status
          </span>
          <div className="inline-flex items-center gap-2 mt-1 px-3 py-1 rounded-md bg-[#24262A] border border-[#2B2E32] text-xs font-medium text-[#F7FAFC]">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span>Not connected (placeholder)</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Per Night Fee */}
          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Per night rate (₹)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#94A3B8] font-semibold">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="1"
                required
                disabled={!isAdmin}
                value={perNightFee}
                onChange={(e) => setPerNightFee(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC] disabled:opacity-60 text-sm font-medium font-mono"
              />
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              Current default: {formatINR(perNightFee)} / participant / night.
            </p>
          </div>

          {/* Flat Registration / Amenities Fee */}
          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              One-time flat fee (₹)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#94A3B8] font-semibold">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="1"
                disabled={!isAdmin}
                value={flatFee}
                onChange={(e) => setFlatFee(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC] disabled:opacity-60 text-sm font-medium font-mono"
              />
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              Additional one-time amenities/caution fee added to total stay amount.
            </p>
          </div>

          {/* Expiry Minutes */}
          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Session expiry window (minutes)
            </label>
            <div className="relative">
              <Clock className="absolute left-3.5 top-3 w-4 h-4 text-[#94A3B8]" />
              <input
                type="number"
                min="5"
                max="120"
                required
                disabled={!isAdmin}
                value={expiryMinutes}
                onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC] disabled:opacity-60 text-sm font-medium font-mono"
              />
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              Unpaid registrations automatically expire after this duration.
            </p>
          </div>

          {/* Payments Active Toggle */}
          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Online payments status
            </label>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => setPaymentsEnabled(!paymentsEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
                  paymentsEnabled ? 'bg-[#5EE5BC]' : 'bg-[#2B2E32]'
                } disabled:opacity-50`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#0C1D18] shadow-soft ring-0 transition duration-150 ease-in-out ${
                    paymentsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-medium text-[#F7FAFC]">
                {paymentsEnabled ? 'Payments enabled (active)' : 'Payments disabled (exempt mode)'}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              If disabled, registrations are automatically confirmed at ₹0.
            </p>
          </div>
        </div>

        {/* Security Note banner (No API keys in the UI) */}
        <div className="p-4 rounded-md bg-[#24262A] border border-[#2B2E32] flex items-start gap-3">
          <Lock className="w-4 h-4 text-[#94A3B8] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-[#94A3B8] space-y-1">
            <span className="font-semibold text-[#F7FAFC] block">
              Gateway keys are configured securely on the server.
            </span>
            <p>
              In accordance with security standards, Razorpay or payment provider secret keys reside exclusively in Supabase environment secrets (<code className="bg-[#1B1D20] border border-[#2B2E32] px-1 py-0.5 rounded text-[11px] font-mono text-[#5EE5BC]">RAZORPAY_KEY_SECRET</code>) and are never exposed to browser memory.
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center justify-between pt-4 border-t border-[#2B2E32]">
            {savedSuccess ? (
              <span className="text-xs font-semibold text-[#5EE5BC] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#5EE5BC]" />
                Settings saved successfully!
              </span>
            ) : (
              <span className="text-xs text-[#94A3B8]">All updates apply instantly to new registrations.</span>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary inline-flex items-center gap-2 py-2.5 px-5 text-xs font-semibold disabled:opacity-50 rounded-md"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save settings'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
