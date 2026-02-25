// Pagination state
let currentPage = 1;
let currentQuery = ''; // Store current search query
let gamesPerPage = 20; // Updated to match backend
let allGames = []; // Will store just the current page of games now
let currentView = 'catalog'; // 'catalog', 'library', 'favorites'

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
        else if (view === 'discover') headerTitle.textContent = 'Discover';
        else if (view === 'community') headerTitle.textContent = 'Community';
    }

    loadGames(1, '');
}

// Load games from API (handles both catalog and search)
async function loadGames(page = 1, query = '') {
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
            }
        } else {
            // Fetch all user games for Library/Favorites
             endpoint = `/api/UserGames/GetAllUserGames`;
        }
        
        const response = await apiRequest(endpoint, {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load games');
        }
        
        let result = await response.json();

        // Transform UserGames DTO if needed and filter
        if (currentView !== 'catalog') {
            // Map UserGamesResponseDto to display format
            gamesData = result.map(ug => {
                // Determine if in library based on status
                // Backend returns enum as string "whishlist" or int 2
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
                    gamestatus: ug.gamestatus
                };
            });

            // Filter for Library view (exclude wishlist-only games)
            if (currentView === 'library') {
                gamesData = gamesData.filter(g => g.isInLibrary);
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
                } else {
                    totalGamesElement.textContent = `${allGames.length} Games`;
                }
            }
            displayGames(allGames);
        } else {
            if (container) container.innerHTML = `
                <div class="col-span-full text-center py-20 text-slate-500">
                    <p>No games found.</p>
                </div>
            `;
            if (totalGamesElement) totalGamesElement.textContent = '0 Games';
        }
        
        updatePaginationControls(page, query);

    } catch (error) {
        console.error('Error loading games:', error);
        if (container) container.innerHTML = `
            <div class="col-span-full text-center py-20 text-red-500">
                <p>Unable to load games. Make sure the API is running.</p>
            </div>
        `;
        if (totalGamesElement) totalGamesElement.textContent = 'Error';
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
            category = game.genres.slice(0, 3).join(' • ');
        } else if (game.genres[0].name) {
            category = game.genres.map(g => g.name).slice(0, 2).join(' • ');
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
            
            if (s.includes('pc') || s.includes('windows')) svgIcon = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1V11.7H0V3.449zm0 17.1L9.75 21.9V12.3H0v8.249zM10.5 1.95L24 0v11.7H10.5V1.95zm0 20.1L24 24V12.3H10.5v9.75z"></path></svg>`;
            else if (s.includes('playstation') || s.includes('ps')) svgIcon = `<i class="fab fa-playstation text-sm"></i>`;
            else if (s.includes('xbox')) svgIcon = `<i class="fab fa-xbox text-sm"></i>`;
            else if (s.includes('nintendo') || s.includes('switch')) svgIcon = `<i class="bi bi-nintendo-switch text-sm" style="font-size: 1.1rem;"></i>`; 
            else if (s.includes('mac') || s.includes('macos') || s.includes('apple')) svgIcon = `<i class="fab fa-apple text-sm"></i>`;
            else if (s.includes('android')) svgIcon = `<i class="fab fa-android text-sm"></i>`;
            else return ''; 

            if (uniqueIcons.has(s)) return ''; 
            uniqueIcons.add(s);
            return svgIcon;
        }).filter(icon => icon !== '').join('');

        if (icons) {
            platformIconsPanel = `
                <div class="absolute bottom-4 left-4 glass-panel px-4 py-2 rounded-full flex items-center gap-4 text-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0 z-10 pointer-events-none">
                    ${icons}
                </div>
            `;
        }
    }

    // Favorite/Library Button State logic
    const favTitle = game.isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
    const libTitle = game.isInLibrary ? 'Remove from Library' : 'Add to Library';
    const libIcon = game.isInLibrary ? 'check_circle' : 'add';
    const libClass = game.isInLibrary ? 'text-green-500 fill-icon' : 'hover:text-primary';
    const favBtnClass = game.isFavorite ? 'text-red-500 fill-icon' : 'hover:text-red-400';

    // Disable logic based on current view
    const isFavDisabled = currentView === 'library';
    const isLibDisabled = currentView === 'favorites';

    card.innerHTML = `
        <!-- Image & Actions -->
        <div class="relative h-72 overflow-hidden">
            <img src="${imageUrl}" alt="${title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='../../Assets/Images/logo.png'">
            
            ${ratingBadge}

            <!-- Action Buttons (Top Right) -->
            <div class="absolute top-4 right-4 flex flex-col gap-3 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 z-20">
                <button class="w-11 h-11 glass-neon-btn text-white ${favBtnClass} group/heart ${isFavDisabled ? 'opacity-40 cursor-not-allowed' : ''}" 
                        title="${isFavDisabled ? 'Management disabled in library view' : favTitle}" 
                        ${isFavDisabled ? 'disabled' : `onclick="event.stopPropagation(); addToFavorites('${gameId}')"`}>
                    <span class="material-symbols-outlined text-[24px] ${!isFavDisabled ? 'group-hover/heart:scale-110' : ''} transition-transform ${game.isFavorite ? 'fill-icon' : ''}">favorite</span>
                </button>
                <button class="w-11 h-11 glass-neon-btn text-white ${libClass} group/add ${isLibDisabled ? 'opacity-40 cursor-not-allowed' : ''}" 
                        title="${isLibDisabled ? 'Management disabled in favorites view' : libTitle}" 
                        ${isLibDisabled ? 'disabled' : `onclick="event.stopPropagation(); addToLibrary('${gameId}')"`}>
                    <span class="material-symbols-outlined text-[24px] ${!isLibDisabled ? 'group-hover/add:scale-110' : ''} transition-transform ${game.isInLibrary ? 'fill-icon' : ''}">${libIcon}</span>
                </button>
            </div>

            ${platformIconsPanel}
        </div>

        <!-- Info Section -->
        <div class="p-6">
            <div class="flex items-start justify-between mb-2 gap-3">
                <div class="overflow-hidden">
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white leading-tight truncate mb-1" title="${title}">${title}</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">${category}</p>
                </div>
                ${releaseYearBadge}
            </div>
        </div>
    `;

    card.addEventListener('click', () => {
        showGameDetails(game);
    });
    
    return card;
}

// Update pagination controls
function updatePaginationControls(page, query) {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    // Simplistic pagination for infinite scroll style API
    pageInfo.textContent = `Page ${page}`;
    
    prevBtn.disabled = page === 1;
    
    // Disable next if we have fewer results than page size (likely end of list)
    // If searching, we disabled next for now as search endpoint is single page in this implementation
    if (query) {
        nextBtn.disabled = true; 
        pageInfo.textContent = 'Search Results';
    } else {
        nextBtn.disabled = allGames.length < gamesPerPage;
    }
    
    // Store current page state
    currentPage = page;
    currentQuery = query;
}

// Initialize pagination buttons
function initializePagination() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            loadGames(currentPage - 1, currentQuery);
            scrollToTop();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        loadGames(currentPage + 1, currentQuery);
        scrollToTop();
    });
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
            loadGames(1, query);
        }, 500); // 500ms debounce
    });
}

// Scroll to top of content area
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
            const gameTitle = allGames.find(g => (g.externalId || g.id) == gameId)?.title || "Game Dictionary";
            const msg = document.createElement('div');
            msg.className = `fixed bottom-4 right-4 ${isFavorite ? 'bg-red-500/90' : 'bg-slate-700/90'} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce flex items-center gap-2 backdrop-blur-md`;
            msg.innerHTML = `<span class="material-symbols-outlined">${isFavorite ? 'favorite' : 'heart_broken'}</span> <span>"${gameTitle}" ${isFavorite ? 'added to' : 'removed from'} favorites!</span>`;
            
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 2500);

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
     if (cachedGame) cachedGame.isFavorite = isFavorite;
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
            const gameTitle = allGames.find(g => (g.externalId || g.id) == gameId)?.title || "Game Dictionary";
            const msg = document.createElement('div');
            
            if (isInLibrary) {
                msg.className = 'fixed bottom-4 right-4 bg-green-500/90 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce flex items-center gap-2 backdrop-blur-md';
                msg.innerHTML = `<span class="material-symbols-outlined">check_circle</span> <span>"${gameTitle}" added to library!</span>`;
            } else {
                msg.className = 'fixed bottom-4 right-4 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce flex items-center gap-2 backdrop-blur-md';
                msg.innerHTML = `<span class="material-symbols-outlined">delete</span> <span>"${gameTitle}" removed from library.</span>`;
            }
            
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 3000);

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
     if (cachedGame) cachedGame.isInLibrary = isInLibrary;
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
