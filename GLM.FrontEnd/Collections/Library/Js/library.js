// Pagination state
let currentPage = 1;
let currentQuery = ''; // Store current search query
let currentGenre = ''; // Store current genre filter
let currentPlatform = ''; // Store current platform filter
let currentOrdering = ''; // Store current sorting/ordering
let currentRelease = ''; // Store current release year filter
let currentStatus = ''; // Store current game status filter
let gamesPerPage = 9999;
let allGames = [];
let rawUserGamesCache = null;
let currentCacheEndpoint = null;
let currentView = 'library';
let currentLibraryView = localStorage.getItem('libraryView') || 'grid';

// Toast Notification State
let activeToast = null;
let toastTimeout = null;

// Helper to add click animation
function animateButtonClick(btn) {
    btn.classList.add('animate-pop');

    // Real-time visual feedback
    const type = btn.dataset.btnType;
    const icon = btn.querySelector('.material-symbols-outlined');

    if (type === 'favorite') {
        const isActive = btn.classList.contains('text-red-500');
        if (isActive) {
            btn.classList.remove('text-red-500', 'btn-fav-active');
            btn.classList.add('text-white/70');
            if (icon) icon.classList.remove('fill-icon');
        } else {
            btn.classList.add('text-red-500', 'btn-fav-active');
            btn.classList.remove('text-white/70');
            if (icon) icon.classList.add('fill-icon');
        }
    } else if (type === 'library') {
        const isActive = btn.classList.contains('text-green-500');
        if (isActive) {
            btn.classList.remove('text-green-500', 'btn-lib-active');
            btn.classList.add('text-white/70');
            if (icon) icon.classList.remove('fill-icon');
        } else {
            btn.classList.add('text-green-500', 'btn-lib-active');
            btn.classList.remove('text-white/70');
            if (icon) icon.classList.add('fill-icon');
        }
    } else if (type === 'wishlist') {
        const isActive = btn.classList.contains('text-blue-400');
        if (isActive) {
            btn.classList.remove('text-blue-400', 'btn-wish-active');
            btn.classList.add('text-white/70');
            if (icon) icon.classList.remove('fill-icon');
        } else {
            btn.classList.add('text-blue-400', 'btn-wish-active');
            btn.classList.remove('text-white/70');
            if (icon) icon.classList.add('fill-icon');
        }
    }

    setTimeout(() => btn.classList.remove('animate-pop'), 450);
}

// Helper function to convert DateTime to relative time
function getRelativeTime(dateString) {
    if (!dateString) return '';
    const normalized = dateString.toString().replace(' ', 'T').replace(/Z?$/, 'Z');
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return '';

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 1) return 'just now';
    if (diffSec < 60) return `${diffSec} sec${diffSec === 1 ? '' : 's'} ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

    const diffWeek = Math.floor(diffDay / 7);
    if (diffWeek < 4) return `${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`;

    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`;

    const diffYear = Math.floor(diffDay / 365);
    return `${diffYear} year${diffYear === 1 ? '' : 's'} ago`;
}

// Initialize library page
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = '../../../Auth/Html/login.html';
        return;
    }

    // Display user info
    displayUserInfo();

    initializePagination();
    initializeSearch();
    // initializeCategories();
    // initializePlatforms();
    // initializeReleaseYears();

    // Initial library load
    initViewSwitcher();
    initScrollOptimization();
    loadGames(1);
});

function initScrollOptimization() {
    const container = document.getElementById('library-games');
    const scrollArea = document.getElementById('games-view');
    if (!container || !scrollArea) return;

    let isScrollingTimer;
    scrollArea.addEventListener('scroll', () => {
        container.classList.add('is-scrolling');

        clearTimeout(isScrollingTimer);
        isScrollingTimer = setTimeout(() => {
            container.classList.remove('is-scrolling');
        }, 250);
    }, { passive: true });
}

function initViewSwitcher() {
    setLibraryView(currentLibraryView);
}

async function displayUserInfo() {
    try {
        const response = await apiRequest('/api/Profile', { method: 'GET' });
        if (response.ok) {
            const profile = await response.json();
            const usernameElements = document.querySelectorAll('#display-username, #welcome-username, #display-username-top');
            const avatarContainers = document.querySelectorAll('#display-avatar, #display-avatar-top, #display-avatar-header');

            if (profile.displayName) {
                usernameElements.forEach(el => {
                    el.textContent = profile.displayName;
                });

                const userInfo = getUserInfo();
                userInfo.userName = profile.displayName;
                saveAuthData(userInfo);
            }

            const resolvedAvatar = profile.avatarUrl;
            if (resolvedAvatar && avatarContainers.length > 0) {
                avatarContainers.forEach(container => {
                    const timestamp = new Date().getTime();
                    container.innerHTML = `<img src="${API_URL}/Uploads/${resolvedAvatar}?t=${timestamp}" class="h-full w-full object-cover" onerror="this.parentElement.textContent='${(profile.displayName || "U").charAt(0).toUpperCase()}'">`;
                    const parent = container.parentElement;
                    if (parent && (parent.classList.contains('bg-gradient-to-tr') || parent.classList.contains('from-primary'))) {
                        parent.classList.remove('bg-gradient-to-tr', 'from-primary', 'to-purple-600', 'to-purple-500');
                    }
                });
            } else if (profile.displayName) {
                avatarContainers.forEach(container => {
                    container.textContent = profile.displayName.charAt(0).toUpperCase();
                });
            }
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
    }
}

function createSkeletonCard() {
    const card = document.createElement('div');
    card.className = 'bg-[#1e292b] rounded-md overflow-hidden border border-[#2e616b]/10';
    card.innerHTML = `
        <div class="aspect-[16/9] skeleton-shimmer"></div>
        <div class="px-2 py-3">
            <div class="skeleton-shimmer h-3 rounded w-3/4 mb-2"></div>
            <div class="skeleton-shimmer h-2.5 rounded w-1/2"></div>
        </div>
    `;
    return card;
}

function showSkeletonCards(container, count = 8) {
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) fragment.appendChild(createSkeletonCard());
    container.appendChild(fragment);
}

// Load games from API
async function loadGames(page = 1, query = '', genre = '', platform = '', ordering = '', release = '', status = '') {
    const container = document.getElementById('library-games');
    const totalGamesElement = document.getElementById('total-games');

    if (container) showSkeletonCards(container, 8);

    try {
        let endpoint = status ? `/api/UserGames/GetByStatus/${status}` : `/api/UserGames/GetAllUserGames`;

        let gamesData;

        // Serve from Cache if available
        if (rawUserGamesCache && currentCacheEndpoint === endpoint) {
            gamesData = [...rawUserGamesCache];
        } else {
            const response = await apiRequest(endpoint, { method: 'GET' });

            if (!response.ok) {
                if (response.status === 404) {
                    renderGames([]);
                    return;
                }
                throw new Error('Failed to load games');
            }

            const result = await response.json();

            // Transform completely once and cache
            rawUserGamesCache = result.map(ug => {
                const inLibrary = ug.gamestatus !== 'whishlist' && ug.gamestatus !== 2;
                return {
                    externalId: ug.externalId,
                    id: ug.externalId,
                    title: ug.gameTitle,
                    imageUrl: ug.gameImageUrl,
                    releaseDate: ug.releaseDate,
                    rating: ug.rating,
                    genres: ug.genres,
                    platforms: ug.platforms,
                    isFavorite: ug.isFavorite,
                    isInLibrary: inLibrary,
                    isInWishlist: ug.isInWishlist === true,
                    gamestatus: ug.gamestatus,
                    addedAt: ug.addedAt
                };
            });
            currentCacheEndpoint = endpoint;
            gamesData = [...rawUserGamesCache];
        }

        // Base filter for library view
        gamesData = gamesData.filter(g => g.isInLibrary);

        // Client-side search and filters
        if (query) {
            const lowerQ = query.toLowerCase();
            gamesData = gamesData.filter(g => g.title.toLowerCase().includes(lowerQ));
        }

        if (genre) {
            gamesData = gamesData.filter(g =>
                g.genres.some(name => {
                    const lowerName = name.toLowerCase();
                    const lowerGenre = genre.toLowerCase();
                    return lowerName === lowerGenre || lowerGenre.includes(lowerName) || lowerName.includes(lowerGenre);
                })
            );
        }

        if (platform) {
            const platformMap = {
                '1': 'pc', '2': 'playstation', '3': 'xbox', '4': 'ios',
                '5': 'mac', '6': 'linux', '7': 'nintendo', '8': 'android'
            };
            const platSlug = platformMap[platform];
            if (platSlug) {
                gamesData = gamesData.filter(g =>
                    g.platforms.some(p => p.toLowerCase().includes(platSlug))
                );
            }
        }

        if (release) {
            const [start, end] = release.split(',');
            const startDate = new Date(start);
            const endDate = new Date(end);
            gamesData = gamesData.filter(g => {
                const gameDate = new Date(g.releaseDate);
                return gameDate >= startDate && gameDate <= endDate;
            });
        }

        if (ordering) {
            if (ordering === 'rating') gamesData.sort((a, b) => b.rating - a.rating);
            else if (ordering === '-rating') gamesData.sort((a, b) => a.rating - b.rating);
            else if (ordering === 'released') gamesData.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
            else if (ordering === '-released') gamesData.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
        }

        allGames = gamesData;

        // Manual pagination
        const startIndex = (page - 1) * gamesPerPage;
        const pagedGames = gamesData.slice(startIndex, startIndex + gamesPerPage);

        renderGames(pagedGames);
        updatePaginationControls(page, query, genre, platform, ordering, release, status, {
            total: gamesData.length,
            count: pagedGames.length,
            isCatalog: false
        });

        if (totalGamesElement) {
            totalGamesElement.textContent = `${gamesData.length} Games in Library`;
        }

    } catch (error) {
        console.error('Error loading library:', error);
        if (container) container.innerHTML = `<div class="col-span-full text-center py-20 text-red-500"><p>Failed to load your library. ${error.message}</p></div>`;
    }
}

function setLibraryView(view) {
    currentLibraryView = view;
    localStorage.setItem('libraryView', view);

    const container = document.getElementById('library-games');
    const gridBtn = document.getElementById('view-grid-btn');
    const listBtn = document.getElementById('view-list-btn');
    const singleBtn = document.getElementById('view-single-btn');

    const activeClasses = ['bg-primary/20', 'text-primary', 'border-primary/30', 'shadow-[0_0_15px_rgba(74,125,255,0.2)]'];
    const inactiveClasses = ['text-slate-400', 'hover:text-white', 'hover:bg-white/5'];

    // Reset all buttons
    [gridBtn, listBtn, singleBtn].forEach(btn => {
        if (!btn) return;
        btn.classList.remove(...activeClasses);
        btn.classList.add(...inactiveClasses);
    });

    // Handle container classes
    container.classList.remove('list-view', 'single-view', 'grid', 'grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4');

    if (view === 'grid') {
        container.classList.add('grid', 'grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4');
        gridBtn.classList.add(...activeClasses);
        gridBtn.classList.remove(...inactiveClasses);
    } else if (view === 'list') {
        container.classList.add('list-view');
        listBtn.classList.add(...activeClasses);
        listBtn.classList.remove(...inactiveClasses);
    } else if (view === 'single') {
        container.classList.add('single-view');
        singleBtn.classList.add(...activeClasses);
        singleBtn.classList.remove(...inactiveClasses);
    }

    // Re-render current page
    const startIndex = (currentPage - 1) * gamesPerPage;
    const pagedGames = allGames.slice(startIndex, startIndex + gamesPerPage);

    // Trigger transition animation
    container.classList.remove('view-transition');
    void container.offsetWidth; // Trigger reflow
    container.classList.add('view-transition');

    renderGames(pagedGames);
}

function renderGames(games) {
    const container = document.getElementById('library-games');
    if (!container) return;

    if (games.length === 0) {
        container.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
            <span class="material-symbols-outlined text-6xl mb-4 opacity-20">inventory_2</span>
            <p class="text-xl font-medium">No games found in your library</p>
            <p class="text-sm">Try adjusting your filters or search query.</p>
        </div>
    `;
        return;
    }

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    games.forEach(game => {
        fragment.appendChild(createGameCard(game));
    });
    container.appendChild(fragment);
}

function createGameCard(game) {
    if (currentLibraryView === 'list' || currentLibraryView === 'single') {
        return createVerticalGameCard(game);
    } else {
        return createGridGameCard(game);
    }
}

function createGridGameCard(game) {
    const card = document.createElement('div');
    card.className = 'group relative overflow-hidden rounded-xl bg-[#1e292b] border border-white/5 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 cursor-pointer';
    card.dataset.gameId = game.externalId || game.id;

    const fallbackImage = '../../../Assets/Images/logo.png';
    const rawImageUrl = game.imageUrl || game.imgUrl || game.backgroundImage || game.background_image;
    const isImageInvalid = !rawImageUrl || String(rawImageUrl) === 'null' || String(rawImageUrl) === 'undefined' || rawImageUrl === '';
    const safeImageUrl = isImageInvalid ? fallbackImage : rawImageUrl;

    // Steam: Prefer larger capsule (616x353) over header (460x215) if available
    const hqLandscapeImageUrl = (!isImageInvalid && String(safeImageUrl).includes('/header.jpg'))
        ? String(safeImageUrl).replace('/header.jpg', '/capsule_616x353.jpg')
        : safeImageUrl;

    const title = game.title || game.name || 'Unknown Game';
    const gameId = game.externalId || game.id;

    // Genres
    let category = 'Action • RPG';
    if (game.genres && Array.isArray(game.genres) && game.genres.length > 0) {
        if (typeof game.genres[0] === 'string') {
            category = game.genres.join(' • ');
        } else if (game.genres[0].name) {
            category = game.genres.map(g => g.name).join(' • ');
        }
    }

    // Release Year
    let releaseYear = '';
    const rawRelease = game.releaseDate || game.released || game.release_date || '';
    if (rawRelease) {
        const parsedDate = new Date(rawRelease);
        if (!Number.isNaN(parsedDate.getTime())) {
            releaseYear = parsedDate.getFullYear();
        }
    }

    // Platform Icons
    let platformIcons = '';
    if (game.platforms && Array.isArray(game.platforms) && game.platforms.length > 0) {
        const uniqueIcons = new Set();
        const icons = game.platforms.map(slug => {
            let svgIcon = '';
            const s = (typeof slug === 'string' ? slug : slug.slug || slug.name || '').toLowerCase();

            if (s.includes('pc') || s.includes('windows')) svgIcon = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1V11.7H0V3.449zm0 17.1L9.75 21.9V12.3H0v8.249zM10.5 1.95L24 0v11.7H10.5V1.95zm0 20.1L24 24V12.3H10.5v9.75z"></path></svg>`;
            else if (s.includes('playstation') || s.includes('ps5') || s.includes('ps4')) svgIcon = `<i class="fab fa-playstation text-[10px]"></i>`;
            else if (s.includes('xbox')) svgIcon = `<i class="fab fa-xbox text-[10px]"></i>`;
            else if (s.includes('nintendo') || s.includes('switch')) svgIcon = `<i class="bi bi-nintendo-switch text-[11px]"></i>`;
            else return '';

            if (uniqueIcons.has(svgIcon)) return '';
            uniqueIcons.add(svgIcon);
            return svgIcon;
        }).filter(icon => icon !== '').join('');

        if (icons) {
            platformIcons = `
                <div class="absolute bottom-3 left-3 glass-panel px-2.5 py-1 rounded-full flex items-center gap-2 text-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10 pointer-events-none">
                    ${icons}
                </div>
            `;
        }
    }

    // Status / Inventory Indicators
    const getStatusIcon = (status) => {
        const s = String(status).toLowerCase();
        if (s === 'playing' || s === '1') return { icon: 'play_circle', color: 'text-primary', label: 'Playing' };
        if (s === 'whishlist' || s === '2') return { icon: 'bookmark', color: 'text-blue-400', label: 'Wishlist' };
        if (s === 'completed' || s === '3') return { icon: 'task_alt', color: 'text-green-500', label: 'Completed' };
        if (s === 'dropped' || s === '4') return { icon: 'do_not_disturb_on', color: 'text-red-400', label: 'Dropped' };
        if (s === 'onhold' || s === '5') return { icon: 'pause_circle', color: 'text-yellow-500', label: 'On Hold' };
        if (s === 'pending' || s === '6') return { icon: 'schedule', color: 'text-slate-400', label: 'Pending' };
        return null;
    };

    const statusObj = game.isInLibrary ? getStatusIcon(game.gamestatus) : null;
    const isPending = game.isInLibrary && (String(game.gamestatus).toLowerCase() === 'pending' || String(game.gamestatus) === '6');

    const gameStatusIndicator = renderStatusBadgeHTML(game.gamestatus, gameId);

    const inventoryIndicators = `
        <div class="flex justify-end gap-1 min-w-[65px] h-8 items-center mt-2 relative">
            ${game.isInWishlist ? `
                <div class="h-[30px] w-[40px] rounded-full border border-blue-400/30 flex items-center justify-center bg-slate-900/90 filter-none" title="In Wishlist">
                    <span class="material-symbols-outlined text-[15px] text-blue-400 fill-icon scale-110">bookmark</span>
                </div>` : ''}
            ${game.isFavorite ? `
                <div class="h-[30px] w-[40px] rounded-full border border-red-500/30 flex items-center justify-center bg-slate-900/90 filter-none" title="Favorited">
                    <span class="material-symbols-outlined text-[15px] text-red-500 fill-icon scale-110">favorite</span>
                </div>` : ''}
            ${game.isInLibrary ? `
                <div class="h-[30px] w-[40px] rounded-full border border-green-500/30 flex items-center justify-center bg-slate-900/90 filter-none" title="In Library">
                    <span class="material-symbols-outlined text-[15px] text-green-500 fill-icon scale-110">inventory_2</span>
                </div>` : ''}
        </div>
    `;

    const favBtnClass = game.isFavorite ? 'text-red-500 btn-fav-active' : 'text-white/70 hover:text-red-400';
    const libClass = game.isInLibrary ? 'text-green-500 btn-lib-active' : 'text-white/70 hover:text-primary';

    // statusSelectionHtml removed - now using hover expansion on status badge

    card.innerHTML = `
        <!-- Image Container -->
        <div class="relative aspect-[16/9] overflow-hidden bg-[#0f1a1d]">
            <img
                src="${hqLandscapeImageUrl}"
                data-fallback-src="${safeImageUrl}"
                alt="${title}"
                loading="lazy"
                class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                onerror="if (this.src !== this.dataset.fallbackSrc) { this.src = this.dataset.fallbackSrc; return; } this.src='${fallbackImage}';"
            >
            <!-- Side Actions -->
            <div class="absolute top-3 right-3 flex flex-col gap-2 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 z-20">
                <button onclick="event.stopPropagation(); animateButtonClick(this); addToFavorites('${gameId}')"
                        data-game-id="${gameId}" data-btn-type="favorite"
                        class="w-9 h-9 glass-neon-btn ${favBtnClass}" title="Favorite">
                    <span class="material-symbols-outlined text-lg ${game.isFavorite ? 'fill-icon' : ''}">favorite</span>
                </button>
                <button onclick="event.stopPropagation(); animateButtonClick(this); addToLibrary('${gameId}')"
                        data-game-id="${gameId}" data-btn-type="library"
                        class="w-9 h-9 glass-neon-btn ${libClass}" title="Library">
                    <span class="material-symbols-outlined text-lg ${game.isInLibrary ? 'fill-icon' : ''}">inventory_2</span>
                </button>
            </div>

            ${platformIcons}

            <!-- Status Indicator -->
            <div class="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1.5 transform-gpu will-change-transform" data-status-for="${gameId}">
                ${renderStatusBadgeHTML(game.gamestatus, gameId, false, 'justify-end')}

                ${game.addedAt ? `
                    <div class="h-7 px-2.5 rounded-full border border-white/10 bg-slate-900/90 filter-none flex items-center justify-center transition-all duration-500 ease-in-out group-hover:w-fit group-hover:px-4 cursor-default shadow-lg group/time transform-gpu will-change-transform" title="Added At">
                        <span class="material-symbols-outlined text-[15px] text-slate-400 fill-icon transition-all duration-300 group-hover:opacity-0 group-hover:w-0 group-hover:scale-0 group-hover:hidden">history</span>
                        <span class="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 transition-all duration-500 ease-out text-[10px] uppercase font-bold text-slate-200 whitespace-nowrap">Added ${getRelativeTime(game.addedAt)}</span>
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Info Area -->
        <div class="px-2 py-3 bg-[#1e292b]">
            <div class="flex items-start justify-between gap-2 overflow-hidden">
                <div class="min-w-0 flex-1">
                    <h2 class="text-[12px] font-bold text-[#4481eb] truncate group-hover:text-primary transition-colors leading-tight mb-1" title="${title}">${title}</h2>
                    <p class="text-[10px] font-medium text-slate-500 uppercase tracking-wider truncate">${category.split(' • ')[0]}</p>
                </div>
                <div class="flex flex-col items-end shrink-0 gap-1">
                    ${releaseYear ? `<span class="text-[10px] font-bold text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">${releaseYear}</span>` : ''}
                </div>
            </div>
        </div>
    `;

    card.addEventListener('click', () => {
        showGameDetails(game);
    });

    return card;
}

function createVerticalGameCard(game) {
    const card = document.createElement('div');
    card.className = 'vertical-result-card group cursor-pointer';
    card.dataset.gameId = game.externalId || game.id;

    const fallbackImage = '../../../Assets/Images/logo.png';
    const rawImageUrl = game.imageUrl || game.imgUrl || game.backgroundImage || game.background_image;
    const isImageInvalid = !rawImageUrl || String(rawImageUrl) === 'null' || String(rawImageUrl) === 'undefined' || rawImageUrl === '';
    const safeImageUrl = isImageInvalid ? fallbackImage : rawImageUrl;

    const hqLandscapeImageUrl = (!isImageInvalid && String(safeImageUrl).includes('/header.jpg'))
        ? String(safeImageUrl).replace('/header.jpg', '/capsule_616x353.jpg')
        : safeImageUrl;
    const title = game.title || game.name || 'Unknown Game';
    const gameId = game.externalId || game.id;

    // Genres
    let category = 'Action • RPG';
    if (game.genres && Array.isArray(game.genres) && game.genres.length > 0) {
        if (typeof game.genres[0] === 'string') {
            category = game.genres.join(' • ');
        } else if (game.genres[0].name) {
            category = game.genres.map(g => g.name).join(' • ');
        }
    }

    // Release Year
    let releaseYear = '';
    const rawRelease = game.releaseDate || game.released || game.release_date || '';
    if (rawRelease) {
        const parsedDate = new Date(rawRelease);
        if (!Number.isNaN(parsedDate.getTime())) {
            releaseYear = parsedDate.getFullYear();
        }
    }

    // Platform Icons
    let platformIcons = '';
    if (game.platforms && Array.isArray(game.platforms) && game.platforms.length > 0) {
        const uniqueIcons = new Set();
        const icons = game.platforms.slice(0, 4).map(slug => {
            let svgIcon = '';
            const s = (typeof slug === 'string' ? slug : slug.slug || slug.name || '').toLowerCase();
            if (s.includes('pc') || s.includes('windows')) svgIcon = `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1V11.7H0V3.449zm0 17.1L9.75 21.9V12.3H0v8.249zM10.5 1.95L24 0v11.7H10.5V1.95zm0 20.1L24 24V12.3H10.5v9.75z"></path></svg>`;
            else if (s.includes('playstation')) svgIcon = `<i class="fab fa-playstation text-[11px]"></i>`;
            else if (s.includes('xbox')) svgIcon = `<i class="fab fa-xbox text-[11px]"></i>`;
            else if (s.includes('nintendo')) svgIcon = `<i class="bi bi-nintendo-switch text-[12px]"></i>`;
            else return '';
            if (uniqueIcons.has(svgIcon)) return '';
            uniqueIcons.add(svgIcon);
            return svgIcon;
        }).filter(icon => icon !== '').join('');
        if (icons) {
            platformIcons = `<div class="absolute bottom-2 left-2 glass-panel px-2 py-0.5 rounded-lg flex items-center gap-2 text-white/50 z-10">${icons}</div>`;
        }
    }

    const favBtnClass = game.isFavorite ? 'text-red-500 btn-fav-active' : 'text-white/70 hover:text-red-400';
    const libClass = game.isInLibrary ? 'text-green-500 btn-lib-active' : 'text-white/70 hover:text-primary';

    card.innerHTML = `
        <div class="thumb-container flex-shrink-0 relative overflow-hidden rounded-lg">
            <img src="${hqLandscapeImageUrl}" 
                 data-fallback-src="${safeImageUrl}"
                 onerror="if (this.src !== this.dataset.fallbackSrc) { this.src = this.dataset.fallbackSrc; return; } this.src='${fallbackImage}';" 
                 class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                 alt="${title}">
            ${platformIcons}
        </div>
        
        <div class="content-container flex flex-col justify-center gap-1.5 flex-1 min-w-0">
            <div class="flex items-center gap-3">
                <h3 class="title-text truncate text-lg font-bold" title="${title}">${title}</h3>
                ${releaseYear ? `<span class="bg-white/10 px-2.5 py-0.5 rounded text-[10px] font-bold text-slate-500 tracking-wider h-fit">${releaseYear}</span>` : ''}
            </div>
            
            <div class="flex flex-wrap gap-2">
                ${(game.genres || []).slice(0, 3).map(g => `<span class="genre-pill">${(typeof g === 'string' ? g : g.name).toUpperCase()}</span>`).join('')}
                ${game.addedAt ? `<span class="text-[9px] text-slate-600 font-bold uppercase tracking-wider ml-4 flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">history</span> Added ${getRelativeTime(game.addedAt)}</span>` : ''}
            </div>

            <!-- Status Indicator -->
            <div data-status-for="${gameId}" class="flex-shrink-0 min-h-[32px] w-fit pt-1">
                ${renderStatusBadgeHTML(game.gamestatus, gameId)}
            </div>
        </div>

        <div class="action-cluster flex items-center gap-2 pr-4">
            <button onclick="event.stopPropagation(); animateButtonClick(this); addToFavorites('${gameId}')" 
                    data-game-id="${gameId}" data-btn-type="favorite"
                    class="w-10 h-10 glass-neon-btn ${favBtnClass}" title="Favorite">
                <span class="material-symbols-outlined text-lg ${game.isFavorite ? 'fill-icon' : ''}">favorite</span>
            </button>
            <button onclick="event.stopPropagation(); animateButtonClick(this); addToLibrary('${gameId}')" 
                    data-game-id="${gameId}" data-btn-type="library"
                    class="w-10 h-10 glass-neon-btn ${libClass}" title="Remove from Library">
                <span class="material-symbols-outlined text-lg ${game.isInLibrary ? 'fill-icon' : ''}">inventory_2</span>
            </button>
        </div>
    `;

    card.onclick = () => showGameDetails(game);
    return card;
}

function updatePaginationControls(page, query, genre, platform, ordering, release, status, paginationInfo) {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) prevBtn.disabled = page === 1;

    const totalPages = Math.max(1, Math.ceil(paginationInfo.total / gamesPerPage));
    if (pageInfo) pageInfo.textContent = `Page ${page} of ${totalPages}`;

    if (nextBtn) nextBtn.disabled = page >= totalPages;

    currentPage = page;
}

function initializePagination() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                loadGames(currentPage - 1, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease, currentStatus);
                scrollToTop();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            loadGames(currentPage + 1, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease, currentStatus);
            scrollToTop();
        });
    }
}

function initializeSearch() {
    const searchInput = document.querySelector('.search-bar input');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        debounceTimer = setTimeout(() => {
            currentQuery = query;
            loadGames(1, query, currentGenre, currentPlatform, currentOrdering, currentRelease, currentStatus);
        }, 500);
    });
}

async function initializeCategories() {
    const categoryList = document.getElementById('category-list');
    const currentCatDisplay = document.getElementById('current-category');
    if (!categoryList) return;

    try {
        const response = await apiRequest('/api/Steam/catalog/genres', { method: 'GET' });
        if (response.ok) {
            const genres = await response.json();
            categoryList.innerHTML = '';

            const allOption = document.createElement('button');
            allOption.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
            allOption.textContent = 'All Categories';
            allOption.onclick = () => {
                currentGenre = '';
                if (currentCatDisplay) currentCatDisplay.textContent = 'Category';
                loadGames(1, currentQuery, '', currentPlatform, currentOrdering, currentRelease, currentStatus);
            };
            categoryList.appendChild(allOption);

            genres.forEach(genreStr => {
                const [slug, name] = genreStr.includes(':') ? genreStr.split(':') : [genreStr, genreStr];
                const option = document.createElement('button');
                option.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
                option.textContent = name;
                option.onclick = () => {
                    currentGenre = slug;
                    if (currentCatDisplay) currentCatDisplay.textContent = name;
                    loadGames(1, currentQuery, slug, currentPlatform, currentOrdering, currentRelease, currentStatus);
                };
                categoryList.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading genres:', error);
    }
}

async function initializePlatforms() {
    const platformList = document.getElementById('platform-list');
    const currentPlatDisplay = document.getElementById('current-platform');
    if (!platformList) return;

    try {
        const response = await apiRequest('/api/Steam/catalog/platforms', { method: 'GET' });
        if (response.ok) {
            const platforms = await response.json();
            platformList.innerHTML = '';

            const allOption = document.createElement('button');
            allOption.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
            allOption.textContent = 'All Platforms';
            allOption.onclick = () => {
                currentPlatform = '';
                if (currentPlatDisplay) currentPlatDisplay.textContent = 'Platforms';
                loadGames(1, currentQuery, currentGenre, '', currentOrdering, currentRelease, currentStatus);
            };
            platformList.appendChild(allOption);

            platforms.forEach(platStr => {
                const [id, name] = platStr.split(':');
                const option = document.createElement('button');
                option.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
                option.textContent = name;
                option.onclick = () => {
                    currentPlatform = id;
                    if (currentPlatDisplay) currentPlatDisplay.textContent = name;
                    loadGames(1, currentQuery, currentGenre, id, currentOrdering, currentRelease, currentStatus);
                };
                platformList.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading platforms:', error);
    }
}

function setRatingOrdering(ordering, label) {
    currentOrdering = ordering;
    const currentRatingDisplay = document.getElementById('current-rating');
    if (currentRatingDisplay) currentRatingDisplay.textContent = label;
    loadGames(1, currentQuery, currentGenre, currentPlatform, ordering, currentRelease, currentStatus);
}

function setStatusFilter(statusId, label) {
    currentStatus = statusId;
    const currentStatusDisplay = document.getElementById('current-status');
    if (currentStatusDisplay) currentStatusDisplay.textContent = label;
    loadGames(1, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease, statusId);
}

function clearAllFilters() {
    currentGenre = '';
    currentPlatform = '';
    currentOrdering = '';
    currentRelease = '';
    currentStatus = '';

    const currentCatDisplay = document.getElementById('current-category');
    if (currentCatDisplay) currentCatDisplay.textContent = 'Category';
    const currentPlatDisplay = document.getElementById('current-platform');
    if (currentPlatDisplay) currentPlatDisplay.textContent = 'Platforms';
    const currentRatingDisplay = document.getElementById('current-rating');
    if (currentRatingDisplay) currentRatingDisplay.textContent = 'Rating';
    const currentReleaseDisplay = document.getElementById('current-release');
    if (currentReleaseDisplay) currentReleaseDisplay.textContent = 'Release';
    const currentStatusDisplay = document.getElementById('current-status');
    if (currentStatusDisplay) currentStatusDisplay.textContent = 'Status';

    loadGames(1, currentQuery, '', '', '', '', '');
}

async function initializeReleaseYears() {
    const releaseList = document.getElementById('release-year-list');
    const currentReleaseDisplay = document.getElementById('current-release');
    if (!releaseList) return;

    const currentYear = new Date().getFullYear();
    releaseList.innerHTML = '';

    const allOption = document.createElement('button');
    allOption.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
    allOption.textContent = 'All Years';
    allOption.onclick = () => {
        currentRelease = '';
        if (currentReleaseDisplay) currentReleaseDisplay.textContent = 'Release';
        loadGames(1, currentQuery, currentGenre, currentPlatform, currentOrdering, '', currentStatus);
    };
    releaseList.appendChild(allOption);

    for (let year = currentYear; year >= 1991; year--) {
        const option = document.createElement('button');
        option.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
        option.textContent = year;
        option.onclick = () => {
            const dateRange = `${year}-01-01,${year}-12-31`;
            currentRelease = dateRange;
            if (currentReleaseDisplay) currentReleaseDisplay.textContent = year;
            loadGames(1, currentQuery, currentGenre, currentPlatform, currentOrdering, dateRange, currentStatus);
        };
        releaseList.appendChild(option);
    }
}

function scrollToTop() {
    const contentArea = document.querySelector('.content-area');
    if (contentArea) contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function addToFavorites(gameId) {
    try {
        const response = await apiRequest(`/api/Steam/catalog/favorite/${gameId}`, { method: 'POST' });
        if (response.ok) {
            const result = await response.json();
            const isFavorite = result.isFavorite;
            const gameTitle = allGames.find(g => g.id == gameId)?.title || "Game";
            showToast(`"${gameTitle}" ${isFavorite ? 'added to' : 'removed from'} favorites!`, isFavorite ? 'favorite' : 'unfavorite');
            updateFavoriteUI(gameId, isFavorite);
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
}

function updateFavoriteUI(gameId, isFavorite) {
    const cachedGame = allGames.find(g => g.id == gameId);
    if (cachedGame) {
        cachedGame.isFavorite = isFavorite;
        if (isFavorite) cachedGame.isInWishlist = false;

        // Sync the inventory indicators in the info area
        const inventoryContainer = document.querySelector(`[data-inventory-for="${gameId}"]`);
        if (inventoryContainer) {
            inventoryContainer.innerHTML = `
                <div class="flex justify-end gap-1 min-w-[65px] h-8 items-center mt-2 relative">
                    ${cachedGame.isInWishlist ? '<div class="h-[30px] w-[40px] rounded-full border border-blue-400/30 flex items-center justify-center bg-slate-900/90 filter-none"><span class="material-symbols-outlined text-[15px] text-blue-400 fill-icon scale-110">bookmark</span></div>' : ''}
                    ${cachedGame.isFavorite ? '<div class="h-[30px] w-[40px] rounded-full border border-red-500/30 flex items-center justify-center bg-slate-900/90 filter-none"><span class="material-symbols-outlined text-[15px] text-red-500 fill-icon scale-110">favorite</span></div>' : ''}
                    ${cachedGame.isInLibrary ? '<div class="h-[30px] w-[40px] rounded-full border border-green-500/30 flex items-center justify-center bg-slate-900/90 filter-none"><span class="material-symbols-outlined text-[15px] text-green-500 fill-icon scale-110">inventory_2</span></div>' : ''}
                </div>
            `;
        }

        // Sync the quick action button state if it exists (in case it wasn't the trigger)
        const favBtn = document.querySelector(`button[data-game-id="${gameId}"][data-btn-type="favorite"]`);
        if (favBtn) {
            const icon = favBtn.querySelector('.material-symbols-outlined');
            if (isFavorite) {
                favBtn.classList.add('text-red-500', 'btn-fav-active');
                favBtn.classList.remove('text-white/70');
                if (icon) icon.classList.add('fill-icon');
            } else {
                favBtn.classList.remove('text-red-500', 'btn-fav-active');
                favBtn.classList.add('text-white/70');
                if (icon) icon.classList.remove('fill-icon');
            }
        }
    }
}

async function addToLibrary(gameId) {
    try {
        const response = await apiRequest(`/api/Steam/catalog/library/${gameId}`, { method: 'POST' });
        if (response.ok) {
            const result = await response.json();
            const isInLibrary = result.added;
            const gameTitle = allGames.find(g => g.id == gameId)?.title || "Game";
            showToast(`"${gameTitle}" ${isInLibrary ? 'added to' : 'removed from'} library!`, isInLibrary ? 'success' : 'error');
            updateLibraryUI(gameId, isInLibrary);
        }
    } catch (error) {
        console.error('Error toggling library status:', error);
    }
}

function updateLibraryUI(gameId, isInLibrary) {
    const cachedGame = allGames.find(g => g.id == gameId);
    if (cachedGame) {
        cachedGame.isInLibrary = isInLibrary;
        if (isInLibrary) cachedGame.gamestatus = 6;
        else cachedGame.gamestatus = null;
        updateStatusIndicators(gameId, cachedGame);
    }

    // Remove if not in library anymore
    if (!isInLibrary) {
        const cardToRemove = document.querySelector(`button[data-game-id="${gameId}"]`)?.closest('.group');
        if (cardToRemove) {
            cardToRemove.classList.add('animate-card-exit');
            setTimeout(() => {
                cardToRemove.remove();
                const container = document.getElementById('library-games');
                if (container && container.children.length === 0) {
                    container.innerHTML = `
                        <div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                            <span class="material-symbols-outlined text-6xl mb-4 opacity-20">inventory_2</span>
                            <p class="text-xl font-medium">No games in library.</p>
                        </div>`;
                }
            }, 450);
        }
    }
}

async function addToWishlist(gameId) {
    try {
        const response = await apiRequest(`/api/Steam/catalog/wishlist/${gameId}`, { method: 'POST' });
        if (response.ok) {
            const result = await response.json();
            const isInWishlist = result.added;
            const gameTitle = allGames.find(g => g.id == gameId)?.title || "Game";
            showToast(`"${gameTitle}" ${isInWishlist ? 'added to' : 'removed from'} wishlist!`, isInWishlist ? 'info' : 'unfavorite');
            updateWishlistUI(gameId, isInWishlist);
        }
    } catch (error) {
        console.error('Error toggling wishlist status:', error);
    }
}

function updateWishlistUI(gameId, isInWishlist) {
    const cachedGame = allGames.find(g => g.id == gameId);
    if (cachedGame) {
        cachedGame.isInWishlist = isInWishlist;
        if (isInWishlist) cachedGame.isFavorite = false;
        updateStatusIndicators(gameId, cachedGame);
    }
}

// --- Reusable status icon map ---
const STATUS_ICON_MAP = {
    'playing': { icon: 'play_circle', color: 'text-primary', label: 'Playing' },
    '1': { icon: 'play_circle', color: 'text-primary', label: 'Playing' },
    'completed': { icon: 'task_alt', color: 'text-green-500', label: 'Completed' },
    '3': { icon: 'task_alt', color: 'text-green-500', label: 'Completed' },
    'onhold': { icon: 'pause_circle', color: 'text-yellow-500', label: 'On Hold' },
    '5': { icon: 'pause_circle', color: 'text-yellow-500', label: 'On Hold' },
    'dropped': { icon: 'do_not_disturb_on', color: 'text-red-400', label: 'Dropped' },
    '4': { icon: 'do_not_disturb_on', color: 'text-red-400', label: 'Dropped' },
    'pending': { icon: 'schedule', color: 'text-slate-400', label: 'Pending' },
    '6': { icon: 'schedule', color: 'text-slate-400', label: 'Pending' }
};

function renderStatusBadgeHTML(gamestatus, gameId, isUpdating = false, alignment = 'justify-start') {
    if (!gamestatus) return '';
    const key = String(gamestatus).toLowerCase();
    const statusObj = STATUS_ICON_MAP[key] || { icon: 'schedule', color: 'text-slate-400', label: 'Pending' };

    const selectorItems = [
        { id: '1', icon: 'play_circle', color: 'text-primary', label: 'Playing' },
        { id: '3', icon: 'task_alt', color: 'text-green-500', label: 'Completed' },
        { id: '5', icon: 'pause_circle', color: 'text-yellow-500', label: 'On Hold' },
        { id: '4', icon: 'do_not_disturb_on', color: 'text-red-400', label: 'Dropped' }
    ];

    const animationClass = isUpdating ? 'status-update-flash' : '';
    const isRightAligned = alignment === 'justify-end';

    return `
        <div class="group/status relative min-h-[32px] flex items-center w-fit ${alignment} ${animationClass}">
            <!-- Badge: Icon-only (Initial) -> Expands on Card Hover -> Hidden on Status Hover -->
            <div class="h-8 px-2.5 rounded-full border border-white/10 bg-slate-900/90 shadow-lg transform-gpu transition-all duration-300 flex items-center group-hover/status:opacity-0 group-hover/status:scale-90 group-hover/status:pointer-events-none min-w-[32px] overflow-hidden" title="${statusObj.label}">
                <span class="material-symbols-outlined text-[16px] ${statusObj.color} fill-icon shrink-0">${statusObj.icon}</span>
                <span class="max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-500 ease-out text-[10px] uppercase font-bold ${statusObj.color} whitespace-nowrap">
                    ${statusObj.label}
                </span>
            </div>

            <!-- Selector: Hidden -> Visible only on Status Hover -->
            <div class="absolute ${isRightAligned ? 'right-0 translate-x-4' : 'left-0 -translate-x-4'} flex items-center gap-1.5 opacity-0 pointer-events-none group-hover/status:opacity-100 group-hover/status:translate-x-0 group-hover/status:pointer-events-auto transition-all duration-300 z-50">
                ${selectorItems.map(s => {
        const isActive = (key === s.id || key === s.label.toLowerCase());
        return `
                        <button onclick="event.stopPropagation(); changeGameStatus('${gameId}', ${s.id})" 
                                class="w-8 h-8 rounded-full bg-slate-900 border ${isActive ? 'border-primary/60 bg-primary/20 shadow-[0_0_12px_rgba(74,125,235,0.3)]' : 'border-white/10'} flex items-center justify-center hover:bg-white/10 transition-all hover:scale-110 active:scale-95" 
                                title="${s.label}">
                            <span class="material-symbols-outlined text-[18px] ${s.color} ${isActive ? 'fill-icon' : ''}">${s.icon}</span>
                        </button>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

function renderInventoryIndicatorsHTML(game) {
    return `
        ${game.isInWishlist ? '<div class="h-[30px] w-[40px] rounded-full border border-blue-400/30 flex items-center justify-center bg-slate-900/90 filter-none" title="In Wishlist"><span class="material-symbols-outlined text-[15px] text-blue-400 fill-icon scale-110">bookmark</span></div>' : ''}
    `;
}

function updateStatusIndicators(gameId, game) {
    // Update status badge in-place
    const statusContainer = document.querySelector(`[data-status-for="${gameId}"]`);
    if (statusContainer) {
        const badgeEl = statusContainer.querySelector('.h-7');
        if (badgeEl) badgeEl.outerHTML = renderStatusBadgeHTML(game.gamestatus);
    }
    // Update inventory pills in-place
    const inventoryContainer = document.querySelector(`[data-inventory-for="${gameId}"]`);
    if (inventoryContainer) {
        inventoryContainer.innerHTML = renderInventoryIndicatorsHTML(game);
    }
    // Update action buttons
    const favBtn = document.querySelector(`button[data-game-id="${gameId}"][data-btn-type="favorite"]`);
    if (favBtn) {
        const icon = favBtn.querySelector('.material-symbols-outlined');
        if (game.isFavorite) {
            favBtn.classList.add('text-red-500', 'btn-fav-active'); favBtn.classList.remove('text-white/70');
            if (icon) icon.classList.add('fill-icon');
        } else {
            favBtn.classList.remove('text-red-500', 'btn-fav-active'); favBtn.classList.add('text-white/70');
            if (icon) icon.classList.remove('fill-icon');
        }
    }
    const libBtn = document.querySelector(`button[data-game-id="${gameId}"][data-btn-type="library"]`);
    if (libBtn) {
        const icon = libBtn.querySelector('.material-symbols-outlined');
        if (game.isInLibrary) {
            libBtn.classList.add('text-green-500', 'btn-lib-active'); libBtn.classList.remove('text-white/70');
            if (icon) icon.classList.add('fill-icon');
        } else {
            libBtn.classList.remove('text-green-500', 'btn-lib-active'); libBtn.classList.add('text-white/70');
            if (icon) icon.classList.remove('fill-icon');
        }
    }
    const wishBtn = document.querySelector(`button[data-game-id="${gameId}"][data-btn-type="wishlist"]`);
    if (wishBtn) {
        const icon = wishBtn.querySelector('.material-symbols-outlined');
        if (game.isInWishlist) {
            wishBtn.classList.add('text-blue-400', 'btn-wish-active'); wishBtn.classList.remove('text-white/70');
            if (icon) icon.classList.add('fill-icon');
        } else {
            wishBtn.classList.remove('text-blue-400', 'btn-wish-active'); wishBtn.classList.add('text-white/70');
            if (icon) icon.classList.remove('fill-icon');
        }
    }
}

function showGameDetails(game) {
    const gameId = game.externalId || game.id;
    if (!gameId) return;
    window.location.href = `../../../GameDetails/Html/game-details.html?id=${gameId}`;
}

function updateStatusSelectorUI(gameId, statusId) {
    const selectorContainer = document.querySelector(`[data-status-selector="${gameId}"]`);
    if (!selectorContainer) return;

    // reset all buttons
    const buttons = selectorContainer.querySelectorAll('button');
    buttons.forEach(btn => {
        // extract statusId from onclick
        const match = btn.getAttribute('onclick').match(/changeGameStatus\(.*?,[\s]*(\d+)\)/);
        if (match) {
            const btnStatusId = String(match[1]);
            const isActive = btnStatusId === String(statusId);

            // clear old classes and assign base transition
            btn.className = 'flex-1 flex justify-center p-1 sm:p-1.5 rounded-md transition-all duration-200';

            if (isActive) {
                if (btnStatusId === '1') btn.classList.add('bg-primary/20', 'text-primary');
                else if (btnStatusId === '3') btn.classList.add('bg-green-500/20', 'text-green-500');
                else if (btnStatusId === '5') btn.classList.add('bg-yellow-500/20', 'text-yellow-500');
                else if (btnStatusId === '4') btn.classList.add('bg-red-500/20', 'text-red-500');
            } else {
                btn.classList.add('text-slate-500', 'hover:bg-white/5');
                if (btnStatusId === '1') btn.classList.add('hover:text-primary');
                else if (btnStatusId === '3') btn.classList.add('hover:text-green-500');
                else if (btnStatusId === '5') btn.classList.add('hover:text-yellow-500');
                else if (btnStatusId === '4') btn.classList.add('hover:text-red-500');
            }
        }
    });
}

async function changeGameStatus(gameId, statusId) {
    const cachedGame = allGames.find(g => g.id == gameId);
    let originalStatus = null;
    // Optimistic UI update - apply immediately before API call
    if (cachedGame) {
        originalStatus = cachedGame.gamestatus;
        cachedGame.gamestatus = statusId;
        const statusContainer = document.querySelector(`[data-status-for="${gameId}"]`);
        if (statusContainer) {
            const statusUiEl = statusContainer.querySelector('.group\\/status');
            if (statusUiEl) {
                statusUiEl.outerHTML = renderStatusBadgeHTML(statusId, gameId, true);
            } else {
                const firstChild = statusContainer.firstElementChild;
                if (firstChild) firstChild.outerHTML = renderStatusBadgeHTML(statusId, gameId, true);
            }
        }
    }
    try {
        const response = await apiRequest(`/api/UserGames/UpdateUserGame`, {
            method: 'PATCH',
            body: JSON.stringify({ gameId: parseInt(gameId), gamestatus: statusId })
        });
        if (response.ok) {
            const statusObj = STATUS_ICON_MAP[String(statusId)] || null;
            showToast(`Status updated to ${statusObj?.label || 'Unknown'}!`, 'success');
        } else {
            // Revert on failure
            if (cachedGame) {
                cachedGame.gamestatus = originalStatus;
                const statusContainer = document.querySelector(`[data-status-for="${gameId}"]`);
                if (statusContainer) {
                    const statusUiEl = statusContainer.querySelector('.group\\/status');
                    if (statusUiEl) {
                        statusUiEl.outerHTML = renderStatusBadgeHTML(originalStatus, gameId);
                    } else {
                        const firstChild = statusContainer.firstElementChild;
                        if (firstChild) firstChild.outerHTML = renderStatusBadgeHTML(originalStatus, gameId);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

function logout() {
    clearAuthData();
    window.location.href = '../../../Auth/Html/login.html';
}
