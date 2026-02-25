// Pagination state
let currentPage = 1;
let currentQuery = ''; // Store current search query
let gamesPerPage = 20; // Updated to match backend
let allGames = []; // Will store just the current page of games now

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = '../../Auth/Html/login.html';
        return;
    }
    
    // Display user info
    displayUserInfo();
    
    loadGames(currentPage); // Initial load
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

// Load games from API (handles both catalog and search)
async function loadGames(page = 1, query = '') {
    const container = document.getElementById('library-games');
    const totalGamesElement = document.getElementById('total-games');
    const loadingHtml = `
        <div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
            <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p>Loading games...</p>
        </div>
    `;
    
    container.innerHTML = loadingHtml;
    
    try {
        let endpoint;
        const container = document.getElementById('library-games');
        
        if (query) {
             endpoint = `/api/RAWG/catalog/search?query=${encodeURIComponent(query)}`;
        } else {
             endpoint = `/api/RAWG/catalog/GetAll?page=${page}`;
        }
        
        const response = await apiRequest(endpoint, {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load games');
        }
        
        const gamesData = await response.json();
        allGames = gamesData; // Store current batch
        
        if (allGames && allGames.length > 0) {
            
            if (query) {
                 totalGamesElement.textContent = `Search Results`;
            } else {
                 totalGamesElement.textContent = `Page ${page}`;
            }
           
            displayGames(allGames);
        } else {
            container.innerHTML = `
                <div class="game-card" style="grid-column: 1/-1;">
                    <div class="game-info">
                        <p style="color: var(--text-secondary); text-align: center; padding: 40px;">
                            No games found.
                        </p>
                    </div>
                </div>
            `;
            totalGamesElement.textContent = '0 Games';
        }
        
        updatePaginationControls(page, query);

    } catch (error) {
        console.error('Error loading games:', error);
        container.innerHTML = `
            <div class="game-card" style="grid-column: 1/-1;">
                <div class="game-info">
                    <p style="color: var(--text-secondary); text-align: center; padding: 40px;">
                        Unable to load games. Make sure the API is running.
                    </p>
                </div>
            </div>
        `;
        totalGamesElement.textContent = 'Error';
    }
}

// Display games (no slicing needed as we fetch per page)
function displayGames(games) {
    const container = document.getElementById('library-games');
    container.innerHTML = '';
    
    games.forEach(game => {
        container.appendChild(createGameCard(game, 'owned'));
    });
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
    const contentArea = document.querySelector('.content-area'); // Need to check if class is correct in HTML
    // Based on dashboard.html: <div class="main-content"> ... <div class="content-container"> 
    // Wait, I updated dashboard.html to use "content-container".
    if (contentArea) {
        contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Create game card element
function createGameCard(game, tag = 'new') {
    const card = document.createElement('div');
    // Tailwind-styled Game Card
    card.className = 'group bg-[#1e292b] rounded-xl overflow-hidden border border-[#2e616b]/30 hover:border-primary/50 transition-all duration-300 relative hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 cursor-pointer';
    
    // Support multiple property names for image/title just in case API returns different DTOs
    const imageUrl = game.imageUrl || game.imgUrl || game.backgroundImage || game.background_image || '../../Assets/Images/default-game.jpg'; 
    const title = game.title || game.name || 'Unknown Game';

    // Get genre/category from tags if available
    let category = 'Action • RPG';
    if (game.genres && Array.isArray(game.genres) && game.genres.length > 0) {
        // Handle both string arrays (RAWGCatalogDto) and object arrays (if any)
        if (typeof game.genres[0] === 'string') {
            category = game.genres.slice(0, 3).join(' • ');
        } else if (game.genres[0].name) {
            category = game.genres.map(g => g.name).slice(0, 2).join(' • ');
        }
    } else if (game.tags && Array.isArray(game.tags) && game.tags.length > 0) {
        category = game.tags.map(t => t.name).slice(0, 2).join(' • ');
    }
    
    // Rating badge if available
    const ratingBadge = game.rating ? 
        `<span class="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase tracking-wide flex items-center gap-1">
           <span class="text-yellow-400">★</span> ${game.rating}
         </span>` : '';

    // Format Release Date
    let releaseYear = '';
    if (game.releaseDate) {
        const date = new Date(game.releaseDate);
        if (!isNaN(date.getFullYear())) {
            releaseYear = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300">${date.getFullYear()}</span>`;
        }
    }

    // Generate Platform Icons
    let platformIconsHtml = ''; // renamed to avoid conflict/confusion
    if (game.platforms && Array.isArray(game.platforms) && game.platforms.length > 0) {
        const uniqueIcons = new Set();
        const icons = game.platforms.map(slug => {
            let iconClass = '';
            // Map slugs to FontAwesome brands
            switch(slug.toLowerCase()) {
                case 'pc': iconClass = 'fa-windows'; break;
                case 'playstation': iconClass = 'fa-playstation'; break;
                case 'xbox': iconClass = 'fa-xbox'; break;
                case 'nintendo': iconClass = 'fa-nintendo-switch'; break; 
                case 'mac': iconClass = 'fa-apple'; break;
                case 'linux': iconClass = 'fa-linux'; break;
                case 'android': iconClass = 'fa-android'; break;
                case 'ios': iconClass = 'fa-app-store-ios'; break; 
                case 'web': iconClass = 'fa-chrome'; break;
                default: return ''; 
            }
            if (uniqueIcons.has(iconClass)) return ''; // Avoid duplicates
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

    card.innerHTML = `
        <div class="aspect-[16/9] overflow-hidden relative">
            <img src="${imageUrl}" alt="${title}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onerror="this.src='../../Assets/Images/logo.png'">
            <div class="absolute inset-0 bg-gradient-to-t from-[#1e292b] to-transparent opacity-60"></div>
            ${ratingBadge}
            ${platformIconsHtml}
        </div>
        <div class="p-4">
            <div class="flex justify-between items-start mb-1 gap-2">
                <h4 class="font-bold text-white truncate flex-1" title="${title}">${title}</h4>
                ${releaseYear}
            </div>
            <div class="flex items-center justify-between text-xs text-slate-400">
                <span class="truncate max-w-[180px]">${category}</span>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        showGameDetails(game);
    });
    
    return card;
}

// Show game details (placeholder for future implementation)
function showGameDetails(game) {
    console.log('Show details for:', game);
    alert(`Game: ${game.title}\n\nClick to view full details (feature coming soon!)`);
}

// Initialize navigation
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't prevent default for Settings and User Profile (if implemented as links)
            // But here they are divs or A tags.
            const icon = item.querySelector('i');
            
            // Handle Logout check if inside sidebar-footer
            // Logout button is separate in new HTML.
            
            if (!item.classList.contains('logout-btn') && !item.closest('.user-profile')) {
                e.preventDefault();
                
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });
}

// Search functionality
function initializeSearch() {
    const searchInput = document.querySelector('.search-bar input');
    if (!searchInput) return;

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        debounceTimer = setTimeout(() => {
            // Reset to page 1 for new search
            currentPage = 1;
            loadGames(1, query);
        }, 500); // 500ms debounce
    });
}
