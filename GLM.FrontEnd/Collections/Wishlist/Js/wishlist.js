// Pagination state
let currentPage = 1;
let currentQuery = '';
let currentGenre = '';
let currentPlatform = '';
let currentOrdering = '';
let currentRelease = '';
let currentStatus = '';
let gamesPerPage = 12;
let allGames = [];
let rawUserGamesCache = null;
let currentCacheEndpoint = null;
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
// Initialize wishlist page
document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = '../../../Auth/Html/login.html';
        return;
    }
    displayUserInfo();
    initializePagination();
    initializeSearch();
    loadGames(1);
});

async function displayUserInfo() {
    try {
        const response = await apiRequest('/api/Profile', { method: 'GET' });
        if (response.ok) {
            const profile = await response.json();
            const usernameElements = document.querySelectorAll('#display-username, #welcome-username, #display-username-top');
            const avatarContainers = document.querySelectorAll('#display-avatar, #display-avatar-top, #display-avatar-header');
            if (profile.displayName) {
                usernameElements.forEach(el => el.textContent = profile.displayName);
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
                avatarContainers.forEach(container => container.textContent = profile.displayName.charAt(0).toUpperCase());
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

async function loadGames(page = 1, query = '', genre = '', platform = '', ordering = '', release = '') {
    const container = document.getElementById('library-games');
    const totalGamesElement = document.getElementById('total-games');
    if (container) showSkeletonCards(container, 8);
    try {
        let endpoint = '/api/UserGames/GetAllUserGames';
        let gamesData;

        // Serve from Cache if available
        if (rawUserGamesCache && currentCacheEndpoint === endpoint) {
            gamesData = [...rawUserGamesCache];
        } else {
            const response = await apiRequest(endpoint, { method: 'GET' });
            if (!response.ok) {
                if (response.status === 404) { renderGames([]); return; }
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
                    isInWishlist: ug.isInWishlist === true || ug.gamestatus === 'whishlist' || ug.gamestatus === 2 || ug.gamestatus === "2",
                    gamestatus: ug.gamestatus,
                    addedAt: ug.addedAt
                };
            });
            currentCacheEndpoint = endpoint;
            gamesData = [...rawUserGamesCache];
        }

        // Base filter for wishlist view
        gamesData = gamesData.filter(g => g.isInWishlist);

        if (query) {
            const lowerQ = query.toLowerCase();
            gamesData = gamesData.filter(g => g.title.toLowerCase().includes(lowerQ));
        }

        allGames = gamesData;
        const startIndex = (page - 1) * gamesPerPage;
        const pagedGames = gamesData.slice(startIndex, startIndex + gamesPerPage);
        renderGames(pagedGames);

        if (totalGamesElement) totalGamesElement.textContent = `${gamesData.length} Games in Wishlist`;

        const pageInfo = document.getElementById('page-info');
        if (pageInfo) pageInfo.textContent = `Page ${page} of ${Math.max(1, Math.ceil(gamesData.length / gamesPerPage))}`;
        currentPage = page;

    } catch (error) {
        console.error('Error loading wishlist:', error);
        if (container) container.innerHTML = `<div class="col-span-full text-center py-20 text-red-500"><p>Failed to load wishlist. ${error.message}</p></div>`;
    }
}

function renderGames(games) {
    const container = document.getElementById('library-games');
    if (!container) return;
    if (games.length === 0) {
        container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-500"><span class="material-symbols-outlined text-6xl mb-4 opacity-20">bookmark</span><p class="text-xl font-medium">Your wishlist is empty</p></div>`;
        return;
    }
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    games.forEach(game => fragment.appendChild(createGameCard(game)));
    container.appendChild(fragment);
}

function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'group bg-[#1e292b] rounded-md overflow-hidden border border-[#2e616b]/10 hover:border-primary/30 transition-all duration-300 relative cursor-pointer';

    const imageUrl = game.imageUrl || game.imgUrl || game.backgroundImage || game.background_image || '../../Assets/Images/default-game.jpg';
    const hqLandscapeImageUrl = String(imageUrl).includes('/header.jpg')
        ? String(imageUrl).replace('/header.jpg', '/capsule_616x353.jpg')
        : imageUrl;
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

    // Inventory Indicators (Wishlist page primarily needs wishlist indicator)
    const inventoryIndicators = `
        <div class="flex justify-end gap-1 min-w-[65px] h-8 items-center mt-2 relative">
            ${game.isInWishlist || true ? `
                <div class="h-[30px] w-[40px] rounded-full border border-blue-400/30 flex items-center justify-center bg-slate-900/90 filter-none" title="In Wishlist">
                    <span class="material-symbols-outlined text-[15px] text-blue-400 fill-icon scale-110">bookmark</span>
                </div>` : ''}
        </div>
    `;

    const wishlistClass = 'text-blue-400';

    card.innerHTML = `
        <!-- Image Container -->
        <div class="relative aspect-[16/9] overflow-hidden bg-[#0f1a1d]">
            <img
                src="${hqLandscapeImageUrl}"
                data-fallback-src="${imageUrl}"
                alt="${title}"
                loading="lazy"
                class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                onerror="if (this.dataset.fallbackSrc && this.src !== this.dataset.fallbackSrc) { this.src = this.dataset.fallbackSrc; return; } this.src='../../Assets/Images/logo.png';"
            >
            
            <!-- Side Actions -->
            <div class="absolute top-3 right-3 flex flex-col gap-2 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 z-20">
                <button onclick="event.stopPropagation(); animateButtonClick(this); addToWishlist('${gameId}')" 
                        data-game-id="${gameId}" data-btn-type="wishlist"
                        class="w-9 h-9 glass-neon-btn ${game.isInWishlist ? 'text-blue-400 btn-wish-active' : 'text-white/70'}" title="Wishlist">
                    <span class="material-symbols-outlined text-lg ${game.isInWishlist ? 'fill-icon' : ''}">bookmark</span>
                </button>
            </div>

            ${platformIcons}

            <!-- Status Indicator -->
            <div class="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1.5" data-status-for="${gameId}">
                ${game.addedAt ? `
                    <div class="h-7 px-2.5 rounded-full border border-white/10 bg-slate-900/90 filter-none flex items-center justify-center transition-all duration-500 ease-in-out group-hover:w-fit group-hover:px-4 cursor-default shadow-lg group/time" title="Added At">
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

    card.addEventListener('click', () => window.location.href = `../../../GameDetails/Html/game-details.html?id=${gameId}`);

    return card;
}

function initializePagination() {
    document.getElementById('prev-btn')?.addEventListener('click', () => { if (currentPage > 1) loadGames(currentPage - 1); });
    document.getElementById('next-btn')?.addEventListener('click', () => loadGames(currentPage + 1));
}

function initializeSearch() {
    document.querySelector('.search-bar input')?.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        setTimeout(() => loadGames(1, q), 500);
    });
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

function renderStatusBadgeHTML(gamestatus) {
    const key = String(gamestatus).toLowerCase();
    const isPending = key === 'pending' || key === '6';
    const statusObj = STATUS_ICON_MAP[key] || null;
    if (isPending) {
        return `<div class="h-7 px-3 rounded-full border border-slate-500/30 bg-slate-900/90 filter-none flex items-center justify-center cursor-default shadow-lg status-change-animation"><span class="text-[10px] uppercase font-bold text-slate-300 tracking-wider whitespace-nowrap">Pending</span></div>`;
    }
    if (!statusObj) return '';
    return `<div class="h-7 px-2.5 rounded-full border border-primary/20 flex items-center justify-center bg-slate-900/90 filter-none transition-all duration-500 ease-in-out group-hover:w-fit group-hover:px-4 cursor-default shadow-lg status-change-animation" title="${statusObj.label}"><span class="material-symbols-outlined text-[15px] ${statusObj.color} fill-icon transition-all duration-300 group-hover:opacity-0 group-hover:w-0 group-hover:scale-0 group-hover:hidden">${statusObj.icon}</span><span class="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 transition-all duration-500 ease-out text-[10px] uppercase font-bold ${statusObj.color} whitespace-nowrap">${statusObj.label}</span></div>`;
}

function renderInventoryIndicatorsHTML(game) {
    return `
        <div class="flex justify-end gap-1 min-w-[65px] h-8 items-center mt-2 relative">
            ${game.isInWishlist ? '<div class="h-[30px] w-[40px] rounded-full border border-blue-400/30 flex items-center justify-center bg-slate-900/90 filter-none" title="In Wishlist"><span class="material-symbols-outlined text-[15px] text-blue-400 fill-icon scale-110">bookmark</span></div>' : ''}
            ${game.isFavorite ? '<div class="h-[30px] w-[40px] rounded-full border border-red-500/30 flex items-center justify-center bg-slate-900/90 filter-none" title="Favorited"><span class="material-symbols-outlined text-[15px] text-red-500 fill-icon scale-110">favorite</span></div>' : ''}
            ${game.isInLibrary ? '<div class="h-[30px] w-[40px] rounded-full border border-green-500/30 flex items-center justify-center bg-slate-900/90 filter-none" title="In Library"><span class="material-symbols-outlined text-[15px] text-green-500 fill-icon scale-110">inventory_2</span></div>' : ''}
        </div>
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

async function addToWishlist(gameId) {
    const card = document.querySelector(`button[data-game-id="${gameId}"]`)?.closest('.group');
    try {
        const response = await apiRequest(`/api/Steam/catalog/wishlist/${gameId}`, { method: 'POST' });
        if (response.ok) {
            const result = await response.json();
            const isInWishlist = result.added;
            const gameTitle = allGames.find(g => (g.externalId || g.id) == gameId)?.title || "Game";
            showToast(`"${gameTitle}" ${isInWishlist ? 'added to' : 'removed from'} wishlist!`, isInWishlist ? 'info' : 'unfavorite');
            updateWishlistUI(gameId, isInWishlist);
        }
    } catch (error) {
        console.error('Error toggling wishlist status:', error);
    }
}

function updateWishlistUI(gameId, isInWishlist) {
    const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
    if (cachedGame) {
        cachedGame.isInWishlist = isInWishlist;
        if (isInWishlist) cachedGame.isFavorite = false;
        updateStatusIndicators(gameId, cachedGame);
    }

    // Since this is the wishlist page, remove it from view if removed from wishlist
    if (!isInWishlist) {
        const cardToRemove = document.querySelector(`button[data-game-id="${gameId}"]`)?.closest('.group');
        if (cardToRemove) {
            cardToRemove.classList.add('animate-card-exit');
            setTimeout(() => {
                cardToRemove.remove();
                const container = document.getElementById('library-games');
                if (container && container.children.length === 0) {
                    container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-500"><span class="material-symbols-outlined text-6xl mb-4 opacity-20">bookmark</span><p class="text-xl font-medium">Your wishlist is empty</p></div>`;
                }
            }, 450);
        }
    }
}

async function addToLibrary(gameId) {
    try {
        const response = await apiRequest(`/api/Steam/catalog/library/${gameId}`, { method: 'POST' });
        if (response.ok) {
            const result = await response.json();
            const isInLibrary = result.added;
            const gameTitle = allGames.find(g => (g.externalId || g.id) == gameId)?.title || "Game";
            showToast(`"${gameTitle}" ${isInLibrary ? 'added to' : 'removed from'} library!`, isInLibrary ? 'success' : 'error');
            updateLibraryUI(gameId, isInLibrary);
        }
    } catch (error) {
        console.error('Error toggling library status:', error);
    }
}

function updateLibraryUI(gameId, isInLibrary) {
    const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
    if (cachedGame) {
        cachedGame.isInLibrary = isInLibrary;
        if (isInLibrary) cachedGame.gamestatus = 6;
        else cachedGame.gamestatus = null;
        updateStatusIndicators(gameId, cachedGame);
    }
}

async function changeGameStatus(gameId, statusId) {
    const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
    // Optimistic UI update
    if (cachedGame) {
        cachedGame.gamestatus = statusId;
        const statusContainer = document.querySelector(`[data-status-for="${gameId}"]`);
        if (statusContainer) {
            const badgeEl = statusContainer.querySelector('.h-7');
            if (badgeEl) badgeEl.outerHTML = renderStatusBadgeHTML(statusId);
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
                cachedGame.gamestatus = null;
                const statusContainer = document.querySelector(`[data-status-for="${gameId}"]`);
                if (statusContainer) {
                    const badgeEl = statusContainer.querySelector('.h-7');
                    if (badgeEl) badgeEl.outerHTML = renderStatusBadgeHTML(cachedGame.gamestatus);
                }
            }
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

async function addToFavorites(gameId) {
    try {
        const response = await apiRequest(`/api/Steam/catalog/favorite/${gameId}`, { method: 'POST' });
        if (response.ok) {
            const result = await response.json();
            const isFavorite = result.isFavorite;
            const gameTitle = allGames.find(g => (g.externalId || g.id) == gameId)?.title || "Game";
            showToast(`"${gameTitle}" ${isFavorite ? 'added to' : 'removed from'} favorites!`, isFavorite ? 'favorite' : 'unfavorite');
            updateFavoriteUI(gameId, isFavorite);
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
}

function updateFavoriteUI(gameId, isFavorite) {
    const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
    if (cachedGame) {
        cachedGame.isFavorite = isFavorite;
        if (isFavorite) cachedGame.isInWishlist = false;
        updateStatusIndicators(gameId, cachedGame);
    }

    // On wishlist page, if favorited, it might be removed from wishlist (backend logic usually handles this Move)
    // If backend returns isInWishlist false, updateWishlistUI will handle it.
}

function logout() { clearAuthData(); window.location.href = '../../../Auth/Html/login.html'; }
