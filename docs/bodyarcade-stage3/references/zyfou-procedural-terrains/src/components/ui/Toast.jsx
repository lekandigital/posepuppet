// Toast notifications: dark panel, thin border, blue/green/red accent (no gradients).
const ICONS = {
  info: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 11V7.4M8 5.2v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 8.3l2 2 4-4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.8v3.6M8 10.8v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

export default function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type ?? 'info'}`}>
          <span className="toast-icon">{ICONS[t.type ?? 'info']}</span>
          <span className="toast-msg">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// Classify an engine toast string into a type by keyword.
export function classifyToast(msg) {
  const m = String(msg).toLowerCase();
  if (/(fail|error|could not|invalid|cannot)/.test(m)) return 'error';
  if (/(complete|exported|regenerated|saved|reset|switched|ready|done)/.test(m)) return 'success';
  return 'info';
}
