import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, ThumbsUp, ThumbsDown, Film, Tag, X } from 'lucide-react';
import { movieApi, safe } from '../lib/api.js';
import { useResource } from '../lib/useData.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader, Modal } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';
import { nf, fmtDate } from '../lib/format.js';

const EMPTY = { code: '', title: '', description: '', genre: '', fileId: '', poster: '' };

function Poster({ src, size = 40 }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{ width: size, height: size * 1.4, borderRadius: 7, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--text-3)', flexShrink: 0 }}>
        <Film size={size * 0.45} />
      </div>
    );
  }
  return <img src={src} alt="" onError={() => setErr(true)} style={{ width: size, height: size * 1.4, borderRadius: 7, objectFit: 'cover', flexShrink: 0, background: 'var(--surface-2)' }} />;
}

export default function Movies() {
  const { toast } = useApp();
  const { data, loading, reload } = useResource(() => movieApi.get('/movies'));
  const genresRes = useResource(() => movieApi.get('/genres'));
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [genreModal, setGenreModal] = useState(false);

  const movies = Array.isArray(data) ? data : [];
  const genres = Array.isArray(genresRes.data) ? genresRes.data : [];

  const openAdd = () => { setForm({ ...EMPTY, genre: genres[0] || 'Tarjima kino' }); setEditing(false); };
  const openEdit = (m) => { setForm({ code: m.code, title: m.title, description: m.description || '', genre: m.genre || '', fileId: m.fileId || '', poster: m.poster || '' }); setEditing(true); };

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
    { key: 'poster', label: '', width: 56, render: (m) => <Poster src={m.poster} /> },
    { key: 'code', label: 'Kod', sortable: true, width: 80, render: (m) => <span className="badge badge-accent mono">{m.code}</span> },
    {
      key: 'title', label: 'Kino', sortable: true,
      render: (m) => (
        <div>
          <div className="cell-title">{m.title}</div>
          {m.description && <div className="cell-sub" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</div>}
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
          <button className="btn btn-ghost btn-sm" onClick={() => setGenreModal(true)}><Tag size={16} /> Janrlar</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ marginLeft: 10 }}><Plus size={16} /> Kino qo'shish</button>
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
            <div style={{ display: 'flex', gap: 16 }}>
              <Poster src={form.poster} size={72} />
              <div style={{ flex: 1 }}>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>Kod *</label>
                  <input className="input" value={form.code} disabled={editing} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="masalan: 100" />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Janr</label>
                  <select className="select" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
                    {!genres.includes(form.genre) && form.genre && <option value={form.genre}>{form.genre}</option>}
                    {genres.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label>Sarlavha *</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Kino nomi" />
            </div>
            <div className="field">
              <label>Poster URL (ixtiyoriy)</label>
              <input className="input mono" value={form.poster} onChange={(e) => setForm({ ...form, poster: e.target.value })} placeholder="https://.../poster.jpg" />
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

      <GenreModal open={genreModal} onClose={() => setGenreModal(false)} genres={genres} onSaved={() => { genresRes.reload(); }} />

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

function GenreModal({ open, onClose, genres, onSaved }) {
  const { toast } = useApp();
  const [list, setList] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  // Sync local list when opening.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) { setList(genres); setWasOpen(true); }
  if (!open && wasOpen) { setWasOpen(false); setInput(''); }

  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (list.includes(v)) { toast('Bu janr allaqachon bor', 'error'); return; }
    setList([...list, v]);
    setInput('');
  };
  const remove = (g) => setList(list.filter((x) => x !== g));

  const save = async () => {
    setBusy(true);
    const { error } = await safe(movieApi.post('/genres', { genres: list }));
    setBusy(false);
    if (error) { toast(error, 'error'); return; }
    toast('Janrlar saqlandi');
    onSaved?.();
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Janrlarni boshqarish"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Bekor</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : 'Saqlash'}</button>
        </>
      }
    >
      <div className="flex gap" style={{ marginBottom: 16 }}>
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Yangi janr nomi" />
        <button className="btn btn-ghost" onClick={add}><Plus size={16} /></button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {list.map((g) => (
          <span key={g} className="badge badge-muted" style={{ paddingRight: 4 }}>
            {g}
            <button className="icon-btn" style={{ width: 20, height: 20, border: 'none', background: 'transparent' }} onClick={() => remove(g)}><X size={13} /></button>
          </span>
        ))}
        {list.length === 0 && <span className="muted">Janr yo'q</span>}
      </div>
    </Modal>
  );
}
