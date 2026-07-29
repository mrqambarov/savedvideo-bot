import { useState, useEffect } from 'react';
import { Plus, Trash2, Radio, Save, CheckCircle, XCircle } from 'lucide-react';
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
  const add = () => {
    setChannels((c) => [...c, {
      username: '',
      link: '',
      targetCount: 0,
      joinedCount: 0,
      active: true
    }]);
  };
  const remove = (i) => setChannels((c) => c.filter((_, idx) => idx !== i));

  const save = async () => {
    const clean = channels.map((c) => ({
      id: c.id,
      username: c.username.trim(),
      link: c.link.trim(),
      targetCount: Number(c.targetCount) || 0,
      joinedCount: Number(c.joinedCount) || 0,
      joinedUsers: c.joinedUsers || [],
      dailyStats: c.dailyStats || {},
      monthlyStats: c.monthlyStats || {},
      active: c.active !== undefined ? Boolean(c.active) : true
    })).filter((c) => c.username && c.link);

    setBusy(true);
    const { error } = await safe(dlApi.post('/channels', { channels: clean }));
    setBusy(false);
    if (error) return toast(error, 'error');
    toast('Homiy kanallar va limitlar saqlandi');
    setChannels(clean);
  };

  if (loading) return <Loader full />;

  return (
    <div className="card" style={{ maxWidth: 880 }}>
      <div className="card-head">
        <h3>📢 Aqlli Homiylik Kanallari (CPA & Obuna Rotatsiyasi)</h3>
        <div className="spacer" />
        <span className="badge badge-primary">{channels.length} ta kanal</span>
      </div>
      <div className="card-pad">
        <p className="muted" style={{ marginBottom: 18, fontSize: 13 }}>
          Har bir homiy kanal uchun <strong>Limit (Obunachi Maqsadi)</strong> belgilashingiz mumkin.
          Limitga yetilgach (masalan: 500/500), bot ushbu kanalni avtomatik ravishda nofaol qiladi va obunachilar statistikasi avtomatik hisoblanadi.
        </p>

        {channels.length === 0 && (
          <div className="empty" style={{ padding: 30 }}><Radio size={36} /><h4>Homiy kanal qo'shilmagan</h4></div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {channels.map((ch, i) => {
            const pct = ch.targetCount > 0 ? Math.min(100, Math.round((ch.joinedCount / ch.targetCount) * 100)) : 0;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'var(--surface-2)', borderRadius: 12, border: ch.active ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(239,68,68,0.3)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="stat-ico" style={{ width: 38, height: 38, background: ch.active ? 'var(--accent-grad)' : '#ef4444', flexShrink: 0 }}>
                    <Radio size={17} />
                  </div>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px', gap: 10 }}>
                    <input className="input" placeholder="@username" value={ch.username} onChange={(e) => update(i, 'username', e.target.value)} />
                    <input className="input" placeholder="https://t.me/..." value={ch.link} onChange={(e) => update(i, 'link', e.target.value)} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>Limit (0=cheksiz)</span>
                      <input className="input" type="number" placeholder="500" value={ch.targetCount || ''} onChange={(e) => update(i, 'targetCount', e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>Kelgan a'zo</span>
                      <span style={{ fontWeight: 'bold', fontSize: 14, color: '#10b981' }}>{ch.joinedCount || 0} ta</span>
                    </div>
                  </div>

                  <button
                    className={`btn ${ch.active ? 'btn-ghost' : 'btn-danger'}`}
                    style={{ height: 38, padding: '0 10px', fontSize: 12 }}
                    onClick={() => update(i, 'active', !ch.active)}
                    title={ch.active ? 'Faol' : 'Nofaol'}
                  >
                    {ch.active ? <CheckCircle size={15} color="#10b981" /> : <XCircle size={15} color="#ef4444" />}
                  </button>

                  <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => remove(i)}>
                    <Trash2 size={16} />
                  </button>
                </div>

                {ch.targetCount > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                      <span>Bajarilish: {ch.joinedCount} / {ch.targetCount} ({pct}%)</span>
                      {pct >= 100 && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Limit to'ldi!</span>}
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#ef4444' : 'var(--accent-grad)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={add}><Plus size={16} /> Kanal qo'shish</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : <><Save size={16} /> Saqlash</>}</button>
        </div>
      </div>
    </div>
  );
}
