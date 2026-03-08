const _params = new URLSearchParams(window.location.search);
const _profileUser = _params.get('user');

let allFriends = [];
let addFriendDebounce = null;
let presenceRefreshTimer = null;
let presenceConnection = null;

window.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = '../../Auth/Html/login.html';
        return;
    }

    if (!_profileUser) {
        window.location.href = '../Html/profile.html';
        return;
    }

    document.title = `${_profileUser}'s Friends - N3M|Nest`;
    wireAddFriendModal();
    loadSidebarUser();
    loadProfileHeader();
    loadFriends();
    startPresenceSync();
});

window.addEventListener('beforeunload', () => {
    if (presenceRefreshTimer) {
        clearInterval(presenceRefreshTimer);
    }
    if (presenceConnection) {
        presenceConnection.stop();
    }
});

function startPresenceSync() {
    if (presenceRefreshTimer) {
        clearInterval(presenceRefreshTimer);
    }

    // Keep online/offline indicators fresh while page stays open.
    presenceRefreshTimer = setInterval(async () => {
        try {
            const res = await apiRequest(`/api/Friendship/friends/${encodeURIComponent(_profileUser)}`);
            if (!res.ok) {
                return;
            }

            allFriends = await res.json();
            const countEl = document.getElementById('friends-total-count');
            if (countEl) {
                countEl.textContent = String(allFriends.length);
            }
            filterFriends();
        } catch (error) {
            console.error('Presence refresh failed:', error);
        }
    }, 15000);

    if (typeof signalR !== 'undefined') {
        const token = getAuthToken();
        if (token) {
            presenceConnection = new signalR.HubConnectionBuilder()
                .withUrl(`${API_URL}/notifications`, { accessTokenFactory: () => token })
                .withAutomaticReconnect()
                .build();

            // Realtime online/offline updates pushed by backend.
            presenceConnection.on('PresenceChanged', (userId, isOnline) => {
                if (!userId) {
                    return;
                }

                let changed = false;
                allFriends = allFriends.map((friend) => {
                    if (friend.userId === userId && friend.isOnline !== isOnline) {
                        changed = true;
                        return { ...friend, isOnline };
                    }

                    return friend;
                });

                if (changed) {
                    filterFriends();
                }
            });

            presenceConnection.onreconnected(async () => {
                try {
                    const res = await apiRequest(`/api/Friendship/friends/${encodeURIComponent(_profileUser)}`);
                    if (!res.ok) {
                        return;
                    }

                    allFriends = await res.json();
                    filterFriends();
                } catch (error) {
                    console.error('Presence resync failed:', error);
                }
            });

            presenceConnection.start().catch(() => {
                // Silent fallback; periodic REST refresh still updates presence.
            });
        }
    }
}

function wireAddFriendModal() {
    const openBtn = document.getElementById('open-add-friend');
    const closeBtn = document.getElementById('close-add-friend');
    const backdrop = document.getElementById('add-friend-backdrop');
    const modal = document.getElementById('add-friend-modal');
    const searchInput = document.getElementById('add-friend-search-input');

    if (openBtn) {
        openBtn.addEventListener('click', openAddFriendModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeAddFriendModal);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeAddFriendModal);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeAddFriendModal();
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(addFriendDebounce);
            addFriendDebounce = setTimeout(searchUsersForFriend, 280);
        });
    }
}

function openAddFriendModal() {
    const modal = document.getElementById('add-friend-modal');
    const searchInput = document.getElementById('add-friend-search-input');

    if (!modal || !searchInput) {
        return;
    }

    clearAddFriendFeedback();
    renderAddFriendResults([], 'Type at least 2 characters to start searching.');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    setTimeout(() => searchInput.focus(), 50);
}

function closeAddFriendModal() {
    const modal = document.getElementById('add-friend-modal');
    const searchInput = document.getElementById('add-friend-search-input');

    if (!modal) {
        return;
    }

    modal.classList.add('hidden');
    modal.classList.remove('flex');

    if (searchInput) {
        searchInput.value = '';
    }

    clearAddFriendFeedback();
    renderAddFriendResults([], '');
}

function loadSidebarUser() {
    const userInfo = getUserInfo();
    const usernameEl = document.getElementById('display-username');
    const avatarEl = document.getElementById('display-avatar');

    if (usernameEl) {
        usernameEl.textContent = userInfo?.userName || 'User';
    }

    if (avatarEl) {
        avatarEl.textContent = userInfo?.userName ? userInfo.userName.charAt(0).toUpperCase() : 'U';
    }

    fetchSidebarAvatar();
}

async function fetchSidebarAvatar() {
    try {
        const res = await apiRequest('/api/Profile');
        if (!res.ok) {
            return;
        }

        const profile = await res.json();
        if (!profile.avatarUrl) {
            return;
        }

        const avatarEl = document.getElementById('display-avatar');
        if (!avatarEl) {
            return;
        }

        const fallbackInitial = (profile.displayName || 'U').charAt(0).toUpperCase();
        avatarEl.innerHTML = `<img src="${API_URL}/Uploads/${profile.avatarUrl}?t=${Date.now()}" class="h-full w-full object-cover rounded-full" onerror="this.parentElement.textContent='${fallbackInitial}'">`;

        const parent = avatarEl.parentElement;
        if (parent && parent.classList.contains('bg-gradient-to-tr')) {
            parent.classList.remove('bg-gradient-to-tr', 'from-primary', 'to-cyan-500');
            parent.classList.add('bg-transparent');
        }
    } catch (error) {
        console.error('Sidebar avatar load failed:', error);
    }
}

async function loadProfileHeader() {
    try {
        const res = await apiRequest(`/api/Profile/${encodeURIComponent(_profileUser)}`);
        if (!res.ok) {
            return;
        }

        const profile = await res.json();
        const usernameEl = document.getElementById('header-username');
        const avatarEl = document.getElementById('header-avatar');

        if (usernameEl) {
            usernameEl.textContent = profile.displayName || _profileUser;
        }

        if (avatarEl) {
            avatarEl.src = profile.avatarUrl
                ? `${API_URL}/Uploads/${profile.avatarUrl}?t=${Date.now()}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || _profileUser)}&background=080f0f&color=0df2f2&size=80`;
        }
    } catch (error) {
        console.error('Profile header load error:', error);
    }
}

async function loadFriends() {
    try {
        const res = await apiRequest(`/api/Friendship/friends/${encodeURIComponent(_profileUser)}`);
        if (!res.ok) {
            throw new Error('Failed to load friends');
        }

        allFriends = await res.json();
        const countEl = document.getElementById('friends-total-count');
        if (countEl) {
            countEl.textContent = String(allFriends.length);
        }

        const skeleton = document.getElementById('friends-skeleton');
        if (skeleton) {
            skeleton.classList.add('hidden');
        }

        renderFriends(allFriends);
    } catch (error) {
        console.error('Load friends error:', error);

        const skeleton = document.getElementById('friends-skeleton');
        if (skeleton) {
            skeleton.classList.add('hidden');
        }

        const empty = document.getElementById('friends-empty');
        if (empty) {
            empty.classList.remove('hidden');
        }
    }
}

function renderFriends(list) {
    const listEl = document.getElementById('friends-list');
    const empty = document.getElementById('friends-empty');
    const noResults = document.getElementById('no-results');

    if (!listEl) {
        return;
    }

    listEl.classList.add('hidden');
    empty?.classList.add('hidden');
    noResults?.classList.add('hidden');

    if (list.length === 0) {
        const searchValue = document.getElementById('friends-search')?.value.trim();
        if (searchValue) {
            noResults?.classList.remove('hidden');
        } else {
            empty?.classList.remove('hidden');
        }
        listEl.innerHTML = '';
        return;
    }

    const onlineFriends = list.filter((friend) => friend.isOnline === true);
    const offlineFriends = list.filter((friend) => friend.isOnline !== true);

    const onlineSection = onlineFriends.length
        ? `
            <div class="mb-5">
                <h3 class="font-orbitron text-cyber-cyan text-xl uppercase tracking-widest mb-4 border-l-4 border-cyber-cyan pl-4">Online Friends</h3>
                <div class="space-y-4">
                    ${onlineFriends.map((friend) => renderFriendCard(friend, true)).join('')}
                </div>
            </div>
        `
        : '';

    const offlineSection = offlineFriends.length
        ? `
            <div>
                <h3 class="font-orbitron text-white/40 text-xl uppercase tracking-widest mb-4 border-l-4 border-white/10 pl-4">Offline</h3>
                <div class="space-y-4">
                    ${offlineFriends.map((friend) => renderFriendCard(friend, false)).join('')}
                </div>
            </div>
        `
        : '';

    listEl.classList.remove('hidden');
    listEl.innerHTML = `${onlineSection}${offlineSection}`;
}

function renderFriendCard(friend, isOnline) {
    const displayName = friend.displayName || friend.username;
    const avatarSrc = friend.avatarUrl
        ? `${API_URL}/Uploads/${friend.avatarUrl}`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=080f0f&color=0df2f2&size=96`;

    const statusDotClass = isOnline ? 'bg-status-online border-status-online/50' : 'bg-slate-500 border-slate-400/30';
    const cardBorderClass = isOnline ? 'border-cyber-cyan/20 hover:border-cyber-cyan/45' : 'border-white/10 hover:border-white/30';
    const secondaryLabel = isOnline ? 'Online now' : 'Offline';
    const secondaryLabelClass = isOnline ? 'text-status-online bg-status-online/10' : 'text-white/40';

    return `
        <div class="glass-panel rounded-xl p-4 sm:p-5 border ${cardBorderClass} transition-all duration-300 ${isOnline ? '' : 'opacity-65 grayscale-[0.4]'}">
            <div class="flex items-center gap-4">
                <div class="relative h-14 w-14 flex-shrink-0">
                    <div class="h-14 w-14 rounded-full overflow-hidden border ${isOnline ? 'border-status-online/80' : 'border-white/20'} p-[2px]">
                        <img src="${avatarSrc}" alt="${escapeHtml(displayName)}" class="block h-full w-full rounded-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=080f0f&color=0df2f2&size=96'">
                    </div>
                    <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ${statusDotClass} border-2 border-deep-teal"></span>
                </div>

                <div class="min-w-0 flex-1">
                    <p class="text-xl sm:text-2xl text-white font-orbitron uppercase tracking-wide truncate">${escapeHtml(displayName)}</p>
                    <p class="text-sm text-cyber-cyan/60 truncate">@${escapeHtml(friend.username || '')}</p>
                    <p class="mt-1 inline-flex px-2 py-0.5 rounded text-[11px] ${secondaryLabelClass}">${secondaryLabel}</p>
                </div>

                ${isOnline ? `
                <button
                    class="h-10 w-10 rounded-lg bg-glass-bg border border-white/10 text-cyber-cyan hover:border-cyber-cyan transition-colors flex items-center justify-center"
                    title="Invite">
                    <span class="material-symbols-outlined text-[20px]">add</span>
                </button>
                ` : ''}

                <button onclick="window.location.href='../Html/visit-profile.html?user=${encodeURIComponent(friend.username)}'"
                    class="h-10 px-4 rounded-lg bg-glass-bg border border-white/10 font-orbitron text-[10px] tracking-widest text-white/70 hover:text-white hover:border-cyber-cyan transition-colors whitespace-nowrap uppercase">
                    View Profile
                </button>
            </div>
        </div>
    `;
}

function filterFriends() {
    const query = document.getElementById('friends-search')?.value.trim().toLowerCase();
    if (!query) {
        renderFriends(allFriends);
        return;
    }

    const filtered = allFriends.filter((friend) => {
        const username = (friend.username || '').toLowerCase();
        const displayName = (friend.displayName || '').toLowerCase();
        return username.includes(query) || displayName.includes(query);
    });

    renderFriends(filtered);
}

async function searchUsersForFriend() {
    const input = document.getElementById('add-friend-search-input');
    if (!input) {
        return;
    }

    const query = input.value.trim();
    if (query.length < 2) {
        renderAddFriendResults([], 'Type at least 2 characters to start searching.');
        clearAddFriendFeedback();
        return;
    }

    try {
        renderAddFriendResults([], 'Searching users...');
        const endpoint = `/api/Profile/search/users?query=${encodeURIComponent(query)}&limit=20`;
        const res = await apiRequest(endpoint);

        if (!res.ok) {
            throw new Error('Search failed');
        }

        const users = await res.json();
        renderAddFriendResults(users, users.length ? '' : 'No users found for this search.');
        clearAddFriendFeedback();
    } catch (error) {
        console.error('User search failed:', error);
        renderAddFriendResults([], 'Search failed. Try again.');
        showAddFriendFeedback('Could not search users right now.', 'error');
    }
}

function renderAddFriendResults(users, helperText = '') {
    const container = document.getElementById('add-friend-results');
    if (!container) {
        return;
    }

    if (!users || users.length === 0) {
        container.innerHTML = helperText
            ? `<div class="rounded-xl border border-slate-700 bg-[#0b1a1d]/70 p-4 text-sm text-slate-500">${escapeHtml(helperText)}</div>`
            : '';
        return;
    }

    container.innerHTML = users.map((user) => {
        const displayName = user.displayName || user.username;
        const avatarSrc = user.avatarUrl
            ? `${API_URL}/Uploads/${user.avatarUrl}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=080f0f&color=0df2f2&size=80`;

        return `
            <div class="glass-panel rounded-xl border border-cyber-cyan/15 p-3 sm:p-4">
                <div class="flex items-center gap-3">
                    <div class="h-12 w-12 rounded-full overflow-hidden border border-cyber-cyan/30 flex-shrink-0">
                        <img src="${avatarSrc}" alt="${displayName}" class="block h-full w-full rounded-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=080f0f&color=0df2f2&size=80'">
                    </div>

                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold text-slate-100 truncate font-orbitron">${escapeHtml(displayName)}</p>
                        <p class="text-xs text-cyber-cyan/50 truncate">@${escapeHtml(user.username || '')}</p>
                    </div>

                    <div class="flex items-center gap-2">
                        <button onclick="window.location.href='../Html/visit-profile.html?user=${encodeURIComponent(user.username)}'"
                            class="h-9 px-3 rounded-lg border border-white/10 text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan transition-colors font-orbitron text-[9px] uppercase tracking-wider">
                            View
                        </button>
                        <button id="add-btn-${encodeURIComponent(user.username)}" data-username="${escapeHtml(user.username)}"
                            class="h-9 px-3 rounded-lg border border-cyber-cyan/50 text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors font-orbitron text-[9px] uppercase tracking-wider"
                            onclick="sendFriendRequest('${encodeURIComponent(user.username)}')">
                            Add
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function sendFriendRequest(encodedUsername) {
    const username = decodeURIComponent(encodedUsername);

    try {
        const res = await apiRequest(`/api/Friendship/send/${encodeURIComponent(username)}`, { method: 'POST' });
        const btn = document.querySelector(`[data-username="${cssEscape(username)}"]`);

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'Could not send request');
        }

        if (btn) {
            btn.textContent = 'Sent';
            btn.classList.remove('text-cyber-cyan', 'border-cyber-cyan/50', 'hover:bg-cyber-cyan/10');
            btn.classList.add('text-emerald-400', 'border-emerald-500/40');
            btn.disabled = true;
        }

        showAddFriendFeedback(`Friend request sent to @${username}.`, 'success');
    } catch (error) {
        console.error('Send request failed:', error);
        showAddFriendFeedback(error.message || 'Could not send friend request.', 'error');
    }
}

function showAddFriendFeedback(message, type) {
    const feedback = document.getElementById('add-friend-feedback');
    if (!feedback) {
        return;
    }

    feedback.classList.remove('hidden', 'text-emerald-400', 'text-rose-400', 'text-slate-500');
    feedback.textContent = message;

    if (type === 'success') {
        feedback.classList.add('text-emerald-400');
    } else if (type === 'error') {
        feedback.classList.add('text-rose-400');
    } else {
        feedback.classList.add('text-slate-500');
    }
}

function clearAddFriendFeedback() {
    const feedback = document.getElementById('add-friend-feedback');
    if (!feedback) {
        return;
    }

    feedback.classList.add('hidden');
    feedback.textContent = '';
}

function goBackToProfile() {
    window.location.href = `../Html/visit-profile.html?user=${encodeURIComponent(_profileUser)}`;
}

function logout() {
    clearAuthData();
    window.location.href = '../../Auth/Html/login.html';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(value);
    }

    return String(value).replace(/([ #;?%&,.+*~\':"!^$\[\]()=>|/@])/g, '\\$1');
}
