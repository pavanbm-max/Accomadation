import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable';
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge';
import { PaymentDetailsPanel } from '../../components/PaymentDetailsPanel';
import { Modal } from '../../components/Modal';
import { formatINR, formatDate } from '../../lib/formatters';
import { 
  getRegistrations, 
  markPaidAtDesk, 
  refundRegistration, 
  createRegistration 
} from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { Registration } from '../../types';
import { 
  UserPlus, 
  Eye, 
  FileSpreadsheet
} from 'lucide-react';

export const AdminRegistrationsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery] = useState('');

  // Drawer & modals state
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Manual creation form state
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

  const [manualFullName, setManualFullName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualCollege, setManualCollege] = useState('');
  const [manualGender, setManualGender] = useState('Male');
  const [manualCheckIn, setManualCheckIn] = useState(tomorrow);
  const [manualCheckOut, setManualCheckOut] = useState(dayAfter);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getRegistrations({
        status: selectedStatus,
        search: searchQuery,
      });
      setRegistrations(data);
    } catch (err: any) {
      toastError(err.message || 'Failed to load registrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus, searchQuery]);

  // CSV Export
  const handleExportCSV = () => {
    if (registrations.length === 0) {
      toastError('No records to export.');
      return;
    }

    const headers = [
      'Reference ID',
      'Full Name',
      'Phone',
      'Email',
      'Gender',
      'College / Organisation',
      'Check-in Date',
      'Check-out Date',
      'Nights',
      'Amount (INR)',
      'Payment Status',
      'Payment Method',
      'Transaction ID',
      'Paid Timestamp',
      'Checked-in Timestamp',
      'Created At',
    ];

    const rows = registrations.map((r) => [
      r.reference_id,
      `"${r.full_name.replace(/"/g, '""')}"`,
      r.phone,
      r.email,
      r.gender || '',
      `"${(r.college_or_organisation || '').replace(/"/g, '""')}"`,
      r.check_in_date,
      r.check_out_date,
      r.nights,
      r.amount,
      r.payment_status,
      r.payment_method || '',
      r.transaction_id || '',
      r.paid_at || '',
      r.checked_in_at || '',
      r.created_at,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ignitron_hostel_registrations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toastSuccess('CSV exported successfully.');
  };

  const handleOpenDrawer = (reg: Registration) => {
    setSelectedReg(reg);
    setIsDrawerOpen(true);
  };

  const handleMarkPaidAtDesk = async (id: string, note: string, receipt?: string) => {
    try {
      await markPaidAtDesk(id, note, receipt);
      toastSuccess('Registration marked as paid at desk.');
      loadData();
      setIsDrawerOpen(false);
    } catch (e: any) {
      toastError(e.message || 'Failed to record desk payment.');
    }
  };

  const handleRefund = async (id: string, reason: string) => {
    try {
      await refundRegistration(id, reason);
      toastSuccess('Registration marked as refunded.');
      loadData();
      setIsDrawerOpen(false);
    } catch (e: any) {
      toastError(e.message || 'Failed to process refund.');
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualSubmitting(true);
    try {
      const res = await createRegistration({
        fullName: manualFullName,
        phone: manualPhone,
        email: manualEmail,
        collegeOrOrganisation: manualCollege,
        gender: manualGender,
        checkInDate: manualCheckIn,
        checkOutDate: manualCheckOut,
      });

      toastSuccess(`Manual registration ${res.referenceId} created.`);
      setIsManualModalOpen(false);
      // Reset form
      setManualFullName('');
      setManualPhone('');
      setManualEmail('');
      setManualCollege('');
      loadData();
    } catch (e: any) {
      toastError(e.message || 'Failed to create registration.');
    } finally {
      setManualSubmitting(false);
    }
  };

  // Table columns definition
  const columns: Column<Registration>[] = [
    {
      key: 'reference_id',
      header: 'Reference ID',
      render: (r) => (
        <span className="font-mono font-bold text-[#5EE5BC]">
          {r.reference_id}
        </span>
      ),
    },
    {
      key: 'full_name',
      header: 'Participant',
      render: (r) => (
        <div>
          <div className="font-semibold text-[#F7FAFC]">{r.full_name}</div>
          <div className="text-[11px] text-[#94A3B8]">{r.phone}</div>
        </div>
      ),
    },
    {
      key: 'stay',
      header: 'Stay Window',
      render: (r) => (
        <div className="text-xs">
          <div className="font-medium text-[#F7FAFC]">{formatDate(r.check_in_date)} → {formatDate(r.check_out_date)}</div>
          <div className="text-[#94A3B8] font-mono">{r.nights} night(s)</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount (₹)',
      render: (r) => (
        <span className="font-mono font-semibold text-[#F7FAFC]">
          {formatINR(r.amount)}
        </span>
      ),
    },
    {
      key: 'payment_status',
      header: 'Payment Status',
      render: (r) => <PaymentStatusBadge status={r.payment_status} size="sm" />,
    },
    {
      key: 'check_in',
      header: 'Check-in State',
      render: (r) =>
        r.checked_in_at ? (
          <span className="text-xs text-[#5EE5BC] font-medium">
            ✓ In
          </span>
        ) : (
          <span className="text-xs text-[#94A3B8]">Not checked in</span>
        ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-[#F7FAFC]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2B2E32]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F7FAFC] font-heading tracking-tight">
            Hostel registrations &amp; allotments
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Search, filter by payment status, record desk settlements, and inspect participant details.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="btn-primary inline-flex items-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-md"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add registration</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="btn-secondary inline-flex items-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-md"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#5EE5BC]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { label: 'All records', value: 'all' },
          { label: 'Paid', value: 'paid' },
          { label: 'Paid at desk', value: 'paid_at_desk' },
          { label: 'Pending', value: 'pending' },
          { label: 'Under review', value: 'under_review' },
          { label: 'Failed', value: 'failed' },
          { label: 'Expired', value: 'expired' },
          { label: 'Refunded', value: 'refunded' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value)}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
              selectedStatus === tab.value
                ? 'bg-[#5EE5BC]/10 text-[#5EE5BC] border border-[#5EE5BC]/30 font-semibold shadow-soft'
                : 'bg-[#1B1D20] text-[#94A3B8] hover:bg-[#24262A] hover:text-[#F7FAFC] border border-[#2B2E32]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Registrations Table */}
      <DataTable
        columns={columns}
        data={registrations}
        searchPlaceholder="Search reference, participant name, phone..."
        searchFilter={(item, q) =>
          item.full_name.toLowerCase().includes(q.toLowerCase()) ||
          item.reference_id.toLowerCase().includes(q.toLowerCase()) ||
          item.phone.includes(q) ||
          item.email.toLowerCase().includes(q.toLowerCase())
        }
        actions={(r) => (
          <button
            onClick={() => handleOpenDrawer(r)}
            className="p-1.5 text-[#94A3B8] hover:text-[#5EE5BC] hover:bg-[#24262A] rounded-md transition-colors"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        pageSize={12}
      />

      {/* Details Side Drawer */}
      <PaymentDetailsPanel
        registration={selectedReg}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onMarkPaidAtDesk={handleMarkPaidAtDesk}
        onRefund={handleRefund}
        isAdmin={isAdmin}
      />

      {/* Manual Registration Modal (Admin Only) */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Create Manual Registration"
        description="Add a spot participant or VIP booking directly to the system."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateManual} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Full name *
              </label>
              <input
                type="text"
                required
                value={manualFullName}
                onChange={(e) => setManualFullName(e.target.value)}
                placeholder="e.g. Ramesh Chandra"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Phone number *
              </label>
              <input
                type="tel"
                required
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="+91 98401 00000"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Email address *
              </label>
              <input
                type="email"
                required
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="guest@domain.com"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                College / organisation
              </label>
              <input
                type="text"
                value={manualCollege}
                onChange={(e) => setManualCollege(e.target.value)}
                placeholder="College Name"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Gender (block allocation)
              </label>
              <select
                value={manualGender}
                onChange={(e) => setManualGender(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Check-in date
              </label>
              <input
                type="date"
                required
                value={manualCheckIn}
                onChange={(e) => setManualCheckIn(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Check-out date
              </label>
              <input
                type="date"
                required
                value={manualCheckOut}
                onChange={(e) => setManualCheckOut(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>
          </div>

          <div className="pt-3 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(false)}
              className="btn-secondary py-2 px-4 text-xs font-medium rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={manualSubmitting}
              className="btn-primary py-2 px-4 text-xs font-semibold disabled:opacity-50 rounded-md"
            >
              {manualSubmitting ? 'Creating...' : 'Create registration'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
