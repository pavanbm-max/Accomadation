import React, { useState, useEffect } from 'react';
import { CountUp } from '../../components/CountUp';
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge';
import { formatINR, formatDate } from '../../lib/formatters';
import { getDashboardStats, getRegistrations } from '../../lib/api';
import type { DashboardStats, Registration } from '../../types';
import { Skeleton } from '../../components/Skeleton';
import { 
  IndianRupee, 
  CheckCircle, 
  Clock, 
  HelpCircle, 
  ArrowRight, 
  RefreshCw, 
  QrCode 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRegistrations, setRecentRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, regs] = await Promise.all([
        getDashboardStats(),
        getRegistrations({ status: 'all' }),
      ]);
      setStats(s);
      setRecentRegistrations(regs.slice(0, 6));
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-[#F7FAFC]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2B2E32]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F7FAFC] font-heading">
            Hostel operations dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Real-time accommodation allotments, spot collections, and check-in flow metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/scan"
            className="btn-primary inline-flex items-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-md"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Open desk scanner</span>
          </Link>
          <button
            onClick={loadData}
            title="Refresh metrics"
            className="p-2 text-[#94A3B8] hover:text-[#5EE5BC] rounded-md hover:bg-[#24262A] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 STATS CARDS WITH EMPHASIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected (Only paid & paid_at_desk) - Emphasized Aqua Pastel */}
        <div className="p-5 rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] relative overflow-hidden">
          <div className="flex items-center justify-between text-[#94A3B8] text-xs font-medium">
            <span>Total collected</span>
            <div className="w-8 h-8 rounded-md bg-[#5EE5BC]/15 text-[#5EE5BC] flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold text-[#5EE5BC] font-heading tracking-tight drop-shadow-[0_0_12px_rgba(94,229,188,0.25)]">
            {loading || !stats ? (
              <Skeleton className="h-8 w-28 bg-[#24262A]" />
            ) : (
              <CountUp value={stats.total_collected} isCurrency />
            )}
          </div>
          <div className="mt-2 text-[11px] text-[#5EE5BC] font-medium flex items-center gap-1">
            <span>Confirmed paid stays only</span>
          </div>
        </div>

        {/* Paid Allotments - Aqua Pastel */}
        <div className="p-5 rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between text-[#94A3B8] text-xs font-medium">
            <span>Confirmed allotments</span>
            <div className="w-8 h-8 rounded-md bg-[#5EE5BC]/10 text-[#5EE5BC] flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold text-[#5EE5BC] font-heading tracking-tight">
            {loading || !stats ? (
              <Skeleton className="h-8 w-16 bg-[#24262A]" />
            ) : (
              <CountUp value={stats.paid_count} />
            )}
          </div>
          <div className="mt-2 text-[11px] text-[#94A3B8]">
            Online paid &amp; spot desk receipts
          </div>
        </div>

        {/* Unpaid / Failed - Destructive Crimson Accent */}
        <div className="p-5 rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between text-[#94A3B8] text-xs font-medium">
            <span>Unpaid or expired</span>
            <div className="w-8 h-8 rounded-md bg-[#AB252C]/15 text-[#F87171] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold text-[#F87171] font-heading tracking-tight">
            {loading || !stats ? (
              <Skeleton className="h-8 w-16 bg-[#24262A]" />
            ) : (
              <CountUp value={stats.unpaid_count} />
            )}
          </div>
          <div className="mt-2 text-[11px] text-[#F87171] font-medium">
            Zero spots reserved
          </div>
        </div>

        {/* Under Review Screenshots - Amber Accent */}
        <div className="p-5 rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between text-[#94A3B8] text-xs font-medium">
            <span>Under review queue</span>
            <div className="w-8 h-8 rounded-md bg-[#F59E0B]/15 text-[#FBBF24] flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold text-[#FBBF24] font-heading tracking-tight">
            {loading || !stats ? (
              <Skeleton className="h-8 w-16 bg-[#24262A]" />
            ) : (
              <CountUp value={stats.under_review_count} />
            )}
          </div>
          <div className="mt-2 text-[11px] text-[#FBBF24] font-medium">
            <Link to="/admin/screenshots" className="hover:underline">
              Inspect verification queue →
            </Link>
          </div>
        </div>
      </div>

      {/* RECENT REGISTRATIONS TABLE */}
      <div className="rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden p-5 sm:p-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#2B2E32]">
          <div>
            <h3 className="text-base font-bold text-[#F7FAFC] font-heading tracking-tight">
              Recent registrations
            </h3>
            <p className="text-xs text-[#94A3B8]">Live feed of incoming guest requests.</p>
          </div>
          <Link
            to="/admin/registrations"
            className="text-xs font-medium text-[#5EE5BC] hover:underline flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs font-medium uppercase text-[#94A3B8] border-b border-[#2B2E32] pb-2">
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3">Participant</th>
                <th className="py-2.5 px-3">Institution</th>
                <th className="py-2.5 px-3">Dates</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2E32] text-xs">
              {recentRegistrations.map((reg) => (
                <tr key={reg.id} className="hover:bg-[#24262A] transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-[#5EE5BC]">
                    {reg.reference_id}
                  </td>
                  <td className="py-3 px-3 font-semibold text-[#F7FAFC]">
                    {reg.full_name}
                  </td>
                  <td className="py-3 px-3 text-[#94A3B8]">
                    {reg.college_or_organisation || '—'}
                  </td>
                  <td className="py-3 px-3 text-[#94A3B8]">
                    {formatDate(reg.check_in_date)} ({reg.nights}n)
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-[#F7FAFC]">
                    {formatINR(reg.amount)}
                  </td>
                  <td className="py-3 px-3">
                    <PaymentStatusBadge status={reg.payment_status} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
