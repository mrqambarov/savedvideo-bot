import { useState } from 'react';
import { Moon, Sun, LogOut, Palette, Info, ShieldCheck, RefreshCw, Trash2, Download, Key, Server, Bot, Film } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { dlApi, safe } from '../lib/api.js';

export default function SettingsPage() {
  const { theme, toggleTheme, logout } = useApp();
  const [newPassword, setNewPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg] = useState(null);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      return setMsg({ type: 'error', text: 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak!' });
    }
    setPassLoading(true);
    setMsg(null);
    const { data, error } = await safe(dlApi.post('/change-password', { newPassword }));
    setPassLoading(false);
    if (error) {
      setMsg({ type: 'error', text: error });
    } else {
      setMsg({ type: 'success', text: data.message || 'Parol muvaffaqiyatli o\'zgartirildi!' });
      setNewPassword('');
    }
  };

  const handleRestartBot = async (target) => {
    setActionLoading(target);
    setMsg(null);
    const { data, error } = await safe(dlApi.post('/restart-bot', { target }));
    setActionLoading('');
    if (error) {
      setMsg({ type: 'error', text: error });
    } else {
      setMsg({ type: 'success', text: data.message || 'Bot muvaffaqiyatli qayta ishga tushirildi!' });
    }
  };

  const handleCleanTemp = async () => {
    setActionLoading('clean');
    setMsg(null);
    const { data, error } = await safe(dlApi.post('/clean-temp'));
    setActionLoading('');
    if (error) {
      setMsg({ type: 'error', text: error });
    } else {
      setMsg({ type: 'success', text: data.message || 'Vaqtinchalik xotira tozalandi!' });
    }
  };

  const handleDownloadBackup = () => {
    const token = localStorage.getItem('dlToken');
    const url = `/api/backup-data?token=${token}`;
    window.open(url, '_blank');
  };

  return (
    <div className="grid grid-2" style={{ maxWidth: 1050, gap: 20 }}>
      {msg && (
        <div style={{ gridColumn: '1 / -1', padding: '14px 18px', borderRadius: 10, background: msg.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: msg.type === 'error' ? '#ef4444' : '#10b981', border: `1px solid ${msg.type === 'error' ? '#ef4444' : '#10b981'}`, fontWeight: 600, fontSize: 14 }}>
          {msg.text}
        </div>
      )}

      {/* Admin Profile Card */}
      <div className="card" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-hover) 100%)', border: '1px solid var(--border-strong)' }}>
        <div className="card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="sidebar-avatar" style={{ width: 56, height: 56, fontSize: 20, boxShadow: '0 6px 20px rgba(99,102,241,0.35)' }}>
              SA
              <span className="status-dot" style={{ width: 14, height: 14 }} title="Faol Admin"></span>
            </div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 750, display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.02em' }}>
                Super Admin <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: 'rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 700, letterSpacing: '0.04em' }}>● ACTIVE ADMIN</span>
              </div>
              <div className="cell-sub" style={{ fontSize: 13, marginTop: 4 }}>ID: <b>6263659922</b> · Boshqaruv darajasi: <b>Bosh Administrator</b></div>
            </div>
          </div>
          <button className="btn btn-danger" onClick={logout} style={{ padding: '10px 18px', borderRadius: 10 }}>
            <LogOut size={16} /> Tizimdan Chiqish
          </button>
        </div>
      </div>

      {/* Direct Password Change */}
      <div className="card">
        <div className="card-head"><h3><Key size={17} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--accent)' }} />Parolni O'zgartirish</h3></div>
        <div className="card-pad">
          <form onSubmit={handlePasswordChange}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 650, marginBottom: 8, color: 'var(--text-2)' }}>Yangi Admin Paroli</label>
              <input
                type="password"
                className="input"
                placeholder="Yangi parolni kiriting..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '11px 14px' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={passLoading} style={{ width: '100%' }}>
              <ShieldCheck size={16} /> {passLoading ? 'Saqlanmoqda...' : 'Parolni Saqlash'}
            </button>
          </form>
        </div>
      </div>

      {/* Theme Options */}
      <div className="card">
        <div className="card-head"><h3><Palette size={17} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--accent)' }} />Ko'rinish va Rejim</h3></div>
        <div className="card-pad">
          <div className="between" style={{ alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 650, fontSize: 14 }}>Mavzu</div>
              <div className="cell-sub" style={{ marginTop: 2 }}>Yorug' yoki qorong'i rejimni tanlang</div>
            </div>
            <div className="seg">
              <button className={theme === 'light' ? 'active' : ''} onClick={() => theme !== 'light' && toggleTheme()}><Sun size={15} style={{ verticalAlign: -2 }} /> Yorug'</button>
              <button className={theme === 'dark' ? 'active' : ''} onClick={() => theme !== 'dark' && toggleTheme()}><Moon size={15} style={{ verticalAlign: -2 }} /> Qorong'i</button>
            </div>
          </div>
        </div>
      </div>

      {/* Bot Controls & Server Tools Tiles Grid */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head"><h3><Server size={17} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--accent)' }} />Botlarni va Serverni Boshqarish</h3></div>
        <div className="card-pad">
          <div className="action-grid">
            <button className="action-tile" onClick={() => handleRestartBot('downloader')} disabled={actionLoading === 'downloader'}>
              <div className="action-tile-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
                <Bot size={22} className={actionLoading === 'downloader' ? 'spin' : ''} />
              </div>
              <div>
                <div className="action-tile-title">Downloader Bot</div>
                <div className="action-tile-sub">{actionLoading === 'downloader' ? 'Qayta yuklanmoqda...' : 'VibeConvert botni qayta ishga tushirish'}</div>
              </div>
            </button>

            <button className="action-tile" onClick={() => handleRestartBot('movie')} disabled={actionLoading === 'movie'}>
              <div className="action-tile-icon" style={{ background: 'linear-gradient(135deg, #ec4899 0%, #d946ef 100%)' }}>
                <Film size={22} className={actionLoading === 'movie' ? 'spin' : ''} />
              </div>
              <div>
                <div className="action-tile-title">Kino Bot</div>
                <div className="action-tile-sub">{actionLoading === 'movie' ? 'Qayta yuklanmoqda...' : 'Kino botni qayta ishga tushirish'}</div>
              </div>
            </button>

            <button className="action-tile" onClick={handleCleanTemp} disabled={actionLoading === 'clean'}>
              <div className="action-tile-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                <Trash2 size={22} />
              </div>
              <div>
                <div className="action-tile-title">Temp Tozalash</div>
                <div className="action-tile-sub">{actionLoading === 'clean' ? 'Tozalanmoqda...' : 'Vaqtinchalik fayllarni o\'chirish'}</div>
              </div>
            </button>

            <button className="action-tile" onClick={handleDownloadBackup}>
              <div className="action-tile-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <Download size={22} />
              </div>
              <div>
                <div className="action-tile-title">Baza Backup</div>
                <div className="action-tile-sub">JSON bazani kompyuterga yuklash</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* System Details */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head"><h3><Info size={17} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--accent)' }} />Panel Haqida</h3></div>
        <div className="card-pad">
          <div className="grid grid-stats" style={{ gap: 16 }}>
            <div><div className="cell-sub">Versiya</div><div style={{ fontWeight: 700, fontSize: 15 }}>1.2.0 (Pro Studio)</div></div>
            <div><div className="cell-sub">Boshqariladigan botlar</div><div style={{ fontWeight: 700, fontSize: 15 }}>VibeConvert · Kino Bot</div></div>
            <div><div className="cell-sub">Server IP</div><div style={{ fontWeight: 700, fontSize: 15 }} className="mono">94.237.103.133</div></div>
            <div><div className="cell-sub">Avto-Backup</div><div style={{ fontWeight: 700, fontSize: 15, color: '#10b981' }}>● Yoqilgan (Har 24 soat)</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
