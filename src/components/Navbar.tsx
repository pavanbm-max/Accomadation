import React from 'react';
import { Link } from 'react-router-dom';
import { LogoPlaceholder } from './LogoPlaceholder';
import { useAuth } from '../context/AuthContext';
import { QrCode, Shield, LogOut, LayoutDashboard } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { profile, isStaff, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#151618]/90 border-b border-[#2B2E32] backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <LogoPlaceholder size="md" />
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Desk Scanner Link */}
          <Link
            to="/scan"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-md bg-[#1B1D20] border border-[#2B2E32] hover:border-[#5EE5BC]/40 hover:text-[#5EE5BC] text-[#F7FAFC] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
          >
            <QrCode className="w-3.5 h-3.5 text-[#5EE5BC]" />
            <span>Desk check-in</span>
          </Link>

          {isStaff ? (
            <div className="flex items-center gap-2">
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-md bg-[#5EE5BC]/10 text-[#5EE5BC] border border-[#5EE5BC]/30 hover:bg-[#5EE5BC]/20 transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin portal</span>
                <span className="text-[10px] bg-[#5EE5BC] text-[#0C1D18] px-1.5 py-0.5 rounded font-mono uppercase font-bold">
                  {profile?.role}
                </span>
              </Link>
              <button
                onClick={signOut}
                title="Sign out"
                className="p-2 text-[#94A3B8] hover:text-[#AB252C] rounded-md hover:bg-[#24262A] transition-colors focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/admin/login"
              className="text-xs font-medium text-[#94A3B8] hover:text-[#5EE5BC] px-3 py-2 rounded-md hover:bg-[#1B1D20] border border-transparent hover:border-[#2B2E32] transition-colors flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-[#5EE5BC]" />
              <span>Staff login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
