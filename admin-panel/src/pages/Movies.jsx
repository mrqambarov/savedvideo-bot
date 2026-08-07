import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Eye, ThumbsUp, ThumbsDown, Film, Tag, X, Upload, Download, Bell, Sparkles, Layers, Star, PlayCircle } from 'lucide-react';
import { movieApi, adultApi, safe } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader, Modal, Segmented, StatCard } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';
import { nf, fmtDate } from '../lib/format.js';
import { toCSV, downloadCSV, parseCSV } from '../lib/csv.js';

const EMPTY = { code: '', title: '', description: '', genre: '', fileId: '', poster: '', notify: false };

function Poster({ src, size = 42 }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{ width: size, height: Math.round(size * 1.35), borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--text-3)', flexShrink: 0, border: '1px solid var(--border)' }}>
        <Film size={Math.round(size * 0.45)} />
      </div>
    );
  }
  return <img src={src} alt="" onError={() => setErr(true)} style={{ width: size, height: Math.round(size * 1.35), borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }} />;
}

export default function Movies() {
  const { toast } = useApp();
  const [targetBot, setTargetBot] = useState('movie'); // 'movie' or 'adult'
  const [catalogs, setCatalogs] = useState({ movie: [], adult: [] });
  const [genresMap, setGenresMap] = useState({ movie: [], adult: [] });
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [genreModal, setGenreModal] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const reload = useCallback(async () => {
    const [mRes, aRes, mgRes, agRes] = await Promise.allSettled([
      safe(movieApi.get('/movies')),
      safe(adultApi.get('/movies')),
      safe(movieApi.get('/genres')),
      safe(adultApi.get('/genres'))
    ]);

    setCatalogs({
      movie: mRes.status === 'fulfilled' && Array.isArray(mRes.value.data) ? mRes.value.data : [],
      adult: aRes.status === 'fulfilled' && Array.isArray(aRes.value.data) ? aRes.value.data : []
    });
    setGenresMap({
      movie: mgRes.status === 'fulfilled' && Array.isArray(mgRes.value.data) ? mgRes.value.data : [],
      adult: agRes.status === 'fulfilled' && Array.isArray(agRes.value.data) ? agRes.value.data : []
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const movies = catalogs[targetBot] || [];
  const genres = genresMap[targetBot] || [];
  const api = targetBot === 'adult' ? adultApi : movieApi;

  // Catalog metric stats
  const totalCount = movies.length;
  const totalViews = useMemo(() => movies.reduce((acc, m) => acc + (m.views || 0), 0), [movies]);
  const highRatedCount = useMemo(() => movies.filter(m => (m.likes?.length || 0) > (m.dislikes?.length || 0)).length, [movies]);
  const totalGenresCount = genres.length;

  const openAdd = () => { setForm({ ...EMPTY, genre: genres[0] || 'Triller (18+)' }); setEditing(false); };
  const openEdit = (m) => { setForm({ code: m.code, title: m.title, description: m.description || '', genre: m.genre || '', fileId: m.fileId || '', poster: m.poster || '' }); setEditing(true); };

  const save = async () => {
    if (!form.code || !form.title || !form.fileId) { toast('Kod, sarlavha va fileId majburiy', 'error'); return; }
    setBusy(true);
    const { error } = await safe(api.post('/movies', form));
    setBusy(false);
    if (error) { toast(error, 'error'); return; }
    toast(editing ? 'Kino/Video yangilandi' : "Kino/Video qo'shildi");
    setForm(null);
    reload();
  };

  const confirmDelete = async () => {
    setBusy(true);
    const { error } = await safe(api.delete(`/movies/${encodeURIComponent(del.code)}`));
    setBusy(false);
    if (error) { toast(error, 'error'); return; }
    toast("Kino/Video o'chirildi");
    setDel(null);
    reload();
  };

  const columns = [
    { key: 'poster', label: '', width: 56, render: (m) => <Poster src={m.poster} /> },
    { key: 'code', label: 'Kod', sortable: true, width: 85, render: (m) => <span className="badge badge-accent mono" style={{ fontSize: 12, padding: '4px 8px' }}>{m.code}</span> },
    {
      key: 'title', label: 'Kino / Video Nomi', sortable: true,
      render: (m) => (
        <div>
          <div className="cell-title" style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
          {m.description && <div className="cell-sub" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{m.description}</div>}
        </div>
      ),
    },
    { key: 'genre', label: 'Janr', sortable: true, render: (m) => <span className="badge badge-muted" style={{ fontWeight: 650 }}>{m.genre || '—'}</span> },
    { key: 'views', label: "Ko'rishlar", sortable: true, align: 'center', render: (m) => <span className="flex gap" style={{ justifyContent: 'center', alignItems: 'center', fontWeight: 700, color: 'var(--text)' }}><Eye size={14} className="muted" /> {nf(m.views || 0)}</span> },
    {
      key: 'rating', label: 'Reyting', align: 'center',
      value: (m) => (m.likes?.length || 0) - (m.dislikes?.length || 0),
      render: (m) => (
        <div className="flex gap" style={{ justifyContent: 'center' }}>
          <span className="badge badge-success" style={{ padding: '3px 8px' }}><ThumbsUp size={12} /> {m.likes?.length || 0}</span>
          <span className="badge badge-danger" style={{ padding: '3px 8px' }}><ThumbsDown size={12} /> {m.dislikes?.length || 0}</span>
        </div>
      ),
    },
    { key: 'dateAdded', label: "Qo'shilgan", sortable: true, render: (m) => fmtDate(m.dateAdded) },
    {
      key: 'actions',
      label: 'AMALLAR',
      align: 'center',
      width: 130,
      render: (m) => (
        <div className="flex gap" style={{ justifyContent: 'center', gap: 8 }}>
          <button
            className="icon-btn"
            style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(139, 92, 246, 0.12)', color: '#a855f7', border: '1px solid rgba(139, 92, 246, 0.3)' }}
            title="Tahrirlash"
            onClick={() => openEdit(m)}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-btn"
            style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(239, 68, 68, 0.18)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}
            title="O'chirish"
            onClick={() => setDel(m)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <Loader full />;

  return (
    <div style={{ width: '100%', margin: '0 auto' }}>
      {/* Top 4 KPI Metric Cards */}
      <div className="grid-stats" style={{ marginBottom: 20 }}>
        <StatCard icon={Film} label={targetBot === 'adult' ? "Jami 18+ Videolar" : "Jami Kinolar"} value={totalCount} color={targetBot === 'adult' ? "#ef4444" : "#d946ef"} />
        <StatCard icon={Eye} label="Jami Ko'rishlar" value={totalViews} color="#0ea5e9" />
        <StatCard icon={Star} label="A'lo Reytingli" value={highRatedCount} color="#10b981" />
        <StatCard icon={Tag} label="Mavjud Janrlar" value={totalGenresCount} color="#f59e0b" />
      </div>

      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {targetBot === 'adult' ? <Sparkles size={20} color="#ef4444" /> : <Film size={20} color="#d946ef" />}
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {targetBot === 'adult' ? '🔞 18+ Video Katalogi' : '🎬 Kino Katalogi'}
              </h3>
              <span className="sub">{nf(movies.length)} ta {targetBot === 'adult' ? 'video' : 'kino'} katalogda</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Segmented
              options={[
                { value: 'movie', label: '🎬 Kino Bot' },
                { value: 'adult', label: '🔞 18+ Adult Bot' }
              ]}
              value={targetBot}
              onChange={setTargetBot}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setGenreModal(true)}><Tag size={15} /> Janrlar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => downloadCSV(`${targetBot === 'adult' ? 'adult_videolar' : 'kinolar'}.csv`, toCSV(movies, [
              { key: 'code', label: 'Kod' }, { key: 'title', label: 'Nomi' }, { key: 'genre', label: 'Janr' },
              { key: 'views', label: 'Korishlar' }, { key: 'fileId', label: 'FileID' },
              { key: 'likes', label: 'Layklar', value: (m) => m.likes?.length || 0 },
              { key: 'dateAdded', label: 'Qoshilgan' },
            ]))}><Download size={15} /> Eksport</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setBulkOpen(true)}><Upload size={15} /> Import</button>
            <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ background: targetBot === 'adult' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'var(--accent-grad)' }}>
              <Plus size={16} /> Qo'shish
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={movies}
          searchKeys={['code', 'title', 'genre', 'description']}
          searchPlaceholder="Kod, nom yoki janr bo'yicha qidirish..."
          pageSize={12}
          initialSort={{ key: 'dateAdded', dir: 'desc' }}
          emptyTitle="Kinolar topilmadi"
          emptyText="Katalogga birinchi kinoni qo'shing"
        />
      </div>

      {/* Add / Edit Movie Modal */}
      <Modal
        open={!!form}
        title={editing ? 'Kinoni tahrirlash' : "Yangi kino qo'shish"}
        onClose={() => setForm(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setForm(null)}>Bekor</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? <span className="spinner" /> : 'Saqlash'}
            </button>
          </>
        }
      >
        {form && (
          <>
            <div style={{ display: 'flex', gap: 16 }}>
              <Poster src={form.poster} size={72} />
              <div style={{ flex: 1 }}>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>Kino Kodu *</label>
                  <input className="input mono" value={form.code} disabled={editing} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="masalan: 100" />
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
              <label>Sarlavha (Kino Nomi) *</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="masalan: Titanik (O'zbek tilida)" />
            </div>
            <div className="field">
              <label>Poster URL (Rasm havolasi)</label>
              <input className="input mono" value={form.poster} onChange={(e) => setForm({ ...form, poster: e.target.value })} placeholder="https://.../poster.jpg" />
            </div>
            <div className="field">
              <label>Tavsif va Ma'lumot</label>
              <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Kino haqida qisqa tavsif..." />
            </div>
            <div className="field" style={{ marginBottom: editing ? 0 : 16 }}>
              <label>Telegram Video File ID *</label>
              <input className="input mono" value={form.fileId} onChange={(e) => setForm({ ...form, fileId: e.target.value })} placeholder="BAACAgI..." />
            </div>
            {!editing && (
              <div className="between" style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10 }}>
                <div className="flex gap" style={{ alignItems: 'center' }}>
                  <Bell size={16} className="muted" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Foydalanuvchilarga xabar berish</div>
                    <div className="cell-sub">Barcha bot a'zolariga yangi kino haqida bildirishnoma yuboriladi</div>
                  </div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={!!form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />
                  <span className="slider" />
                </label>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Genre Management Modal */}
      <GenreModal open={genreModal} onClose={() => setGenreModal(false)} genres={genres} onSaved={() => { genresRes.reload(); }} />

      {/* Bulk CSV Import Modal */}
      <BulkImport open={bulkOpen} onClose={() => setBulkOpen(false)} onDone={reload} />

      {/* Delete Confirmation Modal */}
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
        <p style={{ fontSize: 14 }}>
          <strong>{del?.title}</strong> (Kodi: <span className="mono">{del?.code}</span>) katalogdan o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.
        </p>
      </Modal>
    </div>
  );
}

function BulkImport({ open, onClose, onDone }) {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const parse = () => {
    const rows = parseCSV(text.trim());
    if (!rows.length) return [];
    let start = 0;
    const first = (rows[0][0] || '').toLowerCase();
    if (first === 'code' || first === 'kod') start = 1;
    return rows.slice(start).map((r) => ({
      code: (r[0] || '').trim(),
      title: (r[1] || '').trim(),
      genre: (r[2] || '').trim(),
      fileId: (r[3] || '').trim(),
      description: (r[4] || '').trim(),
    })).filter((m) => m.code || m.title || m.fileId);
  };

  const preview = open ? parse() : [];

  const submit = async () => {
    const movies = parse();
    if (!movies.length) { toast('Import uchun maʼlumot yoʻq', 'error'); return; }
    setBusy(true);
    const { data, error } = await safe(movieApi.post('/movies/bulk', { movies }));
    setBusy(false);
    if (error) { toast(error, 'error'); return; }
    setResult(data);
    toast(`${data.added} ta kino qoʻshildi`);
    onDone?.();
  };

  const close = () => { setText(''); setResult(null); onClose(); };

  return (
    <Modal
      open={open}
      title="Ommaviy import (CSV)"
      onClose={close}
      width={620}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close}>Yopish</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || preview.length === 0}>
            {busy ? <span className="spinner" /> : `${preview.length} ta kinoni import qilish`}
          </button>
        </>
      }
    >
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Har bir qatorda vergul bilan ajratilgan: <span className="mono">kod,nomi,janr,fileId,tavsif</span>. Birinchi qator sarlavha boʻlsa avtomatik oʻtkazib yuboriladi.
      </p>
      <textarea
        className="textarea mono"
        style={{ minHeight: 160, fontSize: 12.5 }}
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null); }}
        placeholder={'101,Titanik,Melodrama,BAACAgI...,Klassik film\n102,Avatar,Fantastika,BAACAgI...,'}
      />
      {preview.length > 0 && (
        <div className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>👀 {preview.length} ta qator aniqlandi</div>
      )}
      {result && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--success-soft)', borderRadius: 10 }}>
          <strong style={{ color: 'var(--success)' }}>✅ {result.added} / {result.total} ta qoʻshildi</strong>
          {result.errors?.length > 0 && (
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              {result.errors.slice(0, 5).map((e, i) => <div key={i}>⚠️ {e}</div>)}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function GenreModal({ open, onClose, genres, onSaved }) {
  const { toast } = useApp();
  const [list, setList] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

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
