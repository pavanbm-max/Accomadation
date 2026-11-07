import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';

// Pages
import { RegisterPage } from './pages/RegisterPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { QrScanPage } from './pages/QrScanPage';

// Admin Pages
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminRegistrationsPage } from './pages/admin/AdminRegistrationsPage';
import { AdminScreenshotReviewPage } from './pages/admin/AdminScreenshotReviewPage';
import { AdminAnnouncementsPage } from './pages/admin/AdminAnnouncementsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminEmailPreviewPage } from './pages/admin/AdminEmailPreviewPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-[#151618] text-[#F7FAFC] font-sans antialiased selection:bg-[#5EE5BC]/25 selection:text-[#5EE5BC]">
              <Navbar />
              <div className="flex-1">
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
              </div>
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
