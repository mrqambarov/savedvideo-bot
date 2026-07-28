import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Film, Inbox, Megaphone, Radio,
  Download, Bot, Settings, Menu, Moon, Sun, LogOut, Sparkles, Gift, Users as UsersIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { movieApi, safe } from '../lib/api.js';

const NAV = [
  { section: 'Umumiy' },
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/analytics', label: 'Analitika', icon: BarChart3 },
  { to: '/users', label: 'Foydalanuvchilar', icon: UsersIcon },
  { section: 'Kino bot' },
  { to: '/movies', label: 'Kinolar', icon: Film },
  { to: '/requests', label: "So'rovlar", icon: Inbox, badge: 'requests' },
  { section: 'Boshqaruv' },
  { to: '/broadcast', label: 'Broadcast', icon: Megaphone },
  { to: '/referrals', label: 'Konkurs / Referal', icon: Gift },
  { to: '/channels', label: 'Homiy kanallar', icon: Radio },
  { section: 'Botlar' },
  { to: '/downloader', label: 'Downloader Bot', icon: Download },
  { to: '/movie-bot', label: 'Kino Bot', icon: Bot },
  { to: '/settings', label: 'Sozlamalar', icon: Settings },
];

const TITLES = {
  '/': ['Dashboard', 'Ikkala botning umumiy holati'],
  '/analytics': ['Analitika', "Foydalanuvchilar va faollik tahlili"],
  '/users': ['Foydalanuvchilar', "Bloklash va shaxsiy xabar yuborish"],
  '/movies': ['Kinolar', 'Kino katalogini boshqarish'],
  '/requests': ["So'rovlar", "Foydalanuvchi kino so'rovlari"],
  '/broadcast': ['Broadcast', 'Ommaviy xabar yuborish'],
  '/referrals': ['Konkurs / Referal', "Do'st taklif qilish reytingi va g'olib tanlash"],
  '/channels': ['Homiy kanallar', 'Majburiy obuna kanallari'],
  '/downloader': ['Downloader Bot', 'Video yuklovchi bot sozlamalari'],
  '/movie-bot': ['Kino Bot', 'Kino bot sozlamalari'],
  '/settings': ['Sozlamalar', 'Panel sozlamalari'],
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
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [loc.pathname]);

  const [title, sub] = TITLES[loc.pathname] || ['Boshqaruv Paneli', ''];
  const badges = { requests: pending };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="logo"><Sparkles size={20} /></div>
          <div>
            Admin Panel
            <small>VibeConvert · Kino</small>
          </div>
        </div>
        <nav className="nav-section">
          {NAV.map((item, i) =>
            item.section ? (
              <div key={`s${i}`} className="nav-label">{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.badge && badges[item.badge] > 0 && <span className="badge-count">{badges[item.badge]}</span>}
              </NavLink>
            )
          )}
        </nav>
      </aside>

      <div className={`backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setOpen((o) => !o)}><Menu size={20} /></button>
          <div>
            <h1>{title}</h1>
            {sub && <div className="topbar-sub">{sub}</div>}
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={toggleTheme} title="Mavzuni almashtirish">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-btn" onClick={logout} title="Chiqish"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
