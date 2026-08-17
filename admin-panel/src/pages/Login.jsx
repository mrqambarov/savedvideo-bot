import { useState } from 'react';
import { Lock, Sparkles, Sun, Moon, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { login, verifyOtp } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';

export default function Login() {
  const { setAuthed, theme, toggleTheme, toast } = useApp();
  const [pw, setPw] = useState('');
  const [otp, setOtp] = useState('');
  const [tempId, setTempId] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setErr('');
    try {
      const res = await login(pw);
      if (res.require2FA) {
        setTempId(res.tempId);
        toast('Telegramga 6 xonali tasdiqlash kodi yuborildi!');
      } else if (res.success) {
        setAuthed(true);
        toast('Tizimga muvaffaqiyatli kirildi!');
      } else {
        setErr(res.error || "Kiritilgan parol noto'g'ri");
      }
    } catch {
      setErr("Server bilan aloqa o'rnatib bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 4) return;
    setBusy(true);
    setErr('');
    try {
      const res = await verifyOtp(tempId, otp);
      if (res.success) {
        setAuthed(true);
        toast('2FA tasdiqlandi. Xush kelibsiz!');
      } else {
        setErr(res.error || "Tasdiqlash kodi noto'g'ri");
      }
    } catch {
      setErr("Tasdiqlashda xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <button className="icon-btn" style={{ position: 'fixed', top: 24, right: 24 }} onClick={toggleTheme} title="Mavzuni o'zgartirish">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {!tempId ? (
        // 1-bosqich: Parol kiritish
        <form className="login-card" onSubmit={handlePasswordSubmit}>
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
      ) : (
        // 2-bosqich: Telegram 2FA OTP kiritish
        <form className="login-card" onSubmit={handleOtpSubmit}>
          <div className="login-logo" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>
          <h2>2FA Himoyasi</h2>
          <div className="sub" style={{ lineHeight: 1.4 }}>
            Telegram botingizga 6 xonali tasdiqlash kodi yuborildi. Iltimos, kodni kiriting:
          </div>

          {err && <div className="login-err">{err}</div>}

          <div className="field" style={{ textAlign: 'left', marginTop: 12 }}>
            <label>Tasdiqlash kodi (OTP)</label>
            <div className="input-icon">
              <KeyRound size={16} />
              <input
                className="input"
                type="text"
                placeholder="123456"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                autoFocus
                style={{ fontSize: '1.25rem', letterSpacing: '4px', textAlign: 'center' }}
              />
            </div>
          </div>

          <button className="btn btn-primary btn-block" disabled={busy || otp.length < 4} style={{ marginTop: 8 }}>
            {busy ? <span className="spinner" /> : 'Kodni Tasdiqlash'}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => { setTempId(null); setOtp(''); setErr(''); }}
            style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <ArrowLeft size={16} />
            Orqaga qaytish
          </button>
        </form>
      )}
    </div>
  );
}
