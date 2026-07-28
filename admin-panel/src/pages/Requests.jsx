import { useState, useMemo } from 'react';
import { Check, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { movieApi, safe } from '../lib/api.js';
import { useResource } from '../lib/useData.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader, Segmented } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';
import { fmtDateTime, avatarColor, initials, nf } from '../lib/format.js';

export default function Requests() {
  const { toast } = useApp();
  const { data, loading, reload } = useResource(() => movieApi.get('/requests'), 20000);
  const [filter, setFilter] = useState('pending');

  const all = Array.isArray(data) ? data : [];
  const counts = useMemo(() => ({
    all: all.length,
    pending: all.filter((r) => r.status === 'pending').length,
    completed: all.filter((r) => r.status === 'completed').length,
  }), [all]);

  const rows = useMemo(() => (filter === 'all' ? all : all.filter((r) => r.status === filter)), [all, filter]);

  const complete = async (r) => {
    const { error } = await safe(movieApi.post(`/requests/${r.id}/complete`));
    if (error) return toast(error, 'error');
    toast('Bajarildi deb belgilandi');
    reload();
  };
  const remove = async (r) => {
    const { error } = await safe(movieApi.delete(`/requests/${r.id}`));
    if (error) return toast(error, 'error');
    toast("So'rov o'chirildi");
    reload();
  };

  const columns = [
    {
      key: 'username', label: 'Foydalanuvchi', sortable: true,
      render: (r) => (
        <div className="avatar-cell">
          <div className="avatar" style={{ background: avatarColor(r.username || r.userId) }}>{initials(r.username)}</div>
          <div>
            <div className="cell-title">{r.username ? '@' + String(r.username).replace(/^@/, '') : 'Noma\'lum'}</div>
            <div className="cell-sub mono">{r.userId}</div>
          </div>
        </div>
      ),
    },
    { key: 'title', label: "So'ralgan kino", sortable: true, render: (r) => <span className="cell-title">{r.title}</span> },
    { key: 'dateRequested', label: 'Sana', sortable: true, render: (r) => fmtDateTime(r.dateRequested) },
    {
      key: 'status', label: 'Holat', sortable: true, align: 'center',
      render: (r) => r.status === 'completed'
        ? <span className="badge badge-success"><CheckCircle2 size={12} /> Bajarilgan</span>
        : <span className="badge badge-warning"><Clock size={12} /> Kutilmoqda</span>,
    },
    {
      key: 'actions', label: '', align: 'right', width: 90,
      render: (r) => (
        <div className="flex gap" style={{ justifyContent: 'flex-end' }}>
          {r.status !== 'completed' && (
            <button className="icon-btn" style={{ width: 32, height: 32, color: 'var(--success)' }} title="Bajarildi" onClick={() => complete(r)}><Check size={16} /></button>
          )}
          <button className="icon-btn" style={{ width: 32, height: 32 }} title="O'chirish" onClick={() => remove(r)}><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  if (loading) return <Loader full />;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Kino so'rovlari</h3>
        <div className="spacer" />
        <Segmented
          options={[
            { value: 'pending', label: `Kutilmoqda (${counts.pending})` },
            { value: 'completed', label: `Bajarilgan (${counts.completed})` },
            { value: 'all', label: `Hammasi (${counts.all})` },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        searchKeys={['title', 'username', 'userId']}
        searchPlaceholder="Kino nomi yoki foydalanuvchi bo'yicha..."
        pageSize={12}
        initialSort={{ key: 'dateRequested', dir: 'desc' }}
        emptyTitle="So'rovlar yo'q"
      />
    </div>
  );
}
