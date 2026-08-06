import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Film, Tv, Hash, FileVideo, RefreshCw, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { movieApi, safe } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader, Modal } from '../components/ui.jsx';
import { nf, fmtDate } from '../lib/format.js';

function EpisodeRow({ ep, onDelete, serialCode }) {
    const [busy, setBusy] = useState(false);
    const { toast } = useApp();

    const handleDelete = async () => {
        if (!confirm(`${ep.episode}-qismni o'chirishni tasdiqlaysizmi?`)) return;
        setBusy(true);
        const { error } = await safe(movieApi.delete(`/movies/${serialCode}/episodes/${ep.episode}`));
        setBusy(false);
        if (error) { toast(error, 'error'); return; }
        toast(`${ep.episode}-qism o'chirildi`);
        onDelete(ep.episode);
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px', background: 'var(--surface-2)',
            borderRadius: 8, border: '1px solid var(--border)',
            transition: 'all 250ms'
        }}>
            <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'linear-gradient(135deg, var(--primary), var(--purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0
            }}>
                {ep.episode}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{ep.title || `${ep.episode}-qism`}</div>
                {ep.fileId && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📁 {ep.fileId.substring(0, 30)}...
                    </div>
                )}
                {ep.dateAdded && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>📅 {fmtDate(ep.dateAdded)}</div>
                )}
            </div>
            <button className="icon-btn" style={{ width: 32, height: 32, color: 'var(--rose)' }} onClick={handleDelete} disabled={busy}>
                {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Trash2 size={14} />}
            </button>
        </div>
    );
}

function AddEpisodeModal({ open, onClose, serialCode, totalEpisodes, onAdded }) {
    const { toast } = useApp();
    const [form, setForm] = useState({ episodeNumber: '', fileId: '', title: '' });
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (open) {
            setForm({ episodeNumber: String(totalEpisodes + 1), fileId: '', title: '' });
        }
    }, [open, totalEpisodes]);

    const save = async () => {
        if (!form.episodeNumber || !form.fileId) {
            toast('Qism raqami va File ID majburiy!', 'error');
            return;
        }
        setBusy(true);
        const { error, data } = await safe(movieApi.post(`/movies/${serialCode}/episodes`, {
            episodeNumber: Number(form.episodeNumber),
            fileId: form.fileId.trim(),
            title: form.title.trim() || `${form.episodeNumber}-qism`
        }));
        setBusy(false);
        if (error) { toast(error, 'error'); return; }
        toast(`✅ ${form.episodeNumber}-qism muvaffaqiyatli qo'shildi!`);
        onAdded();
        onClose();
    };

    return (
        <Modal
            open={open}
            title="Yangi Qism Qo'shish"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn-ghost" onClick={onClose}>Bekor</button>
                    <button className="btn btn-primary" onClick={save} disabled={busy}>
                        {busy ? <span className="spinner" /> : <><Plus size={15} /> Qo'shish</>}
                    </button>
                </>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                    <label>Qism Raqami *</label>
                    <input
                        className="input"
                        type="number"
                        min="1"
                        value={form.episodeNumber}
                        onChange={e => setForm({ ...form, episodeNumber: e.target.value })}
                        placeholder="1"
                    />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                    <label>Qism Nomi (ixtiyoriy)</label>
                    <input
                        className="input"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder={`${form.episodeNumber}-qism`}
                    />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                    <label>Telegram File ID *</label>
                    <input
                        className="input mono"
                        value={form.fileId}
                        onChange={e => setForm({ ...form, fileId: e.target.value })}
                        placeholder="BAACAg... (videoga reply qilib /add_episode buyrug'i orqali ham qo'shish mumkin)"
                    />
                    <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>
                        💡 Bot ichida: videoga reply qilib <code>/add_episode {serialCode} {form.episodeNumber || 'N'}</code> yozing
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function SerialCard({ serial, onUpdated }) {
    const [expanded, setExpanded] = useState(false);
    const [episodes, setEpisodes] = useState(serial.episodes || []);
    const [addOpen, setAddOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useApp();

    const loadEpisodes = async () => {
        setLoading(true);
        const { data } = await safe(movieApi.get(`/movies/${serial.code}/episodes`));
        setLoading(false);
        if (Array.isArray(data)) setEpisodes(data);
    };

    const handleExpand = () => {
        if (!expanded) loadEpisodes();
        setExpanded(v => !v);
    };

    const handleDelete = (epNum) => {
        setEpisodes(prev => prev.filter(e => Number(e.episode) !== Number(epNum)));
        onUpdated?.();
    };

    const episodeCount = episodes.length;
    const filledEps = episodes.filter(e => e.fileId).length;

    return (
        <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            overflow: 'hidden',
            transition: 'all 250ms',
            marginBottom: 16
        }}>
            {/* Header */}
            <div
                style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 20px', cursor: 'pointer',
                    background: expanded
                        ? 'linear-gradient(90deg, rgba(139,92,246,0.08) 0%, transparent 100%)'
                        : 'transparent',
                    transition: 'background 250ms'
                }}
                onClick={handleExpand}
            >
                <div style={{
                    width: 48, height: 68, borderRadius: 8, flexShrink: 0,
                    background: serial.poster
                        ? `url(${serial.poster}) center/cover`
                        : 'linear-gradient(135deg, #8b5cf6, #d946ef)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    {!serial.poster && <Tv size={20} color="rgba(255,255,255,0.8)" />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{serial.title}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(139,92,246,0.12)', color: 'var(--primary)', fontSize: 11, fontWeight: 700 }}>
                            Serial
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Hash size={12} /> Kod: <span className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>{serial.code}</span>
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Film size={12} /> {episodeCount} ta qism
                        </span>
                        {filledEps < episodeCount && (
                            <span style={{ fontSize: 12, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AlertCircle size={12} /> {episodeCount - filledEps} ta qism noto'liq
                            </span>
                        )}
                        {episodeCount > 0 && filledEps === episodeCount && (
                            <span style={{ fontSize: 12, color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={12} /> Barcha qismlar yuklangan
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        className="btn btn-primary btn-sm"
                        style={{ gap: 6, padding: '6px 12px', fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); setAddOpen(true); }}
                    >
                        <Plus size={13} /> Qism Qo'shish
                    </button>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)', transition: 'transform 250ms',
                        transform: expanded ? 'rotate(90deg)' : 'none'
                    }}>
                        <ChevronRight size={16} />
                    </div>
                </div>
            </div>

            {/* Expanded Episodes */}
            {expanded && (
                <div style={{
                    borderTop: '1px solid var(--border)',
                    padding: '16px 20px',
                    display: 'flex', flexDirection: 'column', gap: 8
                }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', padding: '12px 0' }}>
                            <span className="spinner" style={{ width: 16, height: 16 }} /> Yuklanmoqda...
                        </div>
                    ) : episodes.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '24px',
                            background: 'var(--surface-2)', borderRadius: 10,
                            color: 'var(--text-dim)', fontSize: 13.5
                        }}>
                            <Tv size={28} style={{ marginBottom: 8, opacity: 0.4, display: 'block', margin: '0 auto 8px' }} />
                            Hozircha hech qanday qism yuklanmagan.
                            <br />
                            <span style={{ fontSize: 12 }}>Bot ichida: videoga reply qilib <code>/add_episode {serial.code} [qism_raqami]</code> yozing</span>
                        </div>
                    ) : (
                        <>
                            {/* Progress bar */}
                            <div style={{
                                height: 6, background: 'rgba(255,255,255,0.04)',
                                borderRadius: 3, overflow: 'hidden', marginBottom: 8
                            }}>
                                <div style={{
                                    width: `${episodeCount > 0 ? (filledEps / episodeCount) * 100 : 0}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, var(--primary), var(--emerald))',
                                    borderRadius: 3, transition: 'width 500ms'
                                }} />
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {[...episodes].sort((a, b) => a.episode - b.episode).map(ep => (
                                    <EpisodeRow key={ep.episode} ep={ep} serialCode={serial.code} onDelete={handleDelete} />
                                ))}
                            </div>
                        </>
                    )}

                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={loadEpisodes}
                        style={{ marginTop: 4, alignSelf: 'flex-start', gap: 6 }}
                    >
                        <RefreshCw size={13} /> Yangilash
                    </button>
                </div>
            )}

            <AddEpisodeModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                serialCode={serial.code}
                totalEpisodes={episodeCount}
                onAdded={() => { loadEpisodes(); onUpdated?.(); }}
            />
        </div>
    );
}

function CreateSerialModal({ open, onClose, onCreated }) {
    const { toast } = useApp();
    const [form, setForm] = useState({ code: '', title: '', description: '', poster: '' });
    const [busy, setBusy] = useState(false);

    const save = async () => {
        if (!form.code || !form.title) {
            toast('Kod va sarlavha majburiy!', 'error');
            return;
        }
        setBusy(true);
        const { error } = await safe(movieApi.post('/movies', {
            code: form.code.trim(),
            title: form.title.trim(),
            description: form.description.trim(),
            poster: form.poster.trim(),
            fileId: 'serial_placeholder',
            genre: 'Serial',
            isSerial: true
        }));
        setBusy(false);
        if (error) { toast(error, 'error'); return; }
        toast(`✅ "${form.title}" seriali yaratildi!`);
        setForm({ code: '', title: '', description: '', poster: '' });
        onCreated();
        onClose();
    };

    return (
        <Modal
            open={open}
            title="Yangi Serial Yaratish"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn-ghost" onClick={onClose}>Bekor</button>
                    <button className="btn btn-primary" onClick={save} disabled={busy}>
                        {busy ? <span className="spinner" /> : <><Tv size={15} /> Yaratish</>}
                    </button>
                </>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div className="field">
                    <label>Serial Kodi *</label>
                    <input className="input mono" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="masalan: 200" />
                    <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 4 }}>Foydalanuvchilar bu kodni kiritib serialni topadi</div>
                </div>
                <div className="field">
                    <label>Serial Nomi *</label>
                    <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="masalan: Squid Game" />
                </div>
                <div className="field">
                    <label>Tavsif</label>
                    <textarea className="textarea" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Serial haqida qisqa ma'lumot..." />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                    <label>Poster URL (ixtiyoriy)</label>
                    <input className="input mono" value={form.poster} onChange={e => setForm({ ...form, poster: e.target.value })} placeholder="https://.../poster.jpg" />
                </div>
            </div>
        </Modal>
    );
}

export default function Serials() {
    const [serials, setSerials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [search, setSearch] = useState('');

    const loadSerials = async () => {
        setLoading(true);
        const { data } = await safe(movieApi.get('/serials'));
        setLoading(false);
        if (Array.isArray(data)) setSerials(data);
    };

    useEffect(() => { loadSerials(); }, []);

    const filtered = serials.filter(s =>
        !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.code.includes(search)
    );

    const totalEps = serials.reduce((sum, s) => sum + (s.episodes?.length || 0), 0);

    if (loading) return <Loader full />;

    return (
        <div>
            {/* Stats bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                    { label: 'Jami Seriallar', value: nf(serials.length), color: 'var(--primary)', icon: Tv },
                    { label: 'Jami Qismlar', value: nf(totalEps), color: 'var(--purple)', icon: Film },
                    { label: "O'rtacha Qism", value: serials.length ? Math.round(totalEps / serials.length) : 0, color: 'var(--emerald)', icon: Hash },
                ].map(s => (
                    <div key={s.label} className="stat" style={{ borderLeft: `4px solid ${s.color}`, margin: 0, padding: 16 }}>
                        <div className="stat-top">
                            <div>
                                <div className="stat-label">{s.label}</div>
                                <div className="stat-value" style={{ fontSize: 26, marginTop: 6 }}>{s.value}</div>
                            </div>
                            <div className="stat-ico" style={{ background: `${s.color}20`, color: s.color, width: 38, height: 38 }}>
                                <s.icon size={18} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Card */}
            <div className="card">
                <div className="card-head">
                    <Tv size={18} style={{ color: 'var(--primary)' }} />
                    <h3>Serial Kutubxonasi</h3>
                    <span className="badge badge-muted">{nf(serials.length)} ta serial</span>
                    <div className="spacer" />
                    <input
                        className="input"
                        style={{ width: 240, marginRight: 12 }}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Serial qidirish..."
                    />
                    <button className="btn btn-ghost btn-sm" onClick={loadSerials}>
                        <RefreshCw size={14} /> Yangilash
                    </button>
                    <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => setCreateOpen(true)}>
                        <Plus size={15} /> Yangi Serial
                    </button>
                </div>

                {filtered.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '48px 0',
                        color: 'var(--text-dim)'
                    }}>
                        <Tv size={40} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                            {search ? 'Qidiruv bo\'yicha serial topilmadi' : 'Hozircha seriallar yo\'q'}
                        </div>
                        <div style={{ fontSize: 13 }}>
                            {!search && '"Yangi Serial" tugmasini bosib birinchi serialingizni yarating'}
                        </div>
                    </div>
                ) : (
                    <div>
                        {filtered.map(serial => (
                            <SerialCard key={serial.code} serial={serial} onUpdated={loadSerials} />
                        ))}
                    </div>
                )}
            </div>

            {/* Help Card */}
            <div className="card" style={{ background: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.15)' }}>
                <div className="card-head">
                    <FileVideo size={16} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ fontSize: 15 }}>Bot orqali Qism Yuklash</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--primary)' }}>📋 1-usul: Bot buyrug'i</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                            1. Bot chatiga kino faylini yuboring<br />
                            2. O'sha faylga <strong>reply</strong> qilib yozing:<br />
                            <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                                /add_episode [serial_kodi] [qism_raqami]
                            </code><br />
                            <em>Masalan: /add_episode 200 5</em>
                        </div>
                    </div>
                    <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--emerald)' }}>🖥️ 2-usul: Admin Panel</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                            1. Yuqorida serialni toping<br />
                            2. <strong>"Qism Qo'shish"</strong> tugmasini bosing<br />
                            3. Qism raqami va Telegram File ID kiriting<br />
                            <em>File ID ni bot adminida /add_episode buyrug'i orqali olishingiz mumkin</em>
                        </div>
                    </div>
                </div>
            </div>

            <CreateSerialModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={loadSerials} />
        </div>
    );
}
