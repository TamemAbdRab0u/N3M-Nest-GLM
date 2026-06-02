// ============================================================
// GLOBAL NOTIFICATION SYSTEM
// Handles real-time friend request notifications via SignalR.
// Depends on: auth.js (API_URL, getAuthToken, getUserInfo, apiRequest, isLoggedIn)
// Depends on: signalr.min.js CDN (loaded before this file)
// Auto-initializes on DOMContentLoaded for any logged-in page.
// Creates a floating bell widget if #notif-wrapper doesn't exist.
// ============================================================

(function () {
    'use strict';

    // ── State ────────────────────────────────────────────────
    let _notifConnection = null;
    let _pendingRequests = []; // { FriendshipId, FromUserId, FromUsername, FromDisplayName, FromAvatarUrl }
    let _initialized = false;

    // Build an absolute URL to profile.html regardless of which page we're on.
    // Strip the last 3 path segments (dir1/dir2/file.html) and re-attach the profile path.
    function _profileUrl(username) {
        const segs = window.location.href.split('?')[0].split('#')[0].split('/');
        segs.splice(-3, 3);
        return segs.join('/') + `/Profile/Html/visit-profile.html?user=${encodeURIComponent(username)}`;
    }

    // ── Bell widget HTML (injected only if #notif-wrapper absent) ─
    function _ensureBellWidget() {
        if (document.getElementById('notif-wrapper')) return; // already in DOM (profile page)

        const wrapper = document.createElement('div');
        wrapper.id = 'notif-wrapper';
        wrapper.className = 'fixed top-4 right-4 z-[300]';
        wrapper.innerHTML = `
            <button id="notification-btn"
                onclick="window._notifToggleDropdown()"
                class="h-12 w-12 rounded-full bg-[#0a1618]/80 border border-slate-700/60 backdrop-blur-md flex items-center justify-center text-slate-400 hover:text-white hover:border-primary/50 hover:bg-[#1e292b] transition-all group overflow-visible relative shadow-lg">
                <span class="material-symbols-outlined text-[22px] relative z-10 transition-transform group-hover:scale-110">notifications</span>
                <span id="notif-badge" class="hidden absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-[#080f0f] text-[10px] font-black flex items-center justify-center z-20 shadow-[0_0_8px_rgba(13,242,242,0.8)] animate-pulse">0</span>
            </button>
            <!-- Notification Dropdown -->
            <div id="notif-dropdown"
                class="hidden absolute top-[calc(100%+10px)] right-0 w-80 bg-[#0a1618] border border-[#1e293b] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-[200] overflow-hidden backdrop-blur-xl">
                <div class="px-5 py-4 border-b border-[#1e293b] flex items-center justify-between">
                    <h3 class="text-xs font-black text-slate-300 uppercase tracking-widest" style="font-family:'Xirod',sans-serif">Friend Requests</h3>
                    <span id="notif-count-label" class="text-[10px] text-slate-500"></span>
                </div>
                <div id="notif-list" class="overflow-y-auto" style="max-height:360px;scrollbar-width:thin;scrollbar-color:#1e293b transparent"></div>
                <div id="notif-empty" class="hidden px-5 py-8 flex flex-col items-center gap-2">
                    <span class="material-symbols-outlined text-3xl text-slate-700">notifications_off</span>
                    <p class="text-xs text-slate-600 uppercase tracking-wider" style="font-family:'Xirod',sans-serif">No pending requests</p>
                </div>
            </div>`;
        document.body.appendChild(wrapper);
    }

    // ── Toast container ────────────────────────────────────────
    function _ensureToastContainer() {
        if (document.getElementById('notif-toast-container')) return;
        const div = document.createElement('div');
        div.id = 'notif-toast-container';
        div.className = 'fixed top-6 right-6 z-[500] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(div);
    }

    // ── Public: toggle dropdown ────────────────────────────────
    window._notifToggleDropdown = function () {
        const dd = document.getElementById('notif-dropdown');
        if (dd) dd.classList.toggle('hidden');
    };

    // also expose as toggleNotifDropdown for profile.html's inline onclick
    window.toggleNotifDropdown = window._notifToggleDropdown;

    // ── Load pending requests from REST ───────────────────────
    async function _loadPending() {
        try {
            const res = await apiRequest('/api/Friendship/pending');
            if (!res.ok) return;
            const data = await res.json();
            _pendingRequests = data.map(d => ({
                FriendshipId: d.friendshipId,
                FromUserId: d.userId,
                FromUsername: d.username,
                FromDisplayName: d.displayName,
                FromAvatarUrl: d.avatarUrl
            }));
            _renderDropdown();
        } catch (e) {
            console.error('Notifications: pending load error', e);
        }
    }

    // ── SignalR hub connection ─────────────────────────────────
    function _connect() {
        const token = getAuthToken();
        if (!token) return;
        if (typeof signalR === 'undefined') {
            console.warn('Notifications: SignalR not loaded');
            return;
        }

        _notifConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${API_URL}/notifications`, { accessTokenFactory: () => token })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        _notifConnection.on('FriendRequest', (notification) => {
            if (notification.eventType === 'Received') {
                // Replace any existing request from the same sender (handles re-sends)
                _pendingRequests = _pendingRequests.filter(r => r.FromUserId !== notification.fromUserId);
                _pendingRequests.push({
                    FriendshipId: notification.friendshipId,
                    FromUserId: notification.fromUserId,
                    FromUsername: notification.fromUsername,
                    FromDisplayName: notification.fromDisplayName,
                    FromAvatarUrl: notification.fromAvatarUrl
                });
                _renderDropdown();
                _showToast(notification, 'received');
            } else if (notification.eventType === 'Cancelled') {
                // Sender withdrew their request — remove from bell silently
                _pendingRequests = _pendingRequests.filter(r => r.FriendshipId !== notification.friendshipId);
                _renderDropdown();
            } else if (notification.eventType === 'Accepted') {
                _showToast(notification, 'accepted');
                if (typeof window._onFriendshipAccepted === 'function') {
                    window._onFriendshipAccepted(notification);
                }
            }
        });

        _notifConnection.on('PresenceChanged', () => {
            // Ignore presence updates on pages that only use notifications.
        });

        _notifConnection.onreconnected(() => _loadPending());

        (async function tryStart() {
            try {
                await _notifConnection.start();
            } catch (e) {
                setTimeout(tryStart, 5000);
            }
        })();
    }

    // ── Render dropdown items ──────────────────────────────────
    function _renderDropdown() {
        const list = document.getElementById('notif-list');
        const empty = document.getElementById('notif-empty');
        const badge = document.getElementById('notif-badge');
        const countLbl = document.getElementById('notif-count-label');
        if (!list) return;

        const count = _pendingRequests.length;

        if (count > 0) {
            badge?.classList.remove('hidden');
            if (badge) badge.textContent = count > 9 ? '9+' : String(count);
        } else {
            badge?.classList.add('hidden');
        }
        if (countLbl) countLbl.textContent = count > 0 ? `${count} pending` : '';

        if (count === 0) {
            list.innerHTML = '';
            empty?.classList.remove('hidden');
            return;
        }
        empty?.classList.add('hidden');

        list.innerHTML = _pendingRequests.map(req => {
            const name = req.FromDisplayName || req.FromUsername;
            const avatar = req.FromAvatarUrl
                ? getUploadUrl(req.FromAvatarUrl)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=080f0f&color=0df2f2&size=60`;
            return `
            <div class="notif-item flex items-center gap-3 px-4 py-3.5 border-b border-[#1e293b]/60 hover:bg-white/5 transition-all" data-fid="${req.FriendshipId}">
                <div class="h-11 w-11 rounded-full overflow-hidden border border-slate-700 flex-shrink-0 cursor-pointer"
                     onclick="window.location.href='${_profileUrl(req.FromUsername)}'">
                    <img src="${avatar}" class="h-full w-full object-cover"
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=080f0f&color=0df2f2&size=60'">
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-200 truncate">${name}</p>
                    <p class="text-[10px] text-slate-500 truncate">Sent you a friend request</p>
                </div>
                <div class="flex gap-1.5 flex-shrink-0">
                    <button onclick="window._notifAccept(${req.FriendshipId})"
                        class="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 text-primary hover:bg-primary/40 transition-all flex items-center justify-center"
                        title="Accept">
                        <span class="material-symbols-outlined text-[16px]">check</span>
                    </button>
                    <button onclick="window._notifDecline(${req.FriendshipId})"
                        class="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition-all flex items-center justify-center"
                        title="Decline">
                        <span class="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    // ── Accept ────────────────────────────────────────────────
    window._notifAccept = async function (friendshipId) {
        try {
            const res = await apiRequest(`/api/Friendship/accept/${friendshipId}`, { method: 'PUT' });
            if (!res.ok) throw new Error(await res.text());
            _removeFromPending(friendshipId);
            _briefStatus(friendshipId, 'accepted');
            // If profile page functions exist, refresh them
            if (typeof loadFriendsPreview === 'function') {
                const me = getUserInfo()?.userName;
                if (me) loadFriendsPreview(me);
            }
            if (typeof loadOwnFriendship === 'function') loadOwnFriendship();
        } catch (e) {
            console.error('Notifications: accept error', e);
        }
    };

    // ── Decline ───────────────────────────────────────────────
    window._notifDecline = async function (friendshipId) {
        try {
            const res = await apiRequest(`/api/Friendship/remove/${friendshipId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            _removeFromPending(friendshipId);
            _briefStatus(friendshipId, 'declined');
        } catch (e) {
            console.error('Notifications: decline error', e);
        }
    };

    function _removeFromPending(friendshipId) {
        _pendingRequests = _pendingRequests.filter(r => r.FriendshipId !== friendshipId);
        _renderDropdown();
    }

    function _briefStatus(friendshipId, type) {
        const item = document.querySelector(`.notif-item[data-fid="${friendshipId}"]`);
        if (!item) return;
        const ok = type === 'accepted';
        item.innerHTML = `<div class="flex-1 py-1 text-center text-xs uppercase tracking-wider ${ok ? 'text-emerald-400' : 'text-rose-400'}" style="font-family:'Xirod',sans-serif">
            <span class="material-symbols-outlined text-[14px] align-middle mr-1">${ok ? 'check_circle' : 'cancel'}</span>
            ${ok ? 'Accepted!' : 'Declined'}
        </div>`;
        setTimeout(() => { item.remove(); }, 1200);
    }

    // ── Toast ──────────────────────────────────────────────────
    function _showToast(notification, type) {
        const toastKey = `notif-toast-${type}-${notification.friendshipId ?? notification.fromUserId}`;
        const now = Date.now();
        const last = parseInt(localStorage.getItem(toastKey) || '0', 10);
        if (now - last < 10000) return;
        localStorage.setItem(toastKey, String(now));
        setTimeout(() => localStorage.removeItem(toastKey), 10000);

        const container = document.getElementById('notif-toast-container');
        if (!container) return;

        const name = notification.fromDisplayName || notification.fromUsername;
        const avatar = notification.fromAvatarUrl
            ? getUploadUrl(notification.fromAvatarUrl)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=080f0f&color=0df2f2&size=60`;

        const isReceived = type === 'received';
        const borderColor = isReceived ? 'border-primary/40' : 'border-emerald-500/40';
        const iconColor = isReceived ? 'text-primary' : 'text-emerald-400';
        const icon = isReceived ? 'person_add' : 'how_to_reg';
        const label = isReceived ? 'Friend Request' : 'Request Accepted';
        const sub = isReceived
            ? `<span class="font-bold text-white">${name}</span> wants to be your friend`
            : `<span class="font-bold text-white">${name}</span> accepted your request`;

        const toast = document.createElement('div');
        toast.className = `pointer-events-auto flex items-center gap-3 bg-[#0a1618]/95 border ${borderColor} rounded-2xl px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl w-72 transition-all duration-300 translate-x-full opacity-0`;
        toast.innerHTML = `
            <div class="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 border border-slate-700">
                <img src="${avatar}" class="h-full w-full object-cover"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=080f0f&color=0df2f2&size=60'">
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[10px] ${iconColor} uppercase tracking-wider flex items-center gap-1 mb-0.5" style="font-family:'Xirod',sans-serif">
                    <span class="material-symbols-outlined text-[13px]">${icon}</span>${label}
                </p>
                <p class="text-xs text-slate-400 leading-snug">${sub}</p>
            </div>
            <button onclick="this.closest('.pointer-events-auto').remove()"
                class="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0">
                <span class="material-symbols-outlined text-[16px]">close</span>
            </button>`;

        container.appendChild(toast);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        }));
        const timer = setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 6000);
        toast.addEventListener('mouseenter', () => clearTimeout(timer));
    }

    // ── Outside-click to close dropdown ───────────────────────
    function _bindOutsideClick() {
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('notif-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                document.getElementById('notif-dropdown')?.classList.add('hidden');
            }
        });
    }

    // ── Helper to determine relative URLs for mobile navigation ──
    function _getRelativeUrl(targetPath) {
        const isCollections = window.location.pathname.toLowerCase().includes('/collections/');
        const prefix = isCollections ? '../../../' : '../../';
        return prefix + targetPath;
    }

    // ── Mobile Bottom Navigation Bar widget implementation ──
    function _ensureMobileWidget() {
        if (window.location.pathname.toLowerCase().includes('game-details.html')) return;
        if (document.getElementById('mobile-dock-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'mobile-dock-wrapper';
        
        // Active page state calculations
        const path = window.location.pathname.toLowerCase();
        const search = window.location.search.toLowerCase();
        
        const isDiscover = path.includes('discover.html');
        const isDashboard = path.includes('dashboard.html');
        const isLibrary = path.includes('library.html') || (isDashboard && search.includes('view=library'));
        const isWishlist = path.includes('wishlist.html') || (isDashboard && search.includes('view=wishlist'));
        const isFavorite = path.includes('favorites.html') || (isDashboard && search.includes('view=favorites'));
        const isProfile = path.includes('profile.html') && !search.includes('user=');
        const isCatalog = isDashboard && !isLibrary && !isWishlist && !isFavorite;
        const isCollections = path.includes('collections.html');
        const isBrowseActive = isDiscover || isCatalog || isCollections;

        // Inject Styles
        const style = document.createElement('style');
        style.id = 'mobile-widget-styles';
        style.textContent = `
            .mobile-widget-dock {
                position: fixed;
                bottom: 1.25rem;
                left: 1.25rem;
                right: 1.25rem;
                height: 4.75rem;
                border-radius: 1.75rem;
                background: rgba(10, 22, 24, 0.85);
                border: 1px solid rgba(13, 242, 242, 0.2);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                display: flex;
                align-items: center;
                justify-content: space-around;
                padding: 0 0.75rem;
                z-index: 400;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255,255,255,0.06);
                transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
            }
            .mobile-widget-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #64748b;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer;
                background: transparent;
                border: none;
                outline: none;
                font-size: 0.65rem;
                font-family: 'Space Grotesk', sans-serif;
                font-weight: 700;
                gap: 3px;
                flex: 1;
                min-width: 0;
            }
            .mobile-widget-btn .material-symbols-outlined {
                font-size: 22px;
                transition: transform 0.25s ease;
            }
            .mobile-widget-btn:active .material-symbols-outlined {
                transform: scale(0.85);
            }
            .mobile-widget-btn:hover, .mobile-widget-btn.active {
                color: #0df2f2;
                text-shadow: 0 0 10px rgba(13, 242, 242, 0.45);
            }
            .mobile-widget-btn.active .material-symbols-outlined {
                font-variation-settings: 'FILL' 1;
            }
            .mobile-center-avatar-btn {
                position: relative;
                width: 3.75rem;
                height: 3.75rem;
                border-radius: 50%;
                margin-top: -1.75rem;
                background: linear-gradient(135deg, #0df2f2, #7c3aed);
                padding: 2.5px;
                box-shadow: 0 8px 24px rgba(13, 242, 242, 0.35), 0 0 0 1px rgba(255,255,255,0.05);
                cursor: pointer;
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
                z-index: 401;
            }
            .mobile-center-avatar-btn:active {
                transform: scale(0.9) translateY(-1px);
            }
            .mobile-center-avatar-btn.active {
                box-shadow: 0 0 35px rgba(13, 242, 242, 0.7);
            }
            .mobile-center-avatar-inner {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: #080f0f;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            /* Browse Dropdown Menu styling */
            .mobile-browse-dropdown {
                position: fixed;
                bottom: 6.5rem;
                left: 1.5rem;
                background: rgba(10, 22, 24, 0.95);
                border: 1px solid rgba(13, 242, 242, 0.25);
                border-radius: 1.25rem;
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                display: flex;
                flex-direction: column;
                padding: 0.5rem;
                min-width: 170px;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.8), 0 0 15px rgba(13, 242, 242, 0.1);
                z-index: 500;
                opacity: 0;
                transform: translateY(10px) scale(0.95);
                pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            .mobile-browse-dropdown.show {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: auto;
            }
            .mobile-dropdown-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 0.75rem 1rem;
                color: #94a3b8;
                font-family: 'Space Grotesk', sans-serif;
                font-weight: 700;
                font-size: 0.75rem;
                border-radius: 0.75rem;
                text-decoration: none;
                transition: all 0.2s ease;
                background: transparent;
                border: none;
                text-align: left;
                width: 100%;
                cursor: pointer;
            }
            .mobile-dropdown-item:hover, .mobile-dropdown-item.active {
                color: #0df2f2;
                background: rgba(13, 242, 242, 0.08);
                text-shadow: 0 0 8px rgba(13, 242, 242, 0.3);
            }
            .mobile-dropdown-item .material-symbols-outlined {
                font-size: 18px;
            }
            /* Hide widget on desktop */
            @media (min-width: 1280px) {
                #mobile-dock-wrapper {
                    display: none !important;
                }
            }
        `;
        document.head.appendChild(style);

        wrapper.innerHTML = `
            <!-- Dropdown Menu -->
            <div id="mobile-browse-dropdown" class="mobile-browse-dropdown">
                <button onclick="window.location.href='${_getRelativeUrl('Discover/Html/discover.html')}'" 
                    class="mobile-dropdown-item ${isDiscover ? 'active' : ''}">
                    <span class="material-symbols-outlined">explore</span>
                    <span>DISCOVER</span>
                </button>
                <button onclick="window.location.href='${_getRelativeUrl('Dashboard/Html/dashboard.html?view=catalog')}'" 
                    class="mobile-dropdown-item ${isCatalog ? 'active' : ''}">
                    <span class="material-symbols-outlined">dashboard</span>
                    <span>CATALOG</span>
                </button>
                <button onclick="window.location.href='${_getRelativeUrl('Collections/UserCollections/Html/collections.html')}'" 
                    class="mobile-dropdown-item ${isCollections ? 'active' : ''}">
                    <span class="material-symbols-outlined">folder_special</span>
                    <span>COLLECTIONS</span>
                </button>
            </div>

            <div class="mobile-widget-dock">
                <button id="mobile-browse-btn" onclick="toggleMobileBrowseDropdown(event)" 
                    class="mobile-widget-btn ${isBrowseActive ? 'active' : ''}">
                    <span class="material-symbols-outlined">explore</span>
                    <span>BROWSE</span>
                </button>
                <button onclick="window.location.href='${_getRelativeUrl('Collections/Library/Html/library.html')}'" 
                    class="mobile-widget-btn ${isLibrary ? 'active' : ''}">
                    <span class="material-symbols-outlined">stadia_controller</span>
                    <span>LIBRARY</span>
                </button>
                
                <!-- Center Avatar -->
                <div id="mobile-dock-avatar-btn" onclick="window.location.href='${_getRelativeUrl('Profile/Html/profile.html')}'" class="mobile-center-avatar-btn ${isProfile ? 'active' : ''}">
                    <div class="mobile-center-avatar-inner">
                        <img id="mobile-dock-avatar-img" src="" class="h-full w-full object-cover animate-pulse" 
                             onerror="this.src='https://ui-avatars.com/api/?name=U&background=080f0f&color=0df2f2&size=100'">
                    </div>
                </div>

                <button onclick="window.location.href='${_getRelativeUrl('Collections/Favorites/Html/favorites.html')}'" 
                    class="mobile-widget-btn ${isFavorite ? 'active' : ''}">
                    <span class="material-symbols-outlined">favorite</span>
                    <span>FAVORITE</span>
                </button>
                <button onclick="window.location.href='${_getRelativeUrl('Collections/Wishlist/Html/wishlist.html')}'" 
                    class="mobile-widget-btn ${isWishlist ? 'active' : ''}">
                    <span class="material-symbols-outlined">bookmark</span>
                    <span>WISHLIST</span>
                </button>
            </div>
        `;
        document.body.appendChild(wrapper);

        // Add dropdown toggle logic globally if not present
        if (!window.toggleMobileBrowseDropdown) {
            window.toggleMobileBrowseDropdown = function(event) {
                event.stopPropagation();
                const dropdown = document.getElementById('mobile-browse-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('show');
                }
            };

            document.addEventListener('click', (e) => {
                const dropdown = document.getElementById('mobile-browse-dropdown');
                const btn = document.getElementById('mobile-browse-btn');
                if (dropdown && !dropdown.contains(e.target) && !btn?.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });
        }

        // Fetch user avatar
        _loadMobileAvatar();
    }

    async function _loadMobileAvatar() {
        const userInfo = getUserInfo();
        const me = userInfo?.userName;
        if (!me) return;

        try {
            const pRes = await apiRequest('/api/Profile');
            if (pRes.ok) {
                const profile = await pRes.json();
                const displayName = profile.displayName || me;
                const initials = displayName.substring(0, 2).toUpperCase();
                
                const rawAvatar = profile.avatarUrl;
                let avatarUrl = '';
                if (rawAvatar) {
                    avatarUrl = (rawAvatar.startsWith('http://') || rawAvatar.startsWith('https://'))
                        ? rawAvatar
                        : `${API_URL}/Uploads/${rawAvatar}`;
                } else {
                    avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=080f0f&color=0df2f2&size=100`;
                }

                const dockAvatarImg = document.getElementById('mobile-dock-avatar-img');
                if (dockAvatarImg) {
                    dockAvatarImg.src = avatarUrl;
                    dockAvatarImg.classList.remove('animate-pulse');
                    dockAvatarImg.onerror = () => {
                        dockAvatarImg.style.display = 'none';
                        const parent = dockAvatarImg.parentElement;
                        if (parent) {
                            parent.textContent = initials;
                            parent.style.color = '#0df2f2';
                            parent.style.fontFamily = "'Xirod', sans-serif";
                            parent.style.fontSize = '12px';
                            parent.style.fontWeight = 'bold';
                        }
                    };
                }
            }
        } catch (e) {
            console.error('Mobile Widget: profile load error', e);
        }
    }

    // ── Main init ──────────────────────────────────────────────
    async function initNotificationSystem() {
        if (_initialized) return;
        _initialized = true;

        _ensureBellWidget();
        _ensureToastContainer();
        _bindOutsideClick();
        _ensureMobileWidget();
        await _loadPending();
        _connect();
    }

    // Also expose globally so profile.js can call it if needed
    window.initNotificationSystem = initNotificationSystem;

    // Auto-initialize on every page (skip login/register pages)
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof isLoggedIn === 'function' && isLoggedIn()) {
            initNotificationSystem();
        }
    });
})();
