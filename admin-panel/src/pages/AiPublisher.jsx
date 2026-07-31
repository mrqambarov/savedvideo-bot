import { useState } from 'react';
import { Sparkles, Send, Copy, Check, Film, Share2, Rocket, Instagram, MessageSquare } from 'lucide-react';
import { movieApi, safe } from '../lib/api.js';

export default function AiPublisher() {
  const [title, setTitle] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [genre, setGenre] = useState('Jangari / Triller');
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [copiedInsta, setCopiedInsta] = useState(false);
  const [publishStatus, setPublishStatus] = useState(null);

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setPublishStatus(null);
    const { data } = await safe(movieApi.post('/ai-generate-movie-promo', { title, customCode, genre }));
    if (data) {
      setAiData(data);
      if (!customCode) setCustomCode(data.code);
    }
    setLoading(false);
  };

  const handleCopyInstagram = () => {
    if (!aiData?.instagramCaption) return;
    navigator.clipboard.writeText(aiData.instagramCaption);
    setCopiedInsta(true);
    setTimeout(() => setCopiedInsta(false), 2000);
  };

  const handlePublish = async () => {
    if (!aiData) return;
    setPublishing(true);
    setPublishStatus(null);

    // 1. Add movie to DB
    const addRes = await safe(movieApi.post('/movies', {
      code: aiData.code,
      title: aiData.title,
      genre: aiData.genre,
      description: aiData.description,
      fileId: 'BAACAgIAAxkBAAI' // Placeholder until file upload
    }));

    // 2. Publish promo to Telegram Channel
    const pubRes = await safe(movieApi.post('/publish-social-promo', {
      code: aiData.code,
      title: aiData.title,
      telegramPostText: aiData.telegramPostText
    }));

    setPublishing(false);
    if (addRes.data || pubRes.data) {
      setPublishStatus({
        success: true,
        msg: `✅ Kino (Kod: ${aiData.code}) bazaga saqlandi va promo kanalga avto-post qilindi!`
      });
    } else {
      setPublishStatus({
        success: false,
        msg: `❌ Post qilishda muammo yuz berdi.`
      });
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="card" style={{ border: '1px solid var(--border-strong)', background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-hover) 100%)', marginBottom: 24 }}>
        <div className="card-head" style={{ justifyContent: 'space-between' }}>
          <h3><Sparkles size={20} color="#ffc107" style={{ verticalAlign: -3, marginRight: 8 }} />AI Movie Publisher & Auto Social Promo Generator</h3>
          <span className="badge badge-accent">⚡️ 1-CLICK AUTOMATION</span>
        </div>
        <div className="card-pad">
          <form onSubmit={handleGenerate} className="grid grid-3 gap" style={{ alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                🎬 Kino Nomi:
              </label>
              <input
                type="text"
                className="input"
                placeholder="Masalan: Avatar 3 (Suv Yo'li)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                🔑 Kino Kodi (Ixtiyoriy):
              </label>
              <input
                type="text"
                className="input"
                placeholder="Avto-generatsiya"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                🗂 Janri:
              </label>
              <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="Jangari / Triller">Jangari / Triller</option>
                <option value="Komediya">Komediya</option>
                <option value="Melodrama">Melodrama</option>
                <option value="Multfilm">Multfilm</option>
                <option value="Tarixiy">Tarixiy</option>
                <option value="Sarguzasht">Sarguzasht</option>
              </select>
            </div>
          </form>

          <button
            className="btn btn-primary mt"
            style={{ width: '100%', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15 }}
            onClick={handleGenerate}
            disabled={loading || !title.trim()}
          >
            {loading ? '⚡️ AI Generatsiya qilinmoqda...' : '✨ AI Bilan Yaratish (Auto-Generate Copy)'}
          </button>
        </div>
      </div>

      {publishStatus && (
        <div className={`card mb`} style={{ padding: 16, background: publishStatus.success ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${publishStatus.success ? '#10b981' : '#ef4444'}`, borderRadius: 12, color: publishStatus.success ? '#10b981' : '#ef4444', fontWeight: 600 }}>
          {publishStatus.msg}
        </div>
      )}

      {aiData && (
        <div className="grid grid-2 gap">
          {/* Instagram / TikTok Reels Copy Card */}
          <div className="card">
            <div className="card-head" style={{ justifyContent: 'space-between' }}>
              <h3><Instagram size={18} color="#e1306c" style={{ verticalAlign: -3, marginRight: 6 }} />Instagram Reels / TikTok Matni</h3>
              <button className="btn btn-ghost btn-sm" onClick={handleCopyInstagram}>
                {copiedInsta ? <Check size={14} color="#10b981" /> : <Copy size={14} />} {copiedInsta ? 'Nusxalandi' : 'Nusxalash'}
              </button>
            </div>
            <div className="card-pad">
              <pre style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 12, fontSize: 13, whiteSpace: 'pre-wrap', border: '1px solid var(--border)', lineHeight: 1.5, fontFamily: 'sans-serif' }}>
                {aiData.instagramCaption}
              </pre>
            </div>
          </div>

          {/* Telegram Channel Announcement Card */}
          <div className="card">
            <div className="card-head">
              <h3><MessageSquare size={18} color="#0ea5e9" style={{ verticalAlign: -3, marginRight: 6 }} />Telegram Kanal E'lon Matni</h3>
            </div>
            <div className="card-pad">
              <pre style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 12, fontSize: 13, whiteSpace: 'pre-wrap', border: '1px solid var(--border)', lineHeight: 1.5, fontFamily: 'sans-serif' }}>
                {aiData.telegramPostText}
              </pre>
              <div style={{ marginTop: 12, padding: 10, background: 'rgba(99,102,241,0.1)', borderRadius: 8, fontSize: 12, color: '#6366f1' }}>
                🔗 Auto Link: {aiData.botLink}
              </div>

              <button
                className="btn btn-success mt"
                style={{ width: '100%', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15 }}
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? '🚀 Avto-post qilinmoqda...' : '🚀 Bazaga Saqlash va Kanalga Post Qilish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
