import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LogoPlaceholder } from '../../components/LogoPlaceholder';
import { Lock, Mail, Key } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await signIn(email, password);
      if (res.error) {
        toastError(res.error);
      } else {
        toastSuccess('Signed in successfully.');
        navigate('/admin');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-ambient-bg min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-[#151618] text-[#F7FAFC]">
      <div className="w-full max-w-md rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <LogoPlaceholder size="md" className="mx-auto" />
          <h2 className="text-2xl font-bold text-[#F7FAFC] font-heading tracking-tight pt-2">
            Staff &amp; desk login
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Sign in with your authorized hostel staff or volunteer credentials.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#F7FAFC] mb-1">
              Staff email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="warden@hostel.in"
                className="w-full pl-10 pr-4 py-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#F7FAFC] mb-1">
              Password
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC] text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 rounded-md"
          >
            <Lock className="w-4 h-4" />
            <span>{isSubmitting ? 'Signing in...' : 'Sign in'}</span>
          </button>
        </form>

        <div className="text-center text-xs text-[#94A3B8]">
          Accounts are managed in Supabase Auth by the hostel administration.
        </div>
      </div>
    </div>
  );
};
