// ──────────────────────────────────────────────────────────────────────────
// N3M|Nest — Community Chat  (community.js)
// Requires: auth.js (for API_URL, getAuthToken, isLoggedIn, getUserInfo, logout)
//           @microsoft/signalr (loaded via CDN)
// ──────────────────────────────────────────────────────────────────────────

let connection = null;
let onlineUsers = {};        // { username: { username, connectedAt } }
let totalMessages = 0;
let currentUser = '';
let typingTimer = null;
let isTyping = false;

// ── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = '../../Auth/Html/login.html';
        return;
    }

    const info = getUserInfo();
    currentUser = info.userName || 'User';

    // Header & Sidebar display
    const usernameEls = document.querySelectorAll('#sidebar-username, #welcome-username');
    usernameEls.forEach(el => el.textContent = currentUser);

    const avatars = document.querySelectorAll('#sidebar-avatar, #display-avatar-header');
    avatars.forEach(av => {
        if (av) {
            const initial = currentUser.charAt(0).toUpperCase();
            av.innerHTML = `<span class="text-sm font-bold text-white uppercase">${initial}</span>`;
        }
    });

    loadAvatar();
    loadHistory();
    buildConnection();
    setupInput();
});

// ── Avatar from profile API ─────────────────────────────────────────────────
async function loadAvatar() {
    try {
        const res = await apiRequest('/api/Profile');
        if (!res.ok) return;
        const profile = await res.json();
        if (profile.avatarUrl) {
            const avatars = document.querySelectorAll('#sidebar-avatar, #display-avatar-header');
            avatars.forEach(av => {
                if (av) {
                    av.innerHTML = `<img src="${API_URL}/Uploads/${profile.avatarUrl}" class="h-full w-full object-cover" onerror="this.parentElement.textContent='${currentUser.charAt(0).toUpperCase()}'">`;
                }
            });

            // Remove gradient for header avatar
            const headerAvatar = document.getElementById('display-avatar-header');
            if (headerAvatar) {
                const parent = headerAvatar.parentElement;
                if (parent && (parent.classList.contains('bg-gradient-to-tr') || parent.classList.contains('from-primary'))) {
                    parent.classList.remove('bg-gradient-to-tr', 'from-primary', 'to-purple-600');
                    parent.classList.add('bg-transparent');
                }
            }
        }
    } catch { /* silent */ }
}

// ── Load chat history via REST ──────────────────────────────────────────────
async function loadHistory() {
    try {
        const res = await apiRequest('/api/Community/History');
        if (!res.ok) throw new Error('Failed to fetch history');
        const messages = await res.json();

        const container = document.getElementById('messages-container');
        const loading = document.getElementById('chat-loading');
        if (loading) loading.remove();

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full gap-3 text-slate-700">
                    <span class="material-symbols-outlined text-5xl opacity-30">chat_bubble_outline</span>
                    <p class="text-xs xirod-font tracking-widest uppercase">No messages yet. Be the first!</p>
                </div>`;
            return;
        }

        let lastDate = null;
        messages.forEach(msg => {
            const msgDate = new Date(msg.sentAt.replace(/Z?$/, 'Z'));
            const dateKey = msgDate.toLocaleDateString();
            if (dateKey !== lastDate) {
                appendDateSeparator(container, msgDate);
                lastDate = dateKey;
            }
            appendMessage(container, msg.senderName, msg.content, msg.sentAt, false);
        });

        totalMessages = messages.length;
        document.getElementById('stat-messages').textContent = totalMessages;
        scrollToBottom(false);
    } catch (err) {
        console.error('History load error:', err);
    }
}

// ── Build SignalR connection ─────────────────────────────────────────────────
function buildConnection() {
    const token = getAuthToken();

    connection = new signalR.HubConnectionBuilder()
        .withUrl(`${API_URL}/chat`, {
            accessTokenFactory: () => token
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

    // ── Incoming Events ────────────────────────────────────────────────────
    connection.on('ReceiveMessage', (senderName, content, sentAt) => {
        const container = document.getElementById('messages-container');
        // Remove "no messages" placeholder if still there
        const placeholder = container.querySelector('.h-full');
        if (placeholder) placeholder.remove();

        appendMessage(container, senderName, content, sentAt, true);
        totalMessages++;
        document.getElementById('stat-messages').textContent = totalMessages;
        scrollToBottom(true);
    });

    connection.on('UserJoined', (username) => {
        onlineUsers[username] = { username, connectedAt: new Date() };
        renderOnlineUsers();
        appendSystemMessage(`${username} joined the chat`);
    });

    connection.on('UserLeft', (username) => {
        delete onlineUsers[username];
        renderOnlineUsers();
        appendSystemMessage(`${username} left the chat`);
    });

    connection.on('OnlineUsers', (users) => {
        onlineUsers = {};
        users.forEach(u => { onlineUsers[u] = { username: u, connectedAt: new Date() }; });
        renderOnlineUsers();
    });

    connection.on('UserTyping', (username) => {
        if (username === currentUser) return;
        const el = document.getElementById('typing-indicator');
        const txt = document.getElementById('typing-text');
        if (el && txt) {
            txt.textContent = `${username} is typing…`;
            el.classList.remove('hidden');
            clearTimeout(window._typeHideTimer);
            window._typeHideTimer = setTimeout(() => el.classList.add('hidden'), 2500);
        }
    });

    // ── Lifecycle ──────────────────────────────────────────────────────────
    connection.onreconnecting(() => setConnStatus('loading', 'Reconnecting…'));
    connection.onreconnected(() => setConnStatus('online', 'Connected'));
    connection.onclose(err => {
        setConnStatus('offline', 'Disconnected');
        if (err) console.error('Connection closed with error:', err);
    });

    startConnection();
}

async function startConnection() {
    setConnStatus('loading', 'Connecting…');
    try {
        await connection.start();
        setConnStatus('online', 'Connected');
    } catch (err) {
        setConnStatus('offline', 'Offline');
        console.error('SignalR connection error:', err);
        setTimeout(startConnection, 5000);
    }
}

// ── Send message ────────────────────────────────────────────────────────────
async function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;
    if (connection.state !== signalR.HubConnectionState.Connected) return;

    input.value = '';
    updateCharCount('');
    resizeTextarea(input);

    try {
        await connection.invoke('SendMessage', text);
    } catch (err) {
        console.error('Send error:', err);
    }
}

// ── Input Setup ─────────────────────────────────────────────────────────────
function setupInput() {
    const input = document.getElementById('message-input');

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    input.addEventListener('input', () => {
        resizeTextarea(input);
        updateCharCount(input.value);
        notifyTyping();
    });
}

function resizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
}

function updateCharCount(val) {
    const el = document.getElementById('char-count');
    if (el) {
        el.textContent = `${val.length}/500`;
        el.classList.toggle('text-red-400', val.length > 480);
    }
}

async function notifyTyping() {
    if (!isTyping && connection?.state === signalR.HubConnectionState.Connected) {
        isTyping = true;
        try { await connection.invoke('Typing'); } catch { /* silent */ }
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { isTyping = false; }, 2000);
}

// ── DOM helpers ─────────────────────────────────────────────────────────────
function appendMessage(container, senderName, content, sentAt, animate) {
    const isOwn = senderName === currentUser;
    const time = formatTime(sentAt);
    const initial = (senderName || '?').charAt(0).toUpperCase();
    const avatarColor = stringToColor(senderName);
    const profileUrl = `../../Profile/Html/profile.html?user=${encodeURIComponent(senderName)}`;
    const avatarTag = isOwn
        ? `<div class="size-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black text-white shadow-md select-none mt-0.5"
             style="background: ${avatarColor}; box-shadow: 0 0 12px ${avatarColor}40">${initial}</div>`
        : `<a href="${profileUrl}" class="size-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black text-white shadow-md select-none mt-0.5 hover:ring-2 hover:ring-primary/40 transition-all"
             style="background: ${avatarColor}; box-shadow: 0 0 12px ${avatarColor}40">${initial}</a>`;
    const nameTag = isOwn
        ? `<span class="text-[11px] font-bold text-primary">${escapeHtml(senderName)}</span>`
        : `<a href="${profileUrl}" class="text-[11px] font-bold text-slate-300 hover:text-primary transition-colors">${escapeHtml(senderName)}</a>`;

    const wrap = document.createElement('div');
    wrap.className = `msg-bubble flex items-start gap-3 px-2 py-1.5 rounded-xl group hover:bg-white/[0.02] transition-colors ${animate ? '' : ''} ${isOwn ? 'msg-own' : ''}`;

    wrap.innerHTML = `
        ${avatarTag}
        <div class="flex-1 min-w-0 msg-content">
            <div class="flex items-baseline gap-2 mb-0.5">
                ${nameTag}
                <span class="text-[9px] text-slate-600 tabular-nums">${time}</span>
            </div>
            <p class="text-sm text-slate-300 leading-relaxed break-words whitespace-pre-wrap">${escapeHtml(content)}</p>
        </div>`;

    container.appendChild(wrap);
}

function appendDateSeparator(container, date) {
    const sep = document.createElement('div');
    sep.className = 'msg-separator';
    sep.textContent = formatDate(date);
    container.appendChild(sep);
}

function appendSystemMessage(text) {
    const container = document.getElementById('messages-container');
    const el = document.createElement('div');
    el.className = 'text-center text-[9px] xirod-font text-slate-600 py-1';
    el.textContent = text;
    container.appendChild(el);
    scrollToBottom(true);
}

function renderOnlineUsers() {
    const list = document.getElementById('online-users-list');
    const count = Object.keys(onlineUsers).length;
    document.getElementById('stat-online').textContent = count;
    document.getElementById('online-count-label').textContent = `${count} member${count !== 1 ? 's' : ''} online`;

    list.innerHTML = Object.values(onlineUsers).map((u, i) => {
        const isMe = u.username === currentUser;
        const initial = u.username.charAt(0).toUpperCase();
        const color = stringToColor(u.username);
        return `
        <div class="online-user-row flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors ${isMe ? 'border border-primary/10 bg-primary/5' : ''}"
             style="animation-delay:${i * 40}ms">
            <div class="relative flex-shrink-0">
                <div class="size-8 rounded-full flex items-center justify-center text-xs font-black text-white"
                     style="background:${color};">
                    ${initial}
                </div>
                <span class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2 border-[#090f10]"></span>
            </div>
            <div class="min-w-0">
                <p class="text-xs font-bold text-slate-300 truncate ${isMe ? 'text-primary' : ''}">${escapeHtml(u.username)}${isMe ? ' (you)' : ''}</p>
            </div>
        </div>`;
    }).join('');
}

// ── Connection status badge ──────────────────────────────────────────────────
function setConnStatus(state, label) {
    const badge = document.getElementById('conn-status-badge');
    const lbl = document.getElementById('conn-label');
    if (!badge || !lbl) return;
    badge.className = `ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] xirod-font conn-${state}`;
    lbl.textContent = label;
}

// ── Scroll to bottom ─────────────────────────────────────────────────────────
function scrollToBottom(smooth) {
    const c = document.getElementById('messages-container');
    if (!c) return;
    c.scrollTo({ top: c.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

// ── Utility Helpers ──────────────────────────────────────────────────────────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(String(dateStr).replace(/Z?$/, 'Z'));
    if (isNaN(d)) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function stringToColor(str) {
    // Deterministic pastel-accent color from string
    const palette = [
        '#0df2f2', '#a855f7', '#f87171', '#34d399', '#facc15',
        '#38bdf8', '#fb923c', '#c084fc', '#4ade80', '#f472b6'
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}
