import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatDate } from '../../lib/formatters';
import { 
  getAnnouncements, 
  saveAnnouncement, 
  deleteAnnouncement 
} from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import type { Announcement } from '../../types';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';

export const AdminAnnouncementsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [, setLoading] = useState(true);

  // Form modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Announcement> | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAnnouncements();
      setAnnouncements(data);
    } catch (e: any) {
      toastError(e.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setTitle('');
    setBody('');
    setIsPublished(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (a: Announcement) => {
    setEditingItem(a);
    setTitle(a.title);
    setBody(a.body);
    setIsPublished(a.is_published);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setIsSaving(true);
    try {
      await saveAnnouncement({
        id: editingItem?.id,
        title: title.trim(),
        body: body.trim(),
        is_published: isPublished,
      });

      toastSuccess(editingItem?.id ? 'Announcement updated.' : 'Announcement published.');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toastError(err.message || 'Failed to save announcement.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteAnnouncement(deleteId);
      toastSuccess('Announcement removed.');
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      toastError(err.message || 'Failed to delete announcement.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Announcement>[] = [
    {
      key: 'title',
      header: 'Notice title',
      render: (a) => (
        <div>
          <div className="font-semibold text-[#F7FAFC] text-xs sm:text-sm">{a.title}</div>
          <div className="text-xs text-[#94A3B8] line-clamp-1 mt-0.5">{a.body}</div>
        </div>
      ),
    },
    {
      key: 'is_published',
      header: 'Status',
      render: (a) => (
        <span
          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-md font-medium ${
            a.is_published
              ? 'bg-[#5EE5BC]/10 text-[#5EE5BC] border border-[#5EE5BC]/25'
              : 'bg-[#24262A] text-[#94A3B8] border border-[#2B2E32]'
          }`}
        >
          {a.is_published ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          <span>{a.is_published ? 'Published' : 'Draft'}</span>
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (a) => <span className="text-xs text-[#94A3B8]">{formatDate(a.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-[#F7FAFC]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2B2E32]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-[#F7FAFC]">
            Hostel notices &amp; announcements
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Publish curfew guidelines, reception desk timings, and campus hostel news.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="btn-primary inline-flex items-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New announcement</span>
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={announcements}
        searchPlaceholder="Search announcements..."
        searchFilter={(a, q) =>
          a.title.toLowerCase().includes(q.toLowerCase()) || a.body.toLowerCase().includes(q.toLowerCase())
        }
        actions={(a) =>
          isAdmin ? (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => handleOpenEdit(a)}
                className="p-1.5 text-[#94A3B8] hover:text-[#5EE5BC] hover:bg-[#24262A] rounded-md transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteId(a.id)}
                className="p-1.5 text-[#94A3B8] hover:text-[#AB252C] hover:bg-[#24262A] rounded-md transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : null
        }
      />

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem?.id ? 'Edit Announcement' : 'Create Announcement'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Check-in Desk Hours Extended"
              className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#F7FAFC] mb-1">
              Announcement message body *
            </label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Provide full notice details..."
              className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_pub"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="rounded-md accent-[#5EE5BC] w-4 h-4"
            />
            <label htmlFor="is_pub" className="text-xs font-medium text-[#F7FAFC]">
              Publish immediately to guest registration page
            </label>
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
              {isSaving ? 'Saving...' : 'Save announcement'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message="Are you sure you want to permanently delete this announcement? This action cannot be undone."
        confirmLabel="Delete Notice"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
};
