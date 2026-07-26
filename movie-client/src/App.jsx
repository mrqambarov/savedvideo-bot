import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') 
  ? 'http://localhost:5001/api' 
  : '/movies/api';

// Axios Authorization Header Interceptor
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('movieAdminToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('movieAdminToken'));
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('movies');
  const [loading, setLoading] = useState(false);

  // Movie management states
  const [moviesList, setMoviesList] = useState([]);
  const [movieCode, setMovieCode] = useState('');
  const [movieTitle, setMovieTitle] = useState('');
  const [movieDesc, setMovieDesc] = useState('');
  const [movieFileId, setMovieFileId] = useState('');
  const [movieGenre, setMovieGenre] = useState('Tarjima kino');
  const [genresList] = useState(['Jangari', 'Komediya', 'Melodrama', 'Multfilm', 'Tarixiy', 'Tarjima kino', 'Sarguzasht']);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestsList, setRequestsList] = useState([]);

  // Bot & Sponsor states
  const [botStatus, setBotStatus] = useState({ running: false, hasToken: false });
  const [botTokenInput, setBotTokenInput] = useState('');
  const [adminIdsInput, setAdminIdsInput] = useState('');
  const [configSaved, setConfigSaved] = useState(false);
  const [sponsorEnabled, setSponsorEnabled] = useState(false);
  const [sponsorUsernameInput, setSponsorUsernameInput] = useState('');
  const [sponsorLinkInput, setSponsorLinkInput] = useState('');

  // Public catalog states
  const [publicMoviesList, setPublicMoviesList] = useState([]);
  const [publicConfig, setPublicConfig] = useState({ botUsername: '', sponsorEnabled: false, sponsorLink: '' });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [publicSearchQuery, setPublicSearchQuery] = useState('');
  const [selectedPublicGenre, setSelectedPublicGenre] = useState('Barchasi');

  // Analytics states
  const [statsData, setStatsData] = useState(null);

  // Broadcast states
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
      fetchMovies();
      fetchBotStatus();
      fetchConfig();
      fetchStats();
      fetchBroadcastStatus();
      fetchRequests();
    } else {
      fetchPublicConfig();
      fetchPublicMovies();
    }
  }, [isAuthenticated]);

  // Poll broadcast status when active
  useEffect(() => {
    let intervalId;
    if (broadcastStatus.status === 'running' && isAuthenticated) {
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
  }, [broadcastStatus.status, isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    try {
      const res = await axios.post(`${API_BASE}/login`, { password: passwordInput });
      localStorage.setItem('movieAdminToken', res.data.token);
      setIsAuthenticated(true);
      setShowLoginModal(false);
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Parol noto\'g\'ri!');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('movieAdminToken');
    setIsAuthenticated(false);
  };

  const fetchMovies = async () => {
    try {
      const res = await axios.get(`${API_BASE}/movies`);
      setMoviesList(res.data);
    } catch (err) {
      console.error('Failed to fetch movies:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_BASE}/requests`);
      setRequestsList(res.data);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    }
  };

  const fetchPublicConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/public-config`);
      setPublicConfig(res.data);
    } catch (err) {
      console.error('Failed to fetch public config:', err);
    }
  };

  const fetchPublicMovies = async () => {
    try {
      const res = await axios.get(`${API_BASE}/public-movies`);
      setPublicMoviesList(res.data);
    } catch (err) {
      console.error('Failed to fetch public movies:', err);
    }
  };

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
      if (res.data.moviesList) {
        setMoviesList(res.data.moviesList);
      }
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
      if (res.data.adminIds) setAdminIdsInput(res.data.adminIds);
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
      alert('Sozlama xatoligi: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddMovie = async (e) => {
    e.preventDefault();
    if (!movieCode || !movieTitle || !movieFileId) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/movies`, {
        code: movieCode,
        title: movieTitle,
        description: movieDesc,
        fileId: movieFileId,
        genre: movieGenre
      });
      setMovieCode('');
      setMovieTitle('');
      setMovieDesc('');
      setMovieFileId('');
      setMovieGenre('Tarjima kino');
      fetchMovies();
      fetchStats();
      alert('Kino muvaffaqiyatli qo\'shildi!');
    } catch (err) {
      alert('Kino qo\'shishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMovie = async (code) => {
    if (!confirm(`Haqiqatdan ham ${code} kodli kinoni o'chirmoqchimisiz?`)) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/movies/${code}`);
      fetchMovies();
      fetchStats();
    } catch (err) {
      alert('O\'chirishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRequest = async (id) => {
    try {
      await axios.post(`${API_BASE}/requests/${id}/complete`);
      fetchRequests();
    } catch (err) {
      alert('Xatolik: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteRequest = async (id) => {
    if (!confirm('Ushbu buyurtmani o\'chirmoqchimisiz?')) return;
    try {
      await axios.delete(`${API_BASE}/requests/${id}`);
      fetchRequests();
    } catch (err) {
      alert('Xatolik: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAddMovieFromRequest = (request) => {
    setMovieTitle(request.title);
    setActiveTab('movies');
    handleCompleteRequest(request.id);
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

  const filteredMovies = moviesList.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(m.code).includes(searchQuery) ||
    (m.genre && m.genre.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // If public view (not logged in) - Render stunning catalog
  if (!isAuthenticated) {
    const filteredPublicMovies = publicMoviesList.filter(m => {
      const matchesSearch = m.title.toLowerCase().includes(publicSearchQuery.toLowerCase()) || 
                            String(m.code).includes(publicSearchQuery);
      const matchesGenre = selectedPublicGenre === 'Barchasi' || m.genre === selectedPublicGenre;
      return matchesSearch && matchesGenre;
    });

    const heroMovie = publicMoviesList.length > 0 
      ? [...publicMoviesList].sort((a, b) => (b.views || 0) - (a.views || 0))[0]
      : null;

    return (
      <div className="catalog-container">
        {/* Header */}
        <header className="catalog-header">
          <div className="brand">
            <div className="brand-logo">🎬</div>
            <span className="brand-name">FilmZone</span>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowLoginModal(true)}>
            ⚙️ Boshqaruv Paneli
          </button>
        </header>

        {/* Hero Section */}
        {heroMovie ? (
          <div className="catalog-hero">
            <div className="catalog-hero-genre">{heroMovie.genre || 'Tarjima kino'}</div>
            <h1 className="catalog-hero-title">{heroMovie.title}</h1>
            <p className="catalog-hero-desc">
              {heroMovie.description || 'Ushbu kino hozirda eng ko\'p ko\'rilayotgan kinolar ro\'yxatida birinchi o\'rinda turibdi. Telegram botimiz orqali hoziroq tomosha qiling.'}
            </p>
            <a 
              href={`https://t.me/${publicConfig.botUsername || 'xitfilm_bot'}?start=${heroMovie.code}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="btn"
              style={{ width: 'fit-content', marginTop: '10px' }}
            >
              🎬 Hoziroq ko'rish
            </a>
          </div>
        ) : (
          <div className="catalog-hero" style={{ background: 'var(--bg-secondary)', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
            <h2 style={{ color: 'var(--text-muted)' }}>Kino bazasi bo'sh. Operatorlar tez orada qo'shishadi.</h2>
          </div>
        )}

        {/* Search & Genres */}
        <div className="catalog-search-row">
          <input 
            type="text" 
            className="text-input" 
            placeholder="Kino kodi yoki nomini kiriting..." 
            style={{ flex: 1, minWidth: '250px' }}
            value={publicSearchQuery}
            onChange={(e) => setPublicSearchQuery(e.target.value)}
          />
          <div className="catalog-filters">
            {['Barchasi', ...genresList].map((genre, idx) => (
              <button 
                key={idx} 
                className={`catalog-filter-btn ${selectedPublicGenre === genre ? 'active' : ''}`}
                onClick={() => setSelectedPublicGenre(genre)}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Movie Grid */}
        <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: '25px' }}>Barcha kinolar ({filteredPublicMovies.length})</h2>
        <div className="catalog-grid">
          {filteredPublicMovies.length > 0 ? (
            filteredPublicMovies.map((m, idx) => {
              const emojis = ['🍿', '🎬', '📽️', '🎞️', '🎥'];
              const emoji = emojis[idx % emojis.length];

              return (
                <div key={idx} className="movie-card">
                  <div className="movie-card-media">
                    <span>{emoji}</span>
                    <span className="movie-card-genre">{m.genre || 'Tarjima kino'}</span>
                  </div>
                  <div className="movie-card-content">
                    <h3 className="movie-card-title">{m.title}</h3>
                    <p className="movie-card-desc">{m.description || 'Kino haqida batafsil ma\'lumot berilmagan.'}</p>
                    <div className="movie-card-footer">
                      <div className="movie-card-stats">
                        <span>👁️ {m.views || 0} ta</span>
                        <span className="movie-card-likes">👍 {m.likes?.length || 0}</span>
                      </div>
                      <a 
                        href={`https://t.me/${publicConfig.botUsername || 'xitfilm_bot'}?start=${m.code}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn"
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        Ko'rish 🎬
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
              Kinolar topilmadi. Qayta qidirib ko'ring yoki boshqa janr tanlang.
            </div>
          )}
        </div>

        {/* Admin Login Modal */}
        {showLoginModal && (
          <div className="modal-overlay">
            <div className="login-card" style={{ position: 'relative' }}>
              <button className="modal-close-btn" onClick={() => setShowLoginModal(false)}>&times;</button>
              <div className="login-logo">⚙️</div>
              <h1 className="login-title">FilmZone Boshqaruv</h1>
              <p className="login-subtitle">Admin yoki operator paroli</p>
              
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
        )}
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">🎬</div>
          <span className="brand-name">FilmZone</span>
        </div>
        
        <ul className="menu-list">
          <li className={`menu-item ${activeTab === 'movies' ? 'active' : ''}`} onClick={() => setActiveTab('movies')}>
            <span className="menu-icon">🍿</span>
            <span>Kinolar ro'yxati</span>
          </li>
          <li className={`menu-item ${activeTab === 'bot' ? 'active' : ''}`} onClick={() => setActiveTab('bot')}>
            <span className="menu-icon">🤖</span>
            <span>Bot Configuration</span>
          </li>
          <li className={`menu-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => { setActiveTab('analytics'); fetchStats(); }}>
            <span className="menu-icon">📊</span>
            <span>Analytics</span>
          </li>
          <li className={`menu-item ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => { setActiveTab('requests'); fetchRequests(); }}>
            <span className="menu-icon">🙋‍♂️</span>
            <span>Kino buyurtmalari</span>
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

        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <button className="btn btn-secondary btn-danger" onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>🚪</span>
            <span>Chiqish</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="main-content">
        
        {/* Tab 1: Movies list */}
        {activeTab === 'movies' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Kinolar ro'yxati</h1>
              <p className="page-subtitle">Kino kodlari, nomlari va Telegram File ID ro'yxatini boshqaring.</p>
            </div>

            <div className="bot-grid">
              {/* Add movie form */}
              <div className="glass-card">
                <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>Yangi kino qo'shish</h3>
                <form onSubmit={handleAddMovie} className="login-form">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>Kino kodi</label>
                      <input 
                        type="text" 
                        className="text-input" 
                        placeholder="101" 
                        style={{ width: '100%' }}
                        value={movieCode}
                        onChange={(e) => setMovieCode(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>Kino nomi</label>
                      <input 
                        type="text" 
                        className="text-input" 
                        placeholder="Masalan: Forsaj 10 (Uzbekcha)" 
                        style={{ width: '100%' }}
                        value={movieTitle}
                        onChange={(e) => setMovieTitle(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>Telegram File ID</label>
                      <input 
                        type="text" 
                        className="text-input" 
                        placeholder="BAACAgIAAxkBAAMVY..." 
                        style={{ width: '100%' }}
                        value={movieFileId}
                        onChange={(e) => setMovieFileId(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>Janr / Kategoriya</label>
                      <select 
                        className="genre-select"
                        value={movieGenre}
                        onChange={(e) => setMovieGenre(e.target.value)}
                      >
                        {genresList.map((genre, idx) => (
                          <option key={idx} value={genre}>{genre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>Kino haqida qisqacha ma'lumot (Tavsif)</label>
                    <textarea 
                      className="text-input" 
                      style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                      placeholder="Ushbu kino haqida batafsil..."
                      value={movieDesc}
                      onChange={(e) => setMovieDesc(e.target.value)}
                    ></textarea>
                  </div>

                  <button type="submit" className="btn" disabled={loading}>
                    ➕ Kinoni Qo'shish
                  </button>
                </form>
              </div>

              {/* Movies list section */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-title)' }}>Filmlar bazasi</h3>
                <input 
                  type="text" 
                  className="text-input" 
                  placeholder="Kodi yoki nomi bo'yicha qidirish..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Kod</th>
                        <th>Nomi</th>
                        <th>Kategoriya (Janr)</th>
                        <th>Statistika / Baholar</th>
                        <th>Harakat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovies.length > 0 ? (
                        filteredMovies.map((m, idx) => (
                          <tr key={idx}>
                            <td><code>{m.code}</code></td>
                            <td title={m.description}><b>{m.title}</b></td>
                            <td><span className="genre-badge">{m.genre || 'Tarjima kino'}</span></td>
                            <td>
                              <span>👁️ {m.views || 0} ta</span>
                              <span style={{ marginLeft: '12px', color: 'var(--color-primary)' }}>👍 {m.likes?.length || 0}</span>
                              <span style={{ marginLeft: '8px', color: 'var(--color-danger)' }}>👎 {m.dislikes?.length || 0}</span>
                            </td>
                            <td>
                              <button className="btn btn-secondary btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleDeleteMovie(m.code)}>
                                O'chirish
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            Kinolar topilmadi
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Bot Manager */}
        {activeTab === 'bot' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Movie Bot Configuration</h1>
              <p className="page-subtitle">Telegram bot tokeni va admin boshqaruv sozlamalari.</p>
            </div>

            <div className="bot-grid">
              <div className="glass-card">
                <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>Sozlamalar</h3>
                <form onSubmit={saveConfig} className="login-form">
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                      Movie Bot Token
                    </label>
                    <input 
                      type="text" 
                      className="text-input" 
                      style={{ width: '100%' }}
                      placeholder="Masalan: 987654321:XYZabc..."
                      value={botTokenInput}
                      onChange={(e) => setBotTokenInput(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                      Admin Telegram ID raqamlari (Vergul bilan ajrating)
                    </label>
                    <input 
                      type="text" 
                      className="text-input" 
                      style={{ width: '100%' }}
                      placeholder="Masalan: 123456789, 987654321"
                      value={adminIdsInput}
                      onChange={(e) => setAdminIdsInput(e.target.value)}
                    />
                    <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Ushbu ID raqam egalari botga to'g'ridan-to'g'ri video yuborib kino qo'sha oladilar.
                    </small>
                  </div>

                  <button type="submit" className="btn" disabled={loading}>
                    💾 Saqlash
                  </button>

                  {configSaved && (
                    <span style={{ color: 'var(--color-success)', marginLeft: '15px', fontWeight: '500' }}>
                      ✓ Saqlandi
                    </span>
                  )}
                </form>
              </div>

              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-title)' }}>Bot Statusi</h3>
                
                <div>
                  {botStatus.running ? (
                    <span className="status-badge active">● Bot Ishlamoqda</span>
                  ) : (
                    <span className="status-badge inactive">● Bot To'xtatilgan</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                  <button 
                    className="btn" 
                    onClick={() => toggleBot('start')} 
                    disabled={loading || botStatus.running || !botStatus.hasToken && !botTokenInput}
                  >
                    ▶ Yoqish
                  </button>
                  <button 
                    className="btn btn-secondary btn-danger" 
                    onClick={() => toggleBot('stop')} 
                    disabled={loading || !botStatus.running}
                  >
                    ■ To'xtatish
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Analytics */}
        {activeTab === 'analytics' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Bot Analitikasi</h1>
              <p className="page-subtitle">A'zolar soni va ko'rishlar statistikasi.</p>
            </div>

            {statsData ? (
              <div>
                <div className="analytics-grid">
                  <div className="glass-card stat-card">
                    <span style={{ fontSize: '2rem' }}>👥</span>
                    <div className="stat-value">{statsData.totalUsers}</div>
                    <div className="stat-label">Jami A'zolar</div>
                  </div>
                  <div className="glass-card stat-card">
                    <span style={{ fontSize: '2rem' }}>🎬</span>
                    <div className="stat-value">{statsData.moviesList?.length || 0}</div>
                    <div className="stat-label">Bazadagi Kinolar</div>
                  </div>
                  <div className="glass-card stat-card">
                    <span style={{ fontSize: '2rem' }}>👁</span>
                    <div className="stat-value">{statsData.stats?.totalViews || 0}</div>
                    <div className="stat-label">Kinolar ko'rilishi</div>
                  </div>
                  <div className="glass-card stat-card">
                    <span style={{ fontSize: '2rem' }}>🔍</span>
                    <div className="stat-value">{statsData.stats?.totalSearchQueries || 0}</div>
                    <div className="stat-label">Qidiruvlar</div>
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
                          <th>Qo'shilgan sana</th>
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
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
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

        {/* Tab 6: Requests */}
        {activeTab === 'requests' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Foydalanuvchilar Buyurtmalari</h1>
              <p className="page-subtitle">Bot a'zolari tomonidan so'ralgan va topilmagan kinolar ro'yxati.</p>
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>Kutilayotgan buyurtmalar</h3>
              <div className="table-responsive">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>Kino nomi</th>
                      <th>Buyurtmachi</th>
                      <th>Sana</th>
                      <th>Holat</th>
                      <th>Harakatlar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestsList.length > 0 ? (
                      requestsList.map((req, idx) => (
                        <tr key={idx} style={{ opacity: req.status === 'completed' ? 0.5 : 1 }}>
                          <td><b>{req.title}</b></td>
                          <td><code>{req.username ? `@${req.username}` : `ID: ${req.userId}`}</code></td>
                          <td>{new Date(req.dateRequested).toLocaleString()}</td>
                          <td>
                            {req.status === 'completed' ? (
                              <span className="status-badge active">Bajarildi</span>
                            ) : (
                              <span className="status-badge inactive" style={{ background: 'rgba(255, 159, 67, 0.15)', color: 'var(--color-primary)' }}>Kutilmoqda</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {req.status !== 'completed' && (
                                <>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }} 
                                    onClick={() => handleAddMovieFromRequest(req)}
                                  >
                                    ➕ Qo'shish
                                  </button>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 12px', fontSize: '0.8rem' }} 
                                    onClick={() => handleCompleteRequest(req.id)}
                                  >
                                    ✓ Bajarildi
                                  </button>
                                </>
                              )}
                              <button 
                                className="btn btn-secondary btn-danger" 
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }} 
                                onClick={() => handleDeleteRequest(req.id)}
                              >
                                O'chirish
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          Hozircha buyurtmalar yo'q.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Broadcaster */}
        {activeTab === 'broadcast' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Broadcast Xabar Yuborish</h1>
              <p className="page-subtitle">Kino bot a'zolariga e'lon va reklama tarqating.</p>
            </div>

            <div className="bot-grid">
              <div className="glass-card">
                <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>Yangi Reklama</h3>
                <form onSubmit={handleStartBroadcast} className="login-form">
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                      Xabar Matni (HTML formatida)
                    </label>
                    <textarea 
                      className="text-input" 
                      style={{ width: '100%', minHeight: '150px', resize: 'vertical' }}
                      placeholder="Salom, botimizda yangi kinolar qo'shildi! 🎬"
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      disabled={loading || broadcastStatus.status === 'running'}
                      required
                    ></textarea>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>Tugma Matni</label>
                      <input 
                        type="text" 
                        className="text-input" 
                        placeholder="Masalan: Ko'rish"
                        value={broadcastButtonText}
                        onChange={(e) => setBroadcastButtonText(e.target.value)}
                        disabled={loading || broadcastStatus.status === 'running'}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>Tugma URL</label>
                      <input 
                        type="url" 
                        className="text-input" 
                        placeholder="https://t.me/yourchannel"
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
                    🚀 Yuborishni boshlash
                  </button>
                </form>
              </div>

              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-title)' }}>Yuborish Holati</h3>
                
                <div>
                  {broadcastStatus.status === 'running' && <span className="status-badge active" style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>⚡️ Yuborilmoqda</span>}
                  {broadcastStatus.status === 'completed' && <span className="status-badge active">✓ Yakunlandi</span>}
                  {broadcastStatus.status === 'failed' && <span className="status-badge inactive">● Xatolik yuz berdi</span>}
                  {broadcastStatus.status === 'idle' && <span className="status-badge inactive">● Kutish holati</span>}
                </div>

                {broadcastStatus.status !== 'idle' && (
                  <div>
                    <div className="progress-info" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Yuborildi: {broadcastStatus.sent} / {broadcastStatus.total}</span>
                      <span>{Math.round((broadcastStatus.sent + broadcastStatus.failed) / broadcastStatus.total * 100) || 0}%</span>
                    </div>
                    <div className="progress-bar-bg" style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          height: '100%',
                          width: `${Math.round((broadcastStatus.sent + broadcastStatus.failed) / broadcastStatus.total * 100) || 0}%`,
                          background: 'var(--grad-primary)'
                        }}
                      ></div>
                    </div>
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

        {/* Tab 5: Sponsor Channel */}
        {activeTab === 'sponsor' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Sponsorlik Kanali (Majburiy a'zolik)</h1>
              <p className="page-subtitle">Kino yuklab olishdan oldin majburiy a'zolikni sozlang.</p>
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font-title)' }}>Homiy kanal sozlamalari</h3>
              <form onSubmit={saveConfig} className="login-form">
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
                    <strong style={{ display: 'block' }}>Majburiy a'zolikni yoqish</strong>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      Yoqilganda, bot faqat homiy kanalga a'zo bo'lganlarga javob beradi.
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
                  💾 Sozlamalarni Saqlash
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
