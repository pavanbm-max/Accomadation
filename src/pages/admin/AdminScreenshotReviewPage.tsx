import React, { useState, useEffect } from 'react';
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge';
import { Modal } from '../../components/Modal';
import { formatINR, formatDate } from '../../lib/formatters';
import { getRegistrations, reviewScreenshot } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import type { Registration } from '../../types';
import { 
  FileCheck, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Inbox
} from 'lucide-react';

export const AdminScreenshotReviewPage: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();

  const [queue, setQueue] = useState<Registration[]>([]);
  const [, setLoading] = useState(true);

  // Review Modals State
  const [activeReg, setActiveReg] = useState<Registration | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [verifiedTxnId, setVerifiedTxnId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await getRegistrations({ status: 'under_review' });
      setQueue(data);
    } catch (e: any) {
      toastError(e.message || 'Failed to load review queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleApprove = async () => {
    if (!activeReg) return;
    setIsSubmitting(true);
    try {
      await reviewScreenshot(activeReg.id, 'approve', undefined, verifiedTxnId);
      toastSuccess(`Approved ${activeReg.reference_id}. Registration marked as paid.`);
      setShowApproveModal(false);
      setActiveReg(null);
      setVerifiedTxnId('');
      loadQueue();
    } catch (e: any) {
      toastError(e.message || 'Approval failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!activeReg || !rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      await reviewScreenshot(activeReg.id, 'reject', rejectReason);
      toastSuccess(`Screenshot rejected for ${activeReg.reference_id}.`);
      setShowRejectModal(false);
      setActiveReg(null);
      setRejectReason('');
      loadQueue();
    } catch (e: any) {
      toastError(e.message || 'Rejection failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-[#F7FAFC]">
      <div className="pb-4 border-b border-[#2B2E32]">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F7FAFC] font-heading tracking-tight">
          Payment screenshot review queue
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
          Verify participant bank debit screenshots, validate transaction UTRs, and grant room allotments.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-lg bg-[#1B1D20] border border-[#2B2E32] p-12 text-center text-[#94A3B8]">
          <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40 text-[#94A3B8]" />
          <h3 className="text-base font-bold text-[#F7FAFC] font-heading tracking-tight">
            Queue is clear
          </h3>
          <p className="text-xs text-[#94A3B8] mt-1">
            No payment screenshots currently pending administrator review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {queue.map((reg) => (
            <div
              key={reg.id}
              className="rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="p-4 border-b border-[#2B2E32] flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#5EE5BC]">
                      {reg.reference_id}
                    </span>
                    <h3 className="text-base font-bold text-[#F7FAFC] font-heading mt-0.5">
                      {reg.full_name}
                    </h3>
                  </div>
                  <PaymentStatusBadge status={reg.payment_status} size="sm" />
                </div>

                {/* Screenshot Preview Card */}
                <div className="p-4 space-y-3">
                  <div className="rounded-md bg-[#24262A] p-4 text-center border border-[#2B2E32] flex flex-col items-center justify-center min-h-[140px]">
                    {reg.screenshot_path ? (
                      <div className="space-y-2">
                        <FileCheck className="w-8 h-8 text-[#5EE5BC] mx-auto" />
                        <span className="text-xs font-mono font-medium text-[#F7FAFC] block truncate max-w-[200px]">
                          {reg.screenshot_path}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5EE5BC] bg-[#5EE5BC]/10 px-2.5 py-0.5 rounded-md border border-[#5EE5BC]/25">
                          <Eye className="w-3 h-3" />
                          <span>Private file verified</span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#64748B] italic">No image file stored</span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Total due</span>
                      <span className="font-bold text-[#5EE5BC] font-mono">
                        {formatINR(reg.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Stay window</span>
                      <span className="font-semibold text-[#F7FAFC]">
                        {formatDate(reg.check_in_date)} ({reg.nights} nights)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Claimed ref</span>
                      <span className="font-mono text-[#F7FAFC] font-medium">
                        {reg.transaction_id || 'Not provided'}
                      </span>
                    </div>

                    {reg.admin_note && (
                      <div className="p-2.5 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#FCD34D] mt-2 text-[11px]">
                        <strong>Note:</strong> {reg.admin_note}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-3 border-t border-[#2B2E32] bg-[#151618] grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setActiveReg(reg);
                    setVerifiedTxnId(reg.transaction_id || `UPI_VERIFIED_${Date.now()}`);
                    setShowApproveModal(true);
                  }}
                  className="py-2 px-3 rounded-md bg-[#5EE5BC] hover:bg-[#48D9AD] text-[#0C1D18] font-bold text-xs shadow-soft flex items-center justify-center gap-1.5 transition-all"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>

                <button
                  onClick={() => {
                    setActiveReg(reg);
                    setShowRejectModal(true);
                  }}
                  className="py-2 px-3 rounded-md bg-[#AB252C]/15 hover:bg-[#AB252C]/25 text-[#F87171] border border-[#AB252C]/30 font-medium text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* APPROVE MODAL */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve payment screenshot"
        description="This will mark the registration as PAID, generate their verified check-in QR pass, and queue their confirmation email."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Confirmed bank UTR / transaction ID
            </label>
            <input
              type="text"
              value={verifiedTxnId}
              onChange={(e) => setVerifiedTxnId(e.target.value)}
              placeholder="e.g. 984019283120"
              className="w-full text-xs font-mono p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
            />
          </div>

          <div className="pt-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowApproveModal(false)}
              className="btn-secondary py-2 px-4 text-xs font-medium rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isSubmitting}
              className="py-2 px-4 rounded-md text-xs font-bold bg-[#5EE5BC] hover:bg-[#48D9AD] text-[#0C1D18] shadow-soft disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Approving...' : 'Confirm approval & mark paid'}
            </button>
          </div>
        </div>
      </Modal>

      {/* REJECT MODAL */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject payment screenshot"
        description="The registration will remain UNCOUNTED and the reason will be displayed to the user."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Rejection reason (visible to participant) *
            </label>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Screenshot UTR could not be verified in the bank statement. Amount did not credit."
              className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#AB252C]"
            />
          </div>

          <div className="pt-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="btn-secondary py-2 px-4 text-xs font-medium rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isSubmitting || !rejectReason.trim()}
              className="py-2 px-4 rounded-md text-xs font-semibold bg-[#AB252C] hover:bg-[#C9323A] text-white shadow-soft disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Rejecting...' : 'Reject screenshot'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
