import { useMemo, useState } from 'react';
import { Gift, Users, CheckCircle2, Clock, Trophy, Dices, Crown, Sparkles } from 'lucide-react';
import { dlApi, movieApi } from '../lib/api.js';
import { useResource } from '../lib/useData.js';
import { StatCard, Loader, Segmented, Modal } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';
import { nf, avatarColor, initials } from '../lib/format.js';

export default function Referrals() {
  const [bot, setBot] = useState('movie');
  const api = bot === 'dl' ? dlApi : movieApi;
  const { data, loading } = useResource(() => api.get('/referrals'), 30000, [bot]);
  const [winner, setWinner] = useState(null);
  const [rolling, setRolling] = useState(false);

  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list.map((u, i) => ({
      ...u,
      rank: i + 1,
      name: u.username ? '@' + String(u.username).replace(/^@/, '') : (u.first_name || 'Foydalanuvchi'),
    }));
  }, [data]);

  const totals = useMemo(() => ({
    referrers: rows.length,
    qualified: rows.reduce((s, u) => s + (u.refCount || 0), 0),
    pending: rows.reduce((s, u) => s + (u.refPending || 0), 0),
  }), [rows]);

  const pickWinner = () => {
    const pool = rows.filter((u) => (u.refCount || 0) > 0);
    if (pool.length === 0) return;
    setRolling(true);
    setWinner(null);
    let ticks = 0;
    const timer = setInterval(() => {
      setWinner(pool[Math.floor(Math.random() * pool.length)]);
      ticks++;
      if (ticks > 14) {
        clearInterval(timer);
        setWinner(pool[Math.floor(Math.random() * pool.length)]);
        setRolling(false);
      }
    }, 90);
  };

  const columns = [
    {
      key: 'rank', label: '#', width: 60, sortable: true, align: 'center',
      render: (u) => {
        const medal = ['🥇', '🥈', '🥉'][u.rank - 1];
        return medal ? <span style={{ fontSize: 18 }}>{medal}</span> : <span className="muted">{u.rank}</span>;
      },
    },
    {
      key: 'name', label: 'Foydalanuvchi', sortable: true,
      render: (u) => (
        <div className="avatar-cell">
          <div className="avatar" style={{ background: avatarColor(u.username || u.id) }}>{initials(u.name)}</div>
          <div>
            <div className="cell-title">{u.name}</div>
            <div className="cell-sub mono">{u.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'refCount', label: 'Muvaffaqiyatli', sortable: true, align: 'center',
      render: (u) => <span className="badge badge-success"><CheckCircle2 size={12} /> {nf(u.refCount || 0)}</span>,
    },
    {
      key: 'refPending', label: 'Kutilmoqda', sortable: true, align: 'center',
      render: (u) => <span className="badge badge-warning"><Clock size={12} /> {nf(u.refPending || 0)}</span>,
    },
  ];

  if (loading) return <Loader full />;

  return (
    <div>
      <div className="between wrap gap" style={{ marginBottom: 18 }}>
        <Segmented options={[{ value: 'movie', label: 'Kino bot' }, { value: 'dl', label: 'Downloader' }]} value={bot} onChange={setBot} />
        <button className="btn btn-primary" onClick={pickWinner} disabled={totals.qualified === 0}>
          <Dices size={16} /> Tasodifiy g'olibni tanlash
        </button>
      </div>

      <div className="grid grid-stats">
        <StatCard icon={Users} label="Taklif qiluvchilar" value={totals.referrers} color="#6366f1" deltaLabel="jami ishtirokchi" />
        <StatCard icon={CheckCircle2} label="Muvaffaqiyatli takliflar" value={totals.qualified} color="#10b981" deltaLabel="tasdiqlangan" />
        <StatCard icon={Clock} label="Kutilayotgan takliflar" value={totals.pending} color="#f59e0b" deltaLabel="hali amal qilmagan" />
      </div>

      <div className="card mt">
        <div className="card-head">
          <h3><Trophy size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Reyting jadvali</h3>
          <span className="sub">eng ko'p taklif qilganlar</span>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={['name', 'id']}
          searchPlaceholder="Foydalanuvchi bo'yicha qidirish..."
          pageSize={12}
          emptyTitle="Hali taklif yo'q"
          emptyText="Foydalanuvchilar do'stlarini taklif qila boshlaganda bu yerda ko'rinadi"
        />
      </div>

      <Modal open={!!winner || rolling} title={rolling ? "G'olib tanlanmoqda..." : "🎉 G'olib!"} onClose={() => { if (!rolling) setWinner(null); }}>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          {rolling ? (
            <Dices size={48} style={{ color: 'var(--accent)', animation: 'spin 0.5s linear infinite' }} />
          ) : (
            <div style={{ position: 'relative' }}>
              <Crown size={40} style={{ color: '#f59e0b', marginBottom: 10 }} />
              <Sparkles size={18} style={{ color: 'var(--accent)', position: 'absolute', top: 0, right: '30%' }} />
            </div>
          )}
          {winner && (
            <>
              <div className="avatar" style={{ width: 64, height: 64, fontSize: 22, margin: '14px auto', background: avatarColor(winner.username || winner.id) }}>{initials(winner.name)}</div>
              <div style={{ fontSize: 20, fontWeight: 750 }}>{winner.name}</div>
              <div className="mono muted" style={{ marginTop: 4 }}>{winner.id}</div>
              <div className="flex gap" style={{ justifyContent: 'center', marginTop: 14 }}>
                <span className="badge badge-success"><CheckCircle2 size={12} /> {nf(winner.refCount || 0)} taklif</span>
              </div>
            </>
          )}
        </div>
        {!rolling && (
          <div className="flex gap" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={pickWinner}><Dices size={16} /> Qayta tanlash</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
