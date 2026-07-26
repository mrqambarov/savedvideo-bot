import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') 
  ? 'http://localhost:5000/api' 
  : '/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('downloader');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Downloader States
  const [linkUrl, setLinkUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);

  // Video Note States
  const [videoFile, setVideoFile] = useState(null);
  const [roundStyle, setRoundStyle] = useState('circular');
  const [convertedVideoUrl, setConvertedVideoUrl] = useState('');

  // Audio Extractor States
  const [extractFile, setExtractFile] = useState(null);
  const [extractedAudioUrl, setExtractedAudioUrl] = useState('');

  // FX Studio States
  const [audioFile, setAudioFile] = useState(null);
  const [selectedEffect, setSelectedEffect] = useState('concert');
  const [processedAudioUrl, setProcessedAudioUrl] = useState('');

  // Bot Manager & Sponsor States
  const [botStatus, setBotStatus] = useState({ running: false, hasToken: false });
  const [botTokenInput, setBotTokenInput] = useState('');
  const [shazamKeyInput, setShazamKeyInput] = useState('');
  const [configSaved, setConfigSaved] = useState(false);
  const [sponsorEnabled, setSponsorEnabled] = useState(false);
  const [sponsorUsernameInput, setSponsorUsernameInput] = useState('');
  const [sponsorLinkInput, setSponsorLinkInput] = useState('');

  // Analytics States
  const [statsData, setStatsData] = useState(null);

  // Broadcast States
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastButtonText, setBroadcastButtonText] = useState('');
  const [broadcastButtonUrl, setBroadcastButtonUrl] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    status: 'idle',
    logs: []
  });

  // Fetch initial data
  useEffect(() => {
    fetchBotStatus();
    fetchConfig();
    fetchStats();
    fetchBroadcastStatus();
  }, []);

  // Poll broadcast status when active
  useEffect(() => {
    let intervalId;
    if (broadcastStatus.status === 'running') {
      intervalId = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/broadcast`);
          setBroadcastStatus(res.data);
        } catch (e) {}
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [broadcastStatus.status]);

  const fetchBotStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/bot-status`);
      setBotStatus(res.data);
    } catch (err) {
      console.error('Failed to get bot status:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/stats`);
      setStatsData(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchBroadcastStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/broadcast`);
      setBroadcastStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch broadcast status:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/config`);
      if (res.data.botToken) setBotTokenInput(res.data.botToken);
      if (res.data.shazamKey) setShazamKeyInput(res.data.shazamKey);
      setSponsorEnabled(res.data.sponsorEnabled);
      setSponsorUsernameInput(res.data.sponsorUsername || '');
      setSponsorLinkInput(res.data.sponsorLink || '');
    } catch (err) {
      console.error('Failed to get config:', err);
    }
  };

  const saveConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/config`, {
        botToken: botTokenInput.includes('...') ? undefined : botTokenInput,
        shazamKey: shazamKeyInput.includes('...') ? undefined : shazamKeyInput,
        sponsorEnabled,
        sponsorUsername: sponsorUsernameInput,
        sponsorLink: sponsorLinkInput
      });
      setBotStatus(res.data.status);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
      fetchConfig();
      fetchStats();
    } catch (err) {
      alert('Config xatoligi: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleStartBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/broadcast`, {
        message: broadcastMessage,
        buttonText: broadcastButtonText || undefined,
        buttonUrl: broadcastButtonUrl || undefined
      });
      setBroadcastStatus(res.data.progress);
    } catch (err) {
      alert('Reklama yuborishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const toggleBot = async (action) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/bot-status`, { action });
      setBotStatus(res.data.status);
    } catch (err) {
      alert('Bot xatoligi: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Downloader Handler
  const handleFetchInfo = async () => {
    if (!linkUrl) return;
    setLoading(true);
    setVideoInfo(null);
    try {
      const res = await axios.post(`${API_BASE}/info`, { url: linkUrl });
      setVideoInfo(res.data);
    } catch (err) {
      alert('Havola xatoligi: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const triggerLinkDownload = (format) => {
    if (!videoInfo) return;
    const downloadUrl = `${API_BASE}/download?url=${encodeURIComponent(videoInfo.url)}&format=${format}`;
    window.open(downloadUrl, '_blank');
  };

  // Generic File Upload and Process Handler
  const processUpload = async (file, action, additionalData = {}) => {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('action', action);
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    try {
      const res = await axios.post(`${API_BASE}/process-upload`, formData, {
        responseType: 'blob',
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        }
      });

      const blobUrl = URL.createObjectURL(res.data);
      setProgress(100);
      return blobUrl;
    } catch (err) {
      alert('Fayl qayta ishlash xatosi. Iltimos, fayl hajmi va formatini tekshiring.');
      console.error(err);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  // Video Note Handler
  const handleConvertRound = async () => {
    if (!videoFile) return;
    setConvertedVideoUrl('');
    const url = await processUpload(videoFile, 'round-video', { style: roundStyle });
    if (url) setConvertedVideoUrl(url);
  };

  // Audio Extractor Handler
  const handleExtractAudio = async () => {
    if (!extractFile) return;
    setExtractedAudioUrl('');
    const url = await processUpload(extractFile, 'extract-audio');
    if (url) setExtractedAudioUrl(url);
  };

  // Audio FX Handler
  const handleApplyEffect = async () => {
    if (!audioFile) return;
    setProcessedAudioUrl('');
    const url = await processUpload(audioFile, 'audio-effect', { effect: selectedEffect });
    if (url) setProcessedAudioUrl(url);
  };

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">V</div>
          <span className="brand-name">VibeConvert</span>
        </div>
        
        <ul className="menu-list">
          <li className={`menu-item ${activeTab === 'downloader' ? 'active' : ''}`} onClick={() => setActiveTab('downloader')}>
            <span className="menu-icon">📥</span>
            <span>Link Downloader</span>
          </li>
          <li className={`menu-item ${activeTab === 'rounder' ? 'active' : ''}`} onClick={() => setActiveTab('rounder')}>
            <span className="menu-icon">🌀</span>
            <span>Video Note (1:1)</span>
          </li>
          <li className={`menu-item ${activeTab === 'extractor' ? 'active' : ''}`} onClick={() => setActiveTab('extractor')}>
            <span className="menu-icon">🎵</span>
            <span>MP3 Extractor</span>
          </li>
          <li className={`menu-item ${activeTab === 'fx' ? 'active' : ''}`} onClick={() => setActiveTab('fx')}>
            <span className="menu-icon">🎹</span>
            <span>FX Sound Studio</span>
          </li>
          <li className={`menu-item ${activeTab === 'bot' ? 'active' : ''}`} onClick={() => setActiveTab('bot')}>
            <span className="menu-icon">🤖</span>
            <span>Bot Configuration</span>
          </li>
          <li className={`menu-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => { setActiveTab('analytics'); fetchStats(); }}>
            <span className="menu-icon">📊</span>
            <span>Analytics</span>
          </li>
          <li className={`menu-item ${activeTab === 'broadcast' ? 'active' : ''}`} onClick={() => { setActiveTab('broadcast'); fetchBroadcastStatus(); }}>
            <span className="menu-icon">📢</span>
            <span>Broadcaster</span>
          </li>
          <li className={`menu-item ${activeTab === 'sponsor' ? 'active' : ''}`} onClick={() => setActiveTab('sponsor')}>
            <span className="menu-icon">🔒</span>
            <span>Sponsor Channel</span>
          </li>
        </ul>
      </aside>

      {/* Main dashboard content */}
      <main className="main-content">
        
        {/* Tab 1: Downloader */}
        {activeTab === 'downloader' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Link Downloader</h1>
              <p className="page-subtitle">YouTube, TikTok va Instagram videolarini yuklab oling yoki MP3 formatiga aylantiring.</p>
            </div>
            
            <div className="glass-card">
              <div className="input-group">
                <input 
                  type="text" 
                  className="text-input" 
                  placeholder="Video havolasini kiriting (https://...)" 
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  disabled={loading}
                />
                <button className="btn" onClick={handleFetchInfo} disabled={loading || !linkUrl}>
                  {loading && <span className="spinner"></span>}
                  <span>Tekshirish</span>
                </button>
              </div>

              {videoInfo && (
                <div className="meta-container">
                  {videoInfo.thumbnail && (
                    <img src={videoInfo.thumbnail} alt="thumbnail" className="meta-thumbnail" />
                  )}
                  <div className="meta-details">
                    <h2 className="meta-title">{videoInfo.title}</h2>
                    <div className="meta-info-row">
                      <div className="meta-info-item">
                        <span>⏱</span>
                        <span>{Math.round(videoInfo.duration)} soniya</span>
                      </div>
                      <div className="meta-info-item">
                        <span>💻</span>
                        <span>{videoInfo.extractor ? videoInfo.extractor.toUpperCase() : 'Video'}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                      <button className="btn" onClick={() => triggerLinkDownload('mp4')}>
                        📥 Yuklash (MP4)
                      </button>
                      <button className="btn btn-secondary" onClick={() => triggerLinkDownload('mp3')}>
                        🎵 Yuklash (MP3)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Video Note Creator */}
        {activeTab === 'rounder' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Dumaloq Video (Teleskop)</h1>
              <p className="page-subtitle">Videolarni 1:1 kvadrat formatga kesib, dumaloq video note tayyorlang.</p>
            </div>

            <div className="glass-card">
              <div 
                className="upload-zone"
                onClick={() => document.getElementById('videoFileSelect').click()}
              >
                <input 
                  type="file" 
                  id="videoFileSelect" 
                  accept="video/*" 
                  style={{ display: 'none' }}
                  onChange={(e) => setVideoFile(e.target.files[0])}
                />
                <div className="upload-icon">🎥</div>
                <div className="upload-text">
                  {videoFile ? videoFile.name : "Video faylni tanlang yoki shu yerga tashlang"}
                </div>
                <div className="upload-subtext">Maksimal hajm 100MB (MP4, MOV)</div>
              </div>

              {videoFile && (
                <div style={{ marginTop: '25px' }}>
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="style" 
                        value="circular" 
                        checked={roundStyle === 'circular'}
                        onChange={() => setRoundStyle('circular')}
                      />
                      <span>Qora burchaklar (Circular Mask)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="style" 
                        value="square" 
                        checked={roundStyle === 'square'}
                        onChange={() => setRoundStyle('square')}
                      />
                      <span>Telegram Native (Square 1:1)</span>
                    </label>
                  </div>

                  <button className="btn" onClick={handleConvertRound} disabled={loading}>
                    {loading && <span className="spinner"></span>}
                    <span>Teleskopga aylantirish</span>
                  </button>
                </div>
              )}

              {loading && progress > 0 && (
                <div className="progress-container">
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                  </div>
                  <div className="progress-info">
                    <span>Fayl yuklanmoqda...</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              )}

              {convertedVideoUrl && (
                <div className="circle-preview-wrapper">
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ marginBottom: '15px' }}>Video Note Preview</h3>
                    <div className="circle-video-container">
                      <video src={convertedVideoUrl} controls autoPlay loop muted></video>
                    </div>
                    <a 
                      href={convertedVideoUrl} 
                      download="round_video.mp4" 
                      className="btn" 
                      style={{ marginTop: '20px', textDecoration: 'none' }}
                    >
                      📥 Tayyor videoni yuklab olish
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: MP3 Extractor */}
        {activeTab === 'extractor' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">MP3 Extractor</h1>
              <p className="page-subtitle">Videolarni yuklang va ularning audiosini yuqori sifatli MP3 formatida yuklab oling.</p>
            </div>

            <div className="glass-card">
              <div 
                className="upload-zone"
                onClick={() => document.getElementById('extractFileSelect').click()}
              >
                <input 
                  type="file" 
                  id="extractFileSelect" 
                  accept="video/*" 
                  style={{ display: 'none' }}
                  onChange={(e) => setExtractFile(e.target.files[0])}
                />
                <div className="upload-icon">🎵</div>
                <div className="upload-text">
                  {extractFile ? extractFile.name : "Videodan musiqani ajratish uchun fayl tanlang"}
                </div>
                <div className="upload-subtext">Maksimal hajm 100MB</div>
              </div>

              {extractFile && (
                <button className="btn" style={{ marginTop: '25px' }} onClick={handleExtractAudio} disabled={loading}>
                  {loading && <span className="spinner"></span>}
                  <span>Audioni Ajratib Olish</span>
                </button>
              )}

              {loading && progress > 0 && (
                <div className="progress-container">
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                  </div>
                  <div className="progress-info">
                    <span>Ajratilmoqda...</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              )}

              {extractedAudioUrl && (
                <div style={{ marginTop: '30px', textAlign: 'center' }}>
                  <h3 style={{ marginBottom: '15px' }}>Ajratib olingan MP3</h3>
                  <audio src={extractedAudioUrl} controls style={{ width: '100%', maxWidth: '500px', marginBottom: '20px' }}></audio>
                  <br />
                  <a 
                    href={extractedAudioUrl} 
                    download="extracted_audio.mp3" 
                    className="btn" 
                    style={{ textDecoration: 'none' }}
                  >
                    📥 MP3 Yuklab Olish
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: FX Sound Studio */}
        {activeTab === 'fx' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">FX Sound Studio</h1>
              <p className="page-subtitle">Musiqalarga turli xil audio effektlar (stadium reverb, nightcore, 8D) qo'shing.</p>
            </div>

            <div className="glass-card">
              <div 
                className="upload-zone"
                onClick={() => document.getElementById('audioFileSelect').click()}
              >
                <input 
                  type="file" 
                  id="audioFileSelect" 
                  accept="audio/*" 
                  style={{ display: 'none' }}
                  onChange={(e) => setAudioFile(e.target.files[0])}
                />
                <div className="upload-icon">🎧</div>
                <div className="upload-text">
                  {audioFile ? audioFile.name : "Musiqa faylini tanlang (MP3, WAV)"}
                </div>
                <div className="upload-subtext">Maksimal hajm 30MB</div>
              </div>

              {audioFile && (
                <div style={{ marginTop: '30px' }}>
                  <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>Effektni tanlang:</h3>
                  <div className="effects-grid">
                    <div 
                      className={`effect-card ${selectedEffect === 'concert' ? 'selected' : ''}`}
                      onClick={() => setSelectedEffect('concert')}
                    >
                      <span className="effect-icon">🏛</span>
                      <div className="effect-name">Concert Reverb</div>
                      <div className="effect-desc">Konsert zali va stadium reverb effekti</div>
                    </div>
                    <div 
                      className={`effect-card ${selectedEffect === 'bass' ? 'selected' : ''}`}
                      onClick={() => setSelectedEffect('bass')}
                    >
                      <span className="effect-icon">🔊</span>
                      <div className="effect-name">Powerful Bass</div>
                      <div className="effect-desc">Chuqur va kuchli bass kuchaytirgich</div>
                    </div>
                    <div 
                      className={`effect-card ${selectedEffect === 'nightcore' ? 'selected' : ''}`}
                      onClick={() => setSelectedEffect('nightcore')}
                    >
                      <span className="effect-icon">⚡️</span>
                      <div className="effect-name">Nightcore</div>
                      <div className="effect-desc">Tezlik 1.25x va yuqori tonallik</div>
                    </div>
                    <div 
                      className={`effect-card ${selectedEffect === 'slowed' ? 'selected' : ''}`}
                      onClick={() => setSelectedEffect('slowed')}
                    >
                      <span className="effect-icon">🌌</span>
                      <div className="effect-name">Slowed & Reverb</div>
                      <div className="effect-desc">Sekinlashtirilgan va reverb aralashmasi</div>
                    </div>
                    <div 
                      className={`effect-card ${selectedEffect === '8d' ? 'selected' : ''}`}
                      onClick={() => setSelectedEffect('8d')}
                    >
                      <span className="effect-icon">🎧</span>
                      <div className="effect-name">8D Spatial</div>
                      <div className="effect-desc">Chapdan o'ngga aylanma stereofoniya</div>
                    </div>
                    <div 
                      className={`effect-card ${selectedEffect === 'karaoke' ? 'selected' : ''}`}
                      onClick={() => setSelectedEffect('karaoke')}
                    >
                      <span className="effect-icon">🎙</span>
                      <div className="effect-name">Karaoke (Minus)</div>
                      <div className="effect-desc">Qo'shiqdan ovozni butunlay o'chiradi</div>
                    </div>
                    <div 
                      className={`effect-card ${selectedEffect === 'autopan' ? 'selected' : ''}`}
                      onClick={() => setSelectedEffect('autopan')}
                    >
                      <span className="effect-icon">🎛</span>
                      <div className="effect-name">3D Auto-Pan</div>
                      <div className="effect-desc">Ovozni quloqlararo chap va o'ngga aylantiradi</div>
                    </div>
                  </div>

                  <button className="btn" onClick={handleApplyEffect} disabled={loading}>
                    {loading && <span className="spinner"></span>}
                    <span>Effektni qo'llash</span>
                  </button>
                </div>
              )}

              {loading && progress > 0 && (
                <div className="progress-container">
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                  </div>
                  <div className="progress-info">
                    <span>Effekt berilmoqda...</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              )}

              {processedAudioUrl && (
                <div style={{ marginTop: '30px', textAlign: 'center' }}>
                  <h3 style={{ marginBottom: '15px' }}>Tayyorlangan Musiqa</h3>
                  <audio src={processedAudioUrl} controls style={{ width: '100%', maxWidth: '500px', marginBottom: '20px' }}></audio>
                  <br />
                  <a 
                    href={processedAudioUrl} 
                    download={`fx_${selectedEffect}_audio.mp3`} 
                    className="btn" 
                    style={{ textDecoration: 'none' }}
                  >
                    📥 Musiqani Yuklab Olish
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Bot configuration */}
        {activeTab === 'bot' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Telegram Bot boshqaruvi</h1>
              <p className="page-subtitle">Telegram bot sozlamalari va botni ishga tushirish/to'xtatish paneli.</p>
            </div>

            <div className="bot-grid">
              {/* Settings Form */}
              <div className="glass-card">
                <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>Sozlamalar</h3>
                <form onSubmit={saveConfig}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                      Telegram Bot Token
                    </label>
                    <input 
                      type="text" 
                      className="text-input" 
                      style={{ width: '100%' }}
                      placeholder="Masalan: 123456789:ABCdefGhI..."
                      value={botTokenInput}
                      onChange={(e) => setBotTokenInput(e.target.value)}
                    />
                    <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Tokenni <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>@BotFather</a> orqali oling.
                    </small>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                      RapidAPI Shazam Key (Ixtiyoriy)
                    </label>
                    <input 
                      type="text" 
                      className="text-input" 
                      style={{ width: '100%' }}
                      placeholder="RapidAPI orqali shazam api kaliti"
                      value={shazamKeyInput}
                      onChange={(e) => setShazamKeyInput(e.target.value)}
                    />
                    <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Musiqani tahlil qilib topish uchun kerak (Shazam detect API).
                    </small>
                  </div>

                  <button type="submit" className="btn" disabled={loading}>
                    {loading && <span className="spinner"></span>}
                    <span>Saqlash</span>
                  </button>

                  {configSaved && (
                    <span style={{ color: 'var(--color-success)', marginLeft: '15px', fontWeight: '500' }}>
                      ✓ Saqlandi
                    </span>
                  )}
                </form>
              </div>

              {/* Bot Control Panel */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-title)' }}>Bot Statusi</h3>
                
                <div>
                  {botStatus.running ? (
                    <span className="status-badge active">● Bot Ishlamoqda</span>
                  ) : (
                    <span className="status-badge inactive">● Bot To'xtatilgan</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                  <button 
                    className="btn" 
                    onClick={() => toggleBot('start')} 
                    disabled={loading || botStatus.running || !botStatus.hasToken && !botTokenInput}
                  >
                    ▶ Botni Yoqish
                  </button>
                  <button 
                    className="btn btn-secondary btn-danger" 
                    onClick={() => toggleBot('stop')} 
                    disabled={loading || !botStatus.running}
                  >
                    ■ Botni To'xtatish
                  </button>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-glass)', margin: '15px 0' }} />

                <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--text-muted)' }}>Qo'llanma:</h4>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <li>Tokenni saqlagandan so'ng botni yoqing.</li>
                  <li>Telegramda botingizga kirib <code>/start</code> buyrug'ini bosing.</li>
                  <li>Botga havola (link), video yoki audio fayl tashlab uning ishlashini sinab ko'ring!</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Analytics */}
        {activeTab === 'analytics' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Bot Analitikasi</h1>
              <p className="page-subtitle">Bot foydalanuvchilari soni va yuklash statistikasi.</p>
            </div>

            {statsData ? (
              <div>
                <div className="analytics-grid">
                  <div className="glass-card stat-card">
                    <span className="stat-icon">👥</span>
                    <div className="stat-value">{statsData.totalUsers}</div>
                    <div className="stat-label">Jami A'zolar</div>
                  </div>
                  <div className="glass-card stat-card">
                    <span className="stat-icon">📥</span>
                    <div className="stat-value">{statsData.stats?.totalDownloadsVideo || 0}</div>
                    <div className="stat-label">Yuklangan Videolar</div>
                  </div>
                  <div className="glass-card stat-card">
                    <span className="stat-icon">🎵</span>
                    <div className="stat-value">{statsData.stats?.totalDownloadsAudio || 0}</div>
                    <div className="stat-label">Yuklangan Musiqalar</div>
                  </div>
                  <div className="glass-card stat-card">
                    <span className="stat-icon">🔍</span>
                    <div className="stat-value">{statsData.stats?.totalSearchQueries || 0}</div>
                    <div className="stat-label">Jami Qidiruvlar</div>
                  </div>
                </div>

                <div className="glass-card" style={{ marginTop: '30px' }}>
                  <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>Bot A'zolari Ro'yxati</h3>
                  <div className="table-responsive">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Username</th>
                          <th>Ismi</th>
                          <th>Sana</th>
                          <th>Yuklagan fayllari (Oxirgi 5 ta)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsData.usersList && statsData.usersList.length > 0 ? (
                          statsData.usersList.map((u, i) => (
                            <tr key={i}>
                              <td><code>{u.id}</code></td>
                              <td>{u.username ? `@${u.username}` : '—'}</td>
                              <td>{u.first_name || 'Foydalanuvchi'}</td>
                              <td>{new Date(u.dateJoined).toLocaleString()}</td>
                              <td>
                                {u.history && u.history.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                                    {u.history.map((h, hIdx) => (
                                      <span key={hIdx} style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                                        {h.type === 'audio' ? '🎵' : '🎥'} {h.title}
                                      </span>
                                    ))}
                                  </div>
                                ) : '—'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              Ro'yxatdan o'tgan a'zolar yo'q
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <span className="spinner"></span>
                <p style={{ marginTop: '15px' }}>Statistika yuklanmoqda...</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Broadcaster */}
        {activeTab === 'broadcast' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Xabar Yuborish (Broadcast)</h1>
              <p className="page-subtitle">Barcha bot a'zolariga reklama yoki e'lonlarni tarqating.</p>
            </div>

            <div className="bot-grid">
              {/* Broadcast Form */}
              <div className="glass-card">
                <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>Yangi Reklama</h3>
                <form onSubmit={handleStartBroadcast}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                      Xabar Matni (HTML qo'llab-quvvatlanadi)
                    </label>
                    <textarea 
                      className="text-input" 
                      style={{ width: '100%', minHeight: '150px', resize: 'vertical' }}
                      placeholder="Salom, botimizda yangi funksiya joriy etildi! 🚀"
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      disabled={loading || broadcastStatus.status === 'running'}
                      required
                    ></textarea>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                        Inline Tugma Matni (Ixtiyoriy)
                      </label>
                      <input 
                        type="text" 
                        className="text-input" 
                        style={{ width: '100%' }}
                        placeholder="Masalan: Kanalga o'tish"
                        value={broadcastButtonText}
                        onChange={(e) => setBroadcastButtonText(e.target.value)}
                        disabled={loading || broadcastStatus.status === 'running'}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                        Inline Tugma Havolasi (URL)
                      </label>
                      <input 
                        type="url" 
                        className="text-input" 
                        style={{ width: '100%' }}
                        placeholder="https://t.me/channel"
                        value={broadcastButtonUrl}
                        onChange={(e) => setBroadcastButtonUrl(e.target.value)}
                        disabled={loading || broadcastStatus.status === 'running'}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn" 
                    disabled={loading || !broadcastMessage || broadcastStatus.status === 'running' || !botStatus.running}
                  >
                    🚀 Reklamani Tarqatish
                  </button>
                  
                  {!botStatus.running && (
                    <small style={{ color: 'var(--color-danger)', marginTop: '8px', display: 'block' }}>
                      ⚠️ Xabar yuborish uchun botni yoqish kerak.
                    </small>
                  )}
                </form>
              </div>

              {/* Broadcast Progress */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-title)' }}>Yuborish Holati</h3>
                
                <div>
                  {broadcastStatus.status === 'running' && (
                    <span className="status-badge active" style={{ backgroundColor: 'var(--color-warning)' }}>
                      ⚡️ Yuborilmoqda
                    </span>
                  )}
                  {broadcastStatus.status === 'completed' && (
                    <span className="status-badge active" style={{ backgroundColor: 'var(--color-success)' }}>
                      ✓ Yakunlandi
                    </span>
                  )}
                  {broadcastStatus.status === 'failed' && (
                    <span className="status-badge inactive">● Xatolik yuz berdi</span>
                  )}
                  {broadcastStatus.status === 'idle' && (
                    <span className="status-badge inactive">● Kutish holati</span>
                  )}
                </div>

                {broadcastStatus.status !== 'idle' && (
                  <div>
                    <div className="progress-info" style={{ marginBottom: '8px' }}>
                      <span>Muvaffaqiyatli: {broadcastStatus.sent} / {broadcastStatus.total}</span>
                      <span>{Math.round((broadcastStatus.sent + broadcastStatus.failed) / broadcastStatus.total * 100) || 0}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          width: `${Math.round((broadcastStatus.sent + broadcastStatus.failed) / broadcastStatus.total * 100) || 0}%`,
                          backgroundColor: broadcastStatus.status === 'running' ? 'var(--color-warning)' : 'var(--color-success)'
                        }}
                      ></div>
                    </div>
                    <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Xatolar soni: {broadcastStatus.failed}
                    </small>
                  </div>
                )}

                <div className="logs-container">
                  <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--text-muted)', marginBottom: '8px' }}>Log:</h4>
                  <div className="logs-box">
                    {broadcastStatus.logs && broadcastStatus.logs.length > 0 ? (
                      broadcastStatus.logs.slice().reverse().map((l, i) => (
                        <div key={i} className="log-line">{l}</div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>Faoliyat yo'q.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 8: Sponsor Channel */}
        {activeTab === 'sponsor' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Majburiy A'zolik (Sponsor Channel)</h1>
              <p className="page-subtitle">Foydalanuvchilar botdan foydalanishidan oldin ma'lum bir kanalga a'zo bo'lishini talab qiling.</p>
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>Kanal Sozlamalari</h3>
              <form onSubmit={saveConfig}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={sponsorEnabled}
                      onChange={(e) => setSponsorEnabled(e.target.checked)}
                    />
                    <span className="slider-switch"></span>
                  </label>
                  <div>
                    <strong style={{ display: 'block' }}>Majburiy a'zolikni faollashtirish</strong>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      Yoqilganda, bot faqat a'zo bo'lgan foydalanuvchilar uchun ishlaydi.
                    </span>
                  </div>
                </div>

                {sponsorEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                        Kanal Username (Masalan: @kanal_nomi)
                      </label>
                      <input 
                        type="text" 
                        className="text-input" 
                        style={{ width: '100%' }}
                        placeholder="@mychannel"
                        value={sponsorUsernameInput}
                        onChange={(e) => setSponsorUsernameInput(e.target.value)}
                        required={sponsorEnabled}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                        Kanal Havolasi (Taklif havolasi)
                      </label>
                      <input 
                        type="url" 
                        className="text-input" 
                        style={{ width: '100%' }}
                        placeholder="https://t.me/mychannel"
                        value={sponsorLinkInput}
                        onChange={(e) => setSponsorLinkInput(e.target.value)}
                        required={sponsorEnabled}
                      />
                    </div>
                  </div>
                )}

                <button type="submit" className="btn" disabled={loading}>
                  {loading && <span className="spinner"></span>}
                  <span>Sozlamalarni Saqlash</span>
                </button>

                {configSaved && (
                  <span style={{ color: 'var(--color-success)', marginLeft: '15px', fontWeight: '500' }}>
                    ✓ Saqlandi
                  </span>
                )}
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
