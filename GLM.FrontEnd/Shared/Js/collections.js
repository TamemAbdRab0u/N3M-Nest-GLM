/* =========================================================
   Collections API Helper
   ========================================================= */

async function getCollections() {
    const res = await apiRequest('/api/Collections');
    if (!res.ok) return [];
    return await res.json();
}

async function createCollection(name) {
    const res = await apiRequest('/api/Collections', {
        method: 'POST',
        body: JSON.stringify({ name })
    });
    if (!res.ok) return null;
    return await res.json();
}

async function deleteCollection(id) {
    const res = await apiRequest(`/api/Collections/${id}`, {
        method: 'DELETE'
    });
    return res.ok;
}

async function addGameToCollection(collectionId, gameId) {
    const res = await apiRequest(`/api/Collections/${collectionId}/games/${gameId}`, {
        method: 'POST'
    });
    return res.ok;
}

async function removeGameFromCollection(collectionId, gameId) {
    const res = await apiRequest(`/api/Collections/${collectionId}/games/${gameId}`, {
        method: 'DELETE'
    });
    return res.ok;
}

async function getGameCollectionIds(gameId) {
    const res = await apiRequest(`/api/Collections/games/${gameId}/ids`);
    if (!res.ok) return [];
    return await res.json();
}
