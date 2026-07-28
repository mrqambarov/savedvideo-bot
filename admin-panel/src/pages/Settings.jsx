import { Moon, Sun, LogOut, Palette, Info, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

export default function SettingsPage() {
  const { theme, toggleTheme, logout } = useApp();

  return (
    <div className="grid grid-2" style={{ maxWidth: 900 }}>
      <div className="card">
        <div className="card-head"><h3><Palette size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Ko'rinish</h3></div>
        <div className="card-pad">
          <div className="between">
            <div><div style={{ fontWeight: 600 }}>Mavzu</div><div className="cell-sub">Yorug' yoki qorong'i rejim</div></div>
            <div className="seg">
              <button className={theme === 'light' ? 'active' : ''} onClick={() => theme !== 'light' && toggleTheme()}><Sun size={15} style={{ verticalAlign: -2 }} /> Yorug'</button>
              <button className={theme === 'dark' ? 'active' : ''} onClick={() => theme !== 'dark' && toggleTheme()}><Moon size={15} style={{ verticalAlign: -2 }} /> Qorong'i</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3><ShieldCheck size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Xavfsizlik</h3></div>
        <div className="card-pad">
          <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Admin parolini o'zgartirish uchun serverdagi <span className="mono">.env</span> faylida <span className="mono">ADMIN_PASSWORD</span> qiymatini yangilang va botlarni qayta ishga tushiring.
          </p>
          <button className="btn btn-danger" onClick={logout}><LogOut size={16} /> Tizimdan chiqish</button>
        </div>
      </div>

      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head"><h3><Info size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Panel haqida</h3></div>
        <div className="card-pad">
          <div className="grid grid-stats" style={{ gap: 12 }}>
            <div><div className="cell-sub">Versiya</div><div style={{ fontWeight: 600 }}>1.0.0</div></div>
            <div><div className="cell-sub">Boshqariladigan botlar</div><div style={{ fontWeight: 600 }}>VibeConvert · Kino Bot</div></div>
            <div><div className="cell-sub">Server</div><div style={{ fontWeight: 600 }} className="mono">94.237.103.133</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
