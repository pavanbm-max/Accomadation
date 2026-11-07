import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, FileCheck, Image as ImageIcon } from 'lucide-react';

interface ScreenshotUploadProps {
  scanToken: string;
  referenceId: string;
  onUploadSuccess: () => void;
  onClose: () => void;
  onSubmit: (base64Image: string, note: string) => Promise<void>;
}

export const ScreenshotUpload: React.FC<ScreenshotUploadProps> = ({
  referenceId,
  onClose,
  onSubmit,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userNote, setUserNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File) => {
    setErrorMsg(null);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      setErrorMsg('Only JPG, PNG, or WebP images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size must be less than 5 MB.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl) {
      setErrorMsg('Please select a payment screenshot.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit(previewUrl, userNote);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload screenshot. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-6 sm:p-7 text-[#F7FAFC]">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 p-1.5 rounded-md text-[#94A3B8] hover:text-[#F7FAFC] hover:bg-[#24262A] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-left">
          <div className="text-xs font-mono font-medium text-[#5EE5BC]">
            Reference: {referenceId}
          </div>
          <h3 className="text-xl font-bold font-heading tracking-tight mt-0.5 text-[#F7FAFC]">
            Submit payment proof
          </h3>
          <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
            Did money get debited from your bank or UPI app while checkout timed out? Upload your transaction screenshot for hostel administration review.
          </p>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-md bg-[#AB252C]/15 border border-[#AB252C]/30 text-xs text-[#F87171] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#F87171]" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-left">
          {/* Drag & drop upload area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
              previewUrl
                ? 'border-[#5EE5BC]/60 bg-[#5EE5BC]/10'
                : 'border-[#2B2E32] hover:border-[#5EE5BC]/50 bg-[#24262A]/40 hover:bg-[#24262A]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            {previewUrl ? (
              <div className="flex flex-col items-center">
                <img
                  src={previewUrl}
                  alt="Screenshot Preview"
                  className="max-h-48 rounded-md object-contain shadow-soft border border-[#2B2E32]"
                />
                <span className="mt-2 text-xs text-[#5EE5BC] font-medium flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5" />
                  {selectedFile?.name} (Click or drag to replace)
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-[#5EE5BC]/15 text-[#5EE5BC] flex items-center justify-center mb-2">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="text-sm font-semibold text-[#F7FAFC]">
                  Drop payment screenshot here, or <span className="text-[#5EE5BC] underline underline-offset-2">browse</span>
                </div>
                <div className="text-[11px] text-[#94A3B8] mt-1">
                  JPG, PNG, or WebP up to 5 MB
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-[#F7FAFC] block mb-1">
              Transaction details / UPI UTR / bank ref (optional)
            </label>
            <textarea
              rows={2}
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="e.g. UPI Ref ID 984019283120 paid via Google Pay at 21:15 PM"
              className="w-full text-xs p-2.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 py-2.5 px-4 text-xs font-medium rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !previewUrl}
              className="btn-primary flex-1 py-2.5 px-4 text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 rounded-md"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Uploading...' : 'Submit for review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
