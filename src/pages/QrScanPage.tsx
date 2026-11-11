import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { LogoPlaceholder } from '../components/LogoPlaceholder';
import { getRegistrationPublic, staffCheckIn } from '../lib/api';
import { formatINR, formatDate, formatDateTime } from '../lib/formatters';
import type { PublicRegistration } from '../types';
import jsQR from 'jsqr';
import confetti from 'canvas-confetti';
import { 
  QrCode, 
  Search, 
  Camera, 
  CameraOff, 
  UserCheck, 
  Lock, 
  Shield, 
  Building, 
  RefreshCw,
  KeyRound,
  AlertTriangle,
  ArrowRight,
  LogOut,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Info
} from 'lucide-react';

export const QrScanPage: React.FC = () => {
  const { scanToken: routeToken } = useParams<{ scanToken?: string }>();
  const { isStaff, profile, signIn, signOut, loading: authLoading } = useAuth();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  // Authentication form state for unauthenticated desk visitors
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Scanner & Lookup State
  const [inputToken, setInputToken] = useState(routeToken || '');
  const [activeToken, setActiveToken] = useState(routeToken || '');
  const [registration, setRegistration] = useState<PublicRegistration | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  // Live Camera Scanner State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Audio confirmation chime
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext unavailable or blocked
    }
  };

  // Perform search / lookup when token changes
  useEffect(() => {
    if (!activeToken || !isStaff) return;

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
  }, [activeToken, isStaff, toastError]);

  // Ensure stream attachment whenever cameraActive becomes true
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(scanLoop);
      }
    }
  }, [cameraActive]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Handle staff login directly from the scanner terminal
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authEmail.trim() || !authPassword) {
      setAuthError('Please enter both your staff email and password.');
      return;
    }

    setAuthenticating(true);
    try {
      const res = await signIn(authEmail.trim(), authPassword);
      if (res.error) {
        setAuthError(res.error);
      } else {
        toastSuccess('Staff desk session authenticated.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setAuthenticating(false);
    }
  };

  // Extract clean token or reference ID from any scanned format
  const handleScannedValue = (raw: string) => {
    const val = raw.trim();
    let detectedToken = '';

    if (val.includes('/scan/')) {
      const parts = val.split('/scan/');
      detectedToken = parts[1].split(/[?#&]/)[0];
    } else if (val.includes('/confirmation/')) {
      const parts = val.split('/confirmation/');
      detectedToken = parts[1].split(/[?#&]/)[0];
    } else {
      detectedToken = val;
    }

    detectedToken = detectedToken.replace(/[^a-zA-Z0-9_-]/g, '').trim();

    if (detectedToken) {
      playBeep();
      stopCamera();
      setInputToken(detectedToken);
      setActiveToken(detectedToken);
      toastSuccess('QR Code detected and verified.');
    }
  };

  // Universal Video Frame Processing Loop (jsQR)
  const scanLoop = () => {
    if (!videoRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState >= 2 && video.videoWidth > 20 && video.videoHeight > 20) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          handleScannedValue(code.data);
          return; // Pause scanning loop upon successful match
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  };

  // Start Live Camera with Multi-Tiered Fallback
  const startCamera = async () => {
    setCameraError(null);
    setIsInitializingCamera(true);

    // 1. Check if browser supports mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isHttp = window.location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (isHttp) {
        setCameraError(
          'Live camera stream is blocked by mobile browsers over plain HTTP network addresses. Please use http://localhost:5173, enable HTTPS, or tap "Snap Photo / Upload QR" below.'
        );
      } else {
        setCameraError('Camera API is not supported on this browser or context.');
      }
      setIsInitializingCamera(false);
      return;
    }

    try {
      let stream: MediaStream | null = null;

      // Attempt 1: Back/Environment camera with preferred resolution
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        // Attempt 2: Relaxed environment camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
        } catch {
          // Attempt 3: Any available video device (laptop webcam, front cam)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
        }
      }

      if (!stream) {
        throw new Error('Failed to obtain video stream.');
      }

      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.muted = true;
        try {
          await video.play();
        } catch {
          // Play will trigger in onLoadedMetadata or ref callback
        }
      }

      toastInfo('Camera viewfinder active. Align guest QR code in frame.');
    } catch (err: any) {
      console.error('Camera initialization error:', err);
      let message = 'Unable to access camera feed.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission denied. Please allow camera access in browser site settings, or use "Snap photo / Upload QR".';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera found on this device. Please type the Reference ID manually.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera is already in use by another application. Please close other camera apps and retry.';
      }
      setCameraError(message);
      setCameraActive(false);
    } finally {
      setIsInitializingCamera(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
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

  // Handle Photo Snapshot / Image File Upload (Bulletproof QR fallback)
  const handleFileScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          toastError('Failed to process image canvas.');
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          handleScannedValue(code.data);
        } else {
          toastError('No valid QR code detected in this photo. Please retake closer with clear focus.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected if needed
    e.target.value = '';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputToken.trim();
    if (!clean) return;
    setActiveToken(clean);
  };

  // Perform Staff Check-In
  const handleCheckIn = async () => {
    if (!registration) return;

    setCheckingIn(true);
    try {
      const res = await staffCheckIn(registration.scanToken);
      toastSuccess(res.message || 'Participant verified and checked in!');

      // Celebration effect on check-in
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#5EE5BC', '#00B8FF', '#FFFFFF'],
        });
      } catch {}

      // Refresh guest details
      const updated = await getRegistrationPublic(registration.scanToken);
      setRegistration(updated);
    } catch (err: any) {
      toastError(err.message || 'Check-in failed. Please verify staff permissions.');
    } finally {
      setCheckingIn(false);
    }
  };

  // 1. Loading Authentication State
  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-transparent">
        <div className="flex flex-col items-center gap-3 text-sm text-[#9FB9C1]">
          <div className="w-8 h-8 rounded-full border-2 border-[#00F5B8] border-t-transparent animate-spin" />
          <span>Verifying desk authorization...</span>
        </div>
      </div>
    );
  }

  // 2. Staff Authentication Gate: Show when user is NOT logged in as staff
  if (!isStaff) {
    return (
      <div className="page-ambient-bg min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-transparent text-[#F0FDF9]">
        <div className="w-full max-w-md rounded-xl bg-[#061419]/85 backdrop-blur-xl border border-[#00F5B8]/20 shadow-[0_8px_32px_rgba(0,0,0,0.65)] p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-3">
            <LogoPlaceholder size="md" variant="stacked" showBadge={true} className="mx-auto" />
            <div className="pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#AB252C]/15 border border-[#AB252C]/30 text-xs font-semibold text-[#F87171]">
                <Lock className="w-3.5 h-3.5" />
                <span>Restricted Staff Terminal</span>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#F7FAFC] tracking-tight">
              Hostel Desk Verification
            </h1>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Desk check-in, QR scanning, and room key allotments are strictly restricted. Please sign in with your staff or volunteer credentials.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-md bg-[#AB252C]/15 border border-[#AB252C]/30 text-xs text-[#F87171] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1.5">
                Staff email address *
              </label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="volunteer@ignitron.app"
                className="w-full px-3.5 py-2.5 rounded-md bg-[#151618] border border-[#2B2E32] text-sm text-[#F7FAFC] focus:outline-none focus:border-[#5EE5BC] focus:ring-1 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1.5">
                Password *
              </label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-md bg-[#151618] border border-[#2B2E32] text-sm text-[#F7FAFC] focus:outline-none focus:border-[#5EE5BC] focus:ring-1 focus:ring-[#5EE5BC]"
              />
            </div>

            <button
              type="submit"
              disabled={authenticating}
              className="w-full btn-primary py-3 px-4 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{authenticating ? 'Authenticating terminal...' : 'Sign in to Desk Terminal'}</span>
            </button>
          </form>

          <div className="pt-3 border-t border-[#2B2E32] text-center space-y-2">
            <Link
              to="/"
              className="text-xs text-[#94A3B8] hover:text-[#5EE5BC] transition-colors inline-flex items-center gap-1.5"
            >
              <span>← Return to public registration</span>
            </Link>
            <div className="text-[11px] text-[#64748B]">
              Need desk access? Coordinator: <a href="tel:+919980745913" className="text-[#5EE5BC] hover:underline font-mono">+91 99807 45913</a> · <a href="mailto:pavan.b.m1598@gmail.com" className="text-[#5EE5BC] hover:underline">pavan.b.m1598@gmail.com</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized Staff Desk Scanner Interface
  return (
    <div className="page-ambient-bg relative min-h-[calc(100vh-4rem)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-transparent text-[#F0FDF9]">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Hidden File Input for Native Camera Snapshot / Image Upload Fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileScan}
        />

        {/* Staff Authentication Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#061419]/85 backdrop-blur-xl border border-[#00F5B8]/20 shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
          <div className="flex items-center gap-3">
            <LogoPlaceholder size="xs" showBadge={false} />
            <div className="h-5 w-px bg-white/15 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F5B8] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00F5B8]" />
              </span>
              <div className="text-xs">
                <span className="text-[#9FB9C1]">Desk Staff: </span>
                <strong className="text-[#F0FDF9] font-semibold">{profile?.full_name || 'Staff Member'}</strong>
                <span className="ml-2 font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#00F5B8]/15 text-[#00F5B8] border border-[#00F5B8]/30">
                  {profile?.role}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="text-[11px] font-medium text-[#9FB9C1] hover:text-[#00F5B8] px-2.5 py-1 rounded hover:bg-[#0B1E26] transition-colors"
            >
              Admin portal →
            </Link>
            <button
              onClick={() => signOut()}
              className="text-[11px] font-medium text-[#9FB9C1] hover:text-[#F87171] px-2 py-1 rounded hover:bg-[#0B1E26] transition-colors flex items-center gap-1"
              title="End desk session"
            >
              <LogOut className="w-3 h-3" />
              <span>Exit session</span>
            </button>
          </div>
        </div>

        {/* Desk Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#00F5B8]/15">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-md bg-[#5EE5BC]/10 text-[#5EE5BC] border border-[#5EE5BC]/20 shadow-[0_0_12px_rgba(94,229,188,0.15)]">
                <QrCode className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold font-heading tracking-tight text-[#F7FAFC]">
                Check-in QR scanner
              </h1>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              Verify participant stay pass by live scanning, snapping a photo, or typing the reference ID.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Camera Button */}
            <button
              onClick={cameraActive ? stopCamera : startCamera}
              disabled={isInitializingCamera}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-md transition-all shadow-soft ${
                cameraActive
                  ? 'bg-[#AB252C] hover:bg-[#C9323A] text-white shadow-[0_0_12px_rgba(171,37,44,0.3)]'
                  : 'btn-primary shadow-[0_0_16px_rgba(94,229,188,0.25)]'
              }`}
            >
              {cameraActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
              <span>{isInitializingCamera ? 'Starting...' : cameraActive ? 'Stop live feed' : 'Live camera'}</span>
            </button>

            {/* Snap / Upload Image Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md"
              title="Take a photo or upload QR code image"
            >
              <Upload className="w-3.5 h-3.5 text-[#5EE5BC]" />
              <span>Snap / Upload QR</span>
            </button>

            {/* Reset */}
            <button
              onClick={() => {
                setInputToken('');
                setActiveToken('');
                setRegistration(null);
                setCameraError(null);
                stopCamera();
              }}
              className="text-xs text-[#94A3B8] hover:text-[#5EE5BC] p-2 transition-colors rounded-md hover:bg-[#24262A]"
              title="Reset terminal"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Error / Notice Message */}
        {cameraError && (
          <div className="p-4 rounded-md bg-[#AB252C]/15 border border-[#AB252C]/30 text-xs text-[#F87171] space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Camera access issue</span>
                <span className="leading-relaxed block mt-0.5">{cameraError}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-[#AB252C]/20 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary py-1.5 px-3 text-xs font-semibold rounded inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-[#5EE5BC]" />
                <span>Snap photo with camera instead</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Camera Viewfinder Overlay (Always mounted to guarantee immediate ref & hardware stream attachment) */}
        <div className={cameraActive ? "relative overflow-hidden rounded-lg bg-black border border-[#2B2E32] shadow-[0_8px_32px_rgba(0,0,0,0.6)]" : "hidden"}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.play().catch(() => {});
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = requestAnimationFrame(scanLoop);
              }
            }}
            onPlay={() => {
              if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = requestAnimationFrame(scanLoop);
            }}
            className="w-full h-72 sm:h-80 object-cover bg-black"
          />
          {/* Hidden canvas used for jsQR frame sampling */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Viewfinder Target Reticle with Aqua Accent Corners */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 border border-[#5EE5BC]/40 rounded-xl shadow-[0_0_30px_rgba(94,229,188,0.15)] flex items-center justify-center">
              {/* Viewfinder corners */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#5EE5BC] -mt-0.5 -ml-0.5 rounded-tl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#5EE5BC] -mt-0.5 -mr-0.5 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#5EE5BC] -mb-0.5 -ml-0.5 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#5EE5BC] -mb-0.5 -mr-0.5 rounded-br" />

              {/* Scanning laser line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#5EE5BC] to-transparent shadow-[0_0_12px_#5EE5BC] animate-pulse" />
            </div>
          </div>

          <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
            <span className="text-[11px] font-medium bg-[#151618]/90 text-[#5EE5BC] px-3.5 py-1 rounded-full border border-[#2B2E32] backdrop-blur-sm shadow-soft">
              Point at participant's stay pass QR
            </span>
          </div>
        </div>

        {/* Manual Reference Lookup Input Form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="Enter Reference ID (e.g. HST-2026-000001) or scan token..."
              className="w-full pl-10 pr-4 py-2.5 rounded-md bg-[#1B1D20] border border-[#2B2E32] text-sm text-[#F7FAFC] placeholder-[#94A3B8] font-mono focus:outline-none focus:border-[#5EE5BC] focus:ring-1 focus:ring-[#5EE5BC] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !inputToken.trim()}
            className="btn-primary px-5 py-2.5 rounded-md text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>Lookup</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-12 text-center space-y-3">
            <div className="w-7 h-7 rounded-full border-2 border-[#5EE5BC] border-t-transparent animate-spin mx-auto" />
            <span className="text-xs text-[#94A3B8]">Retrieving participant accommodation record...</span>
          </div>
        )}

        {/* Scanned Participant Registration Record Card */}
        {registration && !loading ? (
          <div className="rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-6 space-y-5">
            {/* Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2B2E32]">
              <div>
                <span className="text-xs text-[#94A3B8] block">Allotment Reference</span>
                <span className="font-mono text-xl font-bold text-[#F7FAFC] tracking-wider">
                  {registration.referenceId}
                </span>
                <div className="text-xs text-[#94A3B8] flex items-center gap-1.5 mt-1">
                  <Building className="w-3.5 h-3.5 text-[#5EE5BC]" />
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

            {/* Guest Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#24262A] p-4 rounded-md border border-[#2B2E32]">
              <div>
                <span className="text-[#94A3B8] block font-medium">Participant Name</span>
                <span className="text-sm font-bold text-[#F7FAFC] font-heading mt-0.5 block">
                  {registration.fullName}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block font-medium">Registered Phone</span>
                <span className="font-mono text-[#F7FAFC] mt-0.5 block">
                  {registration.phone || '—'}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block font-medium">Email</span>
                <span className="text-[#F7FAFC] mt-0.5 block truncate" title={registration.email}>
                  {registration.email || '—'}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block font-medium">Emergency Contact</span>
                <span className="font-mono text-[#F7FAFC] mt-0.5 block">
                  {registration.emergencyContact || '—'}
                </span>
              </div>
            </div>

            {/* Stay & Duration Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#24262A] p-4 rounded-md border border-[#2B2E32]">
              <div>
                <span className="text-[#94A3B8] block font-medium">Check-in Date</span>
                <span className="font-semibold text-[#F7FAFC] mt-0.5 block">
                  {formatDate(registration.checkInDate)}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block font-medium">Check-out Date</span>
                <span className="font-semibold text-[#F7FAFC] mt-0.5 block">
                  {formatDate(registration.checkOutDate)}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block font-medium">Stay Duration</span>
                <span className="font-semibold text-[#F7FAFC] font-mono mt-0.5 block">
                  {registration.nights} night(s)
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block font-medium">Amount</span>
                <span className="font-bold text-[#5EE5BC] font-mono text-sm mt-0.5 block drop-shadow-[0_0_8px_rgba(94,229,188,0.25)]">
                  {formatINR(registration.amount)}
                </span>
              </div>
            </div>

            {/* Check-In Action Section */}
            <div className="pt-2">
              {registration.checkedInAt ? (
                /* Already checked in state */
                <div className="p-4 rounded-md bg-[#5EE5BC]/15 border border-[#5EE5BC]/30 text-[#5EE5BC] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-[#5EE5BC]" />
                    <div>
                      <div className="font-bold text-sm font-heading text-[#F7FAFC]">
                        Participant already checked in
                      </div>
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
                /* Eligible for check-in */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-md bg-[#5EE5BC]/10 border border-[#5EE5BC]/25 text-[#5EE5BC] text-xs flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#5EE5BC] flex-shrink-0" />
                    <span>
                      Payment verified. Participant is eligible for hostel room key allotment.
                    </span>
                  </div>

                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="w-full py-3.5 px-6 rounded-md bg-[#5EE5BC] hover:bg-[#48D9AD] active:bg-[#36C79A] text-[#0C1D18] font-bold text-sm shadow-[0_0_24px_rgba(94,229,188,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>
                      {checkingIn ? 'Recording arrival...' : 'Confirm arrival & allot room key'}
                    </span>
                  </button>
                </div>
              ) : (
                /* Unpaid stay warning */
                <div className="p-4 rounded-md bg-[#AB252C]/15 border border-[#AB252C]/30 text-[#F87171] space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm font-heading">
                    <Lock className="w-4 h-4 text-[#F87171]" />
                    <span>Check-in blocked: Payment incomplete</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    This registration has status <strong className="uppercase">{registration.paymentStatus}</strong>.
                    Per Hostel Golden Rule, room check-in can only be granted to paid stays.
                  </p>
                  <div className="pt-2">
                    <Link
                      to="/admin/registrations"
                      className="btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-md"
                    >
                      <span>Collect fee / resolve in admin portal →</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Desk Terminal Support Bar */}
        <div className="pt-4 border-t border-[#2B2E32] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#5EE5BC]" />
            <span>Terminal Coordinator Hotline: <a href="tel:+919980745913" className="text-[#F7FAFC] font-mono hover:text-[#5EE5BC] font-semibold">+91 99807 45913</a></span>
          </div>
          <a href="mailto:pavan.b.m1598@gmail.com" className="text-[#94A3B8] hover:text-[#5EE5BC] text-[11px]">
            pavan.b.m1598@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
};
