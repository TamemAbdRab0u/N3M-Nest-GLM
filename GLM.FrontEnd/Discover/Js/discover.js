/**
 * Discover Page Logic - Neon Kinetic
 * Handles dynamic fetching and rendering of the Steam Discovery Homepage
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial UI Setup
    setupUserInfo();

    // 2. Fetch Store Data
    await loadDiscoveryData();
});

/**
 * Fetches data from the /api/steam/store/home endpoint
 */
async function loadDiscoveryData() {
    const contentContainer = document.getElementById('discovery-content');

    try {
        const response = await apiRequest('/api/Steam/store/home');

        if (!response.ok) {
            throw new Error('Failed to fetch discovery data');
        }

        const data = await response.json();

        if (!data || !data.sections || data.sections.length === 0) {
            renderEmptyState();
            return;
        }

        // 3. Clear Skeletons
        contentContainer.innerHTML = '';

        // 1. Featured Hero
        const featuredSection = data.sections.find(s => s.id === 'featured') || data.sections[0];
        if (featuredSection && featuredSection.games.length > 0) {
            renderHeroCarousel(featuredSection.games.slice(0, 10));
        }

        // 2. Discovery Lanes (genres)
        const remainingSections = data.sections.filter(s => s !== featuredSection);
        remainingSections.forEach(section => renderSection(section));

    } catch (error) {
        console.error('Discovery Load Error:', error);
        renderErrorState();
    }
}

/**
 * Renders the Hero Carousel with high-impact game cards
 */
function renderHeroCarousel(items) {
    const carouselInner = document.getElementById('carousel-inner');
    if (!carouselInner || items.length === 0) return;

    carouselInner.innerHTML = '';

    // Specific slogans for iconic games
    const specialSlogans = {
        '1245620': "A journey worth every moment",
        '1145360': "Forge your legend in a world of chaos",
        '1091500': "Lose yourself in a living world",
        '814380': "Sometimes, pain isn't that bad",
        '367520': "No mercy. No shortcuts. Just pain",
        '1332010': "Getting lost is part of the journey"
    };

    // General atmospheric sentences fallback
    const generalSlogans = [
        "Unleash Your Inner Legend",
        "Explore Worlds Beyond Imagination",
        "Master the Art of Combat",
        "Your Next Great Adventure Awaits",
        "Forge Your Path to Victory",
        "Discover the Masterpieces of Gaming",
        "Immerse Yourself in the Unknown",
        "Level Up Your Gaming Experience",
        "Where Reality Meets Fantasy",
        "Epic Journeys Start Here"
    ];

    // Take exactly up to 10 for carousel
    const carouselItems = items.slice(0, 10);

    carouselItems.forEach((game, index) => {
        const slide = document.createElement('div');
        slide.className = `hero-slide ${index === 0 ? 'active' : ''}`;

        // Priority: Special Slogan -> General Slogan
        const gameId = (game.externalId || game.id || "").toString();
        const slogan = specialSlogans[gameId] || generalSlogans[index % generalSlogans.length];

        slide.innerHTML = `
            <img src="${game.imageUrl}" class="hero-image" alt="${game.title}" onerror="this.src='https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.externalId || game.id}/header.jpg'">
            <div class="hero-overlay">
                <div class="hero-content">
                    <h1 class="text-3xl md:text-3xl mb-4 neon-glow-blue uppercase tracking-widest font-light">${slogan}</h1>
                </div>
            </div>
        `;
        carouselInner.appendChild(slide);
    });

    // Carousel Logic
    let currentSlide = 0;
    const slides = carouselInner.querySelectorAll('.hero-slide');

    const showSlide = (n) => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (n + slides.length) % slides.length;
        slides[currentSlide].classList.add('active');
    };


    // Auto Advance
    setInterval(() => showSlide(currentSlide + 1), 5000);
}

/**
 * Renders a horizontal scrollable category section
 */
function renderSection(section) {
    const container = document.getElementById('discovery-content');
    const sectionId = `section-${section.title.replace(/\s+/g, '-').toLowerCase()}`;

    const sectionEl = document.createElement('section');
    sectionEl.className = 'discovery-section';

    sectionEl.innerHTML = `
        <div class="section-header">
            <h2 class="section-title text-white uppercase tracking-widest">${section.title}</h2>
            <div class="flex gap-2">
                <button onclick="scrollLane('${sectionId}', -1)" class="w-10 h-10 rounded-full border border-white/10 hover:border-primary/50 flex items-center justify-center transition-all bg-white/5">
                    <span class="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button onclick="scrollLane('${sectionId}', 1)" class="w-10 h-10 rounded-full border border-white/10 hover:border-primary/50 flex items-center justify-center transition-all bg-white/5">
                    <span class="material-symbols-outlined text-sm">chevron_right</span>
                </button>
            </div>
        </div>
        <div id="${sectionId}" class="scroll-lane">
            ${section.games.map(game => createGameCard(game)).join('')}
        </div>
    `;

    container.appendChild(sectionEl);
}

/**
 * Creates HTML for a dynamic game card
 */
function createGameCard(game) {
    // Deterministic score color
    let scoreClass = 'score-mid';
    if (game.rating >= 80) scoreClass = 'score-high';
    else if (game.rating < 60) scoreClass = 'score-low';

    return `
        <div class="game-card group" onclick="navigateToGame('${game.externalId || game.id}')">
            <div class="card-image-wrapper">
                <img src="${game.imageUrl}" class="card-image" alt="${game.title}" loading="lazy">
                
                <!-- Status Pips (Top Right) -->
                <div class="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    ${game.isInLibrary ? `<div class="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center backdrop-blur-md" title="In Library">
                        <span class="material-symbols-outlined text-[14px] text-green-400 fill-icon">inventory_2</span>
                    </div>` : ''}
                    ${game.isInWishlist ? `<div class="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center backdrop-blur-md" title="In Wishlist">
                        <span class="material-symbols-outlined text-[14px] text-blue-400 fill-icon">bookmark</span>
                    </div>` : ''}
                </div>
            </div>
            
            <div class="card-content">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="game-title text-slate-100">${game.title}</h3>
                    ${game.rating ? `<span class="metacritic-score ${scoreClass} text-[10px]">${game.rating}</span>` : ''}
                </div>
                
                <div class="game-meta">
                    <span class="text-[10px] uppercase tracking-wider text-slate-500">Steam</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Navigation Helper
 */
function navigateToGame(id) {
    window.location.href = `../../GameDetails/Html/game-details.html?id=${id}`;
}

/**
 * Horizontal Scroll control
 */
function scrollLane(id, direction) {
    const lane = document.getElementById(id);
    if (!lane) return;

    const scrollAmount = 600;
    lane.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
}

/**
 * Simple User Info display for the sticky header
 */
function setupUserInfo() {
    const userName = localStorage.getItem('userName');
    const welcomeUsername = document.getElementById('welcome-username');
    const displayAvatar = document.getElementById('display-avatar-header');

    if (welcomeUsername && userName) {
        welcomeUsername.textContent = userName;
    }
    if (displayAvatar && userName) {
        displayAvatar.textContent = userName.charAt(0).toUpperCase();
    }
}

function renderEmptyState() {
    document.getElementById('discovery-content').innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-slate-500">
            <span class="material-symbols-outlined text-6xl mb-4">cloud_off</span>
            <p>Discovery system is offline. Please check back later.</p>
        </div>
    `;
}

function renderErrorState() {
    document.getElementById('discovery-content').innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-red-400">
            <span class="material-symbols-outlined text-6xl mb-4">error</span>
            <p>Could not connect to Steam Engine. Try refreshing.</p>
        </div>
    `;
}
