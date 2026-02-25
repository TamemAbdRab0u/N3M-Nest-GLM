// Pagination state
let currentPage = 1;
let gamesPerPage = 10;
let allGames = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = '../../Auth/Html/login.html';
        return;
    }
    
    // Display user info
    displayUserInfo();
    
    loadAllGames();
    initializeNavigation();
    initializePagination();
});

// Display user information
function displayUserInfo() {
    const userInfo = getUserInfo();
    const usernameElements = document.querySelectorAll('#display-username, #welcome-username');
    
    usernameElements.forEach(el => {
        el.textContent = userInfo.userName || 'User';
    });
}

// Load all games from API
async function loadAllGames() {
    const container = document.getElementById('library-games');
    const totalGamesElement = document.getElementById('total-games');
    
    try {
        const response = await apiRequest('/api/RAWG/catalog/GetAll', {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load games');
        }
        
        allGames = await response.json();
        
        if (allGames && allGames.length > 0) {
            totalGamesElement.textContent = `${allGames.length} Game${allGames.length !== 1 ? 's' : ''}`;
            displayGamesPage(1);
        } else {
            container.innerHTML = `
                <div class="game-card" style="grid-column: 1/-1;">
                    <div class="game-info">
                        <p style="color: var(--text-secondary); text-align: center; padding: 40px;">
                            No games found in the catalog.
                        </p>
                    </div>
                </div>
            `;
            totalGamesElement.textContent = '0 Games';
        }
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
        totalGamesElement.textContent = '0 Games';
    }
}

// Display games for current page
function displayGamesPage(page) {
    const container = document.getElementById('library-games');
    const startIndex = (page - 1) * gamesPerPage;
    const endIndex = startIndex + gamesPerPage;
    const gamesToDisplay = allGames.slice(startIndex, endIndex);
    
    container.innerHTML = '';
    
    gamesToDisplay.forEach(game => {
        container.appendChild(createGameCard(game, 'owned'));
    });
    
    currentPage = page;
    updatePaginationControls();
}

// Update pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(allGames.length / gamesPerPage);
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// Initialize pagination buttons
function initializePagination() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            displayGamesPage(currentPage - 1);
            scrollToTop();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(allGames.length / gamesPerPage);
        if (currentPage < totalPages) {
            displayGamesPage(currentPage + 1);
            scrollToTop();
        }
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
    if (game.tags && Array.isArray(game.tags) && game.tags.length > 0) {
        category = game.tags.map(t => t.name).slice(0, 2).join(' • ');
    } else if (game.genres && Array.isArray(game.genres) && game.genres.length > 0) {
         category = game.genres.map(g => g.name).slice(0, 2).join(' • ');
    }
    
    // Rating badge if available
    const ratingBadge = game.rating ? 
        `<span class="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase tracking-wide flex items-center gap-1">
           <span class="text-yellow-400">★</span> ${game.rating}
         </span>` : '';

    card.innerHTML = `
        <div class="aspect-[16/9] overflow-hidden relative">
            <img src="${imageUrl}" alt="${title}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onerror="this.src='../../Assets/Images/logo.png'">
            <div class="absolute inset-0 bg-gradient-to-t from-[#1e292b] to-transparent opacity-60"></div>
            ${ratingBadge}
        </div>
        <div class="p-4">
            <h4 class="font-bold text-white truncate mb-1" title="${title}">${title}</h4>
            <div class="flex items-center justify-between text-xs text-slate-400">
                <span class="truncate max-w-[100px]">${category}</span>
                <span class="material-symbols-outlined text-[16px] text-slate-500 group-hover:text-primary transition-colors">videogame_asset</span>
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
const searchInput = document.querySelector('.search-bar input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        console.log('Searching for:', query);
        // Implement search functionality
    });
}
