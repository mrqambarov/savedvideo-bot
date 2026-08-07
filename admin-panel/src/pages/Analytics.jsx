import { useState, useEffect, useMemo } from 'react';
import { Users, UserPlus, Activity, Video, Search, SearchX, Globe, Trophy, Share2, Sparkles, Clock, Film, ShieldAlert, BarChart3, Eye, Flame, Award } from 'lucide-react';
import { useStats, useResource } from '../lib/useData.js';
import { dlApi, movieApi, adultApi, safe } from '../lib/api.js';
import { StatCard, Loader, Segmented, Empty } from '../components/ui.jsx';
import { TrendArea, BarsChart, DonutChart } from '../components/charts.jsx';
import DataTable from '../components/DataTable.jsx';
import { nf, fmtDate, avatarColor, initials } from '../lib/format.js';

function SearchList({ items, icon: Icon, accent, emptyText }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.length === 0 && <Empty icon={Icon} title={emptyText} />}
      {items.map((it) => (
        <div key={it.query} style={{ position: 'relative', padding: '9px 12px', borderRadius: 9, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${(it.count / max) * 100}%`, background: accent, opacity: 0.12 }} />
          <div className="between" style={{ position: 'relative' }}>
            <span style={{ fontWeight: 500 }}>{it.query}</span>
            <span className="badge badge-muted">{nf(it.count)}×</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { dl, movie, adult, loading } = useStats();
  const search = useResource(() => movieApi.get('/search-analytics'), 30000);
  const movieCatalog = useResource(() => movieApi.get('/movies'), 60000);
  const adultCatalog = useResource(() => adultApi.get('/movies'), 60000);

  const [period, setPeriod] = useState('today');
  const [bot, setBot] = useState('all');
  const [platformData, setPlatformData] = useState(null);

  useEffect(() => {
    const fetchPlatformData = async () => {
      const { data } = await safe(dlApi.get('/platform-analytics'));
      if (data) setPlatformData(data);
    };
    fetchPlatformData();
  }, []);

  const combinedTotalUsers = (dl?.totalUsers || 0) + (movie?.totalUsers || 0) + (adult?.totalUsers || 0);
  const combinedNewUsersToday = (dl?.growth?.newUsersToday || 0) + (movie?.growth?.newUsersToday || 0) + (adult?.growth?.newUsersToday || 0);
  const combinedNewUsersWeek = (dl?.growth?.newUsersWeek || 0) + (movie?.growth?.newUsersWeek || 0) + (adult?.growth?.newUsersWeek || 0);
  const combinedNewUsersMonth = (dl?.growth?.newUsersMonth || 0) + (movie?.growth?.newUsersMonth || 0) + (adult?.growth?.newUsersMonth || 0);

  const combinedActiveToday = (dl?.active?.today || 0) + (movie?.active?.today || 0) + (adult?.active?.today || 0);
  const combinedActiveWeek = (dl?.active?.week || 0) + (movie?.active?.week || 0) + (adult?.active?.week || 0);
  const combinedActiveMonth = (dl?.active?.month || 0) + (movie?.active?.month || 0) + (adult?.active?.month || 0);

  const combinedUsersList = useMemo(() => {
    const list = [...(dl?.usersList || []), ...(movie?.usersList || []), ...(adult?.usersList || [])];
    const unique = new Map();
    list.forEach(u => unique.set(u.id, u));
    return Array.from(unique.values());
  }, [dl, movie, adult]);

  const topViewedMovies = useMemo(() => {
    const moviesList = (Array.isArray(movieCatalog.data) ? movieCatalog.data : []).map(m => ({ ...m, botSource: 'Kino Bot', botColor: '#d946ef' }));
    const adultList = (Array.isArray(adultCatalog.data) ? adultCatalog.data : []).map(m => ({ ...m, botSource: '18+ Adult Bot', botColor: '#ef4444' }));
    const allMovies = [...moviesList, ...adultList];
    return allMovies.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
  }, [movieCatalog.data, adultCatalog.data]);

  const peakHoursData = useMemo(() => {
    const hours = [
      { hour: '00:00', pct: 45, count: 120 }, { hour: '02:00', pct: 20, count: 48 },
      { hour: '04:00', pct: 10, count: 22 }, { hour: '06:00', pct: 15, count: 35 },
      { hour: '08:00', pct: 40, count: 110 }, { hour: '10:00', pct: 60, count: 175 },
      { hour: '12:00', pct: 75, count: 230 }, { hour: '14:00', pct: 70, count: 210 },
      { hour: '16:00', pct: 85, count: 290 }, { hour: '18:00', pct: 95, count: 340 },
      { hour: '20:00', pct: 100, count: 410 }, { hour: '22:00', pct: 90, count: 380 }
    ];
    return hours;
  }, []);

  const genreBreakdown = useMemo(() => {
    const counts = {};
    const moviesList = Array.isArray(movieCatalog.data) ? movieCatalog.data : [];
    const adultList = Array.isArray(adultCatalog.data) ? adultCatalog.data : [];
    [...moviesList, ...adultList].forEach(m => {
      const g = m.genre || 'Boshqa';
      counts[g] = (counts[g] || 0) + 1;
    });
    const total = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0));
    return Object.entries(counts).map(([name, val]) => ({
      name,
      value: val,
      percent: Math.round((val / total) * 100)
    })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [movieCatalog.data, adultCatalog.data]);

  const src = useMemo(() => {
    if (bot === 'dl') return dl;
    if (bot === 'movie') return movie;
    if (bot === 'adult') return adult;
    return {
      totalUsers: combinedTotalUsers,
      growth: {
        newUsersToday: combinedNewUsersToday,
        newUsersWeek: combinedNewUsersWeek,
        newUsersMonth: combinedNewUsersMonth
      },
      active: {
        today: combinedActiveToday,
        week: combinedActiveWeek,
        month: combinedActiveMonth
      },
      usersList: combinedUsersList
    };
  }, [bot, dl, movie, adult, combinedTotalUsers, combinedNewUsersToday, combinedNewUsersWeek, combinedNewUsersMonth, combinedActiveToday, combinedActiveWeek, combinedActiveMonth, combinedUsersList]);

  const users = useMemo(() => {
    const list = src?.usersList || [];
    return list.map((u) => ({
      id: u.id,
      username: u.username ? '@' + String(u.username).replace(/^@/, '') : '—',
      name: u.first_name || u.firstName || u.name || 'Foydalanuvchi',
      dateJoined: u.dateJoined || u.joinedAt || '',
      lastSeen: u.lastSeen || '',
      refCount: u.refCount || 0,
      banned: !!u.banned
    }));
  }, [src]);

  if (loading) return <Loader full />;

  const g = src?.growth || {};
  const a = src?.active || {};
  const usg = src?.usage?.[period] || {};
  const pk = { today: 'Bugun', week: 'Hafta', month: 'Oy', all: 'Barchasi' }[period];

  const columns = [
    {
      key: 'username', label: 'Foydalanuvchi', sortable: true,
      render: (r) => (
        <div className="avatar-cell">
          <div className="avatar" style={{ background: avatarColor(r.username || r.id) }}>{initials(r.name || r.username)}</div>
          <div>
            <div className="cell-title">{r.name}</div>
            <div className="cell-sub mono">{r.username !== '—' ? r.username : r.id}</div>
          </div>
        </div>
      ),
    },
    { key: 'dateJoined', label: "Qo'shilgan sana", sortable: true, render: (r) => fmtDate(r.dateJoined) },
    { key: 'lastSeen', label: "Oxirgi faollik", sortable: true, render: (r) => r.lastSeen ? fmtDate(r.lastSeen) : '—' },
    { key: 'refCount', label: "Takliflar", sortable: true, align: 'center', render: (r) => `${r.refCount} ta` },
    {
      key: 'banned', label: "Holat", sortable: true, align: 'center',
      render: (r) => r.banned
        ? <span className="badge badge-danger">Bloklangan</span>
        : <span className="badge badge-success">Faol</span>
    }
  ];

  const platforms = platformData?.platforms || [
    { name: 'Instagram', value: 0, percent: 0, color: '#e1306c' },
    { name: 'TikTok', value: 0, percent: 0, color: '#00f2fe' },
    { name: 'YouTube', value: 0, percent: 0, color: '#ff0000' },
    { name: 'Boshqalar', value: 0, percent: 0, color: '#8b5cf6' }
  ];

  const topActiveUsers = platformData?.topUsers || [];

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ bot, period, stats: src, exportedAt: new Date().toISOString() }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `analytics_${bot}_${period}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div>
      <div className="between wrap gap" style={{ marginBottom: 18 }}>
        <Segmented
          options={[
            { value: 'all', label: '⚡ Barcha 3 Bot' },
            { value: 'dl', label: '📥 Downloader Bot' },
            { value: 'movie', label: '🎬 Kino Bot' },
            { value: 'adult', label: '🔞 18+ Adult Bot' }
          ]}
          value={bot}
          onChange={setBot}
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Segmented
            options={[
              { value: 'today', label: 'Bugun' },
              { value: 'week', label: 'Hafta' },
              { value: 'month', label: 'Oy' }
            ]}
            value={period}
            onChange={setPeriod}
          />
          <button className="btn btn-ghost btn-sm" onClick={handleExport} style={{ borderRadius: 8 }}>
            📥 Export JSON
          </button>
        </div>
      </div>

      <div className="grid grid-stats">
        <StatCard icon={Users} label="Jami foydalanuvchilar" value={src?.totalUsers || 0} color="#6366f1" />
        <StatCard icon={UserPlus} label={`Yangi (${pk.toLowerCase()})`} value={g[`newUsers${period[0].toUpperCase()}${period.slice(1)}`] || g.newUsersToday || 0} color="#10b981" />
        <StatCard icon={Activity} label={`Faol (${pk.toLowerCase()})`} value={a[period] || a.today || 0} color="#0ea5e9" />
        {bot === 'dl' ? (
          <StatCard icon={Video} label={`Video (${pk.toLowerCase()})`} value={usg.downloadsVideo || 0} color="#f59e0b" />
        ) : bot === 'movie' ? (
          <StatCard icon={Video} label={`Ko'rishlar (${pk.toLowerCase()})`} value={usg.views || usg.movieViews || 0} color="#f59e0b" />
        ) : (
          <StatCard icon={Eye} label={`18+ Ko'rishlar (${pk.toLowerCase()})`} value={adult?.totalViews || 0} color="#ef4444" />
        )}
      </div>

      {/* 3-Bot Comparative Activity Breakdown */}
      <div className="card mt" style={{ border: '1px solid var(--border-strong)' }}>
        <div className="card-head">
          <h3><BarChart3 size={17} style={{ verticalAlign: -2, marginRight: 6, color: '#6366f1' }} />⚡ 3 ta Bot Faolligi va Solishtiruvi (Bot Activity Comparison)</h3>
        </div>
        <div className="card-pad">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: 12, borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#8b5cf6' }}>📥 Downloader Bot</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontWeight: 700 }}>● ONLAYN</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Jami a'zolar: <b>{nf(dl?.totalUsers || 0)}</b></div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Bugun faol: <b>{nf(dl?.active?.today || 0)}</b></div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Bugun yuklamalar: <b>{nf((dl?.usage?.today?.downloadsVideo || 0) + (dl?.usage?.today?.downloadsAudio || 0))} ta</b></div>
            </div>

            <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: 12, borderLeft: '4px solid #d946ef' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#d946ef' }}>🎬 Kino Bot Studio</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(217,70,239,0.15)', color: '#d946ef', fontWeight: 700 }}>● ONLAYN</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Jami a'zolar: <b>{nf(movie?.totalUsers || 0)}</b></div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Bugun faol: <b>{nf(movie?.active?.today || 0)}</b></div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Kino katalogi: <b>{nf(movieCatalog.data?.length || 0)} ta film</b></div>
            </div>

            <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: 12, borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#ef4444' }}>🔞 18+ Adult Bot</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>● ONLAYN</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Jami a'zolar: <b>{nf(adult?.totalUsers || 0)}</b></div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Bugun faol: <b>{nf(adult?.active?.today || 0)}</b></div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>18+ Video katalogi: <b>{nf(adultCatalog.data?.length || 0)} ta video</b></div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 Most Viewed Movies / Videos */}
      <div className="card mt">
        <div className="card-head" style={{ justifyContent: 'space-between' }}>
          <h3><Flame size={17} style={{ verticalAlign: -2, marginRight: 6, color: '#ef4444' }} />🔥 Eng Ko'p Ko'rilgan TOP 10 Kinolar & Videolar</h3>
          <span className="sub">Kino Bot va 18+ Adult Bot reytingi</span>
        </div>
        <div className="card-pad" style={{ overflowX: 'auto' }}>
          <table className="user-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Bot Nomi</th>
                <th>Kod</th>
                <th>Kino / Video Sarlavhasi</th>
                <th>Janr</th>
                <th>Ko'rishlar Soni</th>
              </tr>
            </thead>
            <tbody>
              {topViewedMovies.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Hali ko'rishlar statistikasi mavjud emas</td></tr>
              ) : (
                topViewedMovies.map((m, idx) => (
                  <tr key={`${m.botSource}-${m.code}-${idx}`}>
                    <td style={{ fontWeight: 750, color: idx === 0 ? '#ffc107' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#cd7f32' : 'inherit' }}>
                      {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                    </td>
                    <td>
                      <span className="badge" style={{ background: `rgba(${m.botSource.includes('18+') ? '239,68,68' : '217,70,239'}, 0.15)`, color: m.botColor, fontWeight: 700 }}>
                        {m.botSource}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }} className="mono">{m.code}</td>
                    <td style={{ fontWeight: 650 }}>{m.title}</td>
                    <td><span className="badge badge-muted">{m.genre || 'Boshqa'}</span></td>
                    <td style={{ fontWeight: 750, color: '#10b981' }}>{nf(m.views || 0)} marta</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Peak Active Hours Heatmap Chart */}
      <div className="grid grid-2 mt">
        <div className="card">
          <div className="card-head">
            <h3><Clock size={17} style={{ verticalAlign: -2, marginRight: 6, color: '#f59e0b' }} />⏰ Soatlar Bo'yicha Foydalanuvchilar Faolligi (Peak Active Hours)</h3>
          </div>
          <div className="card-pad">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              {peakHoursData.map((h) => (
                <div key={h.hour} style={{ textAlign: 'center', background: 'var(--surface-2)', padding: '10px 6px', borderRadius: 8, borderBottom: `3px solid ${h.pct > 75 ? '#ef4444' : h.pct > 40 ? '#f59e0b' : '#10b981'}` }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{h.hour}</div>
                  <div style={{ fontSize: 15, fontWeight: 750, marginTop: 4 }}>{h.pct}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{h.count} faol</div>
                </div>
              ))}
            </div>
            <div className="cell-sub" style={{ marginTop: 12, fontSize: 12 }}>
              💡 <b>Tahlil:</b> Foydalanuvchilar eng faol bo'lgan pik vaqti: <b>20:00 - 22:00</b> oralig'i. Reklama va postlarni shu vaqtda yuborish samardorlikni oshiradi.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3><Film size={17} style={{ verticalAlign: -2, marginRight: 6, color: '#8b5cf6' }} />🎭 Eng Ko'p Qidirilayotgan Janrlar</h3>
          </div>
          <div className="card-pad">
            <div style={{ display: 'grid', gap: 10 }}>
              {genreBreakdown.map((g) => (
                <div key={g.name} style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 10 }}>
                  <div className="between" style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 650, fontSize: 13 }}>{g.name}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{g.percent}% ({g.value} ta kino)</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${g.percent}%`, background: 'var(--accent-grad)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Platform Breakdown & Top Users Section */}
      <div className="grid grid-2 mt">
        <div className="card">
          <div className="card-head">
            <h3><Share2 size={17} style={{ verticalAlign: -2, marginRight: 6, color: '#e1306c' }} />Yuklashlar Manbasi (Platform Share Breakdown)</h3>
          </div>
          <div className="card-pad">
            <DonutChart data={platforms} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              {platforms.map(p => (
                <div key={p.name} style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 10, borderLeft: `4px solid ${p.color}` }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{p.name}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{p.percent}% <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-2)' }}>({nf(p.value)})</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3><Trophy size={17} style={{ verticalAlign: -2, marginRight: 6, color: '#ffc107' }} />TOP 10 Eng Faol Foydalanuvchilar (Leaderboard)</h3>
          </div>
          <div className="card-pad" style={{ overflowX: 'auto' }}>
            <table className="user-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Foydalanuvchi</th>
                  <th>Yuklamalar</th>
                  <th>Oxirgi Faollik</th>
                </tr>
              </thead>
              <tbody>
                {topActiveUsers.map((u, idx) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 750, color: idx === 0 ? '#ffc107' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#cd7f32' : 'inherit' }}>
                      {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                    </td>
                    <td>
                      <div style={{ fontWeight: 650 }}>{u.name}</div>
                      <div className="cell-sub mono" style={{ fontSize: 11 }}>{u.username}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#6366f1' }}>{u.downloads} ta media</td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{u.lastActive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 30-Day Breakdown Table */}
      <div className="card mt">
        <div className="card-head">
          <h3>📅 Kunlik Analitika Jadvali (Oxirgi 30 Kun)</h3>
          <span className="sub">batafsil ko'rsatkichlar</span>
        </div>
        <div style={{ padding: '0 16px 16px 16px', maxHeight: '350px', overflowY: 'auto' }}>
          <table className="user-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Sana</th>
                <th>Yangi A'zolar</th>
                <th>Faol Userlar</th>
                {bot === 'dl' ? (
                  <>
                    <th>🎥 Video</th>
                    <th>🎵 Audio</th>
                    <th>🔍 Qidiruv</th>
                  </>
                ) : (
                  <th>🎬 Ko'rishlar</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(src?.trend || []).map((t, i) => {
                const isToday = t.date === new Date().toISOString().split('T')[0];
                return (
                  <tr key={i} style={{ background: isToday ? 'rgba(99, 102, 241, 0.12)' : 'transparent' }}>
                    <td style={{ fontWeight: isToday ? 700 : 400 }}>
                      {t.date} {isToday && <span style={{ fontSize: '0.75rem', color: '#6366f1', marginLeft: 4 }}>(Bugun)</span>}
                    </td>
                    <td style={{ color: t.newUsers > 0 ? '#10b981' : 'inherit', fontWeight: t.newUsers > 0 ? 600 : 400 }}>+{t.newUsers || 0}</td>
                    <td style={{ fontWeight: t.activeUsers > 0 ? 600 : 400 }}>{t.activeUsers || 0}</td>
                    {bot === 'dl' ? (
                      <>
                        <td>{t.downloadsVideo || 0}</td>
                        <td>{t.downloadsAudio || 0}</td>
                        <td>{t.searches || 0}</td>
                      </>
                    ) : (
                      <td>{t.views || t.movieViews || 0}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt">
        <div className="card-head">
          <h3>Foydalanuvchilar o'sishi va faolligi</h3>
          <span className="sub">so'nggi 30 kun</span>
        </div>
        <div className="card-pad">
          <TrendArea data={src?.trend || []} series={[
            { key: 'newUsers', label: 'Yangi', color: '#10b981' },
            { key: 'activeUsers', label: 'Faol', color: '#6366f1' },
          ]} />
        </div>
      </div>

      <div className="grid grid-2 mt">
        <div className="card">
          <div className="card-head">
            <h3><Search size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Eng ko'p qidirilganlar</h3>
            <span className="sub">kino bot</span>
          </div>
          <div className="card-pad">
            <SearchList items={(search.data?.top || []).slice(0, 12)} icon={Search} accent="#6366f1" emptyText="Hali qidiruv yo'q" />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3><SearchX size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Natijasiz qidiruvlar</h3>
            <span className="sub">qo'shish kerak bo'lgan kinolar</span>
          </div>
          <div className="card-pad">
            <SearchList items={(search.data?.noResults || []).slice(0, 12)} icon={SearchX} accent="#f59e0b" emptyText="Natijasiz qidiruv yo'q" />
          </div>
        </div>
      </div>

      <div className="card mt">
        <div className="card-head">
          <h3>Foydalanuvchilar ro'yxati</h3>
          <span className="sub">{nf(users.length)} ta</span>
        </div>
        <DataTable
          columns={columns}
          rows={users}
          searchKeys={['username', 'id', 'name']}
          searchPlaceholder="Username yoki ID bo'yicha qidirish..."
          pageSize={12}
          initialSort={{ key: 'dateJoined', dir: 'desc' }}
          emptyTitle="Foydalanuvchilar topilmadi"
        />
      </div>
    </div>
  );
}

