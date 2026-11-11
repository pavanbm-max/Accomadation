import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatDate } from '../../lib/formatters';
import { getProfiles, createStaffAccount, deleteStaffAccount } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import type { Profile, UserRole } from '../../types';
import { UserPlus, Trash2, Shield, User, Mail, Key } from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const { user: currentAuthUser, isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [, setLoading] = useState(true);

  // Form modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('volunteer');
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getProfiles();
      setProfiles(data);
    } catch (e: any) {
      toastError(e.message || 'Failed to load staff profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('volunteer');
    setIsModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toastError('Only administrators can create staff accounts.');
      return;
    }

    if (!fullName.trim() || !email.trim() || password.length < 6) {
      toastError('Please fill all fields (password must be at least 6 characters).');
      return;
    }

    setIsSaving(true);
    try {
      const res = await createStaffAccount({
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        role,
      });

      if (!res.success) {
        toastError(res.message);
      } else {
        toastSuccess(`Created account for ${fullName}.`);
        setIsModalOpen(false);
        loadData();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to create staff account.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteStaffAccount(deleteId);
      toastSuccess('Staff account revoked.');
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      toastError(err.message || 'Failed to revoke staff account.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Profile>[] = [
    {
      key: 'full_name',
      header: 'Staff member',
      render: (p) => (
        <div>
          <div className="font-semibold text-[#F7FAFC] text-xs sm:text-sm">{p.full_name}</div>
          <div className="text-[11px] text-[#94A3B8]">{p.email || '—'}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Access role',
      render: (p) => (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-md ${
            p.role === 'admin'
              ? 'bg-[#5EE5BC]/10 text-[#5EE5BC] border border-[#5EE5BC]/25'
              : 'bg-[#24262A] text-[#94A3B8] border border-[#2B2E32]'
          }`}
        >
          {p.role === 'admin' ? <Shield className="w-3 h-3 text-[#5EE5BC]" /> : <User className="w-3 h-3 text-[#94A3B8]" />}
          <span className="capitalize">{p.role}</span>
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Added on',
      render: (p) => <span className="text-xs text-[#94A3B8]">{formatDate(p.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-[#F7FAFC]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2B2E32]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-[#F7FAFC]">
            Staff &amp; volunteer management
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Create real volunteer logins for desk check-ins or assign warden administrator controls.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="btn-primary inline-flex items-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-md"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add volunteer or staff</span>
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={profiles}
        searchPlaceholder="Search staff member name..."
        searchFilter={(p, q) => p.full_name.toLowerCase().includes(q.toLowerCase())}
        actions={(p) =>
          isAdmin && p.id !== currentAuthUser?.id ? (
            <button
              onClick={() => setDeleteId(p.id)}
              className="p-1.5 text-[#94A3B8] hover:text-[#AB252C] hover:bg-[#24262A] rounded-md transition-colors"
              title="Delete staff member"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : null
        }
        emptyMessage="No staff profiles found. Click 'Add volunteer or staff' above to create one."
      />

      {/* CREATE STAFF MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Staff / Volunteer Account"
        description="Creates an authenticated login in Supabase Auth and registers their permissions."
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Full name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Email address (login ID) *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="volunteer@hostel.in"
                className="w-full pl-10 pr-3 py-2.5 text-xs rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Login password * (min. 6 characters)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 text-xs rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Assigned role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC]"
            >
              <option value="volunteer">Volunteer (Desk QR scanner only, read-only)</option>
              <option value="admin">Administrator (Full control, desk settlements, registrations CRUD)</option>
            </select>
          </div>

          <div className="pt-3 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary py-2 px-4 text-xs font-medium rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary py-2 px-4 text-xs font-semibold disabled:opacity-50 rounded-md"
            >
              {isSaving ? 'Creating account...' : 'Create real account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Staff Account"
        message="Are you sure you want to remove this staff account? Their Supabase Auth credentials and check-in privileges will be permanently revoked."
        confirmLabel="Revoke Account"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
};
