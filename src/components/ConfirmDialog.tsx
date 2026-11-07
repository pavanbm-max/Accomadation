import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-md flex-shrink-0 ${
            isDestructive 
              ? 'bg-[#AB252C]/15 text-[#F87171] border border-[#AB252C]/30' 
              : 'bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-sm text-[#94A3B8] leading-relaxed mt-0.5">
            {message}
          </p>
        </div>

        <div className="pt-3 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary py-2 px-4 text-xs font-medium rounded-md"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`py-2 px-4 rounded-md text-xs font-semibold shadow-soft transition-all active:scale-[0.98] ${
              isDestructive
                ? 'bg-[#AB252C] hover:bg-[#C9323A] text-white'
                : 'btn-primary'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
