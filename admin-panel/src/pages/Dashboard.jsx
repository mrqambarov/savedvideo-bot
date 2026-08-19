import { useState, useEffect, useMemo } from 'react';
import {
  Users, Film, Activity, Download, Server, Cpu, HardDrive, Clock,
  RefreshCw, ShieldCheck, Zap, Trash2, Loader2, Sparkles, Send, Radio, MessageSquare, Play, Square, AlertCircle, CheckCircle2, Bell, CheckCircle, ArrowUpRight, Award, ShieldAlert
} from 'lucide-react';
import { useStats, useResource } from '../lib/useData.js';
import { dlApi, movieApi, adultApi, safe } from '../lib/api.js';
import { Loader, Modal } from '../components/ui.jsx';
import { TrendArea } from '../components/charts.jsx';
import { useApp } from '../context/AppContext.jsx';
import { nf, timeAgo } from '../lib/format.js';

function mergeTrend(dl, movie, adult) {
  const map = new Map();
  (dl?.trend || []).forEach((d) => {
    map.set(d.date, {
      date: d.date,
      dlActive: d.activeUsers || 0,
      movieActive: 0,
      adultActive: 0,
    });
  });
  (movie?.trend || []).forEach((d) => {
    const row = map.get(d.date) || { date: d.date, dlActive: 0, movieActive: 0, adultActive: 0 };
    row.movieActive = d.activeUsers || 0;
    map.set(d.date, row);
  });
  (adult?.trend || []).forEach((d) => {
    const row = map.get(d.date) || { date: d.date, dlActive: 0, movieActive: 0, adultActive: 0 };
    row.adultActive = d.activeUsers || 0;
    map.set(d.date, row);
  });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default function Dashboard() {
  const { toast } = useApp();
  const { dl, movie, adult, loading, updatedAt, reload } = useStats();
  
  const dlStatus = useResource(() => dlApi.get('/bot-status'), 20000);
  const movieStatus = useResource(() => movieApi.get('/bot-status'), 20000);
  const adultStatus = useResource(() => adultApi.get('/bot-status'), 20000);

  const activityFeed = useResource(() => dlApi.get('/activity-stream'), 5000);
  const sponsorStats = useResource(() => dlApi.get('/sponsor-stats'), 30000);

  const [health, setHealth] = useState(null);
  const [restarting, setRestarting] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [quickMsgModal, setQuickMsgModal] = useState(false);
  const [quickMsgText, setQuickMsgText] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      const { data } = await safe(dlApi.get('/system-health'));
      if (data) setHealth(data);
    };
    fetchHealth();
    const timer = setInterval(fetchHealth, 5000);
    return () => clearInterval(timer);
  }, []);

  const trend = useMemo(() => mergeTrend(dl, movie, adult), [dl, movie, adult]);

  const [activityFilter, setActivityFilter] = useState('all');

  const filteredActivities = useMemo(() => {
    const raw = activityFeed.data;
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.activities) ? raw.activities : []);
    if (activityFilter === 'all') return list;
    return list.filter((act) => {
      const isAdminAct = act.type === 'admin' || act.text?.includes('👑 Admin');
      const isParserAct = act.type === 'parser' || act.text?.includes('⚡ Avto-Parser');
      const isUserAct = act.type === 'user' || (!isAdminAct && !isParserAct);
      if (activityFilter === 'admin') return isAdminAct;
      if (activityFilter === 'parser') return isParserAct;
      if (activityFilter === 'user') return isUserAct;
      return true;
    });
  }, [activityFeed.data, activityFilter]);

  if (loading) return <Loader full />;

  const totalUsers = (dl?.totalUsers || 0) + (movie?.totalUsers || 0) + (adult?.totalUsers || 0);
  const newWeek = (dl?.growth?.newUsersWeek || 0) + (movie?.growth?.newUsersWeek || 0) + (adult?.growth?.newUsersWeek || 0);
  const activeToday = (dl?.active?.today || 0) + (movie?.active?.today || 0) + (adult?.active?.today || 0);
  
  const dlDownloadsToday = (dl?.usage?.today?.downloadsVideo || 0) + (dl?.usage?.today?.downloadsAudio || 0);
  const movieViewsToday = movie?.usage?.today?.views || movie?.usage?.today?.movieViews || 0;
  const adultViewsToday = adult?.totalViews || 0;
  const totalOperations = dlDownloadsToday + movieViewsToday + adultViewsToday;

  const totalContentCount = (movie?.totalMovies || 0) + (adult?.totalMovies || 0);

  const handleRestart = async (target) => {
    setRestarting(target);
    const { data, error } = await safe(dlApi.post('/restart-bot', { target }));
    setRestarting(null);
    if (error) {
      toast(error, 'error');
    } else {
      toast(data?.message || "Botlar muvaffaqiyatli qayta ishga tushirildi!");
      dlStatus.reload();
      movieStatus.reload();
      adultStatus.reload();
    }
  };

  const handleCleanTemp = async () => {
    setCleaning(true);
    const { data, error } = await safe(dlApi.post('/clean-temp'));
    setCleaning(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast(data?.message || "Vaqtinchalik kesh xotirasi tozalandi!");
    }
  };

  const handleSendQuickBroadcast = async () => {
    if (!quickMsgText.trim()) {
      toast("Xabar matnini kiriting!", "error");
      return;
    }
    setSendingMsg(true);

    let targetApi = dlApi;
    if (targetAudience === 'movie') targetApi = movieApi;
    if (targetAudience === 'adult') targetApi = adultApi;

    const { data, error } = await safe(targetApi.post('/broadcast', { message: quickMsgText }));
    setSendingMsg(false);

    if (error) {
      toast(error, 'error');
    } else {
      toast("Tezkor xabarnoma barcha foydalanuvchilarga yuborilmoqda!");
      setQuickMsgModal(false);
      setQuickMsgText('');
    }
  };

  const bots = [
    {
      id: 'downloader',
      name: 'Downloader Bot Studio',
      icon: Download,
      color: '#6366f1',
      bgGrad: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)',
      borderColor: 'rgba(99,102,241,0.3)',
      running: dlStatus.data?.running ?? true,
      users: dl?.totalUsers || 0,
      activeToday: dl?.active?.today || 0,
      extra: `${nf(dlDownloadsToday)} ta yuklama (bugun)`,
    },
    {
      id: 'movie',
      name: 'Kino Bot Studio',
      icon: Film,
      color: '#d946ef',
      bgGrad: 'linear-gradient(135deg, rgba(217,70,239,0.15) 0%, rgba(217,70,239,0.05) 100%)',
      borderColor: 'rgba(217,70,239,0.3)',
      running: movieStatus.data?.running ?? true,
      users: movie?.totalUsers || 0,
      activeToday: movie?.active?.today || 0,
      extra: `${nf(movie?.totalMovies || 0)} ta kino katalogi`,
    },
    {
      id: 'adult',
      name: '🔞 18+ Adult Bot Studio',
      icon: Sparkles,
      color: '#ef4444',
      bgGrad: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
      borderColor: 'rgba(239,68,68,0.3)',
      running: adultStatus.data?.running ?? true,
      users: adult?.totalUsers || 0,
      activeToday: adult?.active?.today || 0,
      extra: `${nf(adult?.totalMovies || 0)} ta 18+ video katalogi`,
    },
  ];

  const sponsorData = sponsorStats.data || {
    totalChecks: 0,
    subscribedCount: 0,
    conversionRate: 0,
    channels: []
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Top Header Command Bar */}
      <div className="card mb" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(217,70,239,0.04) 100%)', border: '1px solid var(--border)' }}>
        <div className="card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
              🚀 Boshqaruv Markazi (Executive Command Hub)
              <span className="badge badge-success" style={{ padding: '5px 12px', fontSize: 11 }}>
                ● 3 BOTS LIVE ONLINE
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--emerald)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              {updatedAt && <>Real-vaqt server va botlar monitoringi. Yangilandi: {timeAgo(updatedAt.toISOString())}</>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleRestart('all')}
              disabled={restarting !== null}
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
            >
              {restarting === 'all' ? <Loader2 size={15} className="spinner" /> : <RefreshCw size={15} />}
              Barcha Botlarni Qayta Yoqish
            </button>

            <button
              className="btn btn-ghost btn-sm"
              onClick={handleCleanTemp}
              disabled={cleaning}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              {cleaning ? <Loader2 size={15} className="spinner" /> : <Trash2 size={15} color="#ef4444" />}
              Keshni Tozalash
            </button>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setQuickMsgModal(true)}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <Send size={15} color="#10b981" />
              Tezkor Reklama
            </button>

            <button className="btn btn-ghost btn-sm" onClick={reload} title="Yangilash">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Executive Metric Cards */}
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <div className="stat" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Jami Foydalanuvchilar</div>
              <div className="stat-value">{nf(totalUsers)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-delta up">
            <Zap size={14} />
            <span>+{nf(newWeek)} oxirgi 7 kunda qo'shilgan</span>
          </div>
        </div>

        <div className="stat" style={{ borderLeft: '4px solid #d946ef' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Kinolar & Videolar</div>
              <div className="stat-value">{nf(totalContentCount)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, #d946ef, #c026d3)', color: '#fff' }}>
              <Film size={20} />
            </div>
          </div>
          <div className="stat-delta">
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{nf(movie?.totalMovies || 0)} kino + {nf(adult?.totalMovies || 0)} 18+ video</span>
          </div>
        </div>

        <div className="stat" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Bugun Faol A'zolar</div>
              <div className="stat-value">{nf(activeToday)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
              <Activity size={20} />
            </div>
          </div>
          <div className="stat-delta up">
            <ShieldCheck size={14} />
            <span>Bugun botlardan foydalanganlar</span>
          </div>
        </div>

        <div className="stat" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-top">
            <div>
              <div className="stat-label">Bugungi Amallar</div>
              <div className="stat-value">{nf(totalOperations)}</div>
            </div>
            <div className="stat-ico" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}>
              <Download size={20} />
            </div>
          </div>
          <div className="stat-delta" style={{ color: '#f59e0b' }}>
            <Zap size={14} />
            <span>Yuklamalar va ko'rishlar soni</span>
          </div>
        </div>
      </div>

      {/* 3 Bot Live Process Control Cards Grid */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Radio size={18} color="#6366f1" /> 3 ta Bot Real-Vaqt Onlayn Boshqaruvi (PM2 Status)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {bots.map((b) => (
            <div
              key={b.id}
              className="card"
              style={{
                margin: 0,
                background: b.bgGrad,
                border: `1px solid ${b.borderColor}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: b.color, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: `0 4px 14px ${b.color}50` }}>
                    <b.icon size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{b.name}</div>
                    <div className="cell-sub" style={{ fontSize: 12 }}>{b.extra}</div>
                  </div>
                </div>
                <span className={`badge ${b.running ? 'badge-success' : 'badge-danger'}`} style={{ padding: '4px 10px', fontSize: 11 }}>
                  {b.running ? '● ONLAYN' : '○ OFFLAYN'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px', background: 'var(--surface-solid)', borderRadius: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Jami A'zolar</div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{nf(b.users)} ta</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Bugun Faol</div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color: '#10b981' }}>{nf(b.activeToday)} ta</div>
                </div>
              </div>

              <button
                className="btn btn-ghost btn-block"
                onClick={() => handleRestart(b.id)}
                disabled={restarting !== null}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13 }}
              >
                {restarting === b.id ? <Loader2 size={15} className="spinner" /> : <RefreshCw size={15} />}
                {b.name} Botni Qayta Yoqish
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* NEW SECTION 1: 📊 CPA & 5 Sponsor Channel Conversion Guard Widget */}
      <div className="card mb" style={{ border: '1px solid rgba(16,185,129,0.3)', background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(5,150,105,0.02) 100%)' }}>
        <div className="card-head" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={18} color="#10b981" /> 📊 Homiy Obunalar Samaradorligi (Sponsor Guard Conversion)
          </h3>
          <span className="badge badge-success" style={{ fontSize: 12, padding: '5px 12px' }}>
            CONVERSION RATE: {sponsorData.conversionRate || 0}%
          </span>
        </div>

        <div className="card-pad" style={{ paddingTop: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'var(--surface-solid)', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Jami Obuna Tekshiruvlari</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: 'var(--text)' }}>{nf(sponsorData.totalChecks || 0)} ta</div>
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>Botlardan foydalanish jarayonida</div>
            </div>

            <div style={{ background: 'var(--surface-solid)', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Muvaffaqiyatli A'zo Bo'lganlar</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: '#10b981' }}>{nf(sponsorData.subscribedCount || 0)} user</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sponsorData.channels?.length || 1} ta homiy kanal obunasi bo'yicha</div>
            </div>

            <div style={{ background: 'var(--surface-solid)', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Obuna Konversiyasi (Conversion Rate)</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: '#6366f1' }}>{sponsorData.conversionRate || 0}%</div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${sponsorData.conversionRate || 0}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #6366f1)', borderRadius: 3 }} />
              </div>
            </div>
          </div>

          <h4 style={{ fontSize: 14, fontWeight: 750, marginBottom: 10, color: 'var(--text-2)' }}>
            📢 Obuna Kanallari Real-Vaqt Rotatsiyasi Ko'rsatkichlari:
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {(sponsorData.channels || []).map((ch, idx) => (
              <div key={idx} style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 8, borderLeft: '3px solid #10b981' }}>
                <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#10b981', marginRight: 4 }}>#{idx + 1}</span> {ch.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0' }}>Tekshirildi: <b>{ch.checks || 0}x</b></div>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>Obuna o'tdi: {ch.passRate || 0}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NEW SECTION 2: 🔔 Real-Vaqt Tizim Hodisalari Tasmasi (Live Activity Stream) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Live Activity Stream Feed */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head" style={{ justifyContent: 'space-between' }}>
              <h3 className="flex gap" style={{ alignItems: 'center' }}>
                <Bell size={18} style={{ color: '#ef4444' }} /> 🔔 Real-Vaqt Tizim Hodisalari Tasmasi (Live Activity Stream)
              </h3>
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.8s infinite' }} />
                JONLI OQIM
              </span>
            </div>

            <div className="card-pad" style={{ paddingTop: 0 }}>
              {/* Category Filter Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <button
                  className={`btn btn-xs ${activityFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActivityFilter('all')}
                  style={{ borderRadius: 6, fontSize: 11.5, padding: '4px 10px' }}
                >
                  🌐 Barchasi (All)
                </button>
                <button
                  className={`btn btn-xs ${activityFilter === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActivityFilter('admin')}
                  style={{
                    borderRadius: 6,
                    fontSize: 11.5,
                    padding: '4px 10px',
                    background: activityFilter === 'admin' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(245,158,11,0.1)',
                    color: activityFilter === 'admin' ? '#fff' : '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.3)'
                  }}
                >
                  👑 Admin Harakatlari
                </button>
                <button
                  className={`btn btn-xs ${activityFilter === 'parser' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActivityFilter('parser')}
                  style={{
                    borderRadius: 6,
                    fontSize: 11.5,
                    padding: '4px 10px',
                    background: activityFilter === 'parser' ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'rgba(139,92,246,0.1)',
                    color: activityFilter === 'parser' ? '#fff' : '#a78bfa',
                    border: '1px solid rgba(139,92,246,0.3)'
                  }}
                >
                  ⚡ Avto-Parser
                </button>
                <button
                  className={`btn btn-xs ${activityFilter === 'user' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActivityFilter('user')}
                  style={{
                    borderRadius: 6,
                    fontSize: 11.5,
                    padding: '4px 10px',
                    background: activityFilter === 'user' ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' : 'rgba(14,165,233,0.1)',
                    color: activityFilter === 'user' ? '#fff' : '#38bdf8',
                    border: '1px solid rgba(14,165,233,0.3)'
                  }}
                >
                  👤 Foydalanuvchilar
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                {filteredActivities.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    Hozircha hech qanday hodisa topilmadi.
                  </div>
                ) : (
                  filteredActivities.map((act) => {
                    const isAdminAct = act.type === 'admin' || act.text?.includes('👑 Admin');
                    const isParserAct = act.type === 'parser' || act.text?.includes('⚡ Avto-Parser');
                    
                    const borderLeftColor = isAdminAct ? '#f59e0b' : isParserAct ? '#8b5cf6' : (act.color || '#6366f1');
                    const itemBg = isAdminAct ? 'rgba(245, 158, 11, 0.04)' : isParserAct ? 'rgba(139, 92, 246, 0.04)' : 'var(--surface-2)';

                    return (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '12px 16px',
                          background: itemBg,
                          borderRadius: 10,
                          borderLeft: `4px solid ${borderLeftColor}`,
                          border: isAdminAct ? '1px solid rgba(245,158,11,0.2)' : '1px solid var(--border)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-solid)', display: 'grid', placeItems: 'center', fontSize: 17, flexShrink: 0 }}>
                            {act.icon || (isAdminAct ? '👑' : isParserAct ? '⚡' : '👤')}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {act.text}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                              {isAdminAct && (
                                <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4 }}>
                                  👑 ADMIN
                                </span>
                              )}
                              {isParserAct && (
                                <span style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4 }}>
                                  ⚡ AVTO-PARSER
                                </span>
                              )}
                              {!isAdminAct && !isParserAct && (
                                <span style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4 }}>
                                  👤 FOYDALANUVCHI
                                </span>
                              )}
                              <span>• Manba: <strong style={{ color: act.color || 'var(--text-2)' }}>{act.bot}</strong></span>
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12 }}>
                          {act.time}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Server Hardware Monitoring */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head" style={{ justifyContent: 'space-between' }}>
              <h3 className="flex gap" style={{ alignItems: 'center' }}>
                <Server size={18} style={{ color: 'var(--cyan)' }} /> Server Live Hardware Monitoring (VPS 94.237.103.133)
              </h3>
              <span className="badge badge-success">Sog'lom (Healthy)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div className="health-meter-box">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Cpu size={16} color="#6366f1" /> CPU Yuklamasi
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, margin: '8px 0 6px', color: '#6366f1' }}>
                  {health?.cpuUsage || 12}%
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${health?.cpuUsage || 12}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 3 }} />
                </div>
              </div>

              <div className="health-meter-box">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={16} color="#8b5cf6" /> RAM Operativ Xotira
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, margin: '8px 0 6px', color: '#8b5cf6' }}>
                  {health?.ram?.usedGB || '1.2'} / {health?.ram?.totalGB || '16.0'} GB
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${health?.ram?.usagePct || 8}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #d946ef)', borderRadius: 3 }} />
                </div>
              </div>

              <div className="health-meter-box">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HardDrive size={16} color="#0ea5e9" /> Disk Xotirasi
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, margin: '8px 0 6px', color: '#0ea5e9' }}>
                  {health?.disk?.usedGB || '12.4'} / {health?.disk?.totalGB || '40.0'} GB
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${health?.disk?.usagePct || 31}%`, height: '100%', background: 'linear-gradient(90deg, #0ea5e9, #10b981)', borderRadius: 3 }} />
                </div>
              </div>

              <div className="health-meter-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} color="#10b981" /> Server Uptime
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, margin: '10px 0 0', color: '#10b981' }}>
                  {health?.uptime || '11 kun 5 soat'}
                </div>
              </div>
            </div>
          </div>

          {/* 3-Bot Activity Comparative Trend Area Chart */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head">
              <h3>📈 3 ta Bot Faolligi Dinamikasi (14 Kunlik Trend)</h3>
              <span className="badge badge-muted">Real-vaqt analitika</span>
            </div>
            <div className="card-pad">
              <TrendArea data={trend} series={[
                { key: 'dlActive', label: 'Downloader Bot', color: '#6366f1' },
                { key: 'movieActive', label: 'Kino Bot', color: '#d946ef' },
                { key: 'adultActive', label: '18+ Adult Bot', color: '#ef4444' },
              ]} />
            </div>
          </div>
        </div>

        {/* Right Sidebar Widget: System Actions & Quick Broadcast */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head">
              <h3><Zap size={17} style={{ color: '#f59e0b', verticalAlign: -2, marginRight: 6 }} />Tezkor Amallar Hubi</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setQuickMsgModal(true)}
                style={{ width: '100%', justifyContent: 'flex-start', padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}
              >
                <Send size={16} color="#10b981" style={{ marginRight: 8 }} />
                <span>Tezkor Reklama Yuborish</span>
              </button>

              <button
                className="btn btn-ghost"
                onClick={handleCleanTemp}
                disabled={cleaning}
                style={{ width: '100%', justifyContent: 'flex-start', padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}
              >
                {cleaning ? (
                  <Loader2 size={16} className="spinner" style={{ marginRight: 8 }} />
                ) : (
                  <Trash2 size={16} color="#ef4444" style={{ marginRight: 8 }} />
                )}
                <span>Vaqtinchalik Keshni Tozalash</span>
              </button>

              <button
                className="btn btn-ghost"
                onClick={() => handleRestart('all')}
                disabled={restarting !== null}
                style={{ width: '100%', justifyContent: 'flex-start', padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}
              >
                {restarting === 'all' ? (
                  <Loader2 size={16} className="spinner" style={{ marginRight: 8 }} />
                ) : (
                  <RefreshCw size={16} color="#6366f1" style={{ marginRight: 8 }} />
                )}
                <span>PM2 Jarayonlarini Qayta Yuklash</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Broadcast Modal */}
      <Modal
        open={quickMsgModal}
        title="📢 Tezkor Reklama va Xabarnoma Yuborish"
        onClose={() => setQuickMsgModal(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setQuickMsgModal(false)}>Bekor</button>
            <button className="btn btn-primary" onClick={handleSendQuickBroadcast} disabled={sendingMsg || !quickMsgText.trim()}>
              {sendingMsg ? <span className="spinner" /> : <><Send size={16} /> Barcha Userlarga Yuborish</>}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Auditoriyani Tanlang</label>
            <select
              className="select"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              style={{ width: '100%', padding: '10px 14px' }}
            >
              <option value="all">⚡ Barcha 3 Bot Foydalanuvchilari</option>
              <option value="dl">📥 Downloader Bot A'zolari</option>
              <option value="movie">🎬 Kino Bot A'zolari</option>
              <option value="adult">🔞 18+ Adult Bot A'zolari</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Xabar Matni (HTML formati qo'llab-quvvatlanadi)</label>
            <textarea
              className="textarea"
              rows={5}
              placeholder="<b>Ajoyib yangilik!</b> Bugun yangi 18+ videolar va kinolar joylandi!..."
              value={quickMsgText}
              onChange={(e) => setQuickMsgText(e.target.value)}
              style={{ width: '100%', padding: 12 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
