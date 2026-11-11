import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';

// Lazy-loaded route components for optimal bundle splitting
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const ConfirmationPage = lazy(() => import('./pages/ConfirmationPage').then(m => ({ default: m.ConfirmationPage })));
const QrScanPage = lazy(() => import('./pages/QrScanPage').then(m => ({ default: m.QrScanPage })));

// Admin Pages (Loaded strictly on admin navigation)
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminRegistrationsPage = lazy(() => import('./pages/admin/AdminRegistrationsPage').then(m => ({ default: m.AdminRegistrationsPage })));
const AdminScreenshotReviewPage = lazy(() => import('./pages/admin/AdminScreenshotReviewPage').then(m => ({ default: m.AdminScreenshotReviewPage })));
const AdminAnnouncementsPage = lazy(() => import('./pages/admin/AdminAnnouncementsPage').then(m => ({ default: m.AdminAnnouncementsPage })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const AdminEmailPreviewPage = lazy(() => import('./pages/admin/AdminEmailPreviewPage').then(m => ({ default: m.AdminEmailPreviewPage })));

const RouteLoadingFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center p-4">
    <div className="flex flex-col items-center gap-3 text-sm text-[#94A3B8]">
      <div className="w-8 h-8 rounded-full border-2 border-[#5EE5BC] border-t-transparent animate-spin" />
      <span>Loading...</span>
    </div>
  </div>
);

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            {/* Fixed Cosmic Space Horizon & Nebula Background Layer */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
              <div 
                className="w-full h-full bg-cover bg-center bg-no-repeat scale-100 transform-gpu"
                style={{ 
                  backgroundImage: "url('/cosmic-bg.jpg')", 
                  backgroundPosition: "center 25%",
                  backgroundAttachment: "fixed" 
                }}
              />
              {/* Deep Obsidian & Cosmic Aurora Vignette to guarantee pristine WCAG AAA contrast */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#020608]/75 via-[#03090C]/55 to-[#020608]/90" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,245,184,0.08),transparent_70%)]" />
            </div>

            <div className="relative z-10 min-h-screen flex flex-col text-[#F0FDF9] font-sans antialiased selection:bg-[#00F5B8]/25 selection:text-[#00F5B8]">
              <Navbar />
              <div className="flex-1">
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                    {/* Public Guest Registration Flow */}
                    <Route path="/" element={<RegisterPage />} />
                    <Route path="/checkout/:scanToken" element={<CheckoutPage />} />
                    <Route path="/confirmation/:scanToken" element={<ConfirmationPage />} />

                    {/* Staff QR Scanner Route */}
                    <Route path="/scan" element={<QrScanPage />} />
                    <Route path="/scan/:scanToken" element={<QrScanPage />} />

                    {/* Staff Authentication */}
                    <Route path="/admin/login" element={<AdminLoginPage />} />

                    {/* Admin Protected Portal */}
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminDashboardPage />} />
                      <Route path="registrations" element={<AdminRegistrationsPage />} />
                      <Route path="screenshots" element={<AdminScreenshotReviewPage />} />
                      <Route path="announcements" element={<AdminAnnouncementsPage />} />
                      <Route path="users" element={<AdminUsersPage />} />
                      <Route path="settings" element={<AdminSettingsPage />} />
                      <Route path="emails" element={<AdminEmailPreviewPage />} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </div>
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
