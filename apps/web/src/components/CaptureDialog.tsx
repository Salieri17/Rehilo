import type { ChangeEvent } from "react";
import "./capture-dialog.css";

interface CaptureDialogProps {
  open: boolean;
  value: string;
  status: string | null;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onImport: (files: FileList) => void;
}

export default function CaptureDialog({
  open,
  value,
  status,
  onChange,
  onClose,
  onSubmit,
  onImport
}: CaptureDialogProps) {
  if (!open) {
    return null;
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    onImport(event.target.files);
    event.target.value = "";
  };

  return (
    <div className="capture-overlay" role="dialog" aria-modal="true">
      <div className="capture-card">
        <header>
          <h2>Quick capture</h2>
          <p className="muted">Paste text or URL. Import .txt files here.</p>
        </header>

        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type a note or paste a URL..."
          rows={5}
        />

        {status && <p className="status">{status}</p>}

        <div className="capture-actions">
          <label className="file-button">
            Import .txt
            <input type="file" accept=".txt" onChange={handleFile} />
          </label>
          <div className="right-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={onSubmit}>
              Capture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
