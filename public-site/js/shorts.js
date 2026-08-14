/**
 * XIT FILM - Shorts Interactive Video Feed Engine (v5.5.0)
 * Instagram Reels & TikTok Style Algorithmic Recommendation & Creator Profiles
 */

let shortsData = [];
let currentShortIndex = 0;
let isMuted = true;
let autoAdvance = true;
let currentFeedType = 'foryou';
let activeShortForComments = null;
let activeCreatorProfile = null;
let lastTapTime = 0;
let pressTimer = null;
let isSpeedingUp = false;
let currentWatchStartTime = 0;

const API_BASE = '/movies/api';

// Fallback initial shorts
const FALLBACK_SHORTS = [
  {
    id: "sh_1",
    title: "Gunohkorlar (Sinners 4K) — Qaltis To'qnashuv",
    description: "Eng kutilgan jangari filmdan hayajonli qisqa lavha! To'liq filmni hoziroq ko'ring. #jangari #premyera",
    videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80",
    duration: "0:52",
    movieCode: "477",
    movieTitle: "Gunohkorlar (Sinners 4K)",
    genre: "Jangari",
    creatorId: "cre_official",
    creatorName: "XIT FILM Official",
    creatorTag: "@xitfilm_uz",
    views: 8420,
    likes: ["6263659922"],
    shares: 340,
    bookmarks: [],
    comments: [
      { id: "c1", userName: "XIT FILM Official", userTag: "@xitfilm_uz", text: "Kinoga gap yo'q, ovoz sifati a'lo! To'liq filmni bot orqali yuklang.", isCreator: true, createdAt: "2026-08-14T10:00:00Z" }
    ]
  },
  {
    id: "sh_2",
    title: "Titanlar Jangi 2 — Dahshatli Maxluq Bilan Jang",
    description: "Persey va Titanlar o'rtasidagi shiddatli afsonaviy jang sahnasi. #fantastika #jang",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    poster: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
    duration: "1:10",
    movieCode: "1001",
    movieTitle: "Titanlar Jangi 2",
    genre: "Fantastika",
    creatorId: "cre_kinochi",
    creatorName: "Kino Master",
    creatorTag: "@kinomaster_uz",
    views: 14200,
    likes: [],
    shares: 890,
    bookmarks: [],
    comments: []
  },
  {
    id: "sh_3",
    title: "Oshkoralik Kuni — Kutilmagan Sir Ochildi",
    description: "Dramatik voqea va sirlar to'qnashuvi. Davomini to'liq filmda ko'ring. #drama #uzbek",
    videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    poster: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=800&q=80",
    duration: "0:45",
    movieCode: "484",
    movieTitle: "Oshkoralik Kuni",
    genre: "Drama",
    creatorId: "cre_official",
    creatorName: "XIT FILM Official",
    creatorTag: "@xitfilm_uz",
    views: 6120,
    likes: [],
    shares: 190,
    bookmarks: [],
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

  // Load Algorithmic Feed
  await loadShortsFeed(currentFeedType);

  // Setup Keyboard Shortcuts
  setupKeyboardNavigation();
});

async function loadShortsFeed(feedType = 'foryou') {
  const container = document.getElementById('shortsContainer');
  if (container) {
    container.innerHTML = `
      <div class="shorts-loader">
        <div class="spinner"></div>
        <p style="font-size: 14px; font-weight: 700; color: #94a3b8;">${
          feedType === 'trending' ? '🔥 Trenddagi lavhalar...' :
          feedType === 'saved' ? '🔖 Saqlangan lavhalar...' :
          feedType === 'new' ? '✨ Yangi premyeralar...' : '⚡️ Siz uchun tavsiyalar...'
        }</p>
      </div>
    `;
  }

  try {
    const userId = getUserId();
    const url = feedType === 'saved'
      ? `${API_BASE}/public-shorts/bookmarked/${userId}`
      : `${API_BASE}/public-shorts?feed=${feedType}&userId=${userId}`;

    const res = await fetch(url, { cache: 'no-cache' });
    const data = await res.json();

    if (data.success && Array.isArray(data.shorts) && data.shorts.length > 0) {
      shortsData = data.shorts;
    } else {
      if (feedType === 'saved') {
        renderEmptySavedState();
        return;
      }
      shortsData = FALLBACK_SHORTS;
    }
  } catch (e) {
    console.warn('Using fallback shorts:', e.message);
    shortsData = FALLBACK_SHORTS;
  }

  renderShorts();
  setupObserver();
}

function switchFeed(feedType) {
  triggerHaptic('medium');
  currentFeedType = feedType;

  // Update tabs visual state
  document.querySelectorAll('.feed-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  const activeTab = document.getElementById(`tab_${feedType}`);
  if (activeTab) activeTab.classList.add('active');

  loadShortsFeed(feedType);
}

function renderEmptySavedState() {
  const container = document.getElementById('shortsContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="shorts-loader" style="padding: 20px; text-align: center;">
      <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(245, 158, 11, 0.15); color: #f59e0b; display: grid; place-items: center; font-size: 32px; margin-bottom: 12px;">
        <i class="fas fa-bookmark"></i>
      </div>
      <h3 style="font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 6px;">Saqlangan videolar yo'q</h3>
      <p style="font-size: 13px; color: #94a3b8; max-width: 280px; margin-bottom: 20px;">
        Qiziqarli shorts lavhalarni 🔖 tugmasi orqali saqlab qo'ying.
      </p>
      <button class="cta-watch-btn" onclick="switchFeed('foryou')">
        <i class="fas fa-bolt"></i> <span>Tavsiyalarni Ko'rish</span>
      </button>
    </div>
  `;
}

function renderShorts() {
  const container = document.getElementById('shortsContainer');
  if (!container) return;

  const currentUserId = getUserId();

  container.innerHTML = shortsData.map((item, idx) => {
    const isLiked = Array.isArray(item.likes) && (item.likes.includes(currentUserId) || item.likes.includes('6263659922'));
    const isBookmarked = Array.isArray(item.bookmarks) && item.bookmarks.includes(currentUserId);
    const likesCount = Array.isArray(item.likes) ? item.likes.length : (item.likes || 0);
    const bookmarksCount = Array.isArray(item.bookmarks) ? item.bookmarks.length : 0;
    const commentsCount = Array.isArray(item.comments) ? item.comments.length : 0;
    const movieCode = item.movieCode || '1001';
    const movieTitle = item.movieTitle || 'To\'liq Film';
    const creatorTag = item.creatorTag || item.creatorName || '@xitfilm_uz';

    return `
      <div class="short-item" data-index="${idx}" data-id="${item.id}" data-code="${movieCode}">
        <div 
          class="short-video-wrapper" 
          id="wrapper_${idx}"
          onmousedown="handlePressStart(event, ${idx})"
          onmouseup="handlePressEnd(event, ${idx})"
          ontouchstart="handlePressStart(event, ${idx})"
          ontouchend="handlePressEnd(event, ${idx})"
          onclick="handleVideoClick(event, ${idx}, '${item.id}')"
        >
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

          <!-- Action Sidebar (Right Side - Instagram Style) -->
          <div class="short-sidebar" onclick="event.stopPropagation()">
            <!-- Like Button -->
            <div class="action-btn-wrap">
              <button class="action-btn ${isLiked ? 'liked' : ''}" id="likeBtn_${idx}" onclick="toggleLike('${item.id}', ${idx})">
                <i class="fas fa-heart"></i>
              </button>
              <span class="action-count" id="likeCount_${idx}">${shortFmt(likesCount)}</span>
            </div>

            <!-- Comments Button -->
            <div class="action-btn-wrap">
              <button class="action-btn" onclick="openComments('${item.id}', ${idx})">
                <i class="fas fa-comment-dots"></i>
              </button>
              <span class="action-count" id="commentCount_${idx}">${shortFmt(commentsCount)}</span>
            </div>

            <!-- Bookmark / Saqlash Button -->
            <div class="action-btn-wrap">
              <button class="action-btn ${isBookmarked ? 'bookmarked' : ''}" id="bookmarkBtn_${idx}" onclick="toggleBookmark('${item.id}', ${idx})" title="Saqlash">
                <i class="fas fa-bookmark"></i>
              </button>
              <span class="action-count" id="bookmarkCount_${idx}">${bookmarksCount ? shortFmt(bookmarksCount) : ''}</span>
            </div>

            <!-- Share Button -->
            <div class="action-btn-wrap">
              <button class="action-btn" onclick="shareShort('${item.id}', '${escapeJs(item.title)}', '${movieCode}')">
                <i class="fas fa-share-alt"></i>
              </button>
              <span class="action-count">${shortFmt(item.shares || 12)}</span>
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

          <!-- Bottom Content Info -->
          <div class="short-info" onclick="event.stopPropagation()">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div class="short-creator-tag clickable" onclick="openCreatorProfile('${creatorTag}')" title="Kanal akkauntini ochish">
                <i class="fas fa-user-circle"></i>
                <span>${creatorTag}</span>
                <i class="fas fa-check-circle verified-icon"></i>
              </div>
              <button class="creator-follow-btn" id="followBtn_${idx}" onclick="toggleFollowCreator('${creatorTag}', ${idx})">
                + Obuna
              </button>
              ${item.genre ? `<span class="short-genre-tag">${escapeHtml(item.genre)}</span>` : ''}
            </div>

            <h3 class="short-title">${escapeHtml(item.title)}</h3>
            <p class="short-desc">${formatHashtags(escapeHtml(item.description || ''))}</p>

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

            <!-- Soundtrack & Spinning Vinyl Record (Instagram Reels element) -->
            <div class="short-soundtrack-wrap">
              <div class="short-soundtrack" onclick="openCreatorProfile('${creatorTag}')">
                <i class="fas fa-music"></i>
                <span>XIT FILM Soundtrack • #${movieCode} ${escapeHtml(movieTitle)}</span>
              </div>
              <div class="spinning-vinyl" id="vinyl_${idx}" onclick="openCreatorProfile('${creatorTag}')" title="Kanal Profili"></div>
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
      const vinyl = document.getElementById(`vinyl_${idx}`);

      if (entry.isIntersecting) {
        currentShortIndex = idx;
        currentWatchStartTime = Date.now();

        if (video) {
          video.muted = isMuted;
          video.currentTime = 0;
          
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              if (vinyl) vinyl.classList.remove('paused');
            }).catch(() => {
              video.muted = true;
              isMuted = true;
              updateMuteIcons();
              video.play().catch(() => {});
            });
          }

          setupVideoProgress(video, idx);

          // Handle Video Ended (Auto Advance or Loop)
          video.onended = () => {
            recordWatchInteraction(id, video.duration, video.duration, true);
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
          if (vinyl) vinyl.classList.add('paused');

          // Record retention & watch time on scroll away
          if (id && currentWatchStartTime > 0) {
            const watchedSecs = (Date.now() - currentWatchStartTime) / 1000;
            const dur = video.duration || 30;
            recordWatchInteraction(id, watchedSecs, dur, watchedSecs >= (dur * 0.9));
          }
        }
      }
    });
  }, options);

  document.querySelectorAll('.short-item').forEach(el => observer.observe(el));
}

function recordWatchInteraction(id, watchTime, duration, completed) {
  if (!id || watchTime <= 0.5) return;
  fetch(`${API_BASE}/public-shorts/${id}/interaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      watchTime: Math.round(watchTime * 10) / 10,
      duration: Math.round(duration * 10) / 10,
      completed: !!completed
    })
  }).catch(() => {});
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

// Press & Hold for 2X Speed (Instagram Feature)
function handlePressStart(event, idx) {
  if (event.target.closest('.short-sidebar') || event.target.closest('.short-info') || event.target.closest('.short-progress-container')) {
    return;
  }

  pressTimer = setTimeout(() => {
    const video = document.getElementById(`video_${idx}`);
    if (video && !video.paused) {
      isSpeedingUp = true;
      video.playbackRate = 2.0;
      const badge = document.getElementById('speedBadge');
      if (badge) badge.classList.add('show');
      triggerHaptic('heavy');
    }
  }, 250);
}

function handlePressEnd(event, idx) {
  clearTimeout(pressTimer);
  if (isSpeedingUp) {
    const video = document.getElementById(`video_${idx}`);
    if (video) video.playbackRate = 1.0;
    const badge = document.getElementById('speedBadge');
    if (badge) badge.classList.remove('show');
    isSpeedingUp = false;
    triggerHaptic('light');
  }
}

// Single Tap / Double Tap Handler
function handleVideoClick(event, idx, shortId) {
  if (isSpeedingUp) return;
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

  const heart = document.createElement('i');
  heart.className = 'fas fa-heart floating-heart';

  const rect = wrapper.getBoundingClientRect();
  const x = event.clientX ? (event.clientX - rect.left) : (rect.width / 2);
  const y = event.clientY ? (event.clientY - rect.top) : (rect.height / 2);

  heart.style.left = `${x}px`;
  heart.style.top = `${y}px`;

  wrapper.appendChild(heart);
  setTimeout(() => heart.remove(), 900);

  triggerHaptic('medium');

  const btn = document.getElementById(`likeBtn_${idx}`);
  if (btn && !btn.classList.contains('liked')) {
    toggleLike(shortId, idx);
  }
}

function toggleVideoPlay(idx) {
  const video = document.getElementById(`video_${idx}`);
  const icon = document.getElementById(`playIcon_${idx}`);
  const vinyl = document.getElementById(`vinyl_${idx}`);
  if (!video) return;

  if (video.paused) {
    video.play();
    if (vinyl) vinyl.classList.remove('paused');
    if (icon) {
      icon.innerHTML = '<i class="fas fa-play"></i>';
      icon.classList.add('show');
      setTimeout(() => icon.classList.remove('show'), 350);
    }
  } else {
    video.pause();
    if (vinyl) vinyl.classList.add('paused');
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
      countEl.innerText = shortFmt(data.totalLikes);
    }
  } catch (e) {}
}

// Bookmark / Save Action
async function toggleBookmark(id, idx) {
  triggerHaptic('medium');
  const btn = document.getElementById(`bookmarkBtn_${idx}`);
  const countEl = document.getElementById(`bookmarkCount_${idx}`);
  let currentCount = parseInt(countEl?.innerText || '0', 10) || 0;

  const isBookmarked = btn?.classList.contains('bookmarked');
  if (isBookmarked) {
    btn.classList.remove('bookmarked');
    if (countEl) countEl.innerText = Math.max(0, currentCount - 1) || '';
    showVolumeToast('Saqlanganlardan olib tashlandi', true);
  } else {
    btn?.classList.add('bookmarked');
    if (countEl) countEl.innerText = currentCount + 1;
    showVolumeToast('🔖 Saqlanganlarga qo\'shildi', false);
  }

  try {
    await fetch(`${API_BASE}/public-shorts/${id}/bookmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() })
    });
  } catch (e) {}
}

// Creator Follow Toggle
async function toggleFollowCreator(creatorTag, idx) {
  triggerHaptic('medium');
  const btn = document.getElementById(`followBtn_${idx}`);
  if (!btn) return;

  const isFollowing = btn.classList.contains('following');
  if (isFollowing) {
    btn.classList.remove('following');
    btn.innerText = '+ Obuna';
  } else {
    btn.classList.add('following');
    btn.innerHTML = '✓ Obunadasiz';
    showVolumeToast(`✅ ${creatorTag} ga obuna bo'lindi`, false);
  }

  try {
    await fetch(`${API_BASE}/public-creator/${encodeURIComponent(creatorTag)}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() })
    });
  } catch (e) {}
}

// Open Instagram-style Creator Profile Modal
async function openCreatorProfile(creatorTag) {
  triggerHaptic('medium');
  const modal = document.getElementById('creatorProfileModal');
  if (!modal) return;

  const cleanTag = String(creatorTag || '').replace('@', '').trim();
  activeCreatorProfile = cleanTag;

  modal.classList.add('active');

  // Loading state
  const grid = document.getElementById('cProfShortsGrid');
  if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #94a3b8;"><i class="fas fa-spinner fa-spin"></i> Yuklanmoqda...</div>';

  try {
    const res = await fetch(`${API_BASE}/public-creator/${encodeURIComponent(cleanTag)}?userId=${getUserId()}`);
    const data = await res.json();
    const prof = data?.profile;

    if (prof) {
      document.getElementById('cProfName').innerText = prof.name || `@${cleanTag}`;
      document.getElementById('cProfTag').innerText = prof.username || `@${cleanTag}`;
      document.getElementById('cProfBio').innerText = prof.bio || 'Eng sara kinolar va eksklyuziv lavhalar.';
      document.getElementById('cProfShortsCount').innerText = prof.shortsCount || 0;
      document.getElementById('cProfFollowers').innerText = shortFmt(prof.followers || 0);
      document.getElementById('cProfLikes').innerText = shortFmt(prof.totalLikes || 0);

      const avatarImg = document.getElementById('cProfAvatar');
      const fallback = document.getElementById('cProfAvatarFallback');
      if (prof.avatar) {
        avatarImg.src = prof.avatar;
        avatarImg.style.display = 'block';
        if (fallback) fallback.style.display = 'none';
      } else {
        avatarImg.style.display = 'none';
        if (fallback) {
          fallback.style.display = 'grid';
          fallback.innerText = (prof.name || cleanTag).substring(0, 2).toUpperCase();
        }
      }

      const tgBtn = document.getElementById('cProfTgBtn');
      if (tgBtn) tgBtn.href = prof.telegramChannel || `https://t.me/${cleanTag}`;

      const followBtn = document.getElementById('cProfFollowBtn');
      if (followBtn) {
        followBtn.className = `c-action-btn follow ${prof.isFollowing ? 'following' : ''}`;
        followBtn.innerText = prof.isFollowing ? '✓ Obunadasiz' : '+ Obuna bo\'lish';
      }

      // Render 3-column Reels grid
      renderCreatorReelsGrid(prof.shorts || []);
    }
  } catch (e) {
    if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; color: #ef4444; text-align: center; padding: 20px;">Ma\'lumot yuklanmadi</div>';
  }
}

function renderCreatorReelsGrid(shorts) {
  const grid = document.getElementById('cProfShortsGrid');
  if (!grid) return;

  if (!shorts || shorts.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #94a3b8; font-size: 13px;">Hozircha videolar yuklanmagan</div>';
    return;
  }

  grid.innerHTML = shorts.map(s => `
    <div class="c-grid-card" onclick="selectShortFromProfile('${s.id}')">
      <img src="${s.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=400&q=80'}" alt="">
      <div class="c-grid-card-overlay">
        <div class="c-grid-views">
          <i class="fas fa-play" style="font-size: 9px;"></i>
          <span>${shortFmt(s.views || 0)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function selectShortFromProfile(shortId) {
  closeCreatorProfile();
  const idx = shortsData.findIndex(s => s.id === shortId);
  if (idx !== -1) {
    scrollToShort(idx);
  } else {
    // If not in current feed, load and jump
    window.location.href = `/shorts.html?short=${shortId}`;
  }
}

function closeCreatorProfile(e) {
  const modal = document.getElementById('creatorProfileModal');
  if (modal) modal.classList.remove('active');
  activeCreatorProfile = null;
}

async function toggleFollowCurrentProfile() {
  if (!activeCreatorProfile) return;
  triggerHaptic('medium');

  const btn = document.getElementById('cProfFollowBtn');
  const isFollowing = btn?.classList.contains('following');

  if (isFollowing) {
    btn?.classList.remove('following');
    if (btn) btn.innerText = '+ Obuna bo\'lish';
  } else {
    btn?.classList.add('following');
    if (btn) btn.innerText = '✓ Obunadasiz';
    showVolumeToast(`✅ @${activeCreatorProfile} ga obuna bo'lindi`, false);
  }

  try {
    await fetch(`${API_BASE}/public-creator/${encodeURIComponent(activeCreatorProfile)}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() })
    });
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

  list.innerHTML = comments.map(c => {
    const userTag = c.userTag || (c.isCreator ? '@xitfilm_uz' : '');
    const isCreator = c.isCreator || userTag === '@xitfilm_uz' || c.userName?.toLowerCase().includes('xit film');

    return `
      <div class="comment-item">
        <div class="comment-avatar clickable" onclick="openCreatorProfile('${userTag || c.userName}')" title="Profilni ko'rish">
          ${(c.userName || 'U').substring(0, 2).toUpperCase()}
        </div>
        <div class="comment-body">
          <div class="comment-user-row">
            <span class="comment-user-name clickable" onclick="openCreatorProfile('${userTag || c.userName}')">
              ${escapeHtml(c.userName || 'Kinochi')}
            </span>
            ${isCreator ? '<span class="comment-author-badge">Muallif</span>' : ''}
            <span>${formatCommentDate(c.createdAt)}</span>
          </div>
          <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>
      </div>
    `;
  }).join('');
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
    userTag: user.username ? `@${user.username}` : '',
    text: text
  };

  input.value = '';
  triggerHaptic('medium');

  const list = document.getElementById('commentsList');
  const empty = list?.querySelector('.comments-empty');
  if (empty) empty.remove();

  const newCommentEl = document.createElement('div');
  newCommentEl.className = 'comment-item';
  newCommentEl.innerHTML = `
    <div class="comment-avatar clickable" onclick="openCreatorProfile('${payload.userTag || payload.userName}')">
      ${payload.userName.substring(0, 2).toUpperCase()}
    </div>
    <div class="comment-body">
      <div class="comment-user-row">
        <span class="comment-user-name clickable" onclick="openCreatorProfile('${payload.userTag || payload.userName}')">
          ${escapeHtml(payload.userName)}
        </span>
        <span>Hozirgina</span>
      </div>
      <div class="comment-text">${escapeHtml(payload.text)}</div>
    </div>
  `;
  if (list) list.prepend(newCommentEl);

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

function formatHashtags(str) {
  if (!str) return '';
  return str.replace(/#([\w\u0400-\u04FF]+)/g, '<span style="color:#8b5cf6;font-weight:700;">#$1</span>');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJs(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function shortFmt(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num || 0;
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
