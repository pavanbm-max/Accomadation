import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { profile, isAdmin, isStaff, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!isStaff) {
    navigate('/admin/login');
    return null;
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
    <div className="min-h-screen bg-[#151618] flex flex-col md:flex-row transition-colors text-[#F7FAFC]">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#1B1D20] border-b border-[#2B2E32]">
        <LogoPlaceholder size="sm" showBadge={true} />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md text-[#94A3B8] hover:bg-[#24262A] hover:text-[#F7FAFC]"
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
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#1B1D20] border-r border-[#2B2E32] flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6">
          <div className="pb-6 border-b border-[#2B2E32]">
            <LogoPlaceholder size="md" showBadge={true} />
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#5EE5BC]/10 text-[#5EE5BC] border border-[#5EE5BC]/25">
                {profile?.role === 'admin' ? 'Hostel admin' : 'Desk volunteer'}
              </span>
              <span className="text-xs text-[#94A3B8] truncate">{profile?.full_name}</span>
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
                      ? 'bg-[#5EE5BC]/10 text-[#5EE5BC] font-semibold border border-[#5EE5BC]/25 shadow-soft'
                      : 'text-[#94A3B8] hover:bg-[#24262A] hover:text-[#F7FAFC]'
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
        <div className="p-4 border-t border-[#2B2E32] space-y-2">
          <div className="flex items-center justify-between">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#94A3B8] hover:text-[#5EE5BC] font-medium"
            >
              Guest portal ↗
            </a>

            <button
              onClick={signOut}
              title="Sign out"
              className="p-1.5 text-[#94A3B8] hover:text-[#AB252C] rounded-md hover:bg-[#24262A] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[10px] text-[#64748B] pt-1.5 border-t border-[#2B2E32]/50 flex items-center justify-between">
            <span>Help Desk:</span>
            <a href="tel:+919980745913" className="text-[#94A3B8] hover:text-[#5EE5BC] font-mono">+91 99807 45913</a>
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
