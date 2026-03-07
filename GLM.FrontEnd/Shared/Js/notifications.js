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
    let _initialized     = false;

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
        wrapper.id        = 'notif-wrapper';
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
        div.id        = 'notif-toast-container';
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
                FriendshipId:    d.friendshipId,
                FromUserId:      d.userId,
                FromUsername:    d.username,
                FromDisplayName: d.displayName,
                FromAvatarUrl:   d.avatarUrl
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
                    FriendshipId:    notification.friendshipId,
                    FromUserId:      notification.fromUserId,
                    FromUsername:    notification.fromUsername,
                    FromDisplayName: notification.fromDisplayName,
                    FromAvatarUrl:   notification.fromAvatarUrl
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
        const list     = document.getElementById('notif-list');
        const empty    = document.getElementById('notif-empty');
        const badge    = document.getElementById('notif-badge');
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
                ? `${API_URL}/Uploads/${req.FromAvatarUrl}`
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
            ? `${API_URL}/Uploads/${notification.fromAvatarUrl}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=080f0f&color=0df2f2&size=60`;

        const isReceived  = type === 'received';
        const borderColor = isReceived ? 'border-primary/40'     : 'border-emerald-500/40';
        const iconColor   = isReceived ? 'text-primary'          : 'text-emerald-400';
        const icon        = isReceived ? 'person_add'            : 'how_to_reg';
        const label       = isReceived ? 'Friend Request'        : 'Request Accepted';
        const sub         = isReceived
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

    // ── Main init ──────────────────────────────────────────────
    async function initNotificationSystem() {
        if (_initialized) return;
        _initialized = true;

        _ensureBellWidget();
        _ensureToastContainer();
        _bindOutsideClick();
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
