/**
 * XIT FILM — Ultra-Cinematic Core Logic
 * Version: 4.0.0 (Professional Cinema Edition)
 * All bugs fixed, new features added
 */

let ALL_MOVIES = [];
let MOVIE_RATINGS = {};
const API_BASE = '/movies/api';
const TMDB_API_KEY = '8d927d7222384a86b3e83955d140e698';
const METADATA_CACHE = new Map();
const POSTER_CACHE = new Map();

// High-impact placeholders
const PLACEHOLDERS = [
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1200&auto=format&fit=crop'
];

// UI Elements
const navbar = document.getElementById('navbar');
const sectionsWrapper = document.getElementById('sectionsWrapper');
const movieModal = document.getElementById('movieModal');
const authModal = document.getElementById('authModal');
const loginBtn = document.getElementById('loginBtn');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const genreDropdown = document.getElementById('genreDropdown');
const modalFavBtn = document.getElementById('modalFavBtn');
const modalShareBtn = document.getElementById('modalShareBtn');

let currentMovie = null;
let currentSlide = 0;
let sliderInterval = null;
let currentView = 'home'; // 'home' | 'genre' | 'type'
let isUserPremiumStatus = false;

// ============================================
// TMDB Metadata Fetcher (with client-side cache)
// ============================================
async function fetchMeta(title) {
    if (!title || title.match(/^\d+$/)) return null;
    if (METADATA_CACHE.has(title)) return METADATA_CACHE.get(title);
    try {
        // Try server proxy first, fallback to direct
        let res;
        try {
            res = await fetch(`${API_BASE}/public-tmdb/${encodeURIComponent(title)}`);
            if (res.ok) {
                const data = await res.json();
                METADATA_CACHE.set(title, data);
                return data;
            }
        } catch (e) { /* fallback */ }

        res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=ru-RU`);
        const data = await res.json();
        const result = data.results && data.results[0] ? data.results[0] : null;
        METADATA_CACHE.set(title, result);
        return result;
    } catch (e) { return null; }
}

function getSafePoster(path, index = 0) {
    if (path) return `https://image.tmdb.org/t/p/w500${path}`;
    return PLACEHOLDERS[index % PLACEHOLDERS.length];
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    console.log('🎬 XIT FILM v4.0 Initializing...');

    // Hide splash after load
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) {
            splash.classList.add('hidden');
            setTimeout(() => splash.remove(), 600);
        }
    }, 1200);

    // Telegram Mini App (TMA) Auto Auth Check
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        if (tgUser && tgUser.id) {
            localStorage.setItem('xitfilm_user_id', tgUser.id);
            localStorage.setItem('xitfilm_user_name', tgUser.first_name);
            try { window.Telegram.WebApp.expand(); } catch (e) {}
        }
    }

    // Auth Check
    const userId = localStorage.getItem('xitfilm_user_id');
    if (userId) {
        try {
            const userRes = await fetch(`${API_BASE}/public-user-data/${userId}`);
            if (userRes.ok) {
                const userData = await userRes.json();
                isUserPremiumStatus = !!userData.isPremium;
                const name = userData.user ? userData.user.first_name : 'Profil';
                if (isUserPremiumStatus) {
                    loginBtn.innerHTML = `<i class="fas fa-crown" style="color: #fbbf24; margin-right: 5px;"></i> <span>VIP ${name}</span>`;
                } else {
                    loginBtn.innerHTML = `<i class="fas fa-user-circle"></i> <span>${name}</span>`;
                }
                loginBtn.classList.add('active');
            } else {
                loginBtn.querySelector('span').textContent = 'Profil';
                loginBtn.classList.add('active');
            }
        } catch (e) {
            loginBtn.querySelector('span').textContent = 'Profil';
            loginBtn.classList.add('active');
        }
    }

    // 1. Instantly load from cache to eliminate any loading flicker in Telegram WebApp
    try {
        const cached = localStorage.getItem('xitfilm_cached_movies');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                ALL_MOVIES = parsed;
                setupHeroSlider(ALL_MOVIES.slice(0, 5));
                renderCategories();
            }
        }
    } catch (e) {}

    try {
        const res = await fetch(`${API_BASE}/public-movies`);
        const data = await res.json();

        if (data.movies && Array.isArray(data.movies)) {
            ALL_MOVIES = data.movies;
            if (data.ratings) {
                data.ratings.forEach(r => { MOVIE_RATINGS[r.code] = r.rating; });
            }
            try { localStorage.setItem('xitfilm_cached_movies', JSON.stringify(ALL_MOVIES)); } catch(e) {}
        } else if (Array.isArray(data) && data.length > 0) {
            ALL_MOVIES = data;
            try { localStorage.setItem('xitfilm_cached_movies', JSON.stringify(ALL_MOVIES)); } catch(e) {}
        }

        if (ALL_MOVIES.length === 0) {
            sectionsWrapper.innerHTML = '<div style="text-align:center;padding:100px 0;opacity:0.4;"><i class="fas fa-film" style="font-size:60px;margin-bottom:20px;display:block;"></i><p style="font-size:18px;">Hozircha kinolar yuklanmadi</p></div>';
            return;
        }

        // Populate Genre Dropdown
        const genres = [...new Set(ALL_MOVIES.map(m => m.genre).filter(Boolean))];
        genreDropdown.innerHTML = genres.map(g => `<a href="#" class="dropdown-item" onclick="filterByGenre('${g.replace(/'/g, "\\'")}'); return false;">${g}</a>`).join('');

        // Setup Hero Slider
        const top5 = [...ALL_MOVIES].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
        setupHeroSlider(top5);

        // Render main page
        renderCategories();

        // Handle URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const movieCode = urlParams.get('code');
        const genreParam = urlParams.get('genre');
        const typeParam = urlParams.get('type');
        const resumeParam = urlParams.get('resume');

        if (movieCode) {
            const m = ALL_MOVIES.find(x => x.code === movieCode);
            if (m) openMovieModal(m, resumeParam === '1');
        } else if (genreParam) {
            filterByGenre(genreParam);
        } else if (typeParam) {
            filterByType(typeParam);
        }

        // Scroll listener for navbar
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');

            // Back to top visibility
            const backBtn = document.getElementById('backToTop');
            if (backBtn) {
                if (window.scrollY > 600) backBtn.classList.add('visible');
                else backBtn.classList.remove('visible');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMovieModal();
                closeAuthModal();
            }
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                const active = document.activeElement;
                if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    searchInput.focus();
                }
            }
        });

    } catch (err) {
        console.error('Init error:', err);
        sectionsWrapper.innerHTML = '<div style="text-align:center;padding:100px 0;opacity:0.4;"><i class="fas fa-exclamation-triangle" style="font-size:60px;margin-bottom:20px;display:block;color:#ef4444;"></i><p style="font-size:18px;">Server bilan aloqa yo\'q</p></div>';
    }
}

// ============================================
// HERO SLIDER
// ============================================
async function setupHeroSlider(movies) {
    const slider = document.getElementById('heroSlider');
    const dots = document.getElementById('heroDots');

    slider.innerHTML = '';
    dots.innerHTML = '';

    if (!movies || movies.length === 0) return;

    // Immediately display first movie info to avoid any loading flicker
    const first = movies[0];
    document.getElementById('heroTitle').textContent = first.title;
    document.getElementById('heroGenre').textContent = first.genre || 'Premyera';
    document.getElementById('heroPlay').onclick = () => openMovieModal(first);
    document.getElementById('heroInfo').onclick = () => openMovieModal(first);

    for (let i = 0; i < movies.length; i++) {
        const m = movies[i];
        const meta = await fetchMeta(m.title);

        const slide = document.createElement('div');
        slide.className = `hero-slide ${i === 0 ? 'active' : ''}`;
        const backdrop = meta?.backdrop_path ? `https://image.tmdb.org/t/p/original${meta.backdrop_path}` : PLACEHOLDERS[i % PLACEHOLDERS.length];
        slide.style.backgroundImage = `url(${backdrop})`;
        slider.appendChild(slide);

        const dot = document.createElement('div');
        dot.className = `dot ${i === 0 ? 'active' : ''}`;
        dot.onclick = () => goToSlide(i, movies);
        dots.appendChild(dot);
    }

    updateHeroContent(movies[0]);
    startSliderTimer(movies);
}

function updateHeroContent(m) {
    const content = document.getElementById('heroContent');
    content.classList.add('fade-out');

    setTimeout(async () => {
        const meta = await fetchMeta(m.title);

        const displayTitle = (meta?.title || m.title || 'XIT FILM').replace(/^\d+$/, 'Kino Nomlanmagan');
        document.getElementById('heroTitle').textContent = displayTitle;

        let desc = m.description || '';
        desc = desc.split('♦')[0].replace(/Kod\d+/gi, '').replace(/#\w+/g, '').trim();
        if (desc.length < 5) desc = `${displayTitle} — XIT FILM portalida eng yuqori sifatda tomosha qiling.`;
        document.getElementById('heroDesc').textContent = desc.length > 220 ? desc.substring(0, 220) + '...' : desc;

        document.getElementById('heroRating').innerHTML = `<i class="fas fa-star"></i> ${meta?.vote_average ? meta.vote_average.toFixed(1) : (MOVIE_RATINGS[m.code] || '7.5')}`;
        document.getElementById('heroYear').textContent = meta?.release_date ? meta.release_date.split('-')[0] : '2024';
        document.getElementById('heroGenre').textContent = m.genre || 'Filmlar';

        document.getElementById('heroPlay').onclick = () => openMovieModal(m);
        document.getElementById('heroInfo').onclick = () => openMovieModal(m);

        content.classList.remove('fade-out');
    }, 400);
}

function goToSlide(index, movies) {
    currentSlide = index;
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.dot');

    slides.forEach((s, i) => s.classList.toggle('active', i === index));
    dots.forEach((d, i) => d.classList.toggle('active', i === index));

    updateHeroContent(movies[index]);
    startSliderTimer(movies);
}

function startSliderTimer(movies) {
    clearInterval(sliderInterval);
    sliderInterval = setInterval(() => {
        let next = (currentSlide + 1) % movies.length;
        goToSlide(next, movies);
    }, 8000);
}

// ============================================
// PLAYBACK PROGRESS & CONTINUE WATCHING
// ============================================
function trackPlaybackProgress(movie, currentTime, duration) {
    if (!movie || !movie.code || !duration || duration <= 0) return;
    const progressData = {
        code: movie.code,
        title: movie.title,
        genre: movie.genre || 'Film',
        currentTime: Math.round(currentTime),
        duration: Math.round(duration),
        progressPercent: Math.min(100, Math.round((currentTime / duration) * 100)),
        lastWatched: Date.now()
    };
    try {
        localStorage.setItem(`xitfilm_progress_${movie.code}`, JSON.stringify(progressData));
        
        let history = JSON.parse(localStorage.getItem('xitfilm_progress_list') || '[]');
        history = history.filter(c => c !== movie.code);
        if (progressData.currentTime >= 10 && progressData.progressPercent < 95) {
            history.unshift(movie.code);
        }
        localStorage.setItem('xitfilm_progress_list', JSON.stringify(history.slice(0, 30)));

        const userId = localStorage.getItem('xitfilm_user_id');
        if (userId) {
            fetch(`${API_BASE}/public-playback-progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...progressData })
            }).catch(() => {});
        }
    } catch (e) {}
}

function getLocalProgress(code) {
    try {
        const raw = localStorage.getItem(`xitfilm_progress_${code}`);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function clearWatchProgress() {
    try {
        const list = JSON.parse(localStorage.getItem('xitfilm_progress_list') || '[]');
        list.forEach(c => localStorage.removeItem(`xitfilm_progress_${c}`));
        localStorage.removeItem('xitfilm_progress_list');
        renderCategories();
        showToast('Tomosha tarixi tozalandi', 'info');
    } catch (e) {}
}

function renderContinueWatchingRow() {
    const list = JSON.parse(localStorage.getItem('xitfilm_progress_list') || '[]');
    const progressItems = [];
    list.forEach(code => {
        const prog = getLocalProgress(code);
        const movie = ALL_MOVIES.find(m => m.code === code);
        if (prog && movie && prog.currentTime >= 10 && prog.progressPercent < 95) {
            progressItems.push({ ...prog, movie });
        }
    });

    if (progressItems.length === 0) return;

    const section = document.createElement('div');
    section.className = 'category-row-container';
    section.style.marginTop = '40px';
    section.innerHTML = `
        <div class="section-header" style="border-left-color: #38bdf8;">
            <h2 class="section-title"><i class="fas fa-history" style="color:#38bdf8;"></i> Ko'rishni Davom Ettirish</h2>
            <span class="btn-all" onclick="clearWatchProgress()">Tozalash <i class="fas fa-trash-alt" style="font-size:11px;"></i></span>
        </div>
        <div class="movie-row-wrapper">
            <button class="scroll-btn scroll-left" onclick="scrollRow(this, -1)"><i class="fas fa-chevron-left"></i></button>
            <div class="movie-row"></div>
            <button class="scroll-btn scroll-right" onclick="scrollRow(this, 1)"><i class="fas fa-chevron-right"></i></button>
        </div>
    `;

    const row = section.querySelector('.movie-row');

    progressItems.forEach((item, idx) => {
        const m = item.movie;
        const card = document.createElement('div');
        card.className = 'continue-card';
        const uniqueId = `cont-${m.code}-${idx}`;
        const formatMin = Math.floor(item.currentTime / 60);

        card.innerHTML = `
            <div class="card-img" style="aspect-ratio: 16/9;">
                <div class="card-skeleton"></div>
                <img src="" data-id="${uniqueId}" loading="lazy" alt="${m.title}" style="opacity:0;">
                <div class="continue-badge"><i class="fas fa-play" style="font-size:8px;"></i> ${item.progressPercent}% (${formatMin} daqiqa)</div>
                <div class="card-overlay"><button class="card-play-btn" style="width: auto; padding: 0 16px;"><i class="fas fa-play"></i> Davom ettirish</button></div>
                <div class="continue-progress-wrap">
                    <div class="continue-progress-bar" style="width: ${item.progressPercent}%;"></div>
                </div>
            </div>
            <div class="card-info">
                <h3>${m.title}</h3>
                <p><span>${m.genre || 'Film'}</span> <span style="color:#38bdf8; font-weight:700;">${item.progressPercent}%</span></p>
            </div>
        `;

        fetchMeta(m.title).then(meta => {
            const img = card.querySelector(`img[data-id="${uniqueId}"]`);
            if (img) {
                const posterUrl = meta?.backdrop_path
                    ? `https://image.tmdb.org/t/p/w500${meta.backdrop_path}`
                    : (meta?.poster_path ? `https://image.tmdb.org/t/p/w500${meta.poster_path}` : PLACEHOLDERS[idx % PLACEHOLDERS.length]);
                img.src = posterUrl;
                img.onload = () => {
                    img.style.opacity = '1';
                    const skeleton = img.parentElement.querySelector('.card-skeleton');
                    if (skeleton) skeleton.remove();
                };
                img.onerror = () => {
                    img.src = PLACEHOLDERS[idx % PLACEHOLDERS.length];
                    img.style.opacity = '1';
                    const skeleton = img.parentElement.querySelector('.card-skeleton');
                    if (skeleton) skeleton.remove();
                };
            }
        });

        card.onclick = () => openMovieModal(m, true);
        row.appendChild(card);
    });

    sectionsWrapper.appendChild(section);
}

// ============================================
// CATEGORY ROWS — MAIN VIEW
// ============================================
function renderCategories() {
    currentView = 'home';
    sectionsWrapper.innerHTML = '';

    // Update nav active states
    updateNavActive('navAsosiy');

    // Render continue watching row first if exists
    renderContinueWatchingRow();

    const cats = [
        { title: "🔥 Yangi Qo'shilganlar", filter: () => true, key: 'new' },
        { title: "📈 Trenddagi Filmlar", filter: () => true, sort: (a, b) => (b.views || 0) - (a.views || 0), key: 'trend' },
        { title: "⚔️ Jangari", filter: m => m.genre?.includes('Jangari'), key: 'jangari' },
        { title: "🎬 Tarjima Kinolar", filter: m => m.genre?.includes('Tarjima'), key: 'tarjima' },
        { title: "😂 Komediya", filter: m => m.genre?.includes('Komediya'), key: 'komediya' },
        { title: "💕 Melodrama", filter: m => m.genre?.includes('Melodrama'), key: 'melodrama' },
        { title: "🎭 Tarixiy", filter: m => m.genre?.includes('Tarixiy'), key: 'tarixiy' }
    ];

    cats.forEach((c, cIdx) => {
        let list = ALL_MOVIES.filter(c.filter);
        if (c.sort) list.sort(c.sort);
        list = list.slice(0, 20);
        if (list.length === 0) return;

        const section = document.createElement('div');
        section.className = 'category-row-container';
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">${c.title}</h2>
                <span class="btn-all" onclick="showAllCategory('${c.key}')">${list.length < ALL_MOVIES.filter(c.filter).length ? 'Barchasi' : 'Ko\'proq'} <i class="fas fa-chevron-right"></i></span>
            </div>
            <div class="movie-row-wrapper">
                <button class="scroll-btn scroll-left" onclick="scrollRow(this, -1)"><i class="fas fa-chevron-left"></i></button>
                <div class="movie-row"></div>
                <button class="scroll-btn scroll-right" onclick="scrollRow(this, 1)"><i class="fas fa-chevron-right"></i></button>
            </div>
        `;
        const row = section.querySelector('.movie-row');

        list.forEach((m, mIdx) => {
            const card = createMovieCard(m, mIdx, 'row');
            row.appendChild(card);
        });
        sectionsWrapper.appendChild(section);
    });
}

// ============================================
// ROW SCROLL BUTTONS
// ============================================
function scrollRow(btn, direction) {
    const wrapper = btn.parentElement;
    const row = wrapper.querySelector('.movie-row');
    const scrollAmount = 800;
    row.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// ============================================
// FILTER BY GENRE — Full Page View
// ============================================
function filterByGenre(genre) {
    currentView = 'genre';
    const list = ALL_MOVIES.filter(m => m.genre && m.genre.includes(genre));

    // Update URL without reload
    history.pushState({}, '', `?genre=${encodeURIComponent(genre)}`);

    // Show hero section still but scroll to content
    sectionsWrapper.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'filter-results-header';
    header.innerHTML = `
        <div class="filter-breadcrumb">
            <a href="#" onclick="goHome(); return false;"><i class="fas fa-home"></i> Asosiy</a>
            <i class="fas fa-chevron-right"></i>
            <span>${genre}</span>
        </div>
        <h2 class="filter-title">${genre} <span class="filter-count">${list.length} ta kino</span></h2>
    `;
    sectionsWrapper.appendChild(header);

    if (list.length === 0) {
        sectionsWrapper.innerHTML += '<div style="text-align:center;padding:80px 0;opacity:0.4;"><i class="fas fa-film" style="font-size:50px;margin-bottom:20px;display:block;"></i><p>Bu janrda hozircha kinolar yo\'q</p></div>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'movie-grid-full';
    list.forEach((m, i) => {
        const card = createMovieCard(m, i, 'grid');
        grid.appendChild(card);
    });
    sectionsWrapper.appendChild(grid);

    // Scroll to results
    sectionsWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Close dropdown
    document.querySelectorAll('.dropdown-content').forEach(d => d.style.display = 'none');
    setTimeout(() => document.querySelectorAll('.dropdown-content').forEach(d => d.style.display = ''), 100);
}

// ============================================
// FILTER BY TYPE (Filmlar / Seriallar)
// ============================================
function filterByType(type) {
    currentView = 'type';

    let list;
    let title;
    if (type === 'films') {
        list = ALL_MOVIES.filter(m => !m.genre?.includes('Serial'));
        title = 'Filmlar';
    } else if (type === 'serials') {
        list = ALL_MOVIES.filter(m => m.genre?.includes('Serial'));
        title = 'Seriallar';
    } else {
        list = ALL_MOVIES;
        title = 'Barcha Kinolar';
    }

    history.pushState({}, '', `?type=${type}`);

    sectionsWrapper.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'filter-results-header';
    header.innerHTML = `
        <div class="filter-breadcrumb">
            <a href="#" onclick="goHome(); return false;"><i class="fas fa-home"></i> Asosiy</a>
            <i class="fas fa-chevron-right"></i>
            <span>${title}</span>
        </div>
        <h2 class="filter-title">${title} <span class="filter-count">${list.length} ta</span></h2>
    `;
    sectionsWrapper.appendChild(header);

    if (list.length === 0) {
        sectionsWrapper.innerHTML += '<div style="text-align:center;padding:80px 0;opacity:0.4;"><i class="fas fa-film" style="font-size:50px;margin-bottom:20px;display:block;"></i><p>Hozircha topilmadi</p></div>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'movie-grid-full';
    list.forEach((m, i) => {
        const card = createMovieCard(m, i, 'grid');
        grid.appendChild(card);
    });
    sectionsWrapper.appendChild(grid);

    sectionsWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// SHOW ALL CATEGORY
// ============================================
function showAllCategory(key) {
    const catMap = {
        'new': { title: "Yangi Qo'shilganlar", filter: () => true },
        'trend': { title: "Trenddagi Filmlar", filter: () => true, sort: (a, b) => (b.views || 0) - (a.views || 0) },
        'jangari': { title: "Jangari", filter: m => m.genre?.includes('Jangari') },
        'tarjima': { title: "Tarjima Kinolar", filter: m => m.genre?.includes('Tarjima') },
        'komediya': { title: "Komediya", filter: m => m.genre?.includes('Komediya') },
        'melodrama': { title: "Melodrama", filter: m => m.genre?.includes('Melodrama') },
        'tarixiy': { title: "Tarixiy", filter: m => m.genre?.includes('Tarixiy') }
    };

    const cat = catMap[key];
    if (!cat) return;

    let list = ALL_MOVIES.filter(cat.filter);
    if (cat.sort) list.sort(cat.sort);

    currentView = 'genre';
    history.pushState({}, '', `?genre=${encodeURIComponent(cat.title)}`);

    sectionsWrapper.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'filter-results-header';
    header.innerHTML = `
        <div class="filter-breadcrumb">
            <a href="#" onclick="goHome(); return false;"><i class="fas fa-home"></i> Asosiy</a>
            <i class="fas fa-chevron-right"></i>
            <span>${cat.title}</span>
        </div>
        <h2 class="filter-title">${cat.title} <span class="filter-count">${list.length} ta kino</span></h2>
    `;
    sectionsWrapper.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'movie-grid-full';
    list.forEach((m, i) => {
        const card = createMovieCard(m, i, 'grid');
        grid.appendChild(card);
    });
    sectionsWrapper.appendChild(grid);

    sectionsWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// GO HOME — Return to main view
// ============================================
function goHome() {
    history.pushState({}, '', '/');
    renderCategories();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${icon}"></i></div>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 20);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// 1-Click Favorite Toggle
async function toggleMovieFav(code, btn) {
    const userId = localStorage.getItem('xitfilm_user_id');
    if (!userId) {
        authModal.classList.add('active');
        showToast('Sevimlilarga qo\'shish uchun avval tizimga kiring', 'info');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/public-toggle-fav`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, code })
        });
        const data = await res.json();
        if (data.success) {
            const isFav = !!data.favorited;
            if (btn) {
                btn.classList.toggle('active', isFav);
                const icon = btn.querySelector('i');
                if (icon) icon.className = isFav ? 'fas fa-heart' : 'far fa-heart';
            }
            showToast(isFav ? 'Kino sevimlilarga qo\'shildi ❤️' : 'Kino sevimlilardan olib tashlandi', 'success');
        }
    } catch (e) {
        showToast('Xatolik yuz berdi', 'error');
    }
}

// ============================================
// CREATE MOVIE CARD — Reusable with Quick Actions
// ============================================
function createMovieCard(m, index, mode = 'row') {
    const uniqueId = `card-${m.code}-${index}-${Date.now() % 10000}`;
    const card = document.createElement('div');
    card.className = 'movie-card';

    card.innerHTML = `
        <div class="card-img">
            <div class="card-skeleton"></div>
            <img src="" data-id="${uniqueId}" loading="lazy" alt="${m.title}" style="opacity:0;">
            <div class="card-rating"><i class="fas fa-star"></i> ${MOVIE_RATINGS[m.code] || '7.5'}</div>
            <div class="card-badge-hd">HD 1080p</div>
            <div class="card-overlay">
                <div class="card-action-row">
                    <button class="card-play-btn"><i class="fas fa-play"></i> Ko'rish</button>
                    <button class="card-fav-btn" title="Sevimlilarga qo'shish" onclick="event.stopPropagation(); toggleMovieFav('${m.code}', this);"><i class="far fa-heart"></i></button>
                </div>
            </div>
        </div>
        <div class="card-info">
            <h3>${m.title}</h3>
            <p><span>${m.genre || 'Film'}</span> <span style="color:var(--accent); font-weight:700;">★ ${MOVIE_RATINGS[m.code] || '7.5'}</span></p>
        </div>
    `;

    fetchMeta(m.title).then(meta => {
        const img = card.querySelector(`img[data-id="${uniqueId}"]`);
        if (img) {
            const posterUrl = meta?.poster_path
                ? `https://image.tmdb.org/t/p/w500${meta.poster_path}`
                : PLACEHOLDERS[index % PLACEHOLDERS.length];
            img.src = posterUrl;
            img.onload = () => {
                img.style.opacity = '1';
                const skeleton = img.parentElement.querySelector('.card-skeleton');
                if (skeleton) skeleton.remove();
            };
            img.onerror = () => {
                img.src = PLACEHOLDERS[index % PLACEHOLDERS.length];
                img.style.opacity = '1';
                const skeleton = img.parentElement.querySelector('.card-skeleton');
                if (skeleton) skeleton.remove();
            };
        }
    });

    card.onclick = () => openMovieModal(m);
    return card;
}

// ============================================
// NAV ACTIVE STATE
// ============================================
function updateNavActive(id) {
    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

// Nav button handlers
document.getElementById('navAsosiy')?.addEventListener('click', (e) => {
    e.preventDefault();
    goHome();
});

document.getElementById('navFilmlar')?.addEventListener('click', (e) => {
    e.preventDefault();
    updateNavActive('navFilmlar');
    filterByType('films');
});

document.getElementById('navSeriallar')?.addEventListener('click', (e) => {
    e.preventDefault();
    updateNavActive('navSeriallar');
    filterByType('serials');
});

// Resume playback banner actions
function resumeVideo(seconds) {
    const mainVideo = document.getElementById('mainVideo');
    if (mainVideo) {
        mainVideo.currentTime = Number(seconds) || 0;
        mainVideo.play().catch(() => {});
        dismissResumeBanner();
        showToast('To\'xtagan joyidan davom ettirilmoqda ▶️', 'info');
    }
}

function dismissResumeBanner() {
    const box = document.getElementById('resumeBannerBox');
    if (box) box.innerHTML = '';
}

// ============================================
// MOVIE MODAL
// ============================================
async function openMovieModal(m, autoResume = false) {
    currentMovie = m;
    if (m && m.code) {
        m.views = (Number(m.views) || 0) + 1;
        try {
            const uid = localStorage.getItem('xitfilm_user_id') || null;
            fetch(`${API_BASE}/public-movie/${m.code}/view`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid })
            }).catch(() => {});
        } catch (e) {}
    }
    const meta = await fetchMeta(m.title);
    document.getElementById('modalTitle').textContent = meta?.title || m.title;

    let desc = m.description || '';
    desc = desc.split('♦')[0].replace(/Kod\d+/gi, '').replace(/#\w+/g, '').trim();
    document.getElementById('modalDesc').textContent = desc || 'Tavsif yo\'q.';

    document.getElementById('modalGenre').textContent = m.genre || 'Janr';
    document.getElementById('modalYear').textContent = meta?.release_date ? meta.release_date.split('-')[0] : '2024';

    const backdrop = document.getElementById('modalBackdrop');
    if (meta?.backdrop_path) {
        backdrop.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${meta.backdrop_path})`;
    } else {
        backdrop.style.background = '#111';
    }

    document.getElementById('modalImg').src = getSafePoster(meta?.poster_path);
    document.getElementById('watchLink').href = `https://t.me/xitfilm_bot?start=${m.code}`;

    const ytContainer = document.getElementById('videoContainer');
    const resumeBannerBox = document.getElementById('resumeBannerBox');
    if (resumeBannerBox) resumeBannerBox.innerHTML = '';

    // Ambient Lighting Glow Effect
    const ambientGlow = document.getElementById('ambientGlow');
    if (ambientGlow) {
        ambientGlow.style.background = 'radial-gradient(circle at center, rgba(139, 92, 246, 0.45) 0%, rgba(56, 189, 248, 0.2) 50%, transparent 80%)';
    }
    
    // Clear previous dynamic locking overlay
    const lockScreen = ytContainer.querySelector('.vip-lock-screen');
    if (lockScreen) lockScreen.remove();

    if (m.isPremium && !isUserPremiumStatus) {
        // VIP movie and user is NOT premium: show VIP Lock Screen
        document.getElementById('ytPlayer').style.display = 'none';
        document.getElementById('customPlayer').style.display = 'none';
        
        const vipOverlay = document.createElement('div');
        vipOverlay.className = 'vip-lock-screen';
        vipOverlay.style.cssText = 'display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; width:100%; background:linear-gradient(to top, #0f0f15, #07070a); text-align:center; padding: 20px;';
        vipOverlay.innerHTML = `
            <i class="fas fa-lock" style="font-size:36px; color:#fbbf24; margin-bottom:12px;"></i>
            <h3 style="font-size:16px; font-weight:800; color:#fff; margin-bottom:6px;">Kino Faqat VIP Obunachilar Uchun</h3>
            <p style="font-size:12px; color:var(--text-muted); max-width:300px; margin-bottom:12px;">Ushbu kinoni ko'rish uchun VIP Premium obunaga a'zo bo'ling.</p>
            <button class="p-btn-watch" onclick="showVipModal()" style="padding:8px 18px; font-size:12px; height:auto; box-shadow:none; cursor:pointer; border:none; border-radius:10px;">Obuna bo'lish</button>
        `;
        ytContainer.appendChild(vipOverlay);
        ytContainer.style.display = 'block';
    } else if (m.videoUrl) {
        // Direct stream video URL is available
        document.getElementById('ytPlayer').style.display = 'none';
        document.getElementById('customPlayer').style.display = 'block';
        ytContainer.style.display = 'block';
        
        initCustomPlayer();
        const mainVideo = document.getElementById('mainVideo');
        mainVideo.src = m.videoUrl;

        // Check saved playback progress
        const savedProg = getLocalProgress(m.code);
        if (savedProg && savedProg.currentTime > 15 && savedProg.progressPercent < 95) {
            const formatM = Math.floor(savedProg.currentTime / 60);
            const formatS = savedProg.currentTime % 60;
            const timeStr = `${formatM}:${formatS < 10 ? '0' : ''}${formatS}`;

            if (autoResume) {
                mainVideo.currentTime = savedProg.currentTime;
                showToast(`Film ${timeStr} daqiqasidan davom ettirilmoqda ▶️`, 'info');
            } else if (resumeBannerBox) {
                resumeBannerBox.innerHTML = `
                    <div class="resume-banner">
                        <div class="resume-banner-text">
                            <i class="fas fa-history" style="color:#38bdf8;"></i>
                            <span>Siz ushbu filmni <b>${timeStr}</b> daqiqasida to'xtatgansiz.</span>
                        </div>
                        <div class="resume-banner-actions">
                            <button class="resume-btn-yes" onclick="resumeVideo(${savedProg.currentTime})">▶️ Davom ettirish</button>
                            <button class="resume-btn-no" onclick="dismissResumeBanner()">Boshidan</button>
                        </div>
                    </div>
                `;
            }
        }

        // Periodic playback progress tracker (every 3 seconds)
        let lastTracked = 0;
        mainVideo.ontimeupdate = () => {
            const cur = Math.floor(mainVideo.currentTime);
            if (cur > 0 && Math.abs(cur - lastTracked) >= 3) {
                lastTracked = cur;
                trackPlaybackProgress(m, mainVideo.currentTime, mainVideo.duration);
            }
        };

        mainVideo.play().catch(e => console.log('Playback start block:', e));
    } else if (m.youtubeUrl) {
        // YouTube trailer fallback
        document.getElementById('customPlayer').style.display = 'none';
        document.getElementById('ytPlayer').style.display = 'block';
        ytContainer.style.display = 'block';
        
        let vid = '';
        if (m.youtubeUrl.includes('v=')) vid = m.youtubeUrl.split('v=')[1].split('&')[0];
        else if (m.youtubeUrl.includes('youtu.be/')) vid = m.youtubeUrl.split('youtu.be/')[1].split('?')[0];
        
        if (vid) {
            document.getElementById('ytPlayer').src = `https://www.youtube.com/embed/${vid}`;
        } else ytContainer.style.display = 'none';
    } else {
        ytContainer.style.display = 'none';
    }

    // Load reviews & comments
    loadReviews(m.code);

    // Render serial seasons & episodes box if serial
    renderSerialBox(m);
    setupQualities(m.qualities);
    setupSubtitles(m.subtitles);

    // Favorites Check
    const userId = localStorage.getItem('xitfilm_user_id');
    if (userId) {
        fetch(`${API_BASE}/public-user-data/${userId}`)
            .then(res => res.json())
            .then(data => {
                const isFav = data.favorites.some(f => f.code === m.code);
                modalFavBtn.classList.toggle('active', isFav);
                modalFavBtn.querySelector('i').className = isFav ? 'fas fa-heart' : 'far fa-heart';
            }).catch(() => {});
    }

    movieModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ============================================
// SERIAL SEASONS, EPISODES & MULTI-QUALITY LOGIC
// ============================================
let currentActiveEpisode = null;

function renderSerialBox(movie) {
    const seasonsBox = document.getElementById('serialSeasonsBox');
    const seasonSelect = document.getElementById('seasonSelect');
    const episodesGrid = document.getElementById('episodesGrid');

    if (!seasonsBox || !seasonSelect || !episodesGrid) return;

    const seasons = movie.seasons || [];
    if (movie.type !== 'serial' && seasons.length === 0) {
        seasonsBox.style.display = 'none';
        return;
    }

    seasonsBox.style.display = 'block';

    if (seasons.length === 0) {
        const demoEpisodes = [];
        for (let i = 1; i <= 10; i++) {
            demoEpisodes.push({
                episodeNumber: i,
                title: `${i}-Qism`,
                videoUrl: movie.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
            });
        }
        seasons.push({ seasonNumber: 1, episodes: demoEpisodes });
        movie.seasons = seasons;
    }

    seasonSelect.innerHTML = seasons.map(s => `<option value="${s.seasonNumber}">${s.seasonNumber}-Fasl (${s.episodes.length} ta qism)</option>`).join('');
    switchSeason(seasons[0].seasonNumber);
}

function switchSeason(seasonNum) {
    seasonNum = parseInt(seasonNum);
    const episodesGrid = document.getElementById('episodesGrid');
    if (!currentMovie || !episodesGrid) return;

    const season = (currentMovie.seasons || []).find(s => parseInt(s.seasonNumber) === seasonNum);
    if (!season) return;

    episodesGrid.innerHTML = season.episodes.map(ep => `
        <div class="episode-card ${currentActiveEpisode?.episodeNumber === ep.episodeNumber ? 'active' : ''}" onclick="playEpisode(${seasonNum}, ${ep.episodeNumber})" style="background:rgba(255,255,255,0.04); border:1px solid var(--glass-border); border-radius:12px; padding:10px; cursor:pointer; text-align:center; transition:0.2s;">
            <div style="font-size:12px; font-weight:800; color:var(--primary-light); margin-bottom:4px;"><i class="fas fa-play-circle"></i> ${ep.episodeNumber}-Qism</div>
            <div style="font-size:11px; color:var(--text-dim); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${ep.title || 'Serial Qismi'}</div>
        </div>
    `).join('');
}

function playEpisode(seasonNum, episodeNum) {
    if (!currentMovie) return;
    const season = (currentMovie.seasons || []).find(s => parseInt(s.seasonNumber) === parseInt(seasonNum));
    if (!season) return;

    const ep = season.episodes.find(e => parseInt(e.episodeNumber) === parseInt(episodeNum));
    if (!ep) return;

    currentActiveEpisode = { seasonNum: parseInt(seasonNum), episodeNumber: parseInt(episodeNum) };
    switchSeason(seasonNum);

    const ytContainer = document.getElementById('videoContainer');
    document.getElementById('ytPlayer').style.display = 'none';
    document.getElementById('customPlayer').style.display = 'block';
    ytContainer.style.display = 'block';

    initCustomPlayer();
    const mainVideo = document.getElementById('mainVideo');
    mainVideo.src = ep.videoUrl || currentMovie.videoUrl;
    
    const nextBtn = document.getElementById('nextEpisodeBtn');
    if (nextBtn) nextBtn.style.display = 'inline-flex';

    mainVideo.play().catch(e => console.log('Episode autoplay:', e));
    showToast(`Oynatilmoqda: ${seasonNum}-Fasl ${ep.episodeNumber}-Qism`);
}

function playNextEpisode() {
    if (!currentMovie || !currentActiveEpisode) return;
    const seasonNum = currentActiveEpisode.seasonNum;
    const season = (currentMovie.seasons || []).find(s => parseInt(s.seasonNumber) === seasonNum);
    if (!season) return;

    const nextEp = season.episodes.find(e => parseInt(e.episodeNumber) === currentActiveEpisode.episodeNumber + 1);
    if (nextEp) {
        playEpisode(seasonNum, nextEp.episodeNumber);
    } else {
        const nextSeason = (currentMovie.seasons || []).find(s => parseInt(s.seasonNumber) === seasonNum + 1);
        if (nextSeason && nextSeason.episodes.length > 0) {
            document.getElementById('seasonSelect').value = nextSeason.seasonNumber;
            playEpisode(nextSeason.seasonNumber, nextSeason.episodes[0].episodeNumber);
        } else {
            showToast('Faslning oxirgi qismi yakunlandi! 🍿');
        }
    }
}

function setupQualities(qualities) {
    const qualityMenu = document.getElementById('qualityMenu');
    const qualityList = document.getElementById('qualityList');
    if (!qualityMenu || !qualityList) return;

    if (!qualities || Object.keys(qualities).length === 0) {
        qualityMenu.style.display = 'none';
        return;
    }

    qualityMenu.style.display = 'inline-block';
    qualityList.innerHTML = Object.keys(qualities).map(q => `
        <div class="quality-item" onclick="changeQuality('${q}', '${qualities[q]}')">${q}</div>
    `).join('');
}

function changeQuality(label, url) {
    const mainVideo = document.getElementById('mainVideo');
    if (!mainVideo || !url) return;
    const currentTime = mainVideo.currentTime;
    const isPaused = mainVideo.paused;

    mainVideo.src = url;
    mainVideo.currentTime = currentTime;
    if (!isPaused) mainVideo.play();
    
    showToast(`Sifat o'zgartirildi: ${label}`);
}

function setupSubtitles(subtitles) {
    const subMenu = document.getElementById('subtitlesMenu');
    const subList = document.getElementById('subtitlesList');
    if (!subMenu || !subList) return;

    if (!subtitles || subtitles.length === 0) {
        subMenu.style.display = 'none';
        return;
    }

    subMenu.style.display = 'inline-block';
    subList.innerHTML = `
        <div onclick="setSubtitleTrack(null)">O'chirilgan</div>
        ${subtitles.map(s => `<div onclick="setSubtitleTrack('${s.src}', '${s.lang}')">${s.label}</div>`).join('')}
    `;
}

function setSubtitleTrack(src, lang) {
    const mainVideo = document.getElementById('mainVideo');
    if (!mainVideo) return;

    const existingTracks = mainVideo.querySelectorAll('track');
    existingTracks.forEach(t => t.remove());

    if (src) {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = lang;
        track.srclang = lang;
        track.src = src;
        track.default = true;
        mainVideo.appendChild(track);
        showToast(`Subtitr yoqildi: ${lang}`);
    } else {
        showToast('Subtitr o\'chirildi');
    }
}

function closeMovieModal() {
    movieModal.classList.remove('active');
    document.body.style.overflow = 'auto';
    
    // Stop custom player playback
    const mainVideo = document.getElementById('mainVideo');
    if (mainVideo) {
        mainVideo.pause();
        mainVideo.src = '';
    }
    
    document.getElementById('ytPlayer').src = '';
    
    const lockScreen = document.getElementById('videoContainer').querySelector('.vip-lock-screen');
    if (lockScreen) lockScreen.remove();
    
    currentMovie = null;
}

// ============================================
// SEARCH with poster images
// ============================================
let searchTimeout;
searchInput.oninput = (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.toLowerCase().trim();
    if (!q) { searchResults.style.display = 'none'; return; }
    searchTimeout = setTimeout(async () => {
        const matches = ALL_MOVIES.filter(m => m.title.toLowerCase().includes(q)).slice(0, 8);
        if (matches.length === 0) {
            searchResults.innerHTML = '<div class="search-empty"><i class="fas fa-search"></i> Topilmadi</div>';
            searchResults.style.display = 'block';
            return;
        }

        // Render with placeholders first
        searchResults.innerHTML = matches.map(m => `
            <div class="search-item" onclick="openByCode('${m.code}')">
                <div class="search-thumb" id="sthumb-${m.code}"><i class="fas fa-film"></i></div>
                <div class="search-item-info">
                    <div class="search-item-title">${m.title}</div>
                    <small>${m.genre || 'Film'}</small>
                </div>
                <div class="search-item-rating"><i class="fas fa-star"></i> ${MOVIE_RATINGS[m.code] || '7.5'}</div>
            </div>
        `).join('');
        searchResults.style.display = 'block';

        // Load posters async
        for (const m of matches) {
            const meta = await fetchMeta(m.title);
            const thumb = document.getElementById(`sthumb-${m.code}`);
            if (thumb && meta?.poster_path) {
                thumb.innerHTML = `<img src="https://image.tmdb.org/t/p/w92${meta.poster_path}" alt="${m.title}">`;
            }
        }
    }, 300);
};

// Close search on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        searchResults.style.display = 'none';
    }
});

function openByCode(code) {
    const m = ALL_MOVIES.find(x => x.code === code);
    if (m) { searchResults.style.display = 'none'; searchInput.value = ''; openMovieModal(m); }
}

// ============================================
// AUTH & FAVORITES
// ============================================
let loginPollInterval = null;
let currentLoginToken = '';

loginBtn.onclick = () => {
    if (localStorage.getItem('xitfilm_user_id')) {
        location.href = 'profile.html';
    } else {
        authModal.classList.add('active');
        switchAuthTab('link');
    }
};

function closeAuthModal() {
    authModal.classList.remove('active');
    stopPollingLogin();
}

function switchAuthTab(type) {
    const tabLinkBtn = document.getElementById('tabLinkBtn');
    const tabCodeBtn = document.getElementById('tabCodeBtn');
    const authTabLink = document.getElementById('authTabLink');
    const authTabCode = document.getElementById('authTabCode');

    if (type === 'link') {
        tabLinkBtn.classList.add('active');
        tabCodeBtn.classList.remove('active');
        authTabLink.style.display = 'block';
        authTabCode.style.display = 'none';
        stopPollingLogin();
        prepareLoginToken();
    } else {
        tabLinkBtn.classList.remove('active');
        tabCodeBtn.classList.add('active');
        authTabLink.style.display = 'none';
        authTabCode.style.display = 'block';
        stopPollingLogin();
        
        setTimeout(() => {
            const digits = document.querySelectorAll('.pin-digit');
            if (digits.length > 0) digits[0].focus();
        }, 100);
    }
}

function prepareLoginToken() {
    currentLoginToken = 'lnk_' + Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 9);
    const telegramLink = document.getElementById('telegramLoginLink');
    if (telegramLink) {
        telegramLink.href = `https://t.me/xitfilm_bot?start=login_${currentLoginToken}`;
    }
}

function handleTelegramLinkClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!currentLoginToken) prepareLoginToken();
    
    const botUrl = `https://t.me/xitfilm_bot?start=login_${currentLoginToken}`;
    window.open(botUrl, '_blank');
    
    startPollingLogin();
}

// PIN inputs helper functions
function onPinInput(input, index) {
    input.value = input.value.replace(/[^0-9]/g, '');
    
    if (input.value.length === 1 && index < 5) {
        const digits = document.querySelectorAll('.pin-digit');
        digits[index + 1].focus();
    }
    
    updatePinValue();
}

function onPinKeyDown(e, input, index) {
    if (e && e.key === 'Backspace' && input.value.length === 0 && index > 0) {
        const digits = document.querySelectorAll('.pin-digit');
        const prevInput = digits[index - 1];
        prevInput.focus();
        prevInput.value = '';
        updatePinValue();
    }
}

function onPinPaste(e) {
    if (e && e.preventDefault) e.preventDefault();
    const pasteData = ((e.clipboardData || window.clipboardData)?.getData('text') || '').trim().replace(/[^0-9]/g, '');
    if (!pasteData) return;
    
    const digits = document.querySelectorAll('.pin-digit');
    digits.forEach(el => el.value = '');
    
    for (let i = 0; i < 6; i++) {
        if (i < pasteData.length && digits[i]) {
            digits[i].value = pasteData[i];
        }
    }
    updatePinValue();
    if (pasteData.length >= 6) {
        digits[5]?.focus();
    } else if (digits[pasteData.length]) {
        digits[pasteData.length].focus();
    }
}

function updatePinValue() {
    const digits = document.querySelectorAll('.pin-digit');
    let code = '';
    digits.forEach(el => code += el.value);
    
    document.getElementById('loginCode').value = code;
    const submitBtn = document.getElementById('pinSubmitBtn');
    
    if (code.length === 6) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kirishni Tasdiqlash';
        verifyLoginCode();
    } else {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Kodni Kiriting';
    }
}

async function verifyLoginCode() {
    const code = document.getElementById('loginCode').value;
    if (code.length !== 6) return;
    
    const submitBtn = document.getElementById('pinSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Tekshirilmoqda...';

    try {
        const res = await fetch(`${API_BASE}/public-verify-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('xitfilm_user_id', data.user.id);
            localStorage.setItem('xitfilm_user_name', data.user.first_name);
            showToast('Muvaffaqiyatli kirdingiz! 🎉');
            location.reload();
        } else {
            showToast('Kirish kodi xato! Iltimos qayta urinib ko\'ring.');
            document.querySelectorAll('.pin-digit').forEach(el => el.value = '');
            updatePinValue();
            const digits = document.querySelectorAll('.pin-digit');
            if (digits.length > 0) digits[0].focus();
        }
    } catch (e) {
        showToast('Server bilan bog\'lanishda xatolik!');
    } finally {
        submitBtn.disabled = false;
    }
}

// One-Click Link Polling login
function startPollingLogin() {
    stopPollingLogin();
    if (!currentLoginToken) prepareLoginToken();
    
    document.getElementById('pollingStatus').style.display = 'block';
    
    loginPollInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/public-check-login/${currentLoginToken}`);
            const data = await res.json();
            if (data.success) {
                stopPollingLogin();
                localStorage.setItem('xitfilm_user_id', data.user.id);
                localStorage.setItem('xitfilm_user_name', data.user.first_name);
                showToast(`Tabriklaymiz, ${data.user.first_name}! Muvaffaqiyatli kirdingiz! 🎉`);
                location.reload();
            }
        } catch (e) {
            console.error('Polling error:', e);
        }
    }, 1500);
}

function stopPollingLogin() {
    if (loginPollInterval) {
        clearInterval(loginPollInterval);
        loginPollInterval = null;
    }
    const statusEl = document.getElementById('pollingStatus');
    if (statusEl) statusEl.style.display = 'none';
}

modalFavBtn.onclick = async () => {
    const userId = localStorage.getItem('xitfilm_user_id');
    if (!userId) { authModal.classList.add('active'); return; }
    if (!currentMovie) return;
    try {
        const res = await fetch(`${API_BASE}/public-toggle-fav`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, code: currentMovie.code })
        });
        const data = await res.json();
        if (data.success) {
            modalFavBtn.classList.toggle('active', data.favorited);
            modalFavBtn.querySelector('i').className = data.favorited ? 'fas fa-heart' : 'far fa-heart';
        }
    } catch (e) { console.error('Fav toggle error:', e); }
};

modalShareBtn.onclick = () => {
    if (!currentMovie) return;
    const url = `https://xitfilm.uz/?code=${currentMovie.code}`;
    if (navigator.share) {
        navigator.share({ title: currentMovie.title, text: `${currentMovie.title} — XIT FILM'da ko'ring!`, url });
    } else {
        navigator.clipboard.writeText(url).then(() => {
            // Show toast
            showToast('Link nusxalandi!');
        });
    }
};

// ============================================
// MOBILE MENU
// ============================================
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileOverlay');
    const hamburger = document.querySelector('.hamburger');

    if (menu) {
        menu.classList.toggle('open');
        overlay?.classList.toggle('open');
        hamburger?.classList.toggle('active');
        document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : 'auto';
    }
}

function closeMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileOverlay');
    const hamburger = document.querySelector('.hamburger');

    menu?.classList.remove('open');
    overlay?.classList.remove('open');
    hamburger?.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// ============================================
// BACK TO TOP
// ============================================
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

// ============================================
// BROWSER HISTORY (Back/Forward)
// ============================================
window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('genre')) {
        filterByGenre(params.get('genre'));
    } else if (params.get('type')) {
        filterByType(params.get('type'));
    } else {
        renderCategories();
    }
});

// ============================================
// CUSTOM VIDEO PLAYER LOGIC
// ============================================
let isPlayerInitialized = false;

function initCustomPlayer() {
    if (isPlayerInitialized) return;
    isPlayerInitialized = true;

    const mainVideo = document.getElementById('mainVideo');
    const customPlayer = document.getElementById('customPlayer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const skipBackBtn = document.getElementById('skipBackBtn');
    const skipForwardBtn = document.getElementById('skipForwardBtn');
    const muteBtn = document.getElementById('muteBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const playerTime = document.getElementById('playerTime');
    const progressArea = document.querySelector('.progress-area');
    const currentBar = document.querySelector('.current-bar');
    const bufferedBar = document.querySelector('.buffered-bar');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const speedBtn = document.getElementById('speedBtn');
    const speedList = document.getElementById('speedList');

    function togglePlay() {
        if (mainVideo.paused) {
            mainVideo.play().catch(e => console.log('Playback error:', e));
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            customPlayer.classList.remove('paused');
        } else {
            mainVideo.pause();
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            customPlayer.classList.add('paused');
        }
    }

    playPauseBtn.addEventListener('click', togglePlay);
    mainVideo.addEventListener('click', togglePlay);

    mainVideo.addEventListener('play', () => {
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        customPlayer.classList.remove('paused');
    });

    mainVideo.addEventListener('pause', () => {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        customPlayer.classList.add('paused');
    });

    skipBackBtn.addEventListener('click', () => {
        mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 10);
    });

    skipForwardBtn.addEventListener('click', () => {
        mainVideo.currentTime = Math.min(mainVideo.duration || 0, mainVideo.currentTime + 10);
    });

    muteBtn.addEventListener('click', () => {
        if (mainVideo.muted) {
            mainVideo.muted = false;
            muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            volumeSlider.value = mainVideo.volume;
        } else {
            mainVideo.muted = true;
            muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            volumeSlider.value = 0;
        }
    });

    volumeSlider.addEventListener('input', (e) => {
        mainVideo.volume = e.target.value;
        if (mainVideo.volume == 0) {
            muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            mainVideo.muted = true;
        } else {
            muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            mainVideo.muted = false;
        }
    });

    function formatTime(time) {
        if (isNaN(time) || time === Infinity) return '0:00';
        let sec = Math.floor(time % 60);
        let min = Math.floor(time / 60) % 60;
        let hour = Math.floor(time / 3600);
        sec = sec < 10 ? '0' + sec : sec;
        min = min < 10 && hour > 0 ? '0' + min : min;
        if (hour > 0) return `${hour}:${min}:${sec}`;
        return `${min}:${sec}`;
    }

    mainVideo.addEventListener('timeupdate', (e) => {
        const current = e.target.currentTime;
        const duration = e.target.duration || 0;
        const progressPercent = duration > 0 ? (current / duration) * 100 : 0;
        currentBar.style.width = `${progressPercent}%`;
        
        if (currentMovie && current > 5) {
            localStorage.setItem(`movie_progress_${currentMovie.code}`, current);
            saveHistoryToServer(currentMovie.code, current);
        }

        playerTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;

        if (mainVideo.buffered.length > 0 && duration > 0) {
            const buffered = mainVideo.buffered.end(mainVideo.buffered.length - 1);
            const bufferedPercent = (buffered / duration) * 100;
            bufferedBar.style.width = `${bufferedPercent}%`;
        }
    });

    progressArea.addEventListener('click', (e) => {
        const rect = progressArea.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        if (mainVideo.duration) {
            mainVideo.currentTime = (clickX / width) * mainVideo.duration;
        }
    });

    speedList.querySelectorAll('.speed-item').forEach(item => {
        item.addEventListener('click', () => {
            speedList.querySelectorAll('.speed-item').forEach(x => x.classList.remove('active'));
            item.classList.add('active');
            const speed = parseFloat(item.dataset.speed);
            mainVideo.playbackRate = speed;
            speedBtn.textContent = `${speed.toFixed(1)}x`;
        });
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            customPlayer.requestFullscreen().catch(err => console.error(err));
            fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            document.exitFullscreen();
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        }
    });

    let controlsTimeout;
    customPlayer.addEventListener('mousemove', () => {
        customPlayer.classList.add('controls-active');
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            customPlayer.classList.remove('controls-active');
        }, 3000);
    });

    document.addEventListener('keydown', (e) => {
        if (!movieModal.classList.contains('active') || customPlayer.style.display === 'none') return;
        const active = document.activeElement;
        if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return;

        if (e.key === ' ') {
            e.preventDefault();
            togglePlay();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            mainVideo.currentTime = Math.min(mainVideo.duration || 0, mainVideo.currentTime + 10);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 10);
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            fullscreenBtn.click();
        }
    });
}

async function saveHistoryToServer(code, progress) {
    const userId = localStorage.getItem('xitfilm_user_id');
    if (!userId) return;
    let localHistory = JSON.parse(localStorage.getItem(`watch_history_${userId}`) || '[]');
    if (!localHistory.includes(code)) {
        localHistory.unshift(code);
        localHistory = localHistory.slice(0, 50);
        localStorage.setItem(`watch_history_${userId}`, JSON.stringify(localHistory));
    }
    try {
        await fetch(`${API_BASE}/public-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, history: localHistory })
        });
    } catch (e) {}
}

// ============================================
// MOVIE REVIEWS & COMMENTS
// ============================================
async function loadReviews(code) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    commentsList.innerHTML = '<div style="text-align:center;padding:20px 0;"><i class="fas fa-spinner fa-spin"></i> Yuklanmoqda...</div>';

    try {
        const res = await fetch(`${API_BASE}/public-reviews/${code}`);
        const data = await res.json();
        
        const avg = data.avgRating || 5.0;
        document.getElementById('modalRating').innerHTML = `<i class="fas fa-star" style="color:#fbbf24;"></i> ${avg}`;

        const list = data.reviews || [];
        if (list.length === 0) {
            commentsList.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:14px;padding:20px 0;">Hozircha izohlar yo\'q. Birinchi bo\'lib izoh qoldiring!</p>';
            return;
        }

        commentsList.innerHTML = list.map(r => `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author">${r.name}</span>
                    <span class="comment-rating"><i class="fas fa-star" style="color:#fbbf24;"></i> ${r.rating}</span>
                </div>
                <div class="comment-text">${r.comment}</div>
                <small class="comment-date">${r.date}</small>
            </div>
        `).join('');
    } catch (e) {
        commentsList.innerHTML = '<p style="text-align:center;color:var(--danger);font-size:14px;">Izohlarni yuklab bo\'lmadi</p>';
    }
}

async function submitReview() {
    if (!currentMovie) return;
    const textInput = document.getElementById('commentInput');
    const comment = textInput.value.trim();
    if (!comment) return;

    const ratingSelect = document.getElementById('ratingSelect');
    const rating = ratingSelect ? parseInt(ratingSelect.value) : 10;
    
    // Check if user is logged in
    const userId = localStorage.getItem('xitfilm_user_id');
    if (!userId) {
        authModal.classList.add('active');
        showToast('Izoh qoldirish uchun avval tizimga kiring!');
        return;
    }

    const name = localStorage.getItem('xitfilm_user_name') || 'Foydalanuvchi';

    try {
        const res = await fetch(`${API_BASE}/public-reviews/${currentMovie.code}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, rating, comment })
        });
        if (res.ok) {
            textInput.value = '';
            showToast('Izohingiz qo\'shildi!');
            await loadReviews(currentMovie.code);
        }
    } catch (e) {
        showToast('Izoh yuborishda xatolik!');
    }
}

// ============================================
// VIP OBUNA & TO'LOV SIMULATION
// ============================================
const vipModal = document.getElementById('vipModal');
let selectedVipDays = 30;
let selectedVipPrice = 15000;
let selectedPaymentMethod = 'click';

function showVipModal() {
    vipModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    selectVipTier(30, 15000);
}

function closeVipModal() {
    vipModal.classList.remove('active');
    if (!movieModal.classList.contains('active')) {
        document.body.style.overflow = 'auto';
    }
}

function selectVipTier(days, price) {
    selectedVipDays = days;
    selectedVipPrice = price;
    
    document.getElementById('tier-30').style.border = days === 30 ? '2px solid var(--primary)' : '1px solid var(--glass-border)';
    document.getElementById('tier-30').style.background = days === 30 ? 'rgba(139,92,246,0.06)' : 'none';
    
    document.getElementById('tier-365').style.border = days === 365 ? '2px solid var(--primary)' : '1px solid var(--glass-border)';
    document.getElementById('tier-365').style.background = days === 365 ? 'rgba(139,92,246,0.06)' : 'none';
    
    document.getElementById('paySubmitBtn').textContent = `${price.toLocaleString('uz-UZ')} so'm to'lash`;
}

function payWith(method) {
    selectedPaymentMethod = method;
    document.getElementById('pay-click').style.borderColor = method === 'click' ? 'var(--primary)' : 'transparent';
    document.getElementById('pay-payme').style.borderColor = method === 'payme' ? 'var(--primary)' : 'transparent';
}

async function processVipPayment() {
    const userId = localStorage.getItem('xitfilm_user_id');
    if (!userId) {
        closeVipModal();
        authModal.classList.add('active');
        showToast('Obuna bo\'lish uchun avval kirishingiz kerak!');
        return;
    }
    
    const submitBtn = document.getElementById('paySubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'To\'lov tekshirilmoqda...';
    
    // Simulate transaction delay
    setTimeout(async () => {
        try {
            const res = await fetch(`${API_BASE}/public-upgrade-vip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, days: selectedVipDays })
            });
            const data = await res.json();
            if (data.success) {
                isUserPremiumStatus = true;
                showToast(`Tabriklaymiz! Siz VIP Premium maqomini oldingiz! 🎉`);
                
                // Refresh login button look
                const name = localStorage.getItem('xitfilm_user_name') || 'Profil';
                loginBtn.innerHTML = `<i class="fas fa-crown" style="color: #fbbf24; margin-right: 5px;"></i> <span>VIP ${name}</span>`;
                
                closeVipModal();
                
                // If movie modal is active, reload and play
                if (currentMovie) {
                    openMovieModal(currentMovie);
                }
            } else {
                showToast('To\'lovda xatolik yuz berdi!');
            }
        } catch (e) {
            showToast('Tizim xatosi!');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = `${selectedVipPrice.toLocaleString('uz-UZ')} so'm to'lash`;
        }
    }, 1500);
}

// ============================================
// THEME SWITCHER (Light/Dark Mode)
// ============================================
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeBtn = document.getElementById('themeToggleBtn');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('light-theme');
        if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

// ============================================
// PROGRESSIVE WEB APP (PWA)
// ============================================
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('ServiceWorker registered successfully', reg.scope))
                .catch(err => console.log('ServiceWorker registration failed', err));
        });
    }
}

// ============================================
// VOICE SEARCH & AI MOOD RECOMMENDATIONS
// ============================================
function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Brauzeringiz ovozli qidiruvni qo\'llab-quvvatlamaydi!');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'uz-UZ';
    recognition.interimResults = false;

    showToast('Ovozli qidiruv eshitmoqda... 🎙️ Gapiring!');
    const btn = document.getElementById('voiceSearchBtn');
    if (btn) btn.style.color = '#ef4444';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('searchInput').value = transcript;
        showToast(`Qidirilmoqda: "${transcript}"`);
        searchMovies(transcript);
        if (btn) btn.style.color = 'var(--primary-light)';
    };

    recognition.onerror = () => {
        showToast('Ovoz aniqlanmadi, qayta urinib ko\'ring!');
        if (btn) btn.style.color = 'var(--primary-light)';
    };

    recognition.start();
}

function openAiMoodModal() {
    const modal = document.getElementById('aiMoodModal');
    if (modal) modal.classList.add('active');
}

function closeAiMoodModal() {
    const modal = document.getElementById('aiMoodModal');
    if (modal) modal.classList.remove('active');
}

function selectMood(moodText) {
    document.getElementById('aiPromptInput').value = moodText;
    getAiRecommendations();
}

async function getAiRecommendations() {
    const prompt = document.getElementById('aiPromptInput').value.trim();
    const resultsGrid = document.getElementById('aiResultsGrid');
    if (!prompt) {
        showToast('Iltimos, kayfiyatingizni yozing yoki janrni tanlang!');
        return;
    }

    resultsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> AI mos kinolarni qidirmoqda...</div>';

    try {
        const allMovies = await fetchMovies();
        const filtered = allMovies.filter(m => {
            const text = (m.title + ' ' + m.description + ' ' + m.genre).toLowerCase();
            return prompt.toLowerCase().split(' ').some(w => text.includes(w));
        });

        const list = filtered.length > 0 ? filtered : allMovies.slice(0, 4);

        resultsGrid.innerHTML = list.map(m => `
            <div onclick="closeAiMoodModal(); openMovieModalByCode('${m.code}')" style="background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:12px; padding:8px; cursor:pointer; text-align:center;">
                <img src="${m.poster || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=200&auto=format&fit=crop'}" style="width:100%; height:110px; object-fit:cover; border-radius:8px; margin-bottom:6px;">
                <div style="font-size:11px; font-weight:800; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.title}</div>
            </div>
        `).join('');
    } catch (e) {
        resultsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:#ef4444;">Server bilan bog\'lanishda xatolik!</div>';
    }
}

function openMovieModalByCode(code) {
    const m = ALL_MOVIES.find(x => String(x.code) === String(code));
    if (m) openMovieModal(m);
}

// ============================================
// MOVIE REQUEST MODAL (Kino Buyurtma)
// ============================================
function openRequestModal() {
    const modal = document.getElementById('requestModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('reqMovieTitle')?.focus(), 200);
    }
}

function closeRequestModal() {
    const modal = document.getElementById('requestModal');
    if (modal) {
        modal.classList.remove('active');
        if (!movieModal.classList.contains('active')) {
            document.body.style.overflow = 'auto';
        }
    }
}

async function handleMovieRequestSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const titleInput = document.getElementById('reqMovieTitle');
    const commentInput = document.getElementById('reqMovieComment');
    const contactInput = document.getElementById('reqMovieContact');
    const submitBtn = document.getElementById('reqSubmitBtn');

    const title = titleInput.value.trim();
    if (!title) {
        showToast('Iltimos, film nomini kiriting!', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yuborilmoqda...';

    const userId = localStorage.getItem('xitfilm_user_id') || 0;
    try {
        const res = await fetch(`${API_BASE}/public-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                comment: commentInput.value.trim(),
                contact: contactInput.value.trim(),
                userId
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast('🎉 Kino buyurtmangiz muvaffaqiyatli qabul qilindi!', 'success');
            titleInput.value = '';
            commentInput.value = '';
            contactInput.value = '';
            closeRequestModal();
        } else {
            showToast(data.error || 'Xatolik yuz berdi', 'error');
        }
    } catch (err) {
        showToast('Server bilan bog\'lanishda xatolik', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Buyurtma Yuborish</span>';
    }
}

// ============================================
// TELEGRAM WEB APP (TMA) INTEGRATION
// ============================================
function initTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        try {
            tg.ready();
            tg.expand();
            if (tg.setHeaderColor) tg.setHeaderColor('#060608');
            if (tg.setBackgroundColor) tg.setBackgroundColor('#060608');
            if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
        } catch (e) {}
        document.documentElement.classList.add('tma-app');
        document.body.classList.add('tma-app');
    }
}

// ============================================
// MOBILE SEARCH MODAL & INSTANT RESULTS
// ============================================
let mobileSearchTimeout;

function openMobileSearch() {
    const modal = document.getElementById('mobileSearchModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        const input = document.getElementById('mobileSearchInput');
        if (input) {
            setTimeout(() => input.focus(), 150);
            renderMobileSearchResults(input.value.trim());
        }
    }
}

function closeMobileSearch() {
    const modal = document.getElementById('mobileSearchModal');
    if (modal) {
        modal.classList.remove('active');
        if (!movieModal.classList.contains('active')) {
            document.body.style.overflow = 'auto';
        }
    }
}

function renderMobileSearchResults(query) {
    const container = document.getElementById('mobileSearchResults');
    if (!container) return;

    if (!query) {
        const topTrending = [...ALL_MOVIES].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
        container.innerHTML = `
            <div style="font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin: 8px 0 8px 4px;"><i class="fas fa-fire" style="color:#fbbf24;"></i> Ommabop Premyeralar</div>
            ${topTrending.map(m => `
                <div class="search-item" onclick="closeMobileSearch(); openMovieModalByCode('${m.code}')" style="border-radius:12px; background:rgba(255,255,255,0.03); margin-bottom:4px; border:1px solid var(--glass-border);">
                    <div class="search-thumb" id="mthumb-${m.code}"><i class="fas fa-film"></i></div>
                    <div class="search-item-info">
                        <div class="search-item-title">${m.title}</div>
                        <small>${m.genre || 'Film'}</small>
                    </div>
                    <div class="search-item-rating"><i class="fas fa-star"></i> ${MOVIE_RATINGS[m.code] || '7.5'}</div>
                </div>
            `).join('')}
        `;
        topTrending.forEach(async (m) => {
            const meta = await fetchMeta(m.title);
            const thumb = document.getElementById(`mthumb-${m.code}`);
            if (thumb && meta?.poster_path) {
                thumb.innerHTML = `<img src="https://image.tmdb.org/t/p/w92${meta.poster_path}" alt="${m.title}">`;
            }
        });
        return;
    }

    const matches = ALL_MOVIES.filter(m => (m.title + ' ' + (m.genre || '')).toLowerCase().includes(query.toLowerCase())).slice(0, 15);
    if (matches.length === 0) {
        container.innerHTML = `
            <div class="mobile-search-empty">
                <i class="fas fa-search"></i>
                <p>"${query}" bo'yicha film topilmadi</p>
                <button onclick="closeMobileSearch(); openRequestModal();" style="margin-top:10px; background:rgba(14,165,233,0.15); border:1px solid rgba(14,165,233,0.4); color:#38bdf8; padding:8px 16px; border-radius:10px; font-weight:700; font-size:13px; cursor:pointer;">🍿 Kinoni buyurtma qilish</button>
            </div>
        `;
        return;
    }

    container.innerHTML = matches.map(m => `
        <div class="search-item" onclick="closeMobileSearch(); openMovieModalByCode('${m.code}')" style="border-radius:12px; background:rgba(255,255,255,0.03); margin-bottom:4px; border:1px solid var(--glass-border);">
            <div class="search-thumb" id="mthumb-${m.code}"><i class="fas fa-film"></i></div>
            <div class="search-item-info">
                <div class="search-item-title">${m.title}</div>
                <small>${m.genre || 'Film'}</small>
            </div>
            <div class="search-item-rating"><i class="fas fa-star"></i> ${MOVIE_RATINGS[m.code] || '7.5'}</div>
        </div>
    `).join('');

    matches.forEach(async (m) => {
        const meta = await fetchMeta(m.title);
        const thumb = document.getElementById(`mthumb-${m.code}`);
        if (thumb && meta?.poster_path) {
            thumb.innerHTML = `<img src="https://image.tmdb.org/t/p/w92${meta.poster_path}" alt="${m.title}">`;
        }
    });
}

const mobileSearchInput = document.getElementById('mobileSearchInput');
if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', (e) => {
        clearTimeout(mobileSearchTimeout);
        mobileSearchTimeout = setTimeout(() => {
            renderMobileSearchResults(e.target.value.trim());
        }, 200);
    });
}

function startMobileVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Brauzeringiz ovozli qidiruvni qo\'llab-quvvatlamaydi!');
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'uz-UZ';
    recognition.interimResults = false;
    showToast('Ovozli qidiruv eshitmoqda... 🎙️ Gapiring!');
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const input = document.getElementById('mobileSearchInput');
        if (input) {
            input.value = transcript;
            renderMobileSearchResults(transcript);
        }
    };
    recognition.start();
}

// ============================================
// MOBILE BOTTOM NAVIGATION HELPERS
// ============================================
function focusSearch() {
    if (window.innerWidth <= 768) {
        openMobileSearch();
    } else {
        const s = document.getElementById('searchInput');
        if (s) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => s.focus(), 250);
        }
    }
}

function filterFavorites() {
    const userId = localStorage.getItem('xitfilm_user_id');
    if (!userId) {
        authModal.classList.add('active');
        showToast('Sevimlilar ro\'yxatini ko\'rish uchun tizimga kiring', 'info');
        return;
    }
    window.location.href = 'profile.html?tab=favs';
}

function handleProfileNav() {
    const userId = localStorage.getItem('xitfilm_user_id');
    if (userId) {
        window.location.href = 'profile.html';
    } else {
        authModal.classList.add('active');
        switchAuthTab('link');
    }
}

// ============================================
// INIT ENTRY POINT
// ============================================
initTheme();
initTelegramWebApp();
registerServiceWorker();
init();
