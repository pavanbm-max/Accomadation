import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { formatDateTime } from '../../lib/formatters';
import { getEmailOutbox, dispatchEmailViaSmtp } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import type { EmailOutboxItem } from '../../types';
import { Eye, Send, CheckCircle2, Clock, RefreshCw, SendHorizontal } from 'lucide-react';

export const AdminEmailPreviewPage: React.FC = () => {
  const { error: toastError, success: toastSuccess } = useToast();

  const [emails, setEmails] = useState<EmailOutboxItem[]>([]);
  const [, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailOutboxItem | null>(null);
  const [isSending, setIsSending] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getEmailOutbox();
      setEmails(data);
    } catch (e: any) {
      toastError(e.message || 'Failed to load email outbox.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendViaSmtp = async (emailId: string) => {
    setIsSending(true);
    try {
      const res = await dispatchEmailViaSmtp(emailId);
      toastSuccess(res.message);
      if (selectedEmail && selectedEmail.id === emailId) {
        setSelectedEmail({ ...selectedEmail, status: 'sent' });
      }
      loadData();
    } catch (e: any) {
      toastError(e.message || 'SMTP delivery failed.');
    } finally {
      setIsSending(false);
    }
  };

  const columns: Column<EmailOutboxItem>[] = [
    {
      key: 'to_email',
      header: 'Recipient',
      render: (e) => (
        <div>
          <div className="font-semibold text-[#F7FAFC] text-xs sm:text-sm">{e.to_email}</div>
          <div className="text-[11px] text-[#94A3B8] capitalize">
            {e.type} email • From: pavan.b.m1598@gmail.com
          </div>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Subject line',
      render: (e) => (
        <span className="font-medium text-[#F7FAFC] line-clamp-1">
          {e.subject}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-md ${
            e.status === 'sent'
              ? 'bg-[#5EE5BC]/10 text-[#5EE5BC] border border-[#5EE5BC]/25'
              : 'bg-[#F59E0B]/10 text-[#FBBF24] border border-[#F59E0B]/25'
          }`}
        >
          {e.status === 'sent' ? <CheckCircle2 className="w-3 h-3 text-[#5EE5BC]" /> : <Clock className="w-3 h-3 text-[#FBBF24]" />}
          <span className="capitalize">{e.status}</span>
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Queued timestamp',
      render: (e) => <span className="text-xs text-[#94A3B8]">{formatDateTime(e.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-[#F7FAFC]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2B2E32]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-[#F7FAFC]">
            Transactional email outbox (SMTP)
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Sender: <strong className="text-[#5EE5BC]">pavan.b.m1598@gmail.com</strong>. Review queued confirmation and notification emails.
          </p>
        </div>

        <button
          onClick={loadData}
          className="btn-secondary inline-flex items-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-md"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#5EE5BC]" />
          <span>Refresh queue</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={emails}
        searchPlaceholder="Search recipient email or subject..."
        searchFilter={(e, q) =>
          e.to_email.toLowerCase().includes(q.toLowerCase()) ||
          e.subject.toLowerCase().includes(q.toLowerCase())
        }
        actions={(e) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setSelectedEmail(e)}
              className="p-1.5 text-[#94A3B8] hover:text-[#5EE5BC] hover:bg-[#24262A] rounded-md transition-colors"
              title="Inspect email"
            >
              <Eye className="w-4 h-4" />
            </button>
            {e.status !== 'sent' && (
              <button
                onClick={() => handleSendViaSmtp(e.id)}
                className="p-1.5 text-[#5EE5BC] hover:bg-[#24262A] rounded-md transition-colors"
                title="Send via SMTP"
              >
                <SendHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        emptyMessage="No emails currently queued in outbox."
      />

      {/* EMAIL PREVIEW MODAL */}
      <Modal
        isOpen={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
        title="Email Dispatch Preview"
        description="Inspect rendered HTML body, sender, and recipient delivery details."
        maxWidth="xl"
      >
        {selectedEmail && (
          <div className="space-y-4">
            <div className="p-3.5 bg-[#24262A] rounded-md border border-[#2B2E32] text-xs space-y-1.5">
              <div className="flex justify-between">
                <div>
                  <span className="text-[#94A3B8] font-medium">From: </span>
                  <span className="font-semibold text-[#5EE5BC]">pavan.b.m1598@gmail.com</span>
                </div>
                <div>
                  <span className="text-[#94A3B8] font-medium">Outbox status: </span>
                  <span className="capitalize font-semibold text-[#5EE5BC]">{selectedEmail.status}</span>
                </div>
              </div>
              <div>
                <span className="text-[#94A3B8] font-medium">To: </span>
                <span className="font-semibold text-[#F7FAFC]">{selectedEmail.to_email}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] font-medium">Subject: </span>
                <span className="font-semibold text-[#F7FAFC]">{selectedEmail.subject}</span>
              </div>
            </div>

            <div className="border border-[#2B2E32] rounded-md p-4 bg-white text-[#0C1D18] max-h-96 overflow-y-auto">
              <div dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-[#94A3B8]">
                Hostel accommodation notification
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="btn-secondary py-2 px-4 text-xs font-medium rounded-md"
                >
                  Close
                </button>
                {selectedEmail.status !== 'sent' && (
                  <button
                    onClick={() => handleSendViaSmtp(selectedEmail.id)}
                    disabled={isSending}
                    className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 rounded-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? 'Sending...' : 'Send via SMTP now'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
