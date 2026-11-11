import React, { useState } from 'react';
import type { Registration } from '../types';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { formatINR, formatDateTime, formatDate } from '../lib/formatters';
import { 
  X, 
  Store, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  ShieldCheck,
  Edit3,
  Trash2,
  UserCheck,
  UserX,
  AlertCircle
} from 'lucide-react';

interface PaymentDetailsPanelProps {
  registration: Registration | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkPaidAtDesk: (id: string, note: string, receipt?: string) => Promise<void>;
  onEdit?: (registration: Registration) => void;
  onDelete?: (registration: Registration) => void;
  onToggleCheckIn?: (id: string, currentlyCheckedIn: boolean) => Promise<void>;
  isAdmin: boolean;
}

export const PaymentDetailsPanel: React.FC<PaymentDetailsPanelProps> = ({
  registration,
  isOpen,
  onClose,
  onMarkPaidAtDesk,
  onEdit,
  onDelete,
  onToggleCheckIn,
  isAdmin,
}) => {
  const [showDeskModal, setShowDeskModal] = useState(false);
  const [deskNote, setDeskNote] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTogglingCheckIn, setIsTogglingCheckIn] = useState(false);

  if (!isOpen || !registration) return null;

  const isPaid = registration.payment_status === 'paid' || registration.payment_status === 'paid_at_desk';
  const isCheckedIn = Boolean(registration.checked_in_at);

  const handleDeskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deskNote.trim()) return;
    setIsSubmitting(true);
    try {
      await onMarkPaidAtDesk(registration.id, deskNote, receiptNo);
      setShowDeskModal(false);
      setDeskNote('');
      setReceiptNo('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleCheckIn = async () => {
    if (!onToggleCheckIn) return;
    setIsTogglingCheckIn(true);
    try {
      await onToggleCheckIn(registration.id, isCheckedIn);
    } finally {
      setIsTogglingCheckIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-[#F7FAFC]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#1B1D20] shadow-[0_8px_32px_rgba(0,0,0,0.6)] border-l border-[#2B2E32] flex flex-col justify-between">
          {/* Header */}
          <div className="p-6 border-b border-[#2B2E32] flex items-center justify-between">
            <div>
              <div className="text-xs font-mono font-medium text-[#5EE5BC]">
                {registration.reference_id}
              </div>
              <h3 className="text-lg font-bold text-[#F7FAFC] font-heading tracking-tight mt-0.5">
                Registration &amp; payment details
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[#94A3B8] hover:text-[#F7FAFC] rounded-md hover:bg-[#24262A] transition-colors"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
            {/* Status & Amount Hero */}
            <div className="p-4 rounded-md bg-[#24262A] border border-[#2B2E32] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#94A3B8] font-medium">Payment status</span>
                <div className="mt-1">
                  <PaymentStatusBadge status={registration.payment_status} size="lg" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#94A3B8] font-medium">Total amount</span>
                <div className="text-2xl font-bold text-[#5EE5BC] font-heading tracking-tight mt-0.5 drop-shadow-[0_0_12px_rgba(94,229,188,0.25)]">
                  {formatINR(registration.amount)}
                </div>
              </div>
            </div>

            {/* Guest Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[#94A3B8]">Guest information</h4>
              <div className="p-4 rounded-md bg-[#24262A] border border-[#2B2E32] space-y-2.5">
                <div className="flex items-center gap-2.5 text-[#F7FAFC] font-semibold">
                  <User className="w-4 h-4 text-[#5EE5BC]" />
                  <span>{registration.full_name}</span>
                  {registration.gender && (
                    <span className="text-xs text-[#94A3B8] font-normal">({registration.gender})</span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-[#94A3B8]">
                  <Phone className="w-4 h-4 text-[#94A3B8]" />
                  <span>{registration.phone}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[#94A3B8]">
                  <Mail className="w-4 h-4 text-[#94A3B8]" />
                  <span>{registration.email}</span>
                </div>
                {registration.emergency_contact && (
                  <div className="flex items-center gap-2.5 text-xs text-[#94A3B8]">
                    <AlertCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>Emergency Contact: <strong className="text-[#F7FAFC] font-mono">{registration.emergency_contact}</strong></span>
                  </div>
                )}
                {registration.college_or_organisation && (
                  <div className="text-xs text-[#94A3B8] border-t border-[#2B2E32] pt-2">
                    Institution: <span className="font-semibold text-[#F7FAFC]">{registration.college_or_organisation}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stay Dates */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[#94A3B8]">Accommodation dates</h4>
              <div className="p-4 rounded-md bg-[#24262A] border border-[#2B2E32] space-y-2">
                <div className="flex items-center justify-between text-[#94A3B8]">
                  <span className="flex items-center gap-2 font-medium">
                    <Calendar className="w-4 h-4 text-[#5EE5BC]" />
                    Check-in date
                  </span>
                  <span className="font-semibold text-[#F7FAFC]">{formatDate(registration.check_in_date)}</span>
                </div>
                <div className="flex items-center justify-between text-[#94A3B8]">
                  <span className="flex items-center gap-2 font-medium">
                    <Calendar className="w-4 h-4 text-[#5EE5BC]" />
                    Check-out date
                  </span>
                  <span className="font-semibold text-[#F7FAFC]">{formatDate(registration.check_out_date)}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#2B2E32] text-[#94A3B8]">
                  <span>Stay length</span>
                  <span className="font-mono font-medium text-[#F7FAFC]">{registration.nights} night(s) × {formatINR(registration.rate_per_night)}</span>
                </div>
              </div>
            </div>

            {/* Payment Audit Info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Payment audit trail</h4>
              <div className="p-4 rounded-md bg-[#24262A] border border-[#2B2E32] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Method</span>
                  <span className="font-mono font-semibold text-[#F7FAFC]">
                    {registration.payment_method || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Transaction ID</span>
                  <span className="font-mono font-semibold text-[#F7FAFC]">
                    {registration.transaction_id || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Paid timestamp</span>
                  <span className="text-[#F7FAFC] font-medium">
                    {formatDateTime(registration.paid_at)}
                  </span>
                </div>
                {registration.admin_note && (
                  <div className="pt-2 border-t border-[#2B2E32] text-[#94A3B8]">
                    <span className="font-semibold text-[#F7FAFC]">Admin note: </span>
                    {registration.admin_note}
                  </div>
                )}
              </div>
            </div>

            {/* Check-in Status */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Check-in state</h4>
              <div className="p-4 rounded-md bg-[#24262A] border border-[#2B2E32] space-y-2 text-xs">
                {registration.checked_in_at ? (
                  <div className="flex items-center gap-2 text-[#5EE5BC] font-semibold">
                    <ShieldCheck className="w-4 h-4 text-[#5EE5BC]" />
                    <span>Checked in on {formatDateTime(registration.checked_in_at)}</span>
                  </div>
                ) : (
                  <div className="text-[#94A3B8] italic">Not yet checked in at reception counter.</div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions (Admin Only) */}
          {isAdmin && (
            <div className="p-5 border-t border-[#2B2E32] bg-[#151618] space-y-2.5">
              {!isPaid && (
                <button
                  onClick={() => setShowDeskModal(true)}
                  className="btn-primary w-full py-2 px-3 text-xs font-semibold flex items-center justify-center gap-2 rounded-md"
                >
                  <Store className="w-4 h-4" />
                  <span>Mark as paid at desk</span>
                </button>
              )}

              {/* Check-in toggle */}
              {onToggleCheckIn && (
                <button
                  type="button"
                  disabled={isTogglingCheckIn}
                  onClick={handleToggleCheckIn}
                  className={`w-full py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    isCheckedIn
                      ? 'bg-[#24262A] text-[#F87171] hover:bg-[#AB252C]/20 border border-[#2B2E32]'
                      : 'bg-[#5EE5BC]/10 text-[#5EE5BC] hover:bg-[#5EE5BC]/20 border border-[#5EE5BC]/30'
                  }`}
                >
                  {isCheckedIn ? (
                    <>
                      <UserX className="w-4 h-4" />
                      <span>{isTogglingCheckIn ? 'Updating...' : 'Undo Check-in'}</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>{isTogglingCheckIn ? 'Updating...' : 'Check-in Guest'}</span>
                    </>
                  )}
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(registration);
                      onClose();
                    }}
                    className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-md"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#5EE5BC]" />
                    <span>Edit record</span>
                  </button>
                )}

                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(registration);
                      onClose();
                    }}
                    className="py-2 px-3 rounded-md bg-[#AB252C]/15 hover:bg-[#AB252C]/25 text-[#F87171] border border-[#AB252C]/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MARK PAID AT DESK MODAL */}
      {showDeskModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#1B1D20] rounded-lg p-6 max-w-md w-full shadow-[0_8px_32px_rgba(0,0,0,0.6)] border border-[#2B2E32]">
            <h3 className="text-lg font-bold text-[#F7FAFC] font-heading">
              Mark as paid at desk
            </h3>
            <p className="text-xs text-[#94A3B8] mt-1">
              Confirm receipt of cash or spot swipe at reception. A required note must be entered for the audit trail.
            </p>
            <form onSubmit={handleDeskSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#F7FAFC] block mb-1">
                  Desk note / settlement details *
                </label>
                <textarea
                  required
                  rows={2}
                  value={deskNote}
                  onChange={(e) => setDeskNote(e.target.value)}
                  placeholder="e.g. Cash collected at reception desk by Warden."
                  className="w-full text-xs rounded-md border border-[#2B2E32] bg-[#24262A] p-3 text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#F7FAFC] block mb-1">
                  Receipt / POS slip number (optional)
                </label>
                <input
                  type="text"
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder="e.g. DESK-REC-4821"
                  className="w-full text-xs rounded-md border border-[#2B2E32] bg-[#24262A] p-2.5 text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeskModal(false)}
                  className="btn-secondary py-2 px-4 text-xs font-medium rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !deskNote.trim()}
                  className="btn-primary py-2 px-4 text-xs font-semibold disabled:opacity-50 rounded-md"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm desk payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
