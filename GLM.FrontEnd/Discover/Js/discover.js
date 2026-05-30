/**
 * Discover Page Logic - Neon Kinetic
 * Handles dynamic fetching and rendering of the Steam Discovery Homepage
 */

const CACHE_KEY_CONTENT  = 'discover:html:content';
const CACHE_KEY_CAROUSEL = 'discover:html:carousel';
const CACHE_KEY_SCROLL   = 'discover:scroll:top';
const CACHE_KEY_LANES    = 'discover:scroll:lanes'; // per-lane horizontal positions
const CACHE_TTL_MS       = 15 * 60 * 1000;          // 15 minutes — matches backend cache

document.addEventListener('DOMContentLoaded', async () => {
    setupUserInfo();

    const scrollView = document.getElementById('discover-view');

    // --- Try to restore from sessionStorage first ---
    const cachedAt = parseInt(sessionStorage.getItem('discover:cached_at') || '0', 10);
    const isFresh  = (Date.now() - cachedAt) < CACHE_TTL_MS;
    const cachedContent  = sessionStorage.getItem(CACHE_KEY_CONTENT);
    const cachedCarousel = sessionStorage.getItem(CACHE_KEY_CAROUSEL);

    if (isFresh && cachedContent && cachedCarousel) {
        // Restore saved HTML instantly — no API call needed
        document.getElementById('carousel-inner').innerHTML   = cachedCarousel;
        document.getElementById('discovery-content').innerHTML = cachedContent;

        // Restore page vertical scroll position
        const savedScroll = parseInt(sessionStorage.getItem(CACHE_KEY_SCROLL) || '0', 10);
        scrollView.scrollTop = savedScroll;

        // Restore each lane's horizontal scroll position
        try {
            const lanes = JSON.parse(sessionStorage.getItem(CACHE_KEY_LANES) || '{}');
            Object.entries(lanes).forEach(([id, left]) => {
                const lane = document.getElementById(id);
                if (lane) lane.scrollLeft = left;
            });
        } catch (_) {}

        // Re-attach carousel auto-advance (HTML is restored but JS timers are gone)
        restartCarousel();
        return;
    }

    // --- Fresh load: fetch from API ---
    await loadDiscoveryData();
});

/**
 * Fetches data from the /api/steam/store/home endpoint
 */
async function loadDiscoveryData() {
    const contentContainer = document.getElementById('discovery-content');
    const RAW_JSON_KEY = 'discover:raw_json';
    const RAW_JSON_TS  = 'discover:raw_json:cached_at';

    try {
        let data = null;

        // Check if dashboard pre-fetched this for us
        const rawJsonTs = parseInt(sessionStorage.getItem(RAW_JSON_TS) || '0', 10);
        const isRawFresh = (Date.now() - rawJsonTs) < CACHE_TTL_MS;
        const rawJson = sessionStorage.getItem(RAW_JSON_KEY);

        if (isRawFresh && rawJson) {
            console.log('Discover: Using pre-fetched raw JSON from sessionStorage');
            data = JSON.parse(rawJson);
        } else {
            const response = await apiRequest('/api/Steam/store/home');
            if (!response.ok) throw new Error('Failed to fetch discovery data');
            data = await response.json();
            
            // Save it for ourselves too
            sessionStorage.setItem(RAW_JSON_KEY, JSON.stringify(data));
            sessionStorage.setItem(RAW_JSON_TS, Date.now().toString());
        }

        if (!data || !data.sections || data.sections.length === 0) {
            renderEmptyState();
            return;
        }

        contentContainer.innerHTML = '';

        const featuredSection = data.sections.find(s => s.id === 'featured') || data.sections[0];
        if (featuredSection && featuredSection.games.length > 0) {
            renderHeroCarousel(featuredSection.games.slice(0, 10));
        }

        const remainingSections = data.sections.filter(s => s !== featuredSection);
        remainingSections.forEach(section => renderSection(section));

        // Save rendered HTML to sessionStorage for back-navigation restore
        sessionStorage.setItem(CACHE_KEY_CAROUSEL, document.getElementById('carousel-inner').innerHTML);
        sessionStorage.setItem(CACHE_KEY_CONTENT,  document.getElementById('discovery-content').innerHTML);
        sessionStorage.setItem('discover:cached_at', Date.now().toString());

    } catch (error) {
        console.error('Discovery Load Error:', error);
        renderErrorState();
    }
}

/**
 * Restarts the carousel auto-advance after restoring from cache
 */
function restartCarousel() {
    const slides = document.querySelectorAll('#carousel-inner .hero-slide');
    if (slides.length === 0) return;

    let currentSlide = 0;
    // Ensure first slide is active
    slides.forEach((s, i) => s.classList.toggle('active', i === 0));

    const showSlide = (n) => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (n + slides.length) % slides.length;
        slides[currentSlide].classList.add('active');
    };

    setInterval(() => showSlide(currentSlide + 1), 5000);
}

/**
 * Renders the Hero Carousel with high-impact game cards
 */
function renderHeroCarousel(items) {
    const carouselInner = document.getElementById('carousel-inner');
    if (!carouselInner || items.length === 0) return;

    carouselInner.innerHTML = '';

    const specialSlogans = {
        '1245620': "A journey worth every moment",
        '1145360': "Forge your legend in a world of chaos",
        '1091500': "Lose yourself in a living world",
        '814380':  "Sometimes, pain isn't that bad",
        '367520':  "No mercy. No shortcuts. Just pain",
        '1332010': "Getting lost is part of the journey"
    };

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

    const carouselItems = items.slice(0, 10);

    carouselItems.forEach((game, index) => {
        const slide = document.createElement('div');
        slide.className = `hero-slide ${index === 0 ? 'active' : ''}`;

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

    let currentSlide = 0;
    const slides = carouselInner.querySelectorAll('.hero-slide');

    const showSlide = (n) => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (n + slides.length) % slides.length;
        slides[currentSlide].classList.add('active');
    };

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
        </div>
        <div class="lane-wrapper">
            <button class="lane-arrow lane-arrow-left" onclick="scrollLane('${sectionId}', -1)" aria-label="Scroll left">
                <span class="material-symbols-outlined" style="font-size:22px">chevron_left</span>
            </button>
            <div id="${sectionId}" class="scroll-lane">
                ${section.games.map(game => createGameCard(game)).join('')}
            </div>
            <button class="lane-arrow lane-arrow-right" onclick="scrollLane('${sectionId}', 1)" aria-label="Scroll right">
                <span class="material-symbols-outlined" style="font-size:22px">chevron_right</span>
            </button>
        </div>
    `;

    container.appendChild(sectionEl);
}

/**
 * Creates HTML for a dynamic game card
 */
function createGameCard(game) {
    return `
        <div class="game-card group" onclick="navigateToGame('${game.externalId || game.id}')">
            <div class="card-image-wrapper">
                <img src="${game.imageUrl}" class="card-image" alt="${game.title}" loading="lazy">
            </div>
            <div class="card-content">
                <h3 class="game-title text-kinetic-blue truncate">${game.title}</h3>
            </div>
        </div>
    `;
}

/**
 * Navigation Helper — saves scroll state before leaving
 */
function navigateToGame(id) {
    // Save vertical scroll position of the main view
    const scrollView = document.getElementById('discover-view');
    if (scrollView) {
        sessionStorage.setItem(CACHE_KEY_SCROLL, scrollView.scrollTop.toString());
    }

    // Save each lane's horizontal scroll position
    const lanes = {};
    document.querySelectorAll('.scroll-lane[id]').forEach(lane => {
        lanes[lane.id] = lane.scrollLeft;
    });
    sessionStorage.setItem(CACHE_KEY_LANES, JSON.stringify(lanes));

    window.location.href = `../../GameDetails/Html/game-details.html?id=${id}`;
}

/**
 * Horizontal Scroll control
 */
function scrollLane(id, direction) {
    const lane = document.getElementById(id);
    if (!lane) return;

    lane.scrollBy({ left: direction * 600, behavior: 'smooth' });
}

/**
 * Simple User Info display for the sticky header
 */
async function setupUserInfo() {
    const userName = localStorage.getItem('userName');
    const welcomeUsername = document.getElementById('welcome-username');
    const displayAvatar   = document.getElementById('display-avatar-header');

    // Apply Xirod font to username
    if (welcomeUsername) {
        if (userName) welcomeUsername.textContent = userName;
        welcomeUsername.style.fontFamily = "'Xirod', sans-serif";
        welcomeUsername.style.letterSpacing = '0.08em';
    }

    // Show initial letters immediately as placeholder
    if (displayAvatar && userName) {
        displayAvatar.textContent = userName.substring(0, 2).toUpperCase();
    }

    // Fetch real avatar from API
    try {
        const response = await apiRequest('/api/Profile');
        if (!response.ok) return;
        const profile = await response.json();

        if (!displayAvatar) return;

        const name = profile.displayName || userName || 'User';
        const initials = name.substring(0, 2).toUpperCase();
        const imgSrc = profile.avatarUrl
            ? `${getUploadUrl(profile.avatarUrl)}?t=${Date.now()}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=080f0f&color=0df2f2&size=80`;

        displayAvatar.innerHTML = `<img src="${imgSrc}" class="h-full w-full object-cover" alt="Avatar"
            onerror="this.parentElement.textContent='${initials}'">` ;

        // Update username to display name from API
        if (welcomeUsername && profile.displayName) {
            welcomeUsername.textContent = profile.displayName;
        }
    } catch (_) {
        // Keep the initial letter — no problem
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
