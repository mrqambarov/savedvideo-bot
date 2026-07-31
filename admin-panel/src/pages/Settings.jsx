import { useState } from 'react';
import { Moon, Sun, LogOut, Palette, Info, ShieldCheck, RefreshCw, Trash2, Download, Key, Server } from 'lucide-react';
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
    <div className="grid grid-2" style={{ maxWidth: 1000, gap: 20 }}>
      {msg && (
        <div style={{ gridColumn: '1 / -1', padding: '12px 16px', borderRadius: 8, background: msg.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: msg.type === 'error' ? '#ef4444' : '#10b981', border: `1px solid ${msg.type === 'error' ? '#ef4444' : '#10b981'}` }}>
          {msg.text}
        </div>
      )}

      {/* Admin Profile Card */}
      <div className="card" style={{ gridColumn: '1 / -1', background: 'var(--surface-hover)' }}>
        <div className="card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="sidebar-avatar" style={{ width: 54, height: 54, fontSize: 20 }}>
              SA
              <span className="status-dot" style={{ width: 14, height: 14 }} title="Faol Admin"></span>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                Super Admin <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 600 }}>● Active Admin</span>
              </div>
              <div className="cell-sub" style={{ fontSize: 13, marginTop: 2 }}>ID: <b>6263659922</b> · Boshqaruv darajasi: <b>Bosh Administrator</b></div>
            </div>
          </div>
          <button className="btn btn-danger" onClick={logout}>
            <LogOut size={16} /> Tizimdan Chiqish
          </button>
        </div>
      </div>

      {/* Direct Password Change */}
      <div className="card">
        <div className="card-head"><h3><Key size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Parolni O'zgartirish</h3></div>
        <div className="card-pad">
          <form onSubmit={handlePasswordChange}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Yangi Admin Paroli</label>
              <input
                type="password"
                className="input"
                placeholder="Yangi parolni kiriting..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={passLoading}>
              <ShieldCheck size={16} /> {passLoading ? 'Saqlanmoqda...' : 'Parolni Saqlash'}
            </button>
          </form>
        </div>
      </div>

      {/* Theme Options */}
      <div className="card">
        <div className="card-head"><h3><Palette size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Ko'rinish va Rejim</h3></div>
        <div className="card-pad">
          <div className="between">
            <div><div style={{ fontWeight: 600 }}>Mavzu</div><div className="cell-sub">Yorug' yoki qorong'i rejimni tanlang</div></div>
            <div className="seg">
              <button className={theme === 'light' ? 'active' : ''} onClick={() => theme !== 'light' && toggleTheme()}><Sun size={15} style={{ verticalAlign: -2 }} /> Yorug'</button>
              <button className={theme === 'dark' ? 'active' : ''} onClick={() => theme !== 'dark' && toggleTheme()}><Moon size={15} style={{ verticalAlign: -2 }} /> Qorong'i</button>
            </div>
          </div>
        </div>
      </div>

      {/* Bot Controls & Server Tools */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head"><h3><Server size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Botlarni va Serverni Boshqarish</h3></div>
        <div className="card-pad" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => handleRestartBot('downloader')} disabled={actionLoading === 'downloader'}>
            <RefreshCw size={16} className={actionLoading === 'downloader' ? 'spin' : ''} />
            {actionLoading === 'downloader' ? 'Yuklovchi bot qayta yuklanmoqda...' : '🔄 Downloader Botni Qayta Ishga Tushirish'}
          </button>
          
          <button className="btn" onClick={() => handleRestartBot('movie')} disabled={actionLoading === 'movie'}>
            <RefreshCw size={16} className={actionLoading === 'movie' ? 'spin' : ''} />
            {actionLoading === 'movie' ? 'Kino bot qayta yuklanmoqda...' : '🎬 Kino Botni Qayta Ishga Tushirish'}
          </button>

          <button className="btn" onClick={handleCleanTemp} disabled={actionLoading === 'clean'}>
            <Trash2 size={16} />
            {actionLoading === 'clean' ? 'Tozalanmoqda...' : '🧹 Kesh va Temp Fayllarni Tozalash'}
          </button>

          <button className="btn" onClick={handleDownloadBackup}>
            <Download size={16} />
            📥 Baza Fayllarini Yuklab Olish (Backup JSON)
          </button>
        </div>
      </div>

      {/* System Details */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head"><h3><Info size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Panel haqida</h3></div>
        <div className="card-pad">
          <div className="grid grid-stats" style={{ gap: 12 }}>
            <div><div className="cell-sub">Versiya</div><div style={{ fontWeight: 600 }}>1.2.0 (Pro Studio)</div></div>
            <div><div className="cell-sub">Boshqariladigan botlar</div><div style={{ fontWeight: 600 }}>VibeConvert Downloader · Kino Bot</div></div>
            <div><div className="cell-sub">Server IP</div><div style={{ fontWeight: 600 }} className="mono">94.237.103.133</div></div>
            <div><div className="cell-sub">Avto-Backup</div><div style={{ fontWeight: 600, color: '#10b981' }}>● Yoqilgan (Har 24 soat)</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
