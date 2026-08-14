import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';

const API_BASE = window.location.port === '5173'
  ? 'http://localhost:5001/api'
  : `${window.location.origin}/api`;

const DEFAULT_MOVIES = [
  {
    code: '477',
    title: 'Gunohkorlar (Sinners 4K)',
    description: 'Gunohkorlar - Hayajonli va shiddatli tarjima kino. Yuqori HD sifatda va o\'zbek tilida.',
    fileId: 'BAACAgIAAxkBAAOiamZZc9TpXKpR4fHv7jQuzG_iduMAAnh5AAK8DZBJaBaLtaXl6Tc9BA',
    genre: 'Jangari',
    poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
    rating: 9.2,
    quality: '4K ULTRA HD',
    year: '2024',
    views: 15400,
    likes: [],
    dislikes: []
  },
  {
    code: '484',
    title: 'Oshkoralik Kuni',
    description: 'Oshkoralik kuni - Sirli va dramatik voqealar rivojiga boy o\'zbek tilidagi tarjima kino.',
    fileId: 'BAACAgIAAxkBAAIBYmps2VaqxkSMrUYVldx3gzWpIinMAAI_nAACDsvoSq_HArzdf6esPQQ',
    genre: 'Melodrama',
    poster: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=800&q=80',
    rating: 8.9,
    quality: 'FULL HD',
    year: '2024',
    views: 12800,
    likes: [],
    dislikes: []
  },
  {
    code: '1001',
    title: 'Titanlar Jangi 2 (Wrath of the Titans)',
    description: 'Persey ma\'budlar va titanlar o\'rtasidagi dahshatli to\'qnashuvda dunyoni saqlab qolishi kerak.',
    fileId: 'BAACAgIAAxkBAAOiamZZc9TpXKpR4fHv7jQuzG_iduMAAnh5AAK8DZBJaBaLtaXl6Tc9BA',
    genre: 'Sarguzasht',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    rating: 9.4,
    quality: '4K ULTRA HD',
    year: '2023',
    views: 18900,
    likes: [],
    dislikes: []
  },
  {
    code: '1002',
    title: 'Men Afsonaman (I Am Legend)',
    description: 'Nyu-Yorkda qolgan so\'nggi inson virusga qarshi zardob yaratish uchun kurashadi.',
    fileId: 'BAACAgIAAxkBAAIBYmps2VaqxkSMrUYVldx3gzWpIinMAAI_nAACDsvoSq_HArzdf6esPQQ',
    genre: 'Sarguzasht',
    poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    rating: 9.5,
    quality: '4K ULTRA HD',
    year: '2024',
    views: 21400,
    likes: [],
    dislikes: []
  },
  {
    code: '1003',
    title: 'Sahro Ovchilari (Badland Hunters)',
    description: 'Xarobaga aylangan shaharda omon qolish va xavfli dushmanlarga qarshi shafqatsiz janglar.',
    fileId: 'BAACAgQAAxkBAAIBZGps2V6_DuDT3dMhT78T7jwsui06AAKEGQACjK8pULyG_hhcPUkoPQQ',
    genre: 'Jangari',
    poster: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    rating: 9.1,
    quality: 'FULL HD',
    year: '2024',
    views: 14100,
    likes: [],
    dislikes: []
  },
  {
    code: '1004',
    title: 'RED 2 (Agentlar Qaytishi)',
    description: 'Nafaqadagi maxsus agentlar yangi avlod qurollariga qarshi birlashadilar.',
    fileId: 'BAACAgUAAxkBAAIBZmps2WXZfHQCEq3jajZPFgS5sYPvAAL4DAACkEtIV7SCorOQmEGyPQQ',
    genre: 'Jangari',
    poster: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=800&q=80',
    rating: 9.0,
    quality: 'FULL HD',
    year: '2023',
    views: 11300,
    likes: [],
    dislikes: []
  },
  {
    code: '1005',
    title: 'Devlarni Yenggan Jek',
    description: 'Insaniyat va devlar dunyosi o\'rtasidagi qadimiy afsonaviy urush.',
    fileId: 'BAACAgQAAxkBAAIBaGps2W6rJredhFQklUGyTDKG_RihAAIbEgAC79TRUPaX7IBno0F2PQQ',
    genre: 'Sarguzasht',
    poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80',
    rating: 8.8,
    quality: 'FULL HD',
    year: '2023',
    views: 9800,
    likes: [],
    dislikes: []
  },
  {
    code: '1006',
    title: 'O\'g\'irlangan Qiz (Taken)',
    description: 'Sobiq maxfiy xizmat xodimi o\'g\'irlangan qizini qutqarish uchun Parijga yo\'l oladi.',
    fileId: 'BAACAgQAAxkBAAIBamps2XheASZvNN5_n9Gx-QABBpyn7AACrR4AAtNfIVM3uSxpU_HFKz0E',
    genre: 'Tarixiy',
    poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
    rating: 9.3,
    quality: '4K ULTRA HD',
    year: '2024',
    views: 16500,
    likes: [],
    dislikes: []
  },
  {
    code: '1007',
    title: 'Majburiy Hamkorlik',
    description: 'Ikki turli politsiya maxsus agenti jinoyat to\'dasini yo\'q qilish uchun majburan birlashadilar.',
    fileId: 'BAACAgQAAxkBAAIBbGps2a5gek7GkygoiRK51xiCHAhtAAJnHAACz8MwU4ohgHBoabMpPQQ',
    genre: 'Komediya',
    poster: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=800&q=80',
    rating: 8.7,
    quality: 'HD 720p',
    year: '2024',
    views: 10200,
    likes: [],
    dislikes: []
  },
  {
    code: '1008',
    title: 'Inson G\'azabi (Wrath of Man)',
    description: 'Mister X inkassatorlik kompaniyasiga ishga kirib, millionlab dollarlarni o\'g\'irlagan to\'dani poylaydi.',
    fileId: 'BAACAgQAAxkBAAIBbmps2cAzt8Ic7Im7Asby-TzBh3IYAALFHgACYpVBU9laYmaY2SlXPQQ',
    genre: 'Jangari',
    poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
    rating: 9.5,
    quality: '4K ULTRA HD',
    year: '2024',
    views: 23100,
    likes: [],
    dislikes: []
  }
];

export default function App() {
  const [moviesList, setMoviesList] = useState(() => {
    try {
      const cached = localStorage.getItem('xitfilm_cached_movies');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].code === '477' || parsed[0].code === '1001')) {
          return parsed;
        }
      }
      return DEFAULT_MOVIES;
    } catch (e) {
      return DEFAULT_MOVIES;
    }
  });

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('xitfilm_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // UI Filters
  const [selectedGenre, setSelectedGenre] = useState('Barchasi');
  const [sortBy, setSortBy] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState('');

  // Player State
  const [streamQuality, setStreamQuality] = useState('720p');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const videoRef = useRef(null);

  // Reviews
  const [userRating, setUserRating] = useState(5);
  const [reviewsData, setReviewsData] = useState({ reviews: [], avgRating: 4.9 });
  const [newCommentText, setNewCommentText] = useState('');

  // Admin Modal & Config
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
    try {
      localStorage.setItem('xitfilm_favorites', JSON.stringify(favorites));
    } catch (e) {}
  }, [favorites]);

  useEffect(() => {
    if (selectedMovie && selectedMovie.code) {
      fetchReviews(selectedMovie.code);
    }
  }, [selectedMovie]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, selectedMovie]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % (moviesList.length || 1));
    }, 7000);
    return () => clearInterval(timer);
  }, [moviesList]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2500);
  };

  const fetchMovies = async () => {
    try {
      const res = await axios.get(`${API_BASE}/public-movies`, { timeout: 5000 });
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setMoviesList(res.data);
        localStorage.setItem('xitfilm_cached_movies', JSON.stringify(res.data));
      }
    } catch (err) {}
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/public-config`);
      if (res.data && res.data.botUsername) {
        setBotUsername(res.data.botUsername);
      }
    } catch (e) {}
  };

  const fetchReviews = async (code) => {
    try {
      const res = await axios.get(`${API_BASE}/public-reviews/${code}`);
      if (res.data && Array.isArray(res.data.reviews)) {
        setReviewsData(res.data);
      }
    } catch (e) {}
  };

  const toggleFavorite = (code, e) => {
    if (e) e.stopPropagation();
    if (favorites.includes(code)) {
      setFavorites(favorites.filter((c) => c !== code));
      showToast('❌ Sevimlilardan olib tashlandi');
    } else {
      setFavorites([...favorites, code]);
      showToast('⭐ Sevimlilarga saqlandi!');
    }
  };

  const copyMovieCode = (code, e) => {
    if (e) e.stopPropagation();
    try {
      navigator.clipboard.writeText(String(code));
      showToast(`📋 Kino kodi: ${code} nusxalandi!`);
    } catch (err) {
      showToast(`🔑 Kino kodi: ${code}`);
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
      setReviewsData((prev) => ({
        ...prev,
        reviews: [
          { name: 'Foydalanuvchi', rating: userRating, comment: newCommentText.trim(), date: 'Hozirgina' },
          ...prev.reviews
        ]
      }));
    }
    setNewCommentText('');
    showToast('💬 Sharhingiz qo\'shildi!');
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/login`, { password: passwordInput });
      if (res.data.token) {
        localStorage.setItem('movieAdminToken', res.data.token);
        setIsAuthenticated(true);
        setLoginError('');
        setShowAdminModal(false);
        window.location.href = '/';
      }
    } catch (err) {
      setLoginError('Parol noto\'g\'ri!');
    }
  };

  const activeMovies = moviesList.length > 0 ? moviesList : DEFAULT_MOVIES;
  const currentHero = activeMovies[heroIndex % activeMovies.length] || activeMovies[0];

  const processedMovies = useMemo(() => {
    let result = activeMovies.filter((m) => {
      const matchSearch =
        (m.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(m.code).includes(searchQuery);
      const matchGenre =
        selectedGenre === 'Barchasi' ||
        (selectedGenre === '⭐ Sevimlilar'
          ? favorites.includes(m.code)
          : m.genre === selectedGenre);
      return matchSearch && matchGenre;
    });

    if (sortBy === 'popular') {
      result.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sortBy === 'rating') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'newest') {
      result.sort((a, b) => (b.year || 0) - (a.year || 0));
    }

    return result;
  }, [activeMovies, searchQuery, selectedGenre, favorites, sortBy]);

  const genresList = [
    'Barchasi',
    'Jangari',
    'Komediya',
    'Melodrama',
    'Multfilm',
    'Tarixiy',
    'Sarguzasht',
    '⭐ Sevimlilar'
  ];

  const relatedMovies = useMemo(() => {
    if (!selectedMovie) return [];
    return activeMovies
      .filter((m) => m.code !== selectedMovie.code && (m.genre === selectedMovie.genre || m.year === selectedMovie.year))
      .slice(0, 4);
  }, [selectedMovie, activeMovies]);

  return (
    <div className="clean-cinema-app">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification-pop">
          {toastMessage}
        </div>
      )}

      {/* Floating Capsule Glass Navbar Header */}
      <div className="header-capsule-wrapper">
        <header className="capsule-site-navbar">
          <div
            className="capsule-brand"
            onClick={() => {
              setSelectedGenre('Barchasi');
              setSearchQuery('');
            }}
          >
            <div className="capsule-brand-icon">🎬</div>
            <div className="capsule-brand-text">
              <span className="brand-main">XIT<span className="brand-film">FILM</span></span>
              <span className="brand-pro-tag">PRO 4K</span>
            </div>
          </div>

          <nav className="capsule-nav-menu">
            <button
              className={`capsule-nav-btn ${selectedGenre === 'Barchasi' ? 'active' : ''}`}
              onClick={() => setSelectedGenre('Barchasi')}
            >
              Premyeralar
            </button>
            <button
              className={`capsule-nav-btn ${selectedGenre === 'Jangari' ? 'active' : ''}`}
              onClick={() => setSelectedGenre('Jangari')}
            >
              Jangari
            </button>
            <button
              className={`capsule-nav-btn ${selectedGenre === 'Komediya' ? 'active' : ''}`}
              onClick={() => setSelectedGenre('Komediya')}
            >
              Komediya
            </button>
            <button
              className={`capsule-nav-btn ${selectedGenre === 'Multfilm' ? 'active' : ''}`}
              onClick={() => setSelectedGenre('Multfilm')}
            >
              Multfilmlar
            </button>
            <button
              className={`capsule-nav-btn ${selectedGenre === '⭐ Sevimlilar' ? 'active' : ''}`}
              onClick={() => setSelectedGenre('⭐ Sevimlilar')}
            >
              Sevimlilar ({favorites.length})
            </button>
          </nav>

          <div className="capsule-actions">
            <div className="capsule-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="capsule-search-input"
                placeholder="Kino kodi yoki nomi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <span className="search-clear-btn" onClick={() => setSearchQuery('')}>✕</span>
              )}
            </div>

            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-tg-gradient"
            >
              🤖 TELEGRAM BOT
            </a>

            <button
              className="btn-admin-glass"
              onClick={() => {
                if (isAuthenticated) {
                  window.location.href = '/';
                } else {
                  setShowAdminModal(true);
                }
              }}
            >
              ⚙️ {isAuthenticated ? 'Admin' : 'Kirish'}
            </button>
          </div>
        </header>
      </div>

      {/* Main Content Container */}
      <div className="main-content-container">
        {/* Clean Hero Carousel Banner */}
        {!searchQuery && selectedGenre === 'Barchasi' && currentHero && (
          <div
            className="site-hero-slider"
            style={{ backgroundImage: `url(${currentHero.poster || DEFAULT_MOVIES[0].poster})` }}
          >
            <div className="hero-vignette" />
            <div className="hero-info">
              <div className="meta-badges">
                <span className="badge-hd">{currentHero.quality || '4K ULTRA HD'}</span>
                <span className="badge-imdb">⭐️ {currentHero.rating || 9.4} IMDb</span>
                <span
                  className="badge-code-clickable"
                  onClick={(e) => copyMovieCode(currentHero.code, e)}
                  title="Kodni nusxalash"
                >
                  🔑 Kodi: {currentHero.code}
                </span>
              </div>
              <h1 className="hero-main-title">{currentHero.title}</h1>
              <p className="hero-synopsis">{currentHero.description}</p>

              <div className="hero-cta">
                <button
                  className="btn-primary-site btn-hero-play"
                  onClick={() => setSelectedMovie(currentHero)}
                >
                  ▶ HOZIROQ TOMOSHA QILISH
                </button>
                <a
                  href={`https://t.me/${botUsername}?start=${currentHero.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline-site hero-tg-btn"
                >
                  🍿 TELEGRAMDA SAQLASH (KOD: {currentHero.code})
                </a>
              </div>
            </div>

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

        {/* Category Filter & Sorting Row */}
        <div className="filter-sort-row">
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

          <div className="sort-dropdown-wrap">
            <span className="sort-label">Saralash:</span>
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="popular">🔥 Eng mashhurlar</option>
              <option value="rating">⭐ Yuqori reytingli</option>
              <option value="newest">📅 Eng yangilar</option>
            </select>
          </div>
        </div>

        {/* Enhanced Movie Catalog Grid */}
        <main className="portal-section">
          <div className="section-header">
            <h2 className="section-heading">
              🎬 {selectedGenre === 'Barchasi' ? 'Premyeralar va Saralangan Kinolar' : selectedGenre}
            </h2>
            <span className="section-count-badge">
              {processedMovies.length} ta kino mavjud
            </span>
          </div>

          <div className="poster-cards-grid">
            {processedMovies.map((m, idx) => (
              <div key={idx} className="cinema-card-enhanced" onClick={() => setSelectedMovie(m)}>
                <div className="card-poster-frame">
                  <img
                    src={m.poster || DEFAULT_MOVIES[idx % DEFAULT_MOVIES.length].poster}
                    alt={m.title}
                    className="card-img"
                    loading="lazy"
                    decoding="async"
                  />
                  
                  {/* Hover Overlay with Pulsing Play Button */}
                  <div className="card-play-hover">
                    <div className="play-pulse-circle">▶</div>
                  </div>

                  {/* Quality Pill Tag on Poster Top-Left */}
                  <div className="card-quality-pill">
                    {m.quality || '4K ULTRA'}
                  </div>

                  {/* Code Badge */}
                  <div
                    className="badge-code-top"
                    onClick={(e) => copyMovieCode(m.code, e)}
                    title="Kodni nusxalash"
                  >
                    🔑 {m.code}
                  </div>

                  {/* Rating Badge */}
                  <div className="badge-rating-top">
                    ⭐️ {m.rating || (8.8 + (idx % 10) / 10).toFixed(1)}
                  </div>

                  {/* Favorite Bookmark Star */}
                  <div
                    className={`card-fav-star ${favorites.includes(m.code) ? 'active' : ''}`}
                    onClick={(e) => toggleFavorite(m.code, e)}
                    title="Sevimlilarga saqlash"
                  >
                    {favorites.includes(m.code) ? '★' : '☆'}
                  </div>
                </div>

                {/* Card Info Details */}
                <div className="card-details-enhanced">
                  <h3 className="card-movie-title">{m.title}</h3>
                  
                  <div className="card-meta-row">
                    <span className="genre-pill-tag">{m.genre || 'Tarjima kino'}</span>
                    <span className="views-count-pill">👁 {(m.views || 1200).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Full Cinema Video Player Modal */}
      {selectedMovie && (
        <div className="cinema-modal-overlay" onClick={() => setSelectedMovie(null)}>
          <div className="cinema-modal-window" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-modal" onClick={() => setSelectedMovie(null)}>✕</button>

            <div className="modal-player-screen">
              {selectedMovie.videoUrl && (selectedMovie.videoUrl.includes('youtube.com') || selectedMovie.videoUrl.includes('youtu.be')) ? (
                <iframe
                  src={selectedMovie.videoUrl.includes('embed/') ? `${selectedMovie.videoUrl}?autoplay=1` : `https://www.youtube.com/embed/${selectedMovie.videoUrl.split('v=')[1]?.split('&')[0] || selectedMovie.videoUrl.split('youtu.be/')[1]}?autoplay=1`}
                  title={selectedMovie.title}
                  className="cinema-video-element"
                  style={{ border: 'none', width: '100%', height: '100%' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  className="cinema-video-element"
                  poster={selectedMovie.poster}
                >
                  <source
                    src={`${API_BASE}/public-stream/${selectedMovie.code}`}
                    type="video/mp4"
                  />
                  Brauzeringiz HTML5 videoni qo'llab-quvvatlamaydi.
                </video>
              )}

              <div className="player-controls-overlay">
                <div className="player-quality-selector">
                  <span className="ctrl-title">⚡ Sifat:</span>
                  {['360p', '480p', '720p', '1080p'].map((q) => (
                    <button
                      key={q}
                      className={`btn-ctrl-pill ${streamQuality === q ? 'active' : ''}`}
                      onClick={() => setStreamQuality(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <div className="player-speed-selector">
                  <span className="ctrl-title">⏱ Tezlik:</span>
                  {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      className={`btn-ctrl-pill ${playbackSpeed === s ? 'active' : ''}`}
                      onClick={() => setPlaybackSpeed(s)}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-info-body">
              <div className="modal-header-row">
                <div>
                  <h2 className="modal-movie-title">{selectedMovie.title}</h2>
                  <div className="modal-subtitle-line">
                    <span>{selectedMovie.year || '2024'}</span> • <span>{selectedMovie.duration || '2s 15m'}</span> • <span style={{ color: '#ffb703' }}>⭐️ {selectedMovie.rating || 9.2} IMDb</span> • <span style={{ color: '#06b6d4', cursor: 'pointer' }} onClick={(e) => copyMovieCode(selectedMovie.code, e)}>🔑 Kod: {selectedMovie.code} (Nusxalash)</span>
                  </div>
                </div>

                <div className="modal-action-btns">
                  <button
                    className={`btn-outline-site ${favorites.includes(selectedMovie.code) ? 'active-fav' : ''}`}
                    onClick={(e) => toggleFavorite(selectedMovie.code, e)}
                  >
                    {favorites.includes(selectedMovie.code) ? '⭐ Sevimlilarda' : '☆ Sevimlilarga Qo\'shish'}
                  </button>

                  <a
                    href={`https://t.me/${botUsername}?start=${selectedMovie.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary-site"
                    style={{ textDecoration: 'none' }}
                  >
                    🚀 BOTDA YUKLASH (KOD: {selectedMovie.code})
                  </a>
                </div>
              </div>

              <p className="modal-synopsis-text">
                {selectedMovie.description || 'Juda ta\'sirli va hayajonli tarjima kino. Yuqori sifat va professional tarjimada taqdim etiladi.'}
              </p>

              {relatedMovies.length > 0 && (
                <div className="related-movies-section">
                  <h4 className="related-heading">🍿 SHUNGA O'XSHASH KINOLAR:</h4>
                  <div className="related-grid">
                    {relatedMovies.map((rm, idx) => (
                      <div
                        key={idx}
                        className="related-card"
                        onClick={() => setSelectedMovie(rm)}
                      >
                        <img src={rm.poster} alt={rm.title} className="related-img" />
                        <div className="related-title">{rm.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="comments-section">
                <div className="comments-header">
                  <h4 className="comments-title">
                    💬 Tomoshabinlar Sharhlari ({reviewsData.reviews?.length || 0})
                  </h4>
                  <div className="rating-pill-avg">
                    ⭐️ {reviewsData.avgRating || '4.9'} / 5.0
                  </div>
                </div>

                <div className="star-picker-row">
                  <span>Baho bering:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setUserRating(star)}
                      className={`star-btn ${star <= userRating ? 'gold' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="selected-star-num">{userRating} / 5</span>
                </div>

                <form onSubmit={handleAddComment} className="comment-input-row">
                  <input
                    type="text"
                    className="comment-input"
                    placeholder="Kino haqida fikringizni yozing..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                  />
                  <button type="submit" className="btn-primary-site" style={{ borderRadius: '12px', padding: '0 24px' }}>
                    Yuborish
                  </button>
                </form>

                <div className="comments-list">
                  {reviewsData.reviews && reviewsData.reviews.length > 0 ? (
                    reviewsData.reviews.map((c, i) => (
                      <div key={i} className="comment-card shadow-sm">
                        <div className="comment-user-row">
                          <span>👤 {c.name || 'Foydalanuvchi'} <span className="comment-stars">{'★'.repeat(c.rating || 5)}</span></span>
                          <span className="comment-date">{c.date || 'Hozirgina'}</span>
                        </div>
                        <div className="comment-text">{c.comment || c.text}</div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-reviews-text">
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
          <div className="cinema-modal-window admin-modal-window" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-modal" onClick={() => setShowAdminModal(false)}>✕</button>
            <h3 className="admin-modal-title">⚙️ Admin Panelga Kirish</h3>
            <p className="admin-modal-sub">
              Kinolarni boshqarish uchun parolni kiriting.
            </p>

            <form onSubmit={handleAdminLogin} className="admin-form">
              <input
                type="password"
                className="site-search-input"
                style={{ paddingLeft: '18px', borderRadius: '12px' }}
                placeholder="Admin paroli..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
              {loginError && <div className="admin-error-text">{loginError}</div>}
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
          <div className="footer-brand">🎬 XIT FILM CINEMA PRO 2026</div>
          <div className="footer-sub">Barcha huquqlar saqlangan. Past mobil internet tarmoqlarida ham tezkor va sifatli kino tomoshasi.</div>
        </div>
        <div>
          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary-site"
            style={{ textDecoration: 'none' }}
          >
            🤖 TELEGRAM BOTGA O'TISH
          </a>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <div
          className={`mobile-nav-item ${selectedGenre === 'Barchasi' ? 'active' : ''}`}
          onClick={() => {
            setSelectedGenre('Barchasi');
            setSearchQuery('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Asosiy</span>
        </div>

        <div
          className={`mobile-nav-item ${selectedGenre === 'Jangari' ? 'active' : ''}`}
          onClick={() => {
            setSelectedGenre('Jangari');
            setSearchQuery('');
          }}
        >
          <span className="nav-icon">🚀</span>
          <span className="nav-label">Jangari</span>
        </div>

        <div
          className={`mobile-nav-item ${selectedGenre === '⭐ Sevimlilar' ? 'active' : ''}`}
          onClick={() => {
            setSelectedGenre('⭐ Sevimlilar');
            setSearchQuery('');
          }}
        >
          <span className="nav-icon">⭐</span>
          <span className="nav-label">Sevimlilar ({favorites.length})</span>
        </div>

        <a
          href={`https://t.me/${botUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-nav-item"
        >
          <span className="nav-icon">🤖</span>
          <span className="nav-label">Bot</span>
        </a>
      </nav>
    </div>
  );
}
