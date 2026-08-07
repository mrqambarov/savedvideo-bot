import { useState, useEffect } from 'react';
import { Moon, Sun, LogOut, Palette, Info, ShieldCheck, RefreshCw, Trash2, Download, Key, Server, Bot, Film, Laptop, Smartphone, Globe, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { dlApi, safe } from '../lib/api.js';
import BotManagerCard from './BotManager.jsx';

export default function SettingsPage() {
  const { theme, toggleTheme, logout } = useApp();
  const [newPassword, setNewPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    const { data } = await safe(dlApi.get('/sessions'));
    setSessionsLoading(false);
    if (Array.isArray(data)) {
      setSessions(data);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

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

  const handleRevokeSession = async (sessionId) => {
    setMsg(null);
    const { data, error } = await safe(dlApi.post('/revoke-session', { sessionId }));
    if (error) {
      setMsg({ type: 'error', text: error });
    } else {
      setMsg({ type: 'success', text: data.message || 'Seans yakunlandi!' });
      fetchSessions();
    }
  };

  const handleRevokeOtherSessions = async () => {
    const current = sessions.find(s => s.current);
    setMsg(null);
    const { data, error } = await safe(dlApi.post('/revoke-other-sessions', { currentId: current ? current.id : null }));
    if (error) {
      setMsg({ type: 'error', text: error });
    } else {
      setMsg({ type: 'success', text: data.message || 'Barcha boshqa seanslar yakunlandi!' });
      fetchSessions();
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setMsg(null);
      const { data, error } = await safe(dlApi.get('/backup/download'));
      if (error) {
        return setMsg({ type: 'error', text: 'Zaxirani yuklashda xatolik: ' + error });
      }
      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMsg({ type: 'success', text: 'Tizim zaxirasi muvaffaqiyatli yuklab olindi!' });
    } catch (e) {
      setMsg({ type: 'error', text: 'Zaxira yuklab olishda xatolik: ' + e.message });
    }
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

      {/* Instant Bot Token Switcher & Hot Reload Manager */}
      <BotManagerCard />

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

      {/* Active Devices & Sessions Section */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head" style={{ justifyContent: 'space-between' }}>
          <h3><Laptop size={17} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--accent)' }} />Kirilgan Qurilmalar va Faol Seanslar</h3>
          {sessions.length > 1 && (
            <button className="btn btn-danger btn-sm" onClick={handleRevokeOtherSessions}>
              <AlertTriangle size={14} /> Barcha Boshqa Seanslarni Yakunlash
            </button>
          )}
        </div>
        <div className="card-pad">
          {sessionsLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-3)' }}>Seanslar yuklanmoqda...</div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-3)' }}>Hozircha faol seanslar ma'lumotlari mavjud emas.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {sessions.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 10, background: s.current ? 'rgba(99,102,241,0.08)' : 'var(--surface-hover)', border: `1px solid ${s.current ? 'var(--accent)' : 'var(--border)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: s.current ? 'var(--accent-grad)' : 'var(--border)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}>
                      {s.deviceName.includes('iPhone') || s.deviceName.includes('Android') ? <Smartphone size={20} /> : <Laptop size={20} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {s.deviceName}
                        {s.current ? (
                          <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 700 }}>
                            <CheckCircle2 size={11} style={{ verticalAlign: -1, marginRight: 3 }} /> JORIY QURILMA
                          </span>
                        ) : (
                          <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', fontWeight: 600 }}>
                            FAOL SEANS
                          </span>
                        )}
                      </div>
                      <div className="cell-sub" style={{ fontSize: 12, marginTop: 3 }}>
                        <Globe size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> IP: <b className="mono">{s.ip}</b> · Kirilgan vaqt: <b>{s.created ? s.created.replace('T', ' ').substring(0, 16) : 'Noma\'lum'}</b>
                      </div>
                    </div>
                  </div>
                  {!s.current && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleRevokeSession(s.id)}>
                      Seansni Yakunlash
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bot Controls & Server Tools Tiles Grid */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head"><h3><Server size={17} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--accent)' }} />Botlarni va Serverni Boshqarish (3 Bot Studio Control)</h3></div>
        <div className="card-pad">
          <div className="action-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
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

            <button className="action-tile" onClick={() => handleRestartBot('music')} disabled={actionLoading === 'music'}>
              <div className="action-tile-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                <Sparkles size={22} className={actionLoading === 'music' ? 'spin' : ''} />
              </div>
              <div>
                <div className="action-tile-title">🔞 18+ Adult Bot</div>
                <div className="action-tile-sub">{actionLoading === 'music' ? 'Qayta yuklanmoqda...' : '18+ Adult botni qayta ishga tushirish'}</div>
              </div>
            </button>

            <button className="action-tile" onClick={() => handleRestartBot('all')} disabled={actionLoading === 'all'}>
              <div className="action-tile-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}>
                <RefreshCw size={22} className={actionLoading === 'all' ? 'spin' : ''} />
              </div>
              <div>
                <div className="action-tile-title">Barcha 3 Botni Qayta Yoqish</div>
                <div className="action-tile-sub">{actionLoading === 'all' ? 'Barcha botlar qayta yuklanmoqda...' : '3 ta botni bir vaqtda qayta ishga tushirish'}</div>
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
              <div className="action-tile-icon" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }}>
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
            <div><div className="cell-sub">Versiya</div><div style={{ fontWeight: 700, fontSize: 15 }}>1.5.0 (3-Bot Studio Pro)</div></div>
            <div><div className="cell-sub">Boshqariladigan botlar</div><div style={{ fontWeight: 700, fontSize: 15 }}>Downloader · Kino Bot · 🔞 18+ Adult Bot</div></div>
            <div><div className="cell-sub">Server IP</div><div style={{ fontWeight: 700, fontSize: 15 }} className="mono">94.237.103.133</div></div>
            <div><div className="cell-sub">Avto-Backup</div><div style={{ fontWeight: 700, fontSize: 15, color: '#10b981' }}>● Yoqilgan (Har 24 soat)</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

