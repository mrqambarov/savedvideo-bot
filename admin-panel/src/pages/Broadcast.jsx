import { useState, useEffect, useRef } from 'react';
import { Send, Megaphone, CheckCircle2, XCircle, Users, Plus, Trash2 } from 'lucide-react';
import { dlApi, movieApi, safe } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Segmented } from '../components/ui.jsx';
import { nf } from '../lib/format.js';

export default function Broadcast() {
  const { toast } = useApp();
  const [bot, setBot] = useState('dl');
  const [msg, setMsg] = useState('');
  const [mediaType, setMediaType] = useState('text'); // 'text', 'photo', 'video'
  const [mediaUrl, setMediaUrl] = useState('');
  const [buttons, setButtons] = useState([{ label: '', url: '' }]);
  const [progress, setProgress] = useState(null);
  const [sending, setSending] = useState(false);
  const timer = useRef(null);

  const api = bot === 'dl' ? dlApi : movieApi;

  const addButton = () => {
    setButtons([...buttons, { label: '', url: '' }]);
  };

  const removeButton = (index) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index, field, val) => {
    const updated = [...buttons];
    updated[index][field] = val;
    setButtons(updated);
  };

  const poll = async () => {
    const { data } = await safe(api.get('/broadcast'));
    if (data) {
      setProgress(data);
      if (data.status !== 'running') {
        clearInterval(timer.current);
        setSending(false);
      }
    }
  };

  useEffect(() => {
    setProgress(null);
    clearInterval(timer.current);
    safe(api.get('/broadcast')).then(({ data }) => {
      if (data) {
        setProgress(data);
        if (data.status === 'running') {
          setSending(true);
          timer.current = setInterval(poll, 1500);
        }
      }
    });
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot]);

  const [targetSegment, setTargetSegment] = useState('all'); // 'all', 'active', 'inactive'

  const start = async () => {
    if (!msg.trim()) return toast('Xabar matnini kiriting', 'error');
    const validButtons = buttons.filter(b => b.label.trim() && b.url.trim());
    setSending(true);
    const { data, error } = await safe(api.post('/broadcast', {
      message: msg,
      mediaType,
      mediaUrl: mediaUrl.trim() || undefined,
      buttons: validButtons,
      targetSegment
    }));
    if (error) { setSending(false); return toast(error, 'error'); }
    toast('Media reklama tarqatilishi boshlandi');
    if (data?.progress) setProgress(data.progress);
    timer.current = setInterval(poll, 1500);
  };

  const pct = progress && progress.total ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0;
  const running = progress?.status === 'running';

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="card-head">
          <h3>📢 Media & Multi-Button Reklama</h3>
          <div className="spacer" />
          <Segmented options={[{ value: 'dl', label: 'Downloader Bot' }, { value: 'movie', label: 'Kino Bot' }]} value={bot} onChange={setBot} />
        </div>
        <div className="card-pad">
          <div className="field">
            <label>Maqsadli Auditoriya (Segment)</label>
            <Segmented
              options={[
                { value: 'all', label: '🌐 Barcha foydalanuvchilar' },
                { value: 'active', label: '⚡ Faollar (3 kun)' },
                { value: 'inactive', label: '😴 Inaktivlar (>3 kun)' }
              ]}
              value={targetSegment}
              onChange={setTargetSegment}
            />
          </div>

          <div className="field">
            <label>Xabar turi</label>
            <Segmented
              options={[
                { value: 'text', label: '💬 Matn' },
                { value: 'photo', label: '🖼 Rasm (Photo)' },
                { value: 'video', label: '🎥 Video' }
              ]}
              value={mediaType}
              onChange={setMediaType}
            />
          </div>

          {mediaType !== 'text' && (
            <div className="field">
              <label>{mediaType === 'photo' ? 'Rasm havolasi (Direct URL)' : 'Video havolasi (Direct URL)'}</label>
              <input
                className="input"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://example.com/media.jpg"
                disabled={running}
              />
            </div>
          )}

          <div className="field">
            <label>Xabar matni / Caption (HTML formatida)</label>
            <textarea className="textarea" style={{ minHeight: 120 }} value={msg} onChange={(e) => setMsg(e.target.value)}
              placeholder="Assalomu alaykum! Yangi chegirmalar va aksiyalar..." disabled={running} />
          </div>

          <div className="field">
            <div className="between" style={{ marginBottom: 8 }}>
              <label style={{ margin: 0 }}>Inline Tugmalar (Multi-Buttons)</label>
              <button className="btn btn-ghost btn-sm" onClick={addButton} disabled={running}>
                <Plus size={14} /> Tugma qo'shish
              </button>
            </div>

            {buttons.map((b, idx) => (
              <div key={idx} className="flex gap" style={{ marginBottom: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Tugma Nomi"
                  value={b.label}
                  onChange={(e) => updateButton(idx, 'label', e.target.value)}
                  disabled={running}
                />
                <input
                  className="input"
                  style={{ flex: 1.5 }}
                  placeholder="https://..."
                  value={b.url}
                  onChange={(e) => updateButton(idx, 'url', e.target.value)}
                  disabled={running}
                />
                {buttons.length > 1 && (
                  <button className="icon-btn" onClick={() => removeButton(idx)} disabled={running}>
                    <Trash2 size={15} color="var(--danger)" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button className="btn btn-primary btn-block" onClick={start} disabled={sending || running} style={{ marginTop: 14 }}>
            {running ? <><span className="spinner" /> Tarqatilmoqda...</> : <><Send size={16} /> Hammaga yuborish</>}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Tarqatish holati</h3></div>
        <div className="card-pad">
          {!progress || progress.status === 'idle' ? (
            <div className="empty"><Megaphone size={40} /><h4>Faol tarqatish yo'q</h4><div>Xabar yuborilganda bu yerda progress ko'rinadi</div></div>
          ) : (
            <>
              <div className="between" style={{ marginBottom: 10 }}>
                <span className={`badge ${running ? 'badge-warning' : progress.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                  {running ? 'Jarayonda' : progress.status === 'completed' ? 'Yakunlandi' : progress.status}
                </span>
                <strong>{pct}%</strong>
              </div>
              <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-grad)', transition: 'width 0.4s ease' }} />
              </div>

              <div className="grid grid-stats" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 18, gap: 12 }}>
                <div className="stat" style={{ padding: 14 }}><div className="stat-label"><Users size={13} /> Jami</div><div className="stat-value" style={{ fontSize: 22 }}>{nf(progress.total)}</div></div>
                <div className="stat" style={{ padding: 14 }}><div className="stat-label" style={{ color: 'var(--success)' }}><CheckCircle2 size={13} /> Yuborildi</div><div className="stat-value" style={{ fontSize: 22 }}>{nf(progress.sent)}</div></div>
                <div className="stat" style={{ padding: 14 }}><div className="stat-label" style={{ color: 'var(--danger)' }}><XCircle size={13} /> Xato</div><div className="stat-value" style={{ fontSize: 22 }}>{nf(progress.failed)}</div></div>
              </div>

              {progress.logs?.length > 0 && (
                <div style={{ marginTop: 16, maxHeight: 180, overflowY: 'auto', background: 'var(--surface-2)', borderRadius: 10, padding: 12 }}>
                  {progress.logs.slice(-30).map((l, i) => <div key={i} className="mono" style={{ color: 'var(--text-2)', padding: '2px 0' }}>{l}</div>)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
