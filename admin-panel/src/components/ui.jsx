import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, Info, Inbox, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { shortNum } from '../lib/format.js';

export function StatCard({ icon: Icon, label, value, color = 'var(--accent)', delta, deltaLabel, format = true }) {
  const up = typeof delta === 'number' ? delta >= 0 : null;
  return (
    <div className="stat">
      <div className="stat-top">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{format ? shortNum(value) : value}</div>
        </div>
        <div className="stat-ico" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
          <Icon size={22} />
        </div>
      </div>
      {(delta !== undefined || deltaLabel) && (
        <div className={`stat-delta ${up ? 'up' : 'down'}`}>
          {typeof delta === 'number' && (up ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
          {typeof delta === 'number' && <span>+{shortNum(Math.abs(delta))}</span>}
          {deltaLabel && <span className="muted">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function Loader({ full }) {
  if (full) return <div className="loader-full"><div className="spinner lg" /></div>;
  return <div className="spinner" />;
}

export function Empty({ title = 'Ma\'lumot yo\'q', text, icon: Icon = Inbox }) {
  return (
    <div className="empty">
      <Icon size={40} />
      <h4>{title}</h4>
      {text && <div>{text}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, width }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" style={{ marginLeft: 'auto', width: 32, height: 32 }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ToastHost() {
  const { toasts } = useApp();
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  return createPortal(
    <div className="toast-wrap">
      {toasts.map((t) => {
        const Ico = icons[t.type] || Info;
        return (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="t-ico"><Ico size={18} /></div>
            <div className="t-msg">{t.msg}</div>
          </div>
        );
      })}
    </div>,
    document.body
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
