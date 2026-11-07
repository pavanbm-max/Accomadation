import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { getRegistrationPublic, staffCheckIn } from '../lib/api';
import { formatINR, formatDate, formatDateTime } from '../lib/formatters';
import type { PublicRegistration } from '../types';
import { 
  QrCode, 
  Search, 
  Camera, 
  CameraOff, 
  UserCheck, 
  XCircle, 
  Lock, 
  Shield, 
  Building, 
  RefreshCw 
} from 'lucide-react';

export const QrScanPage: React.FC = () => {
  const { scanToken: routeToken } = useParams<{ scanToken?: string }>();
  const navigate = useNavigate();
  const { isStaff, profile } = useAuth();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const [inputToken, setInputToken] = useState(routeToken || '');
  const [activeToken, setActiveToken] = useState(routeToken || '');
  const [registration, setRegistration] = useState<PublicRegistration | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  // Live Camera Scanner State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // If a token is provided in route or searched
  useEffect(() => {
    if (!activeToken) return;

    async function lookupToken() {
      setLoading(true);
      try {
        const data = await getRegistrationPublic(activeToken);
        setRegistration(data);
      } catch (err: any) {
        setRegistration(null);
        toastError(err.message || 'Booking not found for the entered reference or token.');
      } finally {
        setLoading(false);
      }
    }

    lookupToken();
  }, [activeToken, toastError]);

  // Handle Camera scanning
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      toastInfo('Camera active. Point at guest QR code.');

      // Check for BarcodeDetector support
      if ('BarcodeDetector' in window) {
        // @ts-ignore
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = window.setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawVal = barcodes[0].rawValue;
                handleScannedValue(rawVal);
              }
            } catch {
              // frame detection pass
            }
          }
        }, 300);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Unable to access camera. Please allow camera permissions or enter Reference ID.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleScannedValue = (val: string) => {
    // If it's a URL, extract scan token or ref
    const parts = val.split('/scan/');
    const token = parts.length > 1 ? parts[1].replace(/[^a-zA-Z0-9_-]/g, '') : val.trim();
    if (token) {
      setInputToken(token);
      setActiveToken(token);
      stopCamera();
      toastSuccess('QR Code detected!');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    setActiveToken(inputToken.trim());
  };

  // Perform Staff Check-In
  const handleCheckIn = async () => {
    if (!registration) return;

    if (!isStaff) {
      navigate('/admin/login');
      return;
    }

    setCheckingIn(true);
    try {
      const res = await staffCheckIn(registration.scanToken);
      toastSuccess(res.message || 'Participant verified and checked in!');
      // Refresh details
      const updated = await getRegistrationPublic(registration.scanToken);
      setRegistration(updated);
    } catch (err: any) {
      toastError(err.message || 'Check-in failed. Please verify staff permissions.');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="page-ambient-bg relative min-h-[calc(100vh-4rem)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-[#151618] text-[#F7FAFC]">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Desk Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2B2E32]">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-md bg-[#5EE5BC]/10 text-[#5EE5BC] border border-[#5EE5BC]/20">
                <QrCode className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold font-heading tracking-tight text-[#F7FAFC]">
                Staff desk QR scanner
              </h1>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              Verify participant QR pass or search by booking reference ID
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cameraActive ? stopCamera : startCamera}
              className={`inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2.5 rounded-md transition-colors shadow-soft ${
                cameraActive
                  ? 'bg-[#AB252C] hover:bg-[#C9323A] text-white'
                  : 'btn-primary'
              }`}
            >
              {cameraActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
              <span>{cameraActive ? 'Stop camera' : 'Live camera scanner'}</span>
            </button>

            <button
              onClick={() => {
                setInputToken('');
                setActiveToken('');
                setRegistration(null);
              }}
              className="text-xs text-[#94A3B8] hover:text-[#5EE5BC] p-2 transition-colors rounded-md hover:bg-[#24262A]"
              title="Clear scanner"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* LIVE CAMERA VIEWFINDER */}
        {cameraActive && (
          <div className="rounded-lg bg-[#1B1D20] border border-[#2B2E32] p-4 overflow-hidden relative shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <div className="relative aspect-video max-h-72 w-full mx-auto rounded-md overflow-hidden bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border border-white/10 m-8 rounded-lg pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-[#5EE5BC] rounded-md relative animate-pulse shadow-[0_0_16px_rgba(94,229,188,0.3)]">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white -mt-0.5 -ml-0.5" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white -mt-0.5 -mr-0.5" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white -mb-0.5 -ml-0.5" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white -mb-0.5 -mr-0.5" />
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-[#94A3B8] mt-2 font-medium">
              Point camera at participant QR code or phone screen
            </p>
          </div>
        )}

        {cameraError && (
          <div className="p-3.5 bg-[#AB252C]/15 text-[#F87171] text-xs rounded-md border border-[#AB252C]/30">
            {cameraError}
          </div>
        )}

        {/* Token or Reference Search Form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <QrCode className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="Scan QR token or type Ref ID (e.g. HST-2026-000101)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC] text-sm font-mono shadow-soft"
            />
          </div>
          <button
            type="submit"
            className="btn-primary py-2.5 px-5 text-xs font-semibold flex items-center gap-1.5 rounded-md"
          >
            <Search className="w-4 h-4" />
            <span>Lookup</span>
          </button>
        </form>

        {/* REGISTRATION VERIFICATION RESULT CARD */}
        {loading ? (
          <div className="p-12 text-center text-[#94A3B8] font-medium">Loading booking from database...</div>
        ) : registration ? (
          <div className="rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between pb-4 border-b border-[#2B2E32]">
              <div>
                <span className="text-xs uppercase font-mono font-bold text-[#5EE5BC] tracking-wider">
                  {registration.referenceId}
                </span>
                <h2 className="text-xl font-bold text-[#F7FAFC] font-heading mt-0.5">
                  {registration.fullName}
                </h2>
                <div className="text-xs text-[#94A3B8] flex items-center gap-1.5 mt-0.5">
                  <Building className="w-3.5 h-3.5" />
                  <span>{registration.collegeOrOrganisation}</span>
                  {registration.gender && (
                    <span className="font-semibold text-[#F7FAFC]">
                      • {registration.gender} Block
                    </span>
                  )}
                </div>
              </div>
              <PaymentStatusBadge status={registration.paymentStatus} size="lg" />
            </div>

            {/* Stay & Payment details summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-[#24262A] p-4 rounded-md border border-[#2B2E32]">
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
              <div>
                <span className="text-[#94A3B8] block font-medium">Duration</span>
                <span className="font-semibold text-[#F7FAFC] font-mono">
                  {registration.nights} night(s)
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block font-medium">Amount</span>
                <span className="font-semibold text-[#5EE5BC] font-mono">
                  {formatINR(registration.amount)}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block font-medium">Payment mode</span>
                <span className="font-semibold text-[#F7FAFC] capitalize">
                  {registration.paymentMethod || 'Online'}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block font-medium">Transaction ID</span>
                <span className="font-mono text-[#F7FAFC] truncate block" title={registration.transactionId || 'None'}>
                  {registration.transactionId || '—'}
                </span>
              </div>
            </div>

            {/* Check-In Status Action Box */}
            <div className="pt-2">
              {registration.checkedInAt ? (
                <div className="p-4 rounded-md bg-[#5EE5BC]/15 border border-[#5EE5BC]/30 text-[#5EE5BC] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-[#5EE5BC]" />
                    <div>
                      <div className="font-bold text-sm font-heading text-[#F7FAFC]">Participant already checked in</div>
                      <div className="text-xs text-[#94A3B8] mt-0.5">
                        Verified on {formatDateTime(registration.checkedInAt)}
                        {registration.checkedInByName && ` by ${registration.checkedInByName}`}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#5EE5BC] text-[#0C1D18]">
                    Completed
                  </span>
                </div>
              ) : registration.isPaid || registration.paymentStatus === 'paid' || registration.paymentStatus === 'paid_at_desk' ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-md bg-[#5EE5BC]/10 border border-[#5EE5BC]/25 text-[#5EE5BC] text-xs flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#5EE5BC] flex-shrink-0" />
                    <span>
                      Payment verified. Participant is eligible for room key allotment.
                    </span>
                  </div>

                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="w-full py-3.5 px-6 rounded-md bg-[#5EE5BC] hover:bg-[#48D9AD] active:bg-[#36C79A] text-[#0C1D18] font-bold text-sm shadow-[0_0_20px_rgba(94,229,188,0.25)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{checkingIn ? 'Recording check-in...' : 'Confirm arrival & check-in participant'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-md bg-[#AB252C]/15 border border-[#AB252C]/30 text-[#F87171] space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm font-heading">
                    <Lock className="w-4 h-4 text-[#F87171]" />
                    <span>Check-in blocked: payment incomplete</span>
                  </div>
                  <p className="text-xs">
                    This registration has status <strong className="uppercase">{registration.paymentStatus}</strong>.
                    Per Golden Rule, check-in can only be granted to paid stays.
                  </p>
                  {isStaff && (
                    <div className="pt-2">
                      <a
                        href="/admin/registrations"
                        className="btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-md"
                      >
                        <span>Resolve in admin portal →</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
