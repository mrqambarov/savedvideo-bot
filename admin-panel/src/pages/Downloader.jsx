import { useState, useEffect, useRef } from 'react';
import { Power, Play, Square, Upload, KeyRound, Radio, Save, FileCheck2, Cookie } from 'lucide-react';
import { dlApi, safe } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader } from '../components/ui.jsx';

export default function Downloader() {
  const { toast } = useApp();
  const [status, setStatus] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    const [s, c] = await Promise.all([safe(dlApi.get('/bot-status')), safe(dlApi.get('/config'))]);
    if (s.data) setStatus(s.data);
    if (c.data) setCfg(c.data);
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(async () => { const { data } = await safe(dlApi.get('/bot-status')); if (data) setStatus(data); }, 15000); return () => clearInterval(t); }, []);

  const toggle = async (action) => {
    setBusy(true);
    const { data, error } = await safe(dlApi.post('/bot-status', { action }));
    setBusy(false);
    if (error) return toast(error, 'error');
    if (data?.status) setStatus(data.status);
    toast(action === 'start' ? 'Bot ishga tushdi' : "Bot to'xtatildi");
  };

  const saveCfg = async () => {
    setSaving(true);
    const payload = {
      shazamKey: cfg.shazamKey && cfg.shazamKey.includes('...') ? undefined : cfg.shazamKey,
      botToken: cfg.botToken && cfg.botToken.includes('...') ? undefined : cfg.botToken,
      sponsorEnabled: cfg.sponsorEnabled,
      sponsorUsername: cfg.sponsorUsername,
      sponsorLink: cfg.sponsorLink,
    };
    const { error } = await safe(dlApi.post('/config', payload));
    setSaving(false);
    if (error) return toast(error, 'error');
    toast('Sozlamalar saqlandi');
    load();
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
    toast('cookies.txt yangilandi! YouTube yuklamalari tiklanishi mumkin');
  };

  if (loading || !cfg) return <Loader full />;
  const running = status?.running;

  return (
    <div className="grid grid-2">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="card">
          <div className="card-head"><h3>Bot holati</h3></div>
          <div className="card-pad">
            <div className="between" style={{ marginBottom: 18 }}>
              <div className="flex gap" style={{ alignItems: 'center' }}>
                <div className="stat-ico" style={{ background: running ? 'var(--success)' : 'var(--text-3)' }}><Power size={20} /></div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>VibeConvert Bot</div>
                  <span className={`badge ${running ? 'badge-success' : 'badge-danger'}`}><span className={`dot ${running ? 'live' : 'off'}`} />{running ? 'Ishlamoqda' : "To'xtatilgan"}</span>
                </div>
              </div>
            </div>
            {running
              ? <button className="btn btn-danger btn-block" onClick={() => toggle('stop')} disabled={busy}>{busy ? <span className="spinner" /> : <><Square size={16} /> To'xtatish</>}</button>
              : <button className="btn btn-success btn-block" onClick={() => toggle('start')} disabled={busy}>{busy ? <span className="spinner" /> : <><Play size={16} /> Ishga tushirish</>}</button>}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3><Cookie size={16} style={{ verticalAlign: -3, marginRight: 6 }} />YouTube cookies</h3></div>
          <div className="card-pad">
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              "Sign in to confirm you're not a bot" xatosini bartaraf etish uchun yangi <span className="mono">cookies.txt</span> (Netscape formati) yuklang.
            </p>
            <input ref={fileRef} type="file" accept=".txt" hidden onChange={uploadCookies} />
            <button className="btn btn-ghost btn-block" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <span className="spinner" /> : <><Upload size={16} /> cookies.txt yuklash</>}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Sozlamalar</h3></div>
        <div className="card-pad">
          <div className="field">
            <label>Bot token</label>
            <div className="input-icon"><KeyRound size={16} /><input className="input mono" value={cfg.botToken || ''} onChange={(e) => setCfg({ ...cfg, botToken: e.target.value })} placeholder="Yangi token kiriting" /></div>
          </div>
          <div className="field">
            <label>Shazam RapidAPI kaliti</label>
            <div className="input-icon"><KeyRound size={16} /><input className="input mono" value={cfg.shazamKey || ''} onChange={(e) => setCfg({ ...cfg, shazamKey: e.target.value })} placeholder="Yangi kalit" /></div>
          </div>

          <div className="between" style={{ padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 6 }}>
            <div><div style={{ fontWeight: 600 }}>Majburiy obuna</div><div className="cell-sub">Homiy kanalga obunani tekshirish</div></div>
            <label className="switch">
              <input type="checkbox" checked={!!cfg.sponsorEnabled} onChange={(e) => setCfg({ ...cfg, sponsorEnabled: e.target.checked })} />
              <span className="slider" />
            </label>
          </div>

          {cfg.sponsorEnabled && (
            <>
              <div className="field"><label>Kanal username</label><div className="input-icon"><Radio size={16} /><input className="input" value={cfg.sponsorUsername || ''} onChange={(e) => setCfg({ ...cfg, sponsorUsername: e.target.value })} placeholder="@kanal" /></div></div>
              <div className="field"><label>Kanal havolasi</label><input className="input" value={cfg.sponsorLink || ''} onChange={(e) => setCfg({ ...cfg, sponsorLink: e.target.value })} placeholder="https://t.me/kanal" /></div>
            </>
          )}

          <button className="btn btn-primary btn-block" onClick={saveCfg} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? <span className="spinner" /> : <><Save size={16} /> Saqlash</>}
          </button>
        </div>
      </div>
    </div>
  );
}
