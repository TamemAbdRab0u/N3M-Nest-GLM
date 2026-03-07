// ============================================================
// FRIENDS PAGE — friends.js
// ============================================================

const _params = new URLSearchParams(window.location.search);
const _profileUser = _params.get('user'); // whose friends we're viewing

let allFriends = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = '../../Auth/Html/login.html';
        return;
    }

    if (!_profileUser) {
        window.location.href = '../Html/profile.html';
        return;
    }

    document.title = `${_profileUser}'s Friends - N3M|Nest`;
    loadSidebarUser();
    loadProfileHeader();
    loadFriends();
});

// ── Sidebar ────────────────────────────────────────────────

function loadSidebarUser() {
    const userInfo = getUserInfo();
    const usernameEl = document.getElementById('display-username');
    const avatarEl   = document.getElementById('display-avatar');
    if (usernameEl) usernameEl.textContent = userInfo?.userName || 'User';
    if (avatarEl)   avatarEl.textContent   = userInfo?.userName ? userInfo.userName.charAt(0).toUpperCase() : 'U';

    // Fetch real avatar
    fetchSidebarAvatar();
}

async function fetchSidebarAvatar() {
    try {
        const res = await apiRequest('/api/Profile');
        if (!res.ok) return;
        const profile = await res.json();
        if (!profile.avatarUrl) return;
        const avatarEl = document.getElementById('display-avatar');
        if (!avatarEl) return;
        avatarEl.innerHTML = `<img src="${API_URL}/Uploads/${profile.avatarUrl}?t=${Date.now()}" class="h-full w-full object-cover rounded-full" onerror="this.parentElement.textContent='${(profile.displayName||'U').charAt(0).toUpperCase()}'">`;
        const parent = avatarEl.parentElement;
        if (parent?.classList.contains('bg-gradient-to-tr')) {
            parent.classList.remove('bg-gradient-to-tr', 'from-primary', 'to-purple-500');
            parent.classList.add('bg-transparent');
        }
    } catch (e) { /* sidebar stays as letter */ }
}

// ── Profile header mini ────────────────────────────────────

async function loadProfileHeader() {
    try {
        const res = await apiRequest(`/api/Profile/${encodeURIComponent(_profileUser)}`);
        if (!res.ok) return;
        const profile = await res.json();

        const usernameEl = document.getElementById('header-username');
        const avatarEl   = document.getElementById('header-avatar');

        if (usernameEl) usernameEl.textContent = profile.displayName || _profileUser;
        if (avatarEl) {
            avatarEl.src = profile.avatarUrl
                ? `${API_URL}/Uploads/${profile.avatarUrl}?t=${Date.now()}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || _profileUser)}&background=080f0f&color=0df2f2&size=80`;
        }
    } catch (e) {
        console.error('Profile header load error:', e);
    }
}

// ── Friends list ───────────────────────────────────────────

async function loadFriends() {
    try {
        const res = await apiRequest(`/api/Friendship/friends/${encodeURIComponent(_profileUser)}`);
        if (!res.ok) throw new Error('Failed to load friends');
        allFriends = await res.json();

        document.getElementById('friends-skeleton')?.classList.add('hidden');
        document.getElementById('friends-total-count').textContent = allFriends.length;

        if (allFriends.length === 0) {
            document.getElementById('friends-empty')?.classList.remove('hidden');
            return;
        }

        renderFriends(allFriends);
    } catch (e) {
        console.error('Load friends error:', e);
        document.getElementById('friends-skeleton')?.classList.add('hidden');
        document.getElementById('friends-empty')?.classList.remove('hidden');
    }
}

function renderFriends(list) {
    const grid = document.getElementById('friends-grid');
    const empty = document.getElementById('friends-empty');
    const noResults = document.getElementById('no-results');
    if (!grid) return;

    grid.classList.remove('hidden');
    empty?.classList.add('hidden');
    noResults?.classList.add('hidden');

    if (list.length === 0) {
        grid.classList.add('hidden');
        // Show no-results if searching, empty if not
        const searchVal = document.getElementById('friends-search')?.value.trim();
        if (searchVal) {
            noResults?.classList.remove('hidden');
        } else {
            empty?.classList.remove('hidden');
        }
        return;
    }

    grid.innerHTML = list.map(f => {
        const displayName = f.displayName || f.username;
        const avatarSrc = f.avatarUrl
            ? `${API_URL}/Uploads/${f.avatarUrl}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=080f0f&color=0df2f2&size=100`;
        const initial = displayName.charAt(0).toUpperCase();
        return `
        <div class="glass-panel rounded-2xl p-5 flex flex-col items-center gap-3 cursor-pointer group transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(13,242,242,0.1)]"
             onclick="window.location.href='../Html/visit-profile.html?user=${encodeURIComponent(f.username)}'">
            <div class="relative">
                <div class="h-20 w-20 rounded-full overflow-hidden border-2 border-slate-700 group-hover:border-primary transition-all shadow-lg">
                    <img src="${avatarSrc}" class="h-full w-full object-cover"
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=080f0f&color=0df2f2&size=100'">
                </div>
                <div class="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-[#0a1618] shadow"></div>
            </div>
            <div class="text-center min-w-0 w-full">
                <p class="text-sm font-bold text-slate-100 group-hover:text-primary transition-colors truncate xirod-font">${displayName}</p>
                <p class="text-[10px] text-slate-500 truncate">@${f.username}</p>
            </div>
            <div class="w-full flex justify-center">
                <span class="text-[9px] xirod-font text-slate-600 group-hover:text-primary/60 transition-colors uppercase tracking-wider flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">person</span> View Profile
                </span>
            </div>
        </div>`;
    }).join('');
}

// ── Search ─────────────────────────────────────────────────

function filterFriends() {
    const query = document.getElementById('friends-search')?.value.trim().toLowerCase();
    if (!query) {
        renderFriends(allFriends);
        return;
    }
    const filtered = allFriends.filter(f =>
        (f.username || '').toLowerCase().includes(query) ||
        (f.displayName || '').toLowerCase().includes(query)
    );
    renderFriends(filtered);
}

// ── Navigation ─────────────────────────────────────────────

function goBackToProfile() {
    window.location.href = `../Html/visit-profile.html?user=${encodeURIComponent(_profileUser)}`;
}

function logout() {
    clearAuthData();
    window.location.href = '../../Auth/Html/login.html';
}
