import { useState } from 'react';
import { Sparkles, Lock, Moon, Sun } from 'lucide-react';
import { login } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';

export default function Login() {
  const { setAuthed, theme, toggleTheme, toast } = useApp();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setErr('');
    try {
      const ok = await login(pw);
      if (ok) {
        setAuthed(true);
        toast('Xush kelibsiz!');
      } else {
        setErr("Parol noto'g'ri");
      }
    } catch {
      setErr('Serverga ulanib bo\'lmadi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <button className="icon-btn" style={{ position: 'fixed', top: 20, right: 20 }} onClick={toggleTheme}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo"><Sparkles size={28} /></div>
        <h2>Boshqaruv Paneli</h2>
        <div className="sub">Davom etish uchun tizimga kiring</div>
        {err && <div className="login-err">{err}</div>}
        <div className="field">
          <label>Admin parol</label>
          <div className="input-icon">
            <Lock size={16} />
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy || !pw}>
          {busy ? <span className="spinner" /> : 'Kirish'}
        </button>
      </form>
    </div>
  );
}
