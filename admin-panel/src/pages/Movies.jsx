import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, ThumbsUp, ThumbsDown, Film } from 'lucide-react';
import { movieApi, safe } from '../lib/api.js';
import { useResource } from '../lib/useData.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader, Modal } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';
import { nf, fmtDate } from '../lib/format.js';

const EMPTY = { code: '', title: '', description: '', genre: 'Tarjima kino', fileId: '' };

export default function Movies() {
  const { toast } = useApp();
  const { data, loading, reload } = useResource(() => movieApi.get('/movies'));
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const movies = Array.isArray(data) ? data : [];

  const openAdd = () => { setForm({ ...EMPTY }); setEditing(false); };
  const openEdit = (m) => { setForm({ code: m.code, title: m.title, description: m.description || '', genre: m.genre || '', fileId: m.fileId || '' }); setEditing(true); };

  const save = async () => {
    if (!form.code || !form.title || !form.fileId) { toast('Kod, sarlavha va fileId majburiy', 'error'); return; }
    setBusy(true);
    const { error } = await safe(movieApi.post('/movies', form));
    setBusy(false);
    if (error) { toast(error, 'error'); return; }
    toast(editing ? 'Kino yangilandi' : "Kino qo'shildi");
    setForm(null);
    reload();
  };

  const confirmDelete = async () => {
    setBusy(true);
    const { error } = await safe(movieApi.delete(`/movies/${encodeURIComponent(del.code)}`));
    setBusy(false);
    if (error) { toast(error, 'error'); return; }
    toast("Kino o'chirildi");
    setDel(null);
    reload();
  };

  const columns = [
    { key: 'code', label: 'Kod', sortable: true, width: 90, render: (m) => <span className="badge badge-accent mono">{m.code}</span> },
    {
      key: 'title', label: 'Kino', sortable: true,
      render: (m) => (
        <div>
          <div className="cell-title">{m.title}</div>
          {m.description && <div className="cell-sub" style={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</div>}
        </div>
      ),
    },
    { key: 'genre', label: 'Janr', sortable: true, render: (m) => <span className="badge badge-muted">{m.genre || '—'}</span> },
    { key: 'views', label: "Ko'rishlar", sortable: true, align: 'center', render: (m) => <span className="flex gap" style={{ justifyContent: 'center', alignItems: 'center' }}><Eye size={14} className="muted" /> {nf(m.views || 0)}</span> },
    {
      key: 'rating', label: 'Reyting', align: 'center',
      value: (m) => (m.likes?.length || 0) - (m.dislikes?.length || 0),
      render: (m) => (
        <div className="flex gap" style={{ justifyContent: 'center' }}>
          <span className="badge badge-success"><ThumbsUp size={12} /> {m.likes?.length || 0}</span>
          <span className="badge badge-danger"><ThumbsDown size={12} /> {m.dislikes?.length || 0}</span>
        </div>
      ),
    },
    { key: 'dateAdded', label: "Qo'shilgan", sortable: true, render: (m) => fmtDate(m.dateAdded) },
    {
      key: 'actions', label: '', align: 'right', width: 90,
      render: (m) => (
        <div className="flex gap" style={{ justifyContent: 'flex-end' }}>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => openEdit(m)}><Pencil size={15} /></button>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setDel(m)}><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  if (loading) return <Loader full />;

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <h3>Kino katalogi</h3>
          <span className="sub">{nf(movies.length)} ta film</span>
          <div className="spacer" />
          <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={16} /> Kino qo'shish</button>
        </div>
        <DataTable
          columns={columns}
          rows={movies}
          searchKeys={['code', 'title', 'genre', 'description']}
          searchPlaceholder="Kod, nom yoki janr bo'yicha qidirish..."
          pageSize={10}
          initialSort={{ key: 'dateAdded', dir: 'desc' }}
          emptyTitle="Kinolar yo'q"
          emptyText="Birinchi kinoni qo'shing"
        />
      </div>

      <Modal
        open={!!form}
        title={editing ? 'Kinoni tahrirlash' : "Yangi kino qo'shish"}
        onClose={() => setForm(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setForm(null)}>Bekor</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : 'Saqlash'}</button>
          </>
        }
      >
        {form && (
          <>
            <div className="field">
              <label>Kod *</label>
              <input className="input" value={form.code} disabled={editing} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="masalan: 100" />
            </div>
            <div className="field">
              <label>Sarlavha *</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Kino nomi" />
            </div>
            <div className="field">
              <label>Janr</label>
              <input className="input" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Tarjima kino" />
            </div>
            <div className="field">
              <label>Tavsif</label>
              <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Qisqa tavsif..." />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Telegram File ID *</label>
              <input className="input mono" value={form.fileId} onChange={(e) => setForm({ ...form, fileId: e.target.value })} placeholder="BAACAg... " />
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!del}
        title="Kinoni o'chirish"
        onClose={() => setDel(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDel(null)}>Bekor</button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={busy}>{busy ? <span className="spinner" /> : "O'chirish"}</button>
          </>
        }
      >
        <p><strong>{del?.title}</strong> (kod: {del?.code}) o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.</p>
      </Modal>
    </div>
  );
}
