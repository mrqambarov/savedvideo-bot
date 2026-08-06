import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = `${window.location.origin}/api`;

// Rich 2026 World & Uzbek Cinema Dataset for stunning initial look
const RICH_PORTAL_MOVIES = [
  {
    code: '101',
    title: 'Forsaj 10 (Fast X - Ultra HD)',
    genre: 'Jangari',
    year: '2024',
    rating: 9.3,
    views: 3420,
    likes: Array(450),
    dislikes: Array(15),
    poster: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    description: 'Dominik Toretto va uning oilasi o\'tmishdan kelgan yangi qudratli dushman - Dante bilan to\'qnash kelishadi. Yuqori tezlik, portlashlar va poyga sahnalari.'
  },
  {
    code: '102',
    title: 'Chaqmoq Makvin 3 (Cars 3)',
    genre: 'Multfilm',
    year: '2023',
    rating: 8.9,
    views: 2150,
    likes: Array(280),
    dislikes: Array(6),
    poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
    description: 'Chaqmoq Makvin yangi avlod tezkor poygachilari bilan bellashish uchun o\'zining eng zo\'r mahoratini namoyish etishi kerak. Oila va sadoqat haqida sirkul animatsiya.'
  },
  {
    code: '103',
    title: 'Avatar 2: Suv Yo\'li (Avatar 2)',
    genre: 'Sarguzasht',
    year: '2024',
    rating: 9.5,
    views: 4890,
    likes: Array(620),
    dislikes: Array(12),
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    description: 'Jeyk Salli va Neytiri oilasi bilan Pandora okeanlari qa\'rida yangi qabilalar orasida panoh izlashadi. Fantastik suv osti olami va 4K vizual effektlar.'
  },
  {
    code: '104',
    title: 'Oppenheimer (4K HDR)',
    genre: 'Tarixiy',
    year: '2023',
    rating: 9.2,
    views: 1820,
    likes: Array(240),
    dislikes: Array(5),
    poster: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=800&q=80',
    description: 'Atom bombasining otasi va yaratuvchisi J. Robert Oppenxaymerning dramatik hayoti va dunyo tarixini tubdan o\'zgartirgan tadqiqotlari.'
  },
  {
    code: '105',
    title: 'Dune: 2-Qism (Dune 2)',
    genre: 'Sarguzasht',
    year: '2024',
    rating: 9.4,
    views: 3100,
    likes: Array(410),
    dislikes: Array(8),
    poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    description: 'Pol Atreydes Fremenlar va Chani bilan birlashib, oilasini yo\'q qilgan fitnachilarga qarshi muqaddas intiqom urushini boshlaydi.'
  },
  {
    code: '106',
    title: 'Qalbing Chilparchin Bo\'ladi',
    genre: 'Melodrama',
    year: '2024',
    rating: 8.6,
    views: 1250,
    likes: Array(190),
    dislikes: Array(7),
    poster: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=800&q=80',
    description: 'Sevgi, sadoqat va sinovlar haqida ta\'sirli tarjima drama. Chiroyli tuyg\'ular va kutilmagan taqdir burilishlari.'
  },
  {
    code: '107',
    title: 'Dacha 2026 (Kulgili komediya)',
    genre: 'Komediya',
    year: '2026',
    rating: 8.8,
    views: 2650,
    likes: Array(330),
    dislikes: Array(10),
    poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80',
    description: 'Tog\' bag\'ridagi dachada to mehmonga kelgan do\'stlarning boshidan kechirgan sarguzashtlari va eng kulgili voqealari.'
  }
];

export default function App() {
  const [moviesList, setMoviesList] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('Barchasi');
  const [selectedMood, setSelectedMood] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);

  // Comments & Rating state inside modal
  const [userRating, setUserRating] = useState(5);
  const [reviewsData, setReviewsData] = useState({ reviews: [], avgRating: 4.9 });
  const [newCommentText, setNewCommentText] = useState('');

  // Admin Modal
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

  useEffect(() => {
    if (selectedMovie && selectedMovie.code) {
      fetchReviews(selectedMovie.code);
    }
  }, [selectedMovie]);

  const fetchReviews = async (code) => {
    try {
      const res = await axios.get(`${API_BASE}/public-reviews/${code}`);
      if (res.data && Array.isArray(res.data.reviews)) {
        setReviewsData(res.data);
      }
    } catch (e) {}
  };

  // Auto carousel slide timer
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % (moviesList.length || RICH_PORTAL_MOVIES.length));
    }, 6000);
    return () => clearInterval(timer);
  }, [moviesList]);

  const fetchMovies = async () => {
    try {
      const res = await axios.get(`${API_BASE}/public-movies`);
      if (res.data && res.data.length > 0) {
        setMoviesList(res.data);
      } else {
        setMoviesList(RICH_PORTAL_MOVIES);
      }
    } catch (err) {
      setMoviesList(RICH_PORTAL_MOVIES);
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

  const toggleFavorite = (code) => {
    if (favorites.includes(code)) {
      setFavorites(favorites.filter(c => c !== code));
    } else {
      setFavorites([...favorites, code]);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedMovie) return;
    try {
      const res = await axios.post(`${API_BASE}/public-reviews/${selectedMovie.code}`, {
        name: 'Foydalanuvchi',
        rating: userRating,
        comment: newCommentText.trim()
      });
      if (res.data && Array.isArray(res.data.reviews)) {
        setReviewsData(res.data);
      }
    } catch (e) {
      // Local fallback
      setReviewsData(prev => ({
        ...prev,
        reviews: [{ name: 'Foydalanuvchi', rating: userRating, comment: newCommentText.trim(), date: 'Hozir' }, ...prev.reviews]
      }));
    }
    setNewCommentText('');
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/login`, { password: passwordInput });
      if (res.data.token) {
        localStorage.setItem('dlToken', res.data.token);
        localStorage.setItem('movieToken', res.data.token);
        localStorage.setItem('movieAdminToken', res.data.token);
        setIsAuthenticated(true);
        setLoginError('');
        setShowAdminModal(false);
        window.location.href = '/';
      }
    } catch (err) {
      setLoginError('Parol noto\'g\'ri');
    }
  };

  const activeMovies = moviesList.length > 0 ? moviesList : RICH_PORTAL_MOVIES;
  const currentHero = activeMovies[heroIndex % activeMovies.length] || activeMovies[0];

  const displayedMovies = activeMovies.filter(m => {
    const matchSearch = (m.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        String(m.code).includes(searchQuery);
    const matchGenre = selectedGenre === 'Barchasi' ||
                       (selectedGenre === '⭐ Sevimlilar' ? favorites.includes(m.code) : m.genre === selectedGenre);
    return matchSearch && matchGenre;
  });

  const genresList = ['Barchasi', 'Jangari', 'Komediya', 'Melodrama', 'Multfilm', 'Tarixiy', 'Sarguzasht', '⭐ Sevimlilar'];

  return (
    <div className="movie-portal">
      {/* Top Navbar Header */}
      <header className="site-navbar">
        <div className="portal-brand" onClick={() => { setSelectedGenre('Barchasi'); setSearchQuery(''); }}>
          <div className="brand-icon">🎬</div>
          <span>FILMZONE <span style={{ color: 'var(--primary-red)', fontSize: '1rem' }}>PRO</span></span>
        </div>

        <ul className="nav-menu">
          <li className={`nav-link ${selectedGenre === 'Barchasi' ? 'active' : ''}`} onClick={() => setSelectedGenre('Barchasi')}>Premyeralar</li>
          <li className={`nav-link ${selectedGenre === 'Jangari' ? 'active' : ''}`} onClick={() => setSelectedGenre('Jangari')}>Jangari</li>
          <li className={`nav-link ${selectedGenre === 'Komediya' ? 'active' : ''}`} onClick={() => setSelectedGenre('Komediya')}>Komediya</li>
          <li className={`nav-link ${selectedGenre === 'Multfilm' ? 'active' : ''}`} onClick={() => setSelectedGenre('Multfilm')}>Multfilmlar</li>
          <li className={`nav-link ${selectedGenre === '⭐ Sevimlilar' ? 'active' : ''}`} onClick={() => setSelectedGenre('⭐ Sevimlilar')}>Sevimlilar ({favorites.length})</li>
        </ul>

        <div className="navbar-actions">
          <div className="search-input-wrap">
            <span className="search-icon-svg">🔍</span>
            <input
              type="text"
              className="site-search-input"
              placeholder="Kino kodi yoki nomi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary-site"
          >
            🤖 TELEGRAM BOT
          </a>

          <button className="btn-outline-site" onClick={() => { if (isAuthenticated) { window.location.href = '/'; } else { setShowAdminModal(true); } }}>
            ⚙️ {isAuthenticated ? 'Admin Panel' : 'Kirish'}
          </button>
        </div>
      </header>

      {/* Hero Carousel Slider */}
      {!searchQuery && selectedGenre === 'Barchasi' && currentHero && (
        <div
          className="site-hero-slider"
          style={{ backgroundImage: `url(${currentHero.poster || RICH_PORTAL_MOVIES[0].poster})` }}
        >
          <div className="hero-vignette" />
          <div className="hero-info">
            <div className="meta-badges">
              <span className="badge-hd">4K ULTRA HD</span>
              <span className="badge-imdb">⭐️ {currentHero.rating || 9.2} IMDb</span>
              <span className="badge-year">{currentHero.year || '2024'}</span>
              <span className="badge-year" style={{ background: 'rgba(229, 9, 20, 0.2)', color: '#ff3366' }}>{currentHero.genre || 'Tarjima kino'}</span>
            </div>
            <h1 className="hero-main-title">{currentHero.title}</h1>
            <p className="hero-synopsis">{currentHero.description}</p>

            <div className="hero-cta">
              <button className="btn-primary-site" style={{ padding: '14px 34px', fontSize: '1rem' }} onClick={() => setSelectedMovie(currentHero)}>
                ▶ HOZIROQ TOMOSHA QILISH
              </button>
              <a
                href={`https://t.me/${botUsername}?start=${currentHero.code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline-site"
                style={{ padding: '14px 28px', textDecoration: 'none' }}
              >
                🍿 TELEGRAMDA SAQLASH (KOD: {currentHero.code})
              </a>
            </div>
          </div>

          {/* Slider Pagination Dots */}
          <div className="slider-dots">
            {activeMovies.slice(0, 5).map((_, idx) => (
              <div
                key={idx}
                className={`dot ${heroIndex === idx ? 'active' : ''}`}
                onClick={() => setHeroIndex(idx)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mood Selector Bar (Kayfiyatga qarab kino saralash) */}
      <div style={{ padding: '0 5%', marginTop: '24px' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🎭 BUGUN QANDAY KAYFIYATDASIZ?</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(1-click tavsiya)</span>
        </div>
        <div className="genre-chips-scroll" style={{ paddingBottom: '6px' }}>
          {[
            { key: 'all', label: '✨ Barcha kinolar' },
            { key: 'funny', label: '😃 Kulgili & Quvnoq' },
            { key: 'action', label: '🚀 Sarguzasht & Adrenalin' },
            { key: 'romantic', label: '❤️ Romantic & Sevgi' },
            { key: 'family', label: '👨‍👩‍👧‍👦 Oila bilan' },
            { key: 'historical', label: '🧠 Tarixiy & Triller' }
          ].map((m) => (
            <div
              key={m.key}
              className={`genre-chip ${selectedMood === m.key ? 'active' : ''}`}
              style={{
                background: selectedMood === m.key ? 'linear-gradient(135deg, #ffc107, #ff9800)' : 'rgba(255,255,255,0.06)',
                color: selectedMood === m.key ? '#000' : '#fff',
                fontWeight: 700
              }}
              onClick={() => {
                setSelectedMood(m.key);
                if (m.key === 'funny') setSelectedGenre('Komediya');
                else if (m.key === 'action') setSelectedGenre('Jangari');
                else if (m.key === 'romantic') setSelectedGenre('Melodrama');
                else if (m.key === 'family') setSelectedGenre('Multfilm');
                else if (m.key === 'historical') setSelectedGenre('Tarixiy');
                else setSelectedGenre('Barchasi');
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>

      {/* Genre Filter Chips */}
      <div className="genre-chips-scroll">
        {genresList.map((g, idx) => (
          <div
            key={idx}
            className={`genre-chip ${selectedGenre === g ? 'active' : ''}`}
            onClick={() => setSelectedGenre(g)}
          >
            {g}
          </div>
        ))}
      </div>

      {/* Main Section */}
      <main className="portal-section">
        <div className="section-header">
          <h2 className="section-heading">
            🔥 {selectedGenre === 'Barchasi' ? 'Premyeralar va Saralangan Kinolar' : selectedGenre}
          </h2>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {displayedMovies.length} ta kino mavjud
          </span>
        </div>

        {/* Poster Grid */}
        <div className="poster-cards-grid">
          {displayedMovies.map((m, idx) => (
            <div key={idx} className="cinema-card" onClick={() => setSelectedMovie(m)}>
              <div className="card-poster-frame">
                <img
                  src={m.poster || RICH_PORTAL_MOVIES[idx % RICH_PORTAL_MOVIES.length].poster}
                  alt={m.title}
                  className="card-img"
                  loading="lazy"
                />
                <div className="card-play-hover">
                  <div className="play-glow-btn">▶</div>
                </div>
                <div className="badge-top-left">🔑 {m.code}</div>
                <div className="badge-top-right">⭐️ {m.rating || (8.5 + (idx % 10) / 10).toFixed(1)}</div>
              </div>
              <div className="card-details-box">
                <div className="card-movie-title">{m.title}</div>
                <div className="card-meta-line">
                  <span>{m.genre || 'Tarjima kino'}</span>
                  <span>👁 {m.views || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Full Cinema Video Player Modal */}
      {selectedMovie && (
        <div className="cinema-modal-overlay" onClick={() => setSelectedMovie(null)}>
          <div className="cinema-modal-window" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-modal" onClick={() => setSelectedMovie(null)}>✕</button>

            <div className="modal-player-screen">
              {selectedMovie.fileId ? (
                <video controls autoPlay style={{ width: '100%', height: '100%' }}>
                  <source src={`${API_BASE}/stream/${selectedMovie.code}`} type="video/mp4" />
                  Kino pleyeri qo'llab-quvvatlanmadi.
                </video>
              ) : (
                <div style={{ padding: '50px 20px', textAlign: 'center', background: 'radial-gradient(circle, #181b28 0%, #06070a 100%)' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🎬</div>
                  <h3 style={{ fontSize: '1.6rem', color: '#fff', marginBottom: '10px', fontFamily: 'var(--font-title)' }}>{selectedMovie.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px auto' }}>
                    Ushbu film kodi: <strong>{selectedMovie.code}</strong>. Telegram botimiz orqali uni barcha sifatlarda (720p, 1080p) tomosha qiling yoki tezkor yuklab oling!
                  </p>
                  <a
                    href={`https://t.me/${botUsername}?start=${selectedMovie.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary-site"
                    style={{ textDecoration: 'none', padding: '12px 30px' }}
                  >
                    🚀 TELEGRAM BOTDA KO'RISH (KOD: {selectedMovie.code})
                  </a>
                </div>
              )}
            </div>

            <div className="modal-info-body">
              <div className="modal-header-row">
                <h2 className="modal-movie-title">{selectedMovie.title}</h2>
                <button
                  className="btn-outline-site"
                  onClick={() => toggleFavorite(selectedMovie.code)}
                >
                  {favorites.includes(selectedMovie.code) ? '⭐ Sevimlilarda' : '☆ Sevimlilarga Qo\'shish'}
                </button>
              </div>

              <div className="meta-badges">
                <span className="badge-hd">4K ULTRA HD</span>
                <span className="badge-imdb">⭐️ {selectedMovie.rating || 9.2} IMDb</span>
                <span className="badge-year">🔑 Kodi: {selectedMovie.code}</span>
                <span className="badge-year">{selectedMovie.genre || 'Tarjima kino'}</span>
                <span className="badge-year">👁 {selectedMovie.views || 0} marta ko'rilgan</span>
              </div>

              <p className="hero-synopsis" style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {selectedMovie.description || 'Juda ta\'sirli va hayajonli tarjima kino. Yuqori sifat va professional tarjimada taqdim etiladi.'}
              </p>

              {/* Comments & Rating Section */}
              <div className="comments-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', margin: 0 }}>
                    💬 Tomoshabinlar Sharhlari ({reviewsData.reviews?.length || 0})
                  </h4>
                  <div style={{ background: 'rgba(255,193,7,0.15)', color: '#ffc107', padding: '4px 12px', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem' }}>
                    ⭐️ {reviewsData.avgRating || '5.0'} / 5.0
                  </div>
                </div>

                {/* 1-5 Star Rating Picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Baho bering:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setUserRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.4rem',
                        cursor: 'pointer',
                        color: star <= userRating ? '#ffc107' : 'rgba(255,255,255,0.2)',
                        transition: 'transform 0.1s'
                      }}
                    >
                      ★
                    </button>
                  ))}
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffc107', marginLeft: '6px' }}>{userRating} / 5</span>
                </div>

                <form onSubmit={handleAddComment} className="comment-input-row">
                  <input
                    type="text"
                    className="comment-input"
                    placeholder="Kino haqida fikringizni yozib qoldiring..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                  />
                  <button type="submit" className="btn-primary-site" style={{ borderRadius: '12px', padding: '0 20px' }}>
                    Yuborish
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                  {reviewsData.reviews && reviewsData.reviews.length > 0 ? (
                    reviewsData.reviews.map((c, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '4px' }}>
                          <span>👤 {c.name || 'Foydalanuvchi'} <span style={{ color: '#ffc107', fontSize: '0.8rem', marginLeft: '6px' }}>{'★'.repeat(c.rating || 5)}</span></span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.date || 'Hozir'}</span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{c.comment || c.text}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Hozircha sharhlar mavjud emas. Birinchi bo'lib fikringizni yozib qoldiring!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showAdminModal && (
        <div className="cinema-modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="cinema-modal-window" style={{ maxWidth: '440px', padding: '30px' }} onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-modal" onClick={() => setShowAdminModal(false)}>✕</button>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', marginBottom: '10px' }}>⚙️ Admin Panelga Kirish</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Kinolarni bazaga qo'shish va boshqaruv uchun parolni kiriting.
            </p>

            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="password"
                className="site-search-input"
                style={{ paddingLeft: '18px', borderRadius: '12px' }}
                placeholder="Admin paroli..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
              {loginError && <div style={{ color: 'var(--primary-red)', fontSize: '0.85rem' }}>{loginError}</div>}
              <button type="submit" className="btn-primary-site" style={{ justifyContent: 'center' }}>
                Kirish
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Site Footer */}
      <footer className="site-footer">
        <div>
          <div style={{ fontWeight: 800, color: '#fff', fontSize: '1.1rem', fontFamily: 'var(--font-title)', marginBottom: '4px' }}>🎬 FILMZONE PRO CINEMA</div>
          <div>Barcha huquqlar saqlangan © 2026. Sifatli va tezkor kino portali.</div>
        </div>
        <div>
          <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer" className="btn-primary-site" style={{ textDecoration: 'none' }}>
            🤖 Telegram Botga o'tish
          </a>
        </div>
      </footer>
    </div>
  );
}
