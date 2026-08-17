import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Film, Inbox, Megaphone, Radio,
  Download, Bot, Settings, Menu, Moon, Sun, LogOut, Sparkles, Gift, Users as UsersIcon, Clapperboard, X, Tv, ShieldAlert, ShieldCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { movieApi, safe } from '../lib/api.js';

const NAV = [
  { section: 'MEDIA STUDIO' },
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/movies', label: 'Kino Katalogi', icon: Film },
  { to: '/shorts', label: 'Shorts & Lavhalar', icon: Sparkles },
  { to: '/requests', label: "Kino So'rovlari", icon: Inbox, badge: 'requests' },
  { section: 'TAHLIL & FOYDALANUVCHILAR' },
  { to: '/analytics', label: 'Analitika', icon: UsersIcon },
  { to: '/users', label: 'Foydalanuvchilar', icon: UsersIcon },
  { to: '/referrals', label: 'Referal & Konkurs', icon: Gift },
  { section: 'MARKETING & KANALLAR' },
  { to: '/broadcast', label: 'Broadcast Messenger', icon: Megaphone },
  { to: '/channels', label: 'Homiy Kanallar (CPA)', icon: Radio },
  { section: 'TIZIM & BOTLAR' },
  { to: '/guardian', label: 'Guardian Watchdog 🛡️', icon: ShieldCheck },
  { to: '/downloader', label: 'Downloader Bot', icon: Download },
  { to: '/movie-bot', label: 'Kino Bot Studio', icon: Bot },
  { to: '/adult-bot', label: '18+ Adult Bot Studio', icon: ShieldAlert },
  { to: '/settings', label: 'Tizim Sozlamalari', icon: Settings },
];

const TITLES = {
  '/': ['Media Studio Dashboard', 'Real-vaqt server va botlar monitoringi'],
  '/guardian': ['Guardian Pro Watchdog', 'Avtonom xavfsizlik, o\'z-o\'zini tiklash va server nazorati'],
  '/analytics': ['Analitika & Tahlil', 'Foydalanuvchilar va yuklamalar statistikasi'],
  '/users': ['Foydalanuvchilar Ro\'yxati', 'Foydalanuvchilar katalogi va profillari'],
  '/movies': ['Kino Katalogi', 'Kinolar va meta-ma\'lumotlarini boshqarish'],
  '/shorts': ['Shorts & Lavhalar', 'TikTok / Reels uslubidagi qisqa video lavhalar'],
  '/serials': ['Seriallar & Epizodlar', 'Serial qismlari va epizodlarni boshqarish'],
  '/ai-publisher': ['AI Publisher', '1-Click AI Kino Post & Promo Generator'],
  '/requests': ["Kino So'rovlari", "Foydalanuvchilar so'ragan kinolar va holat"],
  '/broadcast': ['Broadcast Messenger', 'Tugmali reklama va xabarlar yuborish'],
  '/referrals': ['Referal & Konkurs', "Do'st taklif qilish va g'oliblar reytingi"],
  '/channels': ['Homiy Kanallar', 'Majburiy obuna va CPA rotatsiyasi'],
  '/downloader': ['Downloader Bot Studio', 'Video, audio va dumaloq video sozlamalari'],
  '/movie-bot': ['Kino Bot Studio', 'Kino bot va qidiruv sozlamalari'],
  '/adult-bot': ['18+ Adult Bot Studio', '18+ Adult bot va video sozlamalari'],
  '/settings': ['Tizim Sozlamalari', 'Parol, backup va PM2 botlarni boshqarish'],
};

export default function Layout({ children }) {
  const { theme, toggleTheme, logout } = useApp();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const loc = useLocation();

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await safe(movieApi.get('/requests'));
      if (alive && Array.isArray(data)) {
        setPending(data.filter((r) => r.status === 'pending').length);
      }
    };
    load();
    const t = setInterval(load, 25000);
    return () => { alive = false; clearInterval(t); };
  }, [loc.pathname]);

  const [title, sub] = TITLES[loc.pathname] || ['XIT FILM Media Studio', ''];
  const badges = { requests: pending };

  return (
    <div className="app-shell">
      {open && <div className="modal-overlay" style={{ zIndex: 45 }} onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ justifyContent: 'space-between' }}>
          <div className="flex gap" style={{ alignItems: 'center' }}>
            <div className="brand-logo"><Clapperboard size={20} color="#ffffff" /></div>
            <div className="brand-text">
              <h1>XIT FILM</h1>
              <span>Media Admin 2026</span>
            </div>
          </div>
          {open && (
            <button className="icon-btn" onClick={() => setOpen(false)} style={{ border: 'none', background: 'none' }}>
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            item.section ? (
              <div key={`s${i}`} className="nav-group-label">{item.section}</div>
            ) : (
              <div key={item.to} className="nav-item">
                <NavLink to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.badge && badges[item.badge] > 0 && <span className="badge-count">{badges[item.badge]}</span>}
                </NavLink>
              </div>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">SA</div>
          <div className="user-info">
            <div className="user-name">Super Admin</div>
            <div className="user-role">ID: 6263659922</div>
          </div>
          <button className="icon-btn" onClick={logout} title="Tizimdan chiqish">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="top-bar">
          <div className="flex gap" style={{ alignItems: 'center' }}>
            <button className="icon-btn mobile-menu-toggle" onClick={() => setOpen(!open)} style={{ marginRight: 10 }} title="Menyu">
              <Menu size={20} />
            </button>
            <div className="top-bar-title">
              <h2>{title}</h2>
              {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
            </div>
          </div>
          <div className="top-bar-actions">
            <div className="cinema-badge-pill" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 700 }}>
              <span>● 3 BOTS LIVE ONLINE</span>
            </div>
            <button className="icon-btn" onClick={toggleTheme} title="Mavzuni almashtirish">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-btn" onClick={logout} title="Chiqish">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}
