import { useMemo } from 'react';
import { Users, Film, Activity, Download, Video, Music, Search, Bot, RefreshCw } from 'lucide-react';
import { useStats, useResource } from '../lib/useData.js';
import { dlApi, movieApi } from '../lib/api.js';
import { StatCard, Loader } from '../components/ui.jsx';
import { TrendArea, BarsChart, DonutChart } from '../components/charts.jsx';
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
  const { dl, movie, loading, updatedAt, reload } = useStats();
  const dlStatus = useResource(() => dlApi.get('/bot-status'), 25000);
  const movieStatus = useResource(() => movieApi.get('/bot-status'), 25000);

  const trend = useMemo(() => mergeTrend(dl, movie), [dl, movie]);

  if (loading) return <Loader full />;

  const totalUsers = (dl?.totalUsers || 0) + (movie?.totalUsers || 0);
  const newWeek = (dl?.growth?.newUsersWeek || 0) + (movie?.growth?.newUsersWeek || 0);
  const activeToday = (dl?.active?.today || 0) + (movie?.active?.today || 0);
  const u = dl?.usage?.today || {};
  const dlDownloadsToday = (u.downloadsVideo || 0) + (u.downloadsAudio || 0);
  const movieViewsToday = movie?.usage?.today?.views || movie?.usage?.today?.movieViews || 0;

  const usageDonut = [
    { name: 'Video', value: dl?.usage?.month?.downloadsVideo || 0, color: '#6366f1' },
    { name: 'Audio', value: dl?.usage?.month?.downloadsAudio || 0, color: '#8b5cf6' },
    { name: 'Qidiruv', value: dl?.usage?.month?.searches || 0, color: '#0ea5e9' },
  ];

  const bots = [
    {
      name: 'VibeConvert (Downloader)', icon: Download, color: '#6366f1',
      running: dlStatus.data?.running, users: dl?.totalUsers, active: dl?.active?.today,
      extra: `${nf(dlDownloadsToday)} yuklama bugun`,
    },
    {
      name: 'Kino Bot', icon: Film, color: '#8b5cf6',
      running: movieStatus.data?.running, users: movie?.totalUsers, active: movie?.active?.today,
      extra: `${nf(movie?.totalMovies || 0)} ta kino`,
    },
  ];

  return (
    <div>
      <div className="between" style={{ marginBottom: 18 }}>
        <div className="muted" style={{ fontSize: 13 }}>
          {updatedAt && <>Yangilandi: {timeAgo(updatedAt.toISOString())}</>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={reload}><RefreshCw size={15} /> Yangilash</button>
      </div>

      <div className="grid grid-stats">
        <StatCard icon={Users} label="Jami foydalanuvchilar" value={totalUsers} color="#6366f1"
          delta={newWeek} deltaLabel="oxirgi 7 kunda" />
        <StatCard icon={Film} label="Kinolar katalogi" value={movie?.totalMovies || 0} color="#8b5cf6"
          deltaLabel="jami filmlar" />
        <StatCard icon={Activity} label="Bugun faol" value={activeToday} color="#10b981"
          deltaLabel="ikki bot bo'yicha" />
        <StatCard icon={Download} label="Bugungi yuklamalar" value={dlDownloadsToday} color="#f59e0b"
          deltaLabel={`${nf(movieViewsToday)} kino ko'rildi`} />
      </div>

      <div className="grid grid-2 mt">
        <div className="card" style={{ gridColumn: 'span 1' }}>
          <div className="card-head">
            <h3>Faollik dinamikasi</h3>
            <span className="sub">so'nggi 14 kun</span>
          </div>
          <div className="card-pad">
            <TrendArea data={trend} series={[
              { key: 'dlActive', label: 'Downloader faol', color: '#6366f1' },
              { key: 'movieActive', label: 'Kino faol', color: '#8b5cf6' },
            ]} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Yangi foydalanuvchilar</h3>
            <span className="sub">so'nggi 14 kun</span>
          </div>
          <div className="card-pad">
            <BarsChart data={trend} series={[
              { key: 'dlNew', label: 'Downloader', color: '#6366f1', stack: 'a' },
              { key: 'movieNew', label: 'Kino', color: '#8b5cf6', stack: 'a' },
            ]} />
          </div>
        </div>
      </div>

      <div className="grid grid-2 mt">
        <div className="card">
          <div className="card-head"><h3>Botlar holati</h3></div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {bots.map((b) => (
              <div key={b.name} className="between" style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 12 }}>
                <div className="flex gap" style={{ alignItems: 'center' }}>
                  <div className="stat-ico" style={{ width: 42, height: 42, background: `linear-gradient(135deg, ${b.color}, ${b.color}bb)` }}>
                    <b.icon size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 650 }}>{b.name}</div>
                    <div className="cell-sub">{nf(b.users || 0)} foydalanuvchi · {b.extra}</div>
                  </div>
                </div>
                <span className={`badge ${b.running ? 'badge-success' : 'badge-danger'}`}>
                  <span className={`dot ${b.running ? 'live' : 'off'}`} />
                  {b.running ? 'Onlayn' : 'Oflayn'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Yuklamalar taqsimoti</h3>
            <span className="sub">oxirgi 30 kun</span>
          </div>
          <div className="card-pad">
            {usageDonut.some((d) => d.value > 0)
              ? <DonutChart data={usageDonut} />
              : <div className="empty"><Search size={36} /><h4>Hozircha ma'lumot yo'q</h4></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
