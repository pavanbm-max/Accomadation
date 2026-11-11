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
        <div className="text-center space-y-3">
          <LogoPlaceholder size="md" variant="stacked" showBadge={true} className="mx-auto" />
          <h2 className="text-xl font-bold text-[#F7FAFC] font-heading tracking-tight pt-1">
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

        <div className="pt-3 border-t border-[#2B2E32] text-center space-y-1.5 text-xs text-[#94A3B8]">
          <div>Accounts are managed by the hostel administration.</div>
          <div className="text-[11px] text-[#64748B]">
            Need desk credentials? Contact: <a href="tel:+919980745913" className="text-[#5EE5BC] hover:underline">+91 99807 45913</a> · <a href="mailto:pavan.b.m1598@gmail.com" className="text-[#5EE5BC] hover:underline">pavan.b.m1598@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  );
};
