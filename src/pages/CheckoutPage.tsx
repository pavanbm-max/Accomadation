import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckoutCard } from '../components/CheckoutCard';
import { ScreenshotUpload } from '../components/ScreenshotUpload';
import { 
  getRegistrationPublic, 
  devSimulatePayment, 
  uploadScreenshot 
} from '../lib/api';
import { useToast } from '../context/ToastContext';
import type { PublicRegistration } from '../types';
import { Skeleton } from '../components/Skeleton';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const { scanToken } = useParams<{ scanToken: string }>();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const [registration, setRegistration] = useState<PublicRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDetails = useCallback(async (silent = false) => {
    if (!scanToken) return;
    if (!silent) setLoading(true);

    try {
      const data = await getRegistrationPublic(scanToken);
      setRegistration(data);

      // If already paid, automatically route to confirmation page!
      if (data.isPaid || data.paymentStatus === 'paid' || data.paymentStatus === 'paid_at_desk') {
        navigate(`/confirmation/${scanToken}`, { replace: true });
      }
    } catch (err: any) {
      console.error('Failed to load registration:', err);
      setErrorMsg(err.message || 'Unable to retrieve registration details.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [scanToken, navigate]);

  useEffect(() => {
    fetchDetails();

    // Short polling every 4 seconds so status updates the moment webhook marks it paid
    const pollInterval = setInterval(() => {
      fetchDetails(true);
    }, 4000);

    // Re-check when the tab regains focus (crucial for users returning from UPI app!)
    const handleFocus = () => {
      console.log('Window regained focus: Checking payment status for UPI return...');
      fetchDetails(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchDetails]);

  // Payment trigger (Calls mock gateway / razorpay placeholder)
  const handlePay = async () => {
    if (!registration) return;
    setIsProcessing(true);

    try {
      // In production: opens Razorpay checkout modal with order ID from create-payment-order.
      // In development/placeholder: simulate gateway call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const res = await devSimulatePayment(registration.scanToken, 'success');

      if (res.status === 'paid') {
        toastSuccess('Payment successful! Confirmation pass generated.');
        navigate(`/confirmation/${registration.scanToken}`);
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      toastError(err.message || 'Payment initiation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulate = async (outcome: 'success' | 'failure' | 'timeout') => {
    if (!registration) return;
    setIsProcessing(true);

    try {
      const res = await devSimulatePayment(registration.scanToken, outcome);
      toastInfo(`Simulated gateway outcome: ${outcome.toUpperCase()}`);

      if (res.status === 'paid') {
        navigate(`/confirmation/${registration.scanToken}`);
      } else {
        await fetchDetails(true);
      }
    } catch (err: any) {
      toastError(err.message || 'Simulation error.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScreenshotSubmit = async (base64Image: string, note: string) => {
    if (!registration) return;
    const res = await uploadScreenshot(registration.scanToken, base64Image, note);
    toastSuccess(res.message);
    setShowScreenshotModal(false);
    await fetchDetails(true);
  };

  if (loading) {
    return (
      <div className="page-ambient-bg min-h-[calc(100vh-4rem)] bg-[#151618] py-16 px-4">
        <div className="max-w-xl mx-auto space-y-6">
          <Skeleton className="h-8 w-44 mx-auto rounded-md bg-[#24262A]" />
          <Skeleton className="h-96 rounded-lg bg-[#1B1D20]" />
        </div>
      </div>
    );
  }

  if (errorMsg || !registration) {
    return (
      <div className="page-ambient-bg min-h-[calc(100vh-4rem)] bg-[#151618] py-20 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="p-8 rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] space-y-4">
            <h3 className="text-xl font-heading font-semibold text-[#F7FAFC] tracking-tight">
              Registration not found
            </h3>
            <p className="text-xs font-sans text-[#94A3B8]">
              {errorMsg || 'The checkout link is invalid or may have expired.'}
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#5EE5BC] hover:bg-[#48D9AD] text-[#0C1D18] font-semibold text-xs shadow-soft transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Start fresh registration</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-ambient-bg relative min-h-[calc(100vh-4rem)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-[#151618] font-sans text-[#F7FAFC]">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#5EE5BC] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to registration</span>
          </a>

          <button
            onClick={() => fetchDetails(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#5EE5BC] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Stepper (Step 2 active) */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs font-medium pb-2">
          <div className="flex items-center gap-2 text-[#5EE5BC]">
            <span className="w-6 h-6 rounded-md bg-[#5EE5BC]/15 text-[#5EE5BC] flex items-center justify-center text-xs font-bold border border-[#5EE5BC]/30">
              ✓
            </span>
            <span>Details</span>
          </div>
          <div className="w-8 h-px bg-[#2B2E32]" />
          <div className="flex items-center gap-2 text-[#F7FAFC] font-semibold">
            <span className="w-6 h-6 rounded-md bg-[#5EE5BC] text-[#0C1D18] flex items-center justify-center text-xs font-bold shadow-[0_0_12px_rgba(94,229,188,0.35)]">
              2
            </span>
            <span>Payment</span>
          </div>
          <div className="w-8 h-px bg-[#2B2E32]" />
          <div className="flex items-center gap-2 text-[#94A3B8]">
            <span className="w-6 h-6 rounded-md bg-[#24262A] text-[#94A3B8] border border-[#2B2E32] flex items-center justify-center text-xs font-medium">
              3
            </span>
            <span>Confirmed</span>
          </div>
        </div>

        <CheckoutCard
          registration={registration}
          onPay={handlePay}
          onSimulate={handleSimulate}
          onOpenScreenshotUpload={() => setShowScreenshotModal(true)}
          onRefresh={() => fetchDetails(true)}
          isProcessing={isProcessing}
          simulationEnabled={true}
        />

        {showScreenshotModal && (
          <ScreenshotUpload
            scanToken={registration.scanToken}
            referenceId={registration.referenceId}
            onClose={() => setShowScreenshotModal(false)}
            onUploadSuccess={() => fetchDetails(true)}
            onSubmit={handleScreenshotSubmit}
          />
        )}
      </div>
    </div>
  );
};
