import "./toast-stack.css";

export type ToastTone = "info" | "success" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastStackProps {
  items: ToastItem[];
}

export default function ToastStack({ items }: ToastStackProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
