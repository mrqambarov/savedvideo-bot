import { useState } from 'react';
import { Ban, ShieldCheck, Send, MessageSquare, Users as UsersIcon } from 'lucide-react';
import { dlApi, movieApi, safe } from '../lib/api.js';
import { useResource } from '../lib/useData.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader, Segmented, Modal } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';
import { nf, fmtDate, avatarColor, initials } from '../lib/format.js';
import { toCSV, downloadCSV } from '../lib/csv.js';

export default function Users() {
  const { toast } = useApp();
  const [bot, setBot] = useState('movie');
  const api = bot === 'dl' ? dlApi : movieApi;
  const { data, loading, reload } = useResource(() => api.get('/users'), 0, [bot]);
  const [msgUser, setMsgUser] = useState(null);
  const [msgText, setMsgText] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = (Array.isArray(data) ? data : []).map((u) => ({
    ...u,
    name: u.username ? '@' + String(u.username).replace(/^@/, '') : (u.first_name || 'Foydalanuvchi'),
  }));

  const toggleBan = async (u) => {
    const { error } = await safe(api.post(`/users/${u.id}/ban`, { banned: !u.banned }));
    if (error) return toast(error, 'error');
    toast(u.banned ? 'Blokdan chiqarildi' : 'Bloklandi');
    reload();
  };

  const sendMsg = async () => {
    if (!msgText.trim()) return;
    setBusy(true);
    const { error } = await safe(api.post('/message-user', { id: msgUser.id, text: msgText }));
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
            <div className="cell-title">{u.name}</div>
            <div className="cell-sub mono">{u.id}</div>
          </div>
        </div>
      ),
    },
    { key: 'dateJoined', label: "Qo'shilgan", sortable: true, render: (u) => fmtDate(u.dateJoined) },
    { key: 'refCount', label: 'Takliflar', sortable: true, align: 'center', render: (u) => nf(u.refCount || 0) },
    {
      key: 'banned', label: 'Holat', sortable: true, align: 'center',
      value: (u) => (u.banned ? 1 : 0),
      render: (u) => u.banned
        ? <span className="badge badge-danger"><Ban size={12} /> Bloklangan</span>
        : <span className="badge badge-success">Faol</span>,
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
    <div className="card">
      <div className="card-head">
        <h3><UsersIcon size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Foydalanuvchilar</h3>
        <span className="sub">{nf(rows.length)} ta</span>
        <div className="spacer" />
        <Segmented options={[{ value: 'movie', label: 'Kino bot' }, { value: 'dl', label: 'Downloader' }]} value={bot} onChange={setBot} />
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 10 }} onClick={() => downloadCSV(`foydalanuvchilar-${bot}.csv`, toCSV(rows, [
          { key: 'id', label: 'ID' }, { key: 'username', label: 'Username' }, { key: 'first_name', label: 'Ism' },
          { key: 'dateJoined', label: 'Qoshilgan' }, { key: 'refCount', label: 'Takliflar', value: (u) => u.refCount || 0 },
          { key: 'banned', label: 'Bloklangan', value: (u) => (u.banned ? 'ha' : 'yoq') },
        ]))}>Eksport</button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        searchKeys={['name', 'id', 'first_name']}
        searchPlaceholder="Username yoki ID bo'yicha qidirish..."
        pageSize={12}
        initialSort={{ key: 'dateJoined', dir: 'desc' }}
        emptyTitle="Foydalanuvchilar yo'q"
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
  );
}
