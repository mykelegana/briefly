const form = document.querySelector('#chat-form');
const input = document.querySelector('#input');
const chat = document.querySelector('#chat');
const sendBtn = document.querySelector('#send-btn');
const sidebar = document.querySelector('#sidebar');
const sessionsList = document.querySelector('#sessions-list');
const statSessions = document.querySelector('#stat-sessions');
const statSaved = document.querySelector('#stat-saved');

const API = 'http://localhost:3000';
const EXTRACT_URL = `${API}/extract`;
const HANDOFF_URL = `${API}/handoff/generate`;
const SESSION_URL = `${API}/sessions`;

const TOKEN_KEY = 'briefly_session_token';
const CHAT_KEY = 'briefly_chat_history';

// ── Active session state ──────────────────────────────────────────────────────
let activeSessionId = null;
let activeSessionName = null;
let allSessions = [];

// ── Token ─────────────────────────────────────────────────────────────────────

function getToken() {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) { t = crypto.randomUUID(); localStorage.setItem(TOKEN_KEY, t); }
    return t;
}

function makeHeaders(withBody = false) {
    const h = { 'x-session-token': getToken() };
    if (withBody) h['Content-Type'] = 'application/json';
    return h;
}

function extractToken(res) {
    const t = res.headers.get('x-session-token');
    if (t) localStorage.setItem(TOKEN_KEY, t);
}

// ── Chat persistence ──────────────────────────────────────────────────────────

function getChatHistory() {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); }
    catch { return []; }
}

function appendChatHistory(entry) {
    const h = getChatHistory();
    h.push(entry);
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(h)); } catch { }
}

function restoreChat() {
    const history = getChatHistory();
    if (!history.length) return;
    chat.innerHTML = '';
    history.forEach((e) => {
        if (e.type === 'user') renderMsg(e.text, 'user', false);
        else if (e.type === 'ai') renderMsg(e.text, 'ai', false);
        else if (e.type === 'handoff') renderReceipt(e.text, false);
    });
    scrollBottom();
}

// ── Sidebar collapse / expand ─────────────────────────────────────────────────

const collapsedLogo = document.querySelector('#rail-collapsed-logo');

function closeSidebar() {
    sidebar.classList.add('hidden');
    collapsedLogo.classList.add('visible');
}

function openSidebar() {
    sidebar.classList.remove('hidden');
    collapsedLogo.classList.remove('visible');
}

document.querySelector('#sidebar-toggle').addEventListener('click', closeSidebar);
document.querySelector('#sidebar-toggle-open').addEventListener('click', openSidebar);
collapsedLogo.addEventListener('click', openSidebar);

// ── New context ───────────────────────────────────────────────────────────────

document.querySelector('#btn-new-context').addEventListener('click', () => {
    // Clear chat and history — start fresh
    chat.innerHTML = '';
    try { localStorage.removeItem(CHAT_KEY); } catch { }
    setActiveSession(null, null);
    // Show welcome screen again
    const welcome = document.createElement('div');
    welcome.className = 'feed-welcome';
    welcome.innerHTML = `
    <div class="welcome-icon"><i class="fa-regular fa-comments"></i></div>
    <h2>Continue your AI conversation anywhere</h2>
    <p>Paste a conversation that hit a context limit below. Briefly extracts the key context and generates a handoff prompt you can drop into any AI tool — without re-explaining your entire project.</p>
    <div class="welcome-steps">
      <div class="step"><span class="step-n">1</span><span>Paste your capped AI conversation</span></div>
      <div class="step"><span class="step-n">2</span><span>Briefly extracts context and state</span></div>
      <div class="step"><span class="step-n">3</span><span>Copy the handoff prompt and continue</span></div>
    </div>`;
    chat.appendChild(welcome);
    document.querySelectorAll('.session-row').forEach(el => el.classList.remove('active'));
    input.focus();
});

// ── Topbar session title ──────────────────────────────────────────────────────

const topbarBrand = document.querySelector('#topbar-brand');
const topbarSessionTitle = document.querySelector('#topbar-session-title');
const topbarSessionName = document.querySelector('#topbar-session-name');
const topbarDropdown = document.querySelector('#topbar-dropdown');
const topbarMenuBtn = document.querySelector('#topbar-session-menu-btn');

function setActiveSession(id, name) {
    activeSessionId = id;
    activeSessionName = name;

    if (id) {
        topbarBrand.classList.add('hidden');
        topbarSessionTitle.classList.add('visible');
        topbarSessionName.textContent = name || 'Session';
    } else {
        topbarBrand.classList.remove('hidden');
        topbarSessionTitle.classList.remove('visible');
        topbarDropdown.classList.remove('open');
    }
}

topbarMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    topbarDropdown.classList.toggle('open');
});

document.querySelector('#topbar-rename').addEventListener('click', () => {
    topbarDropdown.classList.remove('open');
    if (activeSessionId) openRenameModal(activeSessionId, activeSessionName);
});

document.querySelector('#topbar-delete').addEventListener('click', () => {
    topbarDropdown.classList.remove('open');
    if (activeSessionId) openDeleteModal(activeSessionId);
});

// ── Rename modal ──────────────────────────────────────────────────────────────

const renameOverlay = document.querySelector('#rename-overlay');
const renameInput = document.querySelector('#rename-input');
const renameConfirm = document.querySelector('#rename-confirm');
let renamingId = null;

function openRenameModal(id, currentName) {
    renamingId = id;
    renameInput.value = currentName || '';
    renameOverlay.classList.add('open');
    setTimeout(() => { renameInput.focus(); renameInput.select(); }, 50);
}

function closeRenameModal() {
    renameOverlay.classList.remove('open');
    renamingId = null;
}

document.querySelector('#rename-cancel').addEventListener('click', closeRenameModal);
document.querySelector('#rename-cancel-x').addEventListener('click', closeRenameModal);

renameConfirm.addEventListener('click', async () => {
    const newName = renameInput.value.trim();
    if (!newName || !renamingId) return;
    await doRenameSession(renamingId, newName);
    closeRenameModal();
});

renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') renameConfirm.click();
    if (e.key === 'Escape') closeRenameModal();
});

async function doRenameSession(id, newName) {
    // Optimistic UI update
    const row = document.querySelector(`.session-row[data-id="${id}"]`);
    if (row) {
        const titleEl = row.querySelector('.session-row-title');
        if (titleEl) titleEl.textContent = newName;
    }
    if (activeSessionId === id) {
        activeSessionName = newName;
        topbarSessionName.textContent = newName;
    }
    // Update in allSessions
    const s = allSessions.find(s => String(s.id) === String(id));
    if (s) s._name = newName;

    // NOTE: backend rename endpoint not yet implemented — update locally only
    // When backend supports PATCH /sessions/:id, call it here
    console.log('Renamed session', id, 'to', newName);
}

// ── Delete modal ──────────────────────────────────────────────────────────────

const deleteOverlay = document.querySelector('#delete-overlay');
const deleteConfirm = document.querySelector('#delete-confirm');
let deletingId = null;

function openDeleteModal(id) {
    deletingId = id;
    deleteOverlay.classList.add('open');
}

function closeDeleteModal() {
    deleteOverlay.classList.remove('open');
    deletingId = null;
}

document.querySelector('#delete-cancel').addEventListener('click', closeDeleteModal);
document.querySelector('#delete-cancel-x').addEventListener('click', closeDeleteModal);

deleteConfirm.addEventListener('click', async () => {
    if (!deletingId) return;
    await doDeleteSession(deletingId);
    closeDeleteModal();
});

async function doDeleteSession(id) {
    try {
        const res = await fetch(`${SESSION_URL}/${id}`, {
            method: 'DELETE',
            headers: makeHeaders(),
        });
        extractToken(res);
    } catch (err) {
        console.warn('Delete failed:', err);
    }

    // Remove row from sidebar
    const row = document.querySelector(`.session-row[data-id="${id}"]`);
    if (row) row.remove();

    // If deleted session was active, go back to blank state
    if (activeSessionId === String(id) || activeSessionId === id) {
        chat.innerHTML = '';
        try { localStorage.removeItem(CHAT_KEY); } catch { }
        setActiveSession(null, null);
    }

    // Reload sessions to update stats
    loadSessions();
}

// ── Close dropdowns when clicking outside ─────────────────────────────────────

document.addEventListener('click', (e) => {
    // Close topbar dropdown
    if (!topbarMenuBtn.contains(e.target) && !topbarDropdown.contains(e.target)) {
        topbarDropdown.classList.remove('open');
    }
    // Close any open session row dropdowns
    document.querySelectorAll('.session-row-dropdown.open').forEach(dd => {
        dd.classList.remove('open');
    });
    // Close modals on overlay click
    if (e.target === renameOverlay) closeRenameModal();
    if (e.target === deleteOverlay) closeDeleteModal();
});

// ── Init ──────────────────────────────────────────────────────────────────────

restoreChat();
loadSessions();

// ── Sessions ──────────────────────────────────────────────────────────────────

async function loadSessions() {
    try {
        const res = await fetch(SESSION_URL, { headers: makeHeaders() });
        extractToken(res);
        if (!res.ok) return;
        const sessions = await res.json();
        allSessions = sessions;
        renderSessions(sessions);
    } catch (err) {
        console.warn('loadSessions:', err);
    }
}

function renderSessions(sessions) {
    if (!sessions?.length) {
        sessionsList.innerHTML = '<div class="session-nav-empty">No sessions yet. Paste a conversation to start.</div>';
        statSessions.textContent = '0';
        statSaved.textContent = '0';
        return;
    }

    statSessions.textContent = sessions.length;
    sessionsList.innerHTML = '';

    let totalIn = 0, totalOut = 0;

    sessions.forEach((s) => {
        const ctx = s.context ?? {};
        const problem = s._name || ctx.problem || ctx.conversationSummary || 'Session';
        const date = fmtDate(s.createdAt);
        const inT = s.rawInput ? Math.round(s.rawInput.length / 4) : 0;
        const outT = s.handoff ? Math.round(s.handoff.length / 4)
            : Math.round(JSON.stringify(ctx).length / 4);
        totalIn += inT;
        totalOut += outT;
        const pct = inT > 0 ? Math.max(0, Math.round((1 - outT / inT) * 100)) : 0;
        const row = buildRow(s.id, problem, date, inT, outT, pct);
        // Re-apply active state if this was the active session
        if (String(s.id) === String(activeSessionId)) row.classList.add('active');
        sessionsList.appendChild(row);
    });

    const saved = Math.max(0, totalIn - totalOut);
    statSaved.textContent = saved > 1000 ? `${(saved / 1000).toFixed(1)}k` : String(saved);
}

function buildRow(id, problem, date, inT, outT, pct) {
    const row = document.createElement('div');
    row.className = 'session-row';
    row.dataset.id = id;

    // Click body to load session
    row.addEventListener('click', (e) => {
        if (e.target.closest('.session-row-ellipsis') || e.target.closest('.session-row-dropdown')) return;
        loadSession(id, row, problem);
    });

    // Donut
    const donutWrap = document.createElement('div');
    donutWrap.className = 'session-row-donut';
    donutWrap.appendChild(buildDonut(pct, 34));

    // Body
    const body = document.createElement('div');
    body.className = 'session-row-body';

    const title = document.createElement('div');
    title.className = 'session-row-title';
    title.textContent = problem;

    const meta = document.createElement('div');
    meta.className = 'session-row-meta';

    const sav = document.createElement('span');
    sav.className = 'session-row-savings';
    sav.textContent = `${pct}% saved`;

    const dt = document.createElement('span');
    dt.className = 'session-row-date';
    dt.textContent = date;

    meta.appendChild(sav);
    meta.appendChild(dt);

    const bars = document.createElement('div');
    bars.className = 'bar-mini-wrap';
    bars.appendChild(buildBarMini('Input', inT, inT, 'in'));
    bars.appendChild(buildBarMini('Output', outT, inT, 'out'));

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(bars);

    // Ellipsis button
    const ellipsis = document.createElement('button');
    ellipsis.className = 'session-row-ellipsis';
    ellipsis.title = 'Session options';
    ellipsis.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';

    // Row dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'session-row-dropdown';
    dropdown.innerHTML = `
    <button class="session-row-dropdown-item" data-action="rename">
      <i class="fa-regular fa-pen-to-square"></i> Rename
    </button>
    <div class="session-row-dropdown-divider"></div>
    <button class="session-row-dropdown-item danger" data-action="delete">
      <i class="fa-regular fa-trash-can"></i> Delete
    </button>`;

    ellipsis.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close all other dropdowns first
        document.querySelectorAll('.session-row-dropdown.open').forEach(dd => dd.classList.remove('open'));
        dropdown.classList.toggle('open');
    });

    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'rename') {
            dropdown.classList.remove('open');
            openRenameModal(id, title.textContent);
        } else if (action === 'delete') {
            dropdown.classList.remove('open');
            openDeleteModal(id);
        }
    });

    row.appendChild(donutWrap);
    row.appendChild(body);
    row.appendChild(ellipsis);
    row.appendChild(dropdown);
    return row;
}

async function loadSession(id, rowEl, name) {
    document.querySelectorAll('.session-row').forEach(el => el.classList.remove('active'));
    rowEl.classList.add('active');
    setActiveSession(id, name);

    try {
        const res = await fetch(`${SESSION_URL}/${id}`, { headers: makeHeaders() });
        extractToken(res);
        if (!res.ok) return;
        const session = await res.json();

        chat.innerHTML = '';
        if (session.rawInput) renderMsg(session.rawInput, 'user', false);
        if (session.handoff) renderReceipt(session.handoff, false);
        scrollBottom();
    } catch (err) {
        console.warn('loadSession:', err);
    }
}

// ── Submit ────────────────────────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    document.querySelectorAll('.session-row').forEach(el => el.classList.remove('active'));
    setActiveSession(null, null);

    renderMsg(text, 'user', true);
    appendChatHistory({ type: 'user', text });

    input.value = '';
    input.style.height = 'auto';
    setLoading(true);

    const loading = renderLoading('Extracting context');

    try {
        const extractRes = await fetch(EXTRACT_URL, {
            method: 'POST',
            headers: makeHeaders(true),
            body: JSON.stringify({ text }),
        });
        extractToken(extractRes);

        if (!extractRes.ok) {
            const err = await extractRes.json();
            throw new Error(err.message ?? 'Extraction failed.');
        }

        const context = await extractRes.json();
        const lt = loading.querySelector('.loading-text');
        if (lt) lt.textContent = 'Generating handoff';

        const handoffRes = await fetch(HANDOFF_URL, {
            method: 'POST',
            headers: makeHeaders(true),
            body: JSON.stringify(context),
        });
        extractToken(handoffRes);

        if (!handoffRes.ok) {
            const err = await handoffRes.json();
            throw new Error(err.message ?? 'Handoff generation failed.');
        }

        let handoff = await handoffRes.text();
        if (handoff.startsWith('"')) handoff = JSON.parse(handoff);

        loading.remove();
        renderReceipt(handoff, true);
        appendChatHistory({ type: 'handoff', text: handoff });

        saveSession(text, context, handoff)
            .then((saved) => {
                // Auto-set topbar to new session name
                const ctx = context ?? {};
                const name = ctx.problem || ctx.conversationSummary || 'New session';
                setActiveSession(saved?.id, name);
                loadSessions();
            })
            .catch((err) => console.error('saveSession:', err));

    } catch (err) {
        loading.remove();
        const msg = `Something went wrong: ${err.message}`;
        renderMsg(msg, 'ai', true);
        appendChatHistory({ type: 'ai', text: msg });
        console.error(err);
    } finally {
        setLoading(false);
    }
});

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveSession(rawInput, context, handoffOutput) {
    const res = await fetch(SESSION_URL, {
        method: 'POST',
        headers: makeHeaders(true),
        body: JSON.stringify({ rawInput, context, handoffOutput }),
    });
    extractToken(res);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err.message ?? 'Session save failed');
    }
    return res.json();
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderMsg(text, type, save) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${type}`;
    if (type === 'ai') {
        const label = document.createElement('span');
        label.className = 'msg-label';
        label.textContent = 'Briefly';
        wrap.appendChild(label);
    }
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    chat.appendChild(wrap);
    if (save) scrollBottom();
    return wrap;
}

function renderLoading(text) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ai';
    const label = document.createElement('span');
    label.className = 'msg-label';
    label.textContent = 'Briefly';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    const span = document.createElement('span');
    span.className = 'loading-text loading-dots';
    span.textContent = text;
    bubble.appendChild(span);
    wrap.appendChild(label);
    wrap.appendChild(bubble);
    chat.appendChild(wrap);
    scrollBottom();
    return wrap;
}

function renderReceipt(handoff, save) {
    const card = document.createElement('div');
    card.className = 'receipt';

    const topbar = document.createElement('div');
    topbar.className = 'receipt-topbar';
    const left = document.createElement('div');
    left.className = 'receipt-left';
    const dot = document.createElement('div');
    dot.className = 'receipt-dot';
    const label = document.createElement('span');
    label.className = 'receipt-label';
    label.textContent = 'Handoff prompt';
    left.appendChild(dot);
    left.appendChild(label);
    const tag = document.createElement('span');
    tag.className = 'receipt-tag';
    tag.textContent = 'Ready to paste';
    topbar.appendChild(left);
    topbar.appendChild(tag);

    const body = document.createElement('div');
    body.className = 'receipt-body';
    const pre = document.createElement('pre');
    pre.textContent = handoff;
    body.appendChild(pre);

    const footer = document.createElement('div');
    footer.className = 'receipt-footer';
    const hint = document.createElement('span');
    hint.className = 'receipt-footer-hint';
    hint.textContent = 'Drop this into any AI to continue without re-explaining.';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-copy';
    copyBtn.textContent = 'Copy handoff';
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(handoff).then(() => {
            copyBtn.textContent = 'Copied';
            copyBtn.classList.add('copied');
            setTimeout(() => { copyBtn.textContent = 'Copy handoff'; copyBtn.classList.remove('copied'); }, 2000);
        });
    });
    footer.appendChild(hint);
    footer.appendChild(copyBtn);

    card.appendChild(topbar);
    card.appendChild(body);
    card.appendChild(footer);
    chat.appendChild(card);
    if (save) scrollBottom();
}

// ── Donut + mini bars ─────────────────────────────────────────────────────────

function buildDonut(pct, size = 40) {
    const r = (size / 2) - 4;
    const circ = 2 * Math.PI * r;
    const filled = Math.max(0, Math.min(100, pct));
    const offset = circ - (filled / 100) * circ;
    const cx = size / 2, cy = size / 2;

    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <svg class="donut-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="donut-track" cx="${cx}" cy="${cy}" r="${r}"/>
      <circle class="donut-fill"
        cx="${cx}" cy="${cy}" r="${r}"
        stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
        data-offset="${offset}"/>
      <text x="${cx}" y="${cy + 3.5}" text-anchor="middle"
        font-size="7.5" font-family="Inter,sans-serif"
        font-weight="600" fill="#34D399">${filled}%</text>
    </svg>`;

    requestAnimationFrame(() => {
        const fill = wrap.querySelector('.donut-fill');
        if (fill) setTimeout(() => { fill.style.strokeDashoffset = fill.dataset.offset; }, 60);
    });
    return wrap;
}

function buildBarMini(label, value, max, type) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    const display = value > 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
    const row = document.createElement('div');
    row.className = 'bar-mini-row';
    row.innerHTML = `
    <span class="bar-mini-label">${label}</span>
    <div class="bar-mini-track">
      <div class="bar-mini-fill ${type}" style="width:0%" data-pct="${pct}%"></div>
    </div>
    <span class="bar-mini-count">${display}</span>`;
    requestAnimationFrame(() => {
        const fill = row.querySelector('.bar-mini-fill');
        if (fill) setTimeout(() => { fill.style.width = fill.dataset.pct; }, 60);
    });
    return row;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const h = Math.floor((Date.now() - d) / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
}

function setLoading(state) {
    sendBtn.disabled = state;
    input.disabled = state;
}

function scrollBottom() { chat.scrollTop = chat.scrollHeight; }

input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
});