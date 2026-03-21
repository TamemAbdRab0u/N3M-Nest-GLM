// Pagination state
let currentPage = 1;
let currentQuery = ''; // Store current search query
let currentGenre = ''; // Store current genre filter
let currentPlatform = ''; // Store current platform filter
let currentOrdering = ''; // Store current sorting/ordering
let currentRelease = ''; // Store current release year filter
let currentStatus = ''; // Store current game status filter
let gamesPerPage = 12; // Reverted back to 12 per user request
let allGames = []; // Will store just the current page of games now
let currentView = 'catalog'; // 'catalog', 'library', 'favorites'
let isCatalogLoading = false;
let hasMoreCatalogPages = true;

// Force manual scroll restoration to control it via History API
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

/**
 * --- HISTORY API STATE MANAGEMENT ---
 * Saves the current dashboard state (scroll, view, filters, etc.)
 */
function savePageState() {
    const scrollContainer = document.querySelector('.content-area');
    if (!scrollContainer) return;

    const scrollPos = scrollContainer.scrollTop;

    const state = {
        scrollPos: scrollPos,
        loadedCount: allGames.length,
        currentPage,
        currentView,
        currentQuery,
        currentGenre,
        currentGenreLabel: document.getElementById('current-category')?.textContent,
        currentPlatform,
        currentPlatformLabel: document.getElementById('current-platform')?.textContent,
        currentOrdering,
        currentOrderingLabel: document.getElementById('current-rating')?.textContent,
        currentRelease,
        currentReleaseLabel: document.getElementById('current-release')?.textContent,
        currentStatus,
        currentStatusLabel: document.getElementById('current-status')?.textContent,
        hasMoreCatalogPages,
        allGames: allGames // Store data for instant restoration
    };

    // Update current history entry with our state
    history.replaceState(state, '');

    // Also save to sessionStorage for cross-page navigation (e.g., returning from Profile)
    // This acts as a "Session Checkpoint"
    sessionStorage.setItem('DASHBOARD_CHECKPOINT', JSON.stringify(state));

    return state;
}

/**
 * Restores the dashboard state from History API
 */
async function restorePageState() {
    // Check if this is a page reload. If so, don't restore state, let it fetch fresh.
    const navEntries = performance.getEntriesByType("navigation");
    if (navEntries.length > 0 && navEntries[0].type === "reload") {
        console.log("Page was reloaded, clearing dashboard checkpoint to fetch fresh data.");
        sessionStorage.removeItem('DASHBOARD_CHECKPOINT');
        sessionStorage.removeItem('PRE_SEARCH_CHECKPOINT');
        history.replaceState(null, '');
        return false;
    }

    let state = history.state;

    // If no history state (direct navigation/link click), check sessionStorage
    if (!state || !state.currentView) {
        const saved = sessionStorage.getItem('DASHBOARD_CHECKPOINT');
        if (saved) {
            const parsed = JSON.parse(saved);

            // Safety: Only restore if the URL view matches the saved view, 
            // OR if the URL has no explicit view.
            const urlParams = new URLSearchParams(window.location.search);
            const urlView = urlParams.get('view');

            if (!urlView || urlView === parsed.currentView) {
                state = parsed;
                // Sync history state so future back buttons work correctly
                history.replaceState(state, '');
                console.log('Restoring from Session Checkpoint...', state);
            }
        }
    }

    if (!state || !state.currentView) return false;

    console.log('Restoring from History State...', state);
    return await applyStateToDashboard(state);
}

/**
 * Applies a specific state object to the dashboard UI and variables
 */
async function applyStateToDashboard(state) {
    if (!state || !state.currentView) return false;

    // Restore variables
    currentView = state.currentView;
    currentPage = state.currentPage;
    currentQuery = state.currentQuery;
    currentGenre = state.currentGenre;
    currentPlatform = state.currentPlatform;
    currentOrdering = state.currentOrdering;
    currentRelease = state.currentRelease;
    currentStatus = state.currentStatus;
    hasMoreCatalogPages = state.hasMoreCatalogPages;

    // Apply View UI (without triggering a fresh loadGames call)
    selectView(currentView, true);

    // Restore UI Labels for filters
    if (state.currentGenreLabel && document.getElementById('current-category'))
        document.getElementById('current-category').textContent = state.currentGenreLabel;
    if (state.currentPlatformLabel && document.getElementById('current-platform'))
        document.getElementById('current-platform').textContent = state.currentPlatformLabel;
    if (state.currentOrderingLabel && document.getElementById('current-rating'))
        document.getElementById('current-rating').textContent = state.currentOrderingLabel;
    if (state.currentReleaseLabel && document.getElementById('current-release'))
        document.getElementById('current-release').textContent = state.currentReleaseLabel;
    if (state.currentStatusLabel && document.getElementById('current-status'))
        document.getElementById('current-status').textContent = state.currentStatusLabel;

    // Toggle active-filter-btn classes if needed
    if (currentGenre) document.getElementById('category-filter-btn')?.classList.add('active-filter-btn');
    if (currentPlatform) document.getElementById('platform-filter-btn')?.classList.add('active-filter-btn');
    if (currentOrdering) document.getElementById('rating-filter-btn')?.classList.add('active-filter-btn');
    if (currentRelease) document.getElementById('release-filter-btn')?.classList.add('active-filter-btn');
    if (currentStatus) document.getElementById('status-filter-btn')?.classList.add('active-filter-btn');

    // If we have saved allGames, render them immediately
    if (state.allGames && Array.isArray(state.allGames) && state.allGames.length > 0) {
        allGames = state.allGames;
        displayGames(allGames);

        // Sync UI counters
        const totalGamesElement = document.getElementById('total-games');
        if (totalGamesElement) {
            if (currentView === 'catalog') {
                totalGamesElement.textContent = currentQuery ? `Search Results` : `${allGames.length} loaded`;
            } else {
                totalGamesElement.textContent = `${allGames.length} total`;
            }
        }
    } else if (state.loadedCount > 0) {
        // Fallback: reload if data is missing but count was saved
        if (currentView === 'catalog' && !currentQuery && !currentStatus && currentPage > 1) {
            allGames = [];
            for (let p = 1; p <= currentPage; p++) {
                await loadGames(p, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease, currentStatus, true);
            }
        } else {
            await loadGames(currentPage, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease, currentStatus, true);
        }
    }

    // After rendering, restore scroll position
    const scrollContainer = document.querySelector('.content-area');
    if (scrollContainer && state.scrollPos > 0) {
        const jump = () => {
            if (scrollContainer.scrollTo) {
                scrollContainer.scrollTo({
                    top: state.scrollPos,
                    behavior: 'auto'
                });
            } else {
                scrollContainer.scrollTop = state.scrollPos;
            }
        };

        // Immediate jump
        jump();

        // Follow-up jumps to counter delayed layout shifts
        setTimeout(jump, 50);
        setTimeout(jump, 150);
        setTimeout(jump, 300);
        setTimeout(jump, 500);
        setTimeout(jump, 1000); // Final check
    }

    // Restore search input UI
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.value = currentQuery || '';
    }

    // Toggle Back Button visibility
    const backBtn = document.getElementById('search-back-btn');
    if (backBtn) {
        if (currentQuery) backBtn.classList.remove('hidden');
        else backBtn.classList.add('hidden');
    }

    return true;
}

// Toast Notification State
let activeToast = null;
let toastTimeout = null;

// Helper function to convert DateTime to relative time
function getRelativeTime(dateString) {
    if (!dateString) return '';

    // Fix C# date format: replace space with T and append Z to treat as UTC
    // e.g. "2026-02-28 10:53:28" → "2026-02-28T10:53:28Z"
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

// --- Status Icon Map (Shared with Library logic) ---
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

/**
 * Renders the small circular status indicators (Fav/Wish/Lib)
 */
function renderInventoryIndicatorsHTML(game) {
    if (!game) return '';
    return `
        <div class="flex items-center gap-1.5 h-8">
            ${game.isInWishlist ? `
                <div class="h-8 w-10 rounded-full border border-blue-400/30 flex items-center justify-center backdrop-blur-sm shadow-sm" title="In Wishlist">
                    <span class="material-symbols-outlined text-[15px] text-blue-400 fill-icon">bookmark</span>
                </div>` : ''}
            ${game.isFavorite ? `
                <div class="h-8 w-10 rounded-full border border-red-500/30 flex items-center justify-center backdrop-blur-sm shadow-sm" title="Favorited">
                    <span class="material-symbols-outlined text-[15px] text-red-500 fill-icon">favorite</span>
                </div>` : ''}
            ${game.isInLibrary ? `
                <div class="h-8 w-10 rounded-full border border-green-500/30 flex items-center justify-center backdrop-blur-sm shadow-sm" title="In Library">
                    <span class="material-symbols-outlined text-[15px] text-green-500 fill-icon">inventory_2</span>
                </div>` : ''}
        </div>
    `;
}

/**
 * Renders the new horizontal status selector (Library Style)
 */
function renderStatusBadgeHTML(gamestatus, gameId, isUpdating = false, alignment = 'justify-start', readOnly = false) {
    if (!gamestatus) return '';
    const key = String(gamestatus).toLowerCase();
    const statusObj = STATUS_ICON_MAP[key] || { icon: 'schedule', color: 'text-slate-400', label: 'Pending' };

    const animationClass = isUpdating ? 'status-update-flash' : '';

    // Read-only mode: icon-only at rest, expands to show label on card hover (no selector)
    if (readOnly) {
        return `
        <div class="relative min-h-[32px] flex items-center ${alignment} ${animationClass}">
            <div class="h-8 px-2.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-md shadow-lg flex items-center min-w-[32px] overflow-hidden transition-all duration-300 cursor-default" title="${statusObj.label}">
                <span class="material-symbols-outlined text-[16px] ${statusObj.color} fill-icon shrink-0">${statusObj.icon || 'check_circle'}</span>
                <span class="max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-500 ease-out text-[10px] uppercase font-bold ${statusObj.color} whitespace-nowrap">${statusObj.label}</span>
            </div>
        </div>
    `;
    }

    const selectorItems = [
        { id: '1', icon: 'play_circle', color: 'text-primary', label: 'Playing' },
        { id: '3', icon: 'task_alt', color: 'text-green-500', label: 'Completed' },
        { id: '5', icon: 'pause_circle', color: 'text-yellow-500', label: 'On Hold' },
        { id: '4', icon: 'do_not_disturb_on', color: 'text-red-400', label: 'Dropped' }
    ];

    const isRightAligned = alignment === 'justify-end';

    const selectorPositionClass = isRightAligned 
        ? 'right-0 translate-x-4' 
        : 'left-0 -translate-x-4';

    return `
        <div class="group/status relative min-h-[32px] flex items-center ${alignment} ${animationClass}">
            <!-- Badge: Icon-only (Initial) -> Expands on Card Hover -> Hidden on Status Hover -->
            <div class="h-8 px-2.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-md shadow-lg transform-gpu transition-all duration-300 flex items-center group-hover/status:opacity-0 group-hover/status:scale-90 group-hover/status:pointer-events-none min-w-[32px] overflow-hidden" title="${statusObj.label}">
                <span class="material-symbols-outlined text-[16px] ${statusObj.color} fill-icon shrink-0">${statusObj.icon || 'check_circle'}</span>
                <span class="max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-500 ease-out text-[10px] uppercase font-bold ${statusObj.color} whitespace-nowrap">
                    ${statusObj.label}
                </span>
            </div>

            <!-- Selector: Hidden -> Visible only on Status Hover -->
            <div class="absolute ${selectorPositionClass} flex items-center gap-1.5 opacity-0 pointer-events-none group-hover/status:opacity-100 group-hover/status:translate-x-0 group-hover/status:pointer-events-auto transition-all duration-300 z-50">
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

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = '../../Auth/Html/login.html';
        return;
    }

    // Display user info
    displayUserInfo();

    // Check for saved state (Back navigation or Link click from other page)
    const wasRestored = await restorePageState();

    if (!wasRestored) {
        // Normal initialization if no history state
        const urlParams = new URLSearchParams(window.location.search);
        const requestedView = urlParams.get('view') || 'catalog';
        const requestedGenre = urlParams.get('genre');

        selectView(requestedView);

        // Apply genre filter if specified in URL
        if (requestedGenre && requestedView === 'library') {
            currentGenre = requestedGenre;
            const currentCatDisplay = document.getElementById('current-category');
            const catBtn = document.getElementById('category-filter-btn');
            if (currentCatDisplay) currentCatDisplay.textContent = requestedGenre;
            if (catBtn) catBtn.classList.add('active-filter-btn');
            loadGames(1, '', requestedGenre, '', '', '', '');
        }
    }

    initializeNavigation();
    initializePagination();
    initializeCatalogInfiniteScroll();
    initializeSearch();
    initializeScrollToTopButton();

    // Save state before leaving the page (e.g., clicking a link to Profile)
    window.addEventListener('beforeunload', savePageState);
});

function initializeCatalogInfiniteScroll() {
    const scrollContainer = document.querySelector('.content-area');
    if (!scrollContainer) return;

    // Load next page on scroll
    scrollContainer.addEventListener('scroll', handleCatalogInfiniteScroll, { passive: true });

    // Save state on scroll (Checkpoint)
    let scrollTimeout;
    scrollContainer.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(savePageState, 150);
    }, { passive: true });
}

/**
 * Initializes the Go to Top button visibility and click behavior
 */
function initializeScrollToTopButton() {
    const btn = document.getElementById('scroll-to-top');
    const scrollContainer = document.querySelector('.content-area');

    if (!btn || !scrollContainer) return;

    // Show/hide button based on scroll position
    scrollContainer.addEventListener('scroll', () => {
        if (scrollContainer.scrollTop > 600) {
            btn.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');
            btn.classList.add('opacity-100', 'translate-y-0');
        } else {
            btn.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
            btn.classList.remove('opacity-100', 'translate-y-0');
        }
    }, { passive: true });

    // Click handler is already handled via scrollToTop() if needed, 
    // but let's add it explicitly for the specific button
    btn.addEventListener('click', () => {
        scrollToTop();
    });
}

function handleCatalogInfiniteScroll() {
    if (currentView !== 'catalog' || !!currentQuery || !!currentStatus || isCatalogLoading || !hasMoreCatalogPages) {
        return;
    }

    const scrollContainer = document.querySelector('.content-area');
    const threshold = 400; // Increased threshold for smoother infinite loading
    let nearBottom = false;

    if (scrollContainer) {
        nearBottom = (scrollContainer.scrollTop + scrollContainer.clientHeight) >= (scrollContainer.scrollHeight - threshold);
    } else {
        nearBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - threshold);
    }

    if (nearBottom) {
        loadGames(currentPage + 1, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease, currentStatus);
    }
}

// Display user information
function displayUserInfo() {
    const userInfo = getUserInfo();
    const usernameElements = document.querySelectorAll('#display-username, #welcome-username, #display-username-top');
    const avatarContainers = document.querySelectorAll('#display-avatar, #display-avatar-top, #display-avatar-header');

    usernameElements.forEach(el => {
        el.textContent = userInfo.userName || 'User';
    });

    if (userInfo.userName) {
        avatarContainers.forEach(container => {
            container.textContent = userInfo.userName.charAt(0).toUpperCase();
        });
    }

    // Fetch actual profile to update name and avatar if they exist
    fetchProfileInfo();
}

async function fetchProfileInfo() {
    try {
        const response = await apiRequest('/api/Profile');
        if (response.ok) {
            const profile = await response.json();
            const usernameElements = document.querySelectorAll('#display-username, #welcome-username, #display-username-top');
            const avatarContainers = document.querySelectorAll('#display-avatar, #display-avatar-top, #display-avatar-header');

            if (profile.displayName) {
                usernameElements.forEach(el => {
                    el.textContent = profile.displayName;
                });

                // Update local storage too to keep it consistent
                const userInfo = getUserInfo();
                userInfo.userName = profile.displayName;
                saveAuthData(userInfo);
            }

            const resolvedAvatar = profile.avatarUrl;
            if (resolvedAvatar && avatarContainers.length > 0) {
                avatarContainers.forEach(container => {
                    container.innerHTML = `<img src="${API_URL}/Uploads/${resolvedAvatar}" class="h-full w-full object-cover">`;

                    // Remove background gradient from parent div if it exists
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
        console.error('Error fetching profile into dashboard:', error);
    }
}

function selectView(view, isRestoring = false) {
    currentView = view;
    if (!isRestoring) {
        currentPage = 1;
        currentQuery = '';
        currentGenre = ''; // Reset genre filter
        currentPlatform = ''; // Reset platform filter
        currentOrdering = ''; // Reset ordering filter
        currentRelease = ''; // Reset release filter
        currentStatus = ''; // Reset status filter
    }

    // Reset dropdown UI (only if not restoring, though we usually want UI to match filters)
    const currentCatDisplay = document.getElementById('current-category');
    const catBtn = document.getElementById('category-filter-btn');
    if (currentCatDisplay && !isRestoring) currentCatDisplay.textContent = 'Category';
    if (catBtn && !isRestoring) catBtn.classList.remove('active-filter-btn');

    const currentPlatDisplay = document.getElementById('current-platform');
    const platBtn = document.getElementById('platform-filter-btn');
    if (currentPlatDisplay && !isRestoring) currentPlatDisplay.textContent = 'Platforms';
    if (platBtn && !isRestoring) platBtn.classList.remove('active-filter-btn');

    const currentRatingDisplay = document.getElementById('current-rating');
    const ratingBtn = document.getElementById('rating-filter-btn');
    if (currentRatingDisplay && !isRestoring) currentRatingDisplay.textContent = 'Rating';
    if (ratingBtn && !isRestoring) ratingBtn.classList.remove('active-filter-btn');

    const currentReleaseDisplay = document.getElementById('current-release');
    const releaseBtn = document.getElementById('release-filter-btn');
    if (currentReleaseDisplay && !isRestoring) currentReleaseDisplay.textContent = 'Release';
    if (releaseBtn && !isRestoring) releaseBtn.classList.remove('active-filter-btn');

    const currentStatusDisplay = document.getElementById('current-status');
    const statusBtn = document.getElementById('status-filter-btn');
    const statusFilterContainer = document.getElementById('status-filter-container');
    if (currentStatusDisplay && !isRestoring) currentStatusDisplay.textContent = 'Status';
    if (statusBtn && !isRestoring) statusBtn.classList.remove('active-filter-btn');

    // Only show status filter for My Library and Favorites
    if (statusFilterContainer) {
        if (view === 'library' || view === 'favorites') {
            statusFilterContainer.classList.remove('hidden');
        } else {
            statusFilterContainer.classList.add('hidden');
        }
    }

    // Update Nav UI
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active', 'bg-primary/10', 'text-primary');
        el.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-white/5');
    });

    const activeNav = document.getElementById(`nav-${view}`);
    if (activeNav) {
        activeNav.classList.add('active', 'bg-primary/10', 'text-primary');
        activeNav.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-white/5');
    }

    // Update Header Text
    const headerTitle = document.querySelector('.header-title') || document.querySelector('h2');

    if (headerTitle) {
        if (view === 'catalog') headerTitle.textContent = 'Catalog Games';
        else if (view === 'library') headerTitle.textContent = 'My Library';
        else if (view === 'favorites') headerTitle.textContent = 'Favorites';
        else if (view === 'wishlist') headerTitle.textContent = 'Wishlist';
        else if (view === 'community') headerTitle.textContent = 'Community';
    }

    if (!isRestoring) {
        loadGames(1, '', '', '', '', '', '');
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
    for (let i = 0; i < count; i++) container.appendChild(createSkeletonCard());
}

// Load games from API (handles both catalog and search)
async function loadGames(page = 1, query = '', genre = '', platform = '', ordering = '', release = '', status = '', isRestoring = false) {
    // CRITICAL: Update global state variables BEFORE calling child UI functions
    // This ensures things like displayGames() know they are in 'search' mode immediately.
    if (!isRestoring) {
        currentPage = page;
        currentQuery = query;
        currentGenre = genre;
        currentPlatform = platform;
        currentOrdering = ordering;
        currentRelease = release;
        currentStatus = status;
    }

    const container = document.getElementById('library-games');
    const totalGamesElement = document.getElementById('total-games');
    const isCatalog = currentView === 'catalog' && !status;
    const isAppendCatalogRequest = isCatalog && !query && page > 1;

    if (isCatalog && page === 1) {
        hasMoreCatalogPages = true;
    }

    if (isAppendCatalogRequest && (!hasMoreCatalogPages || isCatalogLoading)) {
        return;
    }
    // Ensure element exists before setting textContent
    if (!totalGamesElement) {
        console.warn('Total games element not found');
    }

    // Toggle Search Back Button visibility
    const backBtn = document.getElementById('search-back-btn');
    if (backBtn) {
        if (query) backBtn.classList.remove('hidden');
        else backBtn.classList.add('hidden');
    }

    if (isCatalog) isCatalogLoading = true;

    if (!isAppendCatalogRequest) {
        if (container) showSkeletonCards(container, 8);
    } else {
        toggleCatalogAppendLoader(true);
    }

    try {
        let endpoint;
        let gamesData = [];
        let result;

        if (currentView === 'catalog' && !status) {
            if (query) {
                endpoint = `/api/Steam/catalog/search?query=${encodeURIComponent(query)}`;
            } else {
                endpoint = `/api/Steam/catalog/GetAll?page=${page}`;
                if (genre) endpoint += `&genre=${encodeURIComponent(genre)}`;
                if (platform) endpoint += `&platforms=${encodeURIComponent(platform)}`;
                if (ordering) endpoint += `&ordering=${encodeURIComponent(ordering)}`;
                if (release) endpoint += `&dates=${encodeURIComponent(release)}`;
            }
        } else {
            // Fetch user games for Library/Favorites/Wishlist OR when filtering catalog by status
            if (status) {
                endpoint = `/api/UserGames/GetByStatus/${status}`;
            } else {
                endpoint = `/api/UserGames/GetAllUserGames`;
            }
        }

        const response = await apiRequest(endpoint, {
            method: 'GET'
        });

        if (!response.ok) {
            // Handle 404 as empty collection (optional since we fixed backend, but good for safety)
            if (response.status === 404) {
                result = [];
            } else {
                throw new Error('Failed to load games');
            }
        } else {
            result = await response.json();
        }

        // Transform UserGames DTO if needed and filter
        if (currentView !== 'catalog' || status) {
            // Map UserGamesResponseDto to display format
            gamesData = result.map(ug => {
                // Determine if in library based on status
                // Backend returns enum as string "whishlist" or int 2
                const inLibrary = ug.gamestatus !== 'whishlist' && ug.gamestatus !== 2;
                const inWishlist = ug.isInWishlist === true;

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
                    isInWishlist: inWishlist,
                    gamestatus: ug.gamestatus,
                    addedAt: ug.addedAt
                };
            });

            // Filter for Library view (exclude wishlist-only games)
            if (currentView === 'library') {
                gamesData = gamesData.filter(g => g.isInLibrary);
            }

            // Filter Wishlist
            if (currentView === 'wishlist') {
                gamesData = gamesData.filter(g => g.isInWishlist);
            }

            // Filter Favorites
            if (currentView === 'favorites') {
                gamesData = gamesData.filter(g => g.isFavorite);
            }

            // Client-side search and filters
            if (query) {
                const lowerQ = query.toLowerCase();
                gamesData = gamesData.filter(g => g.title.toLowerCase().includes(lowerQ));
            }

            // Apply filters locally for user collections
            if (genre) {
                // genre is a slug (e.g., 'action' or 'role-playing-games-rpg'); g.genres are names (e.g., 'RPG')
                // Using inclusion instead of equality to handle cases like 'RPG' vs 'role-playing-games-rpg'
                gamesData = gamesData.filter(g =>
                    g.genres.some(name => {
                        const lowerName = name.toLowerCase();
                        const lowerGenre = genre.toLowerCase();
                        return lowerName === lowerGenre ||
                            lowerGenre.includes(lowerName) ||
                            lowerName.includes(lowerGenre);
                    })
                );
            }

            if (platform) {
                // platform is a RAWG parent platform ID (1=pc, 2=playstation, etc.)
                // g.platforms are parent platform slugs
                const platformMap = {
                    '1': 'pc', '2': 'playstation', '3': 'xbox', '4': 'ios',
                    '5': 'mac', '6': 'linux', '7': 'nintendo', '8': 'android'
                };
                const targetSlug = platformMap[platform];
                if (targetSlug) {
                    gamesData = gamesData.filter(g =>
                        g.platforms.some(slug => slug.toLowerCase() === targetSlug)
                    );
                }
            }

            if (release) {
                // release is "YYYY-MM-DD,YYYY-MM-DD"
                const [start, end] = release.split(',').map(d => new Date(d));
                gamesData = gamesData.filter(g => {
                    const gameDate = new Date(g.releaseDate);
                    return gameDate >= start && gameDate <= end;
                });
            }

            if (status) {
                // status could be numeric ID or name string
                const statusMap = {
                    '1': 'playing', '2': 'whishlist', '3': 'completed',
                    '4': 'dropped', '5': 'onhold', '6': 'pending'
                };
                const targetValue = String(status).toLowerCase();
                const targetName = statusMap[targetValue] || targetValue;

                gamesData = gamesData.filter(g => {
                    const s = String(g.gamestatus).toLowerCase();
                    // Match either numeric ID or name string
                    return s === targetValue || s === targetName;
                });
            }

            if (ordering) {
                if (ordering === 'rating') {
                    gamesData.sort((a, b) => (a.rating || 0) - (b.rating || 0));
                } else if (ordering === '-rating') {
                    gamesData.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                } else if (ordering === 'released') {
                    gamesData.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
                } else if (ordering === '-released') {
                    gamesData.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
                }
            }

        } else {
            gamesData = result; // Already in RAWG format

            // Annotate catalog games with user status
            try {
                const userGamesResp = await apiRequest('/api/UserGames/GetAllUserGames', { method: 'GET' });
                if (userGamesResp.ok) {
                    const userGames = await userGamesResp.json();
                    const userGamesMap = new Map();
                    userGames.forEach(ug => {
                        if (ug.externalId) userGamesMap.set(String(ug.externalId), ug);
                    });

                    gamesData = gamesData.map(game => {
                        const gameId = String(game.externalId || game.id);
                        const ug = userGamesMap.get(gameId);
                        if (ug) {
                            return {
                                ...game,
                                isFavorite: ug.isFavorite,
                                isInLibrary: ug.gamestatus !== 'whishlist' && ug.gamestatus !== 2,
                                isInWishlist: ug.isInWishlist === true,
                                gamestatus: ug.gamestatus
                            };
                        }
                        return game;
                    });
                }
            } catch (error) {
                console.error('Error annotating catalog games:', error);
            }
        }

        // --- NEW PAGINATION LOGIC FOR USER COLLECTIONS ---
        if (currentView !== 'catalog') {
            const totalItems = gamesData.length;
            const totalPages = Math.ceil(totalItems / gamesPerPage);

            // Slice the relevant page
            const startIndex = (page - 1) * gamesPerPage;
            allGames = gamesData.slice(startIndex, startIndex + gamesPerPage);

            if (allGames && allGames.length > 0) {
                if (totalGamesElement) {
                    const from = startIndex + 1;
                    const to = startIndex + allGames.length;
                    totalGamesElement.textContent = `${totalItems} total • Showing ${from}-${to}`;
                }
                displayGames(allGames);
            } else {
                handleEmptyState(container, totalGamesElement, query);
            }

            updatePaginationControls(page, query, genre, platform, ordering, release, status, {
                total: totalItems,
                count: allGames.length,
                isCatalog: false
            });
        } else {
            if (isAppendCatalogRequest) {
                if (!gamesData || gamesData.length === 0) {
                    hasMoreCatalogPages = false;
                } else {
                    allGames = [...allGames, ...gamesData];
                    appendGames(gamesData);
                    if (gamesData.length < gamesPerPage) {
                        hasMoreCatalogPages = false;
                    }
                }

                if (totalGamesElement) {
                    totalGamesElement.textContent = `${allGames.length} loaded`;
                }
            } else {
                allGames = gamesData;
                hasMoreCatalogPages = gamesData.length >= gamesPerPage;
                if (allGames && allGames.length > 0) {
                    if (totalGamesElement) {
                        totalGamesElement.textContent = (query) ? `Search Results` : `${allGames.length} loaded`;
                    }
                    displayGames(allGames);
                } else {
                    handleEmptyState(container, totalGamesElement, query);
                }
            }

            if (allGames && allGames.length > 0) {
                if (totalGamesElement) {
                    totalGamesElement.textContent = (query) ? `Search Results` : `${allGames.length} loaded`;
                }
            } else if (!isAppendCatalogRequest) {
                handleEmptyState(container, totalGamesElement, query);
            }

            updatePaginationControls(page, query, genre, platform, ordering, release, '', {
                count: allGames.length,
                isCatalog: true
            });
        }

    } catch (error) {
        console.error('Error loading games:', error);
        if (container) container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-24 text-red-500/80">
                <span class="material-symbols-outlined text-7xl mb-4">cloud_off</span>
                <p class="text-lg font-medium">Unable to connect to the server.</p>
                <p class="text-sm mt-2 opacity-70">Please check your internet connection or try refreshing the page.</p>
                <button onclick="window.location.reload()" class="mt-6 px-6 py-2 bg-red-500/10 border border-red-500/30 rounded-full hover:bg-red-500 hover:text-white transition-all">
                    Retry Connection
                </button>
            </div>
        `;
        if (totalGamesElement) totalGamesElement.textContent = 'Connection Error';
    }
    finally {
        if (isCatalog) isCatalogLoading = false;
        if (isAppendCatalogRequest) toggleCatalogAppendLoader(false);

        // Save state after loading more games
        if (!isRestoring) {
            savePageState();
        }
    }
}

function toggleCatalogAppendLoader(show) {
    const container = document.getElementById('library-games');
    if (!container) return;

    const id = 'catalog-append-loader';
    const existing = document.getElementById(id);

    if (!show) {
        if (existing) existing.remove();
        return;
    }

    if (existing) return;

    const loader = document.createElement('div');
    loader.id = id;
    loader.className = 'col-span-full flex justify-center py-6 text-slate-500';
    loader.innerHTML = '<div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>';
    container.appendChild(loader);
}


function handleEmptyState(container, totalGamesElement, query) {
    let emptyMessage = "No games found.";
    let icon = "videogame_asset_off";

    if (query) {
        emptyMessage = `No results found for "${query}"`;
        icon = "search_off";
    } else if (currentView === 'library') {
        emptyMessage = "Your library is currently empty. Start adding games from the catalog!";
        icon = "library_add";
    } else if (currentView === 'favorites') {
        emptyMessage = "You haven't favorited any games yet. Explore the catalog to find your favorites!";
        icon = "heart_plus";
    } else if (currentView === 'wishlist') {
        emptyMessage = "Your wishlist is empty. Discover games you want to play!";
        icon = "bookmark_add";
    }

    if (container) container.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-24 text-slate-500 opacity-60">
            <span class="material-symbols-outlined text-7xl mb-4">${icon}</span>
            <p class="text-lg font-medium">${emptyMessage}</p>
            ${currentView !== 'catalog' ? `
                <button onclick="selectView('catalog')" class="mt-6 px-6 py-2 bg-primary/20 text-primary border border-primary/30 rounded-full hover:bg-primary hover:text-white transition-all">
                    Browse Catalog
                </button>
            ` : ''}
        </div>
    `;
    if (totalGamesElement) totalGamesElement.textContent = 'None';
}


// Display games
function displayGames(games) {
    const container = document.getElementById('library-games');
    if (!container) return;

    // Toggle layout class based on view and search query
    // If we're in catalog and HAVE a search query, use vertical simple view.
    if (currentView === 'catalog' && currentQuery) {
        container.classList.add('vertical-search-view');
        // Remove standard grid classes
        container.classList.remove('grid', 'grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4');
    } else {
        container.classList.remove('vertical-search-view');
        // Add standard grid classes
        container.classList.add('grid', 'grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4');
    }

    container.innerHTML = '';
    games.forEach(game => {
        container.appendChild(createGameCard(game));
    });
}

function appendGames(games) {
    const container = document.getElementById('library-games');
    if (!container) return;

    games.forEach(game => {
        container.appendChild(createGameCard(game));
    });
}

// Create game card element
function createGameCard(game) {
    if (currentView === 'catalog' && currentQuery) {
        return createVerticalGameCard(game);
    } else {
        return createGridGameCard(game);
    }
}

// THE NEW: Simple Vertical Search Result Card
function createVerticalGameCard(game) {
    const card = document.createElement('div');
    card.className = 'vertical-result-card group cursor-pointer';

    const fallbackImage = '../../Assets/Images/logo.png';
    const imageUrl = game.imageUrl || game.imgUrl || game.backgroundImage || game.background_image;
    const isImageInvalid = !imageUrl || String(imageUrl) === 'null' || String(imageUrl) === 'undefined' || imageUrl === '';
    const safeImageUrl = isImageInvalid ? fallbackImage : imageUrl;

    const hqLandscapeImageUrl = (!isImageInvalid && String(safeImageUrl).includes('/header.jpg'))
        ? String(safeImageUrl).replace('/header.jpg', '/capsule_616x353.jpg')
        : safeImageUrl;

    const title = game.title || game.name || 'Unknown Game';
    const gameId = game.externalId || game.id;

    // Release Year
    let releaseYear = '';
    const rawRelease = game.releaseDate || game.released || game.release_date || '';
    if (rawRelease) {
        const parsedDate = new Date(rawRelease);
        if (!Number.isNaN(parsedDate.getTime())) releaseYear = parsedDate.getFullYear();
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

    const favBtnClass = game.isFavorite ? 'text-red-500' : 'text-white/40 hover:text-red-400';
    const libClass = game.isInLibrary ? 'text-green-500' : 'text-white/40 hover:text-primary';
    const wishlistClass = game.isInWishlist ? 'text-blue-400' : 'text-white/40 hover:text-blue-400';

    card.innerHTML = `
        <div class="thumb-container">
            <img src="${hqLandscapeImageUrl}" 
                 data-fallback-src="${safeImageUrl}"
                 onerror="if (this.src !== this.dataset.fallbackSrc) { this.src = this.dataset.fallbackSrc; return; } this.src='${fallbackImage}';" 
                 class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                 alt="${title}">
            ${platformIcons}
            ${game.isInLibrary ? `<div class="absolute top-2 right-2 bg-green-500/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md border border-white/10 z-20">IN LIBRARY</div>` : ''}
        </div>
        
        <div class="content-container flex flex-col justify-center gap-1.5">
            <div class="flex items-center gap-3">
                <h3 class="title-text truncate max-w-[400px]" title="${title}">${title}</h3>
                ${releaseYear ? `<span class="bg-[#242b31] px-2.5 py-1 rounded-md text-[11px] font-bold text-slate-500 tracking-wider h-fit">${releaseYear}</span>` : ''}
            </div>
            
            <div class="flex flex-wrap gap-2">
                ${(game.genres || []).slice(0, 3).map(g => `<span class="genre-pill transition-colors hover:bg-primary/20 hover:text-white cursor-default">${(typeof g === 'string' ? g : g.name).toUpperCase()}</span>`).join('')}
                ${game.isInLibrary && game.addedAt ? `<span class="text-[9px] text-slate-600 font-bold uppercase tracking-wider ml-4 flex items-center gap-1" data-added-at-for="${gameId}"><span class="material-symbols-outlined text-[12px]">history</span> Added ${getRelativeTime(game.addedAt)}</span>` : ''}
            </div>

            <!-- Status Indicator (Now EXACTLY under title and genres, left-aligned) -->
            <div data-status-for="${gameId}" class="flex-shrink-0 min-h-[32px] pt-1">
                ${game.isInLibrary ? renderStatusBadgeHTML(game.gamestatus, gameId) : ''}
            </div>
        </div>

        <!-- The 3 Action Buttons Cluster -->
        <div class="action-cluster flex items-center gap-2 pr-4">
            <button onclick="event.stopPropagation(); addToFavorites('${gameId}')" 
                    id="fav-btn-${gameId}" data-game-id="${gameId}" data-btn-type="favorite"
                    class="w-11 h-11 glass-neon-btn ${favBtnClass}" title="Favorite">
                <span class="material-symbols-outlined text-xl ${game.isFavorite ? 'fill-icon' : ''}">favorite</span>
            </button>
            <button onclick="event.stopPropagation(); addToLibrary('${gameId}')" 
                    id="lib-btn-${gameId}" data-game-id="${gameId}" data-btn-type="library"
                    class="w-11 h-11 glass-neon-btn ${libClass}" title="Add to Library">
                <span class="material-symbols-outlined text-xl ${game.isInLibrary ? 'fill-icon' : ''}">inventory_2</span>
            </button>
            <button onclick="event.stopPropagation(); addToWishlist('${gameId}')" 
                    id="wish-btn-${gameId}" data-game-id="${gameId}" data-btn-type="wishlist"
                    class="w-11 h-11 glass-neon-btn ${wishlistClass}" title="Add to Wishlist">
                <span class="material-symbols-outlined text-xl ${game.isInWishlist ? 'fill-icon' : ''}">bookmark</span>
            </button>
        </div>
    `;

    card.onclick = () => showGameDetails(game);
    return card;
}

// THE OLD: Standard Grid Game Card Component
function createGridGameCard(game) {
    const card = document.createElement('div');
    card.className = 'group bg-[#1e292b] rounded-md overflow-hidden border border-[#2e616b]/10 hover:border-primary/30 transition-all duration-300 relative cursor-pointer';

    const fallbackImage = '../../Assets/Images/logo.png';
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


    // Button states
    const favBtnClass = game.isFavorite ? 'text-red-500' : 'text-white/70 hover:text-red-400';
    const libClass = game.isInLibrary ? 'text-green-500' : 'text-white/70 hover:text-primary';
    const wishlistClass = game.isInWishlist ? 'text-blue-400' : 'text-white/70 hover:text-blue-400';

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
            
            <div class="absolute top-3 right-3 flex flex-col gap-2 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 z-20">
                <button onclick="event.stopPropagation(); addToFavorites('${gameId}')" 
                        class="w-9 h-9 glass-neon-btn ${favBtnClass}" 
                        data-game-id="${gameId}" data-btn-type="favorite" title="Favorite">
                    <span class="material-symbols-outlined text-lg ${game.isFavorite ? 'fill-icon' : ''}">favorite</span>
                </button>
                <button onclick="event.stopPropagation(); addToLibrary('${gameId}')" 
                        class="w-9 h-9 glass-neon-btn ${libClass}" 
                        data-game-id="${gameId}" data-btn-type="library" title="Library">
                    <span class="material-symbols-outlined text-lg ${game.isInLibrary ? 'fill-icon' : ''}">inventory_2</span>
                </button>
                <button onclick="event.stopPropagation(); addToWishlist('${gameId}')" 
                        class="w-9 h-9 glass-neon-btn ${wishlistClass}" 
                        data-game-id="${gameId}" data-btn-type="wishlist" title="Wishlist">
                    <span class="material-symbols-outlined text-lg ${game.isInWishlist ? 'fill-icon' : ''}">bookmark</span>
                </button>
            </div>

            ${platformIcons}

            <!-- Status Indicator -->
            <div class="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1.5" data-status-for="${gameId}">
                ${game.isInLibrary ? renderStatusBadgeHTML(game.gamestatus, gameId, false, 'justify-end', true) : ''}

                ${(currentView !== 'catalog' && game.addedAt) ? `
                    <div class="h-7 px-2.5 rounded-full border border-white/10 bg-slate-900/40 backdrop-blur-md flex items-center justify-center transition-all duration-500 ease-in-out group-hover:w-fit group-hover:px-4 cursor-default shadow-lg group/time transform-gpu will-change-transform" title="Added At">
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
                    <!-- Info Row (Year + Indicators) -->
                    <div class="flex flex-col items-end shrink-0 gap-2.5">
                        ${releaseYear ? `<span class="text-[10px] font-bold text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">${releaseYear}</span>` : ''}
                        <div class="scale-75 origin-top-right" data-inventory-for="${gameId}">
                            ${renderInventoryIndicatorsHTML(game)}
                        </div>
                    </div>
            </div>
        </div>
    `;

    card.onclick = () => showGameDetails(game);
    return card;
}

// Update pagination controls
function updatePaginationControls(page, query, genre, platform, ordering, release, status, paginationInfo) {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const paginationControls = document.getElementById('pagination-controls');

    if (paginationControls) {
        if (paginationInfo.isCatalog) paginationControls.classList.add('hidden');
        else paginationControls.classList.remove('hidden');
    }

    if (prevBtn) prevBtn.disabled = page === 1;

    if (paginationInfo.isCatalog) {
        // Catalog uses simple logic: if count < pageSize, we're at the end
        if (pageInfo) pageInfo.textContent = (query) ? 'Search Results' : `${allGames.length} loaded`;

        if (nextBtn) {
            if (query) {
                nextBtn.disabled = true; // Search is usually 1 page or deep pagination not supported
            } else {
                nextBtn.disabled = paginationInfo.count < gamesPerPage;
            }
        }
    } else {
        // User collections have full metadata
        const totalPages = Math.max(1, Math.ceil(paginationInfo.total / gamesPerPage));
        if (pageInfo) pageInfo.textContent = `Page ${page} of ${totalPages}`;

        if (nextBtn) {
            nextBtn.disabled = page >= totalPages;
        }
    }

    // Variables are already updated at the top of loadGames, but we sync them here for callers other than loadGames
    if (page !== undefined) currentPage = page;
    if (query !== undefined) currentQuery = query;
    if (genre !== undefined) currentGenre = genre;
    if (platform !== undefined) currentPlatform = platform;
    if (ordering !== undefined) currentOrdering = ordering;
    if (release !== undefined) currentRelease = release;
    if (status !== undefined) currentStatus = status;
}

// Initialize pagination buttons
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

// Initialize search
function initializeSearch() {
    const searchInput = document.querySelector('.search-bar input');
    const resultsDropdown = document.getElementById('search-results-dropdown');
    const resultsList = document.getElementById('search-results-list');
    const searchLoading = document.getElementById('search-loading');

    if (!searchInput || !resultsDropdown || !resultsList) return;

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (query.length < 2) {
            resultsDropdown.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            // Show loading
            resultsDropdown.classList.remove('hidden');
            resultsList.innerHTML = '';
            searchLoading.classList.remove('hidden');

            try {
                const response = await apiRequest(`/api/Steam/catalog/search?query=${encodeURIComponent(query)}`, { method: 'GET' });
                if (response.ok) {
                    const games = await response.json();
                    renderAjaxSearchResults(games.slice(0, 10), query);
                }
            } catch (error) {
                console.error('AJAX Search error:', error);
            } finally {
                searchLoading.classList.add('hidden');
            }
        }, 300); // 300ms debounce for autocomplete
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                // If we are currently NOT searching, backup the state first
                if (!currentQuery) {
                    const prevState = savePageState();
                    if (prevState) sessionStorage.setItem('PRE_SEARCH_CHECKPOINT', JSON.stringify(prevState));
                }

                resultsDropdown.classList.add('hidden');
                currentPage = 1;
                // Full search - load 10 results (loadGames handles display)
                loadGames(1, query, currentGenre, currentPlatform, currentOrdering, currentRelease, currentStatus);
                searchInput.blur();
            }
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
            resultsDropdown.classList.add('hidden');
        }
    });
}

function renderAjaxSearchResults(games, query) {
    const resultsList = document.getElementById('search-results-list');
    if (!resultsList) return;

    resultsList.innerHTML = '';

    if (games.length === 0) {
        resultsList.innerHTML = `
            <div class="px-4 py-8 text-center">
                <p class="text-sm text-slate-500 font-medium">No games found for "${query}"</p>
            </div>
        `;
        return;
    }

    games.forEach(game => {
        const item = document.createElement('div');
        item.className = 'group flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-all border-b border-white/[0.03] last:border-0';

        const imageUrl = game.imageUrl || game.imgUrl || game.backgroundImage || game.background_image || '../../Assets/Images/default-game.jpg';
        const title = game.title || game.name || 'Unknown Game';

        item.innerHTML = `
            <div class="w-12 h-14 rounded-lg overflow-hidden shrink-0 border border-white/10 shadow-lg">
                <img src="${imageUrl}" alt="${title}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">${title}</h4>
            </div>
            <div class="opacity-0 group-hover:opacity-100 transition-all mr-2">
                <span class="material-symbols-outlined text-primary text-lg">arrow_forward</span>
            </div>
        `;

        item.onclick = () => {
            showGameDetails(game);
            document.getElementById('search-results-dropdown').classList.add('hidden');
        };

        resultsList.appendChild(item);
    });

    // Add "View all results" at bottom
    const viewAll = document.createElement('div');
    viewAll.className = 'px-4 py-3 bg-primary/5 hover:bg-primary/10 text-center cursor-pointer transition-all border-t border-white/5';
    viewAll.innerHTML = `<span class="text-[11px] font-bold text-primary uppercase tracking-widest">Show All Results</span>`;
    viewAll.onclick = () => {
        const searchInput = document.querySelector('.search-bar input');
        const query = searchInput.value.trim();

        // Backup state before switching to full search results
        if (!currentQuery) {
            const prevState = savePageState();
            if (prevState) sessionStorage.setItem('PRE_SEARCH_CHECKPOINT', JSON.stringify(prevState));
        }

        loadGames(1, query, currentGenre, currentPlatform, currentOrdering, currentRelease, currentStatus);
        document.getElementById('search-results-dropdown').classList.add('hidden');
    };
    resultsList.appendChild(viewAll);
}

// Initialize Categories dropdown
async function initializeCategories() {
    const categoryList = document.getElementById('category-list');
    const currentCatDisplay = document.getElementById('current-category');
    const catBtn = document.getElementById('category-filter-btn');
    if (!categoryList) return;

    try {
        const response = await apiRequest('/api/Steam/catalog/genres', { method: 'GET' });
        if (response.ok) {
            const genres = await response.json();

            // Clear loading spinner
            categoryList.innerHTML = '';

            // Add "All Categories" option
            const allOption = document.createElement('button');
            allOption.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
            allOption.textContent = 'All Categories';
            allOption.onclick = () => {
                currentGenre = '';
                if (currentCatDisplay) currentCatDisplay.textContent = 'Category';
                if (catBtn) catBtn.classList.remove('active-filter-btn');
                loadGames(1, currentQuery, '', currentPlatform, currentOrdering, currentRelease, currentStatus);
            };
            categoryList.appendChild(allOption);

            // Add each genre
            genres.forEach(genreStr => {
                // Backend returns "slug:name"
                const [slug, name] = genreStr.includes(':') ? genreStr.split(':') : [genreStr, genreStr];
                const option = document.createElement('button');
                option.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
                option.textContent = name;
                option.onclick = () => {
                    currentGenre = slug;
                    if (currentCatDisplay) currentCatDisplay.textContent = name;
                    if (catBtn) catBtn.classList.add('active-filter-btn');
                    loadGames(1, currentQuery, slug, currentPlatform, currentOrdering, currentRelease, currentStatus);
                };
                categoryList.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading genres:', error);
        categoryList.innerHTML = '<div class="px-4 py-2 text-xs text-red-500">Failed to load genres</div>';
    }
}

// Initialize Platforms dropdown
async function initializePlatforms() {
    const platformList = document.getElementById('platform-list');
    const currentPlatDisplay = document.getElementById('current-platform');
    const platBtn = document.getElementById('platform-filter-btn');
    if (!platformList) return;

    try {
        const response = await apiRequest('/api/Steam/catalog/platforms', { method: 'GET' });
        if (response.ok) {
            const platforms = await response.json();

            // Clear loading spinner
            platformList.innerHTML = '';

            // Add "All Platforms" option
            const allOption = document.createElement('button');
            allOption.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
            allOption.textContent = 'All Platforms';
            allOption.onclick = () => {
                currentPlatform = '';
                if (currentPlatDisplay) currentPlatDisplay.textContent = 'Platforms';
                if (platBtn) platBtn.classList.remove('active-filter-btn');
                loadGames(1, currentQuery, currentGenre, '', currentOrdering, currentRelease, currentStatus);
            };
            platformList.appendChild(allOption);

            // Add each platform
            platforms.forEach(platStr => {
                // Backend returns "id:name"
                const [id, name] = platStr.split(':');
                const option = document.createElement('button');
                option.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
                option.textContent = name;
                option.onclick = () => {
                    currentPlatform = id;
                    if (currentPlatDisplay) currentPlatDisplay.textContent = name;
                    if (platBtn) platBtn.classList.add('active-filter-btn');
                    loadGames(1, currentQuery, currentGenre, id, currentOrdering, currentRelease, currentStatus);
                };
                platformList.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading platforms:', error);
        platformList.innerHTML = '<div class="px-4 py-2 text-xs text-red-500">Failed to load platforms</div>';
    }
}

function setRatingOrdering(ordering, label) {
    currentOrdering = ordering;
    const currentRatingDisplay = document.getElementById('current-rating');
    const ratingBtn = document.getElementById('rating-filter-btn');

    if (currentRatingDisplay) currentRatingDisplay.textContent = label;

    if (!ordering) {
        if (ratingBtn) ratingBtn.classList.remove('active-filter-btn');
    } else {
        if (ratingBtn) ratingBtn.classList.add('active-filter-btn');
    }

    loadGames(1, currentQuery, currentGenre, currentPlatform, ordering, currentRelease, currentStatus);
}

function setStatusFilter(statusId, label) {
    currentStatus = statusId;
    const currentStatusDisplay = document.getElementById('current-status');
    const statusBtn = document.getElementById('status-filter-btn');

    if (currentStatusDisplay) currentStatusDisplay.textContent = label;

    if (!statusId) {
        if (statusBtn) statusBtn.classList.remove('active-filter-btn');
    } else {
        if (statusBtn) statusBtn.classList.add('active-filter-btn');
    }

    loadGames(1, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease, statusId);
}

function clearAllFilters() {
    currentGenre = '';
    currentPlatform = '';
    currentOrdering = '';
    currentRelease = '';
    currentStatus = '';

    const currentCatDisplay = document.getElementById('current-category');
    const catBtn = document.getElementById('category-filter-btn');
    if (currentCatDisplay) currentCatDisplay.textContent = 'Category';
    if (catBtn) catBtn.classList.remove('active-filter-btn');

    const currentPlatDisplay = document.getElementById('current-platform');
    const platBtn = document.getElementById('platform-filter-btn');
    if (currentPlatDisplay) currentPlatDisplay.textContent = 'Platforms';
    if (platBtn) platBtn.classList.remove('active-filter-btn');

    const currentRatingDisplay = document.getElementById('current-rating');
    const ratingBtn = document.getElementById('rating-filter-btn');
    if (currentRatingDisplay) currentRatingDisplay.textContent = 'Rating';
    if (ratingBtn) ratingBtn.classList.remove('active-filter-btn');

    const currentReleaseDisplay = document.getElementById('current-release');
    const releaseBtn = document.getElementById('release-filter-btn');
    if (currentReleaseDisplay) currentReleaseDisplay.textContent = 'Release';
    if (releaseBtn) releaseBtn.classList.remove('active-filter-btn');

    const currentStatusDisplay = document.getElementById('current-status');
    const statusBtn = document.getElementById('status-filter-btn');
    if (currentStatusDisplay) currentStatusDisplay.textContent = 'Status';
    if (statusBtn) statusBtn.classList.remove('active-filter-btn');

    loadGames(1, currentQuery, '', '', '', '', '');
}

// Scroll to top of content area
async function initializeReleaseYears() {
    const releaseList = document.getElementById('release-year-list');
    const currentReleaseDisplay = document.getElementById('current-release');
    const releaseBtn = document.getElementById('release-filter-btn');
    if (!releaseList) return;

    const currentYear = new Date().getFullYear();
    let startYear = 1960; // Default

    try {
        // Fetch the oldest game to find the start year dynamically
        const response = await apiRequest('/api/Steam/catalog/GetAll?ordering=released&page=1', { method: 'GET' });
        if (response.ok) {
            const games = await response.json();
            if (games && games.length > 0 && games[0].releaseDate) {
                const oldestDate = new Date(games[0].releaseDate);
                if (!isNaN(oldestDate.getFullYear())) {
                    startYear = oldestDate.getFullYear();
                }
            }
        }
    } catch (error) {
        console.error('Error fetching oldest game year:', error);
    }

    // Clear existing
    releaseList.innerHTML = '';

    // All Option
    const allOption = document.createElement('button');
    allOption.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
    allOption.textContent = 'All Years';
    allOption.onclick = () => {
        currentRelease = '';
        if (currentReleaseDisplay) currentReleaseDisplay.textContent = 'Release';
        if (releaseBtn) releaseBtn.classList.remove('active-filter-btn');
        loadGames(1, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease, currentStatus);
    };
    releaseList.appendChild(allOption);

    // Individual Years (1991 to Current)
    for (let year = currentYear; year >= 1991; year--) {
        const option = document.createElement('button');
        option.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
        option.textContent = year;
        option.onclick = () => {
            const dateRange = `${year}-01-01,${year}-12-31`;
            currentRelease = dateRange;
            if (currentReleaseDisplay) currentReleaseDisplay.textContent = year;
            if (releaseBtn) releaseBtn.classList.add('active-filter-btn');
            loadGames(1, currentQuery, currentGenre, currentPlatform, currentOrdering, dateRange, currentStatus);
        };
        releaseList.appendChild(option);
    }

    // Retro Group (1960-1990)
    if (startYear <= 1990) {
        const option = document.createElement('button');
        option.className = 'w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-primary/20 hover:text-white rounded-xl transition-all font-medium';
        option.textContent = '1960-1990';
        option.onclick = () => {
            // Use the actual startYear from API (even if < 1960) but label it as user requested
            const actualStart = Math.min(startYear, 1960);
            const dateRange = `${actualStart}-01-01,1990-12-31`;
            currentRelease = dateRange;
            if (currentReleaseDisplay) currentReleaseDisplay.textContent = '1960-1990';
            if (releaseBtn) releaseBtn.classList.add('active-filter-btn');
            loadGames(1, currentQuery, currentGenre, currentPlatform, currentOrdering, dateRange, currentStatus);
        };
        releaseList.appendChild(option);
    }
}

function scrollToTop() {
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
        contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Add to Favorites
async function addToFavorites(gameIdOrObj) {
    const gameId = (typeof gameIdOrObj === 'object') ? (gameIdOrObj.externalId || gameIdOrObj.id) : gameIdOrObj;

    try {
        const response = await apiRequest(`/api/Steam/catalog/favorite/${gameId}`, {
            method: 'POST'
        });

        if (response.ok) {
            const result = await response.json();
            const isFavorite = result.isFavorite; // Backend result property name

            // Notification toast
            const gameTitle = allGames.find(g => (g.externalId || g.id) == gameId)?.title || "Game";
            showToast(`"${gameTitle}" ${isFavorite ? 'added to' : 'removed from'} favorites!`, isFavorite ? 'favorite' : 'unfavorite');

            updateFavoriteUI(gameId, isFavorite);
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
}

function updateFavoriteUI(gameId, isFavorite) {
    // Update local data cache first
    const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
    if (cachedGame) {
        cachedGame.isFavorite = isFavorite;
        // If favorited, it cannot be in wishlist
        if (isFavorite) cachedGame.isInWishlist = false;

        // Use central indicator update to refresh everything consistently
        updateStatusIndicators(gameId, cachedGame);
    }

    // Handle view-specific item removal
    if (currentView === 'favorites' && !isFavorite) {
        const cardToRemove = document.querySelector(`button[data-game-id="${gameId}"][data-btn-type="favorite"]`)?.closest('.group');
        if (cardToRemove) {
            cardToRemove.classList.add('opacity-0', 'scale-90');
            setTimeout(() => {
                cardToRemove.remove();
                // Check if last game removed
                const container = document.getElementById('library-games');
                if (container && container.children.length === 0) {
                    container.innerHTML = '<div class="col-span-full text-center py-20 text-slate-500"><p>No favorite games found.</p></div>';
                }
            }, 300);
        }
    }
}

function updateStatusIndicators(gameId, game, isUpdating = false) {
    if (!game) return;
    const statusContainers = document.querySelectorAll(`[data-status-for="${gameId}"]`);
    const addedAtContainers = document.querySelectorAll(`[data-added-at-for="${gameId}"]`);
    const inventoryContainers = document.querySelectorAll(`[data-inventory-for="${gameId}"]`);
    const favButtons = document.querySelectorAll(`button[data-game-id="${gameId}"][data-btn-type="favorite"]`);
    const libButtons = document.querySelectorAll(`button[data-game-id="${gameId}"][data-btn-type="library"]`);
    const wishButtons = document.querySelectorAll(`button[data-game-id="${gameId}"][data-btn-type="wishlist"]`);

    const isPending = game.isInLibrary && (String(game.gamestatus).toLowerCase() === 'pending' || String(game.gamestatus) === '6');

    // Update Image Status
    statusContainers.forEach(container => {
        // Detect alignment from context (Grid cards are items-end, search cards are default)
        const isGrid = container.classList.contains('items-end');
        const alignment = isGrid ? 'justify-end' : 'justify-start';
        // Grid cards in dashboard remain read-only, search cards (vertical) are interactive
        container.innerHTML = game.isInLibrary ? renderStatusBadgeHTML(game.gamestatus, gameId, isUpdating, alignment, isGrid) : '';
    });

    addedAtContainers.forEach(container => {
        container.classList.toggle('hidden', isPending);
    });

    // Update Inventory Indicators with shared helper
    inventoryContainers.forEach(container => {
        container.innerHTML = renderInventoryIndicatorsHTML(game);
    });

    // Central robust button update logic with animations
    const updateBtn = (btns, isActive, activeClass, inactiveClass, type) => {
        btns.forEach(btn => {
            const icon = btn.querySelector('.material-symbols-outlined');
            if (isActive) {
                // Clear any potential clashing white-opacity classes from BOTH btn and icon
                btn.classList.remove('text-white/70', 'text-white/40', 'text-white/50', 'text-white/60');
                icon?.classList.remove('text-white/70', 'text-white/40', 'text-white/50', 'text-white/60');
                
                btn.classList.add(...activeClass.split(' '));
                btn.classList.remove(...inactiveClass.split(' '));
                icon?.classList.add('fill-icon');
                
                // Favorite and Wishlist get the pop animation
                if (type === 'favorite' || type === 'wishlist') {
                    icon?.classList.add('animate-pop');
                    setTimeout(() => icon?.classList.remove('animate-pop'), 450);
                }
            } else {
                btn.classList.remove(...activeClass.split(' '));
                btn.classList.add(...inactiveClass.split(' '));
                icon?.classList.remove('fill-icon');
            }
        });
    };

    updateBtn(favButtons, game.isFavorite, 'text-red-500', 'text-white/70 hover:text-red-400', 'favorite');
    updateBtn(libButtons, game.isInLibrary, 'text-green-500', 'text-white/70 hover:text-primary', 'library');
    updateBtn(wishButtons, game.isInWishlist, 'text-blue-400', 'text-white/70 hover:text-blue-400', 'wishlist');
}

// Add to Library
async function addToLibrary(gameIdOrObj) {
    const gameId = (typeof gameIdOrObj === 'object') ? (gameIdOrObj.externalId || gameIdOrObj.id) : gameIdOrObj;

    try {
        const response = await apiRequest(`/api/Steam/catalog/library/${gameId}`, {
            method: 'POST'
        });

        if (response.ok) {
            const result = await response.json();
            const isInLibrary = result.added; // Use 'added' from backend response

            // Show toast message
            const gameTitle = allGames.find(g => (g.externalId || g.id) == gameId)?.title || "Game";
            showToast(`"${gameTitle}" ${isInLibrary ? 'added to' : 'removed from'} library!`, isInLibrary ? 'success' : 'error');

            // Update Button UI
            updateLibraryUI(gameId, isInLibrary);

            // Update local state
            const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
            if (cachedGame) cachedGame.isInLibrary = isInLibrary;
        }
    } catch (error) {
        console.error('Error toggling library status:', error);
    }
}

function updateLibraryUI(gameId, isInLibrary) {
    const buttons = document.querySelectorAll(`button[data-game-id="${gameId}"][data-btn-type="library"]`);

    buttons.forEach(btn => {
        const iconSpan = btn.querySelector('.material-symbols-outlined');
        if (iconSpan && (iconSpan.textContent === 'inventory_2' || iconSpan.textContent === 'library_add')) {
            // Clean up old transformations
            iconSpan.style.transition = 'none';
            iconSpan.style.transform = 'rotate(0deg)';

            // Force reflow
            iconSpan.offsetHeight;

            // Full 360-degree spin
            iconSpan.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
            iconSpan.style.transform = 'rotate(360deg)';

            if (isInLibrary) {
                // Clear any potential clashing white-opacity classes from BOTH btn and icon
                btn.classList.remove('text-white/70', 'text-white/40', 'text-white/50', 'hover:text-primary');
                iconSpan?.classList.remove('text-white/70', 'text-white/40', 'text-white/50');
                
                btn.classList.add('text-green-500');
                iconSpan.textContent = 'inventory_2';
                iconSpan.classList.add('fill-icon');
                btn.title = 'Remove from Library';
            } else {
                btn.classList.remove('text-green-500');
                btn.classList.add('text-white/70', 'hover:text-primary');
                iconSpan.textContent = 'inventory_2';
                iconSpan.classList.remove('fill-icon');
                btn.title = 'Add to Library';
            }

            // Reset rotation after animation so it can trigger again next time
            setTimeout(() => {
                iconSpan.style.transition = 'none';
                iconSpan.style.transform = 'rotate(0deg)';
                // Sync everything else
                const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
                if (cachedGame) updateStatusIndicators(gameId, cachedGame);
            }, 600);
        }
    });

    // Handle view-specific item removal
    if (currentView === 'library' && !isInLibrary) {
        const cardToRemove = document.querySelector(`button[onclick*="'${gameId}'"]`)?.closest('.group');
        if (cardToRemove) {
            cardToRemove.classList.add('opacity-0', 'scale-90');
            setTimeout(() => {
                cardToRemove.remove();
                const container = document.getElementById('library-games');
                if (container && container.children.length === 0) {
                    container.innerHTML = '<div class="col-span-full text-center py-20 text-slate-500"><p>No games in library.</p></div>';
                }
            }, 300);
        }
    }

    // Update local state
    const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
    if (cachedGame) {
        cachedGame.isInLibrary = isInLibrary;
        if (isInLibrary) {
            cachedGame.gamestatus = 6; // Pending
        } else {
            cachedGame.gamestatus = null;
        }
        updateStatusIndicators(gameId, cachedGame);
    }
}

// Add to Wishlist
async function addToWishlist(gameIdOrObj) {
    const gameId = (typeof gameIdOrObj === 'object') ? (gameIdOrObj.externalId || gameIdOrObj.id) : gameIdOrObj;

    try {
        const response = await apiRequest(`/api/Steam/catalog/wishlist/${gameId}`, {
            method: 'POST'
        });

        if (response.ok) {
            const result = await response.json();
            const isInWishlist = result.added;

            // Show toast message
            const gameTitle = allGames.find(g => (g.externalId || g.id) == gameId)?.title || "Game";
            showToast(`"${gameTitle}" ${isInWishlist ? 'added to' : 'removed from'} wishlist!`, isInWishlist ? 'info' : 'unfavorite');

            // Update Button UI
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
        if (isInWishlist) {
            cachedGame.isFavorite = false;
        } else {
            if (cachedGame.gamestatus === 'whishlist' || cachedGame.gamestatus === 2) {
                cachedGame.gamestatus = null;
            }
        }
        updateStatusIndicators(gameId, cachedGame);
    }

    // Handle view-specific item removal (if on wishlist page)
    if (currentView === 'wishlist' && !isInWishlist) {
        const cardToRemove = document.querySelector(`button[data-game-id="${gameId}"][data-btn-type="wishlist"]`)?.closest('.group');
        if (cardToRemove) {
            cardToRemove.classList.add('opacity-0', 'scale-90');
            setTimeout(() => {
                cardToRemove.remove();
                const container = document.getElementById('library-games');
                if (container && container.children.length === 0) {
                    container.innerHTML = '<div class="col-span-full text-center py-20 text-slate-500"><p>No games in wishlist.</p></div>';
                }
            }, 300);
        }
    }
}

// Show game details
function showGameDetails(game) {
    const gameId = game.externalId || game.id;
    if (!gameId) return;

    // Proactively save state before navigating away
    savePageState();

    window.location.href = `../../GameDetails/Html/game-details.html?id=${gameId}`;
}

// Update game status in database
async function changeGameStatus(gameId, statusId) {
    const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
    let originalStatus = null;

    // Optimistic UI update
    if (cachedGame) {
        originalStatus = cachedGame.gamestatus;
        cachedGame.gamestatus = statusId;
        // Optimistic UI update across all visible cards for this game
        updateStatusIndicators(gameId, cachedGame, true);
        updateStatusSelectorUI(gameId, statusId);
    }

    try {
        const response = await apiRequest(`/api/UserGames/UpdateUserGame`, {
            method: 'PATCH',
            body: JSON.stringify({
                gameId: parseInt(gameId),
                gamestatus: statusId
            })
        });

        if (response.ok) {
            const statusLabels = { 1: 'Playing', 3: 'Completed', 4: 'Dropped', 5: 'On Hold', 6: 'Pending' };
            showToast(`Status updated to "${statusLabels[statusId]}"!`, 'success');
        } else {
            // Revert on failure
            if (cachedGame) {
                cachedGame.gamestatus = originalStatus;
                updateStatusIndicators(gameId, cachedGame);
                updateStatusSelectorUI(gameId, originalStatus);
            }
            showToast('Failed to update status', 'error');
        }
    } catch (error) {
        console.error('Error updating game status:', error);
        // Revert on error
        if (cachedGame) {
            cachedGame.gamestatus = originalStatus;
            updateStatusIndicators(gameId, cachedGame);
            updateStatusSelectorUI(gameId, originalStatus);
        }
    }
}

function updateStatusSelectorUI(gameId, statusId) {
    // Find all selector containers for this game
    const indicators = document.querySelectorAll(`[data-status-for="${gameId}"]`);
    if (!indicators || indicators.length === 0) return;

    indicators.forEach(indicatorContainer => {
        const card = indicatorContainer.closest('.group');
        if (!card) return;

        const buttons = card.querySelectorAll('button[onclick*="changeGameStatus"]');
        buttons.forEach(btn => {
            // Extract status from onclick
            const match = btn.getAttribute('onclick').match(/changeGameStatus\(.*?,[\s]*(\d+)\)/);
            if (match) {
                const btnStatusId = String(match[1]);
                const isActive = btnStatusId === String(statusId);

                const baseClasses = 'w-8 h-8 rounded-full bg-slate-900 border flex items-center justify-center hover:bg-white/10 transition-all hover:scale-110 active:scale-95';
                const activeClasses = 'border-primary/60 bg-primary/20 shadow-[0_0_12px_rgba(74,125,235,0.3)]';
                const inactiveClasses = 'border-white/10';
                
                btn.className = `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;

                // Sync icon fill state
                const icon = btn.querySelector('.material-symbols-outlined');
                if (icon) {
                    if (isActive) icon.classList.add('fill-icon');
                    else icon.classList.remove('fill-icon');
                }
            }
        });
    });
}

// Initialize navigation
function initializeNavigation() {
    // Already handled by onclick in HTML primarily, but for sidebar active states:
    // ...
}

/**
 * Shows a slide-in notification toast
 * @param {string} message - Text to display
 * @param {string} type - 'success', 'error', or 'favorite'
 */
function showToast(message, type = 'success') {
    if (activeToast) {
        clearTimeout(toastTimeout);
        const oldToast = activeToast;
        oldToast.classList.remove('toast-slide-in');
        oldToast.classList.add('toast-slide-out');
        setTimeout(() => oldToast.remove(), 400);
    }

    const toast = document.createElement('div');
    let bgColor = 'bg-primary/90';
    let icon = 'info';

    if (type === 'success') {
        bgColor = 'bg-green-500/95';
        icon = 'check_circle';
    } else if (type === 'error') {
        bgColor = 'bg-red-500/95';
        icon = 'delete';
    } else if (type === 'favorite') {
        bgColor = 'bg-pink-500/95';
        icon = 'favorite';
    } else if (type === 'unfavorite') {
        bgColor = 'bg-slate-700/95';
        icon = 'heart_broken';
    }

    toast.className = 'fixed bottom-8 right-8 ' + bgColor + ' text-white px-6 py-4 rounded-xl shadow-2xl z-[100] toast-slide-in flex items-center gap-3 backdrop-blur-md border border-white/10';
    toast.innerHTML = '<span class=\"material-symbols-outlined\">' + icon + '</span> <span class=\"font-medium\">' + message + '</span>';

    document.body.appendChild(toast);
    activeToast = toast;

    toastTimeout = setTimeout(() => {
        toast.classList.remove('toast-slide-in');
        toast.classList.add('toast-slide-out');
        setTimeout(() => {
            if (activeToast === toast) {
                toast.remove();
                activeToast = null;
            }
        }, 400);
    }, 3000);
}

function clearSearchAndReturn() {
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.value = '';
    }

    const savedBackup = sessionStorage.getItem('PRE_SEARCH_CHECKPOINT');
    if (savedBackup) {
        const state = JSON.parse(savedBackup);
        sessionStorage.removeItem('PRE_SEARCH_CHECKPOINT');
        applyStateToDashboard(state);
    } else {
        selectView('catalog');
    }
}
