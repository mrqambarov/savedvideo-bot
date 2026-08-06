import { useState } from 'react';
import { Lock, Sparkles, Sun, Moon } from 'lucide-react';
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
        toast('Tizimga muvaffaqiyatli kirildi!');
      } else {
        setErr("Kiritilgan parol noto'g'ri");
      }
    } catch {
      setErr("Server bilan aloqa o'rnatib bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <button className="icon-btn" style={{ position: 'fixed', top: 24, right: 24 }} onClick={toggleTheme} title="Mavzuni o'zgartirish">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <Sparkles size={24} color="#ffffff" />
        </div>
        <h2>Boshqaruv Markazi</h2>
        <div className="sub">Tizimga kirish uchun maxfiy parolni kiriting</div>
        
        {err && <div className="login-err">{err}</div>}
        
        <div className="field" style={{ textAlign: 'left' }}>
          <label>Admin paroli</label>
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
        
        <button className="btn btn-primary btn-block" disabled={busy || !pw} style={{ marginTop: 8 }}>
          {busy ? <span className="spinner" /> : 'Tizimga kirish'}
        </button>
      </form>
    </div>
  );
}
