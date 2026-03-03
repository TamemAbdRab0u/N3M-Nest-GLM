// Pagination state
let currentPage = 1;
let currentQuery = ''; // Store current search query
let currentGenre = ''; // Store current genre filter
let currentPlatform = ''; // Store current platform filter
let currentOrdering = ''; // Store current sorting/ordering
let currentRelease = ''; // Store current release year filter
let currentStatus = ''; // Store current game status filter
let gamesPerPage = 12; // Updated to 12 games per page
let allGames = []; // Will store just the current page of games now
let currentView = 'catalog'; // 'catalog', 'library', 'favorites'

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

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = '../../Auth/Html/login.html';
        return;
    }
    
    // Display user info
    displayUserInfo();
    
    // Check for view in URL
    const urlParams = new URLSearchParams(window.location.search);
    const requestedView = urlParams.get('view') || 'catalog';
    const requestedGenre = urlParams.get('genre');
    
    selectView(requestedView);
    
    // Apply genre filter if specified in URL
    if (requestedGenre && requestedView === 'library') {
        currentGenre = requestedGenre;
        
        // Update category filter UI to show the selected genre
        const currentCatDisplay = document.getElementById('current-category');
        const catBtn = document.getElementById('category-filter-btn');
        if (currentCatDisplay) {
            currentCatDisplay.textContent = requestedGenre;
        }
        if (catBtn) {
            catBtn.classList.add('active-filter-btn');
        }
        
        // Reload library with genre filter
        loadGames(1, '', requestedGenre, '', '', '', '');
    }
    
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
    const displayAvatar = document.getElementById('display-avatar');

    usernameElements.forEach(el => {
        el.textContent = userInfo.userName || 'User';
    });
    
    // Fetch actual profile to update name and avatar if they exist
    fetchProfileInfo();
}

async function fetchProfileInfo() {
    try {
        const response = await apiRequest('/api/Profile');
        if (response.ok) {
            const profile = await response.json();
            const usernameElements = document.querySelectorAll('#display-username, #welcome-username');
            const displayAvatar = document.getElementById('display-avatar');

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
            if (resolvedAvatar && displayAvatar) {
                // Remove initial text icon and add image
                displayAvatar.innerHTML = `<img src="${API_URL}/Uploads/${resolvedAvatar}" class="h-full w-full object-cover rounded-full">`;
                
                // Remove background gradient from parent div if it exists
                const parent = displayAvatar.parentElement;
                if (parent && parent.classList.contains('bg-gradient-to-tr')) {
                    parent.classList.remove('bg-gradient-to-tr', 'from-primary', 'to-purple-500');
                    parent.classList.add('bg-transparent');
                }
            } else if (displayAvatar && profile.displayName) {
                displayAvatar.textContent = profile.displayName.charAt(0).toUpperCase();
            }
        }
    } catch (error) {
        console.error('Error fetching profile into dashboard:', error);
    }
}

function selectView(view) {
    currentView = view;
    currentPage = 1;
    currentQuery = '';
    currentGenre = ''; // Reset genre filter
    currentPlatform = ''; // Reset platform filter
    currentOrdering = ''; // Reset ordering filter
    currentRelease = ''; // Reset release filter
    currentStatus = ''; // Reset status filter
    
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

    const currentStatusDisplay = document.getElementById('current-status');
    const statusBtn = document.getElementById('status-filter-btn');
    const statusFilterContainer = document.getElementById('status-filter-container');
    if (currentStatusDisplay) currentStatusDisplay.textContent = 'Status';
    if (statusBtn) statusBtn.classList.remove('active-filter-btn');

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

    loadGames(1, '', '', '', '', '', '');
}

// Load games from API (handles both catalog and search)
async function loadGames(page = 1, query = '', genre = '', platform = '', ordering = '', release = '', status = '') {
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
        let result;

        if (currentView === 'catalog' && !status) {
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
            allGames = gamesData;
            if (allGames && allGames.length > 0) {
                if (totalGamesElement) {
                    totalGamesElement.textContent = (query) ? `Search Results` : `Page ${page}`;
                }
                displayGames(allGames);
            } else {
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

    // Metacritic Badge (Top Right - Floating)
    let metacriticBadge = '';
    if (game.metacritic) {
        const mc = game.metacritic;
        // Dynamic colors: Green for 75+, Yellow for 50+, Red for others
        const colors = mc >= 75 ? 'text-[#6cc331] border-[#6cc331]/80' : 
                      (mc >= 50 ? 'text-[#fbc131] border-[#fbc131]/80' : 'text-[#ff0033] border-[#ff0033]/80');
        
        metacriticBadge = `
            <div class="absolute top-4 right-4 w-9 h-9 bg-black/60 backdrop-blur-md border ${colors} rounded-lg flex items-center justify-center z-10 transition-all duration-300 group-hover:opacity-0 group-hover:scale-110 select-none shadow-2xl" title="Metacritic: ${mc}">
                <span class="text-[13px] font-black leading-none">${mc}</span>
            </div>`;
    }

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

    // Status Indicators (Small icons grouped)
    const getStatusIcon = (status) => {
        // Handle both string and numeric values from backend
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
    
    // Check if status is Pending (either string name or enum ID)
    const isPending = game.isInLibrary && (String(game.gamestatus).toLowerCase() === 'pending' || String(game.gamestatus) === '6');
    
    const gameStatusIndicator = isPending ? `
        <div data-status-for="${gameId}" class="h-7 px-3 rounded-full border border-slate-500/30 bg-slate-900/60 backdrop-blur-md flex items-center justify-center cursor-default shadow-lg" title="Status Pending">
                <span class="text-[10px] uppercase font-bold text-slate-300 tracking-wider whitespace-nowrap">Pending</span>
        </div>` : (statusObj ? `
        <div data-status-for="${gameId}" class="h-7 px-2.5 rounded-full border border-primary/20 flex items-center justify-center backdrop-blur-md transition-all duration-500 ease-in-out group-hover:w-fit group-hover:px-4 cursor-default shadow-lg" title="${statusObj.label}">
                <span class="material-symbols-outlined text-[15px] ${statusObj.color} fill-icon transition-all duration-300 group-hover:opacity-0 group-hover:w-0 group-hover:scale-0 group-hover:hidden">${statusObj.icon}</span>
                <span class="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 transition-all duration-500 ease-out text-[10px] uppercase font-bold ${statusObj.color} whitespace-nowrap">${statusObj.label}</span>
        </div>` : `<div data-status-for="${gameId}"></div>`);

    const inventoryIndicators = `
        <div data-inventory-for="${gameId}" class="flex justify-end gap-2 mt-2">
            ${game.isInWishlist ? `
                <div class="h-7 w-7 rounded-full border border-blue-400/30 flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-blue-400/10" title="In Wishlist">
                    <span class="material-symbols-outlined text-[15px] text-blue-400 fill-icon">bookmark</span>
                </div>` : ''}
            ${game.isFavorite ? `
                <div class="h-7 w-7 rounded-full border border-red-500/30 flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-red-500/10" title="Favorited">
                    <span class="material-symbols-outlined text-[15px] text-red-500 fill-icon">favorite</span>
                </div>` : ''}
            ${game.isInLibrary ? `
                <div class="h-7 w-7 rounded-full border border-green-500/30 flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-green-500/10" title="In Library">
                    <span class="material-symbols-outlined text-[15px] text-green-500 fill-icon">inventory_2</span>
                </div>` : ''}
        </div>
    `;

    // Status Selector (Only if in library)
    let statusSelectorHtml = '';
    if (game.isInLibrary && currentView === 'library') {
        const statuses = [
            { id: 1, label: 'Playing', icon: 'play_circle' },
            { id: 3, label: 'Completed', icon: 'task_alt' },
            { id: 4, label: 'Dropped', icon: 'do_not_disturb_on' },
            { id: 5, label: 'On Hold', icon: 'pause_circle' }
        ];
        
        statusSelectorHtml = `
            <div class="mt-4 pt-4 border-t border-[#2e616b]/20 flex items-center justify-between pointer-events-auto">
                <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Game Status</span>
                <div class="flex gap-1.5">
                    ${statuses.map(s => `
                        <button onclick="event.stopPropagation(); changeGameStatus('${gameId}', ${s.id})" 
                                class="w-7 h-7 rounded-lg flex items-center justify-center transition-all 
                                ${String(game.gamestatus).toLowerCase() === String(s.id) || String(game.gamestatus).toLowerCase() === s.label.toLowerCase().replace(' ', '') ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-slate-800/40 text-slate-500 hover:bg-slate-700/60 hover:text-slate-300'}" 
                                title="${s.label}">
                            <span class="material-symbols-outlined text-[16px]">${s.icon}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Favorite/Library Button State logic
    const favTitle = game.isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
    const libTitle = game.isInLibrary ? 'Remove from Library' : 'Add to Library';
    const wishlistTitle = game.isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist';
    
    // Icons are now consistent regardless of state
    const libIcon = 'inventory_2';
    const wishlistIcon = 'bookmark';
    
    // Timestamp for library/favorites views
    let timestampDisplay = '';
    
    // Use clearer text colors and remove fill-icon from button context (move to span)
    const favBtnClass = game.isFavorite ? 'text-red-500' : 'text-white/70 hover:text-red-400';
    const libClass = game.isInLibrary ? 'text-green-500' : 'text-white/70 hover:text-primary';
    const wishlistClass = game.isInWishlist ? 'text-blue-400' : 'text-white/70 hover:text-blue-400';

    // Wishlist is mutually exclusive with Library and Favorite
    const isFavDisabled = game.isInWishlist === true;
    const isLibDisabled = game.isInWishlist === true;
    const isWishlistDisabled = game.isFavorite === true || game.isInLibrary === true;

    const favTitleMsg = isFavDisabled ? 'Remove from Wishlist first' : favTitle;
    const libTitleMsg = isLibDisabled ? 'Remove from Wishlist first' : libTitle;
    const wishTitleMsg = isWishlistDisabled ? (game.isInLibrary ? 'Remove from Library first' : 'Remove from Favorites first') : wishlistTitle;

    card.innerHTML = `
        <!-- Image & Actions -->
        <div class="relative h-72 overflow-hidden">
            <img src="${imageUrl}" alt="${title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='../../Assets/Images/logo.png'">
            
            ${ratingBadge}
            ${metacriticBadge}

            <!-- Action Buttons (Top Right) -->
            <div class="absolute top-4 right-4 flex flex-col gap-3 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 z-20">
                <button data-fav-btn-for="${gameId}" class="w-11 h-11 glass-neon-btn ${favBtnClass} group/heart ${isFavDisabled ? 'opacity-40 cursor-not-allowed' : ''}" 
                        title="${favTitleMsg}" 
                        ${isFavDisabled ? 'disabled' : `onclick="event.stopPropagation(); addToFavorites('${gameId}')"`}>
                    <span class="material-symbols-outlined text-[24px] ${!isFavDisabled ? 'group-hover/heart:scale-110' : ''} transition-transform ${game.isFavorite ? 'fill-icon' : ''}">favorite</span>
                </button>
                <button data-lib-btn-for="${gameId}" class="w-11 h-11 glass-neon-btn ${libClass} group/add ${isLibDisabled ? 'opacity-40 cursor-not-allowed' : ''}" 
                        title="${libTitleMsg}" 
                        ${isLibDisabled ? 'disabled' : `onclick="event.stopPropagation(); addToLibrary('${gameId}')"`}>
                    <span class="material-symbols-outlined text-[24px] ${!isLibDisabled ? 'group-hover/add:scale-110' : ''} transition-transform ${game.isInLibrary ? 'fill-icon' : ''}">${libIcon}</span>
                </button>
                <button data-wish-btn-for="${gameId}" class="w-11 h-11 glass-neon-btn ${wishlistClass} group/wish ${isWishlistDisabled ? 'opacity-40 cursor-not-allowed' : ''}" 
                        title="${wishTitleMsg}" 
                        ${isWishlistDisabled ? 'disabled' : `onclick="event.stopPropagation(); addToWishlist('${gameId}')"`}>
                    <span class="material-symbols-outlined text-[24px] ${!isWishlistDisabled ? 'group-hover/wish:scale-110' : ''} transition-transform ${game.isInWishlist ? 'fill-icon' : ''}">${wishlistIcon}</span>
                </button>
            </div>

            ${platformIconsPanel}
            
            <!-- Game Status & Added At Group -->
            <div class="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1.5">
                ${gameStatusIndicator}
                ${game.addedAt ? `
                    <div class="h-7 px-2.5 rounded-full border border-primary/20 flex items-center justify-center backdrop-blur-md transition-all duration-500 ease-in-out group-hover:w-fit group-hover:px-4 cursor-default shadow-lg">
                        <span class="material-symbols-outlined text-[15px] text-primary/70 fill-icon transition-all duration-300 group-hover:opacity-0 group-hover:w-0 group-hover:scale-0 group-hover:hidden">schedule</span>
                        <span class="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 transition-all duration-500 ease-out text-[10px] uppercase font-bold text-primary/90 whitespace-nowrap">added ${getRelativeTime(game.addedAt)}</span>
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Info Section -->
        <div class="p-6">
            <div class="flex items-start justify-between mb-2 gap-3">
                <div class="overflow-hidden flex-1">
                    <h2 class="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate mb-1" title="${title}">${title}</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">${category}</p>
                </div>
                <div class="flex flex-col items-end">
                    ${releaseYearBadge}
                    ${inventoryIndicators}
                </div>
            </div>
            ${statusSelectorHtml}
        </div>
    `;

    card.addEventListener('click', () => {
        showGameDetails(game);
    });
    
    return card;
}

// Update pagination controls
function updatePaginationControls(page, query, genre, platform, ordering, release, status, paginationInfo) {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (prevBtn) prevBtn.disabled = page === 1;
    
    if (paginationInfo.isCatalog) {
        // Catalog uses simple logic: if count < pageSize, we're at the end
        if (pageInfo) pageInfo.textContent = (query) ? 'Search Results' : `Page ${page}`;
        
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
    
    // Store current page state
    currentPage = page;
    currentQuery = query;
    currentGenre = genre;
    currentPlatform = platform;
    currentOrdering = ordering;
    currentRelease = release;
    currentStatus = status;
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
    if (!searchInput) return;

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        debounceTimer = setTimeout(() => {
            currentPage = 1; // Reset to page 1 on new search
            loadGames(1, query, currentGenre, currentPlatform, currentOrdering, currentRelease, currentStatus);
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
    // Update local data cache first
    const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
    if (cachedGame) {
        cachedGame.isFavorite = isFavorite;
        // If favorited, it cannot be in wishlist
        if (isFavorite) cachedGame.isInWishlist = false;
        
        // Use central indicator update to refresh everything consistently
        updateStatusIndicators(gameId, cachedGame);
    }

    // Update specific favorite buttons (animation and titles)
    const favButtons = document.querySelectorAll(`[data-fav-btn-for="${gameId}"]`);
    favButtons.forEach(btn => {
        const iconSpan = btn.querySelector('.material-symbols-outlined');
        if (iconSpan) {
            if (isFavorite) {
                 btn.classList.add('text-red-500');
                 btn.classList.remove('text-white/70', 'hover:text-red-400');
                 iconSpan.classList.add('fill-icon', 'animate-pop');
                 btn.title = 'Remove from Favorites';
                 setTimeout(() => iconSpan.classList.remove('animate-pop'), 450);
            } else {
                 btn.classList.remove('text-red-500');
                 btn.classList.add('text-white/70', 'hover:text-red-400');
                 iconSpan.classList.remove('fill-icon');
                 btn.title = 'Add to Favorites';
            }
        }
    });

    // Mutual exclusivity UI (Wishlist button)
    const wishButtons = document.querySelectorAll(`[data-wish-btn-for="${gameId}"]`);
    wishButtons.forEach(btn => {
        if (isFavorite) {
            btn.disabled = true;
            btn.classList.add('opacity-40', 'cursor-not-allowed');
            btn.title = 'Cannot wishlist favorite games';
            btn.classList.remove('text-blue-400');
            btn.classList.add('text-white/70');
            btn.querySelector('.material-symbols-outlined')?.classList.remove('fill-icon');
        } else {
            const isWishDisabledByView = currentView === 'favorites' || currentView === 'library';
            btn.disabled = isWishDisabledByView;
            if (!isWishDisabledByView) {
                btn.classList.remove('opacity-40', 'cursor-not-allowed');
                btn.title = 'Add to Wishlist';
            } else {
                btn.title = 'Management disabled in this view';
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
}

function updateStatusIndicators(gameId, game) {
    const statusContainers = document.querySelectorAll(`[data-status-for="${gameId}"]`);
    const inventoryContainers = document.querySelectorAll(`[data-inventory-for="${gameId}"]`);
    const libButtons = document.querySelectorAll(`[data-lib-btn-for="${gameId}"]`);
    const favButtons = document.querySelectorAll(`[data-fav-btn-for="${gameId}"]`);
    const wishButtons = document.querySelectorAll(`[data-wish-btn-for="${gameId}"]`);
    
    // Status Icon Logic (Helper)
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

    // Update Image Status
    statusContainers.forEach(container => {
        if (!game.isInLibrary) {
            // Not in library — clear status icon entirely
            container.className = '';
            container.innerHTML = '';
            return;
        }
        if (isPending) {
            container.className = 'absolute bottom-3 right-3 z-10 transition-all duration-500';
            container.innerHTML = `
                <div class="h-7 px-3 rounded-full border border-slate-500/30 bg-slate-900/60 backdrop-blur-md flex items-center justify-center cursor-default shadow-lg" title="Status Pending">
                    <span class="text-[10px] uppercase font-bold text-slate-300 tracking-wider whitespace-nowrap">Pending</span>
                </div>`;
        } else {
            container.className = 'h-7 px-2.5 rounded-full border border-primary/20 flex items-center justify-center backdrop-blur-md transition-all duration-500 ease-in-out group-hover:w-fit group-hover:px-4 cursor-default shadow-lg';
            container.innerHTML = statusObj ? `
                    <span class="material-symbols-outlined text-[15px] ${statusObj.color} fill-icon transition-all duration-300 group-hover:opacity-0 group-hover:w-0 group-hover:scale-0 group-hover:hidden">${statusObj.icon}</span>
                    <span class="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 transition-all duration-500 ease-out text-[10px] uppercase font-bold ${statusObj.color} whitespace-nowrap">${statusObj.label}</span>
                ` : '';
        }
    });

    // Update Inventory Indicators (Below title)
    inventoryContainers.forEach(container => {
        container.innerHTML = `
            ${game.isInWishlist ? `
                <div class="h-7 w-7 rounded-full border border-blue-400/30 flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-blue-400/10" title="In Wishlist">
                    <span class="material-symbols-outlined text-[15px] text-blue-400 fill-icon">bookmark</span>
                </div>` : ''}
            ${game.isFavorite ? `
                <div class="h-7 w-7 rounded-full border border-red-500/30 flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-red-500/10" title="Favorited">
                    <span class="material-symbols-outlined text-[15px] text-red-500 fill-icon">favorite</span>
                </div>` : ''}
            ${game.isInLibrary ? `
                <div class="h-7 w-7 rounded-full border border-green-500/30 flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-green-500/10" title="In Library">
                    <span class="material-symbols-outlined text-[15px] text-green-500 fill-icon">inventory_2</span>
                </div>` : ''}
        `;
    });

    // Update Overlay Buttons
    const favLocked = game.isInWishlist === true;
    const libLocked = game.isInWishlist === true;
    const wishLocked = game.isFavorite === true || game.isInLibrary === true;

    favButtons.forEach(btn => {
        btn.classList.remove('text-red-500', 'text-white/70', 'hover:text-red-400', 'opacity-40', 'cursor-not-allowed');
        btn.disabled = favLocked;
        const icon = btn.querySelector('.material-symbols-outlined');
        if (favLocked) {
            btn.classList.add('text-white/70', 'opacity-40', 'cursor-not-allowed');
            btn.title = 'Remove from Wishlist first';
            if (icon) icon.classList.remove('fill-icon');
        } else if (game.isFavorite) {
            btn.classList.add('text-red-500');
            btn.title = 'Remove from Favorites';
            if (icon) icon.classList.add('fill-icon');
        } else {
            btn.classList.add('text-white/70', 'hover:text-red-400');
            btn.title = 'Add to Favorites';
            if (icon) icon.classList.remove('fill-icon');
        }
    });

    libButtons.forEach(btn => {
        btn.classList.remove('text-green-500', 'text-white/70', 'hover:text-primary', 'opacity-40', 'cursor-not-allowed');
        btn.disabled = libLocked;
        const icon = btn.querySelector('.material-symbols-outlined');
        if (libLocked) {
            btn.classList.add('text-white/70', 'opacity-40', 'cursor-not-allowed');
            btn.title = 'Remove from Wishlist first';
            if (icon) { icon.textContent = 'inventory_2'; icon.classList.remove('fill-icon'); }
        } else if (game.isInLibrary) {
            btn.classList.add('text-green-500');
            btn.title = 'Remove from Library';
            if (icon) { icon.textContent = 'inventory_2'; icon.classList.add('fill-icon'); }
        } else {
            btn.classList.add('text-white/70', 'hover:text-primary');
            btn.title = 'Add to Library';
            if (icon) { icon.textContent = 'inventory_2'; icon.classList.remove('fill-icon'); }
        }
    });

    wishButtons.forEach(btn => {
        btn.classList.remove('text-blue-400', 'text-white/70', 'hover:text-blue-400', 'opacity-40', 'cursor-not-allowed');
        btn.disabled = wishLocked;
        const icon = btn.querySelector('.material-symbols-outlined');
        if (wishLocked) {
            btn.classList.add('text-white/70', 'opacity-40', 'cursor-not-allowed');
            btn.title = game.isInLibrary ? 'Remove from Library first' : 'Remove from Favorites first';
            if (icon) { icon.textContent = 'bookmark'; icon.classList.remove('fill-icon'); }
        } else if (game.isInWishlist) {
            btn.classList.add('text-blue-400');
            btn.title = 'Remove from Wishlist';
            if (icon) { icon.textContent = 'bookmark'; icon.classList.add('fill-icon'); }
            if (icon) {
                icon.textContent = 'bookmark';
                icon.classList.add('fill-icon', 'animate-pop');
                // Remove pop animation after it completes
                setTimeout(() => icon.classList.remove('animate-pop'), 450);
            }
        } else {
            btn.classList.add('text-white/70', 'hover:text-blue-400');
            btn.title = 'Add to Wishlist';
            if (icon) { icon.textContent = 'bookmark'; icon.classList.remove('fill-icon'); }
        }
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
                 btn.classList.add('text-green-500');
                 btn.classList.remove('text-white/70', 'hover:text-primary');
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
            }, 600);
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
         if (isInLibrary) {
             cachedGame.gamestatus = 6; // Pending
             // isInWishlist and isFavorite are untouched — independent
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
        }
    } catch (error) {
        console.error('Error toggling wishlist status:', error);
    }
}

function updateWishlistUI(gameId, isInWishlist) {
    const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
    if (cachedGame) {
        cachedGame.isInWishlist = isInWishlist;
        // If on wishlist, it cannot be favorite
        if (isInWishlist) {
            cachedGame.isFavorite = false;
            cachedGame.gamestatus = 'whishlist'; // Ensure the blue badge appears
        } else {
            // Only clear status if it was wishlist (don't clear if it was in library)
            if (cachedGame.gamestatus === 'whishlist' || cachedGame.gamestatus === 2) {
                cachedGame.gamestatus = null;
            }
        }
        updateStatusIndicators(gameId, cachedGame);
    }

    const wishButtons = document.querySelectorAll(`[data-wish-btn-for="${gameId}"]`);
    wishButtons.forEach(btn => {
        const iconSpan = btn.querySelector('.material-symbols-outlined');
        if (iconSpan) {
            if (isInWishlist) {
                btn.classList.add('text-blue-400');
                btn.classList.remove('text-white/70', 'hover:text-blue-400');
                iconSpan.textContent = 'bookmark';
                iconSpan.classList.add('fill-icon', 'animate-pop');
                btn.title = 'Remove from Wishlist';
                setTimeout(() => iconSpan.classList.remove('animate-pop'), 450);
            } else {
                btn.classList.remove('text-blue-400');
                btn.classList.add('text-white/70', 'hover:text-blue-400');
                iconSpan.textContent = 'bookmark';
                iconSpan.classList.remove('fill-icon');
                btn.title = 'Add to Wishlist';
            }
        }
    });

    // Handle view-specific item removal (if on wishlist page)
    if (currentView === 'wishlist' && !isInWishlist) {
        const cardToRemove = document.querySelector(`[data-wish-btn-for="${gameId}"]`).closest('.group');
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
    window.location.href = `../../GameDetails/Html/game-details.html?id=${gameId}`;
}

// Update game status in database
async function changeGameStatus(gameId, statusId) {
    try {
        const response = await apiRequest(`/api/UserGames/UpdateUserGame`, {
            method: 'PATCH',
            body: JSON.stringify({
                gameId: parseInt(gameId),
                gamestatus: statusId
            })
        });

        if (response.ok) {
            const updated = await response.json();
            
            // Toast
            const statusLabels = { 1: 'Playing', 3: 'Completed', 4: 'Dropped', 5: 'On Hold', 6: 'Pending' };
            showToast(`Status updated to "${statusLabels[statusId]}"!`, 'success');

            // Update local state
            const cachedGame = allGames.find(g => (g.externalId || g.id) == gameId);
            if (cachedGame) {
                cachedGame.gamestatus = statusId;
                updateStatusIndicators(gameId, cachedGame);
                
                // Re-render the selector on this specific card
                updateStatusSelectorUI(gameId, statusId);
            }
        } else {
            showToast('Failed to update status', 'error');
        }
    } catch (error) {
        console.error('Error updating game status:', error);
    }
}

function updateStatusSelectorUI(gameId, statusId) {
    // Find all selector buttons for this game
    const indicators = document.querySelector(`[data-status-for="${gameId}"]`);
    if (!indicators) return;

    const card = indicators.closest('.group');
    if (!card) return;
    
    const buttons = card.querySelectorAll('button[onclick*="changeGameStatus"]');
    buttons.forEach(btn => {
        // Extract status from onclick
        const match = btn.getAttribute('onclick').match(/changeGameStatus\(.*?,[\s]*(\d+)\)/);
        if (match) {
            const btnStatusId = parseInt(match[1]);
            const isActive = btnStatusId === statusId;
            
            if (isActive) {
                btn.className = 'w-7 h-7 rounded-lg flex items-center justify-center transition-all bg-primary/20 text-primary border border-primary/40';
            } else {
                btn.className = 'w-7 h-7 rounded-lg flex items-center justify-center transition-all bg-slate-800/40 text-slate-500 hover:bg-slate-700/60 hover:text-slate-300';
            }
        }
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
