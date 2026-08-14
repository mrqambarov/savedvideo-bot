import { useState, useEffect } from 'react';
import { Film, Play, Square, RefreshCw, Key, Radio, CheckCircle2, AlertCircle, Save, Video, Users, Eye, Plus, Trash2, Megaphone, Send } from 'lucide-react';
import { movieApi, safe } from '../lib/api.js';
import { useStats } from '../lib/useData.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader } from '../components/ui.jsx';
import { nf } from '../lib/format.js';

export default function MovieBot() {
  const { toast } = useApp();
  const { movie } = useStats();
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [autoPostSettings, setAutoPostSettings] = useState({
    autoPostEnabled: true,
    autoPostChannel: ''
  });
  const [busy, setBusy] = useState(false);
  const [autoPostBusy, setAutoPostBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const loadData = async () => {
    const [sRes, cRes, setRes] = await Promise.all([
      safe(movieApi.get('/bot-status')),
      safe(movieApi.get('/config')),
      safe(movieApi.get('/settings'))
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
    if (setRes.data) {
      setAutoPostSettings({
        autoPostEnabled: setRes.data.autoPostEnabled ?? true,
        autoPostChannel: setRes.data.autoPostChannel || ''
      });
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  const saveAutoPostSettings = async (e) => {
    e.preventDefault();
    setAutoPostBusy(true);
    const { data, error } = await safe(movieApi.post('/settings', autoPostSettings));
    setAutoPostBusy(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast('Telegram Kanal Auto-Post sozlamalari saqlandi!');
      if (data?.settings) {
        setAutoPostSettings({
          autoPostEnabled: data.settings.autoPostEnabled ?? true,
          autoPostChannel: data.settings.autoPostChannel || ''
        });
      }
    }
  };

  const toggleBot = async (action) => {
    setBusy(true);
    const { data, error } = await safe(movieApi.post('/bot-status', { action }));
    setBusy(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast(action === 'start' ? 'Kino Bot ishga tushirildi' : 'Kino Bot to\'xtatildi');
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

  const saveConfig = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const channelsToSave = (config.sponsorChannels || []).slice(0, 5);
    const firstChan = channelsToSave[0] || {};

    const payload = {
      ...config,
      botToken: config.botToken && config.botToken.includes('...') ? undefined : config.botToken,
      sponsorUsername: firstChan.username || '',
      sponsorLink: firstChan.link || '',
      sponsorChannels: channelsToSave
    };

    const { data, error } = await safe(movieApi.post('/config', payload));
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error });
      toast(error, 'error');
    } else {
      setMsg({ type: 'success', text: "Kino Bot va 5 ta majburiy obuna kanallari muvaffaqiyatli saqlandi!" });
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
      <div className="card" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, rgba(217,70,239,0.1) 0%, rgba(168,85,247,0.05) 100%)', border: '1px solid rgba(217,70,239,0.3)' }}>
        <div className="card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #d946ef 0%, #a855f7 100%)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 24, boxShadow: '0 6px 20px rgba(217,70,239,0.4)' }}>
              🎬
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                🎬 Kino Bot Studio
                <span className={`badge ${isRunning ? 'badge-success' : 'badge-danger'}`} style={{ padding: '4px 10px', fontSize: 11 }}>
                  {isRunning ? '● ONLAYN' : '○ OFFLAYN'}
                </span>
              </div>
              <div className="cell-sub" style={{ fontSize: 13, marginTop: 4 }}>
                Kino bot va qidiruv sozlamalari, Telegram Bot tokeni va 5 ta majburiy obuna kanallarini boshqarish
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
        <div className="stat" style={{ borderLeft: '4px solid #d946ef' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Kino Katalogi</div>
              <div className="stat-value">{nf(movie?.totalMovies || 0)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, #d946ef, #c026d3)', color: '#fff' }}>
              <Film size={20} />
            </div>
          </div>
        </div>

        <div className="stat" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Foydalanuvchilar</div>
              <div className="stat-value">{nf(movie?.totalUsers || 0)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff' }}>
              <Users size={20} />
            </div>
          </div>
        </div>

        <div className="stat" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Jami Ko'rishlar</div>
              <div className="stat-value">{nf(movie?.totalViews || 0)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}>
              <Eye size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head">
          <h3><Key size={17} style={{ verticalAlign: -3, marginRight: 8, color: '#d946ef' }} />Kino Bot Sozlamalari</h3>
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
                  placeholder="896898...EZzk"
                  value={config.botToken || ''}
                  onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px' }}
                />
                <div className="cell-sub" style={{ marginTop: 4 }}>
                  Kino bot uchun Telegram API tokeni
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                  Admin ID lar (Vergul bilan)
                </label>
                <input
                  type="text"
                  className="input mono"
                  placeholder="6263659922, 5839622003"
                  value={config.adminIds || ''}
                  onChange={(e) => setConfig({ ...config, adminIds: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px' }}
                />
                <div className="cell-sub" style={{ marginTop: 4 }}>
                  Xabarnoma va kino so'rovlarini oluvchi admin Telegram ID lari
                </div>
              </div>

              {/* 5 Mandatory Sponsor Channels Section */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 10 }}>
                <div className="between" style={{ marginBottom: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Radio size={18} color="#d946ef" /> 5 ta Majburiy Obuna Homiy Kanallari (Sponsor Guard)
                    </h4>
                    <div className="cell-sub" style={{ marginTop: 2 }}>
                      Foydalanuvchi botdan foydalanishi uchun obuna bo'lishi shart bo'lgan kanallar (Maksimal 5 ta)
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={addChannel}
                    disabled={channels.length >= 5}
                    style={{ background: 'rgba(217,70,239,0.1)', color: '#d946ef', border: '1px solid rgba(217,70,239,0.3)' }}
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
                      style={{ width: 18, height: 18, accentColor: '#d946ef' }}
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
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(217,70,239,0.15)', color: '#d946ef', fontWeight: 800, display: 'grid', placeItems: 'center', fontSize: 13 }}>
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
                style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #d946ef 0%, #a855f7 100%)', boxShadow: '0 4px 16px rgba(217,70,239,0.35)' }}
              >
                <Save size={16} /> {busy ? 'Saqlanmoqda...' : 'Kino Bot Sozlamalarini Saqlash'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Telegram Channel Auto-Poster Card */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Megaphone size={18} style={{ color: '#10b981' }} />
            Telegram Kanal Avto-Posting (Auto-Publisher)
          </h3>
          <span className={`badge ${autoPostSettings.autoPostEnabled && autoPostSettings.autoPostChannel ? 'badge-success' : 'badge-warning'}`}>
            {autoPostSettings.autoPostEnabled && autoPostSettings.autoPostChannel ? '● FAOL' : '○ NOFAOL / SOZLANMAGAN'}
          </span>
        </div>
        <div className="card-pad">
          <form onSubmit={saveAutoPostSettings}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={autoPostSettings.autoPostEnabled}
                    onChange={(e) => setAutoPostSettings({ ...autoPostSettings, autoPostEnabled: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#10b981' }}
                  />
                  Telegram Kanalga Avto-Postingni Yoqish
                </label>
                <div className="cell-sub" style={{ fontSize: 13, marginTop: 4 }}>
                  Yangi kino bazaga qo'shilganda kanalga avtomatik ravishda rasm/video, kod va bot tugmalari bilan post joylanadi.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                  Target Telegram Kanal Username yoki ID
                </label>
                <input
                  type="text"
                  className="input mono"
                  placeholder="@xitfilm_uz yoki -100123456789"
                  value={autoPostSettings.autoPostChannel || ''}
                  onChange={(e) => setAutoPostSettings({ ...autoPostSettings, autoPostChannel: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px' }}
                />
                <div className="cell-sub" style={{ marginTop: 4 }}>
                  Bot ushbu kanalda administrator bo'lishi va habar yuborish huquqiga ega bo'lishi shart!
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={14} style={{ color: '#10b981' }} />
                <span>Maslahat: Istalgan kinoni qo'lda kanalga joylash uchun Telegram botda <code>/post [kino_kodi]</code> komandasini yuboring.</span>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={autoPostBusy}
                style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
              >
                <Save size={16} /> {autoPostBusy ? 'Saqlanmoqda...' : 'Auto-Post Sozlamalarini Saqlash'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
