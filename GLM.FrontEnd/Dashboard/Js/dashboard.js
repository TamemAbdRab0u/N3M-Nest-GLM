// Pagination state
let currentPage = 1;
let currentQuery = ''; // Store current search query
let currentGenre = ''; // Store current genre filter
let currentPlatform = ''; // Store current platform filter
let currentOrdering = ''; // Store current sorting/ordering
let currentRelease = ''; // Store current release year filter
let gamesPerPage = 20; // Updated to match backend
let allGames = []; // Will store just the current page of games now
let currentView = 'catalog'; // 'catalog', 'library', 'favorites'

// Toast Notification State
let activeToast = null;
let toastTimeout = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = '../../Auth/Html/login.html';
        return;
    }
    
    // Display user info
    displayUserInfo();
    
    // Check if initial view is requested (e.g. from nav) - simpler to default to catalog
    selectView('catalog'); // Load intial view
    
    initializeNavigation();
    initializePagination();
    initializeSearch();
    initializeCategories();
    initializePlatforms();
    initializeReleaseYears();
});

// Display user information
function displayUserInfo() {
    const userInfo = getUserInfo();
    const usernameElements = document.querySelectorAll('#display-username, #welcome-username');
    
    usernameElements.forEach(el => {
        el.textContent = userInfo.userName || 'User';
    });
}

function selectView(view) {
    currentView = view;
    currentPage = 1;
    currentQuery = '';
    currentGenre = ''; // Reset genre filter
    currentPlatform = ''; // Reset platform filter
    currentOrdering = ''; // Reset ordering filter
    currentRelease = ''; // Reset release filter
    
    // Reset dropdown UI
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

    // Update Nav UI
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active', 'bg-primary/10', 'text-primary');
        el.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-[#1e293b]');
    });
    
    const activeNav = document.getElementById(`nav-${view}`);
    if (activeNav) {
        activeNav.classList.add('active', 'bg-primary/10', 'text-primary');
        activeNav.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-[#1e293b]');
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

    loadGames(1, '', '', '', '', '');
}

// Load games from API (handles both catalog and search)
async function loadGames(page = 1, query = '', genre = '', platform = '', ordering = '', release = '') {
    const container = document.getElementById('library-games');
    const totalGamesElement = document.getElementById('total-games');
    // Ensure element exists before setting textContent
    if (!totalGamesElement) { 
        console.warn('Total games element not found');
    }
    
    const loadingHtml = `
        <div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
            <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p>Loading games...</p>
        </div>
    `;
    
    if (container) container.innerHTML = loadingHtml;
    
    try {
        let endpoint;
        let gamesData = [];

        if (currentView === 'catalog') {
            if (query) {
                 endpoint = `/api/RAWG/catalog/search?query=${encodeURIComponent(query)}`;
            } else {
                 endpoint = `/api/RAWG/catalog/GetAll?page=${page}`;
                 if (genre) endpoint += `&genre=${encodeURIComponent(genre)}`;
                 if (platform) endpoint += `&platforms=${encodeURIComponent(platform)}`;
                 if (ordering) endpoint += `&ordering=${encodeURIComponent(ordering)}`;
                 if (release) endpoint += `&dates=${encodeURIComponent(release)}`;
            }
        } else {
            // Fetch all user games for Library/Favorites
             endpoint = `/api/UserGames/GetAllUserGames`;
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
        if (currentView !== 'catalog') {
            // Map UserGamesResponseDto to display format
            gamesData = result.map(ug => {
                // Determine if in library based on status
                // Backend returns enum as string "whishlist" or int 2
                const inLibrary = ug.gamestatus !== 'whishlist' && ug.gamestatus !== 2;
                const inWishlist = ug.gamestatus === 'whishlist' || ug.gamestatus === 2;
                
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
                    gamestatus: ug.gamestatus
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

            // Client-side search
            if (query) {
                const lowerQ = query.toLowerCase();
                gamesData = gamesData.filter(g => g.title.toLowerCase().includes(lowerQ));
            }

        } else {
            gamesData = result; // Already in RAWG format
        }

        allGames = gamesData; // Store current batch/list
        
        if (allGames && allGames.length > 0) {
            if (totalGamesElement) {
                if (query) {
                    totalGamesElement.textContent = `Search Results`;
                } else if (currentView === 'catalog') {
                    totalGamesElement.textContent = `Page ${page}`;
                } else if (currentView === 'library') {
                    totalGamesElement.textContent = `${allGames.length} in Library`;
                } else if (currentView === 'favorites') {
                    totalGamesElement.textContent = `${allGames.length} Favorites`;
                } else {
                    totalGamesElement.textContent = `${allGames.length} Games`;
                }
            }
            displayGames(allGames);
        } else {
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
        
        updatePaginationControls(page, query, genre, platform, ordering, release);

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
}


// Display games
function displayGames(games) {
    const container = document.getElementById('library-games');
    // Important: Don't clear if appending (pagination > 1 in catalog view)
    // But current logic clears in loadGames if page=1.
    // If page > 1, allGames contains accumulated list. 
    // Wait, loadGames logic:
    // if (page === 1) allGames = games; else allGames = [...allGames, ...games];
    // displayGames(allGames);
    // So displayGames always rerenders ALL games. This is fine for small lists but not efficient for large infinite scroll.
    // However, given the current constraints, rerendering is acceptable.
    container.innerHTML = '';
    
    games.forEach(game => {
        container.appendChild(createGameCard(game));
    });
}

// Create game card element
function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'group bg-[#1e292b] rounded-xl overflow-hidden border border-[#2e616b]/30 hover:border-primary/50 transition-all duration-300 relative hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 cursor-pointer';
    
    const imageUrl = game.imageUrl || game.imgUrl || game.backgroundImage || game.background_image || '../../Assets/Images/default-game.jpg'; 
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

    // Rating Badge (Top Left - Floating)
    const ratingBadge = game.rating ? 
        `<div class="absolute top-4 left-4 glass-panel px-3 py-1.5 rounded-full flex items-center gap-1.5 z-10 transition-opacity group-hover:opacity-0">
           <span class="material-symbols-outlined text-yellow-400 text-[18px] fill-icon">star</span>
           <span class="text-white text-xs font-bold">${game.rating}</span>
         </div>` : '';

    // Release Year Badge
    let releaseYearBadge = '';
    if (game.releaseDate) {
        const date = new Date(game.releaseDate);
        if (!isNaN(date.getFullYear())) {
            releaseYearBadge = `<span class="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider h-fit mt-1">
                ${date.getFullYear()}
            </span>`;
        }
    }

    // Platform Icons (Bottom Left)
    let platformIconsPanel = ''; 
    if (game.platforms && Array.isArray(game.platforms) && game.platforms.length > 0) {
        const uniqueIcons = new Set();
        const icons = game.platforms.map(slug => {
            let svgIcon = '';
            const s = (typeof slug === 'string' ? slug : slug.slug || slug.name || '').toLowerCase();
            
    // Map common slugs to icons (using even smaller sizes for compact view)
            if (s.includes('pc') || s.includes('windows')) svgIcon = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1V11.7H0V3.449zm0 17.1L9.75 21.9V12.3H0v8.249zM10.5 1.95L24 0v11.7H10.5V1.95zm0 20.1L24 24V12.3H10.5v9.75z"></path></svg>`;
            else if (s.includes('playstation') || s.includes('ps5')) svgIcon = `<i class="fab fa-playstation text-[10px]"></i>`;
            else if (s.includes('ps4') || s.includes('ps3')) svgIcon = `<i class="fab fa-playstation text-[10px]"></i>`;
            else if (s.includes('xbox')) svgIcon = `<i class="fab fa-xbox text-[10px]"></i>`;
            else if (s.includes('nintendo') || s.includes('switch')) svgIcon = `<i class="bi bi-nintendo-switch text-[11px]"></i>`; 
            else if (s.includes('mac') || s.includes('macos') || s.includes('apple')) svgIcon = `<i class="fab fa-apple text-[11px]"></i>`;
            else if (s.includes('linux')) svgIcon = `<i class="fab fa-linux text-[11px]"></i>`;
            else if (s.includes('android')) svgIcon = `<i class="fab fa-android text-[11px]"></i>`;
            else if (s.includes('ios') || s.includes('iphone')) svgIcon = `<i class="bi bi-phone text-[11px]"></i>`;
            else return ''; 

            if (uniqueIcons.has(svgIcon)) return ''; 
            uniqueIcons.add(svgIcon);
            return svgIcon;
        }).filter(icon => icon !== '').join('');

        if (icons) {
            platformIconsPanel = `
                <div class="absolute bottom-3 left-3 glass-panel px-2.5 py-1 rounded-full flex items-center gap-2 text-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10 pointer-events-none">
                    ${icons}
                </div>
            `;
        }
    }

    // Status Indicators (Small icons under year)
    const statusIndicators = `
        <div data-status-for="${gameId}" class="flex justify-end gap-2 mt-2 transition-all duration-500">
            ${game.isFavorite ? `
                <div class="status-badge-fav h-7 w-7 rounded-full border border-red-500/30 flex items-center justify-center backdrop-blur-sm animate-badge transition-all hover:scale-110" title="Favorited">
                    <span class="material-symbols-outlined text-[15px] text-red-500 fill-icon">favorite</span>
                </div>` : ''}
            ${game.isInLibrary ? `
                <div class="status-badge-lib h-7 w-7 rounded-full border border-green-500/30 flex items-center justify-center backdrop-blur-sm animate-badge transition-all hover:scale-110" title="In Library">
                    <span class="material-symbols-outlined text-[15px] text-green-500 fill-icon">check_circle</span>
                </div>` : ''}
            ${game.isInWishlist ? `
                <div class="status-badge-wish h-7 w-7 rounded-full border border-blue-500/30 flex items-center justify-center backdrop-blur-sm animate-badge transition-all hover:scale-110" title="In Wishlist">
                    <span class="material-symbols-outlined text-[15px] text-blue-400 fill-icon">bookmark</span>
                </div>` : ''}
        </div>
    `;

    // Favorite/Library Button State logic
    const favTitle = game.isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
    const libTitle = game.isInLibrary ? 'Remove from Library' : 'Add to Library';
    const wishlistTitle = game.isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist';
    
    const libIcon = game.isInLibrary ? 'check_circle' : 'add';
    const wishlistIcon = game.isInWishlist ? 'bookmark' : 'bookmark_add';
    
    const libClass = game.isInLibrary ? 'text-green-500 fill-icon' : 'hover:text-primary';
    const wishlistClass = game.isInWishlist ? 'text-blue-400 fill-icon' : 'hover:text-blue-400';
    const favBtnClass = game.isFavorite ? 'text-red-500 fill-icon' : 'hover:text-red-400';

    // Disable logic based on current view
    const isFavDisabled = currentView === 'library' || currentView === 'wishlist';
    const isLibDisabled = currentView === 'favorites' || currentView === 'wishlist';
    const isWishlistDisabled = currentView === 'favorites' || currentView === 'library';

    card.innerHTML = `
        <!-- Image & Actions -->
        <div class="relative h-72 overflow-hidden">
            <img src="${imageUrl}" alt="${title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='../../Assets/Images/logo.png'">
            
            ${ratingBadge}

            <!-- Action Buttons (Top Right) -->
            <div class="absolute top-4 right-4 flex flex-col gap-3 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 z-20">
                <button class="w-11 h-11 glass-neon-btn text-white ${favBtnClass} group/heart ${isFavDisabled ? 'opacity-40 cursor-not-allowed' : ''}" 
                        title="${isFavDisabled ? 'Management disabled in this view' : favTitle}" 
                        ${isFavDisabled ? 'disabled' : `onclick="event.stopPropagation(); addToFavorites('${gameId}')"`}>
                    <span class="material-symbols-outlined text-[24px] ${!isFavDisabled ? 'group-hover/heart:scale-110' : ''} transition-transform ${game.isFavorite ? 'fill-icon' : ''}">favorite</span>
                </button>
                <button class="w-11 h-11 glass-neon-btn text-white ${libClass} group/add ${isLibDisabled ? 'opacity-40 cursor-not-allowed' : ''}" 
                        title="${isLibDisabled ? 'Management disabled in this view' : libTitle}" 
                        ${isLibDisabled ? 'disabled' : `onclick="event.stopPropagation(); addToLibrary('${gameId}')"`}>
                    <span class="material-symbols-outlined text-[24px] ${!isLibDisabled ? 'group-hover/add:scale-110' : ''} transition-transform ${game.isInLibrary ? 'fill-icon' : ''}">${libIcon}</span>
                </button>
                <button class="w-11 h-11 glass-neon-btn text-white ${wishlistClass} group/wish ${isWishlistDisabled ? 'opacity-40 cursor-not-allowed' : ''}" 
                        title="${isWishlistDisabled ? 'Management disabled in this view' : wishlistTitle}" 
                        ${isWishlistDisabled ? 'disabled' : `onclick="event.stopPropagation(); addToWishlist('${gameId}')"`}>
                    <span class="material-symbols-outlined text-[24px] ${!isWishlistDisabled ? 'group-hover/wish:scale-110' : ''} transition-transform ${game.isInWishlist ? 'fill-icon' : ''}">${wishlistIcon}</span>
                </button>
            </div>

            ${platformIconsPanel}
        </div>

        <!-- Info Section -->
        <div class="p-6">
            <div class="flex items-start justify-between mb-2 gap-3">
                <div class="overflow-hidden flex-1">
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white leading-tight truncate mb-1" title="${title}">${title}</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">${category}</p>
                </div>
                <div class="flex flex-col items-end">
                    ${releaseYearBadge}
                    ${statusIndicators}
                </div>
            </div>
        </div>
    `;

    card.addEventListener('click', () => {
        showGameDetails(game);
    });
    
    return card;
}

// Update pagination controls
function updatePaginationControls(page, query, genre, platform, ordering, release) {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    // Simplistic pagination for infinite scroll style API
    if (pageInfo) pageInfo.textContent = `Page ${page}`;
    
    if (prevBtn) prevBtn.disabled = page === 1;
    
    // Disable next if we have fewer results than page size (likely end of list)
    if (nextBtn) {
        if (query) {
            nextBtn.disabled = true; 
            if (pageInfo) pageInfo.textContent = 'Search Results';
        } else {
            nextBtn.disabled = allGames.length < gamesPerPage;
        }
    }
    
    // Store current page state
    currentPage = page;
    currentQuery = query;
    currentGenre = genre;
    currentPlatform = platform;
    currentOrdering = ordering;
    currentRelease = release;
}

// Initialize pagination buttons
function initializePagination() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                loadGames(currentPage - 1, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease);
                scrollToTop();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            loadGames(currentPage + 1, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease);
            scrollToTop();
        });
    }
}

// Initialize search
function initializeSearch() {
    const searchInput = document.querySelector('.search-bar input');
    if (!searchInput) return;

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        debounceTimer = setTimeout(() => {
            currentPage = 1; // Reset to page 1 on new search
            loadGames(1, query, currentGenre, currentPlatform, currentOrdering, currentRelease);
        }, 500); // 500ms debounce
    });
}

// Initialize Categories dropdown
async function initializeCategories() {
    const categoryList = document.getElementById('category-list');
    const currentCatDisplay = document.getElementById('current-category');
    const catBtn = document.getElementById('category-filter-btn');
    if (!categoryList) return;

    try {
        const response = await apiRequest('/api/RAWG/catalog/genres', { method: 'GET' });
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
                loadGames(1, currentQuery, '', currentPlatform, currentOrdering, currentRelease);
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
                    loadGames(1, currentQuery, slug, currentPlatform, currentOrdering, currentRelease);
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
        const response = await apiRequest('/api/RAWG/catalog/platforms', { method: 'GET' });
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
                loadGames(1, currentQuery, currentGenre, '', currentOrdering, currentRelease);
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
                    loadGames(1, currentQuery, currentGenre, id, currentOrdering, currentRelease);
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
    
    loadGames(1, currentQuery, currentGenre, currentPlatform, ordering, currentRelease);
}

function clearAllFilters() {
    currentGenre = '';
    currentPlatform = '';
    currentOrdering = '';
    currentRelease = '';
    
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

    loadGames(1, currentQuery, '', '', '', '');
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
        const response = await apiRequest('/api/RAWG/catalog/GetAll?ordering=released&page=1', { method: 'GET' });
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
        loadGames(1, currentQuery, currentGenre, currentPlatform, currentOrdering, currentRelease);
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
            loadGames(1, currentQuery, currentGenre, currentPlatform, currentOrdering, dateRange);
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
            loadGames(1, currentQuery, currentGenre, currentPlatform, currentOrdering, dateRange);
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
        const response = await apiRequest(`/api/RAWG/catalog/favorite/${gameId}`, {
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
    // Update all buttons for this game on the page
    const buttons = document.querySelectorAll(`button[onclick*="'${gameId}'"]`);
    buttons.forEach(btn => {
        const iconSpan = btn.querySelector('.material-symbols-outlined');
        if (iconSpan && iconSpan.textContent === 'favorite') {
             if (isFavorite) {
                 btn.classList.add('text-red-500', 'fill-icon');
                 btn.classList.remove('hover:text-red-400');
                 iconSpan.classList.add('fill-icon', 'animate-pop');
                 btn.title = 'Remove from Favorites';

                 // Remove animation class after completion to allow re-trigger
                 setTimeout(() => iconSpan.classList.remove('animate-pop'), 450);
             } else {
                 btn.classList.remove('text-red-500', 'fill-icon');
                 btn.classList.add('hover:text-red-400');
                 iconSpan.classList.remove('fill-icon', 'animate-pop');
                 btn.title = 'Add to Favorites';
             }
        }
    });

    // Handle view-specific item removal
    if (currentView === 'favorites' && !isFavorite) {
        const cardToRemove = document.querySelector(`button[onclick*="'${gameId}'"]`).closest('.group');
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

    // Update local data cache
     const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
     if (cachedGame) {
        cachedGame.isFavorite = isFavorite;
        updateStatusIndicators(gameId, cachedGame);
     }
}

function updateStatusIndicators(gameId, game) {
    const containers = document.querySelectorAll(`[data-status-for="${gameId}"]`);
    containers.forEach(container => {
        container.innerHTML = `
            ${game.isFavorite ? `
                <div class="status-badge-fav h-7 w-7 rounded-full border border-red-500/30 flex items-center justify-center backdrop-blur-sm animate-badge transform transition-all hover:scale-110" title="Favorited">
                    <span class="material-symbols-outlined text-[15px] text-red-500 fill-icon">favorite</span>
                </div>` : ''}
            ${game.isInLibrary ? `
                <div class="status-badge-lib h-7 w-7 rounded-full border border-green-500/30 flex items-center justify-center backdrop-blur-sm animate-badge transition-all hover:scale-110" title="In Library">
                    <span class="material-symbols-outlined text-[15px] text-green-500 fill-icon">check_circle</span>
                </div>` : ''}
            ${game.isInWishlist ? `
                <div class="status-badge-wish h-7 w-7 rounded-full border border-blue-500/30 flex items-center justify-center backdrop-blur-sm animate-badge transition-all hover:scale-110" title="In Wishlist">
                    <span class="material-symbols-outlined text-[15px] text-blue-400 fill-icon">bookmark</span>
                </div>` : ''}
        `;
    });
}

// Add to Library
async function addToLibrary(gameIdOrObj) {
    const gameId = (typeof gameIdOrObj === 'object') ? (gameIdOrObj.externalId || gameIdOrObj.id) : gameIdOrObj;
    
    try {
        const response = await apiRequest(`/api/RAWG/catalog/library/${gameId}`, {
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
     const buttons = document.querySelectorAll(`button[onclick*="'${gameId}'"]`);
     
     buttons.forEach(btn => {
         const iconSpan = btn.querySelector('.material-symbols-outlined');
         if (iconSpan && (iconSpan.textContent === 'add' || iconSpan.textContent === 'check_circle')) {
            // Clean up any existing transition
            iconSpan.style.transition = 'none';
            
            // Set start position:
            // Adding: start at -180deg (+ looks upright), end at 0deg (Checkmark Upright)
            // Removing: start at 0deg (Checkmark), end at 180deg (+ Upright)
            if (isInLibrary) {
                iconSpan.style.transform = 'rotate(-180deg)';
            } else {
                iconSpan.style.transform = 'rotate(0deg)';
            }
            
            // Force browser to apply the start position immediately
            iconSpan.offsetHeight; 

            // Start the 180 degree smooth spin
            iconSpan.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'; // Slight bounce for "perfection"
            iconSpan.style.transform = isInLibrary ? 'rotate(0deg)' : 'rotate(180deg)';
            
            // Swap icon content exactly mid-way (90deg)
            setTimeout(() => {
                if (isInLibrary) {
                     btn.classList.add('text-green-500', 'fill-icon');
                     btn.classList.remove('hover:text-primary');
                     iconSpan.textContent = 'check_circle';
                     iconSpan.classList.add('fill-icon');
                     btn.title = 'Remove from Library';
                } else {
                     btn.classList.remove('text-green-500', 'fill-icon');
                     btn.classList.add('hover:text-primary');
                     iconSpan.textContent = 'add';
                     iconSpan.classList.remove('fill-icon');
                     btn.title = 'Add to Library';
                }
            }, 300);
         }
     });

    // Handle view-specific item removal
    if (currentView === 'library' && !isInLibrary) {
        const cardToRemove = document.querySelector(`button[onclick*="'${gameId}'"]`).closest('.group');
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
         updateStatusIndicators(gameId, cachedGame);
     }
}

// Add to Wishlist
async function addToWishlist(gameIdOrObj) {
    const gameId = (typeof gameIdOrObj === 'object') ? (gameIdOrObj.externalId || gameIdOrObj.id) : gameIdOrObj;
    
    try {
        const response = await apiRequest(`/api/RAWG/catalog/wishlist/${gameId}`, {
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

            // Update local state
             const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
             if (cachedGame) {
                 cachedGame.isInWishlist = isInWishlist;
                 // If added to wishlist, it's NOT in library anymore (backend toggles it to wishlist)
                 if (isInWishlist) cachedGame.isInLibrary = false;
                 updateStatusIndicators(gameId, cachedGame);
             }
        }
    } catch (error) {
        console.error('Error toggling wishlist status:', error);
    }
}

function updateWishlistUI(gameId, isInWishlist) {
    const buttons = document.querySelectorAll(`button[onclick*="'${gameId}'"]`);
    
    buttons.forEach(btn => {
        const iconSpan = btn.querySelector('.material-symbols-outlined');
        if (iconSpan && (iconSpan.textContent === 'bookmark' || iconSpan.textContent === 'bookmark_add')) {
            if (isInWishlist) {
                btn.classList.add('text-blue-400', 'fill-icon');
                iconSpan.textContent = 'bookmark';
                iconSpan.classList.add('fill-icon', 'animate-pop');
                btn.title = 'Remove from Wishlist';
                setTimeout(() => iconSpan.classList.remove('animate-pop'), 450);
            } else {
                btn.classList.remove('text-blue-400', 'fill-icon');
                iconSpan.textContent = 'bookmark_add';
                iconSpan.classList.remove('fill-icon');
                btn.title = 'Add to Wishlist';
            }
        }
        
        // Also update library button if it was in library but now in wishlist
        if (isInWishlist && iconSpan && (iconSpan.textContent === 'check_circle' || iconSpan.textContent === 'add')) {
             btn.classList.remove('text-green-500', 'fill-icon');
             btn.classList.add('hover:text-primary');
             iconSpan.textContent = 'add';
             iconSpan.classList.remove('fill-icon');
             btn.title = 'Add to Library';
        }
    });

    // Handle view-specific item removal
    if (currentView === 'wishlist' && !isInWishlist) {
        const cardToRemove = document.querySelector(`button[onclick*="'${gameId}'"]`).closest('.group');
        if (cardToRemove) {
            cardToRemove.classList.add('opacity-0', 'scale-90');
            setTimeout(() => {
                cardToRemove.remove();
                const container = document.getElementById('library-games');
                if (container && container.children.length === 0) {
                     container.innerHTML = '<div class="col-span-full text-center py-20 text-slate-500"><p>Your wishlist is empty.</p></div>';
                }
            }, 300);
        }
    }
}

// Show game details
function showGameDetails(game) {
    // Placeholder
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
