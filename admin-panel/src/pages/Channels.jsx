import { useState, useEffect } from 'react';
import { Plus, Trash2, Radio, Save, ExternalLink } from 'lucide-react';
import { dlApi, safe } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Loader } from '../components/ui.jsx';

export default function Channels() {
  const { toast } = useApp();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    safe(dlApi.get('/channels')).then(({ data }) => {
      setChannels(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const update = (i, field, val) => setChannels((c) => c.map((ch, idx) => (idx === i ? { ...ch, [field]: val } : ch)));
  const add = () => { if (channels.length >= 5) return toast('Maksimal 5 ta kanal', 'error'); setChannels((c) => [...c, { username: '', link: '' }]); };
  const remove = (i) => setChannels((c) => c.filter((_, idx) => idx !== i));

  const save = async () => {
    const clean = channels.map((c) => ({ username: c.username.trim(), link: c.link.trim() })).filter((c) => c.username && c.link);
    setBusy(true);
    const { error } = await safe(dlApi.post('/channels', { channels: clean }));
    setBusy(false);
    if (error) return toast(error, 'error');
    toast('Kanallar saqlandi');
    setChannels(clean);
  };

  if (loading) return <Loader full />;

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <div className="card-head">
        <h3>Homiy kanallar (majburiy obuna)</h3>
        <div className="spacer" />
        <span className="badge badge-muted">{channels.length}/5</span>
      </div>
      <div className="card-pad">
        <p className="muted" style={{ marginBottom: 18, fontSize: 13 }}>
          Bu kanallar ikkala bot uchun umumiy. Botlar navbatma-navbat (rotatsiya) majburiy obunani tekshiradi.
          Bot har bir kanalda <strong>admin</strong> bo'lishi shart, aks holda tekshiruv ishlamaydi.
        </p>

        {channels.length === 0 && (
          <div className="empty" style={{ padding: 30 }}><Radio size={36} /><h4>Kanal qo'shilmagan</h4></div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {channels.map((ch, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14, background: 'var(--surface-2)', borderRadius: 12 }}>
              <div className="stat-ico" style={{ width: 38, height: 38, background: 'var(--accent-grad)', flexShrink: 0 }}><Radio size={17} /></div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input className="input" placeholder="@username" value={ch.username} onChange={(e) => update(i, 'username', e.target.value)} />
                <input className="input" placeholder="https://t.me/..." value={ch.link} onChange={(e) => update(i, 'link', e.target.value)} />
              </div>
              <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => remove(i)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>

        <div className="flex gap" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={add} disabled={channels.length >= 5}><Plus size={16} /> Kanal qo'shish</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : <><Save size={16} /> Saqlash</>}</button>
        </div>
      </div>
    </div>
  );
}
