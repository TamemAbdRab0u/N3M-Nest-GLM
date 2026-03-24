/* =============================================================
   Collections Page — Two-mode in-page view
   Mode 1: collection list (default)
   Mode 2: collection detail (games inside a specific collection)
   ============================================================= */

/* ── Collection cache (avoids inline string-escaping bugs) ───── */
let _collectionsCache = {};
let _currentCollectionId = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
        window.location.href = '../../../Auth/Html/login.html';
        return;
    }
    displayUserInfo();
    loadCollections();
});

/* ── User Info ───────────────────────────────────────────────── */
async function displayUserInfo() {
    if (typeof getUserInfo !== 'function') return;

    const userInfo = getUserInfo();
    const usernameElem = document.getElementById('welcome-username');
    const avatarElem = document.getElementById('display-avatar-header');

    if (usernameElem) usernameElem.textContent = userInfo.userName || 'Gamer';
    if (avatarElem && userInfo.userName) avatarElem.textContent = userInfo.userName.charAt(0).toUpperCase();

    if (typeof apiRequest !== 'function') return;
    try {
        const res = await apiRequest('/api/Profile');
        if (!res.ok) return;
        const profile = await res.json();

        if (profile.displayName && usernameElem) usernameElem.textContent = profile.displayName;

        if (profile.avatarUrl && avatarElem) {
            const ts = Date.now();
            const fallbackChar = (profile.displayName || userInfo.userName || 'U').charAt(0).toUpperCase();
            avatarElem.innerHTML = `<img src="${API_URL}/Uploads/${profile.avatarUrl}?t=${ts}" class="h-full w-full object-cover" onerror="this.parentElement.textContent='${fallbackChar}'">`;
            const parent = avatarElem.parentElement;
            if (parent && parent.classList.contains('bg-gradient-to-tr')) {
                parent.classList.remove('bg-gradient-to-tr', 'from-primary', 'to-purple-600');
            }
        }
    } catch (e) { /* silent */ }
}

/* ── Collection List View ────────────────────────────────────── */
async function loadCollections() {
    _currentCollectionId = null;
    const grid = document.getElementById('collections-grid');
    const pageTitle = document.getElementById('page-title');
    const headerRow = document.getElementById('header-main-row');
    if (!grid) return;

    const headerDivider = document.getElementById('header-divider');
    const headerMainRow = document.getElementById('header-main-row');
    const createBtnContainer = document.querySelector('.flex.justify-center.mb-6');
    
    if (headerDivider) headerDivider.classList.remove('hidden');
    if (headerMainRow) headerMainRow.className = 'text-center mb-6';
    if (createBtnContainer) createBtnContainer.className = 'flex justify-center mb-6';
    if (pageTitle) {
        pageTitle.textContent = 'Collections';
        pageTitle.className = 'text-4xl md:text-5xl font-black text-white mb-2 tracking-tight neon-text-white uppercase italic leading-none';
    }

    const totalElem = document.getElementById('total-collections');
    if (totalElem) {
        totalElem.className = 'text-slate-500 font-bold text-xs tracking-[0.2em]';
        totalElem.innerHTML = `Managing <span id="total-val" class="text-slate-300">0</span> Digital Containers`;
    }

    hideBreadcrumb();

    grid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
            <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4 opacity-50"></div>
        </div>`;

    try {
        const collections = await getCollections();

        // Cache for safe lookup
        _collectionsCache = {};
        collections.forEach(c => { _collectionsCache[c.id] = c; });

        // Update total count in header
        const totalVal = document.getElementById('total-val');
        if (totalVal) totalVal.textContent = collections.length;

        if (collections.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                    <h4 class="text-white font-bold mb-2">No archives found</h4>
                    <p class="text-xs">Initialize your first category container to begin.</p>
                </div>`;
        } else {
            grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto pb-20';
            grid.innerHTML = collections.map(c => renderCollectionCard(c)).join('');
        }

        // Always append the "New Collection" card at the end
        grid.innerHTML += `
            <div onclick="showCreateModal()" 
                 class="collection-card group relative p-6 cursor-pointer flex flex-col items-center justify-center min-h-[340px] border-dashed border-white/5 bg-black/20">
                <div class="archive-plus-btn w-14 h-14 rounded-full flex items-center justify-center mb-6">
                    <span class="material-symbols-outlined text-[#00d2ff] text-2xl font-bold">add</span>
                </div>
                <h4 class="text-[11px] xirod-font text-white uppercase tracking-widest mb-3">New Collection</h4>
                <p class="text-[9px] text-slate-600 uppercase tracking-[0.2em] text-center px-8 leading-relaxed">
                    Initialize a new category container for your items
                </p>
            </div>`;

        // Attach click handlers
        grid.querySelectorAll('[data-id]').forEach(card => {
            const id = Number(card.dataset.id);
            const name = _collectionsCache[id]?.name || 'Archive';

            card.addEventListener('click', () => openCollection(id, name));
            card.querySelector('[data-edit-btn]')?.addEventListener('click', e => {
                e.stopPropagation();
                showEditModal(id, name);
            });
            card.querySelector('[data-delete-btn]')?.addEventListener('click', e => {
                e.stopPropagation();
                showDeleteConfirm(id, name);
            });
        });

    } catch (err) {
        console.error('loadCollections error:', err);
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-red-400">Failed to load collections.</div>';
    }
}

function renderCollectionCard(col) {
    const id = col.id;
    const name = escapeHtml(col.name);
    const games = col.games || [];
    const gameCount = games.length;

    // Build the 2x2 grid image block
    let imageGridHtml = '';
    const placeholder = `<div class="no-image-placeholder relative bg-[#152427] flex items-center justify-center">
                            <span class="material-symbols-outlined text-sm opacity-10">image_not_supported</span>
                         </div>`;

    for (let i = 0; i < 4; i++) {
        if (games[i]) {
            const g = games[i];
            const fallback = '../../../Assets/Images/logo.png';
            const rawImg = g.imgUrl || g.gameImageUrl || g.backgroundImage || '';
            const isInvalid = !rawImg || rawImg === 'null' || rawImg === 'undefined';
            const safeImg = isInvalid ? fallback : rawImg;

            // If it's the 4th slot and there are more games, add overlay
            const isLastSlotWithMore = i === 3 && gameCount > 4;
            const overlay = isLastSlotWithMore ? `
                <div class="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                    <span class="text-[14px] font-black text-[#00d2ff] tracking-tight">+${gameCount - 3}</span>
                </div>` : '';

            imageGridHtml += `
                <div class="relative overflow-hidden bg-[#152427]">
                    <img src="${safeImg}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                         onerror="this.src='${fallback}'">
                    ${overlay}
                </div>`;
        } else {
            imageGridHtml += placeholder;
        }
    }

    const updatedAt = col.updatedAt || col.createdAt || new Date().toISOString();
    const timeAgo = formatTimeAgo(updatedAt);

    return `
        <div class="collection-card group relative p-5 cursor-pointer" data-id="${id}">
            <!-- 2x2 Image Grid Area -->
            <div class="aspect-square w-full bg-[#0d1a1d] rounded-lg overflow-hidden grid grid-cols-2 gap-[2px] p-[2px] mb-6 border border-white/5 group-hover:border-transparent transition-all">
                ${imageGridHtml}
            </div>

            <!-- Header: Title & Chevron -->
            <div class="flex items-center justify-between gap-3 mb-2">
                <h4 class="text-[13px] font-bold text-white truncate uppercase xirod-font tracking-tight group-hover:text-[#00d2ff] transition-colors">${name}</h4>
                <span class="material-symbols-outlined text-[18px] text-slate-700 group-hover:text-[#00d2ff] group-hover:translate-x-0.5 transition-all">chevron_right</span>
            </div>

            <!-- Footer: Stats -->
            <p class="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em]">
                ${gameCount} GAMES <span class="mx-1">•</span> UPDATED ${timeAgo}
            </p>
            
            <!-- Management Controls Overlay (Hover) -->
            <div class="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                <button data-edit-btn 
                        class="w-9 h-9 rounded-lg bg-black/80 backdrop-blur-xl border border-white/10 text-white hover:text-[#00d2ff] hover:border-[#00d2ff]/50 transition-all flex items-center justify-center">
                    <span class="material-symbols-outlined text-base">edit</span>
                </button>
                <button data-delete-btn 
                        class="w-9 h-9 rounded-lg bg-black/80 backdrop-blur-xl border border-white/10 text-red-500/80 hover:text-red-400 hover:border-red-500/50 transition-all flex items-center justify-center">
                    <span class="material-symbols-outlined text-base">delete</span>
                </button>
            </div>
        </div>`;
}

function formatTimeAgo(dateString) {
    if (!dateString) return 'RECENTLY';

    // Normalize string to ISO/UTC format (Handles "YYYY-MM-DD HH:mm:ss" and missing Z)
    const normalized = dateString.toString().replace(' ', 'T').replace(/Z?$/, 'Z');
    const date = new Date(normalized);

    // Safety check for min-values (0001-01-01) or invalid dates
    if (isNaN(date.getTime()) || date.getFullYear() < 1950) return 'JUST NOW';

    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    // If future date or very recent (handle small clock drifts)
    if (diffInSeconds < 30) return 'JUST NOW';

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}M AGO`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}H AGO`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}D AGO`;

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}W AGO`;

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths}MO AGO`;

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}Y AGO`;
}

/* ── Collection Detail View ──────────────────────────────────── */
window.openCollection = async function (collectionId, collectionName) {
    _currentCollectionId = collectionId;
    const grid = document.getElementById('collections-grid');
    const totalElem = document.getElementById('total-collections');
    const pageTitle = document.getElementById('page-title');
    const createBtn = document.getElementById('create-collection-btn');

    if (createBtn) createBtn.classList.add('hidden');
    showBreadcrumb(collectionName);
    
    // Customize Header for Inner View
    const headerDivider = document.getElementById('header-divider');
    const headerMainRow = document.getElementById('header-main-row');
    
    if (headerDivider) headerDivider.classList.add('hidden');
    if (headerMainRow) headerMainRow.className = 'text-center mb-8 transform-gpu transition-all scale-100';
    if (pageTitle) {
        pageTitle.textContent = collectionName;
        pageTitle.className = 'text-5xl md:text-6xl font-black text-white italic tracking-tighter glow-text drop-shadow-[0_0_40px_rgba(255,255,255,0.4)] xirod-font mb-4';
    }

    const cached = _collectionsCache[collectionId];
    const games = cached?.games || [];

    if (totalElem) {
        totalElem.className = 'text-[9px] font-bold text-cyan-500/50 tracking-[0.5em] uppercase mt-2 opacity-80';
        totalElem.textContent = `${games.length} Game${games.length !== 1 ? 's' : ''}`;
    }

    if (games.length === 0) {
        grid.className = 'w-full max-w-6xl mx-auto';
        grid.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-slate-500">
                <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                    <span class="material-symbols-outlined text-4xl opacity-20">sports_esports</span>
                </div>
                <h4 class="text-white font-bold mb-2">No games in this collection</h4>
                <p class="text-xs text-center max-w-xs">Add games from the library or game details page.</p>
            </div>`;
        return;
    }

    // Single column list layout - "vertical above each other"
    grid.className = 'flex flex-col gap-4 max-w-5xl mx-auto pb-20';
    grid.innerHTML = games.map(g => renderGameCard(g)).join('');

    // Attach click handlers after render
    grid.querySelectorAll('[data-game-id]').forEach(card => {
        const gid = card.dataset.gameId;
        card.addEventListener('click', () => navigateToGame(gid));
    });
};

function renderGameCard(g) {
    const fallback = '../../../Assets/Images/logo.png';
    const rawImg = g.imgUrl || g.gameImageUrl || g.backgroundImage || '';
    const isInvalid = !rawImg || rawImg === 'null' || rawImg === 'undefined';
    const safeImg = isInvalid ? fallback : rawImg;
    const hqImg = (!isInvalid && safeImg.includes('/header.jpg'))
        ? safeImg.replace('/header.jpg', '/capsule_616x353.jpg')
        : safeImg;

    const title = escapeHtml(g.title || g.gameTitle || g.name || 'Unknown Game');
    const navId = g.externalId || g.id || '';
    const internalId = g.id || '';

    const rawRelease = g.releaseDate || g.released || '';
    let releaseYear = '';
    if (rawRelease) {
        const d = new Date(rawRelease);
        if (!isNaN(d.getTime())) releaseYear = d.getFullYear();
    }

    let genreLabel = '';
    if (g.genres && Array.isArray(g.genres) && g.genres.length > 0) {
        genreLabel = (typeof g.genres[0] === 'string' ? g.genres[0] : g.genres[0]?.name) || '';
    }

    const statusObj = getStatusObj(g.gamestatus);
    const statusBadge = statusObj
        ? `<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 w-fit">
               <span class="material-symbols-outlined text-[13px] ${statusObj.color} fill-icon">${statusObj.icon}</span>
               <span class="text-[9px] font-thin uppercase tracking-wider ${statusObj.color}">${statusObj.label}</span>
           </div>`
        : '';

    return `
        <div class="vertical-result-card group relative" data-game-id="${navId}">
            <div class="thumb-container" onclick="window.navigateToGame('${navId}')">
                <img src="${hqImg}"
                     data-fallback-src="${safeImg}"
                     alt="${title}"
                     loading="lazy"
                     class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                     onerror="if(this.src!==this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;return;}this.src='${fallback}';">
            </div>

            <div class="content-container" onclick="window.navigateToGame('${navId}')">
                <div class="flex items-center gap-3">
                    <h4 class="text-lg font-thin text-white truncate group-hover:text-primary transition-colors tracking-tight" title="${title}">${title}</h4>
                    ${releaseYear ? `<span class="bg-white/5 px-2 py-0.5 rounded text-[10px] font-thin text-slate-500 tracking-wider">${releaseYear}</span>` : ''}
                </div>
                
                <div class="flex items-center gap-4 mt-1">
                    <span class="text-[9px] text-slate-500 uppercase font-thin tracking-widest">${escapeHtml(genreLabel)}</span>
                    ${statusBadge}
                </div>
            </div>

            <div class="flex items-center gap-6 pr-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                 <button onclick="window.removeGameUI(event, '${internalId}')" 
                         class="relative z-50 p-2 rounded-lg bg-red-500/5 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center group/del"
                         title="Remove from collection">
                     <span class="material-symbols-outlined text-[18px] group-hover/del:scale-110 transition-transform">delete</span>
                 </button>
                 <div class="flex items-center gap-2 cursor-pointer" onclick="window.navigateToGame('${navId}')">
                    <span class="text-[10px] font-thin text-primary italic uppercase tracking-wider">Details</span>
                    <span class="material-symbols-outlined text-primary text-sm">arrow_forward_ios</span>
                 </div>
            </div>
        </div>`;
}



window.navigateToGame = function (gameId) {
    if (!gameId) return;
    window.location.href = `../../../GameDetails/Html/game-details.html?id=${gameId}`;
};

window.removeGameUI = async function (event, gameId) {
    if (event) event.stopPropagation();
    if (!_currentCollectionId || !gameId) return;

    // Simple visual feedback before it's gone
    const card = event.target.closest('.vertical-result-card');
    if (card) {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
    }

    try {
        const success = await removeGameFromCollection(_currentCollectionId, gameId);
        if (success) {
            if (typeof showToast === 'function') showToast('Game removed from archive', 'success');
            
            // Re-fetch current collection to update UI & cache
            const collections = await getCollections();
            _collectionsCache = {};
            collections.forEach(c => { _collectionsCache[c.id] = c; });

            const bcLabel = document.getElementById('breadcrumb-collection-name');
            const currentName = bcLabel ? bcLabel.textContent : 'Collection';
            
            openCollection(_currentCollectionId, currentName);
        } else {
            if (card) {
                card.style.opacity = '1';
                card.style.pointerEvents = 'auto';
            }
            if (typeof showToast === 'function') showToast('Failed to remove game', 'error');
        }
    } catch (err) {
        console.error('Remove game error:', err);
        if (card) {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
        }
    }
};

function getStatusObj(status) {
    if (!status) return null;
    const s = String(status).toLowerCase();
    const map = {
        'playing': { icon: 'play_circle', color: 'text-primary', label: 'Playing' },
        '1': { icon: 'play_circle', color: 'text-primary', label: 'Playing' },
        'completed': { icon: 'task_alt', color: 'text-green-500', label: 'Completed' },
        '3': { icon: 'task_alt', color: 'text-green-500', label: 'Completed' },
        'onhold': { icon: 'pause_circle', color: 'text-yellow-500', label: 'On Hold' },
        '5': { icon: 'pause_circle', color: 'text-yellow-500', label: 'On Hold' },
        'dropped': { icon: 'do_not_disturb_on', color: 'text-red-400', label: 'Dropped' },
        '4': { icon: 'do_not_disturb_on', color: 'text-red-400', label: 'Dropped' },
        'pending': { icon: 'schedule', color: 'text-slate-400', label: 'Pending' },
        '6': { icon: 'schedule', color: 'text-slate-400', label: 'Pending' },
    };
    return map[s] || null;
}

/* ── Breadcrumb ──────────────────────────────────────────────── */
function showBreadcrumb(collectionName) {
    const bc = document.getElementById('breadcrumb');
    const bcLabel = document.getElementById('breadcrumb-collection-name');
    if (bc) bc.classList.remove('hidden');
    if (bcLabel) bcLabel.textContent = collectionName;
}

function hideBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    const createBtn = document.getElementById('create-collection-btn');
    if (bc) bc.classList.add('hidden');
    if (createBtn) createBtn.classList.remove('hidden');
}

window.backToCollections = function () {
    loadCollections();
};

/* ── Utilities ───────────────────────────────────────────────── */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ── Create Modal ────────────────────────────────────────────── */
window.showCreateModal = () => {
    document.getElementById('edit-title').textContent = 'New Collection';
    document.getElementById('edit-confirm-btn').textContent = 'Create Collection';
    document.getElementById('col-name-input').value = '';

    // Set operation mode
    document.getElementById('edit-modal').dataset.mode = 'create';

    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('col-name-input').focus();
};

/* ── Edit Modal ──────────────────────────────────────────────── */
let _editingCollectionId = null;

window.showEditModal = (id, name) => {
    _editingCollectionId = id;
    document.getElementById('edit-title').textContent = 'Rename Collection';
    document.getElementById('edit-confirm-btn').textContent = 'Save Changes';
    document.getElementById('col-name-input').value = name;

    // Set operation mode
    document.getElementById('edit-modal').dataset.mode = 'edit';

    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('col-name-input').focus();
};

window.hideEditModal = () => {
    document.getElementById('edit-modal').classList.add('hidden');
    _editingCollectionId = null;
};

window.handleConfirmAction = async () => {
    const input = document.getElementById('col-name-input');
    const name = input.value.trim();
    if (!name) return;

    const mode = document.getElementById('edit-modal').dataset.mode;

    try {
        if (mode === 'create') {
            const newCol = await createCollection(name);
            if (newCol) {
                hideEditModal();
                loadCollections();
                if (typeof showToast === 'function') showToast(`Collection "${name}" created!`, 'success');
            }
        } else {
            const success = await updateCollection(_editingCollectionId, name);
            if (success) {
                hideEditModal();
                loadCollections();
                if (typeof showToast === 'function') showToast('Collection renamed!', 'success');
            }
        }
    } catch (err) {
        console.error('Collection action error:', err);
    }
};

/* ── Delete Modal ────────────────────────────────────────────── */
let collectionToDelete = null;

window.showDeleteConfirm = (id, name) => {
    collectionToDelete = id;
    document.getElementById('confirm-modal').classList.remove('hidden');
};

window.hideConfirmModal = () => {
    collectionToDelete = null;
    document.getElementById('confirm-modal').classList.add('hidden');
};

document.getElementById('confirm-delete-btn')?.addEventListener('click', async () => {
    if (!collectionToDelete) return;
    try {
        const success = await deleteCollection(collectionToDelete);
        if (success) {
            hideConfirmModal();
            loadCollections();
            if (typeof showToast === 'function') showToast('Collection deleted', 'success');
        }
    } catch (err) {
        console.error('Delete collection error:', err);
    }
});
