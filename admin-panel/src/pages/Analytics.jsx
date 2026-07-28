import { useState, useMemo } from 'react';
import { Users, UserPlus, Activity, Video, Music, Search } from 'lucide-react';
import { useStats } from '../lib/useData.js';
import { StatCard, Loader, Segmented } from '../components/ui.jsx';
import { TrendArea, BarsChart } from '../components/charts.jsx';
import DataTable from '../components/DataTable.jsx';
import { nf, fmtDate, avatarColor, initials } from '../lib/format.js';

export default function Analytics() {
  const { dl, movie, loading } = useStats();
  const [period, setPeriod] = useState('week');
  const [bot, setBot] = useState('dl');

  const src = bot === 'dl' ? dl : movie;

  const users = useMemo(() => {
    const list = src?.usersList || [];
    return list.map((u) => ({
      id: u.id,
      username: u.username ? '@' + String(u.username).replace(/^@/, '') : '—',
      name: u.firstName || u.first_name || u.name || '',
      dateJoined: u.dateJoined || u.joinedAt || '',
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
            <div className="cell-title">{r.username}</div>
            <div className="cell-sub mono">{r.id}</div>
          </div>
        </div>
      ),
    },
    { key: 'dateJoined', label: "Qo'shilgan sana", sortable: true, render: (r) => fmtDate(r.dateJoined) },
  ];

  return (
    <div>
      <div className="between wrap gap" style={{ marginBottom: 18 }}>
        <Segmented options={[{ value: 'dl', label: 'Downloader' }, { value: 'movie', label: 'Kino bot' }]} value={bot} onChange={setBot} />
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

      <div className="card mt">
        <div className="card-head">
          <h3>Foydalanuvchilar o'sishi va faolligi</h3>
          <span className="sub">so'nggi 14 kun</span>
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
            <h3>Kunlik yuklamalar</h3>
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
