import React, { useState } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogoPlaceholder } from '../../components/LogoPlaceholder';
import { 
  LayoutDashboard, 
  Users, 
  FileCheck, 
  Megaphone, 
  UserCog, 
  Settings as SettingsIcon, 
  Mail, 
  QrCode, 
  LogOut, 
  Menu, 
  X
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const { profile, isAdmin, isStaff, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-sm text-[#9FB9C1]">
          <div className="w-8 h-8 rounded-full border-2 border-[#00F5B8] border-t-transparent animate-spin" />
          <span>Restoring staff session...</span>
        </div>
      </div>
    );
  }

  if (!isStaff) {
    return <Navigate to="/admin/login" replace />;
  }

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, adminOnly: false },
    { label: 'Registrations', path: '/admin/registrations', icon: Users, adminOnly: false },
    { label: 'QR desk scanner', path: '/scan', icon: QrCode, adminOnly: false },
    { label: 'Screenshot review', path: '/admin/screenshots', icon: FileCheck, adminOnly: true },
    { label: 'Announcements', path: '/admin/announcements', icon: Megaphone, adminOnly: false },
    { label: 'Staff users', path: '/admin/users', icon: UserCog, adminOnly: true },
    { label: 'Settings', path: '/admin/settings', icon: SettingsIcon, adminOnly: true },
    { label: 'Email outbox', path: '/admin/emails', icon: Mail, adminOnly: false },
  ];

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-transparent flex flex-col md:flex-row transition-colors text-[#F0FDF9]">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#03090C]/85 backdrop-blur-xl border-b border-[#00F5B8]/15">
        <LogoPlaceholder size="sm" showBadge={true} />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md text-[#9FB9C1] hover:bg-[#061419] hover:text-[#F0FDF9]"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#040E12]/85 backdrop-blur-xl border-r border-[#00F5B8]/15 flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6">
          <div className="pb-6 border-b border-[#00F5B8]/15">
            <LogoPlaceholder size="md" showBadge={true} />
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#00F5B8]/10 text-[#00F5B8] border border-[#00F5B8]/25">
                {profile?.role === 'admin' ? 'Hostel admin' : 'Desk volunteer'}
              </span>
              <span className="text-xs text-[#9FB9C1] truncate">{profile?.full_name}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#00F5B8]/10 text-[#00F5B8] font-semibold border border-[#00F5B8]/25 shadow-[0_0_12px_rgba(0,245,184,0.15)]'
                      : 'text-[#9FB9C1] hover:bg-[#061419]/70 hover:text-[#F0FDF9]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Sign Out Footer */}
        <div className="p-4 border-t border-[#00F5B8]/15 space-y-2">
          <div className="flex items-center justify-between">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#9FB9C1] hover:text-[#00F5B8] font-medium"
            >
              Guest portal ↗
            </a>

            <button
              onClick={signOut}
              title="Sign out"
              className="p-1.5 text-[#9FB9C1] hover:text-[#F87171] rounded-md hover:bg-[#0B1E26] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[10px] text-[#5A7E88] pt-1.5 border-t border-[#00F5B8]/10 flex items-center justify-between">
            <span>Help Desk:</span>
            <a href="tel:+919980745913" className="text-[#9FB9C1] hover:text-[#00F5B8] font-mono">+91 99807 45913</a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};
