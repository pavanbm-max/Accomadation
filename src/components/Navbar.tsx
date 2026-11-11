import React from 'react';
import { Link } from 'react-router-dom';
import { LogoPlaceholder } from './LogoPlaceholder';
import { useAuth } from '../context/AuthContext';
import { QrCode, Shield, LogOut, LayoutDashboard, Lock } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { profile, isStaff, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#03090C]/80 border-b border-[#00F5B8]/15 backdrop-blur-xl transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity group">
          <LogoPlaceholder size="md" showBadge={true} />
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          {isStaff ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Desk Scanner Link (Staff Only) */}
              <Link
                to="/scan"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-md bg-[#061419]/90 border border-[#00F5B8]/20 hover:border-[#00F5B8]/60 hover:text-[#00F5B8] text-[#F0FDF9] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#00F5B8]"
                title="Desk Check-In Scanner"
              >
                <QrCode className="w-3.5 h-3.5 text-[#00F5B8]" />
                <span className="hidden xs:inline">Desk scan</span>
              </Link>

              {/* Admin Portal Link */}
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-md bg-[#00F5B8]/10 text-[#00F5B8] border border-[#00F5B8]/30 hover:bg-[#00F5B8]/20 transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin portal</span>
                <span className="text-[10px] bg-[#00F5B8] text-[#021713] px-1.5 py-0.5 rounded font-mono uppercase font-bold">
                  {profile?.role}
                </span>
              </Link>

              {/* Sign out */}
              <button
                onClick={signOut}
                title="Sign out"
                className="p-1.5 text-[#9FB9C1] hover:text-[#F87171] rounded-md hover:bg-[#0B1E26] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00F5B8]"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/admin/login"
              className="text-xs font-medium text-[#9FB9C1] hover:text-[#00F5B8] px-2.5 sm:px-3 py-2 rounded-md hover:bg-[#061419]/80 border border-transparent hover:border-[#00F5B8]/20 transition-colors flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-[#00F5B8]" />
              <span className="hidden xs:inline">Staff login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
