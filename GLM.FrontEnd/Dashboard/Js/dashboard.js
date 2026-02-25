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
            gamesData = result.map(ug => ({
                externalId: ug.externalId, // Check DTO prop name
                id: ug.externalId,
                title: ug.gameTitle,
                imageUrl: ug.gameImageUrl,
                releaseDate: ug.releaseDate,
                rating: ug.rating,
                genres: ug.genres, 
                platforms: ug.platforms,
                isFavorite: ug.isFavorite,
                isInLibrary: true,
                gamestatus: ug.gamestatus
            }));

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

    // Rating
    const ratingBadge = game.rating ? 
        `<span class="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase tracking-wide flex items-center gap-1">
           <span class="text-yellow-400">★</span> ${game.rating}
         </span>` : '';

    // Release Year
    let releaseYear = '';
    if (game.releaseDate) {
        const date = new Date(game.releaseDate);
        if (!isNaN(date.getFullYear())) {
            releaseYear = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300">${date.getFullYear()}</span>`;
        }
    }

    // Platform Icons
    let platformIconsHtml = ''; 
    if (game.platforms && Array.isArray(game.platforms) && game.platforms.length > 0) {
        const uniqueIcons = new Set();
        const icons = game.platforms.map(slug => {
            let iconClass = '';
            // Handle both string slugs and object slugs if any
            const s = (typeof slug === 'string' ? slug : slug.slug || slug.name || '').toLowerCase();
            
            if (s.includes('pc') || s.includes('windows')) iconClass = 'fa-windows';
            else if (s.includes('playstation') || s.includes('ps')) iconClass = 'fa-playstation';
            else if (s.includes('xbox')) iconClass = 'fa-xbox';
            else if (s.includes('nintendo') || s.includes('switch')) iconClass = 'fa-nintendo-switch'; 
            else if (s.includes('mac') || s.includes('macos')) iconClass = 'fa-apple';
            else if (s.includes('linux')) iconClass = 'fa-linux';
            else if (s.includes('android')) iconClass = 'fa-android';
            else if (s.includes('ios') || s.includes('iphone')) iconClass = 'fa-app-store-ios'; 
            else if (s.includes('web')) iconClass = 'fa-chrome';
            else return ''; 

            if (uniqueIcons.has(iconClass)) return ''; 
            uniqueIcons.add(iconClass);
            return `<i class="fab ${iconClass} text-xs"></i>`;
        }).filter(icon => icon !== '').join('');

        if (icons) {
            platformIconsHtml = `
                <div class="absolute bottom-2 left-2 flex gap-2 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 bg-black/60 px-2 py-1 rounded-md backdrop-blur-sm pointer-events-none">
                    ${icons}
                </div>
            `;
        }
    }

    // Interactive States
    const favClass = game.isFavorite ? 'text-red-500 opacity-100' : 'text-white/70 opacity-0 group-hover:opacity-100';
    const favTitle = game.isFavorite ? 'Remove from Favorites' : 'Add to Favorites';

    let libraryBtnHtml = '';
    if (game.isInLibrary) {
        libraryBtnHtml = `
            <button class="w-full py-2 rounded-lg bg-green-500/20 text-green-500 border border-green-500/30 hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm font-medium group/lib-btn"
                    onclick="event.stopPropagation(); addToLibrary('${gameId}')" title="Click to remove from library">
                <span class="material-symbols-outlined text-[18px] group-hover/lib-btn:hidden">check</span>
                <span class="material-symbols-outlined text-[18px] hidden group-hover/lib-btn:inline">delete</span>
                <span class="group-hover/lib-btn:hidden">In Library</span>
                <span class="hidden group-hover/lib-btn:inline">Remove</span>
            </button>`;
    } else {
        libraryBtnHtml = `
            <button class="w-full py-2 rounded-lg bg-[#2e616b]/30 hover:bg-primary hover:text-white border border-[#2e616b] hover:border-primary text-primary text-sm font-medium transition-all flex items-center justify-center gap-2 group/btn"
                    onclick="event.stopPropagation(); addToLibrary('${gameId}')">
                <span class="material-symbols-outlined text-[18px] group-hover/btn:animate-bounce">add</span>
                Add to Library
            </button>`;
    }

    card.innerHTML = `
        <div class="aspect-[16/9] overflow-hidden relative">
            <img src="${imageUrl}" alt="${title}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onerror="this.src='../../Assets/Images/logo.png'">
            <div class="absolute inset-0 bg-gradient-to-t from-[#1e292b] to-transparent opacity-60"></div>
            
            <!-- Favorite Button -->
             <button class="absolute top-2 left-2 p-1.5 bg-black/60 backdrop-blur-sm rounded-full ${favClass} hover:text-red-500 hover:bg-black/80 transition-all translate-y-[-10px] group-hover:translate-y-0 z-20 shadow-lg" 
                    title="${favTitle}" onclick="event.stopPropagation(); addToFavorites('${gameId}')">
                <span class="material-symbols-outlined text-[20px] leading-none">favorite</span>
            </button>

            ${ratingBadge}
            ${platformIconsHtml}
        </div>
        <div class="p-4">
            <div class="flex justify-between items-start mb-1 gap-2">
                <h4 class="font-bold text-white truncate flex-1" title="${title}">${title}</h4>
                ${releaseYear}
            </div>
            <div class="mb-3 flex items-center justify-between text-xs text-slate-400">
                <span class="truncate max-w-[180px]">${category}</span>
            </div>
            
            <!-- Library Button -->
            ${libraryBtnHtml}
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
            updateFavoriteUI(gameId, result.isFavorite);
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
}

function updateFavoriteUI(gameId, isFavorite) {
    // Update all buttons for this game
    const buttons = document.querySelectorAll(`button[onclick*="'${gameId}'"]`);
    buttons.forEach(btn => {
        if (btn.querySelector('span')?.textContent === 'favorite' || btn.title.includes('Favorites')) {
             if (isFavorite) {
                 btn.classList.add('text-red-500', 'opacity-100');
                 btn.classList.remove('text-white/70', 'opacity-0');
                 btn.title = 'Remove from Favorites';
             } else {
                 btn.classList.remove('text-red-500', 'opacity-100');
                 btn.classList.add('text-white/70', 'opacity-0'); 
                 btn.title = 'Add to Favorites';
             }
        }
    });

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
                msg.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce flex items-center gap-2';
                msg.innerHTML = `<span class="material-symbols-outlined">check_circle</span> <span>"${gameTitle}" added to library!</span>`;
            } else {
                msg.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce flex items-center gap-2';
                msg.innerHTML = `<span class="material-symbols-outlined">delete</span> <span>"${gameTitle}" removed from library.</span>`;
            }
            
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 3000);

            // Update local state
             const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
             if (cachedGame) cachedGame.isInLibrary = isInLibrary;
             
             // Update Button UI
             updateLibraryUI(gameId, isInLibrary);
        }
    } catch (error) {
        console.error('Error toggling library status:', error);
        alert('Failed to update library status.');
    }
}

function updateLibraryUI(gameId, isInLibrary) {
     const buttons = document.querySelectorAll(`button[onclick*="'${gameId}'"]`);
     
     buttons.forEach(btn => {
         // Identify library button vs favorite button
         if (!btn.title.includes('Favorite')) {
            if (isInLibrary) {
                 // Change to "In Library" state (Remove on hover)
                 btn.className = "w-full py-2 rounded-lg bg-green-500/20 text-green-500 border border-green-500/30 hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm font-medium group/lib-btn";
                 btn.title = "Click to remove from library";
                 btn.innerHTML = `
                    <span class="material-symbols-outlined text-[18px] group-hover/lib-btn:hidden">check</span>
                    <span class="material-symbols-outlined text-[18px] hidden group-hover/lib-btn:inline">delete</span>
                    <span class="group-hover/lib-btn:hidden">In Library</span>
                    <span class="hidden group-hover/lib-btn:inline">Remove</span>
                 `;
                 btn.disabled = false; 
            } else {
                 // Change back to "Add to Library"
                 btn.className = "w-full py-2 rounded-lg bg-[#2e616b]/30 hover:bg-primary hover:text-white border border-[#2e616b] hover:border-primary text-primary text-sm font-medium transition-all flex items-center justify-center gap-2 group/btn";
                 btn.title = "";
                 btn.innerHTML = `
                    <span class="material-symbols-outlined text-[18px] group-hover/btn:animate-bounce">add</span>
                    Add to Library
                 `;
                 btn.disabled = false;
            }
         }
     });
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
