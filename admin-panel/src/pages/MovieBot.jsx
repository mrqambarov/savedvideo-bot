import { useState, useEffect } from 'react';
import { Power, Play, Square, KeyRound, Radio, Save, Users, AtSign } from 'lucide-react';
import { movieApi, safe } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader } from '../components/ui.jsx';

export default function MovieBot() {
  const { toast } = useApp();
  const [status, setStatus] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [s, c] = await Promise.all([safe(movieApi.get('/bot-status')), safe(movieApi.get('/config'))]);
    if (s.data) setStatus(s.data);
    if (c.data) setCfg(c.data);
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(async () => { const { data } = await safe(movieApi.get('/bot-status')); if (data) setStatus(data); }, 15000); return () => clearInterval(t); }, []);

  const toggle = async (action) => {
    setBusy(true);
    const { data, error } = await safe(movieApi.post('/bot-status', { action }));
    setBusy(false);
    if (error) return toast(error, 'error');
    if (data?.status) setStatus(data.status);
    toast(action === 'start' ? 'Bot ishga tushdi' : "Bot to'xtatildi");
  };

  const saveCfg = async () => {
    setSaving(true);
    const payload = {
      botToken: cfg.botToken && cfg.botToken.includes('...') ? undefined : cfg.botToken,
      adminIds: cfg.adminIds,
      sponsorEnabled: cfg.sponsorEnabled,
      sponsorUsername: cfg.sponsorUsername,
      sponsorLink: cfg.sponsorLink,
    };
    const { error } = await safe(movieApi.post('/config', payload));
    setSaving(false);
    if (error) return toast(error, 'error');
    toast('Sozlamalar saqlandi');
    load();
  };

  if (loading || !cfg) return <Loader full />;
  const running = status?.running;

  return (
    <div className="grid grid-2">
      <div className="card" style={{ alignSelf: 'flex-start' }}>
        <div className="card-head"><h3>Bot holati</h3></div>
        <div className="card-pad">
          <div className="between" style={{ marginBottom: 18 }}>
            <div className="flex gap" style={{ alignItems: 'center' }}>
              <div className="stat-ico" style={{ background: running ? 'var(--success)' : 'var(--text-3)' }}><Power size={20} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Kino Bot</div>
                <span className={`badge ${running ? 'badge-success' : 'badge-danger'}`}><span className={`dot ${running ? 'live' : 'off'}`} />{running ? 'Ishlamoqda' : "To'xtatilgan"}</span>
              </div>
            </div>
          </div>
          {cfg.botUsername && <div className="muted" style={{ marginBottom: 14, fontSize: 13 }}><AtSign size={13} style={{ verticalAlign: -2 }} /> {cfg.botUsername}</div>}
          {running
            ? <button className="btn btn-danger btn-block" onClick={() => toggle('stop')} disabled={busy}>{busy ? <span className="spinner" /> : <><Square size={16} /> To'xtatish</>}</button>
            : <button className="btn btn-success btn-block" onClick={() => toggle('start')} disabled={busy}>{busy ? <span className="spinner" /> : <><Play size={16} /> Ishga tushirish</>}</button>}
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
            <label>Admin ID'lar (vergul bilan)</label>
            <div className="input-icon"><Users size={16} /><input className="input mono" value={cfg.adminIds || ''} onChange={(e) => setCfg({ ...cfg, adminIds: e.target.value })} placeholder="123456789, 987654321" /></div>
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
