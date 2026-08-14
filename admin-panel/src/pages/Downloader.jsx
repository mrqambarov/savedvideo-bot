import { useState, useEffect, useRef } from 'react';
import { Download, Play, Square, RefreshCw, Key, Radio, CheckCircle2, AlertCircle, Save, Video, Users, Eye, Plus, Trash2, Cookie, Upload } from 'lucide-react';
import { dlApi, safe } from '../lib/api.js';
import { useStats } from '../lib/useData.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader } from '../components/ui.jsx';
import { nf } from '../lib/format.js';

export default function Downloader() {
  const { toast } = useApp();
  const { dl } = useStats();
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const loadData = async () => {
    const [sRes, cRes] = await Promise.all([
      safe(dlApi.get('/bot-status')),
      safe(dlApi.get('/config'))
    ]);
    if (sRes.data) setStatus(sRes.data);
    const configData = cRes.data || {
      sponsorUsername: '@XitFilm_uz',
      sponsorLink: 'https://t.me/XitFilm_uz',
      sponsorChannels: [{ username: '@XitFilm_uz', link: 'https://t.me/XitFilm_uz', title: '1-Homiy Kanal' }]
    };
    let channels = configData.sponsorChannels || [];
    if (!Array.isArray(channels) || channels.length === 0) {
      channels = [
        { username: configData.sponsorUsername || '', link: configData.sponsorLink || '', title: '1-Homiy Kanal' }
      ];
    }
    setConfig({ ...configData, sponsorChannels: channels });
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  const toggleBot = async (action) => {
    setBusy(true);
    const { data, error } = await safe(dlApi.post('/bot-status', { action }));
    setBusy(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast(action === 'start' ? 'Downloader Bot ishga tushirildi' : 'Downloader Bot to\'xtatildi');
      if (data?.status) setStatus(data.status);
    }
  };

  const handleChannelChange = (index, field, value) => {
    const updated = [...(config.sponsorChannels || [])];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, sponsorChannels: updated });
  };

  const addChannel = () => {
    const current = config.sponsorChannels || [];
    if (current.length >= 5) {
      return toast("Maksimal 5 ta majburiy kanal qo'shish mumkin!", "error");
    }
    const nextNum = current.length + 1;
    setConfig({
      ...config,
      sponsorChannels: [...current, { username: '', link: '', title: `${nextNum}-Homiy Kanal` }]
    });
  };

  const removeChannel = (index) => {
    const current = config.sponsorChannels || [];
    if (current.length <= 1) {
      return toast("Kamida 1 ta kanal qolishi kerak!", "error");
    }
    const updated = current.filter((_, i) => i !== index);
    setConfig({ ...config, sponsorChannels: updated });
  };

  const uploadCookies = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('cookies', file);
    setUploading(true);
    const { error } = await safe(dlApi.post('/upload-cookies', fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    if (error) return toast(error, 'error');
    toast('cookies.txt yangilandi! YouTube yuklamalari tiklandi');
  };

  const saveConfig = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const channelsToSave = (config.sponsorChannels || []).slice(0, 5);
    const firstChan = channelsToSave[0] || {};

    const payload = {
      ...config,
      shazamKey: config.shazamKey && config.shazamKey.includes('...') ? undefined : config.shazamKey,
      botToken: config.botToken && config.botToken.includes('...') ? undefined : config.botToken,
      sponsorUsername: firstChan.username || '',
      sponsorLink: firstChan.link || '',
      sponsorChannels: channelsToSave
    };

    const { data, error } = await safe(dlApi.post('/config', payload));
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error });
      toast(error, 'error');
    } else {
      setMsg({ type: 'success', text: "Downloader Bot va 5 ta majburiy obuna kanallari muvaffaqiyatli saqlandi!" });
      toast("Sozlamalar saqlandi");
      loadData();
    }
  };

  if (!config) return <Loader full />;

  const isRunning = status?.running ?? true;
  const channels = config.sponsorChannels || [];

  return (
    <div className="grid grid-2" style={{ maxWidth: 1050, gap: 20 }}>
      {msg && (
        <div style={{ gridColumn: '1 / -1', padding: '14px 18px', borderRadius: 10, background: msg.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: msg.type === 'error' ? '#ef4444' : '#10b981', border: `1px solid ${msg.type === 'error' ? '#ef4444' : '#10b981'}`, fontWeight: 600, fontSize: 14 }}>
          {msg.type === 'error' ? <AlertCircle size={16} style={{ verticalAlign: -2, marginRight: 6 }} /> : <CheckCircle2 size={16} style={{ verticalAlign: -2, marginRight: 6 }} />}
          {msg.text}
        </div>
      )}

      {/* Header Banner */}
      <div className="card" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(79,70,229,0.05) 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>
        <div className="card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 24, boxShadow: '0 6px 20px rgba(99,102,241,0.4)' }}>
              📥
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                📥 Downloader Bot Studio
                <span className={`badge ${isRunning ? 'badge-success' : 'badge-danger'}`} style={{ padding: '4px 10px', fontSize: 11 }}>
                  {isRunning ? '● ONLAYN' : '○ OFFLAYN'}
                </span>
              </div>
              <div className="cell-sub" style={{ fontSize: 13, marginTop: 4 }}>
                Video, audio va dumaloq video yuklovchi bot sozlamalari, cookies.txt va 5 ta majburiy obuna kanallarini boshqarish
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {isRunning ? (
              <button className="btn btn-danger" onClick={() => toggleBot('stop')} disabled={busy}>
                <Square size={16} /> To'xtatish
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => toggleBot('start')} disabled={busy} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <Play size={16} /> Ishga Tushirish
              </button>
            )}
            <button className="btn btn-ghost" onClick={loadData} title="Yangilash">
              <RefreshCw size={16} className={busy ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="stat" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Yuklamalar Soni</div>
              <div className="stat-value">{nf((dl?.usage?.today?.downloadsVideo || 0) + (dl?.usage?.today?.downloadsAudio || 0))}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff' }}>
              <Download size={20} />
            </div>
          </div>
        </div>

        <div className="stat" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Foydalanuvchilar</div>
              <div className="stat-value">{nf(dl?.totalUsers || 0)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff' }}>
              <Users size={20} />
            </div>
          </div>
        </div>

        <div className="stat" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Bugun Faollar</div>
              <div className="stat-value">{nf(dl?.active?.today || 0)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
              <Eye size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* YouTube Cookies Card */}
      <div className="card" style={{ gridColumn: '1 / -1', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 750, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
              <Cookie size={18} color="#6366f1" /> YouTube Cookies.txt Boshqaruvi
            </div>
            <div className="cell-sub" style={{ marginTop: 2 }}>
              YouTube blokirovkasi hamda "Sign in to confirm you're not a bot" xatosini tuzatish uchun yangi cookies.txt faylini yuklang
            </div>
          </div>
          <div>
            <input ref={fileRef} type="file" accept=".txt" hidden onChange={uploadCookies} />
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              {uploading ? <span className="spinner" /> : <><Upload size={16} /> cookies.txt Faylini Yuklash</>}
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head">
          <h3><Key size={17} style={{ verticalAlign: -3, marginRight: 8, color: '#6366f1' }} />Downloader Bot Sozlamalari</h3>
        </div>
        <div className="card-pad">
          <form onSubmit={saveConfig}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                  Telegram Bot Token (@BotFather)
                </label>
                <input
                  type="text"
                  className="input mono"
                  placeholder="789012...XYZ"
                  value={config.botToken || ''}
                  onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px' }}
                />
                <div className="cell-sub" style={{ marginTop: 4 }}>
                  Downloader bot uchun Telegram API tokeni
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                  Shazam RapidAPI Kaliti (Musiqani anlash)
                </label>
                <input
                  type="text"
                  className="input mono"
                  placeholder="rapidapi-key..."
                  value={config.shazamKey || ''}
                  onChange={(e) => setConfig({ ...config, shazamKey: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px' }}
                />
                <div className="cell-sub" style={{ marginTop: 4 }}>
                  Audio/musiqalarni avtomatik aniqlash kaliti
                </div>
              </div>

              {/* 5 Mandatory Sponsor Channels Section */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 10 }}>
                <div className="between" style={{ marginBottom: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Radio size={18} color="#6366f1" /> 5 ta Majburiy Obuna Homiy Kanallari (Sponsor Guard)
                    </h4>
                    <div className="cell-sub" style={{ marginTop: 2 }}>
                      Foydalanuvchi botdan yuklash bajarishdan oldin obuna bo'lishi shart bo'lgan kanallar (Maksimal 5 ta)
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={addChannel}
                    disabled={channels.length >= 5}
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}
                  >
                    <Plus size={15} /> Kanal Qo'shish ({channels.length}/5)
                  </button>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 650, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={config.sponsorEnabled ?? true}
                      onChange={(e) => setConfig({ ...config, sponsorEnabled: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: '#6366f1' }}
                    />
                    Majburiy obunani faollashtirish (Sponsor Channel Guard Check)
                  </label>
                </div>

                {(config.sponsorEnabled ?? true) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {channels.map((chan, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--surface-2)',
                          padding: '14px 16px',
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr 1fr auto',
                          gap: 12,
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontWeight: 800, display: 'grid', placeItems: 'center', fontSize: 13 }}>
                          #{idx + 1}
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--text-2)' }}>Kanal Username / ID</label>
                          <input
                            type="text"
                            className="input mono"
                            placeholder="@kanal_1 yoki -1001234567"
                            value={chan.username || ''}
                            onChange={(e) => handleChannelChange(idx, 'username', e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--text-2)' }}>Kanal Havolasi (Link)</label>
                          <input
                            type="text"
                            className="input mono"
                            placeholder="https://t.me/kanal_1 yoki https://t.me/+hash"
                            value={chan.link || ''}
                            onChange={(e) => handleChannelChange(idx, 'link', e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
                          />
                        </div>

                        <div style={{ paddingTop: 18 }}>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => removeChannel(idx)}
                            disabled={channels.length <= 1}
                            style={{ color: '#ef4444', width: 34, height: 34 }}
                            title="O'chirish"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
                style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
              >
                <Save size={16} /> {busy ? 'Saqlanmoqda...' : 'Downloader Bot Sozlamalarini Saqlash'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
