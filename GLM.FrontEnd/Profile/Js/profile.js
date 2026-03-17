// State management
let allUserGames = [];
let currentCarouselGames = [];
let currentIndex = 0;
let userProfile = null;
let isEditMode = false;
let isHoveringCarousel = false;
let selectedAvatarFile = null;
let selectedBannerFile = null;
let currentCategory = 'favorite';
let isGenreReportExpanded = false;
let allGenresData = [];
let friendshipState = null; // { status, isSentByMe, friendshipId, friendsCount }
const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const playtimeCache = new Map(); // externalId -> playtime hours
let snapshotRequestToken = 0;
const RECT_TRANSPARENCY_STORAGE_KEY = 'glmRectFullTransparent';

// Visitor mode — set when viewing another user's profile via ?user=<username>
const _urlParams = new URLSearchParams(window.location.search);
const _visitedUser = _urlParams.get('user');
const isVisitorMode = !!_visitedUser && _visitedUser.toLowerCase() !== (getUserInfo()?.userName ?? '').toLowerCase();

document.addEventListener("DOMContentLoaded", () => {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = "../../Auth/Html/login.html";
        return;
    }

    if (isVisitorMode) {
        // Visiting another user's profile — hide all edit controls
        applyVisitorMode();
        fetchPublicProfile(_visitedUser);
        loadPublicGames(_visitedUser);
        loadFriendshipStatus(_visitedUser);
    } else {
        // Own profile
        displayUserInfo();
        fetchProfile();
        loadInitialData();
        initializeEventListeners();
        loadOwnFriendship();
    }
});

// Display information from local storage initially (Fast)
function displayUserInfo() {
    const userInfo = getUserInfo();
    const usernameElements = document.querySelectorAll("#display-username, #profile-username, #welcome-username");
    const avatarImg = document.getElementById("profile-avatar-img");
    const displayAvatar = document.querySelectorAll("#display-avatar, #display-avatar-header");

    usernameElements.forEach(el => {
        el.textContent = userInfo.userName || "User";
    });

    displayAvatar.forEach(el => {
        const initial = userInfo.userName ? userInfo.userName.charAt(0).toUpperCase() : "U";
        el.innerHTML = `<span class="text-sm font-bold text-white uppercase">${initial}</span>`;
    });

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
                if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
                    showToast('Avatar image has 5MB limit.', 'error');
                    selectedAvatarFile = null;
                    avatarInput.value = "";
                    return;
                }

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

    // Banner Input Change (frontend-only preview)
    const bannerInput = document.getElementById("banner-input");
    if (bannerInput) {
        bannerInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
                showToast('Banner image has 5MB limit.', 'error');
                selectedBannerFile = null;
                bannerInput.value = "";
                return;
            }

            selectedBannerFile = file;

            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                if (typeof dataUrl !== 'string') return;

                setProfileBannerImage(dataUrl);
            };
            reader.readAsDataURL(file);
        });
    }

    const rectTransparencyToggle = document.getElementById('rect-transparency-toggle');
    if (rectTransparencyToggle) {
        const localFallback = localStorage.getItem(RECT_TRANSPARENCY_STORAGE_KEY) === '1';
        rectTransparencyToggle.checked = localFallback;
        applyRectTransparency(localFallback);

        rectTransparencyToggle.addEventListener('change', () => {
            const isOn = rectTransparencyToggle.checked;
            applyRectTransparency(isOn);
            localStorage.setItem(RECT_TRANSPARENCY_STORAGE_KEY, isOn ? '1' : '0');
        });
    }
}

function applyRectTransparency(enabled) {
    const heroShell = document.querySelector('.profile-hero-shell');
    if (!heroShell) return;

    heroShell.classList.toggle('fully-transparent', !!enabled);
}

function setProfileBannerImage(imageUrl) {
    const heroStage = document.querySelector('.profile-header-stage');
    if (!heroStage || !imageUrl) return;

    const safeUrl = imageUrl.replace(/"/g, '\\"');
    heroStage.style.setProperty('--profile-banner-url', `url("${safeUrl}")`);
}

// Hide all edit controls when in visitor mode
function applyVisitorMode() {
    // Populate the logged-in user's info into the topbar (and sidebar if present)
    const userInfo = getUserInfo();
    const initial = userInfo.userName ? userInfo.userName.charAt(0).toUpperCase() : 'U';

    // Old sidebar IDs (kept for backwards compat if sidebar ever reappears)
    const sidebarUsername = document.getElementById('display-username');
    if (sidebarUsername) sidebarUsername.textContent = userInfo.userName || 'User';
    const displayAvatar = document.getElementById('display-avatar');
    if (displayAvatar) displayAvatar.textContent = initial;

    // New topbar IDs
    const welcomeUsername = document.getElementById('welcome-username');
    if (welcomeUsername) welcomeUsername.textContent = userInfo.userName || 'User';
    const headerAvatar = document.getElementById('display-avatar-header');
    if (headerAvatar) headerAvatar.innerHTML = `<span class="text-sm font-bold text-white uppercase">${initial}</span>`;

    // Then fetch the real avatar for the topbar
    fetchOwnSidebarAvatar();

    // Hide edit button
    const editBtn = document.getElementById('edit-profile-btn');
    if (editBtn) editBtn.style.display = 'none';

    // Hide bell/notification button
    const notifBtn = document.getElementById('notification-btn');
    if (notifBtn) notifBtn.style.display = 'none';

    // Show add-friend button (will be styled by loadFriendshipStatus)
    const addFriendBtn = document.getElementById('add-friend-btn');
    if (addFriendBtn) addFriendBtn.classList.remove('hidden');

    // Hide avatar upload overlay
    const avatarOverlay = document.getElementById('avatar-edit-icon');
    if (avatarOverlay) avatarOverlay.classList.add('hidden');
    const avatarInput = document.getElementById('avatar-input');
    if (avatarInput) avatarInput.remove();
    const profileEditControls = document.getElementById('profile-edit-controls');
    if (profileEditControls) {
        profileEditControls.classList.remove('is-visible');
        profileEditControls.classList.add('hidden');
        profileEditControls.setAttribute('aria-hidden', 'true');
    }
    const bannerInput = document.getElementById('banner-input');
    if (bannerInput) bannerInput.remove();

    // Hide name/bio inline edit icons
    const nameEditIcon = document.getElementById('name-edit-icon');
    if (nameEditIcon) nameEditIcon.classList.add('hidden');
    const bioEditIcon = document.getElementById('bio-edit-icon');
    if (bioEditIcon) bioEditIcon.classList.add('hidden');

    // Ensure fields are not editable
    const nameDisplay = document.getElementById('profile-username');
    if (nameDisplay) nameDisplay.contentEditable = 'false';
    const bioDisplay = document.getElementById('profile-bio');
    if (bioDisplay) bioDisplay.contentEditable = 'false';

    // Update page title
    document.title = `${_visitedUser}'s Profile - N3M|Nest`;
}

// Fetch logged-in user's own avatar to display in the topbar while visiting another profile
async function fetchOwnSidebarAvatar() {
    try {
        const response = await apiRequest('/api/Profile');
        if (!response.ok) return;
        const profile = await response.json();
        if (!profile.avatarUrl) return;

        const timestamp = new Date().getTime();
        const imgHtml = `<img src="${API_URL}/Uploads/${profile.avatarUrl}?t=${timestamp}" class="h-full w-full object-cover">`;

        // Update old sidebar avatar if present
        const displayAvatar = document.getElementById('display-avatar');
        if (displayAvatar) {
            displayAvatar.innerHTML = imgHtml;
            const parent = displayAvatar.parentElement;
            if (parent && parent.classList.contains('bg-gradient-to-tr')) {
                parent.classList.remove('bg-gradient-to-tr', 'from-primary', 'to-purple-500');
                parent.classList.add('bg-transparent');
            }
        }

        // Update new topbar avatar
        const headerAvatar = document.getElementById('display-avatar-header');
        if (headerAvatar) {
            headerAvatar.innerHTML = imgHtml;
            const headerParent = headerAvatar.parentElement;
            if (headerParent && headerParent.classList.contains('bg-gradient-to-tr')) {
                headerParent.classList.remove('bg-gradient-to-tr', 'from-primary', 'to-purple-600');
                headerParent.classList.add('bg-transparent');
            }
        }
    } catch (e) {
        // Topbar just stays as the initial letter — no problem
    }
}

// Fetch public profile of another user
async function fetchPublicProfile(username) {
    try {
        const response = await apiRequest(`/api/Profile/${encodeURIComponent(username)}`);
        if (!response.ok) throw new Error('Profile not found');
        const profile = await response.json();

        // Only update profile-specific elements — don't touch the sidebar (#display-username)
        const nameEl = document.getElementById('profile-username');
        if (nameEl) nameEl.textContent = profile.displayName || username;

        const bioEl = document.getElementById('profile-bio');
        if (bioEl) bioEl.textContent = profile.bio || '...';

        const avatarImg = document.getElementById('profile-avatar-img');
        const timestamp = new Date().getTime();
        if (avatarImg) {
            avatarImg.src = profile.avatarUrl
                ? `${API_URL}/Uploads/${profile.avatarUrl}?t=${timestamp}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || username)}&background=080f0f&color=0df2f2&size=200`;
        }

        if (profile.coverUrl) {
            setProfileBannerImage(`${API_URL}/Uploads/${profile.coverUrl}?t=${timestamp}`);
        }

        const isRectTransparent = !!profile.isRectTransparent;
        applyRectTransparency(isRectTransparent);

        const rectTransparencyToggle = document.getElementById('rect-transparency-toggle');
        if (rectTransparencyToggle) {
            rectTransparencyToggle.checked = isRectTransparent;
        }

        localStorage.setItem(RECT_TRANSPARENCY_STORAGE_KEY, isRectTransparent ? '1' : '0');
    } catch (error) {
        console.error('Error fetching public profile:', error);
    }
}

// Load public games for another user's profile page
async function loadPublicGames(username) {
    const carouselWrapper = document.getElementById('carousel-wrapper');
    if (!carouselWrapper) return;

    try {
        const response = await apiRequest(`/api/UserGames/GetPublicGames/${encodeURIComponent(username)}`);
        if (!response.ok) throw new Error('Failed to load games');

        allUserGames = await response.json();
        updateLibraryStats(allUserGames);
        loadRecentActivity();
        loadRecentFavorites();
        loadRecentWishlist();
        switchCarouselView('owned');
    } catch (error) {
        console.error('Error loading public games:', error);
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

    const usernameElements = document.querySelectorAll("#display-username, #profile-username, #welcome-username");
    const displayAvatars = document.querySelectorAll("#display-avatar, #display-avatar-header");
    const sidebarAvatar = document.getElementById("profile-sidebar-img"); // Added check for sidebar
    const bioText = document.getElementById("profile-bio");
    const avatarImg = document.getElementById("profile-avatar-img");

    const timestamp = new Date().getTime();

    // Update Display Name
    if (profile.displayName) {
        usernameElements.forEach(el => el.textContent = profile.displayName);
    }

    // Sidebar Avatar / Initial
    const resolvedAvatar = profile.avatarUrl;
    displayAvatars.forEach(displayAvatar => {
        if (displayAvatar) {
            if (resolvedAvatar) {
                displayAvatar.innerHTML = `<img src="${API_URL}/Uploads/${resolvedAvatar}?t=${timestamp}" class="h-full w-full object-cover" onerror="this.parentElement.textContent='${(profile.displayName || "U").charAt(0).toUpperCase()}'">`;
                const parent = displayAvatar.parentElement;
                if (parent && (parent.classList.contains("bg-gradient-to-tr") || parent.classList.contains("from-primary"))) {
                    parent.classList.remove("bg-gradient-to-tr", "from-primary", "to-purple-500", "to-purple-600");
                    parent.classList.add("bg-transparent");
                }
            } else if (profile.displayName) {
                const initial = profile.displayName.charAt(0).toUpperCase();
                displayAvatar.innerHTML = `<span class="text-sm font-bold text-white uppercase">${initial}</span>`;
            }
        }
    });

    // Update Sidebar Image if exists separately
    if (sidebarAvatar && resolvedAvatar) {
        sidebarAvatar.src = `${API_URL}/Uploads/${resolvedAvatar}?t=${timestamp}`;
    }

    // Update Bio
    if (bioText) {
        const bioValue = profile.bio || "...";
        console.log("Setting bio UI to:", bioValue); // Debug log
        bioText.textContent = bioValue;
    }

    // Update Profile Header Avatar
    if (avatarImg) {
        if (resolvedAvatar) {
            const newSrc = `${API_URL}/Uploads/${resolvedAvatar}?t=${timestamp}`;

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

    if (profile.coverUrl) {
        setProfileBannerImage(`${API_URL}/Uploads/${profile.coverUrl}?t=${timestamp}`);
    }

    const isRectTransparent = !!profile.isRectTransparent;
    applyRectTransparency(isRectTransparent);

    const rectTransparencyToggle = document.getElementById('rect-transparency-toggle');
    if (rectTransparencyToggle) {
        rectTransparencyToggle.checked = isRectTransparent;
    }

    localStorage.setItem(RECT_TRANSPARENCY_STORAGE_KEY, isRectTransparent ? '1' : '0');
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
    const profileEditControls = document.getElementById("profile-edit-controls");

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
        if (profileEditControls) {
            profileEditControls.classList.add("is-visible");
            profileEditControls.setAttribute('aria-hidden', 'false');
        }

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
        if (profileEditControls) {
            profileEditControls.classList.remove("is-visible");
            profileEditControls.setAttribute('aria-hidden', 'true');
        }
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
        formData.append("AvatarUrl", selectedAvatarFile);
    }
    if (selectedBannerFile) {
        formData.append("CoverUrl", selectedBannerFile);
    }

    const rectTransparencyToggle = document.getElementById('rect-transparency-toggle');
    formData.append("IsRectTransparent", rectTransparencyToggle?.checked ? "true" : "false");

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
        selectedBannerFile = null;
        const avatarInput = document.getElementById("avatar-input");
        if (avatarInput) avatarInput.value = "";
        const bannerInput = document.getElementById("banner-input");
        if (bannerInput) bannerInput.value = "";

        // Important: Update global storage to match new state
        const userInfo = getUserInfo();
        const savedAvatar = updatedProfile.avatarUrl;
        if (savedAvatar) {
            localStorage.setItem("userAvatar", savedAvatar);
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
        loadRecentActivity();
        loadRecentFavorites();
        loadRecentWishlist();

        // Initial view is owned games
        switchCarouselView('owned');
    } catch (error) {
        console.error("Error loading initial data:", error);
    }
}

function switchCarouselView(category) {
    currentCategory = category;
    const titleEl = document.getElementById('carousel-title');
    const carouselWrapper = document.getElementById('carousel-wrapper');

    if (carouselWrapper) {
        carouselWrapper.classList.remove('carousel-transition-in');
        carouselWrapper.classList.add('carousel-transition-out');
    }

    // Update Heading
    const labels = isVisitorMode ? {
        'favorite':  `In ${_visitedUser}'s Favorites`,
        'owned':     `In ${_visitedUser}'s Library`,
        'wishlist':  `In ${_visitedUser}'s Wishlist`,
        'completed': `${_visitedUser}'s Completed Games`,
        'playing':   `${_visitedUser} Is Currently Playing`,
        'dropped':   `Games ${_visitedUser} Dropped`,
        'onhold':    `${_visitedUser}'s Games On Hold`,
        'pending':   `${_visitedUser}'s Pending Games`
    } : {
        'favorite': 'a Quick Look To Your Favorite Games',
        'owned':    'All Owned Games In Your Collection',
        'wishlist': 'Games On Your Current Wishlist',
        'completed':'Your Fully Completed Adventures',
        'playing':  'What You Are Currently Playing',
        'dropped':  'Games You Have Dropped',
        'onhold':   'Games Currently On Hold',
        'pending':  'Games Pending In Your Library'
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
    switch (category) {
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
        case 'pending':
            filtered = allUserGames.filter(ug => ug.gamestatus === 'Pending' || ug.gamestatus === 6);
            break;
        default:
            filtered = allUserGames;
    }

    updateSnapshotCards(filtered);

    currentCarouselGames = filtered.map(ug => ({
        id: ug.externalId,
        title: ug.gameTitle,
        // The display 'imageUrl' will be used as the primary SRC (Vertical Poster preferred)
        imageUrl: getHqGameImage(ug.posterImageUrl || ug.gameImageUrl || "../../Assets/Images/Bg1.jpg", true),
        gameImageUrl: ug.gameImageUrl,
        posterImageUrl: ug.posterImageUrl,
        hoursPlayed: Math.floor(Math.random() * 80) + 10,
        gamestatus: ug.gamestatus
    }));

    currentIndex = 0;
    renderCarousel();

    if (carouselWrapper) {
        requestAnimationFrame(() => {
            carouselWrapper.classList.remove('carousel-transition-out');
            carouselWrapper.classList.add('carousel-transition-in');
            setTimeout(() => carouselWrapper.classList.remove('carousel-transition-in'), 360);
        });
    }
}

function updateSnapshotCards(filteredGames) {
    const totalGamesEl = document.getElementById('snapshot-total-games');
    const totalHoursEl = document.getElementById('snapshot-total-hours');

    if (totalGamesEl) {
        totalGamesEl.textContent = (filteredGames?.length || 0).toLocaleString();
    }

    if (!totalHoursEl) return;

    const currentToken = ++snapshotRequestToken;
    totalHoursEl.textContent = '...';

    computeTotalHours(filteredGames || [])
        .then(totalHours => {
            if (currentToken !== snapshotRequestToken) return;
            totalHoursEl.textContent = Math.round(totalHours).toLocaleString();
        })
        .catch(() => {
            if (currentToken !== snapshotRequestToken) return;
            totalHoursEl.textContent = '0';
        });
}

async function computeTotalHours(games) {
    if (!games || games.length === 0) return 0;

    let total = 0;
    const missingIds = [];

    for (const g of games) {
        const immediate = extractHoursFromGame(g);
        if (immediate !== null) {
            total += immediate;
            continue;
        }

        const id = g.externalId ?? g.id;
        if (!id) continue;

        if (playtimeCache.has(id)) {
            total += playtimeCache.get(id) || 0;
        } else {
            missingIds.push(id);
        }
    }

    if (missingIds.length === 0) return total;

    const fetches = missingIds.map(async id => {
        try {
            const res = await apiRequest(`/api/Steam/catalog/${id}`);
            if (!res.ok) {
                playtimeCache.set(id, 0);
                return 0;
            }
            const details = await res.json();
            const hours = extractHoursFromGame(details) ?? 0;
            playtimeCache.set(id, hours);
            return hours;
        } catch {
            playtimeCache.set(id, 0);
            return 0;
        }
    });

    const fetched = await Promise.all(fetches);
    return total + fetched.reduce((sum, h) => sum + (h || 0), 0);
}

function extractHoursFromGame(game) {
    if (!game) return null;

    const candidates = [
        game.playtime,
        game.hoursPlayed,
        game.avgHours,
        game.averageHours,
        game.estimatedHours
    ];

    for (const value of candidates) {
        if (value === null || value === undefined || value === '') continue;
        const num = Number(value);
        if (!Number.isNaN(num) && Number.isFinite(num)) {
            return Math.max(0, num);
        }
    }

    return null;
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

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    allGenresData = sorted;
    drawGenreRadar(sorted);

    const donutColors = ['#0df2f2', '#067d7d', '#06b6d4', '#334155'];
    const topLabel = document.getElementById('top-genre-label');
    if (topLabel && sorted.length > 0) topLabel.textContent = sorted[0][0];

    // --- Dynamic donut ---
    const donutSvg = document.getElementById('genre-donut-svg');
    if (donutSvg && sorted.length > 0) {
        const topN = sorted.slice(0, 4);
        const total = sorted.reduce((s, [, c]) => s + c, 0);
        let offset = 0;
        let circles = `<circle cx="18" cy="18" fill="transparent" r="16" stroke="#1e292b" stroke-width="3.5"/>`;
        topN.forEach(([, count], i) => {
            const pct = total > 0 ? (count / total) * 100 : 0;
            circles += `<circle cx="18" cy="18" fill="transparent" r="16" stroke="${donutColors[i]}" stroke-dasharray="${pct.toFixed(2)} 100" stroke-dashoffset="${(-offset).toFixed(2)}" stroke-width="3.5"/>`;
            offset += pct;
        });
        donutSvg.innerHTML = circles;
    }

    // --- Progress-bar list: 5 normal + separator + inline clipped full grid ---
    const barList = document.getElementById('genre-bar-list');
    if (barList && sorted.length > 0) {
        const maxCount = sorted[0][1];
        const total = sorted.reduce((s, [, c]) => s + c, 0);
        const barColors = ['#0df2f2', '#067d7d', '#06b6d4', '#334155', '#475569', '#64748b', '#94a3b8'];
        const gridColors = ['#0df2f2', '#067d7d', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'];

        const renderBar = ([name, count], globalIdx) => {
            const barW = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const color = barColors[Math.min(globalIdx, barColors.length - 1)];
            const safeName = name.replace(/'/g, "\\'");
            return `
            <div class="group/genre cursor-pointer" onclick="navigateToLibraryWithGenre('${safeName}')">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[9px] xirod-font text-slate-600 w-5 flex-shrink-0">${String(globalIdx + 1).padStart(2, '0')}</span>
                        <span class="text-xs font-bold text-slate-200 group-hover/genre:text-primary transition-colors truncate max-w-[120px]">${name}</span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <span class="text-[10px] text-slate-500">${count}</span>
                        <span class="text-[9px] xirod-font px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">${pct}%</span>
                    </div>
                </div>
                <div class="h-1 rounded-full bg-slate-800 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700 ease-out" style="width:${barW}%;background:${color};box-shadow:0 0 6px ${color}50"></div>
                </div>
            </div>`;
        };

        const top5 = sorted.slice(0, 5);

        // Bars only go into genre-bar-list
        barList.innerHTML = `<div class="flex flex-col gap-3">${top5.map((g, i) => renderBar(g, i)).join('')}</div>`;

        // All genres grid goes full-width into genre-full-breakdown
        const breakdown = document.getElementById('genre-full-breakdown');
        if (breakdown) {
            const allGridItems = sorted.map(([name, count], idx) => {
                const color = gridColors[idx % gridColors.length];
                const safeName = name.replace(/'/g, "\\'");
                return `
                <div class="flex items-center gap-2 py-1 px-1 cursor-pointer group" onclick="navigateToLibraryWithGenre('${safeName}')">
                    <div class="size-2.5 rounded-sm flex-shrink-0 group-hover:scale-125 transition-transform" style="background-color:${color}"></div>
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-slate-200 truncate group-hover:text-primary transition-colors">${name}</p>
                        <p class="text-[10px] text-slate-500">${count} ${count === 1 ? 'Game' : 'Games'}</p>
                    </div>
                </div>`;
            }).join('');

            breakdown.innerHTML = `
                <div class="border-t border-slate-700/50 my-4"></div>
                <p class="text-[9px] xirod-font text-slate-500 uppercase tracking-wider mb-3">Complete Genre Breakdown</p>
                <div class="relative">
                    <div id="genre-inline-grid" class="grid grid-cols-3 gap-x-1 gap-y-0.5 overflow-hidden transition-all duration-500" 
                         style="max-height:130px; -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%); mask-image: linear-gradient(to bottom, black 60%, transparent 100%);">
                        ${allGridItems}
                    </div>
                </div>`;
        }
    }
}

function drawGenreRadar(genres) {
    const svg = document.getElementById('genre-radar-svg');
    const statsEl = document.getElementById('genre-radar-stats');
    if (!svg) return;

    const top = genres.slice(0, 6);

    if (top.length < 3) {
        svg.innerHTML = `<text x="155" y="155" text-anchor="middle" dominant-baseline="middle" fill="#475569" font-size="11" font-family="sans-serif">Not enough genre data</text>`;
        return;
    }

    const n = top.length;
    const cx = 155, cy = 148, r = 90;
    const maxVal = top[0][1];

    const angle = i => (Math.PI * 2 * i / n) - Math.PI / 2;
    const pt = (i, radius) => ({
        x: cx + radius * Math.cos(angle(i)),
        y: cy + radius * Math.sin(angle(i))
    });
    const poly = pts => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Grid levels
    let gridSvg = '';
    [1 / 3, 2 / 3, 1].forEach(lvl => {
        const pts = Array.from({ length: n }, (_, i) => pt(i, r * lvl));
        gridSvg += `<polygon points="${poly(pts)}" fill="none" stroke="#1e293b" stroke-width="1"/>`;
    });

    // Axis lines
    let axesSvg = '';
    for (let i = 0; i < n; i++) {
        const p = pt(i, r);
        axesSvg += `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#1e293b" stroke-width="1"/>`;
    }

    // Data polygon
    const dataPts = top.map(([, count], i) => {
        const ratio = maxVal > 0 ? count / maxVal : 0;
        return pt(i, r * Math.max(0.07, ratio));
    });

    // Labels
    const labelR = r + 20;
    let labelsSvg = '';
    top.forEach(([name], i) => {
        const p = pt(i, labelR);
        const cos = Math.cos(angle(i));
        const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
        const display = name.length > 9 ? name.slice(0, 8) + '\u2026' : name;
        labelsSvg += `<text id="radar-label-${i}" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="#94a3b8" font-size="8.5" font-family="'Courier New', monospace" letter-spacing="0.08em" style="transition:all .18s ease">${display.toUpperCase()}</text>`;
    });

    // Vertex dots
    let dotsSvg = dataPts.map((p, i) =>
        `<circle id="radar-dot-${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#0df2f2" filter="url(#radarGlow)" style="cursor:pointer;transition:r .18s ease"/>`
    ).join('');

    svg.innerHTML = `
        <defs>
            <filter id="radarGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="3.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#0df2f2" stop-opacity="0.28"/>
                <stop offset="100%" stop-color="#067d7d" stop-opacity="0.1"/>
            </linearGradient>
        </defs>
        ${gridSvg}
        ${axesSvg}
        <polygon points="${poly(dataPts)}" fill="url(#radarFill)" stroke="#0df2f2" stroke-width="2" stroke-linejoin="round" filter="url(#radarGlow)"/>
        ${dotsSvg}
        ${labelsSvg}`;

    // Hover: scale dot + highlight label (triggers from both dot and label)
    top.forEach(([name, count], i) => {
        const dot = svg.querySelector(`#radar-dot-${i}`);
        const label = svg.querySelector(`#radar-label-${i}`);
        if (!dot || !label) return;

        const activate = () => {
            dot.setAttribute('r', '6.5');
            dot.setAttribute('fill', '#ffffff');
            label.setAttribute('fill', '#0df2f2');
            label.setAttribute('font-size', '10');
            label.setAttribute('font-weight', 'bold');
        };
        const deactivate = () => {
            dot.setAttribute('r', '3.5');
            dot.setAttribute('fill', '#0df2f2');
            label.setAttribute('fill', '#94a3b8');
            label.setAttribute('font-size', '8.5');
            label.setAttribute('font-weight', 'normal');
        };

        dot.addEventListener('mouseenter', activate);
        dot.addEventListener('mouseleave', deactivate);
        label.style.cursor = 'pointer';
        label.addEventListener('mouseenter', activate);
        label.addEventListener('mouseleave', deactivate);
    });

    // Stats strip
    if (statsEl) {
        const totalGames = allUserGames.filter(g => g.gamestatus !== 'whishlist' && g.gamestatus !== 2).length;
        const topPct = totalGames > 0 ? Math.round((top[0][1] / totalGames) * 100) : 0;
        const totalGenres = genres.length;
        statsEl.innerHTML = `
            <div class="text-center">
                <p class="text-xl font-black text-primary xirod-font leading-none">${topPct}%</p>
                <p class="text-[9px] text-slate-500 xirod-font uppercase tracking-wider mt-1">${top[0][0].length > 8 ? top[0][0].slice(0, 7) + '\u2026' : top[0][0]}</p>
            </div>
            <div class="text-center border-x border-slate-700/50">
                <p class="text-xl font-black text-slate-100 xirod-font leading-none">${totalGenres}</p>
                <p class="text-[9px] text-slate-500 xirod-font uppercase tracking-wider mt-1">Genres</p>
            </div>
            <div class="text-center">
                <p class="text-xl font-black text-violet-400 xirod-font leading-none">${totalGames}</p>
                <p class="text-[9px] text-slate-500 xirod-font uppercase tracking-wider mt-1">Library</p>
            </div>`;
    }
}

function toggleGenreReport() {
    isGenreReportExpanded = !isGenreReportExpanded;
    const reportText = document.getElementById("genre-report-text");
    const reportIcon = document.getElementById("genre-report-icon");
    const grid = document.getElementById('genre-inline-grid');

    if (isGenreReportExpanded) {
        if (grid) {
            grid.style.maxHeight = grid.scrollHeight + 'px';
            grid.style.maskImage = 'none';
            grid.style.webkitMaskImage = 'none';
        }
        reportText.textContent = "CLOSE REPORT";
        reportIcon.textContent = "expand_less";
    } else {
        if (grid) {
            grid.style.maxHeight = '130px';
            const mask = 'linear-gradient(to bottom, black 60%, transparent 100%)';
            grid.style.maskImage = mask;
            grid.style.webkitMaskImage = mask;
        }
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

        // Use a cascading fallback for images: 
        // 1. Vertical Poster (resolved by getHqGameImage) - already in game.imageUrl
        // 2. Horizontal/Standard Image (resolved as HQ capsule)
        // 3. Original Header/Image from API (no-transformation fallback)
        // 4. System Placeholder
        const capsuleImg = getHqGameImage(game.gameImageUrl || game.imageUrl, false);
        const originalImg = game.gameImageUrl || "../../Assets/Images/Bg1.jpg";

        card.innerHTML = `
            <img src="${game.imageUrl}" 
                 data-fallback-capsule="${capsuleImg}"
                 data-fallback-original="${originalImg}"
                 alt="${game.title}" 
                 onerror="handleCarouselImageError(this)">
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
            if (offset === 1) moveCarousel(1);
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

// ─── Shared helper for all three recent-games widgets ────────────────────────
function _parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const iso = dateStr.toString().replace(' ', 'T').replace(/Z?$/, 'Z');
    return new Date(iso);
}

function _relativeTime(dateStr) {
    const date = _parseDate(dateStr);
    if (!dateStr || isNaN(date)) return null;
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Resolves high-quality Steam imagery based on view requirements.
 * vertical=true: returns 600x900 poster (avoids zooming in horizontal headers)
 * vertical=false: returns 616x353 high-res capsule
 */
function getHqGameImage(url, isVertical = false) {
    if (!url || url.includes('../../Assets/Images/Bg1.jpg')) return url || '../../Assets/Images/Bg1.jpg';

    // Steam image processing - Support multiple CDNs and domains
    const isSteam = /steamstatic|steamcdn|steampowered/.test(url.toLowerCase());

    if (isSteam) {
        const type = isVertical ? 'library_600x900_2x.jpg' : 'capsule_616x353.jpg';

        // Remove trailing query params
        let cleanUrl = url.split('?')[0];

        // Pattern handles /apps/APPID/ or /steam/apps/APPID/
        const appIdMatch = cleanUrl.match(/\/apps\/(\d+)\//);
        if (appIdMatch) {
            const appId = appIdMatch[1];
            
            // Reconstruct URL with target image type
            const appsIndex = cleanUrl.indexOf('/apps/');
            const domainPath = cleanUrl.substring(0, appsIndex);
            
            // Check if we already have the right type in the URL
            if (cleanUrl.toLowerCase().includes(isVertical ? 'library_600x900' : 'capsule_616x353')) {
                return cleanUrl;
            }

            return `${domainPath}/apps/${appId}/${type}`;
        }
    }
    return url;
}

/**
 * Cascading error handler for carousel images
 */
function handleCarouselImageError(img) {
    const capsule = img.getAttribute('data-fallback-capsule');
    const original = img.getAttribute('data-fallback-original');
    const defaultImg = '../../Assets/Images/Bg1.jpg';

    if (img.src !== capsule && capsule && capsule !== img.src) {
        img.src = capsule;
    } else if (img.src !== original && original && original !== img.src) {
        img.src = original;
    } else if (img.src !== defaultImg) {
        img.src = defaultImg;
        img.onerror = null;
    }
}

const _statusLabels = {
    'playing': { label: 'Playing', color: 'text-primary', icon: 'play_circle' },
    '1': { label: 'Playing', color: 'text-primary', icon: 'play_circle' },
    'completed': { label: 'Completed', color: 'text-green-400', icon: 'task_alt' },
    '3': { label: 'Completed', color: 'text-green-400', icon: 'task_alt' },
    'dropped': { label: 'Dropped', color: 'text-red-400', icon: 'do_not_disturb_on' },
    '4': { label: 'Dropped', color: 'text-red-400', icon: 'do_not_disturb_on' },
    'onhold': { label: 'On Hold', color: 'text-yellow-400', icon: 'pause_circle' },
    '5': { label: 'On Hold', color: 'text-yellow-400', icon: 'pause_circle' },
    'pending': { label: 'Pending', color: 'text-slate-400', icon: 'schedule' },
    '6': { label: 'Pending', color: 'text-slate-400', icon: 'schedule' },
};

function renderRecentGames(listId, games, cfg) {
    // cfg = { emptyIcon, emptyMsg, viewHref, accentColor, statusOverride }
    const list = document.getElementById(listId);
    if (!list) return;

    const sorted = [...games]
        .sort((a, b) => _parseDate(b.addedAt) - _parseDate(a.addedAt))
        .slice(0, 3);

    if (sorted.length === 0) {
        list.innerHTML = `
            <div class="py-6 text-center text-slate-600">
                <span class="material-symbols-outlined text-3xl mb-1 block opacity-30">${cfg.emptyIcon}</span>
                <p class="text-[10px] xirod-font uppercase tracking-wider">${cfg.emptyMsg}</p>
            </div>`;
        return;
    }

    list.innerHTML = '';
    sorted.forEach((game, i) => {
        // Priority for activity icons: Vertical Poster (better for square crop) -> Capsule -> Original
        const posterImg = getHqGameImage(game.posterImageUrl || game.gameImageUrl || '../../Assets/Images/Bg1.jpg', true);
        const capsuleImg = getHqGameImage(game.gameImageUrl || '../../Assets/Images/Bg1.jpg', false);
        const originalImg = game.gameImageUrl || '../../Assets/Images/Bg1.jpg';
        
        const sKey = String(game.gamestatus).toLowerCase();
        const st = cfg.statusOverride || _statusLabels[sKey] || { label: 'Library', color: 'text-slate-400', icon: 'inventory_2' };
        const time = _relativeTime(game.addedAt);

        const row = document.createElement('div');
        row.className = `flex gap-3 items-center p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer group`;
        row.style.animationDelay = `${i * 60}ms`;
        row.onclick = () => window.location.href = cfg.viewHref;
        row.innerHTML = `
            <div class="relative size-12 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0 shadow-md">
                <img src="${posterImg}" 
                     class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                     data-fallback-capsule="${capsuleImg}"
                     data-fallback-original="${originalImg}"
                     onerror="handleCarouselImageError(this)">
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-white truncate group-hover:${cfg.accentText} transition-colors uppercase">${game.gameTitle}</p>
                <div class="flex items-center gap-1 mt-0.5">
                    <span class="material-symbols-outlined text-[11px] ${st.color}">${st.icon}</span>
                    <span class="text-[10px] xirod-font ${st.color}">${st.label}</span>
                </div>
                ${time ? `<p class="text-[9px] text-slate-600 mt-0.5">${time}</p>` : ''}
            </div>
            <span class="material-symbols-outlined text-[16px] text-slate-700 group-hover:${cfg.accentText} transition-colors">chevron_right</span>`;
        list.appendChild(row);
    });
}
// ─────────────────────────────────────────────────────────────────────────────

async function loadRecentActivity() {
    const libraryGames = allUserGames.filter(g => g.gamestatus !== 'whishlist' && g.gamestatus !== 2);
    renderRecentGames('recent-activity-list', libraryGames, {
        emptyIcon: 'inventory_2',
        emptyMsg: 'No games in library yet',
        viewHref: '../../Dashboard/Html/dashboard.html?view=library',
        accentText: 'text-primary',
    });
}

function loadRecentFavorites() {
    const favGames = allUserGames.filter(g => g.isFavorite === true);
    renderRecentGames('recent-favorites-list', favGames, {
        emptyIcon: 'heart_plus',
        emptyMsg: 'No favorites yet',
        viewHref: '../../Dashboard/Html/dashboard.html?view=favorites',
        accentText: 'text-red-400',
        statusOverride: { label: 'Favorite', color: 'text-red-400', icon: 'favorite' },
    });
}

function loadRecentWishlist() {
    const wishGames = allUserGames.filter(g => g.isInWishlist === true);
    renderRecentGames('recent-wishlist-list', wishGames, {
        emptyIcon: 'bookmark_add',
        emptyMsg: 'Wishlist is empty',
        viewHref: '../../Dashboard/Html/dashboard.html?view=wishlist',
        accentText: 'text-blue-400',
        statusOverride: { label: 'Wishlisted', color: 'text-blue-400', icon: 'bookmark' },
    });
}

function navigateToDashboard(view = "catalog") {
    window.location.href = `../../Dashboard/Html/dashboard.html?view=${view}`;
}

function logout() {
    clearAuthData();
    window.location.href = "../../Auth/Html/login.html";
}

// ============================================================
// FRIENDSHIP SYSTEM
// ============================================================

function navigateToFriendsPage() {
    const target = isVisitorMode ? _visitedUser : (getUserInfo()?.userName);
    if (target) window.location.href = `../Html/friends.html?user=${encodeURIComponent(target)}`;
}

// Load friendship status when visiting another profile
async function loadFriendshipStatus(username) {
    try {
        const res = await apiRequest(`/api/Friendship/status/${encodeURIComponent(username)}`);
        if (!res.ok) return;
        friendshipState = await res.json();
        updateFriendshipBtn();
        updateFriendsCountStat(friendshipState.friendsCount);
        loadFriendsPreview(username);
    } catch (e) {
        console.error('Friendship status error:', e);
    }
}

// Load own friend count + preview for the owner's view
async function loadOwnFriendship() {
    const me = getUserInfo()?.userName;
    if (!me) return;
    try {
        const res = await apiRequest(`/api/Friendship/status/${encodeURIComponent(me)}`);
        if (!res.ok) return;
        const data = await res.json();
        updateFriendsCountStat(data.friendsCount);
        loadFriendsPreview(me);
    } catch (e) {
        console.error('Own friendship load error:', e);
    }
}

function updateFriendsCountStat(count) {
    const statEl = document.getElementById('stat-friends');
    if (statEl) statEl.textContent = (count || 0).toLocaleString();
    const headerEl = document.getElementById('friends-count-header');
    if (headerEl) headerEl.textContent = count > 0 ? `(${count})` : '';
}

function updateFriendshipBtn() {
    const btn = document.getElementById('add-friend-btn');
    if (!btn) return;

    const { status, isSentByMe } = friendshipState || {};

    // Reset hover handlers
    btn.onmouseenter = null;
    btn.onmouseleave = null;

    if (!status) {
        btn.innerHTML = `<span class="material-symbols-outlined text-[20px]">person_add</span><span>ADD FRIEND</span>`;
        btn.className = 'h-14 w-52 justify-center rounded-2xl bg-primary/20 border border-primary/40 text-primary font-black hover:bg-primary/30 transition-all flex items-center gap-3 xirod-font text-[12px] uppercase tracking-wider shadow-lg';
    } else if (status === 'Pending' && !isSentByMe) {
        btn.innerHTML = `<span class="material-symbols-outlined text-[20px]">how_to_reg</span><span>ACCEPT REQUEST</span>`;
        btn.className = 'h-14 w-52 justify-center rounded-2xl bg-green-500/20 border border-green-500/40 text-green-400 font-black hover:bg-green-500/30 transition-all flex items-center gap-3 xirod-font text-[12px] uppercase tracking-wider shadow-lg';
    } else if (status === 'Pending' && isSentByMe) {
        btn.innerHTML = `<span class="material-symbols-outlined text-[20px]">schedule</span><span>PENDING...</span>`;
        btn.className = 'h-14 w-52 justify-center rounded-2xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-black hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-400 transition-all flex items-center gap-3 xirod-font text-[12px] uppercase tracking-wider shadow-lg';
        btn.onmouseenter = () => { btn.querySelector('span:last-child').textContent = 'CANCEL'; btn.querySelector('span:first-child').textContent = 'cancel'; };
        btn.onmouseleave = () => { btn.querySelector('span:last-child').textContent = 'PENDING...'; btn.querySelector('span:first-child').textContent = 'schedule'; };
    } else if (status === 'Accepted') {
        btn.innerHTML = `<span class="material-symbols-outlined text-[20px]">how_to_reg</span><span>FRIENDS</span>`;
        btn.className = 'h-14 w-52 justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-400 transition-all flex items-center gap-3 xirod-font text-[12px] uppercase tracking-wider shadow-lg';
        btn.onmouseenter = () => { btn.querySelector('span:last-child').textContent = 'UNFRIEND'; btn.querySelector('span:first-child').textContent = 'person_remove'; };
        btn.onmouseleave = () => { btn.querySelector('span:last-child').textContent = 'FRIENDS'; btn.querySelector('span:first-child').textContent = 'how_to_reg'; };
    }

    btn.onclick = handleFriendAction;
}

async function handleFriendAction() {
    if (!friendshipState && !isVisitorMode) return;
    const { status, isSentByMe, friendshipId } = friendshipState || {};

    try {
        if (!status) {
            const res = await apiRequest(`/api/Friendship/send/${encodeURIComponent(_visitedUser)}`, { method: 'POST' });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            friendshipState = { status: 'Pending', isSentByMe: true, friendshipId: data.friendshipId, friendsCount: friendshipState?.friendsCount || 0 };

        } else if (status === 'Pending' && !isSentByMe) {
            const res = await apiRequest(`/api/Friendship/accept/${friendshipId}`, { method: 'PUT' });
            if (!res.ok) throw new Error(await res.text());
            await loadFriendshipStatus(_visitedUser);
            return;

        } else if (status === 'Pending' && isSentByMe) {
            const res = await apiRequest(`/api/Friendship/remove/${friendshipId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            friendshipState = { status: null, friendsCount: friendshipState?.friendsCount || 0 };

        } else if (status === 'Accepted') {
            if (!(await showConfirmModal())) return;
            const res = await apiRequest(`/api/Friendship/remove/${friendshipId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            const newCount = Math.max(0, (friendshipState?.friendsCount || 1) - 1);
            friendshipState = { status: null, friendsCount: newCount };
            updateFriendsCountStat(newCount);
            loadFriendsPreview(_visitedUser);
            showToast('Friend removed', 'info');
        }

        updateFriendshipBtn();
    } catch (e) {
        console.error('Friend action failed:', e);
    }
}

// Called by notifications.js when the visited user accepts our friend request
window._onFriendshipAccepted = function () {
    if (!_visitedUser || !isVisitorMode) return;
    loadFriendshipStatus(_visitedUser);
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: 'check_circle', error: 'error', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined text-[18px] fill-icon">${icons[type] || 'info'}</span>
        <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3000);
}

function showConfirmModal() {
    return new Promise(resolve => {
        const modal = document.getElementById('unfriend-confirm-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        function close(result) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            backdrop.removeEventListener('click', onCancel);
            resolve(result);
        }

        const confirmBtn = document.getElementById('unfriend-confirm-btn');
        const cancelBtn = document.getElementById('unfriend-cancel-btn');
        const backdrop = document.getElementById('unfriend-modal-backdrop');

        function onConfirm() { close(true); }
        function onCancel() { close(false); }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        backdrop.addEventListener('click', onCancel);
    });
}

async function loadFriendsPreview(username) {
    const list = document.getElementById('friends-preview-list');
    const empty = document.getElementById('friends-empty');
    const showAllLink = document.getElementById('friends-show-all');
    if (!list) return;

    if (showAllLink) showAllLink.href = `../Html/friends.html?user=${encodeURIComponent(username)}`;

    try {
        const res = await apiRequest(`/api/Friendship/friends/${encodeURIComponent(username)}`);
        if (!res.ok) return;
        const friends = await res.json();

        updateFriendsCountStat(friends.length);

        if (friends.length === 0) {
            list.innerHTML = '';
            empty?.classList.remove('hidden');
            return;
        }

        empty?.classList.add('hidden');
        const preview = friends.slice(0, 8);
        const remaining = friends.length - preview.length;

        list.innerHTML = preview.map(f => {
            const displayName = f.displayName || f.username;
            const avatarSrc = f.avatarUrl
                ? `${API_URL}/Uploads/${f.avatarUrl}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=080f0f&color=0df2f2&size=80`;
            const safeName = encodeURIComponent(f.username);
            return `
            <div class="flex flex-col items-center gap-1.5 cursor-pointer group" onclick="window.location.href='../Html/visit-profile.html?user=${safeName}'">
                <div class="h-14 w-14 rounded-full overflow-hidden border-2 border-slate-700 group-hover:border-primary transition-all shadow-lg">
                    <img src="${avatarSrc}" class="h-full w-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=080f0f&color=0df2f2&size=80'">
                </div>
                <p class="text-[10px] xirod-font text-slate-500 group-hover:text-primary transition-colors truncate max-w-[60px]">${displayName}</p>
            </div>`;
        }).join('');

        if (remaining > 0) {
            list.innerHTML += `
            <a href="../Html/friends.html?user=${encodeURIComponent(username)}" class="flex flex-col items-center gap-1.5 group">
                <div class="h-14 w-14 rounded-full border-2 border-dashed border-slate-600 group-hover:border-primary transition-all flex items-center justify-center">
                    <span class="text-xs font-bold text-slate-500 group-hover:text-primary transition-colors">+${remaining}</span>
                </div>
                <p class="text-[10px] xirod-font text-slate-500 group-hover:text-primary transition-colors">MORE</p>
            </a>`;
        }
    } catch (e) {
        console.error('Error loading friends preview:', e);
    }
}
