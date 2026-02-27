// Favorite games state
let favoriteGames = [];
let currentIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = '../../Auth/Html/login.html';
        return;
    }
    
    // Initial display
    displayUserInfo();
    initializeProfile();
    loadFavorites();
});

// Display user information
function displayUserInfo() {
    const userInfo = getUserInfo();
    const usernameElements = document.querySelectorAll('#display-username, #profile-username');
    const avatarImg = document.getElementById('profile-avatar-img');
    const displayAvatar = document.getElementById('display-avatar');
    
    usernameElements.forEach(el => {
        el.textContent = userInfo.userName || 'User';
    });
    
    if (displayAvatar) {
        displayAvatar.textContent = userInfo.userName ? userInfo.userName.charAt(0).toUpperCase() : 'U';
    }
    
    if (avatarImg) {
        // Fallback for avatar using UI Avatars
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.userName || 'User')}&background=080f0f&color=0df2f2&size=200`;
    }
}

async function loadFavorites() {
    const carouselWrapper = document.getElementById('carousel-wrapper');
    if (!carouselWrapper) return;

    try {
        const response = await apiRequest('/api/UserGames/GetAllUserGames');
        if (!response.ok) throw new Error('Failed to load favorites');
        
        const allUserGames = await response.json();
        
        // Update Library Stats with dynamic data
        updateLibraryStats(allUserGames);

        // Filter for favorites and map correctly
        favoriteGames = allUserGames.filter(ug => ug.isFavorite).map(ug => ({
            id: ug.externalId,
            title: ug.gameTitle,
            imageUrl: ug.gameImageUrl,
            hoursPlayed: (Math.floor(Math.random() * 50) + 10) // Mocking since DB doesn't have it yet
        }));

        if (favoriteGames.length === 0) {
            carouselWrapper.innerHTML = `
                <div class="flex flex-col items-center justify-center p-10 text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl w-full">
                    <span class="material-symbols-outlined text-4xl mb-4">sentiment_neutral</span>
                    <p class="font-medium italic">No favorites added yet.</p>
                </div>
            `;
            return;
        }

        renderCarousel();
    } catch (error) {
        console.error('Error loading favorites:', error);
        carouselWrapper.innerHTML = `
            <div class="p-10 text-red-400 bg-red-500/5 rounded-3xl border border-red-500/20 text-center w-full">
                <span class="material-symbols-outlined mb-2">error</span>
                <p>Failed to load favorite games</p>
            </div>
        `;
    }
}

function updateLibraryStats(allGames) {
    if (!allGames || allGames.length === 0) return;

    const favoriteCount = allGames.filter(g => g.isFavorite).length;
    const wishlistedCount = allGames.filter(g => g.gamestatus === 'whishlist' || g.gamestatus === 2).length;
    
    // Owned = Total games in library MINUS those that are only wishlisted
    const ownedCount = allGames.length - wishlistedCount;
    
    const completedCount = allGames.filter(g => g.gamestatus === 'completed' || g.gamestatus === 3).length;
    
    // Other Statuses (revealed by arrow)
    const playingCount = allGames.filter(g => g.gamestatus === 'playing' || g.gamestatus === 1).length;
    const droppedCount = allGames.filter(g => g.gamestatus === 'Dropped' || g.gamestatus === 4).length;
    const onHoldCount = allGames.filter(g => g.gamestatus === 'OnHold' || g.gamestatus === 5).length;
    const pendingCount = allGames.filter(g => g.gamestatus === 'Pending' || g.gamestatus === 6).length;

    // Update Top Header Stats
    const sets = {
        'stat-owned': ownedCount,
        'stat-favorite': favoriteCount,
        'stat-wishlisted': wishlistedCount,
        'stat-completed': completedCount,
        'stat-playing': playingCount,
        'stat-dropped': droppedCount,
        'stat-onhold': onHoldCount,
        'stat-pending': pendingCount
    };
    
    for (const [id, value] of Object.entries(sets)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toLocaleString();
    }

    // Update Snapshot Stats (Total Games keeps its place in the snapshot too)
    const snapTotalGames = document.getElementById('snapshot-total-games');
    const snapTotalHours = document.getElementById('snapshot-total-hours');
    
    const mockTotalHours = allGames.reduce((acc, g) => acc + (Math.floor(Math.random() * 40) + 15), 0);
    
    if (snapTotalGames) snapTotalGames.textContent = ownedCount.toLocaleString();
    if (snapTotalHours) snapTotalHours.textContent = mockTotalHours.toLocaleString();

    // Calculate Genre Distribution
    calculateGenres(allGames);
}

function toggleOtherStats() {
    const popup = document.getElementById('other-stats-popup');
    if (popup) {
        popup.classList.toggle('hidden');
        
        // Close on click outside
        if (!popup.classList.contains('hidden')) {
            const closeHandler = (e) => {
                if (!popup.contains(e.target) && !e.target.closest('button')) {
                    popup.classList.add('hidden');
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 10);
        }
    }
}

function calculateGenres(allGames) {
    const genreCounts = {};
    allGames.forEach(game => {
        if (game.genres && game.genres.length > 0) {
            game.genres.forEach(genre => {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
            });
        }
    });

    const sortedGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, 4); // Take top 4

    if (sortedGenres.length > 0) {
        const topGenreLabel = document.getElementById('top-genre-label');
        if (topGenreLabel) topGenreLabel.textContent = sortedGenres[0][0];

        sortedGenres.forEach((genre, index) => {
            const nameEl = document.getElementById(`genre-${index + 1}-name`);
            const statEl = document.getElementById(`genre-${index + 1}-stat`);
            if (nameEl && statEl) {
                const percentage = Math.round((genre[1] / allGames.length) * 100);
                nameEl.textContent = genre[0];
                statEl.textContent = `${genre[1]} Games (${percentage}%)`;
            }
        });
    }
}

function renderCarousel() {
    const wrapper = document.getElementById('carousel-wrapper');
    if (!wrapper || favoriteGames.length === 0) return;

    wrapper.innerHTML = '';
    
    favoriteGames.forEach((game, index) => {
        const card = document.createElement('div');
        card.className = 'carousel-card hidden'; // Initial state
        card.innerHTML = `
            <img src="${game.imageUrl}" alt="${game.title}" onerror="this.src='../../Assets/Images/avatar-placeholder.jpg'">
            <div class="card-overlay"></div>
            <div class="card-content">
                <p class="text-primary text-[9px] font-bold uppercase tracking-[0.2em] mb-2 xirod-font">MOST PLAYED</p>
                <h3 class="text-xl font-bold text-white leading-tight mb-2 tracking-tight">${game.title}</h3>
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-primary">schedule</span>
                    <span class="text-xs text-slate-300 font-medium">${game.hoursPlayed} Hours</span>
                </div>
            </div>
        `;
        
        card.onclick = () => {
            const currentIdxOfCard = index; 
            const offset = (currentIdxOfCard - currentIndex + favoriteGames.length) % favoriteGames.length;
            
            if (offset === 1 ) {
                moveCarousel(1);
            } else if (offset === favoriteGames.length - 1) {
                moveCarousel(-1);
            }
        };
        
        wrapper.appendChild(card);
    });

    updateCarousel();
    loadRecentActivity(); // Load activity too
}

function updateCarousel() {
    const cards = document.querySelectorAll('.carousel-card');
    if (cards.length === 0) return;

    cards.forEach((card, index) => {
        // Clear classes
        card.classList.remove('active', 'left', 'right', 'hidden');
        
        // Cyclic offset
        const offset = (index - currentIndex + favoriteGames.length) % favoriteGames.length;
        
        if (offset === 0) {
            card.classList.add('active');
        } else if (offset === 1) {
             card.classList.add('right');
        } else if (offset === favoriteGames.length - 1) {
             card.classList.add('left');
        } else {
             card.classList.add('hidden');
        }
    });
}

function loadRecentActivity() {
    const activityList = document.getElementById('recent-activity-list');
    if (!activityList || favoriteGames.length === 0) return;

    // Use current favorites as sample recent activity for variety
    const recentGames = favoriteGames.slice(0, 3);
    activityList.innerHTML = '';

    recentGames.forEach(game => {
        const item = document.createElement('div');
        item.className = 'glass-panel p-3 rounded-xl flex gap-4 hover:bg-primary/5 transition-all cursor-pointer glow-border group';
        item.innerHTML = `
            <div class="size-16 rounded-lg bg-cover bg-center flex-shrink-0" style="background-image: url('${game.imageUrl}')"></div>
            <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold text-slate-100 truncate">${game.title}</h4>
                <p class="text-[11px] text-slate-500 mt-1">Acquired 4h ago</p>
                <div class="flex gap-1 mt-2">
                    <span class="px-2 py-0.5 rounded bg-primary/20 text-primary text-[9px] font-bold xirod-font">LEGENDARY</span>
                </div>
            </div>
        `;
        activityList.appendChild(item);
    });
}

function moveCarousel(direction) {
    if (favoriteGames.length <= 1) return;
    currentIndex = (currentIndex + direction + favoriteGames.length) % favoriteGames.length;
    updateCarousel();
}

function initializeProfile() {
    console.log('Profile initialized');
}

// Sidebar Navigation Helper (to point back to dashboard properly)
function navigateToDashboard(view = 'catalog') {
    window.location.href = `../../Dashboard/Html/dashboard.html?view=${view}`;
}

// Profile specific logout (uses shared logout from auth.js if loaded)
function logout() {
    clearAuthData();
    window.location.href = '../../Auth/Html/login.html';
}
