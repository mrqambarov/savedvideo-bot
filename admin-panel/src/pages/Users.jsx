import { useState, useEffect, useMemo, useCallback } from 'react';
import { Ban, ShieldCheck, Send, MessageSquare, Users as UsersIcon, UserPlus, Activity, ShieldAlert, Film, Download } from 'lucide-react';
import { dlApi, movieApi, adultApi, safe } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader, Segmented, Modal, StatCard } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';
import { nf, fmtDateTime, avatarColor, initials } from '../lib/format.js';
import { toCSV, downloadCSV } from '../lib/csv.js';

export default function Users() {
  const { toast } = useApp();
  const [bot, setBot] = useState('all'); // 'all' | 'dl' | 'movie' | 'adult'
  const [allUsers, setAllUsers] = useState({ dl: [], movie: [], adult: [] });
  const [loading, setLoading] = useState(true);
  const [msgUser, setMsgUser] = useState(null);
  const [msgText, setMsgText] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [dlRes, movieRes, adultRes] = await Promise.allSettled([
      safe(dlApi.get('/users')),
      safe(movieApi.get('/users')),
      safe(adultApi.get('/users')),
    ]);

    setAllUsers({
      dl: dlRes.status === 'fulfilled' && Array.isArray(dlRes.value.data) ? dlRes.value.data : [],
      movie: movieRes.status === 'fulfilled' && Array.isArray(movieRes.value.data) ? movieRes.value.data : [],
      adult: adultRes.status === 'fulfilled' && Array.isArray(adultRes.value.data) ? adultRes.value.data : [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const rows = useMemo(() => {
    let list = [];
    const processUser = (u, botType, botName, botColor, botBadgeBg) => {
      const rawDateStr = u.dateJoined || u.joinedDate || u.joinedAt || u.createdAt || '';
      const rawDate = rawDateStr ? new Date(rawDateStr).getTime() : 0;
      const uName = u.username ? '@' + String(u.username).replace(/^@/, '') : '—';
      const fName = u.first_name || u.firstName || u.name || 'Foydalanuvchi';
      
      // Amallar / Faollik ko'rsatkichi
      const actionsCount = u.downloads || u.movieViews || u.views || u.searchHistory?.length || (u.refCount ? u.refCount * 2 : 1);

      return {
        ...u,
        id: u.id,
        username: uName,
        name: fName,
        rawDate: rawDate,
        dateJoinedFormatted: rawDate ? fmtDateTime(rawDateStr) : '— (Noma\'lum)',
        botType: botType,
        botName: botName,
        botColor: botColor,
        botBadgeBg: botBadgeBg,
        refCount: u.refCount || u.referralCount || 0,
        actionsCount: actionsCount,
        banned: !!u.banned,
      };
    };

    if (bot === 'all' || bot === 'dl') {
      allUsers.dl.forEach(u => list.push(processUser(u, 'dl', 'Downloader', '#6366f1', 'rgba(99,102,241,0.15)')));
    }
    if (bot === 'all' || bot === 'movie') {
      allUsers.movie.forEach(u => list.push(processUser(u, 'movie', 'Kino Bot', '#d946ef', 'rgba(217,70,239,0.15)')));
    }
    if (bot === 'all' || bot === 'adult') {
      allUsers.adult.forEach(u => list.push(processUser(u, 'adult', '18+ Adult', '#ef4444', 'rgba(239,68,68,0.15)')));
    }

    // Sort by newest registration date descending by default
    return list.sort((a, b) => b.rawDate - a.rawDate);
  }, [allUsers, bot]);

  // Overall metric statistics
  const totalCount = rows.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const newToday = useMemo(() => {
    return rows.filter(r => r.rawDate && new Date(r.rawDate).toISOString().split('T')[0] === todayStr).length;
  }, [rows, todayStr]);
  const activeCount = useMemo(() => rows.filter(r => !r.banned).length, [rows]);
  const bannedCount = useMemo(() => rows.filter(r => r.banned).length, [rows]);

  const toggleBan = async (u) => {
    const targetApi = u.botType === 'dl' ? dlApi : (u.botType === 'adult' ? adultApi : movieApi);
    const { error } = await safe(targetApi.post(`/users/${u.id}/ban`, { banned: !u.banned }));
    if (error) return toast(error, 'error');
    toast(u.banned ? 'Blokdan chiqarildi' : 'Bloklandi');
    fetchUsers();
  };

  const sendMsg = async () => {
    if (!msgText.trim() || !msgUser) return;
    setBusy(true);
    const targetApi = msgUser.botType === 'dl' ? dlApi : (msgUser.botType === 'adult' ? adultApi : movieApi);
    const { error } = await safe(targetApi.post('/message-user', { id: msgUser.id, text: msgText }));
    setBusy(false);
    if (error) return toast(error, 'error');
    toast('Xabar yuborildi');
    setMsgUser(null);
    setMsgText('');
  };

  const columns = [
    {
      key: 'name', label: 'Foydalanuvchi', sortable: true,
      render: (u) => (
        <div className="avatar-cell">
          <div className="avatar" style={{ background: avatarColor(u.username || u.id) }}>{initials(u.name)}</div>
          <div>
            <div className="cell-title" style={{ fontWeight: 650 }}>{u.name}</div>
            <div className="cell-sub mono">{u.username !== '—' ? u.username : u.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'botName', label: 'Bot Manbasi', sortable: true, align: 'center',
      render: (u) => (
        <span className="badge" style={{ background: u.botBadgeBg, color: u.botColor, fontWeight: 750, padding: '4px 10px' }}>
          {u.botName}
        </span>
      )
    },
    {
      key: 'rawDate', label: "Qo'shilgan Sana va Vaqti", sortable: true,
      render: (u) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{u.dateJoinedFormatted}</div>
        </div>
      )
    },
    {
      key: 'actionsCount', label: 'Bajargan Amallari', sortable: true, align: 'center',
      render: (u) => (
        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
          {nf(u.actionsCount)} ta
        </span>
      )
    },
    { key: 'refCount', label: 'Takliflar', sortable: true, align: 'center', render: (u) => nf(u.refCount || 0) },
    {
      key: 'banned', label: 'Holat', sortable: true, align: 'center',
      value: (u) => (u.banned ? 1 : 0),
      render: (u) => u.banned
        ? <span className="badge badge-danger"><Ban size={12} /> Bloklangan</span>
        : <span className="badge badge-success">● Faol</span>,
    },
    {
      key: 'actions', label: '', align: 'right', width: 100,
      render: (u) => (
        <div className="flex gap" style={{ justifyContent: 'flex-end' }}>
          <button className="icon-btn" style={{ width: 32, height: 32 }} title="Xabar yuborish" onClick={() => { setMsgUser(u); setMsgText(''); }}><MessageSquare size={15} /></button>
          <button className="icon-btn" style={{ width: 32, height: 32, color: u.banned ? 'var(--success)' : 'var(--danger)' }} title={u.banned ? 'Blokdan chiqarish' : 'Bloklash'} onClick={() => toggleBan(u)}>
            {u.banned ? <ShieldCheck size={15} /> : <Ban size={15} />}
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <Loader full />;

  return (
    <div>
      {/* Metrics Header Summary */}
      <div className="grid grid-stats" style={{ marginBottom: 20 }}>
        <StatCard icon={UsersIcon} label="Jami Foydalanuvchilar" value={totalCount} color="#6366f1" />
        <StatCard icon={UserPlus} label="Bugun Qo'shilganlar" value={newToday} color="#10b981" />
        <StatCard icon={Activity} label="Faol Foydalanuvchilar" value={activeCount} color="#0ea5e9" />
        <StatCard icon={Ban} label="Bloklanganlar" value={bannedCount} color="#ef4444" />
      </div>

      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 12 }}>
          <h3><UsersIcon size={18} style={{ verticalAlign: -3, marginRight: 6, color: '#6366f1' }} />Foydalanuvchilar Ro'yxati</h3>
          <span className="sub">{nf(rows.length)} ta foydalanuvchi</span>
          <div className="spacer" />
          <Segmented
            options={[
              { value: 'all', label: '⚡ Barcha Botlar' },
              { value: 'dl', label: '📥 Downloader' },
              { value: 'movie', label: '🎬 Kino Bot' },
              { value: 'adult', label: '🔞 18+ Adult Bot' }
            ]}
            value={bot}
            onChange={setBot}
          />
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => downloadCSV(`foydalanuvchilar-${bot}.csv`, toCSV(rows, [
            { key: 'id', label: 'ID' }, { key: 'username', label: 'Username' }, { key: 'name', label: 'Ism' },
            { key: 'botName', label: 'Bot' }, { key: 'dateJoinedFormatted', label: 'Qoshilgan Vaqti' },
            { key: 'actionsCount', label: 'Amallar' }, { key: 'refCount', label: 'Takliflar' },
            { key: 'banned', label: 'Bloklangan', value: (u) => (u.banned ? 'ha' : 'yoq') },
          ]))}>📥 Eksport CSV</button>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={['name', 'username', 'id', 'botName']}
          searchPlaceholder="Ism, Username, ID yoki Bot bo'yicha qidirish..."
          pageSize={15}
          initialSort={{ key: 'rawDate', dir: 'desc' }}
          emptyTitle="Foydalanuvchilar topilmadi"
          emptyText="Hozircha tizimda foydalanuvchilar mavjud emas"
        />

        <Modal
          open={!!msgUser}
          title={`Xabar yuborish: ${msgUser?.name || ''}`}
          onClose={() => setMsgUser(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setMsgUser(null)}>Bekor</button>
              <button className="btn btn-primary" onClick={sendMsg} disabled={busy || !msgText.trim()}>
                {busy ? <span className="spinner" /> : <><Send size={16} /> Yuborish</>}
              </button>
            </>
          }
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Xabar matni (HTML)</label>
            <textarea className="textarea" style={{ minHeight: 120 }} value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Salom! ..." autoFocus />
          </div>
        </Modal>
      </div>
    </div>
  );
}
