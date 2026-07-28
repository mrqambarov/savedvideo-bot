import { useState, useEffect, useRef } from 'react';
import { Send, Megaphone, CheckCircle2, XCircle, Users } from 'lucide-react';
import { dlApi, movieApi, safe } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Segmented } from '../components/ui.jsx';
import { nf } from '../lib/format.js';

export default function Broadcast() {
  const { toast } = useApp();
  const [bot, setBot] = useState('dl');
  const [msg, setMsg] = useState('');
  const [btnText, setBtnText] = useState('');
  const [btnUrl, setBtnUrl] = useState('');
  const [progress, setProgress] = useState(null);
  const [sending, setSending] = useState(false);
  const timer = useRef(null);

  const api = bot === 'dl' ? dlApi : movieApi;

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

  const start = async () => {
    if (!msg.trim()) return toast('Xabar matnini kiriting', 'error');
    if ((btnText && !btnUrl) || (!btnText && btnUrl)) return toast('Tugma matni va havolasi birga kiritilishi kerak', 'error');
    setSending(true);
    const { data, error } = await safe(api.post('/broadcast', { message: msg, buttonText: btnText || undefined, buttonUrl: btnUrl || undefined }));
    if (error) { setSending(false); return toast(error, 'error'); }
    toast('Tarqatish boshlandi');
    if (data?.progress) setProgress(data.progress);
    timer.current = setInterval(poll, 1500);
  };

  const pct = progress && progress.total ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0;
  const running = progress?.status === 'running';

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="card-head">
          <h3>Yangi xabar</h3>
          <div className="spacer" />
          <Segmented options={[{ value: 'dl', label: 'Downloader' }, { value: 'movie', label: 'Kino bot' }]} value={bot} onChange={setBot} />
        </div>
        <div className="card-pad">
          <div className="field">
            <label>Xabar matni (HTML)</label>
            <textarea className="textarea" style={{ minHeight: 140 }} value={msg} onChange={(e) => setMsg(e.target.value)}
              placeholder="Assalomu alaykum! Yangiliklar..." disabled={running} />
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Tugma matni (ixtiyoriy)</label>
              <input className="input" value={btnText} onChange={(e) => setBtnText(e.target.value)} placeholder="Batafsil" disabled={running} />
            </div>
            <div className="field">
              <label>Tugma havolasi</label>
              <input className="input" value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)} placeholder="https://..." disabled={running} />
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={start} disabled={sending || running}>
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
