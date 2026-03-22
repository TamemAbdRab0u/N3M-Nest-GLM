document.addEventListener('DOMContentLoaded', async () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
        window.location.href = '../../../Auth/Html/login.html';
        return;
    }

    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const usernameElem = document.getElementById('welcome-username');
    if (usernameElem) usernameElem.textContent = userData.userName || 'Gamer';

    const avatarElem = document.getElementById('display-avatar-header');
    if (avatarElem) avatarElem.textContent = (userData.userName || 'U').charAt(0).toUpperCase();

    // Initialize Collections
    loadCollections();
});

async function loadCollections() {
    const grid = document.getElementById('collections-grid');
    const totalElem = document.getElementById('total-collections');
    if (!grid) return;

    try {
        const collections = await getCollections();
        totalElem.textContent = `${collections.length} Collections`;

        if (collections.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                    <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                        <span class="material-symbols-outlined text-4xl opacity-20">inventory_2</span>
                    </div>
                    <h4 class="text-white font-bold mb-2">No collections yet</h4>
                    <p class="text-xs text-center max-w-xs leading-relaxed mb-8">Start organizing your library by creating your first collection.</p>
                    <button onclick="showCreateModal()" class="px-6 py-2.5 rounded-xl bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:bg-kinetic-blue transition-all">
                        Create First Collection
                    </button>
                </div>`;
            return;
        }

        grid.innerHTML = collections.map(c => renderCollectionCard(c)).join('');
    } catch (err) {
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-red-400">Failed to load collections. Please try again later.</div>';
    }
}

function renderCollectionCard(c) {
    const gameCount = c.games?.length || 0;
    // We can use a few game images as a stack preview if needed, but for now just a folder icon
    return `
        <div class="collection-card group relative bg-[#0a1618]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer" 
             onclick="window.location.href='../../Library/Html/library.html?collectionId=${c.id}'">
            
            <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined text-4xl">folder_special</span>
            </div>

            <h4 class="text-white font-black text-lg mb-1 group-hover:text-primary transition-colors">${escapeHtml(c.name)}</h4>
            <p class="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mb-6">${gameCount} Games</p>

            <div class="w-full flex items-center justify-center gap-2 pt-4 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="event.stopPropagation(); window.location.href='../../Library/Html/library.html?collectionId=${c.id}'" 
                        class="h-9 px-4 rounded-lg bg-white/5 text-[9px] font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-all">
                    View
                </button>
                <button onclick="event.stopPropagation(); showDeleteConfirm(${c.id}, '${escapeHtml(c.name)}')" 
                        class="h-9 w-9 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global modal handlers
window.showCreateModal = () => {
    document.getElementById('create-modal').classList.remove('hidden');
    document.getElementById('new-col-name').focus();
};

window.hideCreateModal = () => {
    document.getElementById('create-modal').classList.add('hidden');
    document.getElementById('new-col-name').value = '';
};

window.confirmCreateCollection = async () => {
    const input = document.getElementById('new-col-name');
    const name = input.value.trim();
    if (!name) return;

    try {
        const newCol = await createCollection(name);
        if (newCol) {
            hideCreateModal();
            loadCollections();
            // Assuming showToast is available from notifications.js or auth.js
            if (typeof showToast === 'function') showToast(`Collection "${name}" created!`, 'success');
        }
    } catch (err) {
        console.error('Create collection error:', err);
    }
};

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
