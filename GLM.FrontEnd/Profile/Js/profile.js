// State management
let allUserGames = []; 
let currentCarouselGames = [];
let currentIndex = 0;
let userProfile = null;
let isEditMode = false;
let isHoveringCarousel = false;
let selectedAvatarFile = null;
let currentCategory = 'favorite';
let isGenreReportExpanded = false;
let allGenresData = [];

document.addEventListener("DOMContentLoaded", () => {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = "../../Auth/Html/login.html";
        return;
    }
    
    // Initial display from local storage for instant feedback
    displayUserInfo();
    
    // Fetch full data from API
    fetchProfile(); 
    loadInitialData(); // Renamed from loadFavorites
    
    // Initialize logic
    initializeEventListeners();
});

// Display information from local storage initially (Fast)
function displayUserInfo() {
    const userInfo = getUserInfo();
    const usernameElements = document.querySelectorAll("#display-username, #profile-username");
    const avatarImg = document.getElementById("profile-avatar-img");
    const displayAvatar = document.getElementById("display-avatar");
    
    usernameElements.forEach(el => {
        el.textContent = userInfo.userName || "User";
    });
    
    if (displayAvatar) {
        displayAvatar.textContent = userInfo.userName ? userInfo.userName.charAt(0).toUpperCase() : "U";
    }
    
    if (avatarImg) {
        // Fallback using UI Avatars if no image yet
        const name = userInfo.userName || "User";
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=080f0f&color=0df2f2&size=200`;
    }
}

function initializeEventListeners() {
    // Edit Button
    const editBtn = document.getElementById("edit-profile-btn");
    if (editBtn) {
        editBtn.addEventListener("click", toggleEditMode);
    }

    // Avatar Input Change
    const avatarInput = document.getElementById("avatar-input");
    if (avatarInput) {
        avatarInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                selectedAvatarFile = file;
                // Preview the image immediately
                const reader = new FileReader();
                reader.onload = (event) => {
                    const avatarImg = document.getElementById("profile-avatar-img");
                    if (avatarImg) avatarImg.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// Fetch Full Profile from API
async function fetchProfile() {
    try {
        const response = await apiRequest("/api/Profile");
        if (!response.ok) throw new Error("Failed to fetch profile");
        
        userProfile = await response.json();
        updateProfileUI(userProfile);
    } catch (error) {
        console.error("Error fetching profile:", error);
    }
}

function updateProfileUI(profile) {
    if (!profile) return;
    
    const usernameElements = document.querySelectorAll("#display-username, #profile-username");
    const displayAvatar = document.getElementById("display-avatar");
    const sidebarAvatar = document.getElementById("profile-sidebar-img"); // Added check for sidebar
    const bioText = document.getElementById("profile-bio");
    const avatarImg = document.getElementById("profile-avatar-img");

    const timestamp = new Date().getTime();

    // Update Display Name
    if (profile.displayName) {
        usernameElements.forEach(el => el.textContent = profile.displayName);
        
        // Update local storage too to keep it in sync
        const userInfo = getUserInfo();
        if (userInfo.userName !== profile.displayName) {
            userInfo.userName = profile.displayName;
            localStorage.setItem("userName", profile.displayName);
        }
    }

    // Sidebar Avatar / Initial
    if (displayAvatar) {
        if (profile.avatarUrl) {
            displayAvatar.innerHTML = `<img src="${API_URL}/Uploads/${profile.avatarUrl}?t=${timestamp}" class="h-full w-full object-cover rounded-full" onerror="this.parentElement.textContent='${(profile.displayName || "U").charAt(0).toUpperCase()}'">`;
            const parent = displayAvatar.parentElement;
            if (parent && parent.classList.contains("bg-gradient-to-tr")) {
                parent.classList.remove("bg-gradient-to-tr", "from-primary", "to-purple-500");
                parent.classList.add("bg-transparent");
            }
        } else if (profile.displayName) {
            displayAvatar.textContent = profile.displayName.charAt(0).toUpperCase();
        }
    }

    // Update Sidebar Image if exists separately
    if (sidebarAvatar && profile.avatarUrl) {
        sidebarAvatar.src = `${API_URL}/Uploads/${profile.avatarUrl}?t=${timestamp}`;
    }

    // Update Bio
    if (bioText) {
        const bioValue = profile.bio || "...";
        console.log("Setting bio UI to:", bioValue); // Debug log
        bioText.textContent = bioValue;
    }

    // Update Profile Header Avatar
    if (avatarImg) {
        if (profile.avatarUrl) {
            const timestamp = new Date().getTime();
            const newSrc = `${API_URL}/Uploads/${profile.avatarUrl}?t=${timestamp}`;
            
            // Set source
            avatarImg.src = newSrc;
            
            // Fallback for errors
            avatarImg.onerror = () => {
                avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || "User")}&background=080f0f&color=0df2f2&size=200`;
            };
        } else {
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || "User")}&background=080f0f&color=0df2f2&size=200`;
        }
    }
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    
    const editBtn = document.getElementById("edit-profile-btn");
    const btnText = document.getElementById("edit-btn-text");
    const btnIcon = document.getElementById("edit-btn-icon");
    
    const nameDisplay = document.getElementById("profile-username");
    const bioDisplay = document.getElementById("profile-bio");
    const avatarOverlay = document.getElementById("avatar-edit-icon");
    const nameEditIcon = document.getElementById("name-edit-icon");
    const bioEditIcon = document.getElementById("bio-edit-icon");

    if (isEditMode) {
        // Enter Edit Mode
        if (btnText) btnText.textContent = "SAVE";
        if (btnIcon) btnIcon.textContent = "done_all";
        editBtn.classList.add("bg-green-500/20", "border-green-500/40", "text-green-500");
        editBtn.classList.remove("bg-primary/20", "border-primary/40", "text-primary");

        // Enable editing
        if (nameDisplay) {
            nameDisplay.contentEditable = "true";
            nameDisplay.classList.add("editing-active");
        }
        if (bioDisplay) {
            bioDisplay.contentEditable = "true";
            bioDisplay.classList.add("editing-active");
        }
        
        // Show edit indicators
        if (avatarOverlay) {
            avatarOverlay.classList.remove("hidden");
            avatarOverlay.classList.add("flex");
        }
        if (nameEditIcon) nameEditIcon.classList.remove("hidden");
        if (bioEditIcon) bioEditIcon.classList.remove("hidden");

        // Focus name
        if (nameDisplay) nameDisplay.focus();
    } else {
        // Save and Exit Edit Mode
        saveProfileChanges();
        
        if (btnText) btnText.textContent = "EDIT";
        if (btnIcon) btnIcon.textContent = "edit";
        editBtn.classList.remove("bg-green-500/20", "border-green-500/40", "text-green-500");
        editBtn.classList.add("bg-primary/20", "border-primary/40", "text-primary");

        if (nameDisplay) {
            nameDisplay.contentEditable = "false";
            nameDisplay.classList.remove("editing-active");
        }
        if (bioDisplay) {
            bioDisplay.contentEditable = "false";
            bioDisplay.classList.remove("editing-active");
        }

        if (avatarOverlay) {
            avatarOverlay.classList.add("hidden");
            avatarOverlay.classList.remove("flex");
        }
        if (nameEditIcon) nameEditIcon.classList.add("hidden");
        if (bioEditIcon) bioEditIcon.classList.add("hidden");
    }
}

async function saveProfileChanges() {
    const name = document.getElementById("profile-username")?.textContent.trim();
    const bioElement = document.getElementById("profile-bio");
    let bio = bioElement?.textContent.trim() || "";
    
    // If bio is completely empty, set it to "..." explicitly
    if (bio === "" || bio === "...") {
        bio = "...";
    }
    
    console.log("Saving profile with bio:", bio); // Debug log
    
    const formData = new FormData();
    formData.append("DisplayName", name);
    formData.append("Bio", bio);
    if (selectedAvatarFile) {
        formData.append("Avatar", selectedAvatarFile);
    }

    try {
        const response = await fetch(`${API_URL}/api/Profile`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${getAuthToken()}`
            },
            body: formData
        });

        if (!response.ok) throw new Error("Update failed");
        
        const updatedProfile = await response.json();
        
        console.log("Profile updated, received bio:", updatedProfile.bio); // Debug log
        
        // Update userProfile state with new data
        userProfile = updatedProfile;
        
        // Clear the selected file so it doesn't get re-uploaded
        selectedAvatarFile = null;
        const avatarInput = document.getElementById("avatar-input");
        if (avatarInput) avatarInput.value = ""; 

        // Important: Update global storage to match new state
        const userInfo = getUserInfo();
        if (updatedProfile.avatarUrl) {
            localStorage.setItem("userAvatar", updatedProfile.avatarUrl);
        }

        updateProfileUI(updatedProfile);
        
        console.log("Profile updated successfully");
    } catch (error) {
        console.error("Error saving profile:", error);
        fetchProfile();
    }
}

// Favorites and Catalog Logic
async function loadInitialData() {
    const carouselWrapper = document.getElementById("carousel-wrapper");
    if (!carouselWrapper) return;

    try {
        const response = await apiRequest("/api/UserGames/GetAllUserGames");
        if (!response.ok) throw new Error("Failed to load games");
        
        allUserGames = await response.json();
        updateLibraryStats(allUserGames);
        
        // Initial view is owned games
        switchCarouselView('owned');
    } catch (error) {
        console.error("Error loading initial data:", error);
    }
}

function switchCarouselView(category) {
    currentCategory = category;
    const titleEl = document.getElementById('carousel-title');
    
    // Update Heading
    const labels = {
        'favorite': 'a Quick Look To Your Favorite Games',
        'owned': 'All Owned Games In Your Collection',
        'wishlist': 'Games On Your Current Wishlist',
        'completed': 'Your Fully Completed Adventures',
        'playing': 'What You Are Currently Playing',
        'dropped': 'Games You Have Dropped',
        'onhold': 'Games Currently On Hold'
    };
    
    if (titleEl) {
        titleEl.textContent = labels[category] || 'Your Game Library';
        // Add a small animation effect
        titleEl.classList.add('animate-pulse');
        setTimeout(() => titleEl.classList.remove('animate-pulse'), 500);
    }

    // Active State Logic
    document.querySelectorAll('.stat-box').forEach(el => el.classList.remove('stat-active'));
    
    let activeBoxId = '';
    if (category === 'favorite') activeBoxId = 'stat-box-favorite';
    else if (category === 'owned') activeBoxId = 'stat-box-owned';
    else if (category === 'wishlist') activeBoxId = 'stat-box-wishlist';
    else activeBoxId = 'stat-box-completed';
    
    const activeBox = document.getElementById(activeBoxId);
    if (activeBox) activeBox.classList.add('stat-active');
    
    // Filter Games
    let filtered = [];
    switch(category) {
        case 'favorite':
            filtered = allUserGames.filter(ug => ug.isFavorite);
            break;
        case 'owned':
            // Owned = All EXCEPT wishlist
            filtered = allUserGames.filter(ug => ug.gamestatus !== "whishlist" && ug.gamestatus !== 2 && ug.gamestatus !== "Wishlist");
            break;
        case 'wishlist':
            filtered = allUserGames.filter(ug => ug.gamestatus === "whishlist" || ug.gamestatus === 2 || ug.gamestatus === "Wishlist");
            break;
        case 'completed':
            filtered = allUserGames.filter(ug => ug.gamestatus === "completed" || ug.gamestatus === 3 || ug.gamestatus === "Completed");
            break;
        case 'playing':
            filtered = allUserGames.filter(ug => ug.gamestatus === "playing" || ug.gamestatus === 1 || ug.gamestatus === "Playing");
            break;
        case 'dropped':
            filtered = allUserGames.filter(ug => ug.gamestatus === 'Dropped' || ug.gamestatus === 4);
            break;
        case 'onhold':
             filtered = allUserGames.filter(ug => ug.gamestatus === 'OnHold' || ug.gamestatus === 5 || ug.gamestatus === 'On Hold');
            break;
        default:
            filtered = allUserGames;
    }

    currentCarouselGames = filtered.map(ug => ({
        id: ug.externalId,
        title: ug.gameTitle,
        imageUrl: ug.gameImageUrl || "../../Assets/Images/Bg1.jpg", 
        hoursPlayed: Math.floor(Math.random() * 80) + 10, // Still mock hours as it's not in DB
        gamestatus: ug.gamestatus // Include the game status from the user game
    }));

    currentIndex = 0;
    renderCarousel();
}

function updateLibraryStats(allGames) {
    if (!allGames) return;

    const favoriteCount = allGames.filter(g => g.isFavorite).length;
    const wishlistedCount = allGames.filter(g => g.gamestatus === "whishlist" || g.gamestatus === 2 || g.gamestatus === "Wishlist").length;
    const completedCount = allGames.filter(g => g.gamestatus === "completed" || g.gamestatus === 3 || g.gamestatus === "Completed").length;
    const playingCount = allGames.filter(g => g.gamestatus === "playing" || g.gamestatus === 1 || g.gamestatus === "Playing").length;
    const droppedCount = allGames.filter(g => g.gamestatus === "Dropped" || g.gamestatus === 4).length;
    const onHoldCount = allGames.filter(g => g.gamestatus === "OnHold" || g.gamestatus === 5 || g.gamestatus === "On Hold").length;
    const pendingCount = allGames.filter(g => g.gamestatus === "Pending" || g.gamestatus === 6).length;
    
    const ownedCount = allGames.length - wishlistedCount;

    const stats = {
        "stat-owned": ownedCount,
        "stat-favorite": favoriteCount,
        "stat-wishlisted": wishlistedCount,
        "stat-completed": completedCount,
        "stat-playing": playingCount,
        "stat-dropped": droppedCount,
        "stat-onhold": onHoldCount,
        "stat-pending": pendingCount
    };
    
    for (const [id, value] of Object.entries(stats)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toLocaleString();
    }

    const snapTotalGames = document.getElementById("snapshot-total-games");
    if (snapTotalGames) snapTotalGames.textContent = ownedCount.toLocaleString();

    calculateGenres(allGames);
}

function calculateGenres(allGames) {
    // Filter to only include owned games (exclude wishlist)
    const ownedGames = allGames.filter(g => 
        g.gamestatus !== "whishlist" && 
        g.gamestatus !== 2 && 
        g.gamestatus !== "Wishlist"
    );
    
    const counts = {};
    ownedGames.forEach(g => {
        if (g.genres) {
            g.genres.forEach(genre => {
                const name = typeof genre === 'string' ? genre : genre.name;
                if (name) counts[name] = (counts[name] || 0) + 1;
            });
        }
    });

    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    allGenresData = sorted; // Store all genres
    
    const topFour = sorted.slice(0, 4);
    if (topFour.length > 0) {
        const top = document.getElementById("top-genre-label");
        if (top) top.textContent = topFour[0][0];

        topFour.forEach((genre, idx) => {
            const nameEl = document.getElementById(`genre-${idx+1}-name`);
            const statEl = document.getElementById(`genre-${idx+1}-stat`);
            const parentEl = nameEl?.closest('.flex.items-center.gap-3');
            
            if (nameEl && statEl) {
                nameEl.textContent = genre[0];
                statEl.textContent = `${genre[1]} Games`;
                
                // Make genre item clickable
                if (parentEl) {
                    parentEl.classList.add('cursor-pointer', 'group/genre', 'hover:scale-105', 'transition-transform');
                    parentEl.onclick = () => navigateToLibraryWithGenre(genre[0]);
                    
                    // Add hover effect to genre name
                    nameEl.classList.add('group-hover/genre:text-primary', 'transition-colors');
                }
            }
        });
    }
}

function toggleGenreReport() {
    isGenreReportExpanded = !isGenreReportExpanded;
    const container = document.getElementById("genre-breakdown-container");
    const expandedView = document.getElementById("genre-expanded-view");
    const reportText = document.getElementById("genre-report-text");
    const reportIcon = document.getElementById("genre-report-icon");
    
    if (isGenreReportExpanded) {
        // Expand with smooth transition
        expandedView.style.maxHeight = "0px";
        expandedView.style.opacity = "0";
        expandedView.classList.remove("hidden");
        
        // Force reflow
        expandedView.offsetHeight;
        
        setTimeout(() => {
            expandedView.style.maxHeight = "600px";
            expandedView.style.opacity = "1";
        }, 10);
        
        reportText.textContent = "CLOSE REPORT";
        reportIcon.textContent = "expand_less";
        
        // Populate all genres after a brief delay
        setTimeout(() => {
            populateAllGenres();
        }, 150);
    } else {
        // Collapse with smooth transition
        expandedView.style.maxHeight = "0px";
        expandedView.style.opacity = "0";
        
        setTimeout(() => {
            expandedView.classList.add("hidden");
            expandedView.style.maxHeight = "";
            expandedView.style.opacity = "";
        }, 500);
        
        reportText.textContent = "VIEW FULL REPORT";
        reportIcon.textContent = "arrow_forward";
    }
}

function populateAllGenres() {
    const container = document.getElementById("all-genres-list");
    if (!container || allGenresData.length === 0) return;
    
    container.innerHTML = "";
    
    const colors = [
        "#0df2f2", "#067d7d", "#06b6d4", "#0891b2", 
        "#0e7490", "#155e75", "#164e63", "#334155",
        "#475569", "#64748b", "#94a3b8", "#cbd5e1"
    ];
    
    allGenresData.forEach((genre, idx) => {
        const [name, count] = genre;
        const color = colors[idx % colors.length];
        
        const item = document.createElement("div");
        item.className = "flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-all animate-slide-in cursor-pointer group";
        item.style.animationDelay = `${idx * 30}ms`;
        item.onclick = () => navigateToLibraryWithGenre(name);
        item.innerHTML = `
            <div class="size-2.5 rounded-sm flex-shrink-0 group-hover:scale-125 transition-transform" style="background-color: ${color}; box-shadow: 0 0 8px ${color}40;"></div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-slate-200 leading-tight truncate group-hover:text-primary transition-colors">${name}</p>
                <p class="text-[10px] text-slate-500">${count} ${count === 1 ? 'Game' : 'Games'}</p>
            </div>
            <span class="material-symbols-outlined text-[14px] text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all">arrow_forward</span>
        `;
        container.appendChild(item);
    });
}

function navigateToLibraryWithGenre(genreName) {
    // Navigate to dashboard library view with genre filter
    window.location.href = `../../Dashboard/Html/dashboard.html?view=library&genre=${encodeURIComponent(genreName)}`;
}

function renderCarousel() {
    const wrapper = document.getElementById("carousel-wrapper");
    if (!wrapper) return;
    wrapper.innerHTML = "";

    // Add mouse event listeners to pause auto-rotation
    if (!wrapper.dataset.listenersInitialized) {
        wrapper.addEventListener("mouseenter", () => { isHoveringCarousel = true; });
        wrapper.addEventListener("mouseleave", () => { isHoveringCarousel = false; });
        wrapper.dataset.listenersInitialized = "true";
    }
    
    if (currentCarouselGames.length === 0) {
        wrapper.innerHTML = `
            <div class="flex flex-col items-center justify-center p-10 text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl w-full">
                <span class="material-symbols-outlined text-4xl mb-4">sentiment_neutral</span>
                <p class="font-medium italic">Protocol Empty: No games found in this category.</p>
            </div>`;
        return;
    }

    const categoryThemes = {
        'favorite': { 
            badge: 'MOST PLAYED', 
            color: 'text-yellow-400', 
            glow: 'shadow-[0_0_20px_rgba(250,204,21,0.3)]',
            icon: 'star'
        },
        'owned': { 
            badge: 'COLLECTION', 
            color: 'text-primary', 
            glow: 'shadow-[0_0_20px_rgba(13,242,242,0.3)]',
            icon: 'grid_view'
        },
        'wishlist': { 
            badge: 'WANTED', 
            color: 'text-purple-400', 
            glow: 'shadow-[0_0_20px_rgba(192,132,252,0.3)]',
            icon: 'bookmark'
        },
        'completed': { 
            badge: 'PROTOCOL CLEAR', 
            color: 'text-emerald-400', 
            glow: 'shadow-[0_0_20px_rgba(52,211,153,0.3)]',
            icon: 'verified'
        },
        'playing': { 
            badge: 'ACTIVE', 
            color: 'text-blue-400', 
            glow: 'shadow-[0_0_20px_rgba(96,165,250,0.3)]',
            icon: 'play_circle'
        },
        'dropped': { 
            badge: 'ABANDONED', 
            color: 'text-rose-400', 
            glow: 'shadow-[0_0_20px_rgba(251,113,133,0.3)]',
            icon: 'cancel'
        },
        'onhold': { 
            badge: 'PAUSED', 
            color: 'text-orange-400', 
            glow: 'shadow-[0_0_20px_rgba(251,146,60,0.3)]',
            icon: 'pause_circle'
        }
    };
    
    const theme = categoryThemes[currentCategory] || categoryThemes['owned'];

    currentCarouselGames.forEach((game, index) => {
        const card = document.createElement("div");
        card.className = `carousel-card hidden transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.15] hover:-translate-y-4 hover:brightness-125 ${theme.glow}`; 
        
        let status = game.gamestatus || game.gameStatus || "Library";
        const statusMap = {
            'playing': 'playing',
            'whishlist': 'wishlisted',
            'completed': 'completed',
            'Dropped': 'dropped',
            'OnHold': 'on hold',
            'Pending': 'pending'
        };
        
        const displayStatus = statusMap[status] || status;

        const iconMap = {
            'playing': 'play_circle',
            'whishlist': 'bookmark',
            'completed': 'verified',
            'Dropped': 'cancel',
            'OnHold': 'pause_circle',
            'Pending': 'schedule'
        };
        const statusIcon = iconMap[status] || 'analytics';
        
        card.innerHTML = `
            <img src="${game.imageUrl}" alt="${game.title}" onerror="this.src='../../Assets/Images/Bg1.jpg'">
            <div class="card-overlay"></div>
            <div class="card-content">
                <div class="flex items-center gap-2 mb-2">
                    <span class="material-symbols-outlined text-[14px] ${theme.color}">${theme.icon}</span>
                    <p class="${theme.color} text-[10px] font-bold uppercase tracking-[0.2em] xirod-font">${theme.badge}</p>
                </div>
                <h3 class="text-2xl font-bold text-white leading-tight mb-3 tracking-tight drop-shadow-lg">${game.title}</h3>
                <div class="flex items-center justify-between mt-auto">
                    <div class="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                        <span class="material-symbols-outlined text-[18px] ${theme.color}">${statusIcon}</span>
                        <span class="text-[10px] text-white font-bold uppercase xirod-font">${displayStatus}</span>
                    </div>
                </div>
            </div>`;
        
        card.onclick = () => {
            const offset = (index - currentIndex + currentCarouselGames.length) % currentCarouselGames.length;
            if (offset === 1 ) moveCarousel(1);
            else if (offset === currentCarouselGames.length - 1) moveCarousel(-1);
        };
        wrapper.appendChild(card);
    });
    updateCarousel();
}

function updateCarousel() {
    const cards = document.querySelectorAll(".carousel-card");
    if (cards.length === 0) return;

    cards.forEach((card, index) => {
        card.classList.remove("active", "left", "right", "hidden");
        const offset = (index - currentIndex + currentCarouselGames.length) % currentCarouselGames.length;
        if (offset === 0) card.classList.add("active");
        else if (offset === 1) card.classList.add("right");
        else if (offset === currentCarouselGames.length - 1) card.classList.add("left");
        else card.classList.add("hidden");
    });
}

function moveCarousel(direction) {
    if (currentCarouselGames.length <= 1) return;
    currentIndex = (currentIndex + direction + currentCarouselGames.length) % currentCarouselGames.length;
    updateCarousel();
}

// Auto rotate
setInterval(() => {
    if (!document.hidden && currentCarouselGames.length > 1 && !isEditMode && !isHoveringCarousel) {
        moveCarousel(1);
    }
}, 5000);

function toggleOtherStats() {
    const popup = document.getElementById("other-stats-popup");
    if (popup) popup.classList.toggle("hidden");
}

async function loadRecentActivity() {
    const list = document.getElementById("recent-activity-list");
    if (!list || allUserGames.length === 0) return;
    
    list.innerHTML = "";
    allUserGames.slice(0, 4).forEach(game => {
        const gameImg = game.gameImageUrl || "../../Assets/Images/Bg1.jpg";
        const item = document.createElement("div");
        item.className = "glass-panel p-3 rounded-xl flex gap-4 hover:bg-primary/5 transition-all cursor-pointer glow-border";
        item.innerHTML = `
            <div class="size-16 rounded-lg bg-slate-800 overflow-hidden">
                <img src="${gameImg}" class="w-full h-full object-cover" onerror="this.src='../../Assets/Images/Bg1.jpg'">
            </div>
            <div class="flex-1 py-1">
                <p class="text-sm font-bold text-white mb-1 uppercase">${game.gameTitle}</p>
                <p class="text-[10px] text-slate-500 xirod-font uppercase">STATUS: ${game.gamestatus || "LIBRARY"}</p>
            </div>`;
        list.appendChild(item);
    });
}

function navigateToDashboard(view = "catalog") {
    window.location.href = `../../Dashboard/Html/dashboard.html?view=${view}`;
}

function logout() {
    clearAuthData();
    window.location.href = "../../Auth/Html/login.html";
}
