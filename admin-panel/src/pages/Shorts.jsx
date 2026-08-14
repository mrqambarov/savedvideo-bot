import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  Plus, Play, Eye, Heart, Share2, Trash2, Edit2, Sparkles, 
  Film, ExternalLink, Clapperboard, CheckCircle, Clock, Video,
  Upload, Image, Check, AlertCircle
} from 'lucide-react';
import { movieApi, safe } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader, Modal, StatCard, Segmented } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';
import { fmtDateTime, shortNum } from '../lib/format.js';

const EMPTY_SHORT = {
  title: '',
  description: '',
  videoUrl: '',
  poster: '',
  movieCode: '',
  movieTitle: '',
  creatorName: 'XIT FILM Official',
  creatorTag: '@xitfilm_uz',
  duration: '0:55',
  status: 'active'
};

export default function Shorts() {
  const { toast } = useApp();
  const [shorts, setShorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & form state
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  const videoInputRef = useRef(null);
  const posterInputRef = useRef(null);

  const reload = useCallback(async () => {
    const { data } = await safe(movieApi.get('/shorts'));
    if (data?.success && Array.isArray(data.shorts)) {
      setShorts(data.shorts);
    } else if (Array.isArray(data)) {
      setShorts(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Statistics
  const totalViews = useMemo(() => shorts.reduce((acc, s) => acc + (s.views || 0), 0), [shorts]);
  const totalLikes = useMemo(() => shorts.reduce((acc, s) => acc + (Array.isArray(s.likes) ? s.likes.length : (s.likes || 0)), 0), [shorts]);
  const totalShares = useMemo(() => shorts.reduce((acc, s) => acc + (s.shares || 0), 0), [shorts]);

  // Filtered rows
  const rows = useMemo(() => {
    if (statusFilter === 'all') return shorts;
    return shorts.filter(s => s.status === statusFilter);
  }, [shorts, statusFilter]);

  const openAdd = () => {
    setForm({ ...EMPTY_SHORT });
    setEditingId(null);
  };

  const openEdit = (short) => {
    setForm({
      title: short.title || '',
      description: short.description || '',
      videoUrl: short.videoUrl || '',
      poster: short.poster || '',
      movieCode: short.movieCode || '',
      movieTitle: short.movieTitle || '',
      creatorName: short.creatorName || 'XIT FILM Official',
      creatorTag: short.creatorTag || '@xitfilm_uz',
      duration: short.duration || '0:55',
      status: short.status || 'active'
    });
    setEditingId(short.id);
  };

  // Direct Video File Upload to VPS/Server
  const handleVideoFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      return toast('Iltimos faqat video fayl tanlang (MP4, MOV, WEBM)', 'error');
    }

    const formData = new FormData();
    formData.append('video', file);

    setUploadingVideo(true);
    toast('Video yuklanmoqda, kuting...', 'info');

    try {
      const res = await movieApi.post('/upload-short-video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadingVideo(false);
      if (res.data?.success && res.data?.url) {
        setForm(prev => ({
          ...prev,
          videoUrl: res.data.url,
          title: prev.title || file.name.replace(/\.[^/.]+$/, "")
        }));
        toast('✅ Video fayl serverga yuklandi!');
      } else {
        toast('Video yuklashda xatolik yuz berdi', 'error');
      }
    } catch (err) {
      setUploadingVideo(false);
      toast(err.response?.data?.error || err.message || 'Yuklash xatoligi', 'error');
    }
  };

  // Direct Poster Image Upload
  const handlePosterFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return toast('Iltimos faqat rasm fayl tanlang (JPG, PNG, WEBP)', 'error');
    }

    const formData = new FormData();
    formData.append('poster', file);

    setUploadingPoster(true);
    try {
      const res = await movieApi.post('/upload-poster', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadingPoster(false);
      if (res.data?.success && res.data?.url) {
        setForm(prev => ({ ...prev, poster: res.data.url }));
        toast('✅ Rasm muvaffaqiyatli yuklandi!');
      }
    } catch (err) {
      setUploadingPoster(false);
      toast('Rasm yuklashda xatolik', 'error');
    }
  };

  const save = async () => {
    if (!form.videoUrl || !form.movieCode || !form.title) {
      return toast('Sarlavha, video havola va kino kodi majburiy!', 'error');
    }
    setBusy(true);

    if (editingId) {
      const { error } = await safe(movieApi.put(`/shorts/${editingId}`, form));
      setBusy(false);
      if (error) return toast(error, 'error');
      toast('Shorts muvaffaqiyatli yangilandi');
    } else {
      const { error } = await safe(movieApi.post('/shorts', form));
      setBusy(false);
      if (error) return toast(error, 'error');
      toast('Yangi Shorts qo\'shildi');
    }

    setForm(null);
    setEditingId(null);
    reload();
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    setBusy(true);
    const { error } = await safe(movieApi.delete(`/shorts/${delTarget.id}`));
    setBusy(false);
    if (error) return toast(error, 'error');
    toast('Shorts o\'chirildi');
    setDelTarget(null);
    reload();
  };

  const columns = [
    {
      key: 'poster',
      label: 'Video',
      width: 80,
      render: (s) => (
        <div 
          style={{ 
            width: 48, 
            height: 72, 
            borderRadius: 8, 
            position: 'relative', 
            overflow: 'hidden',
            cursor: 'pointer',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)'
          }}
          onClick={() => setPreviewVideo(s)}
          title="Videoni ko'rish"
        >
          {s.poster ? (
            <img src={s.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
              <Video size={20} />
            </div>
          )}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff'
          }}>
            <Play size={16} fill="#fff" />
          </div>
        </div>
      )
    },
    {
      key: 'title',
      label: 'Sarlavha & Kino',
      sortable: true,
      render: (s) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-1)', marginBottom: 4 }}>
            {s.title}
          </div>
          <div className="flex gap" style={{ alignItems: 'center', fontSize: 12 }}>
            <span className="badge badge-accent mono" style={{ fontSize: 11, padding: '2px 6px' }}>
              #{s.movieCode}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{s.movieTitle || 'Film'}</span>
            <span style={{ color: 'var(--text-3)' }}>•</span>
            <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{s.creatorTag || '@xitfilm_uz'}</span>
          </div>
        </div>
      )
    },
    {
      key: 'views',
      label: 'Ko\'rishlar',
      sortable: true,
      width: 100,
      render: (s) => (
        <div className="flex gap" style={{ alignItems: 'center', color: 'var(--text-1)', fontWeight: 600 }}>
          <Eye size={14} style={{ color: '#38bdf8' }} />
          <span>{shortNum(s.views || 0)}</span>
        </div>
      )
    },
    {
      key: 'likes',
      label: 'Likelar',
      sortable: true,
      width: 90,
      render: (s) => {
        const count = Array.isArray(s.likes) ? s.likes.length : (s.likes || 0);
        return (
          <div className="flex gap" style={{ alignItems: 'center', color: 'var(--text-1)', fontWeight: 600 }}>
            <Heart size={14} style={{ color: '#ef4444' }} />
            <span>{shortNum(count)}</span>
          </div>
        );
      }
    },
    {
      key: 'shares',
      label: 'Ulashish',
      sortable: true,
      width: 90,
      render: (s) => (
        <div className="flex gap" style={{ alignItems: 'center', color: 'var(--text-1)', fontWeight: 600 }}>
          <Share2 size={14} style={{ color: '#10b981' }} />
          <span>{shortNum(s.shares || 0)}</span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Holat',
      sortable: true,
      width: 90,
      render: (s) => s.status === 'active' ? (
        <span className="badge badge-success">Faol</span>
      ) : (
        <span className="badge badge-warning">Nofaol</span>
      )
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      width: 110,
      render: (s) => (
        <div className="flex gap" style={{ justifyContent: 'flex-end' }}>
          <button 
            className="icon-btn" 
            style={{ width: 32, height: 32, color: 'var(--accent)' }} 
            title="Tahrirlash" 
            onClick={() => openEdit(s)}
          >
            <Edit2 size={15} />
          </button>
          <button 
            className="icon-btn" 
            style={{ width: 32, height: 32, color: '#ef4444' }} 
            title="O'chirish" 
            onClick={() => setDelTarget(s)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ];

  if (loading) return <Loader full />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Metric Stats Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatCard icon={Sparkles} label="Jami Shorts" value={shorts.length} color="#8b5cf6" />
        <StatCard icon={Eye} label="Jami Ko'rishlar" value={totalViews} color="#0ea5e9" />
        <StatCard icon={Heart} label="Jami Likelar" value={totalLikes} color="#ec4899" />
        <StatCard icon={Share2} label="Ulashishlar" value={totalShares} color="#10b981" />
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="card-head">
          <div className="flex gap" style={{ alignItems: 'center' }}>
            <Clapperboard size={18} style={{ color: '#8b5cf6' }} />
            <h3>Shorts & Lavhalar Katalogi</h3>
          </div>
          <div className="spacer" />
          <Segmented
            options={[
              { value: 'all', label: `Barchasi (${shorts.length})` },
              { value: 'active', label: `Faol (${shorts.filter(s => s.status === 'active').length})` },
              { value: 'inactive', label: `Nofaol (${shorts.filter(s => s.status !== 'active').length})` }
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <button className="btn btn-primary" onClick={openAdd} style={{ marginLeft: 10 }}>
            <Plus size={16} />
            <span>Yangi Shorts</span>
          </button>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={['title', 'movieCode', 'movieTitle', 'creatorTag']}
          searchPlaceholder="Sarlavha, kod yoki film nomi bo'yicha qidirish..."
          pageSize={10}
          initialSort={{ key: 'views', dir: 'desc' }}
          emptyTitle="Shorts videolari mavjud emas"
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={!!form}
        title={editingId ? 'Shorts Videoni Tahrirlash' : 'Yangi Shorts Video Qo\'shish'}
        onClose={() => setForm(null)}
        width={580}
        footer={
          <div className="flex gap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setForm(null)} disabled={busy || uploadingVideo}>
              Bekor qilish
            </button>
            <button className="btn btn-primary" onClick={save} disabled={busy || uploadingVideo}>
              {busy ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        }
      >
        {form && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            
            {/* Direct Video File Upload Box */}
            <div style={{
              border: '2px dashed var(--border)',
              borderRadius: 14,
              padding: '16px 20px',
              background: 'var(--surface-2)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8
            }}>
              <input 
                type="file" 
                ref={videoInputRef} 
                accept="video/*" 
                style={{ display: 'none' }} 
                onChange={handleVideoFileUpload} 
              />
              
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#8b5cf6',
                display: 'grid',
                placeItems: 'center'
              }}>
                <Upload size={20} />
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
                  {uploadingVideo ? '⏳ Video serverga yuklanmoqda...' : 'Tayyor Video Faylni Tanlang (MP4)'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Kompyuteringiz yoki telefoningizdan video lavhani to'g'ridan-to'g'ri yuklang
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ fontSize: 12, padding: '6px 14px', marginTop: 4 }}
                onClick={() => videoInputRef.current?.click()}
                disabled={uploadingVideo}
              >
                {uploadingVideo ? 'Yuklanmoqda...' : '📁 Faylni tanlash'}
              </button>

              {form.videoUrl && (
                <div style={{ 
                  marginTop: 6, 
                  padding: '4px 10px', 
                  borderRadius: 8, 
                  background: 'rgba(16,185,129,0.15)', 
                  color: '#10b981', 
                  fontSize: 12, 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Check size={14} /> Video biriktirildi: {form.videoUrl}
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Sarlavha (Jalb qiluvchi nom) *</label>
              <input
                className="input"
                type="text"
                placeholder="Masalan: Titanlar Jangi 2 — Dahshatli Jang"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <div>
                <label className="form-label">Kino Kodi *</label>
                <input
                  className="input"
                  type="text"
                  placeholder="1001"
                  value={form.movieCode}
                  onChange={(e) => setForm({ ...form, movieCode: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">To'liq Film Nomi</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Titanlar Jangi 2 (2012)"
                  value={form.movieTitle}
                  onChange={(e) => setForm({ ...form, movieTitle: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Video Havolasi (URL yoki Server Yo'li) *</label>
              <input
                className="input"
                type="text"
                placeholder="/uploads/shorts/video.mp4 yoki tashqi havola"
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Poster Rasmi (Ixtiyoriy)</label>
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => posterInputRef.current?.click()}
                  disabled={uploadingPoster}
                >
                  <Image size={13} style={{ marginRight: 4 }} />
                  {uploadingPoster ? 'Yuklanmoqda...' : 'Rasm yuklash'}
                </button>
              </div>
              <input 
                type="file" 
                ref={posterInputRef} 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handlePosterFileUpload} 
              />
              <input
                className="input"
                type="text"
                placeholder="/uploads/posters/poster.jpg yoki havola"
                value={form.poster}
                onChange={(e) => setForm({ ...form, poster: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Tavsif (Description)</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Qisqa qiziqarli sharh..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Muallif Tege</label>
                <input
                  className="input"
                  type="text"
                  placeholder="@xitfilm_uz"
                  value={form.creatorTag}
                  onChange={(e) => setForm({ ...form, creatorTag: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Holat</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">Faol (Active)</option>
                  <option value="inactive">Nofaol (Inactive)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Video Preview Modal */}
      <Modal
        open={!!previewVideo}
        title={previewVideo?.title || 'Shorts Videoni Ko\'rish'}
        onClose={() => setPreviewVideo(null)}
        width={400}
      >
        {previewVideo && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: '100%', height: 480, background: '#000', borderRadius: 16, overflow: 'hidden' }}>
              <video
                src={previewVideo.videoUrl}
                poster={previewVideo.poster}
                controls
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ width: '100%', fontSize: 13, color: 'var(--text-muted)' }}>
              <div><strong>Kino:</strong> #{previewVideo.movieCode} - {previewVideo.movieTitle}</div>
              <div><strong>Muallif:</strong> {previewVideo.creatorTag}</div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!delTarget}
        title="Shortsni O'chirish"
        onClose={() => setDelTarget(null)}
        width={420}
        footer={
          <div className="flex gap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setDelTarget(null)} disabled={busy}>
              Bekor qilish
            </button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={busy}>
              {busy ? 'O\'chirilmoqda...' : 'O\'chirish'}
            </button>
          </div>
        }
      >
        {delTarget && (
          <p>
            Haqiqatan ham «<strong>{delTarget.title}</strong>» nomli shorts lavhani o'chirmoqchimisiz?
          </p>
        )}
      </Modal>
    </div>
  );
}
