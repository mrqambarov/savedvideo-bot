import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = `${window.location.origin}/api`;

// Sample Demo Movies dataset (High quality posters for instant rich visual experience)
const DEMO_MOVIES = [
  {
    code: '101',
    title: 'Chaqmoq Makvin 3 (Cars 3)',
    genre: 'Multfilm',
    views: 1420,
    likes: Array(120),
    dislikes: Array(4),
    rating: 8.8,
    poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80',
    description: 'Chaqmoq Makvin yangi avlod tezkor poygachilari bilan bellashish uchun o\'zining eng zo\'r mahoratini namoyish etishi kerak. Sarguzashtlarga boy sirkul va poyga animatsiyasi.'
  },
  {
    code: '102',
    title: 'Forsaj 10 (Fast X)',
    genre: 'Jangari',
    views: 2350,
    likes: Array(310),
    dislikes: Array(12),
    rating: 9.1,
    poster: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
    description: 'Dominik Toretto va uning oilasi o\'tmishdan kelgan yangi qudratli dushman - Dante bilan to\'qnash kelishadi. Yuqori tezlik va hayajonli jang sahnalari.'
  },
  {
    code: '103',
    title: 'Avatar 2: Suv Yo\'li',
    genre: 'Sarguzasht',
    views: 1890,
    likes: Array(280),
    dislikes: Array(8),
    rating: 9.4,
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    description: 'Jeyk Salli va Neytiri oilasi bilan Pandora okeanlari qa\'rida yangi qabilalar orasida panoh izlashadi. Fantastik olam va suv osti mo\'jizalari.'
  },
  {
    code: '104',
    title: 'Oppenheimer',
    genre: 'Tarixiy',
    views: 1120,
    likes: Array(190),
    dislikes: Array(3),
    rating: 9.2,
    poster: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=600&q=80',
    description: 'Atom bombasining otasi va yaratuvchisi J. Robert Oppenxaymerning dramatik hayoti va dunyo tarixini o\'zgartirgan kashfiyoti.'
  },
  {
    code: '105',
    title: 'Qalbing Chilparchin Bo\'ladi',
    genre: 'Melodrama',
    views: 950,
    likes: Array(140),
    dislikes: Array(5),
    rating: 8.5,
    poster: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=600&q=80',
    description: 'Sevgi, sadoqat va sinovlar haqida ta\'sirli tarjima drama. Chiroyli tuyg\'ular va kutilmagan taqdir burilishlari.'
  },
  {
    code: '106',
    title: 'Dacha 2026 (Kulgili komediya)',
    genre: 'Komediya',
    views: 1650,
    likes: Array(210),
    dislikes: Array(9),
    rating: 8.7,
    poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=600&q=80',
    description: 'Tog\' bag\'ridagi dachada to mehmonga kelgan do\'stlarning boshidan kechirgan sarguzashtlari va eng kulgili voqealari.'
  }
];

export default function App() {
  const [moviesList, setMoviesList] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('Barchasi');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [favorites, setFavorites] = useState([]);

  // Admin Modal States
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('movieAdminToken'));
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [botUsername, setBotUsername] = useState('xitfilm_bot');

  useEffect(() => {
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      }
    } catch (e) {}

    fetchMovies();
    fetchConfig();
  }, []);

  const fetchMovies = async () => {
    try {
      const res = await axios.get(`${API_BASE}/public-movies`);
      if (res.data && res.data.length > 0) {
        setMoviesList(res.data);
      } else {
        setMoviesList(DEMO_MOVIES);
      }
    } catch (err) {
      console.log('Using demo dataset for cinema visual experience');
      setMoviesList(DEMO_MOVIES);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/public-config`);
      if (res.data && res.data.botUsername) {
        setBotUsername(res.data.botUsername);
      }
    } catch (e) {}
  };

  const toggleFavorite = (movieCode) => {
    if (favorites.includes(movieCode)) {
      setFavorites(favorites.filter(c => c !== movieCode));
    } else {
      setFavorites([...favorites, movieCode]);
    }
  };

  // Filter movies
  const displayedMovies = moviesList.filter(m => {
    const matchSearch = (m.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        String(m.code).includes(searchQuery);
    const matchGenre = selectedGenre === 'Barchasi' ||
                       (selectedGenre === '⭐ Sevimlilar' ? favorites.includes(m.code) : m.genre === selectedGenre);
    return matchSearch && matchGenre;
  });

  const heroMovie = moviesList.length > 0 ? moviesList[0] : DEMO_MOVIES[0];
  const genres = ['Barchasi', 'Jangari', 'Komediya', 'Melodrama', 'Multfilm', 'Tarixiy', 'Sarguzasht', '⭐ Sevimlilar'];

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/login`, { password: passwordInput });
      if (res.data.token) {
        localStorage.setItem('movieAdminToken', res.data.token);
        setIsAuthenticated(true);
        setLoginError('');
      }
    } catch (err) {
      setLoginError('Parol noto\'g\'ri');
    }
  };

  return (
    <div className="cinema-app">
      {/* Header Navbar */}
      <header className="cinema-header">
        <div className="brand-title" onClick={() => { setSelectedGenre('Barchasi'); setSearchQuery(''); }}>
          🎬 FilmZone <span className="brand-badge">HD 4K</span>
        </div>

        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Kino kodi yoki nomini izlang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button className="btn-ghost-cinema" onClick={() => setShowAdminModal(true)}>
          ⚙️ {isAuthenticated ? 'Admin' : 'Kirish'}
        </button>
      </header>

      {/* Hero Cinema Banner (Top Featured Movie) */}
      {!searchQuery && selectedGenre === 'Barchasi' && heroMovie && (
        <div
          className="hero-banner"
          style={{ backgroundImage: `url(${heroMovie.poster || DEMO_MOVIES[0].poster})` }}
        >
          <div className="hero-overlay" />
          <div className="hero-content">
            <div className="hero-badge-row">
              <span className="badge-tag">TOP PREMYERA</span>
              <span className="badge-rating">⭐️ {heroMovie.rating || 9.1} IMDb</span>
              <span className="badge-tag" style={{ background: 'rgba(255,255,255,0.15)' }}>{heroMovie.genre || 'Tarjima kino'}</span>
            </div>
            <h1 className="hero-title">{heroMovie.title}</h1>
            <p className="hero-desc">{heroMovie.description}</p>
            <div className="hero-buttons">
              <button className="btn-cinema" onClick={() => setSelectedMovie(heroMovie)}>
                ▶ HOZIROQ KO'RISH
              </button>
              <a
                href={`https://t.me/${botUsername}?start=${heroMovie.code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost-cinema"
                style={{ textDecoration: 'none' }}
              >
                🤖 BOTDA SAQLASH (KOD: {heroMovie.code})
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="filter-bar">
        {genres.map((g, idx) => (
          <div
            key={idx}
            className={`filter-pill ${selectedGenre === g ? 'active' : ''}`}
            onClick={() => setSelectedGenre(g)}
          >
            {g}
          </div>
        ))}
      </div>

      {/* Movie Section Title */}
      <div className="section-head">
        <h2 className="section-title">
          🍿 {selectedGenre === 'Barchasi' ? 'Barcha Kinolar va Premyeralar' : selectedGenre}
        </h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {displayedMovies.length} ta film topildi
        </span>
      </div>

      {/* Movie Poster Grid */}
      <div className="movie-grid">
        {displayedMovies.map((m, idx) => (
          <div key={idx} className="movie-card" onClick={() => setSelectedMovie(m)}>
            <div className="poster-wrap">
              <img
                src={m.poster || DEMO_MOVIES[idx % DEMO_MOVIES.length].poster}
                alt={m.title}
                className="poster-img"
                loading="lazy"
              />
              <div className="poster-overlay">
                <div className="play-circle">▶</div>
              </div>
              <div className="card-code-badge">🔑 {m.code}</div>
              <div className="card-rating-badge">⭐️ {m.rating || (8 + (idx % 20) / 10).toFixed(1)}</div>
            </div>
            <div className="card-info">
              <div className="card-title">{m.title}</div>
              <div className="card-sub">
                <span>{m.genre || 'Tarjima kino'}</span>
                <span>👁 {m.views || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cinema Player Modal */}
      {selectedMovie && (
        <div className="modal-backdrop" onClick={() => setSelectedMovie(null)}>
          <div className="modal-cinema-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedMovie(null)}>✕</button>

            <div className="video-player-container">
              {selectedMovie.fileId ? (
                <video controls autoPlay style={{ width: '100%', height: '100%' }}>
                  <source src={`${API_BASE}/stream/${selectedMovie.code}`} type="video/mp4" />
                  Kino pleyeri qo'llab-quvvatlanmadi.
                </video>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', background: 'radial-gradient(circle, #1a1c29 0%, #08090c 100%)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🎬</div>
                  <h3 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '8px' }}>{selectedMovie.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                    Ushbu kinoni to'liq HD formatda tomosha qilish va yuklab olish uchun Telegram botga o'ting!
                  </p>
                  <a
                    href={`https://t.me/${botUsername}?start=${selectedMovie.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-cinema"
                    style={{ textDecoration: 'none' }}
                  >
                    🚀 TELEGRAM BOTDA TOMOSHA QILISH (KOD: {selectedMovie.code})
                  </a>
                </div>
              )}
            </div>

            <div className="modal-details">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="modal-title">{selectedMovie.title}</h2>
                <button
                  className="btn-ghost-cinema"
                  style={{ borderRadius: '12px', padding: '6px 14px', fontSize: '0.85rem' }}
                  onClick={() => toggleFavorite(selectedMovie.code)}
                >
                  {favorites.includes(selectedMovie.code) ? '⭐ Sevimlilarda' : '☆ Sevimlilarga qo\'shish'}
                </button>
              </div>

              <div className="modal-meta">
                <span className="badge-tag">{selectedMovie.genre || 'Tarjima kino'}</span>
                <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>⭐️ {selectedMovie.rating || 9.0} IMDb</span>
                <span>🔑 kodi: {selectedMovie.code}</span>
                <span>👁 {selectedMovie.views || 0} marta ko'rilgan</span>
              </div>

              <p className="modal-desc">{selectedMovie.description || 'Juda ham qiziqarli tarjima kino. Telegram botimiz orqali uni barcha sifatlarda yuklab olishingiz mumkin.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showAdminModal && (
        <div className="modal-backdrop" onClick={() => setShowAdminModal(false)}>
          <div className="modal-cinema-card" style={{ maxWidth: '420px', padding: '30px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowAdminModal(false)}>✕</button>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', marginBottom: '10px' }}>⚙️ Admin Panelga Kirish</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Kinolar, foydalanuvchilar va reklamalarni boshqarish uchun admin parolini kiriting.
            </p>

            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="password"
                className="search-input"
                style={{ paddingLeft: '16px', borderRadius: '12px' }}
                placeholder="Admin paroli..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
              {loginError && <div style={{ color: 'var(--primary-red)', fontSize: '0.85rem' }}>{loginError}</div>}
              <button type="submit" className="btn-cinema" style={{ justifyContent: 'center' }}>
                Kirish
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Mobile Navigation */}
      <nav className="bottom-nav">
        <div className={`nav-item ${selectedGenre === 'Barchasi' ? 'active' : ''}`} onClick={() => setSelectedGenre('Barchasi')}>
          <span className="nav-icon">🏠</span>
          <span>Asosiy</span>
        </div>
        <div className={`nav-item ${selectedGenre === 'Jangari' ? 'active' : ''}`} onClick={() => setSelectedGenre('Jangari')}>
          <span className="nav-icon">🔥</span>
          <span>Jangari</span>
        </div>
        <div className={`nav-item ${selectedGenre === '⭐ Sevimlilar' ? 'active' : ''}`} onClick={() => setSelectedGenre('⭐ Sevimlilar')}>
          <span className="nav-icon">⭐</span>
          <span>Sevimlilar</span>
        </div>
        <div className="nav-item" onClick={() => setShowAdminModal(true)}>
          <span className="nav-icon">⚙️</span>
          <span>Admin</span>
        </div>
      </nav>
    </div>
  );
}
