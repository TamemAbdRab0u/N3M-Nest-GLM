/* =========================================================
   Game Details – game-details.js
   Fetches full game info from the Catalog via the backend API
   ========================================================= */

let currentGame = null;          // Loaded game data 
let screenshotUrls = [];         // For lightbox navigation
let currentLbIndex = 0;          // Current lightbox index
let descriptionExpanded = false; // Description expand/collapse
let currentMediaIndex = 0;       // For automatic sliding
let slideInterval = null;        // Interval timer for sliding
let isVideoMain = false;         // Is the video currently in the main container
let currentRating = 0;           // Selected star rating for review form
let editingReviewId = null;      // null = create mode, number = edit mode
let editModalRating = 0;         // Rating selected inside the edit modal
let currentCompanyPage = 1;      // Current page for company games
let currentCompany = null;       // Current company name being displayed

/* ──────────────────────────────────────────────
   Initialisation
────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = '../../Auth/Html/login.html';
        return;
    }

    populateSidebarUser();

    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('id');

    if (!gameId || isNaN(Number(gameId))) {
        showPageErrorState();
        return;
    }

    loadGameDetails(Number(gameId));

    // Pause slider on hover
    const container = document.getElementById('main-media-container');
    if (container) {
        container.addEventListener('mouseenter', stopAutoSlide);
        container.addEventListener('mouseleave', () => {
            if (!isVideoMain) startAutoSlide();
        });
    }

    // Drag-to-scroll for thumbnail strip
    initDragScroll();

    // Load more company games listener
    const loadMoreBtn = document.getElementById('load-more-company-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreCompanyGames);
    }

    // Recalculate status highlight on resize
    window.addEventListener('resize', () => {
        if (currentGame) updateStatusSelection(currentGame);
    });
});

function initDragScroll() {
    const slider = document.getElementById('screenshots-strip');
    if (!slider) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('active');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.classList.remove('active');
    });

    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.classList.remove('active');
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // Scroll-fastness
        slider.scrollLeft = scrollLeft - walk;
    });
}

function startAutoSlide() {
    stopAutoSlide(); // Ensure no duplicates
    if (screenshotUrls.length <= 1) return;

    slideInterval = setInterval(() => {
        if (isVideoMain) return; // Don't slide while video is active
        nextMedia();
    }, 5000);
}

function stopAutoSlide() {
    if (slideInterval) {
        clearInterval(slideInterval);
        slideInterval = null;
    }
}

function nextMedia() {
    if (isVideoMain && currentGame.trailerUrl) {
        // If coming from video, go to first image
        setMainMedia(screenshotUrls[0], 0);
    } else {
        currentMediaIndex = (currentMediaIndex + 1) % screenshotUrls.length;
        setMainMedia(screenshotUrls[currentMediaIndex], currentMediaIndex);
    }
}

function prevMedia() {
    if (isVideoMain && currentGame.trailerUrl) {
        // If coming from video, go to last image
        setMainMedia(screenshotUrls[screenshotUrls.length - 1], screenshotUrls.length - 1);
    } else {
        currentMediaIndex = (currentMediaIndex - 1 + screenshotUrls.length) % screenshotUrls.length;
        setMainMedia(screenshotUrls[currentMediaIndex], currentMediaIndex);
    }
}

async function populateSidebarUser() {
    try {
        const userInfo = getUserInfo();
        if (!userInfo) return;

        const avatarEls = document.querySelectorAll('#display-avatar, #display-avatar-header');
        const usernameEls = document.querySelectorAll('#display-username, #welcome-username');

        usernameEls.forEach(el => el.textContent = userInfo.userName || 'User');
        avatarEls.forEach(el => {
            const initial = userInfo.userName ? userInfo.userName.charAt(0).toUpperCase() : 'U';
            el.innerHTML = `<span class="text-sm font-bold text-white uppercase">${initial}</span>`;
        });

        const res = await apiRequest('/api/Profile');
        if (res.ok) {
            const profile = await res.json();
            if (profile.displayName) {
                usernameEls.forEach(el => el.textContent = profile.displayName);
            }
            if (profile.avatarUrl) {
                avatarEls.forEach(el => {
                    el.innerHTML = `<img src="${API_URL}/Uploads/${profile.avatarUrl}" class="h-full w-full object-cover">`;
                    const parent = el.parentElement;
                    if (parent && (parent.classList.contains('bg-gradient-to-tr') || parent.classList.contains('from-primary'))) {
                        parent.classList.remove('bg-gradient-to-tr', 'from-primary', 'to-purple-500', 'to-purple-600');
                        parent.classList.add('bg-transparent');
                    }
                });
            } else if (profile.displayName) {
                avatarEls.forEach(el => {
                    const initial = profile.displayName.charAt(0).toUpperCase();
                    el.innerHTML = `<span class="text-sm font-bold text-white uppercase">${initial}</span>`;
                });
            }
        }
    } catch (_) { /* optional */ }
}

/* ──────────────────────────────────────────────
   Load & render game details
────────────────────────────────────────────── */
async function loadGameDetails(id) {
    try {
        const res = await apiRequest(`/api/Steam/catalog/${id}`);
        if (!res.ok) { showPageErrorState(); return; }

        currentGame = await res.json();
        renderGame(currentGame);
        loadCompanyGames(currentGame);

        // Fetch collection IDs for this game
        currentGame.collectionIds = await getGameCollectionIds(currentGame.id);
    } catch (err) {
        console.error('Game details load error:', err);
        showPageErrorState();
    }
}

/* ──────────────────────────────────────────────
   Company Games
────────────────────────────────────────────── */
async function loadCompanyGames(game) {
    const container = document.getElementById('similar-games-list');
    const heading = document.getElementById('company-games-heading');
    const moreContainer = document.getElementById('more-company-games-container');

    if (!container) return;

    // Pick developer first, fall back to publisher
    const company = game?.developers?.[0] || game?.publishers?.[0] || null;
    currentCompany = company;
    currentCompanyPage = 1;

    if (!company) {
        hideSimilarGames();
        if (moreContainer) moreContainer.classList.add('hidden');
        return;
    }

    // Update heading
    if (heading) heading.textContent = company;

    try {
        const res = await apiRequest(`/api/Steam/catalog/company?companyName=${encodeURIComponent(company)}&page=${currentCompanyPage}`);
        if (!res.ok) {
            container.innerHTML = '<p class="text-[11px] text-slate-600 italic">Could not load games.</p>';
            if (moreContainer) moreContainer.classList.add('hidden');
            return;
        }

        const data = (await res.json()) || [];
        // Filter out the current game
        const filtered = data.filter(g => g.externalId !== game.externalId);

        if (filtered.length === 0) {
            container.innerHTML = '<p class="text-[11px] text-slate-600 italic">No other games in the catalog yet.</p>';
            if (moreContainer) moreContainer.classList.add('hidden');
            return;
        }

        // Initially clear and show
        container.innerHTML = renderCompanyGameCards(filtered);

        // If we got 6, there might be more
        if (data.length === 6) {
            if (moreContainer) moreContainer.classList.remove('hidden');
        } else {
            if (moreContainer) moreContainer.classList.add('hidden');
        }

    } catch (err) {
        console.error('Company games error:', err);
        container.innerHTML = '<p class="text-[11px] text-slate-600 italic">Could not load games.</p>';
        if (moreContainer) moreContainer.classList.add('hidden');
    }
}

async function loadMoreCompanyGames() {
    if (!currentCompany) return;

    const container = document.getElementById('similar-games-list');
    const moreContainer = document.getElementById('more-company-games-container');
    const loadMoreBtn = document.getElementById('load-more-company-btn');

    if (!container) return;

    currentCompanyPage++;

    // Show loading state on button
    if (loadMoreBtn) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.innerHTML = '<span class="text-[10px] xirod-font tracking-widest font-black italic">LOADING...</span>';
    }

    try {
        const res = await apiRequest(`/api/Steam/catalog/company?companyName=${encodeURIComponent(currentCompany)}&page=${currentCompanyPage}`);
        if (!res.ok) throw new Error('Failed to fetch more games');

        const data = (await res.json()) || [];
        // Filter out current game if it accidentally appears
        const filtered = data.filter(g => g.externalId !== currentGame?.externalId);

        if (filtered.length > 0) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderCompanyGameCards(filtered);
            while (tempDiv.firstChild) {
                container.appendChild(tempDiv.firstChild);
            }
        }

        // If we got less than 6 (page size), we've reached the end
        if (data.length < 6) {
            if (moreContainer) moreContainer.classList.add('hidden');
        } else {
            if (moreContainer) moreContainer.classList.remove('hidden');
        }

    } catch (err) {
        console.error('Load more error:', err);
        showToast('Could not load more games', 'error');
    } finally {
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.innerHTML = `
                <span class="text-[10px] xirod-font tracking-widest font-black italic">MORE</span>
                <span class="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">arrow_forward</span>
            `;
        }
    }
}

function renderCompanyGameCards(games) {
    return games.map(g => {
        const rating = g.rating > 0 ? `<span class="text-yellow-400">★</span> ${g.rating.toFixed(1)}` : '';
        const genre = g.genres?.[0] ?? '';
        const meta = [genre, rating].filter(Boolean).join(' · ');
        return `
        <a href="game-details.html?id=${g.externalId}"
           class="flex gap-3 items-center group/sim hover:bg-white/5 rounded-xl p-1.5 -mx-1.5 transition-colors no-underline">
            <div class="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
                <img src="${g.imageUrl || ''}" alt="${escapeHtml(g.title)}"
                     class="w-full h-full object-cover group-hover/sim:scale-105 transition-transform duration-300"
                     onerror="this.parentElement.classList.add('flex','items-center','justify-center');this.style.display='none'">
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-slate-200 group-hover/sim:text-primary transition-colors truncate leading-snug">${escapeHtml(g.title)}</p>
                ${meta ? `<p class="text-[10px] text-slate-500 mt-0.5">${meta}</p>` : ''}
            </div>
            <span class="material-symbols-outlined text-[16px] text-slate-700 group-hover/sim:text-primary transition-colors flex-shrink-0">chevron_right</span>
        </a>`;
    }).join('');
}

function hideSimilarGames() {
    const card = document.getElementById('similar-games-card');
    if (card) card.classList.add('hidden');
}

function getPosterCandidates(g) {
    return [
        g.posterImage,
        g.backgroundImage,
        g.backgroundImageAdditional,
        g.imageUrl,
        g.imgUrl,
        '../../Assets/Images/default-game.jpg'
    ].filter(Boolean);
}

function setBestPosterImage(imgEl, candidates) {
    if (!imgEl || !candidates.length) return;

    let index = 0;
    imgEl.src = candidates[index];
    imgEl.onerror = () => {
        index += 1;
        if (index < candidates.length) {
            imgEl.src = candidates[index];
        }
    };
}

function renderGame(g) {
    // ── Page title & header ──────────────────
    document.title = `${g.title} – N3M|Nest`;

    // Reset slide state
    stopAutoSlide();
    screenshotUrls = g.screenshots || [];

    // ── Hero background ──────────────────────
    if (g.backgroundImage) {
        const bgImg = document.getElementById('hero-bg-img');
        if (bgImg) bgImg.src = g.backgroundImage;
    }

    // ── Sidebar Poster ───────────────────────
    const sidePoster = document.getElementById('game-side-poster');
    if (sidePoster) {
        setBestPosterImage(sidePoster, getPosterCandidates(g));
        sidePoster.alt = g.title;
    }

    // ── Main Titles ──────────────────────────
    setText('game-title', g.title);

    // ── Meta info ───────────────────────────

    if (g.releaseDate) {
        setText('game-release', formatDate(g.releaseDate));
    }

    // ── Sidebar details ─────────────────────
    setText('val-developer', g.developers?.[0] || 'Unknown');
    setText('val-publisher', g.publishers?.[0] || 'Unknown');
    setText('val-metascore', g.metacritic || 'N/A');

    // ── Achievements ──────────────────────────
    const achContainer = document.getElementById('achievements-container');
    const achVal = document.getElementById('val-achievements');
    if (achContainer && achVal) {
        if (g.achievementsCount != null && g.achievementsCount > 0) {
            achVal.textContent = g.achievementsCount;
            achContainer.classList.remove('hidden');
        } else {
            achContainer.classList.add('hidden');
        }
    }

    // ── Price ────────────────────────────────
    const priceEl = document.getElementById('val-price');
    if (priceEl) {
        if (g.price === 0) {
            priceEl.textContent = 'Free to Play';
            priceEl.className = 'font-black text-sm text-primary';
            priceEl.style.textShadow = '0 0 10px rgba(74,125,255,0.5)';
        } else if (g.price != null) {
            priceEl.textContent = `$${g.price.toFixed(2)}`;
        } else {
            // No price data: hide the whole row
            const priceRow = priceEl.closest('.flex.justify-between');
            if (priceRow) priceRow.classList.add('hidden');
        }
    }

    // ── Platforms icons ─────────────────────
    const platIcons = document.getElementById('platforms-icons');
    if (platIcons && g.platforms) {
        platIcons.innerHTML = g.platforms.map(p => getPlatformIcon(p)).join('');
    }

    // ── About / Description ─────────────────
    const descEl = document.getElementById('game-description');
    if (descEl) {
        descEl.innerHTML = g.description ? g.description.split('\n\n').map(p => `<p class="mb-4">${p}</p>`).join('') : 'No description available.';
    }

    // ── Screenshots & Video Strip ───────────
    renderMediaStrip(g);

    // Initial Main Media ──────────────────
    if (g.trailerUrl) {
        setMainVideo(g);
    } else if (screenshotUrls.length > 0) {
        setMainMedia(screenshotUrls[0], 0);
        startAutoSlide();
    }

    // ── Requirements ────────────────────────
    renderRequirements(g);

    // ── Action buttons ───────────────────────
    updateActionButtons(g);

    // ── Website link ─────────────────────────
    const webBtn = document.getElementById('btn-website');
    if (webBtn) {
        if (g.website) {
            webBtn.href = g.website;
            webBtn.classList.remove('hidden');
        } else {
            webBtn.classList.add('hidden');
        }
    }

    // ── Tags/Genres ─────────────────────────
    const tagsRow = document.getElementById('genres-row');
    if (tagsRow && g.genres) {
        tagsRow.innerHTML = g.genres.map(genre => `<span class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-primary transition-all cursor-pointer">${genre}</span>`).join('');
    }

    // ── Reviews ──────────────────────────────
    loadReviews(g.externalId);

    // ── Show page ────────────────────────────
    const skeleton = document.getElementById('loading-skeleton');
    if (skeleton) skeleton.classList.add('hidden');
    const content = document.getElementById('page-content'); // In case it's still used
    if (content) content.classList.remove('hidden');
}

function renderMediaStrip(g) {
    const strip = document.getElementById('screenshots-strip');
    if (!strip) return;

    let html = '';

    // 1. Add Video Square first
    if (g.trailerUrl) {
        html += `
            <div id="thumb-video" class="video-thumb group active" onclick="setMainVideo(null)">
                <img src="${g.trailerPreview || g.backgroundImage}" alt="Trailer">
                <div class="absolute inset-0 bg-primary/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="material-symbols-outlined text-white text-3xl">play_circle</span>
                </div>
            </div>
        `;
    }

    // 2. Add Screenshot Squares
    if (g.screenshots?.length) {
        html += g.screenshots.map((url, i) => `
            <div id="thumb-img-${i}" class="screenshot-thumb group" onclick="setMainMedia('${url}', ${i})">
                <img src="${url}" alt="Screenshot ${i + 1}">
                <div class="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span class="material-symbols-outlined text-white">zoom_in</span>
                </div>
            </div>
        `).join('');
    }

    strip.innerHTML = html;
}

function setMainVideo(g = null) {
    isVideoMain = true;
    stopAutoSlide();

    const game = g || currentGame; // Use current if g not provided
    const placeholder = document.getElementById('main-media-placeholder');
    const trailer = document.getElementById('main-trailer');
    const playBtn = document.getElementById('play-btn');
    const label = document.getElementById('media-label');
    const title = document.getElementById('media-title');

    // Trigger animation
    trailer.classList.remove('fade-in-media');
    void trailer.offsetWidth; // Reflow
    trailer.classList.add('fade-in-media');

    // Update UI highlights
    document.querySelectorAll('.screenshot-thumb, .video-thumb').forEach(t => t.classList.remove('active'));
    document.getElementById('thumb-video')?.classList.add('active');

    placeholder.classList.add('hidden');
    trailer.classList.remove('hidden');
    playBtn.classList.remove('hidden');

    if (trailer.src !== game.trailerUrl) {
        trailer.src = game.trailerUrl;
        trailer.poster = game.trailerPreview || game.backgroundImage;
    }

    if (label) label.textContent = "Official Trailer";
    if (title) title.textContent = "Cinematic Experience";

    // Seek bar starts hidden — click video to toggle
    const videoControls = document.getElementById('video-controls');
    if (videoControls) videoControls.classList.add('hidden');

    // Toggle seek bar on video click
    trailer.onclick = () => {
        if (videoControls) videoControls.classList.toggle('hidden');
    };

    // Wire up time events (remove old listeners first to avoid stacking)
    trailer.removeEventListener('timeupdate', updateVideoProgress);
    trailer.removeEventListener('loadedmetadata', updateVideoMeta);
    trailer.addEventListener('timeupdate', updateVideoProgress);
    trailer.addEventListener('loadedmetadata', updateVideoMeta);
    if (trailer.readyState >= 1) updateVideoMeta(); // already loaded

    // Seek bar click + drag (stop propagation so it doesn't toggle visibility)
    const seekBar = document.getElementById('video-seek-bar');
    if (seekBar) {
        seekBar.onmousedown = (e) => {
            e.stopPropagation();
            const seek = (ev) => {
                const rect = seekBar.getBoundingClientRect();
                const pct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
                if (trailer.duration) trailer.currentTime = pct * trailer.duration;
            };
            seek(e);
            const onMove = (ev) => seek(ev);
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
    }

    playBtn.onclick = () => {
        if (trailer.paused) {
            trailer.play();
            playBtn.innerHTML = '<span class="material-symbols-outlined text-4xl fill-icon">pause</span>';
        } else {
            trailer.pause();
            playBtn.innerHTML = '<span class="material-symbols-outlined text-4xl fill-icon">play_arrow</span>';
        }
    };
}

function setMainMedia(url, index) {
    isVideoMain = false;
    currentMediaIndex = index;

    const placeholder = document.getElementById('main-media-placeholder');
    const trailer = document.getElementById('main-trailer');
    const playBtn = document.getElementById('play-btn');
    const label = document.getElementById('media-label');
    const title = document.getElementById('media-title');

    // Trigger animation
    placeholder.classList.remove('fade-in-media');
    void placeholder.offsetWidth; // Reflow
    placeholder.classList.add('fade-in-media');

    // Update UI highlights
    document.querySelectorAll('.screenshot-thumb, .video-thumb').forEach(t => t.classList.remove('active'));
    document.getElementById(`thumb-img-${index}`)?.classList.add('active');

    trailer.classList.add('hidden');
    trailer.pause();
    placeholder.src = url;
    placeholder.classList.remove('hidden');
    playBtn.classList.add('hidden');

    // Hide seek bar
    const videoControls = document.getElementById('video-controls');
    if (videoControls) videoControls.classList.add('hidden');

    if (label) label.textContent = `Screenshot ${index + 1}`;
    if (title) title.textContent = `Gallery Preview`;

    // Resume auto-slide after selecting manually
    startAutoSlide();
}

function renderRequirements(g) {
    const minEl = document.getElementById('req-min');
    const recEl = document.getElementById('req-rec');

    if (g.minimumRequirements) {
        minEl.innerHTML = formatRequirements(g.minimumRequirements);
    }
    if (g.recommendedRequirements) {
        recEl.innerHTML = formatRequirements(g.recommendedRequirements);
    }
}

function formatRequirements(text) {
    if (!text) return 'Not specified for this platform.';

    // 1. Clean up common run-on words (systemOS -> System OS)
    let cleaned = text.replace(/([a-z])([A-Z])/g, '$1 $2');

    // 2. Define labels to break onto new lines
    const labels = [
        'Minimum:', 'Recommended:', 'OS:', 'Processor:', 'Memory:',
        'Graphics:', 'DirectX:', 'Storage:', 'Sound Card:',
        'Additional Notes:', 'Network:', 'Display:'
    ];

    let formatted = cleaned;

    // 3. Inject <br> and <strong> tags for labels
    labels.forEach(label => {
        const regex = new RegExp(`(^|\\s|\\(|\\)|;|,)${label}`, 'gi');
        formatted = formatted.replace(regex, (match, p1) => {
            // If it's the very start or if it follows a break, don't add extra space
            return `<div class="mt-2"><strong class="text-slate-300">${label}</strong> `;
        });
    });

    // 4. Close any opened divs (simple heuristic)
    formatted = formatted.split('<div class="mt-2">').join('</div><div class="mt-1">');
    // Actually, just using simple line breaks is cleaner for this layout.

    // Let's stick to clean bullet-like formatting
    let finalHtml = '';
    const parts = cleaned.split(/(?=Minimum:|Recommended:|OS:|Processor:|Memory:|Graphics:|DirectX:|Storage:|Sound Card:|Additional Notes:|Network:|Display:)/i);

    parts.forEach(part => {
        if (!part.trim()) return;
        const matchedLabel = labels.find(l => part.toLowerCase().startsWith(l.toLowerCase()));
        if (matchedLabel) {
            const content = part.substring(matchedLabel.length).trim();
            finalHtml += `<div class="flex flex-col mb-2">
                <span class="text-[10px] font-black uppercase tracking-widest text-primary/70">${matchedLabel.replace(':', '')}</span>
                <span class="text-slate-300 font-medium">${content.replace(/^:/, '').trim()}</span>
            </div>`;
        } else {
            finalHtml += `<div class="mb-2 text-slate-400 font-medium">${part.trim()}</div>`;
        }
    });

    return finalHtml || text;
}

/* ──────────────────────────────────────────────
   Platform row (hero)
────────────────────────────────────────────── */
function renderPlatformRow(platforms) {
    const row = document.getElementById('platforms-row');
    if (!row || !platforms?.length) return;
    row.innerHTML = platforms.map(p => `
        <span class="platform-chip">
            ${getPlatformIcon(p)}
            <span>${p}</span>
        </span>`).join('');
}

function getPlatformIcon(name) {
    const n = name.toLowerCase();
    if (n.includes('pc') || n.includes('windows')) return `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1V11.7H0V3.449zm0 17.1L9.75 21.9V12.3H0v8.249zM10.5 1.95L24 0v11.7H10.5V1.95zm0 20.1L24 24V12.3H10.5v9.75z"/></svg>`;
    if (n.includes('playstation')) return `<i class="fab fa-playstation text-xs"></i>`;
    if (n.includes('xbox')) return `<i class="fab fa-xbox text-xs"></i>`;
    if (n.includes('nintendo') || n.includes('switch')) return `<i class="bi bi-nintendo-switch text-xs"></i>`;
    if (n.includes('mac') || n.includes('apple') || n.includes('ios')) return `<i class="fab fa-apple text-xs"></i>`;
    if (n.includes('linux')) return `<i class="fab fa-linux text-xs"></i>`;
    if (n.includes('android')) return `<i class="fab fa-android text-xs"></i>`;
    return `<span class="material-symbols-outlined text-[13px]">devices</span>`;
}

/* ──────────────────────────────────────────────
   Genres row (hero)
────────────────────────────────────────────── */
function renderGenresRow(genres) {
    const row = document.getElementById('genres-row');
    if (!row || !genres?.length) return;
    row.innerHTML = genres.map(g => `<span class="genre-chip">${g}</span>`).join('');
}

/* ──────────────────────────────────────────────
   Description (About tab)
────────────────────────────────────────────── */
function renderDescription(description) {
    const el = document.getElementById('game-description');
    const readMoreBtn = document.getElementById('desc-read-more');
    if (!el) return;

    if (!description) {
        el.innerHTML = '<p class="text-slate-500 italic">No description available.</p>';
        return;
    }

    // Convert newlines to paragraphs
    const paragraphs = description.split(/\n\n+/).filter(p => p.trim());
    el.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');

    // If long, collapse
    if (el.scrollHeight > 240 && readMoreBtn) {
        el.classList.add('collapsed');
        readMoreBtn.classList.remove('hidden');
    }
}

function expandDescription() {
    const el = document.getElementById('game-description');
    const btn = document.getElementById('desc-read-more');
    if (!el) return;
    el.classList.remove('collapsed');
    if (btn) btn.classList.add('hidden');
    descriptionExpanded = true;
}

/* ──────────────────────────────────────────────
   Media tab
────────────────────────────────────────────── */
function renderMedia(g) {
    let hasMedia = false;

    // Trailer
    if (g.trailerUrl) {
        hasMedia = true;
        showEl('trailer-section');
        const source = document.getElementById('trailer-source');
        const poster = document.getElementById('trailer-poster-img');
        if (source) source.src = g.trailerUrl;
        if (poster && g.trailerPreview) poster.src = g.trailerPreview;
        if (poster && !g.trailerPreview && g.backgroundImageAdditional) poster.src = g.backgroundImageAdditional;
    }

    // Screenshots
    if (g.screenshots?.length) {
        hasMedia = true;
        screenshotUrls = g.screenshots;
        showEl('screenshots-section');
        const count = document.getElementById('screenshots-count');
        if (count) count.textContent = `(${g.screenshots.length})`;
        const grid = document.getElementById('screenshots-grid');
        if (grid) {
            grid.innerHTML = g.screenshots.map((url, i) => `
                <img src="${url}" alt="Screenshot ${i + 1}" 
                     loading="lazy" 
                     onclick="openLightbox(${i})"
                     onerror="this.parentElement?.remove()"/>`).join('');
        }
    }

    if (!hasMedia) {
        showEl('no-media');
    }
}

/* ──────────────────────────────────────────────
   Details tab
────────────────────────────────────────────── */
function renderDetails(g) {
    renderChips('developers-list', g.developers, 'developer-chip', 'detail-developers');
    renderChips('publishers-list', g.publishers, 'publisher-chip', 'detail-publishers');
    renderChips('genres-detail-list', g.genres, 'genre-chip', 'detail-genres');
    renderChips('platforms-detail-list', g.platforms, 'platform-chip', 'detail-platforms');
    renderChips('tags-list', g.tags, 'tag-chip', 'detail-tags');
}

function renderChips(listId, items, chipClass, cardId) {
    const list = document.getElementById(listId);
    const card = document.getElementById(cardId);
    if (!list || !items?.length) return;
    list.innerHTML = items.map(item => `<span class="${chipClass}">${escapeHtml(item)}</span>`).join('');
    if (card) card.classList.remove('hidden');
}

/* ──────────────────────────────────────────────
   Action Buttons — Library / Favorites / Wishlist
────────────────────────────────────────────── */
function updateActionButtons(g) {
    updateLibraryBtn(g.isInLibrary);
    updateFavoriteBtn(g.isFavorite);
    updateWishlistBtn(g.isInWishlist);
    applyMutualExclusionRules(g);
    updateStatusSelection(g);
}

function updateStatusSelection(g) {
    const container = document.getElementById('status-selection-container');
    const highlight = document.getElementById('status-selection-highlight');
    if (!container) return;

    if (g.isInLibrary) {
        container.classList.remove('hidden');

        const rawStatus = g.gamestatus ? String(g.gamestatus).toLowerCase() : '';
        const statusMap = {
            '1': 1, 'playing': 1,
            '3': 3, 'completed': 3,
            '4': 4, 'dropped': 4,
            '5': 5, 'onhold': 5, 'on hold': 5,
            '6': 6, 'pending': 6, 'to play': 6
        };
        const activeId = statusMap[rawStatus];

        [1, 3, 4, 5, 6].forEach(id => {
            const btn = document.getElementById(`status-btn-${id}`);
            if (btn) {
                // Ensure the button itself doesn't have a background (since highlight moves behind it)
                btn.classList.remove('bg-white/10', 'ring-1', 'ring-white/10');

                const icon = btn.querySelector('.material-symbols-outlined');
                if (id === activeId) {
                    // Update highlight position
                    if (highlight) {
                        highlight.classList.remove('hidden');
                        highlight.style.width = `${btn.offsetWidth}px`;
                        highlight.style.height = `${btn.offsetHeight}px`;
                        highlight.style.left = `${btn.offsetLeft}px`;
                        highlight.style.top = `${btn.offsetTop}px`;
                    }
                    if (icon) {
                        icon.classList.add('fill-icon');
                        icon.style.opacity = '1';
                        icon.style.transform = 'scale(1.1)';
                    }
                } else {
                    if (icon) {
                        icon.classList.remove('fill-icon');
                        icon.style.opacity = '0.4';
                        icon.style.transform = 'scale(1)';
                    }
                }
            }
        });

        if (!activeId && highlight) {
            highlight.classList.add('hidden');
        }
    } else {
        container.classList.add('hidden');
    }
}

async function changeStatus(statusId) {
    if (!currentGame) return;

    const originalStatus = currentGame.gamestatus;

    // Optimistic UI
    currentGame.gamestatus = statusId;
    updateStatusSelection(currentGame);

    try {
        const res = await apiRequest(`/api/UserGames/UpdateUserGame`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId: parseInt(currentGame.externalId),
                gamestatus: statusId
            })
        });

        if (res.ok) {
            const statusLabels = { 1: 'Playing', 3: 'Completed', 4: 'Dropped', 5: 'On Hold', 6: 'Pending' };
            showToast(`Status updated to "${statusLabels[statusId]}"!`, `status-${statusId}`);
        } else {
            // Revert
            currentGame.gamestatus = originalStatus;
            updateStatusSelection(currentGame);
            showToast('Failed to update status', 'error');
        }
    } catch (err) {
        console.error('Status update error:', err);
        currentGame.gamestatus = originalStatus;
        updateStatusSelection(currentGame);
        showToast('Something went wrong', 'error');
    }
}

function updateLibraryBtn(inLibrary) {
    const btn = document.getElementById('btn-library');
    const label = document.getElementById('btn-library-label');
    const icon = document.getElementById('library-icon');
    if (!btn || !label) return;
    if (inLibrary) {
        btn.classList.add('active');
        label.textContent = 'In Library';
        if (icon) icon.textContent = 'library_add_check';
    } else {
        btn.classList.remove('active');
        label.textContent = 'Add to Library';
        if (icon) icon.textContent = 'add_to_photos';
    }
}

function updateFavoriteBtn(isFav) {
    const btn = document.getElementById('btn-favorite');
    const label = document.getElementById('btn-favorite-label');
    const icon = document.getElementById('fav-icon');
    if (!btn || !label) return;
    if (isFav) {
        btn.classList.add('active');
        label.textContent = 'Favorited';
    } else {
        btn.classList.remove('active');
        label.textContent = 'Like';
    }
}

function updateWishlistBtn(inWishlist) {
    const btn = document.getElementById('btn-wishlist');
    const label = document.getElementById('btn-wishlist-label');
    if (!btn || !label) return;
    if (inWishlist) {
        btn.classList.add('active');
        label.textContent = 'Wishlisted';
    } else {
        btn.classList.remove('active');
        label.textContent = 'Wishlist';
    }
}

function applyMutualExclusionRules(g) {
    const libBtn = document.getElementById('btn-library');
    const favBtn = document.getElementById('btn-favorite');
    const wishBtn = document.getElementById('btn-wishlist');

    // Wishlist is mutually exclusive from Library + Favorites
    if (g.isInWishlist) {
        if (libBtn) { libBtn.classList.add('disabled'); libBtn.disabled = true; libBtn.title = 'Remove from Wishlist first'; }
        if (favBtn) { favBtn.classList.add('disabled'); favBtn.disabled = true; favBtn.title = 'Remove from Wishlist first'; }
    } else {
        if (libBtn) { libBtn.classList.remove('disabled'); libBtn.disabled = false; libBtn.title = ''; }
        if (favBtn) { favBtn.classList.remove('disabled'); favBtn.disabled = false; favBtn.title = ''; }
    }

    if (g.isFavorite || g.isInLibrary) {
        if (wishBtn) { wishBtn.classList.add('disabled'); wishBtn.disabled = true; wishBtn.title = 'Remove from Library/Favorites first'; }
    } else {
        if (wishBtn) { wishBtn.classList.remove('disabled'); wishBtn.disabled = false; wishBtn.title = ''; }
    }
}

/* Toggle handlers */
async function toggleLibrary() {
    if (!currentGame) return;
    try {
        const res = await apiRequest(`/api/Steam/catalog/library/${currentGame.externalId}`, { method: 'POST' });
        if (!res.ok) { showToast('Could not update library', 'error'); return; }
        const data = await res.json();
        currentGame.isInLibrary = data.added;
        if (data.added && !currentGame.gamestatus) {
            currentGame.gamestatus = 6; // Default to Pending/To Play
        } else if (!data.added) {
            currentGame.gamestatus = null;
        }
        updateStatusSelection(currentGame);
        updateLibraryBtn(data.added);
        applyMutualExclusionRules(currentGame);
        animateBtnIcon('btn-library');
        showToast(data.added ? 'Added to your Library!' : 'Removed from Library', data.added ? 'success' : 'info');
    } catch {
        showToast('Something went wrong', 'error');
    }
}

async function toggleFavorite() {
    if (!currentGame) return;
    try {
        const res = await apiRequest(`/api/Steam/catalog/favorite/${currentGame.externalId}`, { method: 'POST' });
        if (!res.ok) { showToast('Could not update favorites', 'error'); return; }
        const data = await res.json();
        currentGame.isFavorite = data.isFavorite;
        updateFavoriteBtn(data.isFavorite);
        applyMutualExclusionRules(currentGame);
        animateBtnIcon('btn-favorite');
        showToast(data.isFavorite ? 'Added to Favorites!' : 'Removed from Favorites', data.isFavorite ? 'success' : 'info');
    } catch {
        showToast('Something went wrong', 'error');
    }
}

async function toggleWishlist() {
    if (!currentGame) return;
    try {
        const res = await apiRequest(`/api/Steam/catalog/wishlist/${currentGame.externalId}`, { method: 'POST' });
        if (!res.ok) { showToast('Could not update wishlist', 'error'); return; }
        const data = await res.json();
        currentGame.isInWishlist = data.added;
        updateWishlistBtn(data.added);
        applyMutualExclusionRules(currentGame);
        animateBtnIcon('btn-wishlist');
        showToast(data.added ? 'Added to Wishlist!' : 'Removed from Wishlist', data.added ? 'success' : 'info');
    } catch {
        showToast('Something went wrong', 'error');
    }
}

function animateBtnIcon(btnId) {
    const btn = document.getElementById(btnId);
    const icon = btn?.querySelector('.material-symbols-outlined');
    if (!icon) return;
    icon.classList.add('animate-pop');
    icon.addEventListener('animationend', () => icon.classList.remove('animate-pop'), { once: true });
}

/* ──────────────────────────────────────────────
   Tab switching
────────────────────────────────────────────── */
function switchTab(tab) {
    const tabs = ['about', 'media', 'details'];
    tabs.forEach(t => {
        document.getElementById(`tab-${t}`)?.classList.remove('active-tab');
        const panel = document.getElementById(`panel-${t}`);
        if (panel) panel.classList.add('hidden');
    });
    document.getElementById(`tab-${tab}`)?.classList.add('active-tab');
    document.getElementById(`panel-${tab}`)?.classList.remove('hidden');
}

/* ──────────────────────────────────────────────
   Video seek bar helpers
────────────────────────────────────────────── */
function formatVideoTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateVideoProgress() {
    const trailer = document.getElementById('main-trailer');
    const fill = document.getElementById('video-seek-fill');
    const currentEl = document.getElementById('video-current-time');
    if (!trailer || !fill) return;
    const pct = trailer.duration ? (trailer.currentTime / trailer.duration) * 100 : 0;
    fill.style.width = pct + '%';
    if (currentEl) currentEl.textContent = formatVideoTime(trailer.currentTime);
}

function updateVideoMeta() {
    const trailer = document.getElementById('main-trailer');
    const totalEl = document.getElementById('video-total-time');
    if (!trailer || !totalEl) return;
    totalEl.textContent = formatVideoTime(trailer.duration);
}

/* ──────────────────────────────────────────────
   Trailer
────────────────────────────────────────────── */
function playTrailer() {
    const overlay = document.getElementById('trailer-poster-overlay');
    const video = document.getElementById('trailer-video');
    if (overlay) overlay.classList.add('hidden-overlay');
    if (video) {
        video.play();
    }
}

/* ──────────────────────────────────────────────
   Lightbox
────────────────────────────────────────────── */
function openLightbox(index) {
    if (!screenshotUrls.length) return;
    currentLbIndex = index;
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const counter = document.getElementById('lightbox-counter');
    if (!lb || !img) return;
    img.src = screenshotUrls[index];
    if (counter) counter.textContent = `${index + 1} / ${screenshotUrls.length}`;
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.add('hidden');
    document.body.style.overflow = '';
}

function lbNavigate(direction) {
    const newIndex = (currentLbIndex + direction + screenshotUrls.length) % screenshotUrls.length;
    openLightbox(newIndex);
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightbox');
    if (!lb || lb.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') lbNavigate(1);
    if (e.key === 'ArrowLeft') lbNavigate(-1);
    if (e.key === 'Escape') closeLightbox();
});

/* ──────────────────────────────────────────────
   Toast notifications
────────────────────────────────────────────── */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
        'status-1': 'play_circle',
        'status-3': 'task_alt',
        'status-5': 'pause_circle',
        'status-4': 'do_not_disturb_on',
        'status-6': 'schedule'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined text-[18px] fill-icon">${icons[type] || 'info'}</span>
        <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3000);
}

/* ──────────────────────────────────────────────
   Utility
────────────────────────────────────────────── */
function showPageErrorState() {
    const skeleton = document.getElementById('loading-skeleton');
    const err = document.getElementById('error-state');
    if (skeleton) skeleton.classList.add('hidden');
    if (err) err.classList.remove('hidden');
}

function hideSkeleton() {
    const skeleton = document.getElementById('loading-skeleton');
    if (skeleton) skeleton.classList.add('hidden');
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
}

function showEl(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ──────────────────────────────────────────────
   Reviews
────────────────────────────────────────────── */
async function loadReviews(externalId) {
    try {
        const res = await apiRequest(`/api/Reviews/GetAllReviews?ExternalId=${externalId}`);
        if (!res.ok) return;
        const reviews = await res.json();

        // Fetch the current user's friends so we can badge them in reviews
        let friendUsernames = new Set();
        try {
            const me = getUserInfo()?.userName;
            if (me) {
                const fr = await apiRequest(`/api/Friendship/friends/${encodeURIComponent(me)}`);
                if (fr.ok) {
                    const friends = await fr.json();
                    friends.forEach(f => {
                        if (f.username) friendUsernames.add(f.username.toLowerCase());
                    });
                }
            }
        } catch (_) { /* non-critical */ }

        renderReviews(reviews, friendUsernames);
    } catch (err) {
        console.error('Failed to load reviews:', err);
    }
}

function renderReviews(reviews, friendUsernames = new Set()) {
    const list = document.getElementById('reviews-list');
    const empty = document.getElementById('reviews-empty');
    if (!list) return;

    if (!reviews || reviews.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    const currentUser = getUserInfo()?.userName;

    const html = reviews.map(r => {
        const stars = Array.from({ length: 5 }, (_, i) =>
            `<span class="material-symbols-outlined text-base ${i < Math.round(r.rating) ? 'text-yellow-400 fill-icon' : 'text-slate-700'}">star</span>`
        ).join('');

        const avatar = r.imageUrl
            ? `<img src="${API_URL}/Uploads/${r.imageUrl}" class="w-full h-full object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <span style="display:none" class="w-full h-full flex items-center justify-center text-white font-bold">${r.userName?.charAt(0).toUpperCase() || 'U'}</span>`
            : `<span class="text-white font-bold text-sm">${r.userName?.charAt(0).toUpperCase() || 'U'}</span>`;

        const date = new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        const commentEscaped = (r.comment || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const isOwn = currentUser && r.userName === currentUser;
        const isFriend = !isOwn && friendUsernames.has((r.userName || '').toLowerCase());
        const actionBtns = isOwn ? `
            <span class="mx-1.5 text-slate-700">·</span>
            <button onclick="editReview(${r.reviewId}, ${r.rating}, '${commentEscaped}')"
                class="text-[10px] text-slate-500 hover:text-primary flex items-center gap-0.5 transition-colors">
                <span class="material-symbols-outlined text-[12px]">edit</span>Edit
            </button>
            <span class="mx-1 text-slate-700">·</span>
            <button onclick="deleteReview(${r.reviewId})"
                class="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-0.5 transition-colors">
                <span class="material-symbols-outlined text-[12px]">delete</span>Delete
            </button>` : '';

        const profileUrl = `../../Profile/Html/profile.html?user=${encodeURIComponent(r.userName || '')}`;

        return `
        <div id="review-card-${r.reviewId}" class="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <a href="${profileUrl}" class="flex-shrink-0 group/user hover:opacity-80 transition-opacity no-underline">
                        <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center overflow-hidden ring-2 ring-transparent group-hover/user:ring-primary/40 transition-all">
                            ${avatar}
                        </div>
                    </a>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-0 flex-wrap">
                            <a href="${profileUrl}" class="text-sm font-bold text-white xirod-font hover:text-primary transition-colors no-underline">${escapeHtml(r.userName || 'Anonymous')}</a>
                            ${isFriend ? `<span class="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/25 text-primary text-[9px] xirod-font" title="Friend"><span class="material-symbols-outlined text-[11px] fill-icon">group</span>FRIEND</span>` : ''}
                            ${actionBtns}
                        </div>
                        <p class="text-[10px] text-slate-500">${date}</p>
                    </div>
                </div>
                <div class="flex items-center gap-0.5">${stars}</div>
            </div>
            ${r.comment ? `<p class="text-sm text-slate-400 leading-relaxed">${escapeHtml(r.comment)}</p>` : ''}
            <div class="flex items-center gap-3 pt-1">
                <button id="like-btn-${r.reviewId}"
                    onclick="voteReview(${r.reviewId}, true)"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${r.userVote === true ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'bg-white/5 border border-white/10 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30'}">
                    <span class="material-symbols-outlined text-[14px] ${r.userVote === true ? 'fill-icon' : ''}">thumb_up</span>
                    <span id="like-count-${r.reviewId}">${r.likes || 0}</span>
                </button>
                <button id="dislike-btn-${r.reviewId}"
                    onclick="voteReview(${r.reviewId}, false)"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${r.userVote === false ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-white/5 border border-white/10 text-slate-500 hover:text-red-400 hover:border-red-500/30'}">
                    <span class="material-symbols-outlined text-[14px] ${r.userVote === false ? 'fill-icon' : ''}">thumb_down</span>
                    <span id="dislike-count-${r.reviewId}">${r.dislikes || 0}</span>
                </button>
            </div>
        </div>`;
    }).join('');

    list.innerHTML = html;

    // Pre-fill the inline form with the current user's existing review so
    // partial edits (e.g. rating-only) never accidentally clear the comment.
    const ownReview = reviews.find(r => r.userName === currentUser);
    const btn = document.getElementById('review-submit-btn');
    if (ownReview) {
        setRating(ownReview.rating);
        const textarea = document.getElementById('review-comment');
        if (textarea && !textarea.value.trim()) textarea.value = ownReview.comment || '';
        if (btn) {
            btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">sync</span> Update Review';
            btn.className = 'btn-shimmer relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black uppercase tracking-widest hover:bg-amber-500/40 transition-all';
        }
    } else {
        if (btn) {
            btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">rate_review</span> Post Review';
            btn.className = 'btn-shimmer relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/40 transition-all';
        }
    }
}

/* ── Review Voting ───────────────────────────────────────────── */
async function voteReview(reviewId, isLike) {
    if (!isLoggedIn()) {
        showToast('Please log in to vote on reviews', 'error');
        return;
    }

    // Determine the current vote state from button classes to support toggle
    const likeBtn = document.getElementById(`like-btn-${reviewId}`);
    const dislikeBtn = document.getElementById(`dislike-btn-${reviewId}`);
    const alreadyLiked = likeBtn && likeBtn.classList.contains('text-emerald-400');
    const alreadyDisliked = dislikeBtn && dislikeBtn.classList.contains('text-red-400');

    // Toggle logic: clicking the active button removes the vote
    let sendIsLike = isLike;
    if (isLike === true && alreadyLiked) sendIsLike = null;
    if (isLike === false && alreadyDisliked) sendIsLike = null;

    try {
        const res = await apiRequest('/api/Reviews/VoteReview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewId, isLike: sendIsLike })
        });

        if (!res.ok) {
            showToast('Failed to save vote', 'error');
            return;
        }

        const updated = await res.json();

        // Update counts
        const likeCount = document.getElementById(`like-count-${reviewId}`);
        const dislikeCount = document.getElementById(`dislike-count-${reviewId}`);
        if (likeCount) likeCount.textContent = updated.likes ?? 0;
        if (dislikeCount) dislikeCount.textContent = updated.dislikes ?? 0;

        // Update button styles
        if (likeBtn) {
            const active = updated.userVote === true;
            likeBtn.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${active
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : 'bg-white/5 border border-white/10 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30'
                }`;
            const icon = likeBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.className = `material-symbols-outlined text-[14px] ${active ? 'fill-icon' : ''}`;
        }

        if (dislikeBtn) {
            const active = updated.userVote === false;
            dislikeBtn.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${active
                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                : 'bg-white/5 border border-white/10 text-slate-500 hover:text-red-400 hover:border-red-500/30'
                }`;
            const icon = dislikeBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.className = `material-symbols-outlined text-[14px] ${active ? 'fill-icon' : ''}`;
        }

    } catch (err) {
        console.error('Vote error:', err);
        showToast('Failed to save vote', 'error');
    }
}

function _setStarClasses(containerSel, filledCount, hoverCount) {
    const labels = document.querySelectorAll(`${containerSel} label`);
    labels.forEach((label, i) => {
        label.classList.toggle('star-filled', i < filledCount);
        label.classList.toggle('star-hover', i < hoverCount);
    });
}

function _applyStarPicker(radioPrefix, val) {
    if (val > 0) {
        const radio = document.getElementById(`${radioPrefix}${val}`);
        if (radio) radio.checked = true;
    } else {
        for (let i = 1; i <= 5; i++) {
            const r = document.getElementById(`${radioPrefix}${i}`);
            if (r) r.checked = false;
        }
    }
}

function setRating(val) {
    currentRating = val;
    _applyStarPicker('rs', val);
    _setStarClasses('#star-picker', val, 0);
}

function previewRating(val) {
    // On hover show glow up to hovered star; keep filled stars as-is
    _setStarClasses('#star-picker', currentRating, val);
}

function setEditModalRating(val) {
    editModalRating = val;
    _applyStarPicker('ers', val);
    _setStarClasses('#edit-modal-stars', val, 0);
}

function previewEditModalRating(val) {
    _setStarClasses('#edit-modal-stars', editModalRating, val);
}

async function submitReview() {
    if (!currentGame) return;

    const comment = document.getElementById('review-comment')?.value.trim();
    if (currentRating === 0) {
        showToast('Please select a star rating first', 'error');
        return;
    }

    const dto = { externalId: currentGame.externalId, rating: currentRating, comment: comment || '' };

    try {
        const res = await apiRequest('/api/Reviews/CreateReview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        });

        if (!res.ok) {
            const err = await res.text();
            showToast(err || 'Failed to post review', 'error');
            return;
        }

        setRating(0);
        const textarea = document.getElementById('review-comment');
        if (textarea) textarea.value = '';
        showToast('Review posted!', 'success');
        loadReviews(currentGame.externalId);
    } catch (err) {
        console.error('Submit review error:', err);
        showToast('Something went wrong', 'error');
    }
}

function editReview(reviewId, rating, comment) {
    editingReviewId = reviewId;
    setEditModalRating(rating);
    const textarea = document.getElementById('edit-modal-comment');
    if (textarea) { textarea.value = comment; textarea.focus(); }
    document.getElementById('edit-modal')?.classList.remove('hidden');
}

function cancelEdit() {
    editingReviewId = null;
    editModalRating = 0;
    const textarea = document.getElementById('edit-modal-comment');
    if (textarea) textarea.value = '';
    setEditModalRating(0);
    document.getElementById('edit-modal')?.classList.add('hidden');
}

async function saveEditModal() {
    if (!editingReviewId) return;

    const comment = document.getElementById('edit-modal-comment')?.value.trim();
    if (editModalRating === 0) {
        showToast('Please select a star rating', 'error');
        return;
    }

    const dto = { reviewId: editingReviewId, rating: editModalRating, comment: comment || '' };

    try {
        const res = await apiRequest(`/api/Reviews/UpdateReview?ReviewId=${editingReviewId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        });

        if (!res.ok) {
            const err = await res.text();
            showToast(err || 'Failed to update review', 'error');
            return;
        }

        showToast('Review updated!', 'success');
        cancelEdit();
        loadReviews(currentGame.externalId);
    } catch (err) {
        console.error('Save edit error:', err);
        showToast('Something went wrong', 'error');
    }
}

/* ── Custom confirm dialog ───────────────────────────── */
let _confirmResolve = null;
function showConfirmModal() {
    return new Promise(resolve => {
        _confirmResolve = resolve;
        document.getElementById('confirm-modal')?.classList.remove('hidden');
    });
}
function confirmModalResolve() {
    document.getElementById('confirm-modal')?.classList.add('hidden');
    if (_confirmResolve) { _confirmResolve(true); _confirmResolve = null; }
}
function confirmModalReject() {
    document.getElementById('confirm-modal')?.classList.add('hidden');
    if (_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
}

async function deleteReview(reviewId) {
    const confirmed = await showConfirmModal();
    if (!confirmed) return;
    try {
        const res = await apiRequest(`/api/Reviews/DeleteReview?ReviewId=${reviewId}`, { method: 'DELETE' });
        if (!res.ok) {
            showToast('Failed to delete review', 'error');
            return;
        }
        // Remove card from DOM instantly — no reload needed
        const card = document.getElementById(`review-card-${reviewId}`);
        if (card) card.remove();
        // Show empty state if no cards left
        const list = document.getElementById('reviews-list');
        const empty = document.getElementById('reviews-empty');
        if (list && empty && list.children.length === 0) empty.classList.remove('hidden');
        if (editingReviewId === reviewId) cancelEdit();
        // Reset the inline form
        setRating(0);
        const textarea = document.getElementById('review-comment');
        if (textarea) textarea.value = '';
        const btn = document.getElementById('review-submit-btn');
        if (btn) {
            btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">rate_review</span> Post Review';
            btn.className = 'btn-shimmer relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/40 transition-all';
        }
        showToast('Review deleted', 'success');
    } catch (err) {
        console.error('Delete review error:', err);
        showToast('Something went wrong', 'error');
    }
}

let currentCollectionSelection = {}; // Map of { collectionId: boolean }

/* ──────────────────────────────────────────────
   Collections Logic
   ────────────────────────────────────────────── */

function openCollectionModal() {
    const modal = document.getElementById('collection-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Initialise state from current game
        currentCollectionSelection = {};
        const gameColIds = currentGame.collectionIds || [];
        gameColIds.forEach(id => {
            currentCollectionSelection[id] = true;
        });

        // Toggle button visibility with transitions
        const hasAnySelection = gameColIds.length > 0;
        const actions = document.getElementById('collection-modal-actions');
        if (actions) {
            if (hasAnySelection) {
                actions.classList.remove('hidden-action');
                actions.classList.add('show-action');
            } else {
                actions.classList.remove('show-action');
                actions.classList.add('hidden-action');
            }
        }

        loadCollections();
    }
}

function closeCollectionModal() {
    const modal = document.getElementById('collection-modal');
    if (modal) {
        modal.classList.add('hidden');
        const actions = document.getElementById('collection-modal-actions');
        if (actions) {
            actions.classList.remove('show-action');
            actions.classList.add('hidden-action');
        }
    }
}

async function loadCollections() {
    const container = document.getElementById('collections-list-container');
    if (!container) return;

    try {
        const collections = await getCollections();
        if (collections.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-slate-500">
                    <div class="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                        <span class="material-symbols-outlined text-3xl opacity-20">inventory_2</span>
                    </div>
                    <p class="text-[10px] uppercase font-black xirod-font tracking-widest text-slate-600">Empty Vault</p>
                </div>`;
            return;
        }

        container.innerHTML = collections.map(c => {
            const isChecked = !!currentCollectionSelection[c.id];
            return `
                <label class="flex items-center justify-between p-4 rounded-2xl bg-white/5 border ${isChecked ? 'border-accent/40 bg-accent/5' : 'border-white/5 hover:border-white/10'} transition-all duration-300 active:duration-75 cursor-pointer group mb-1 last:mb-0 active:scale-[0.96] active:bg-white/10 active:brightness-110">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl ${isChecked ? 'bg-accent text-slate-900 shadow-[0_0_20px_rgba(0,242,255,0.3)]' : 'bg-white/5 text-accent/40'} flex items-center justify-center transition-all duration-300 group-active:scale-90">
                            <span class="material-symbols-outlined text-[20px]">folder</span>
                        </div>
                        <div>
                            <p class="text-sm font-heading font-bold ${isChecked ? 'text-white' : 'text-slate-300'} group-hover:text-accent transition-colors">${escapeHtml(c.name)}</p>
                            <p class="text-[10px] font-heading font-medium text-slate-500 uppercase tracking-widest mt-0.5 opacity-60">${c.games?.length || 0} games</p>
                        </div>
                    </div>
                    <div class="relative flex items-center pr-1">
                        <input type="checkbox" class="hidden"
                            ${isChecked ? 'checked' : ''} 
                            onchange="updateCollectionChoice(${c.id}, this.checked)">
                        <div class="w-5 h-5 rounded-full border-2 ${isChecked ? 'bg-accent border-accent scale-110 shadow-[0_0_12px_rgba(0,242,255,0.4)]' : 'border-white/10'} flex items-center justify-center transition-all duration-300 group-active:scale-95">
                            ${isChecked ? '<span class="material-symbols-outlined text-slate-900 text-[14px] font-bold checkmark-animate">check</span>' : ''}
                        </div>
                    </div>
                </label>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = '<p class="text-[10px] text-red-400 p-4">Failed to load collections</p>';
    }
}

function updateCollectionChoice(collectionId, isChecked) {
    currentCollectionSelection[collectionId] = isChecked;

    // Refresh list to update UI
    loadCollections();

    // Toggle button with smooth transition helper
    const hasAnySelection = Object.values(currentCollectionSelection).some(v => v);
    const actions = document.getElementById('collection-modal-actions');
    if (actions) {
        if (hasAnySelection) {
            actions.classList.remove('hidden-action');
            actions.classList.add('show-action');
        } else {
            actions.classList.remove('show-action');
            actions.classList.add('hidden-action');
        }
    }
}

async function saveCollectionSelection() {
    if (!currentGame) return;

    const btn = document.querySelector('#collection-modal-actions button');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> SAVING...';
    }

    try {
        const initialSet = new Set(currentGame.collectionIds || []);
        const toAdd = Object.keys(currentCollectionSelection).filter(id => currentCollectionSelection[id] && !initialSet.has(Number(id)));
        const toRemove = Object.keys(currentCollectionSelection).filter(id => !currentCollectionSelection[id] && initialSet.has(Number(id)));

        // Perform requests
        const addPromises = toAdd.map(id => addGameToCollection(Number(id), currentGame.id));
        const removePromises = toRemove.map(id => removeGameFromCollection(Number(id), currentGame.id));

        await Promise.all([...addPromises, ...removePromises]);

        // Refresh game collection IDs
        currentGame.collectionIds = await getGameCollectionIds(currentGame.id);

        showToast('Collections updated!', 'success');
        closeCollectionModal();
    } catch (err) {
        console.error('Save collections error:', err);
        showToast('Some changes might have failed', 'error');
        // Refresh to show actual state
        currentGame.collectionIds = await getGameCollectionIds(currentGame.id);
        loadCollections();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> ADD TO COLLECTIONS';
        }
    }
}

async function handleCreateCollection() {
    const input = document.getElementById('new-collection-name');
    const name = input?.value?.trim();
    if (!name) return;

    try {
        const newCol = await createCollection(name);
        if (newCol) {
            input.value = '';
            showToast(`Collection "${name}" created!`, 'success');
            // If created, we want to select it automatically
            currentCollectionSelection[newCol.id] = true;
            loadCollections();

            const actions = document.getElementById('collection-modal-actions');
            if (actions) {
                actions.classList.remove('hidden-action');
                actions.classList.add('show-action');
            }
        } else {
            showToast('Failed to create collection', 'error');
        }
    } catch (err) {
        showToast('Something went wrong', 'error');
    }
}
