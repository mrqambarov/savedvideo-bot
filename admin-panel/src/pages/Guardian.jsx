import { useState, useEffect } from 'react';
import {
  ShieldCheck, RefreshCw, Activity, Cpu, HardDrive, Lock, Terminal,
  Trash2, Download, AlertTriangle, CheckCircle2, Zap, Server, FileCode, Clock, Play
} from 'lucide-react';
import { dlApi, safe } from '../lib/api.js';

export default function GuardianPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg] = useState(null);
  const [syntaxResults, setSyntaxResults] = useState(null);

  const fetchStatus = async () => {
    const { data: res } = await safe(dlApi.get('/guardian/status'));
    if (res) {
      setData(res);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action, target = '') => {
    setActionLoading(`${action}_${target}`);
    setMsg(null);
    const { data: res, error } = await safe(dlApi.post('/guardian/action', { action, target }));
    setActionLoading('');

    if (error) {
      setMsg({ type: 'error', text: error });
    } else {
      if (action === 'scan_syntax') {
        setSyntaxResults(res.results || []);
        setMsg({ type: 'success', text: 'Kod sintaksisi muvaffaqiyatli tekshirildi!' });
      } else if (action === 'backup' && res.zipPath) {
        setMsg({ type: 'success', text: `Zaxira fayli yaratildi: ${res.zipPath}` });
      } else {
        setMsg({ type: 'success', text: res.message || res.output || 'Amaliyot muvaffaqiyatli bajarildi!' });
      }
      fetchStatus();
    }
  };

  const procs = data?.processes || {};
  const res = data?.resources || {};
  const dbs = data?.databases || {};
  const history = data?.healingHistory || [];

  return (
    <div className="page-container">
      {/* Header Banner */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.08) 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Guardian Pro Watchdog
                <span style={{ fontSize: '0.75rem', background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>FAOL & AVTONOM</span>
              </h2>
              <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '0.88rem' }}>
                Barcha botlar, sayt, baza va server xavfsizligini 24/7 avtomatik nazorat qilish va o'z-o'zini tiklash tizimi.
              </p>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={fetchStatus}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Yangilash
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {msg.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Top 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>PM2 Jarayonlar</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              {Object.values(procs).filter(p => p.ok).length} / {Object.keys(procs).length || 4} Onlayn
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>RAM Xotira</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              {res.ram ? `${res.ram.usedGB} GB (${res.ram.usedPct}%)` : 'Yuklanmoqda...'}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HardDrive size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>SSD Disk</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              {res.disk ? `${res.disk.usedGB} GB (${res.disk.usedPct}%)` : 'Yuklanmoqda...'}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>SSL Sertifikat</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              {data?.ssl?.daysLeft ? `${data.ssl.daysLeft} kun qoldi` : 'Faol'}
            </div>
          </div>
        </div>
      </div>

      {/* Control Actions & Processes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Quick Action Buttons */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc' }}>
            <Zap size={18} color="#f59e0b" />
            Guardian Tezkor Boshqaruv
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              className="guardian-action-btn"
              onClick={() => handleAction('restart', 'vibeconvert-bot')}
              disabled={!!actionLoading}
            >
              <RefreshCw size={15} color="#3b82f6" className={actionLoading === 'restart_vibeconvert-bot' ? 'spin' : ''} />
              <span>Restart Downloader</span>
            </button>
            <button
              className="guardian-action-btn"
              onClick={() => handleAction('restart', 'movie-bot')}
              disabled={!!actionLoading}
            >
              <RefreshCw size={15} color="#10b981" className={actionLoading === 'restart_movie-bot' ? 'spin' : ''} />
              <span>Restart Kino Bot</span>
            </button>
            <button
              className="guardian-action-btn"
              onClick={() => handleAction('restart', 'adult-bot')}
              disabled={!!actionLoading}
            >
              <RefreshCw size={15} color="#ef4444" className={actionLoading === 'restart_adult-bot' ? 'spin' : ''} />
              <span>Restart Adult Bot</span>
            </button>
            <button
              className="guardian-action-btn"
              onClick={() => handleAction('restart', 'nginx')}
              disabled={!!actionLoading}
            >
              <RefreshCw size={15} color="#06b6d4" className={actionLoading === 'restart_nginx' ? 'spin' : ''} />
              <span>Reload Nginx</span>
            </button>
            <button
              className="guardian-action-btn"
              onClick={() => handleAction('deep_clean')}
              disabled={!!actionLoading}
            >
              <Trash2 size={15} color="#f97316" className={actionLoading === 'deep_clean_' ? 'spin' : ''} />
              <span>Chuqur Tozalash</span>
            </button>
            <button
              className="guardian-action-btn"
              onClick={() => handleAction('update_ytdlp')}
              disabled={!!actionLoading}
            >
              <Download size={15} color="#8b5cf6" className={actionLoading === 'update_ytdlp_' ? 'spin' : ''} />
              <span>yt-dlp Yangilash</span>
            </button>
            <button
              className="guardian-action-btn"
              onClick={() => handleAction('scan_syntax')}
              disabled={!!actionLoading}
              style={{
                gridColumn: 'span 2',
                background: 'rgba(99, 102, 241, 0.18)',
                color: '#ffffff',
                borderColor: 'rgba(99, 102, 241, 0.5)',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)'
              }}
            >
              <FileCode size={16} color="#a5b4fc" className={actionLoading === 'scan_syntax_' ? 'spin' : ''} />
              <span style={{ fontWeight: 700 }}>🔍 AI Kod & Sintaksis Salomatligini Skanerlash</span>
            </button>
          </div>
        </div>

        {/* Live Processes Status */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="#10b981" />
            PM2 Jarayonlar & Resurslar
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(procs).map(([name, p]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-secondary, rgba(0,0,0,0.03))', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.ok ? '#10b981' : '#ef4444' }} />
                  <span style={{ fontWeight: '500' }}>{name}</span>
                </div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                  {p.ok ? `RAM: ${p.memMb}MB | ↺ ${p.restarts}` : <span style={{ color: '#ef4444' }}>To'xtagan</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Syntax Diagnostics Results (if scanned) */}
      {syntaxResults && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileCode size={18} color="#6366f1" />
            AI Kod Sintaksisi Tekshiruvi Natijalari
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {syntaxResults.map((item, idx) => (
              <div key={idx} style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: item.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: item.ok ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                {item.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                <span>{item.file}: {item.ok ? 'To\'g\'ri' : 'Xato'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Database Integrity & AI Healing History */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Database Integrity */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HardDrive size={18} color="#3b82f6" />
            Baza Yaxlitligi & Auto-Backup
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(dbs).map(([name, info]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-secondary, rgba(0,0,0,0.03))', borderRadius: 8 }}>
                <span style={{ fontWeight: '500', fontSize: '0.88rem' }}>{name}</span>
                <span style={{ fontSize: '0.82rem', color: info.valid ? '#10b981' : '#ef4444' }}>
                  {info.valid ? `✓ Yaxlit (${(info.sizeBytes / 1024).toFixed(1)} KB)` : `✗ ${info.error}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Doctor Healing History */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="#8b5cf6" />
            AI Doctor Avtomatik Tiklash Tarixi
          </h3>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.6, fontSize: '0.88rem' }}>
              Hozircha hech qanday favqulodda xatolik yuz bermagan. Barcha tizimlar toza ishlamoqda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 220, overflowY: 'auto' }}>
              {history.map((h, i) => (
                <div key={i} style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--bg-secondary, rgba(0,0,0,0.03))', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>{h.incident}</span>
                    <span style={{ color: h.success ? '#10b981' : '#ef4444' }}>{h.success ? '✓ Tiklandi' : '✗ Qaytarildi'}</span>
                  </div>
                  <div style={{ opacity: 0.8, marginTop: 2 }}>{h.actionTaken}</div>
                  <div style={{ opacity: 0.5, fontSize: '0.75rem', marginTop: 2 }}>{new Date(h.timestamp).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
