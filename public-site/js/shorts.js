/**
 * XIT FILM - Shorts Interactive Video Feed Engine (v4.4.0)
 * TikTok / Instagram Reels Style Vertical Fullscreen Feed
 */

let shortsData = [];
let currentShortIndex = 0;
let isMuted = true;
let autoAdvance = true;
let activeShortForComments = null;
let lastTapTime = 0;
const API_BASE = '/movies/api';

// Fallback initial shorts
const FALLBACK_SHORTS = [
  {
    id: "sh_1",
    title: "Gunohkorlar (Sinners 4K) — Qaltis To'qnashuv",
    description: "Eng kutilgan jangari filmdan hayajonli qisqa lavha! To'liq filmni hoziroq ko'ring.",
    videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80",
    duration: "0:52",
    movieCode: "477",
    movieTitle: "Gunohkorlar (Sinners 4K)",
    creatorId: "cre_official",
    creatorName: "XIT FILM Official",
    creatorTag: "@xitfilm_uz",
    views: 8420,
    likes: ["6263659922"],
    shares: 340,
    comments: [
      { id: "c1", userName: "Rustam", text: "Kinoga gap yo'q, ovoz sifati a'lo!", createdAt: "2026-08-14T10:00:00Z" }
    ]
  },
  {
    id: "sh_2",
    title: "Titanlar Jangi 2 — Dahshatli Maxluq Bilan Jang",
    description: "Persey va Titanlar o'rtasidagi shiddatli afsonaviy jang sahnasi.",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    poster: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
    duration: "1:10",
    movieCode: "1001",
    movieTitle: "Titanlar Jangi 2",
    creatorId: "cre_kinochi",
    creatorName: "Kino Master",
    creatorTag: "@kinomaster_uz",
    views: 14200,
    likes: [],
    shares: 890,
    comments: []
  },
  {
    id: "sh_3",
    title: "Oshkoralik Kuni — Kutilmagan Sir Ochildi",
    description: "Dramatik voqea va sirlar to'qnashuvi. Davomini to'liq filmda ko'ring.",
    videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    poster: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=800&q=80",
    duration: "0:45",
    movieCode: "484",
    movieTitle: "Oshkoralik Kuni",
    creatorId: "cre_official",
    creatorName: "XIT FILM Official",
    creatorTag: "@xitfilm_uz",
    views: 6120,
    likes: [],
    shares: 190,
    comments: []
  }
];

document.addEventListener('DOMContentLoaded', async () => {
  // Telegram WebApp initialization
  if (window.Telegram && window.Telegram.WebApp) {
    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      if (window.Telegram.WebApp.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(() => {
          window.location.href = '/';
        });
      }
    } catch (e) {}
  }

  // Load feed
  await loadShortsFeed();

  // Bind Keyboard Navigation
  setupKeyboardNavigation();
});

async function loadShortsFeed() {
  try {
    const res = await fetch(`${API_BASE}/public-shorts`, { cache: 'no-cache' });
    const data = await res.json();
    if (data.success && Array.isArray(data.shorts) && data.shorts.length > 0) {
      shortsData = data.shorts;
    } else {
      shortsData = FALLBACK_SHORTS;
    }
  } catch (e) {
    console.warn('Using fallback shorts:', e.message);
    shortsData = FALLBACK_SHORTS;
  }

  renderShorts();
  setupObserver();
}

function renderShorts() {
  const container = document.getElementById('shortsContainer');
  if (!container) return;

  const currentUserId = getUserId();

  container.innerHTML = shortsData.map((item, idx) => {
    const isLiked = Array.isArray(item.likes) && (item.likes.includes(currentUserId) || item.likes.includes('6263659922'));
    const likesCount = Array.isArray(item.likes) ? item.likes.length : (item.likes || 0);
    const commentsCount = Array.isArray(item.comments) ? item.comments.length : 0;
    const movieCode = item.movieCode || '1001';
    const movieTitle = item.movieTitle || 'To\'liq Film';

    return `
      <div class="short-item" data-index="${idx}" data-id="${item.id}" data-code="${movieCode}">
        <div class="short-video-wrapper" id="wrapper_${idx}" onclick="handleVideoClick(event, ${idx}, '${item.id}')">
          <video 
            class="short-video" 
            id="video_${idx}"
            src="${item.videoUrl}" 
            poster="${item.poster || ''}" 
            playsinline 
            preload="metadata"
          ></video>
          
          <div class="play-pause-icon" id="playIcon_${idx}">
            <i class="fas fa-play"></i>
          </div>

          <div class="short-overlay-top"></div>
          <div class="short-overlay-bottom"></div>

          <!-- Action Sidebar (Right Side) -->
          <div class="short-sidebar" onclick="event.stopPropagation()">
            <!-- Like Button -->
            <div class="action-btn-wrap">
              <button class="action-btn ${isLiked ? 'liked' : ''}" id="likeBtn_${idx}" onclick="toggleLike('${item.id}', ${idx})">
                <i class="fas fa-heart"></i>
              </button>
              <span class="action-count" id="likeCount_${idx}">${likesCount}</span>
            </div>

            <!-- Comments Button -->
            <div class="action-btn-wrap">
              <button class="action-btn" onclick="openComments('${item.id}', ${idx})">
                <i class="fas fa-comment-dots"></i>
              </button>
              <span class="action-count" id="commentCount_${idx}">${commentsCount}</span>
            </div>

            <!-- Share Button -->
            <div class="action-btn-wrap">
              <button class="action-btn" onclick="shareShort('${item.id}', '${escapeJs(item.title)}', '${movieCode}')">
                <i class="fas fa-share-alt"></i>
              </button>
              <span class="action-count">${item.shares || 12}</span>
            </div>

            <!-- Movie Code Quick Card Button -->
            <div class="action-btn-wrap">
              <button class="action-btn code-badge" onclick="showMovieInfo('${movieCode}', '${escapeJs(item.title)}', '${escapeJs(item.description || '')}', '${item.poster || ''}')" title="Kino Kodi">
                #${movieCode}
              </button>
              <span class="action-count">Kod</span>
            </div>

            <!-- Mute / Unmute Button -->
            <div class="action-btn-wrap">
              <button class="action-btn" id="muteBtn_${idx}" onclick="toggleMute()">
                <i class="fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}"></i>
              </button>
            </div>
          </div>

          <!-- Bottom Info -->
          <div class="short-info" onclick="event.stopPropagation()">
            <div class="short-creator-tag">
              <i class="fas fa-user-circle"></i>
              <span>${item.creatorTag || item.creatorName || '@xitfilm_uz'}</span>
              <i class="fas fa-check-circle verified-icon"></i>
            </div>

            <h3 class="short-title">${escapeHtml(item.title)}</h3>
            <p class="short-desc">${escapeHtml(item.description || '')}</p>

            <div class="short-cta-buttons">
              <a href="/?code=${movieCode}" class="cta-watch-btn" onclick="openMovie('${movieCode}'); return false;">
                <i class="fas fa-play"></i>
                <span>To'liq Filmni Ko'rish</span>
              </a>
              <a href="https://t.me/xitfilm_bot?start=${movieCode}" target="_blank" class="cta-bot-btn">
                <i class="fab fa-telegram"></i>
                <span>Botda yuklash</span>
              </a>
            </div>
          </div>

          <!-- Progress Bar & Seek -->
          <div class="short-progress-container" onclick="seekVideo(event, ${idx})">
            <div class="short-progress-bar" id="progressBar_${idx}"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

let observer = null;

function setupObserver() {
  const container = document.getElementById('shortsContainer');
  if (!container) return;

  const options = {
    root: container,
    threshold: 0.65
  };

  if (observer) observer.disconnect();

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const idx = parseInt(entry.target.getAttribute('data-index'), 10);
      const video = entry.target.querySelector('video');
      const id = entry.target.getAttribute('data-id');

      if (entry.isIntersecting) {
        currentShortIndex = idx;
        if (video) {
          video.muted = isMuted;
          video.currentTime = 0;
          
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              video.muted = true;
              isMuted = true;
              updateMuteIcons();
              video.play().catch(() => {});
            });
          }

          setupVideoProgress(video, idx);

          // Handle Video Ended (Auto Advance or Loop)
          video.onended = () => {
            if (autoAdvance && currentShortIndex < shortsData.length - 1) {
              scrollToShort(currentShortIndex + 1);
            } else {
              video.currentTime = 0;
              video.play().catch(() => {});
            }
          };
        }

        // Track view on server
        if (id) {
          fetch(`${API_BASE}/public-shorts/${id}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref: getUrlParam('ref') || null })
          }).catch(() => {});
        }
      } else {
        if (video) {
          video.pause();
        }
      }
    });
  }, options);

  document.querySelectorAll('.short-item').forEach(el => observer.observe(el));
}

function setupVideoProgress(video, idx) {
  const bar = document.getElementById(`progressBar_${idx}`);
  if (!bar) return;

  video.ontimeupdate = () => {
    if (video.duration) {
      const pct = (video.currentTime / video.duration) * 100;
      bar.style.width = `${pct}%`;
    }
  };
}

// Single Tap / Double Tap Handler
function handleVideoClick(event, idx, shortId) {
  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastTapTime;

  if (tapLength < 300 && tapLength > 0) {
    // Double Tap -> Like + Burst Animation
    event.preventDefault();
    triggerDoubleTapLike(event, idx, shortId);
  } else {
    // Single Tap -> Play / Pause
    toggleVideoPlay(idx);
  }
  lastTapTime = currentTime;
}

function triggerDoubleTapLike(event, idx, shortId) {
  const wrapper = document.getElementById(`wrapper_${idx}`);
  if (!wrapper) return;

  // Create floating bursting heart element
  const heart = document.createElement('i');
  heart.className = 'fas fa-heart floating-heart';

  const rect = wrapper.getBoundingClientRect();
  const x = event.clientX ? (event.clientX - rect.left) : (rect.width / 2);
  const y = event.clientY ? (event.clientY - rect.top) : (rect.height / 2);

  heart.style.left = `${x}px`;
  heart.style.top = `${y}px`;

  wrapper.appendChild(heart);
  setTimeout(() => heart.remove(), 900);

  // Haptic feedback
  triggerHaptic('medium');

  // If not liked yet, perform like
  const btn = document.getElementById(`likeBtn_${idx}`);
  if (btn && !btn.classList.contains('liked')) {
    toggleLike(shortId, idx);
  }
}

function toggleVideoPlay(idx) {
  const video = document.getElementById(`video_${idx}`);
  const icon = document.getElementById(`playIcon_${idx}`);
  if (!video) return;

  if (video.paused) {
    video.play();
    if (icon) {
      icon.innerHTML = '<i class="fas fa-play"></i>';
      icon.classList.add('show');
      setTimeout(() => icon.classList.remove('show'), 350);
    }
  } else {
    video.pause();
    if (icon) {
      icon.innerHTML = '<i class="fas fa-pause"></i>';
      icon.classList.add('show');
    }
  }
}

function seekVideo(event, idx) {
  event.stopPropagation();
  const video = document.getElementById(`video_${idx}`);
  const progressContainer = event.currentTarget;
  if (!video || !video.duration || !progressContainer) return;

  const rect = progressContainer.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const width = rect.width;
  const pct = Math.max(0, Math.min(1, clickX / width));

  video.currentTime = pct * video.duration;
  const bar = document.getElementById(`progressBar_${idx}`);
  if (bar) bar.style.width = `${pct * 100}%`;
}

function toggleMute() {
  isMuted = !isMuted;
  document.querySelectorAll('.short-video').forEach(v => {
    v.muted = isMuted;
  });
  updateMuteIcons();
  showVolumeToast(isMuted ? 'Ovoz o\'chirildi' : 'Ovoz yoqildi', isMuted);
  triggerHaptic('light');
}

function updateMuteIcons() {
  document.querySelectorAll('[id^="muteBtn_"]').forEach(btn => {
    btn.innerHTML = `<i class="fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}"></i>`;
  });
}

function showVolumeToast(text, isMute) {
  const toast = document.getElementById('volumeToast');
  const icon = document.getElementById('volumeToastIcon');
  const textEl = document.getElementById('volumeToastText');

  if (!toast || !icon || !textEl) return;

  icon.className = `fas ${isMute ? 'fa-volume-mute' : 'fa-volume-up'}`;
  textEl.innerText = text;
  toast.classList.add('show');

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 1600);
}

function toggleAutoAdvance() {
  autoAdvance = !autoAdvance;
  const btn = document.getElementById('autoAdvanceBtn');
  const label = document.getElementById('autoAdvanceLabel');
  if (btn) btn.classList.toggle('active', autoAdvance);
  if (label) label.innerText = autoAdvance ? 'Avto' : 'Qaytarish';
  showVolumeToast(autoAdvance ? 'Avto-o\'tish yoqildi' : 'Bitta videoni qaytarish', !autoAdvance);
  triggerHaptic('light');
}

function scrollToShort(index) {
  const item = document.querySelector(`.short-item[data-index="${index}"]`);
  if (item) {
    item.scrollIntoView({ behavior: 'smooth' });
  }
}

async function toggleLike(id, idx) {
  const btn = document.getElementById(`likeBtn_${idx}`);
  const countEl = document.getElementById(`likeCount_${idx}`);
  let currentCount = parseInt(countEl?.innerText || '0', 10);

  const isLiked = btn?.classList.contains('liked');
  if (isLiked) {
    btn.classList.remove('liked');
    if (countEl) countEl.innerText = Math.max(0, currentCount - 1);
  } else {
    btn?.classList.add('liked');
    if (countEl) countEl.innerText = currentCount + 1;
    triggerHaptic('medium');
  }

  try {
    const res = await fetch(`${API_BASE}/public-shorts/${id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() })
    });
    const data = await res.json();
    if (data.success && countEl) {
      countEl.innerText = data.totalLikes;
    }
  } catch (e) {}
}

function shareShort(id, title, movieCode) {
  triggerHaptic('light');
  const refCode = getUrlParam('ref') || 'share';
  const url = `${window.location.origin}/shorts.html?short=${id}&code=${movieCode}&ref=${refCode}`;
  
  if (navigator.share) {
    navigator.share({
      title: title,
      text: `🍿 «${title}» — XIT FILM Shorts lavhasini tomosha qiling:`,
      url: url
    }).catch(() => copyToClipboard(url));
  } else {
    copyToClipboard(url);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showVolumeToast('✅ Havola nusxalandi!', false);
  }).catch(() => {
    prompt('Havolani nusxalang:', text);
  });
}

function openMovie(code) {
  triggerHaptic('medium');
  window.location.href = `/?code=${code}`;
}

// Movie Quick Info Modal
function showMovieInfo(code, title, desc, poster) {
  triggerHaptic('light');
  const modal = document.getElementById('movieInfoModal');
  const codeEl = document.getElementById('mInfoCode');
  const titleEl = document.getElementById('mInfoTitle');
  const descEl = document.getElementById('mInfoDesc');
  const posterEl = document.getElementById('mInfoPoster');
  const watchBtn = document.getElementById('mInfoWatchBtn');
  const botBtn = document.getElementById('mInfoBotBtn');

  if (!modal) return;

  if (codeEl) codeEl.innerText = `#${code}`;
  if (titleEl) titleEl.innerText = title;
  if (descEl) descEl.innerText = desc || 'Ushbu filmning to\'liq versiyasini yuqori sifatda tomosha qiling.';
  if (posterEl) posterEl.src = poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=400&q=80';
  
  if (watchBtn) watchBtn.onclick = () => openMovie(code);
  if (botBtn) botBtn.href = `https://t.me/xitfilm_bot?start=${code}`;

  modal.classList.add('active');
}

function closeMovieInfo(e) {
  const modal = document.getElementById('movieInfoModal');
  if (modal) modal.classList.remove('active');
}

// Comments Modal
async function openComments(id, idx) {
  triggerHaptic('light');
  activeShortForComments = { id, idx };
  const modal = document.getElementById('commentsModal');
  const list = document.getElementById('commentsList');
  const countEl = document.getElementById('commentsCount');

  if (!modal) return;
  modal.classList.add('active');

  // Load comments
  if (list) {
    list.innerHTML = '<div class="comments-empty"><i class="fas fa-spinner fa-spin"></i><p>Izohlar yuklanmoqda...</p></div>';
  }

  try {
    const res = await fetch(`${API_BASE}/public-shorts/${id}/comments`);
    const data = await res.json();
    const comments = (data.success && Array.isArray(data.comments)) ? data.comments : [];
    
    if (countEl) countEl.innerText = comments.length;
    renderCommentsList(comments);
  } catch (e) {
    const short = shortsData.find(s => s.id === id);
    const comments = short && Array.isArray(short.comments) ? short.comments : [];
    renderCommentsList(comments);
  }
}

function renderCommentsList(comments) {
  const list = document.getElementById('commentsList');
  if (!list) return;

  if (!comments || comments.length === 0) {
    list.innerHTML = `
      <div class="comments-empty">
        <i class="fas fa-comment-dots"></i>
        <p>Hozircha izohlar yo'q. Birinchi bo'lib fikr bildiring!</p>
      </div>
    `;
    return;
  }

  list.innerHTML = comments.map(c => `
    <div class="comment-item">
      <div class="comment-avatar">${(c.userName || 'U').substring(0, 2).toUpperCase()}</div>
      <div class="comment-body">
        <div class="comment-user-row">
          <span class="comment-user-name">${escapeHtml(c.userName || 'Kinochi')}</span>
          <span>${formatCommentDate(c.createdAt)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
      </div>
    </div>
  `).join('');
}

function closeComments(e) {
  const modal = document.getElementById('commentsModal');
  if (modal) modal.classList.remove('active');
  activeShortForComments = null;
}

function insertReaction(text) {
  const input = document.getElementById('commentTextInput');
  if (input) {
    input.value = text;
    input.focus();
  }
}

async function submitComment(e) {
  e.preventDefault();
  if (!activeShortForComments) return;

  const input = document.getElementById('commentTextInput');
  const text = input?.value.trim();
  if (!text) return;

  const user = getSavedProfile();
  const payload = {
    userId: getUserId(),
    userName: user.name || 'Kino Muxlisi',
    text: text
  };

  input.value = '';
  triggerHaptic('medium');

  // Optimistic UI append
  const list = document.getElementById('commentsList');
  const empty = list?.querySelector('.comments-empty');
  if (empty) empty.remove();

  const newCommentEl = document.createElement('div');
  newCommentEl.className = 'comment-item';
  newCommentEl.innerHTML = `
    <div class="comment-avatar">${payload.userName.substring(0, 2).toUpperCase()}</div>
    <div class="comment-body">
      <div class="comment-user-row">
        <span class="comment-user-name">${escapeHtml(payload.userName)}</span>
        <span>Hozirgina</span>
      </div>
      <div class="comment-text">${escapeHtml(payload.text)}</div>
    </div>
  `;
  if (list) list.prepend(newCommentEl);

  // Update badge count
  const countEl = document.getElementById('commentsCount');
  if (countEl) countEl.innerText = parseInt(countEl.innerText || '0', 10) + 1;
  const sidebarCount = document.getElementById(`commentCount_${activeShortForComments.idx}`);
  if (sidebarCount) sidebarCount.innerText = parseInt(sidebarCount.innerText || '0', 10) + 1;

  try {
    await fetch(`${API_BASE}/public-shorts/${activeShortForComments.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

// Keyboard Navigation Setup
function setupKeyboardNavigation() {
  window.addEventListener('keydown', (e) => {
    // If typing in input, don't trigger shortcuts
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.code === 'ArrowDown' || e.code === 'KeyJ') {
      e.preventDefault();
      if (currentShortIndex < shortsData.length - 1) {
        scrollToShort(currentShortIndex + 1);
      }
    } else if (e.code === 'ArrowUp' || e.code === 'KeyK') {
      e.preventDefault();
      if (currentShortIndex > 0) {
        scrollToShort(currentShortIndex - 1);
      }
    } else if (e.code === 'Space') {
      e.preventDefault();
      toggleVideoPlay(currentShortIndex);
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      toggleMute();
    } else if (e.code === 'KeyL') {
      e.preventDefault();
      const currentShort = shortsData[currentShortIndex];
      if (currentShort) toggleLike(currentShort.id, currentShortIndex);
    } else if (e.code === 'KeyC') {
      e.preventDefault();
      const currentShort = shortsData[currentShortIndex];
      if (currentShort) openComments(currentShort.id, currentShortIndex);
    }
  });
}

function triggerHaptic(type = 'light') {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
    try {
      if (type === 'light') window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      else if (type === 'medium') window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      else if (type === 'heavy') window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
      else if (type === 'success') window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    } catch (e) {}
  }
}

function getUserId() {
  let uid = localStorage.getItem('xitfilm_user_id');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('xitfilm_user_id', uid);
  }
  return uid;
}

function getSavedProfile() {
  try {
    const raw = localStorage.getItem('xitfilm_profile');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { name: 'Kino Muxlisi' };
}

function getUrlParam(param) {
  const params = new URLSearchParams(window.location.search);
  return params.get(param);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJs(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function formatCommentDate(dateStr) {
  if (!dateStr) return 'Bugun';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
  } catch (e) {
    return 'Bugun';
  }
}
