import { useState, useEffect } from 'react';
import { Bot, Film, Key, RefreshCw, CheckCircle2, AlertCircle, ShieldAlert, Sparkles, Send } from 'lucide-react';
import { dlApi, safe } from '../lib/api.js';

export default function BotManagerCard() {
  const [target, setTarget] = useState('downloader'); // 'downloader' or 'movie'
  const [botInfo, setBotInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newToken, setNewToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchBotInfo = async () => {
    setLoading(true);
    const { data } = await safe(dlApi.get('/bot-info'));
    setLoading(false);
    if (data) setBotInfo(data);
  };

  useEffect(() => {
    fetchBotInfo();
  }, []);

  const handleSwitchToken = async (e) => {
    e.preventDefault();
    if (!newToken || newToken.trim().length < 20) {
      return setMsg({ type: 'error', text: 'Yangi bot tokeni kiritilmadi yoki formati xato!' });
    }
    setSubmitting(true);
    setMsg(null);
    const { data, error } = await safe(dlApi.post('/switch-bot-token', { target, newToken }));
    setSubmitting(false);
    if (error) {
      setMsg({ type: 'error', text: error });
    } else {
      setMsg({
        type: 'success',
        text: data.message || `Yangi bot @${data.bot?.username} muvaffaqiyatli almashtirildi va ishga tushdi!`
      });
      setNewToken('');
      fetchBotInfo();
    }
  };

  const currentBot = botInfo ? botInfo[target] : null;

  return (
    <div className="card" style={{ gridColumn: '1 / -1', border: '1px solid var(--border-strong)', background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-hover) 100%)' }}>
      <div className="card-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h3>
          <ShieldAlert size={18} style={{ verticalAlign: -3, marginRight: 8, color: '#f59e0b' }} />
          Botlarni Bloklanishdan Qutqarish va Avto-Almashtirish (Instant Bot Token Switcher)
        </h3>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 700 }}>
          ⚡ 1-SONIYA HOT-RELOAD
        </span>
      </div>

      <div className="card-pad">
        {/* Target Selector Tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${target === 'downloader' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setTarget('downloader'); setMsg(null); }}
            style={{ borderRadius: 10, padding: '9px 16px' }}
          >
            <Bot size={16} /> Downloader Bot (Yuklovchi)
          </button>

          <button
            type="button"
            className={`btn ${target === 'movie' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setTarget('movie'); setMsg(null); }}
            style={{ borderRadius: 10, padding: '9px 16px' }}
          >
            <Film size={16} /> Kino Bot (Film Search)
          </button>

          <button
            type="button"
            className={`btn ${target === 'music' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setTarget('music'); setMsg(null); }}
            style={{ borderRadius: 10, padding: '9px 16px' }}
          >
            <Sparkles size={16} /> 🔞 18+ Adult Bot
          </button>
        </div>

        {/* Feedback Alert */}
        {msg && (
          <div style={{ padding: '14px 18px', borderRadius: 10, marginBottom: 20, background: msg.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: msg.type === 'error' ? '#ef4444' : '#10b981', border: `1px solid ${msg.type === 'error' ? '#ef4444' : '#10b981'}`, fontWeight: 600, fontSize: 14 }}>
            {msg.type === 'error' ? <AlertCircle size={16} style={{ verticalAlign: -2, marginRight: 6 }} /> : <CheckCircle2 size={16} style={{ verticalAlign: -2, marginRight: 6 }} />}
            {msg.text}
          </div>
        )}

        {/* Current Active Bot Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, padding: '16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20 }}>
          <div>
            <div className="cell-sub" style={{ fontSize: 12 }}>Tanlangan Bot turi</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {target === 'downloader' && <><Bot size={18} color="var(--accent)" /> Downloader Bot</>}
              {target === 'movie' && <><Film size={18} color="#ec4899" /> Kino Bot</>}
              {target === 'music' && <><Sparkles size={18} color="#ef4444" /> 🔞 18+ Adult Bot</>}
            </div>
          </div>


          <div>
            <div className="cell-sub" style={{ fontSize: 12 }}>Hozirgi Telegram Username</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2, color: 'var(--accent)' }}>
              @{currentBot?.username || 'Yuklanmoqda...'}
            </div>
          </div>

          <div>
            <div className="cell-sub" style={{ fontSize: 12 }}>Hozirgi Token (Kodi)</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }} className="mono">
              {currentBot?.tokenMasked || '••••••••'}
            </div>
          </div>

          <div>
            <div className="cell-sub" style={{ fontSize: 12 }}>Holati</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="dot live" /> ONLAYN VA ISHLAMOQDA
            </div>
          </div>
        </div>

        {/* Replace Form */}
        <form onSubmit={handleSwitchToken}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              <Key size={15} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--accent)' }} />
              Yangi Telegram Bot Tokeni (@BotFather taqdim etgan token)
            </label>
            <input
              type="text"
              className="input mono"
              placeholder="Masalan: 8997677307:AAHxyz..."
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', fontSize: 14 }}
            />
            <div className="cell-sub" style={{ fontSize: 12, marginTop: 6 }}>
              💡 <b>Maslahat:</b> Bot Telegram tomonidan bloklansa, <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>@BotFather</a> da yangi bot yarating va uning tokenini shu yerga joylang. Tizim avtomatik tekshirib, 1-soniyada serverdagi eski botni yangisiga almashtiradi.
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !newToken.trim()}
            style={{ padding: '12px 24px', fontSize: 14, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
          >
            {submitting ? (
              <><RefreshCw size={18} className="spin" /> Telegram API orqali tekshirilmoqda va almashtirilmoqda...</>
            ) : (
              <><Sparkles size={18} /> ⚡ Botni Almashtirish va 1-Soniyada Ishga Tushirish</>
            )}
          </button>
        </form>

        {/* 🛡 Multi-Bot Anti-Ban Cluster Section */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h4 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={18} color="#10b981" /> 🛡 Anti-Ban Multi-Bot Klaster (Zaxira Botlar Ro'yxati)
              </h4>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                Asosiy bot bloklanganda barcha foydalanuvchilar zudlik bilan ushbu zaxira botlarga avto-yo'naltiriladi.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>1-Zaxira Bot</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>@xitfilm_backup1_bot</div>
              <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginTop: 4 }}>● TAYYOR (READY STANDBY)</div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  if (confirm("Rostdan ham barcha foydalanuvchilarni zaxira bot @xitfilm_backup1_bot ga ko'chirmoqchimisiz?")) {
                    const { data } = await safe(dlApi.post('/multi-bot/migrate', { targetUsername: '@xitfilm_backup1_bot' }));
                    alert(data?.message || "Avto-ko'chirish boshlandi!");
                  }
                }}
                style={{ marginTop: 12, width: '100%', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 700 }}
              >
                🚨 1-Bosishda Avto-Ko'chirish
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
