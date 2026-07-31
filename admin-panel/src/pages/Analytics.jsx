import { useState, useEffect, useMemo } from 'react';
import { Users, UserPlus, Activity, Video, Search, SearchX, Globe, Trophy, Share2, Sparkles } from 'lucide-react';
import { useStats, useResource } from '../lib/useData.js';
import { dlApi, movieApi, safe } from '../lib/api.js';
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
  const { dl, movie, loading } = useStats();
  const search = useResource(() => movieApi.get('/search-analytics'), 30000);
  const [period, setPeriod] = useState('today');
  const [bot, setBot] = useState('dl');
  const [platformData, setPlatformData] = useState(null);

  useEffect(() => {
    const fetchPlatformData = async () => {
      const { data } = await safe(dlApi.get('/platform-analytics'));
      if (data) setPlatformData(data);
    };
    fetchPlatformData();
  }, []);

  const src = bot === 'dl' ? dl : movie;

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
  const pk = { today: 'Bugun', week: 'Hafta', month: 'Oy' }[period];

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

  return (
    <div>
      <div className="between wrap gap" style={{ marginBottom: 18 }}>
        <Segmented options={[{ value: 'dl', label: 'Downloader Bot' }, { value: 'movie', label: 'Kino Bot' }]} value={bot} onChange={setBot} />
        <Segmented options={[{ value: 'today', label: 'Bugun' }, { value: 'week', label: 'Hafta' }, { value: 'month', label: 'Oy' }]} value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-stats">
        <StatCard icon={Users} label="Jami foydalanuvchilar" value={src?.totalUsers || 0} color="#6366f1" />
        <StatCard icon={UserPlus} label={`Yangi (${pk.toLowerCase()})`} value={g[`newUsers${period[0].toUpperCase()}${period.slice(1)}`] || 0} color="#10b981" />
        <StatCard icon={Activity} label={`Faol (${pk.toLowerCase()})`} value={a[period] || 0} color="#0ea5e9" />
        {bot === 'dl' ? (
          <StatCard icon={Video} label={`Video (${pk.toLowerCase()})`} value={usg.downloadsVideo || 0} color="#f59e0b" />
        ) : (
          <StatCard icon={Video} label={`Ko'rishlar (${pk.toLowerCase()})`} value={usg.views || usg.movieViews || 0} color="#f59e0b" />
        )}
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

      {bot === 'dl' && (
        <div className="card mt">
          <div className="card-head">
            <h3>Kunlik yuklamalar grafigi</h3>
            <span className="sub">video / audio / qidiruv</span>
          </div>
          <div className="card-pad">
            <BarsChart data={dl?.trend || []} series={[
              { key: 'downloadsVideo', label: 'Video', color: '#6366f1' },
              { key: 'downloadsAudio', label: 'Audio', color: '#8b5cf6' },
              { key: 'searches', label: 'Qidiruv', color: '#0ea5e9' },
            ]} />
          </div>
        </div>
      )}

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
