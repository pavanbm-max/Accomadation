import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable';
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge';
import { PaymentDetailsPanel } from '../../components/PaymentDetailsPanel';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatINR, formatDate } from '../../lib/formatters';
import { 
  getRegistrations, 
  markPaidAtDesk, 
  deleteRegistration,
  updateRegistration,
  createAdminRegistration,
  toggleCheckIn,
  allotRoom,
  extractRoomNumber
} from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { Registration, PaymentStatus } from '../../types';
import { 
  UserPlus, 
  Eye, 
  FileSpreadsheet,
  Edit3,
  Trash2,
  RefreshCw,
  UserCheck
} from 'lucide-react';

export const AdminRegistrationsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer state
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Delete modal state
  const [regToDelete, setRegToDelete] = useState<Registration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Manual creation form state
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualFullName, setManualFullName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualCollege, setManualCollege] = useState('');
  const [manualGender, setManualGender] = useState('Male');
  const [manualEmergency, setManualEmergency] = useState('');
  const [manualRoomNumber, setManualRoomNumber] = useState('');
  const [manualCheckIn, setManualCheckIn] = useState(tomorrow);
  const [manualCheckOut, setManualCheckOut] = useState(dayAfter);
  const [manualStatus, setManualStatus] = useState<PaymentStatus>('paid_at_desk');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('cash_desk');
  const [manualCustomAmount, setManualCustomAmount] = useState('');
  const [manualAdminNote, setManualAdminNote] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Edit form state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [regToEdit, setRegToEdit] = useState<Registration | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editGender, setEditGender] = useState('Male');
  const [editCollege, setEditCollege] = useState('');
  const [editEmergency, setEditEmergency] = useState('');
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<PaymentStatus>('paid');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editTransactionId, setEditTransactionId] = useState('');
  const [editAdminNote, setEditAdminNote] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

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
      'Room Number',
      'College / Organisation',
      'Emergency Contact',
      'Check-in Date',
      'Check-out Date',
      'Nights',
      'Amount (INR)',
      'Payment Status',
      'Payment Method',
      'Transaction ID',
      'Paid Timestamp',
      'Checked-in Timestamp',
      'Admin Note',
      'Created At',
    ];

    const rows = registrations.map((r) => [
      r.reference_id,
      `"${r.full_name.replace(/"/g, '""')}"`,
      r.phone,
      r.email,
      r.gender || '',
      r.room_number || extractRoomNumber(r.admin_note) || '',
      `"${(r.college_or_organisation || '').replace(/"/g, '""')}"`,
      r.emergency_contact || '',
      r.check_in_date,
      r.check_out_date,
      r.nights,
      r.amount,
      r.payment_status,
      r.payment_method || '',
      r.transaction_id || '',
      r.paid_at || '',
      r.checked_in_at || '',
      `"${(r.admin_note || '').replace(/"/g, '""')}"`,
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

  const handleToggleCheckIn = async (id: string, currentlyCheckedIn: boolean) => {
    try {
      await toggleCheckIn(id, !currentlyCheckedIn);
      toastSuccess(!currentlyCheckedIn ? 'Guest marked as checked in.' : 'Check-in status removed.');
      loadData();
      if (selectedReg && selectedReg.id === id) {
        setSelectedReg((prev) => prev ? {
          ...prev,
          checked_in_at: !currentlyCheckedIn ? new Date().toISOString() : null
        } : null);
      }
    } catch (e: any) {
      toastError(e.message || 'Failed to update check-in state.');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (reg: Registration) => {
    setRegToEdit(reg);
    setEditFullName(reg.full_name);
    setEditPhone(reg.phone);
    setEditEmail(reg.email);
    setEditGender(reg.gender || 'Male');
    setEditCollege(reg.college_or_organisation || '');
    setEditEmergency(reg.emergency_contact || '');
    setEditRoomNumber(reg.room_number || extractRoomNumber(reg.admin_note) || '');
    setEditCheckIn(reg.check_in_date);
    setEditCheckOut(reg.check_out_date);
    setEditAmount(reg.amount);
    setEditStatus(reg.payment_status);
    setEditPaymentMethod(reg.payment_method || '');
    setEditTransactionId(reg.transaction_id || '');
    setEditAdminNote(reg.admin_note || '');
    setIsEditModalOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regToEdit) return;

    setEditSubmitting(true);
    try {
      const checkIn = new Date(editCheckIn);
      const checkOut = new Date(editCheckOut);
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

      const isPaid = editStatus === 'paid' || editStatus === 'paid_at_desk';
      const paidAt = isPaid ? (regToEdit.paid_at || new Date().toISOString()) : null;

      await updateRegistration(regToEdit.id, {
        full_name: editFullName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim().toLowerCase(),
        gender: editGender,
        college_or_organisation: editCollege.trim(),
        emergency_contact: editEmergency.trim(),
        room_number: editRoomNumber.trim() || null,
        check_in_date: editCheckIn,
        check_out_date: editCheckOut,
        nights,
        amount: Number(editAmount),
        payment_status: editStatus,
        payment_method: editPaymentMethod.trim() || null,
        transaction_id: editTransactionId.trim() || null,
        paid_at: paidAt,
        admin_note: editAdminNote.trim() || null,
      });

      toastSuccess(`Registration ${regToEdit.reference_id} updated.`);
      setIsEditModalOpen(false);
      setRegToEdit(null);
      loadData();
    } catch (e: any) {
      toastError(e.message || 'Failed to update registration.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!regToDelete) return;
    setIsDeleting(true);
    try {
      await deleteRegistration(regToDelete.id);
      toastSuccess(`Registration ${regToDelete.reference_id} deleted successfully.`);
      setRegToDelete(null);
      if (selectedReg?.id === regToDelete.id) {
        setIsDrawerOpen(false);
        setSelectedReg(null);
      }
      loadData();
    } catch (e: any) {
      toastError(e.message || 'Failed to delete registration.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Create Manual Registration
  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualSubmitting(true);
    try {
      const res = await createAdminRegistration({
        fullName: manualFullName,
        phone: manualPhone,
        email: manualEmail,
        collegeOrOrganisation: manualCollege,
        gender: manualGender,
        emergencyContact: manualEmergency,
        roomNumber: manualRoomNumber.trim() || undefined,
        checkInDate: manualCheckIn,
        checkOutDate: manualCheckOut,
        paymentStatus: manualStatus,
        paymentMethod: manualPaymentMethod,
        customAmount: manualCustomAmount ? Number(manualCustomAmount) : undefined,
        adminNote: manualAdminNote,
      });

      toastSuccess(`Registration ${res.reference_id} created successfully.`);
      setIsManualModalOpen(false);
      // Reset form
      setManualFullName('');
      setManualPhone('');
      setManualEmail('');
      setManualCollege('');
      setManualEmergency('');
      setManualRoomNumber('');
      setManualAdminNote('');
      setManualCustomAmount('');
      loadData();
    } catch (e: any) {
      toastError(e.message || 'Failed to create registration.');
    } finally {
      setManualSubmitting(false);
    }
  };

  // Allot Room & Notify User
  const handleAllotRoom = async (id: string, room: string, notifyUser: boolean) => {
    try {
      await allotRoom(id, room, notifyUser);
      toastSuccess(
        notifyUser
          ? `Room ${room} allotted and email dispatched to participant!`
          : `Room ${room} allotted successfully.`
      );
      loadData();
      if (selectedReg && selectedReg.id === id) {
        setSelectedReg((prev) =>
          prev
            ? {
                ...prev,
                room_number: room,
                admin_note: prev.admin_note ? `${prev.admin_note}\n[Room: ${room}]` : `[Room: ${room}]`,
              }
            : null
        );
      }
    } catch (e: any) {
      toastError(e.message || 'Failed to allot room.');
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
          <div className="font-semibold text-[#F7FAFC] flex items-center gap-1.5">
            <span>{r.full_name}</span>
            {r.gender && (
              <span className="text-[10px] text-[#94A3B8] font-normal">({r.gender[0]})</span>
            )}
          </div>
          <div className="text-[11px] text-[#94A3B8] font-mono">{r.phone}</div>
          {r.college_or_organisation && (
            <div className="text-[10px] text-[#64748B] truncate max-w-[160px]">
              {r.college_or_organisation}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Room',
      render: (r) => {
        const room = r.room_number || extractRoomNumber(r.admin_note);
        return room ? (
          <span className="font-mono text-xs font-bold text-[#5EE5BC] bg-[#5EE5BC]/10 px-2 py-0.5 rounded border border-[#5EE5BC]/30">
            {room}
          </span>
        ) : (
          <span className="text-xs text-[#64748B] italic">Unallotted</span>
        );
      },
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
          <span className="inline-flex items-center gap-1 text-xs text-[#5EE5BC] font-medium">
            <UserCheck className="w-3.5 h-3.5" />
            <span>In</span>
          </span>
        ) : (
          <span className="text-xs text-[#94A3B8]">Not checked in</span>
        ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-[#F7FAFC]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#00F5B8]/15">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F7FAFC] font-heading tracking-tight">
            Hostel registrations &amp; allotments
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Create, edit, delete, inspect participant bookings, and manage reception check-ins.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={loadData}
            className="btn-secondary inline-flex items-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-md"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#5EE5BC] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

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
          { label: 'Checked In', value: 'checked_in' },
          { label: 'Pending', value: 'pending' },
          { label: 'Under review', value: 'under_review' },
          { label: 'Failed', value: 'failed' },
          { label: 'Expired', value: 'expired' },
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
        searchPlaceholder="Search reference, participant name, phone, email..."
        searchFilter={(item, q) =>
          item.full_name.toLowerCase().includes(q.toLowerCase()) ||
          item.reference_id.toLowerCase().includes(q.toLowerCase()) ||
          item.phone.includes(q) ||
          item.email.toLowerCase().includes(q.toLowerCase()) ||
          (item.college_or_organisation || '').toLowerCase().includes(q.toLowerCase())
        }
        actions={(r) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleOpenDrawer(r)}
              className="p-1.5 text-[#94A3B8] hover:text-[#5EE5BC] hover:bg-[#24262A] rounded-md transition-colors"
              title="View details"
            >
              <Eye className="w-4 h-4" />
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => handleOpenEdit(r)}
                  className="p-1.5 text-[#94A3B8] hover:text-[#5EE5BC] hover:bg-[#24262A] rounded-md transition-colors"
                  title="Edit registration"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRegToDelete(r)}
                  className="p-1.5 text-[#94A3B8] hover:text-[#F87171] hover:bg-[#AB252C]/15 rounded-md transition-colors"
                  title="Delete registration"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
        pageSize={12}
      />

      {/* Details Side Drawer */}
      <PaymentDetailsPanel
        registration={selectedReg}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onMarkPaidAtDesk={handleMarkPaidAtDesk}
        onAllotRoom={handleAllotRoom}
        onEdit={handleOpenEdit}
        onDelete={(r) => setRegToDelete(r)}
        onToggleCheckIn={handleToggleCheckIn}
        isAdmin={isAdmin}
      />

      {/* Manual Registration Modal (Admin Only) */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Add Registration Record"
        description="Manually record a spot booking, VIP allotment, or offline registration."
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
                Gender (hostel block)
              </label>
              <select
                value={manualGender}
                onChange={(e) => setManualGender(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              >
                <option value="Male">Male (Boys Hostel)</option>
                <option value="Female">Female (Girls Hostel)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Room allotment (Optional)
              </label>
              <input
                type="text"
                value={manualRoomNumber}
                onChange={(e) => setManualRoomNumber(e.target.value)}
                placeholder="e.g. B-204, G-102"
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
                placeholder="College or university name"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Emergency contact
              </label>
              <input
                type="tel"
                value={manualEmergency}
                onChange={(e) => setManualEmergency(e.target.value)}
                placeholder="Parent / Guardian phone"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Payment status
              </label>
              <select
                value={manualStatus}
                onChange={(e) => setManualStatus(e.target.value as PaymentStatus)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              >
                <option value="paid_at_desk">Paid at desk (Cash / POS)</option>
                <option value="paid">Paid (Online / Verified)</option>
                <option value="pending">Pending (Pay later at counter)</option>
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

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Payment method / Receipt ref
              </label>
              <input
                type="text"
                value={manualPaymentMethod}
                onChange={(e) => setManualPaymentMethod(e.target.value)}
                placeholder="e.g. cash_desk, UPI, DESK-402"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Override amount (₹) (Optional)
              </label>
              <input
                type="number"
                min="0"
                value={manualCustomAmount}
                onChange={(e) => setManualCustomAmount(e.target.value)}
                placeholder="Leave blank for automatic tariff"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Admin note
              </label>
              <input
                type="text"
                value={manualAdminNote}
                onChange={(e) => setManualAdminNote(e.target.value)}
                placeholder="e.g. Spot registration approved by Organizing Committee"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>
          </div>

          <div className="pt-3 flex gap-2 justify-end border-t border-[#2B2E32]">
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

      {/* Edit Registration Modal (Admin Only) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Registration - ${regToEdit?.reference_id || ''}`}
        description="Update participant details, stay window, tariffs, or payment status."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Full name *
              </label>
              <input
                type="text"
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Phone number *
              </label>
              <input
                type="tel"
                required
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Email address *
              </label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Gender
              </label>
              <select
                value={editGender}
                onChange={(e) => setEditGender(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Room allotment
              </label>
              <input
                type="text"
                value={editRoomNumber}
                onChange={(e) => setEditRoomNumber(e.target.value)}
                placeholder="e.g. B-204"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                College / organisation
              </label>
              <input
                type="text"
                value={editCollege}
                onChange={(e) => setEditCollege(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Emergency contact
              </label>
              <input
                type="tel"
                value={editEmergency}
                onChange={(e) => setEditEmergency(e.target.value)}
                placeholder="Parent / Guardian phone"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Check-in date *
              </label>
              <input
                type="date"
                required
                value={editCheckIn}
                onChange={(e) => setEditCheckIn(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Check-out date *
              </label>
              <input
                type="date"
                required
                value={editCheckOut}
                onChange={(e) => setEditCheckOut(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Total amount (₹) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={editAmount}
                onChange={(e) => setEditAmount(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] font-mono focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Payment status *
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as PaymentStatus)}
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              >
                <option value="paid">Paid (Online / Verified)</option>
                <option value="paid_at_desk">Paid at desk</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under review</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Payment method
              </label>
              <input
                type="text"
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value)}
                placeholder="e.g. upi, cash_desk"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Transaction / Receipt ID
              </label>
              <input
                type="text"
                value={editTransactionId}
                onChange={(e) => setEditTransactionId(e.target.value)}
                placeholder="e.g. UPI-TXN-12345"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
                Admin note
              </label>
              <textarea
                rows={2}
                value={editAdminNote}
                onChange={(e) => setEditAdminNote(e.target.value)}
                placeholder="Internal notes or room allocation info"
                className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
              />
            </div>
          </div>

          <div className="pt-3 flex gap-2 justify-end border-t border-[#2B2E32]">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="btn-secondary py-2 px-4 text-xs font-medium rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="btn-primary py-2 px-4 text-xs font-semibold disabled:opacity-50 rounded-md"
            >
              {editSubmitting ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(regToDelete)}
        onClose={() => setRegToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Registration Record"
        message={`Are you sure you want to permanently delete registration ${regToDelete?.reference_id} (${regToDelete?.full_name})? This record and its stay details will be removed from the hostel database.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete record'}
        cancelLabel="Keep record"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
};
