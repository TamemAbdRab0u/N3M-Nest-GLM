// State management
let allUserGames = []; 
let currentCarouselGames = [];
let currentIndex = 0;
let userProfile = null;
let isEditMode = false;
let selectedAvatarFile = null;
let currentCategory = 'favorite';

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
        bioText.textContent = profile.bio || "Exploring the digital horizons, one achievement at a time.";
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
    const bio = document.getElementById("profile-bio")?.textContent.trim();
    
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
        
        // Initial view is favorites
        switchCarouselView('favorite');
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
        hoursPlayed: Math.floor(Math.random() * 80) + 10 // Still mock hours as it's not in DB
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
    
    const ownedCount = allGames.length - wishlistedCount;

    const stats = {
        "stat-owned": ownedCount,
        "stat-favorite": favoriteCount,
        "stat-wishlisted": wishlistedCount,
        "stat-completed": completedCount,
        "stat-playing": playingCount,
        "stat-dropped": droppedCount,
        "stat-onhold": onHoldCount
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
    const counts = {};
    allGames.forEach(g => {
        if (g.genres) {
            g.genres.forEach(genre => {
                const name = typeof genre === 'string' ? genre : genre.name;
                if (name) counts[name] = (counts[name] || 0) + 1;
            });
        }
    });

    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 4);
    if (sorted.length > 0) {
        const top = document.getElementById("top-genre-label");
        if (top) top.textContent = sorted[0][0];

        sorted.forEach((genre, idx) => {
            const nameEl = document.getElementById(`genre-${idx+1}-name`);
            const statEl = document.getElementById(`genre-${idx+1}-stat`);
            if (nameEl && statEl) {
                nameEl.textContent = genre[0];
                statEl.textContent = `${genre[1]} Games`;
            }
        });
    }
}

function renderCarousel() {
    const wrapper = document.getElementById("carousel-wrapper");
    if (!wrapper) return;
    wrapper.innerHTML = "";
    
    if (currentCarouselGames.length === 0) {
        wrapper.innerHTML = `
            <div class="flex flex-col items-center justify-center p-10 text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl w-full">
                <span class="material-symbols-outlined text-4xl mb-4">sentiment_neutral</span>
                <p class="font-medium italic">Protocol Empty: No games found in this category.</p>
            </div>`;
        return;
    }

    const badgeLabels = {
        'favorite': 'MOST PLAYED',
        'owned': 'COLLECTION',
        'wishlist': 'WANTED',
        'completed': 'PROTOCOL CLEAR',
        'playing': 'ACTIVE',
        'dropped': 'ABANDONED',
        'onhold': 'PAUSED'
    };
    
    const badgeText = badgeLabels[currentCategory] || 'GAME';

    currentCarouselGames.forEach((game, index) => {
        const card = document.createElement("div");
        card.className = "carousel-card hidden"; 
        card.innerHTML = `
            <img src="${game.imageUrl}" alt="${game.title}" onerror="this.src='../../Assets/Images/Bg1.jpg'">
            <div class="card-overlay"></div>
            <div class="card-content">
                <p class="text-primary text-[9px] font-bold uppercase tracking-[0.2em] mb-2 xirod-font">${badgeText}</p>
                <h3 class="text-xl font-bold text-white leading-tight mb-2 tracking-tight">${game.title}</h3>
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-primary">schedule</span>
                    <span class="text-xs text-slate-300 font-medium">${game.hoursPlayed} Hours</span>
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
    if (!document.hidden && currentCarouselGames.length > 1 && !isEditMode) {
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
