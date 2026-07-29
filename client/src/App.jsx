import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') 
  ? 'http://localhost:5000/api' 
  : '/api';

// Axios Authorization Header Interceptor
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('adminToken'));
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

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
  const [adminIdsInput, setAdminIdsInput] = useState('');
  const [shazamKeyInput, setShazamKeyInput] = useState('');
  const [configSaved, setConfigSaved] = useState(false);
  const [sponsorEnabled, setSponsorEnabled] = useState(false);
  const [sponsorUsernameInput, setSponsorUsernameInput] = useState('');
  const [sponsorLinkInput, setSponsorLinkInput] = useState('');

  // Analytics States
  const [statsData, setStatsData] = useState(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Channels (Multi-Sponsor) States
  const [channelsList, setChannelsList] = useState([]);
  const [newChannelUsername, setNewChannelUsername] = useState('');
  const [newChannelLink, setNewChannelLink] = useState('');
  const [channelsSaved, setChannelsSaved] = useState(false);

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
    if (isAuthenticated) {
      fetchBotStatus();
      fetchConfig();
      fetchStats();
      fetchBroadcastStatus();
      fetchChannels();
    }
  }, [isAuthenticated]);

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

  const handleToggleBan = async (userId, currentBanned) => {
    try {
      await axios.post(`${API_BASE}/users/${userId}/ban`, { banned: !currentBanned });
      fetchStats();
    } catch (err) {
      alert('Foydalanuvchi holatini o\'zgartirishda xatolik: ' + (err.response?.data?.error || err.message));
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await axios.get(`${API_BASE}/channels`);
      setChannelsList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  };

  const saveChannels = async (updatedChannels) => {
    try {
      const res = await axios.post(`${API_BASE}/channels`, { channels: updatedChannels });
      setChannelsList(res.data.channels || []);
      setChannelsSaved(true);
      setTimeout(() => setChannelsSaved(false), 3000);
    } catch (err) {
      alert('Kanallarni saqlashda xatolik: ' + (err.response?.data?.error || err.message));
    }
  };

  const addChannel = () => {
    if (!newChannelUsername || !newChannelLink) return;
    if (channelsList.length >= 5) {
      return alert('Maksimal 5 ta kanal qo\'shish mumkin.');
    }
    const updated = [...channelsList, { username: newChannelUsername, link: newChannelLink }];
    saveChannels(updated);
    setNewChannelUsername('');
    setNewChannelLink('');
  };

  const removeChannel = (index) => {
    const updated = channelsList.filter((_, i) => i !== index);
    saveChannels(updated);
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
      if (res.data.adminIds !== undefined) setAdminIdsInput(res.data.adminIds);
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
        adminIds: adminIdsInput,
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    try {
      const res = await axios.post(`${API_BASE}/login`, { password: passwordInput });
      localStorage.setItem('adminToken', res.data.token);
      setIsAuthenticated(true);
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Parol noto\'g\'ri!');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
  };

  const handleUploadCookies = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('cookies', file);
    try {
      await axios.post(`${API_BASE}/upload-cookies`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      alert('cookies.txt muvaffaqiyatli saqlandi! Endi bot orqali qoshiq yuklab olishni boshqatdan urunib ko\'ring.');
    } catch (err) {
      alert('Cookies yuklashda xatolik: ' + (err.response?.data?.error || err.message));
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

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">V</div>
          <h1 className="login-title">VibeConvert</h1>
          <p className="login-subtitle">Admin paneli tizimiga kirish</p>

          <form onSubmit={handleLogin} className="login-form">
            <div>
              <input
                type="password"
                className="text-input"
                style={{ width: '100%', textAlign: 'center' }}
                placeholder="Parolni kiriting"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
              />
            </div>

            {loginError && (
              <div className="login-error-msg">⚠️ {loginError}</div>
            )}

            <button type="submit" className="btn" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Kirish'}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
          <li className={`menu-item ${activeTab === 'sponsor' ? 'active' : ''}`} onClick={() => { setActiveTab('sponsor'); fetchChannels(); }}>
            <span className="menu-icon">🔒</span>
            <span>Sponsor Kanallar</span>
          </li>
        </ul>

        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <button className="btn btn-secondary btn-danger" onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>🚪</span>
            <span>Chiqish</span>
          </button>
        </div>
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
                      Telegram Admin ID lari (Masalan: 12345678, 98765432)
                    </label>
                    <input
                      type="text"
                      className="text-input"
                      style={{ width: '100%' }}
                      placeholder="Telegram ID laringiz (vergul bilan)"
                      value={adminIdsInput}
                      onChange={(e) => setAdminIdsInput(e.target.value)}
                    />
                    <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Telegram bot ichida /admin va /stats komandalaridan foydalana oladigan adminlar ID lari.
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

              {/* YouTube cookies.txt Upload Panel */}
              <div className="glass-card">
                <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>YouTube cookies.txt Yuklash</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                  Agar botda YouTube yuklashlari <b>"Sign in to confirm you're not a bot"</b> xatosi bilan ishlamay qolsa, bu yerga brauzeringizdan eksport qilingan <code>cookies.txt</code> faylini yuklang.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <input
                    type="file"
                    id="cookiesFileSelect"
                    accept=".txt"
                    onChange={handleUploadCookies}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => document.getElementById('cookiesFileSelect').click()}
                    disabled={loading}
                  >
                    📂 Cookies.txt Tanlash
                  </button>
                  <small style={{ color: 'var(--text-muted)', display: 'block' }}>
                    Tavsiya etiladigan kengaytma: <b>Get cookies.txt LOCALLY</b> (Chrome/Firefox).
                  </small>
                </div>
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

        {/* Tab 6: Advanced Analytics */}
        {activeTab === 'analytics' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Bot Analitikasi & Boshqaruvi</h1>
              <p className="page-subtitle">Kunlik ko'rsatkichlar, foydalanuvchilar o'sishi va faollik tahlili.</p>
            </div>

            {statsData ? (
              <div>
                {/* Summary Cards */}
                <div className="analytics-grid">
                  <div className="glass-card stat-card">
                    <span className="stat-icon">👥</span>
                    <div className="stat-value">{statsData.totalUsers}</div>
                    <div className="stat-label">Jami A'zolar</div>
                  </div>
                  <div className="glass-card stat-card">
                    <span className="stat-icon">📥</span>
                    <div className="stat-value">{statsData.stats?.totalDownloadsVideo || 0}</div>
                    <div className="stat-label">Jami Video Yuklash</div>
                  </div>
                  <div className="glass-card stat-card">
                    <span className="stat-icon">🎵</span>
                    <div className="stat-value">{statsData.stats?.totalDownloadsAudio || 0}</div>
                    <div className="stat-label">Jami Musiqa Yuklash</div>
                  </div>
                  <div className="glass-card stat-card">
                    <span className="stat-icon">🔍</span>
                    <div className="stat-value">{statsData.stats?.totalSearchQueries || 0}</div>
                    <div className="stat-label">Jami Qidiruvlar</div>
                  </div>
                </div>

                {/* Today vs Yesterday & Growth Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '25px' }}>
                  <div className="glass-card">
                    <h3 style={{ marginBottom: '15px', fontFamily: 'var(--font-title)', fontSize: '1rem' }}>📈 Yangi Foydalanuvchilar</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(99, 102, 241, 0.12)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)' }}>{statsData.growth?.newUsersToday || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bugun</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-muted)' }}>{statsData.growth?.newUsersYesterday || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kecha</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(59, 130, 246, 0.12)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#3b82f6' }}>{statsData.growth?.newUsersWeek || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>7 Kun</div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card">
                    <h3 style={{ marginBottom: '15px', fontFamily: 'var(--font-title)', fontSize: '1rem' }}>🟢 Faol Foydalanuvchilar</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(245, 158, 11, 0.12)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>{statsData.active?.today || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bugun</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(245, 158, 11, 0.06)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-muted)' }}>{statsData.active?.yesterday || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kecha</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(168, 85, 247, 0.12)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#a855f7' }}>{statsData.active?.month || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>30 Kun</div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card">
                    <h3 style={{ marginBottom: '15px', fontFamily: 'var(--font-title)', fontSize: '1rem' }}>📊 Kunlik yuklashlar taqqoslamasi</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>🎥 Video (Bugun / Kecha)</span>
                        <span style={{ fontWeight: 600 }}>{statsData.usage?.today?.downloadsVideo || 0} / {statsData.usage?.yesterday?.downloadsVideo || 0}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>🎵 Audio (Bugun / Kecha)</span>
                        <span style={{ fontWeight: 600 }}>{statsData.usage?.today?.downloadsAudio || 0} / {statsData.usage?.yesterday?.downloadsAudio || 0}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>🔍 Qidiruv (Bugun / Kecha)</span>
                        <span style={{ fontWeight: 600 }}>{statsData.usage?.today?.searches || 0} / {statsData.usage?.yesterday?.searches || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 30-Day Trend Table */}
                <div className="glass-card" style={{ marginTop: '25px' }}>
                  <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>📅 Kunlik Analitika Jadvali (Oxirgi 30 Kun)</h3>
                  <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>Sana</th>
                          <th>Yangi A'zolar</th>
                          <th>Faol Userlar</th>
                          <th>🎥 Video</th>
                          <th>🎵 Audio</th>
                          <th>🔍 Qidiruv</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsData.trend && statsData.trend.map((t, i) => {
                          const isToday = t.date === new Date().toISOString().split('T')[0];
                          return (
                            <tr key={i} style={{ background: isToday ? 'rgba(99, 102, 241, 0.12)' : 'transparent' }}>
                              <td style={{ fontWeight: isToday ? 700 : 400 }}>
                                {t.date} {isToday && <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', marginLeft: '4px' }}>(Bugun)</span>}
                              </td>
                              <td style={{ color: t.newUsers > 0 ? '#10b981' : 'inherit', fontWeight: t.newUsers > 0 ? 600 : 400 }}>+{t.newUsers}</td>
                              <td style={{ fontWeight: t.activeUsers > 0 ? 600 : 400 }}>{t.activeUsers}</td>
                              <td>{t.downloadsVideo}</td>
                              <td>{t.downloadsAudio}</td>
                              <td>{t.searches}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Users List & Search */}
                <div className="glass-card" style={{ marginTop: '25px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                    <h3 style={{ fontFamily: 'var(--font-title)', margin: 0 }}>
                      Bot A'zolari Ro'yxati ({statsData.usersList ? statsData.usersList.length : 0})
                    </h3>
                    <input
                      type="text"
                      className="text-input"
                      style={{ minWidth: '280px' }}
                      placeholder="🔍 ID, username yoki ismdan izlash..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="table-responsive">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Foydalanuvchi</th>
                          <th>Qo'shilgan Sana</th>
                          <th>Oxirgi Faollik</th>
                          <th>Takliflar</th>
                          <th>Holati</th>
                          <th>Boshqaruv</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsData.usersList && statsData.usersList.length > 0 ? (
                          statsData.usersList
                            .filter(u => {
                              if (!userSearchQuery) return true;
                              const q = userSearchQuery.toLowerCase();
                              return (
                                String(u.id).includes(q) ||
                                (u.username && u.username.toLowerCase().includes(q)) ||
                                (u.first_name && u.first_name.toLowerCase().includes(q)) ||
                                (u.last_name && u.last_name.toLowerCase().includes(q))
                              );
                            })
                            .map((u, i) => (
                              <tr key={i}>
                                <td><code>{u.id}</code></td>
                                <td>
                                  <div>
                                    <strong>{u.first_name || 'Foydalanuvchi'} {u.last_name || ''}</strong>
                                    {u.username && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{u.username}</div>}
                                  </div>
                                </td>
                                <td style={{ fontSize: '0.85rem' }}>
                                  {u.dateJoined ? u.dateJoined.replace('T', ' ').substring(0, 16) : '—'}
                                </td>
                                <td style={{ fontSize: '0.85rem' }}>
                                  {u.lastSeen ? u.lastSeen.replace('T', ' ').substring(0, 16) : '—'}
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600, color: u.refCount > 0 ? '#10b981' : 'inherit' }}>
                                    {u.refCount || 0} ta
                                  </span>
                                </td>
                                <td>
                                  {u.banned ? (
                                    <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.85rem' }}>⛔ Bloklangan</span>
                                  ) : (
                                    <span style={{ color: '#10b981', fontWeight: 500, fontSize: '0.85rem' }}>✅ Faol</span>
                                  )}
                                </td>
                                <td>
                                  <button
                                    className={`btn btn-secondary ${u.banned ? '' : 'btn-danger'}`}
                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                    onClick={() => handleToggleBan(u.id, u.banned)}
                                  >
                                    {u.banned ? '🔓 Unban' : '⛔ Ban'}
                                  </button>
                                </td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              Ro'yxatdan o'tgan a'zolar topilmadi
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

        {/* Tab 8: Sponsor Channels (Multi-Channel Rotation) */}
        {activeTab === 'sponsor' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Sponsor Kanallar (Rotatsiya)</h1>
              <p className="page-subtitle">Kanallar har 2 kunda avtomatik almashadi. Maksimal 5 ta kanal qo'shish mumkin.</p>
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: '15px', fontFamily: 'var(--font-title)' }}>📢 Hozirgi Kanallar</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Kanallar ro'yxati. Bot ularni har 2 kunda navbatma-navbat almashtiradi. Birinchi kanalni qo'shganingizda sponsor tekshiruvi avtomatik yoqiladi.
              </p>

              {channelsList.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px' }}>
                  {channelsList.map((ch, idx) => {
                    const epochDays = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
                    const activeIdx = Math.floor(epochDays / 2) % channelsList.length;
                    const isActive = idx === activeIdx;
                    return (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderRadius: '12px',
                        border: isActive ? '2px solid var(--color-primary)' : '1px solid var(--border-glass)',
                        background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {isActive && <span style={{ fontSize: '0.7rem', background: 'var(--color-primary)', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>FAOL</span>}
                          <div>
                            <div style={{ fontWeight: 600 }}>{ch.username}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ch.link}</div>
                          </div>
                        </div>
                        <button
                          className="btn btn-secondary btn-danger"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => removeChannel(idx)}
                        >
                          🗑 O'chirish
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', border: '1px dashed var(--border-glass)', borderRadius: '12px', marginBottom: '25px' }}>
                  Hozircha hech qanday sponsor kanal qo'shilmagan.
                </div>
              )}

              {channelsSaved && (
                <div style={{ color: 'var(--color-success)', marginBottom: '15px', fontWeight: '500' }}>
                  ✓ Kanallar muvaffaqiyatli saqlandi!
                </div>
              )}

              <h4 style={{ marginBottom: '12px', fontFamily: 'var(--font-title)', color: 'var(--text-muted)' }}>➕ Yangi Kanal Qo'shish</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Username</label>
                  <input
                    type="text"
                    className="text-input"
                    style={{ width: '100%' }}
                    placeholder="@kanal_nomi"
                    value={newChannelUsername}
                    onChange={(e) => setNewChannelUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Havola</label>
                  <input
                    type="url"
                    className="text-input"
                    style={{ width: '100%' }}
                    placeholder="https://t.me/kanal_nomi"
                    value={newChannelLink}
                    onChange={(e) => setNewChannelLink(e.target.value)}
                  />
                </div>
                <button className="btn" onClick={addChannel} disabled={!newChannelUsername || !newChannelLink || channelsList.length >= 5}>
                  ➕ Qo'shish
                </button>
              </div>
            </div>

            {/* Legacy Sponsor (from .env) */}
            <div className="glass-card" style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '15px', fontFamily: 'var(--font-title)' }}>⚙️ .env Sozlamalari (Zaxira)</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Agar yuqoridagi kanallar ro'yxati bo'sh bo'lsa, bot ushbu sozlamalardan foydalanadi.
              </p>
              <form onSubmit={saveConfig}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={sponsorEnabled}
                      onChange={(e) => setSponsorEnabled(e.target.checked)}
                    />
                    <span className="slider-switch"></span>
                  </label>
                  <span>Majburiy a'zolikni faollashtirish (.env)</span>
                </div>

                {sponsorEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Username</label>
                      <input type="text" className="text-input" style={{ width: '100%' }} placeholder="@mychannel" value={sponsorUsernameInput} onChange={(e) => setSponsorUsernameInput(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Havola</label>
                      <input type="url" className="text-input" style={{ width: '100%' }} placeholder="https://t.me/mychannel" value={sponsorLinkInput} onChange={(e) => setSponsorLinkInput(e.target.value)} />
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-secondary" disabled={loading}>
                  {loading && <span className="spinner"></span>}
                  <span>Saqlash</span>
                </button>
                {configSaved && <span style={{ color: 'var(--color-success)', marginLeft: '10px' }}>✓ Saqlandi</span>}
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
