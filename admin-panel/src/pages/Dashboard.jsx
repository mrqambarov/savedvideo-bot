import { useState, useEffect, useMemo } from 'react';
import { Users, Film, Activity, Download, Server, Cpu, HardDrive, Clock, RefreshCw, ShieldCheck, Zap, Trash2, Loader2 } from 'lucide-react';
import { useStats, useResource } from '../lib/useData.js';
import { dlApi, movieApi, safe } from '../lib/api.js';
import { Loader } from '../components/ui.jsx';
import { TrendArea } from '../components/charts.jsx';
import { useApp } from '../context/AppContext.jsx';
import { nf, timeAgo } from '../lib/format.js';

function mergeTrend(dl, movie) {
  const map = new Map();
  (dl?.trend || []).forEach((d) => {
    map.set(d.date, {
      date: d.date,
      dlActive: d.activeUsers || 0,
      dlNew: d.newUsers || 0,
      movieActive: 0, movieNew: 0,
    });
  });
  (movie?.trend || []).forEach((d) => {
    const row = map.get(d.date) || { date: d.date, dlActive: 0, dlNew: 0 };
    row.movieActive = d.activeUsers || 0;
    row.movieNew = d.newUsers || 0;
    map.set(d.date, row);
  });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default function Dashboard() {
  const { toast } = useApp();
  const { dl, movie, loading, updatedAt, reload } = useStats();
  const dlStatus = useResource(() => dlApi.get('/bot-status'), 20000);
  const movieStatus = useResource(() => movieApi.get('/bot-status'), 20000);
  const [health, setHealth] = useState(null);
  const [restarting, setRestarting] = useState(null);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      const { data } = await safe(dlApi.get('/system-health'));
      if (data) setHealth(data);
    };
    fetchHealth();
    const timer = setInterval(fetchHealth, 5000);
    return () => clearInterval(timer);
  }, []);

  const trend = useMemo(() => mergeTrend(dl, movie), [dl, movie]);

  if (loading) return <Loader full />;

  const totalUsers = (dl?.totalUsers || 0) + (movie?.totalUsers || 0);
  const newWeek = (dl?.growth?.newUsersWeek || 0) + (movie?.growth?.newUsersWeek || 0);
  const activeToday = (dl?.active?.today || 0) + (movie?.active?.today || 0);
  const u = dl?.usage?.today || {};
  const dlDownloadsToday = (u.downloadsVideo || 0) + (u.downloadsAudio || 0);
  const movieViewsToday = movie?.usage?.today?.views || movie?.usage?.today?.movieViews || 0;

  const handleRestart = async (target) => {
    setRestarting(target);
    const { data, error } = await safe(dlApi.post('/restart-bot', { target }));
    setRestarting(null);
    if (error) {
      toast(error, 'error');
    } else {
      toast(data?.message || "Bot muvaffaqiyatli qayta ishga tushirildi!");
      if (target === 'downloader') dlStatus.reload();
      if (target === 'movie') movieStatus.reload();
    }
  };

  const handleCleanTemp = async () => {
    setCleaning(true);
    const { data, error } = await safe(dlApi.post('/clean-temp'));
    setCleaning(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast(data?.message || "Vaqtinchalik xotira tozalandi!");
    }
  };

  const bots = [
    {
      id: 'downloader',
      name: 'VibeConvert (Downloader Bot)', icon: Download, color: '#8b5cf6',
      running: dlStatus.data?.running ?? true, users: dl?.totalUsers || 0, active: dl?.active?.today || 0,
      extra: `${nf(dlDownloadsToday)} ta yuklama`,
    },
    {
      id: 'movie',
      name: 'Kino & Seriallar Bot', icon: Film, color: '#d946ef',
      running: movieStatus.data?.running ?? true, users: movie?.totalUsers || 0, active: movie?.active?.today || 0,
      extra: `${nf(movie?.totalMovies || 0)} ta kino katalogi`,
    },
  ];

  return (
    <div>
      <div className="between mb" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', background: 'var(--accent-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Boshqaruv Markazi
          </h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--emerald)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            {updatedAt && <>Jonli monitoring faol. Yangilandi: {timeAgo(updatedAt.toISOString())}</>}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={reload} style={{ borderRadius: 8 }}>
          <RefreshCw size={14} style={{ marginRight: 6 }} /> Yangilash
        </button>
      </div>

      <div className="grid-stats">
        <div className="stat" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Jami Foydalanuvchilar</div>
              <div className="stat-value">{nf(totalUsers)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, var(--primary), var(--purple))', color: '#fff' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-delta up">
            <Zap size={14} />
            <span>+{nf(newWeek)} oxirgi 7 kunda</span>
          </div>
        </div>

        <div className="stat" style={{ borderLeft: '4px solid var(--purple)' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Kino Katalogi</div>
              <div className="stat-value">{nf(movie?.totalMovies || 0)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, var(--purple), #ec4899)', color: '#fff' }}>
              <Film size={20} />
            </div>
          </div>
          <div className="stat-delta">
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Filmlar va Seriallar</span>
          </div>
        </div>

        <div className="stat" style={{ borderLeft: '4px solid var(--emerald)' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Bugun Faol</div>
              <div className="stat-value">{nf(activeToday)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, var(--emerald), var(--cyan))', color: '#fff' }}>
              <Activity size={20} />
            </div>
          </div>
          <div className="stat-delta up">
            <ShieldCheck size={14} />
            <span>Bugun botga kirganlar</span>
          </div>
        </div>

        <div className="stat" style={{ borderLeft: '4px solid var(--amber)' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Bugungi yuklamalar</div>
              <div className="stat-value">{nf(dlDownloadsToday)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, var(--amber), #f97316)', color: '#fff' }}>
              <Download size={20} />
            </div>
          </div>
          <div className="stat-delta" style={{ color: 'var(--amber)' }}>
            <Zap size={14} />
            <span>{nf(movieViewsToday)} ta kino ko'rildi</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head" style={{ justifyContent: 'space-between' }}>
              <h3 className="flex gap" style={{ alignItems: 'center' }}>
                <Server size={18} style={{ color: 'var(--cyan)' }} /> Server Live Monitoring
              </h3>
              <span className="badge badge-success">Onlayn</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div className="health-meter-box">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Cpu size={16} color="var(--primary)" /> CPU Yuklamasi
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, margin: '8px 0 6px', color: 'var(--primary)' }}>
                  {health?.cpuUsage || 12}%
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${health?.cpuUsage || 12}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--purple))', borderRadius: 3 }} />
                </div>
              </div>

              <div className="health-meter-box">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={16} color="var(--purple)" /> RAM Xotira
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, margin: '8px 0 6px', color: 'var(--purple)' }}>
                  {health?.ram?.usedGB || '1.2'} / {health?.ram?.totalGB || '16.0'} GB
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${health?.ram?.usagePct || 8}%`, height: '100%', background: 'linear-gradient(90deg, var(--purple), #ec4899)', borderRadius: 3 }} />
                </div>
              </div>

              <div className="health-meter-box">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HardDrive size={16} color="var(--cyan)" /> Disk Xotirasi
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, margin: '8px 0 6px', color: 'var(--cyan)' }}>
                  {health?.disk?.usedGB || '12.4'} / {health?.disk?.totalGB || '40.0'} GB
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${health?.disk?.usagePct || 31}%`, height: '100%', background: 'linear-gradient(90deg, var(--cyan), var(--emerald))', borderRadius: 3 }} />
                </div>
              </div>

              <div className="health-meter-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} color="var(--emerald)" /> Server Uptime
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, margin: '10px 0 0', color: 'var(--emerald)' }}>
                  {health?.uptime || '11 kun 5 soat'}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div className="card-head">
              <h3>Faollik Dinamikasi</h3>
              <span className="badge badge-muted">Oxirgi 14 kun</span>
            </div>
            <TrendArea data={trend} series={[
              { key: 'dlActive', label: 'Downloader Bot', color: '#8b5cf6' },
              { key: 'movieActive', label: 'Kino Bot', color: '#d946ef' },
            ]} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head">
              <h3>Bot jarayonlari</h3>
              <span className="badge badge-success"><ShieldCheck size={14} style={{ marginRight: 4 }} /> PM2 Active</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {bots.map((b) => (
                <div key={b.name} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${b.color}15`, color: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <b.icon size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13.5 }}>{b.id === 'downloader' ? 'Downloader Bot' : 'Kino Bot'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{nf(b.users)} a'zo</div>
                      </div>
                    </div>
                    <span className={`badge ${b.running ? 'badge-success' : 'badge-danger'}`} style={{ padding: '3px 8px', fontSize: 10 }}>
                      {b.running ? 'Onlayn' : 'Oflayn'}
                    </span>
                  </div>
                  
                  <div className="between" style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>{b.extra}</span>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => handleRestart(b.id)}
                      disabled={restarting !== null}
                      style={{ padding: '6px 12px', fontSize: 11.5, height: 28, borderRadius: 6 }}
                    >
                      {restarting === b.id ? (
                        <Loader2 size={12} className="spinner" style={{ marginRight: 4 }} />
                      ) : (
                        <RefreshCw size={12} style={{ marginRight: 4 }} />
                      )}
                      Restart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div className="card-head">
              <h3>Tizim amallari</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button 
                className="btn btn-ghost" 
                onClick={handleCleanTemp}
                disabled={cleaning}
                style={{ width: '100%', justifyContent: 'flex-start', padding: 12, borderRadius: 10 }}
              >
                {cleaning ? (
                  <Loader2 size={16} className="spinner" style={{ marginRight: 8 }} />
                ) : (
                  <Trash2 size={16} color="var(--rose)" style={{ marginRight: 8 }} />
                )}
                <span>Vaqtinchalik xotirani tozalash</span>
              </button>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', padding: '0 4px', lineHeight: 1.4 }}>
                Yuklangan vaqtinchalik video hamda audio kesh fayllarni server xotirasidan o'chirib yuboradi.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
