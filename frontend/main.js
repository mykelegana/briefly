const form = document.querySelector('#chat-form');
const input = document.querySelector('#input');
const chat = document.querySelector('#chat');
const sendBtn = document.querySelector('#send-btn');
const sidebar = document.querySelector('#sidebar');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const sessionsList = document.querySelector('#sessions-list');
const statSessions = document.querySelector('#stat-sessions');
const statSaved = document.querySelector('#stat-saved');

const API = 'http://localhost:3000';
const EXTRACT_URL = `${API}/extract`;
const HANDOFF_URL = `${API}/handoff/generate`;
const SESSION_URL = `${API}/sessions`;

const TOKEN_KEY = 'briefly_session_token';
const CHAT_KEY = 'briefly_chat_history';

// ── Token (localStorage — no cookie issues) ───────────────────────────────────

function getToken() {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        token = crypto.randomUUID();
        localStorage.setItem(TOKEN_KEY, token);
        console.log('New token generated:', token);
    }
    return token;
}

function makeHeaders(withBody = false) {
    const headers = { 'x-session-token': getToken() };
    if (withBody) headers['Content-Type'] = 'application/json';
    return headers;
}

function extractToken(res) {
    const token = res.headers.get('x-session-token');
    if (token) localStorage.setItem(TOKEN_KEY, token);
}

// ── Chat history persistence ──────────────────────────────────────────────────

function loadChatHistory() {
    try {
        const raw = localStorage.getItem(CHAT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveChatHistory(history) {
    try {
        localStorage.setItem(CHAT_KEY, JSON.stringify(history));
    } catch {
        console.warn('Could not save chat history');
    }
}

function appendToHistory(entry) {
    const history = loadChatHistory();
    history.push(entry);
    saveChatHistory(history);
}

// ── Restore chat on page load ─────────────────────────────────────────────────

function restoreChat() {
    const history = loadChatHistory();
    if (history.length === 0) return;

    // Remove the default welcome message
    chat.innerHTML = '';

    history.forEach((entry) => {
        if (entry.type === 'user') {
            renderMessage(entry.text, 'user', false);
        } else if (entry.type === 'ai') {
            renderMessage(entry.text, 'ai', false);
        } else if (entry.type === 'handoff') {
            renderHandoffCard(entry.text, false);
        }
    });

    scrollToBottom();
}

// ── Sidebar toggle ────────────────────────────────────────────────────────────

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// ── Init ──────────────────────────────────────────────────────────────────────

restoreChat();
loadSessions();

// ── Load sessions ─────────────────────────────────────────────────────────────

async function loadSessions() {
    try {
        const res = await fetch(SESSION_URL, { headers: makeHeaders() });
        extractToken(res);
        if (!res.ok) return;
        const sessions = await res.json();
        renderSessions(sessions);
    } catch (err) {
        console.warn('Could not load sessions:', err);
    }
}

function renderSessions(sessions) {
    if (!sessions || sessions.length === 0) {
        sessionsList.innerHTML = `<div class="sessions-empty">No sessions yet.<br/>Paste a conversation to start.</div>`;
        statSessions.textContent = '0';
        statSaved.textContent = '0';
        return;
    }

    statSessions.textContent = sessions.length;
    sessionsList.innerHTML = '';

    let totalIn = 0;
    let totalOut = 0;

    sessions.forEach((session) => {
        const context = session.context ?? {};
        const problem = context.problem ?? context.conversationSummary ?? 'Session';
        const date = formatDate(session.createdAt);

        const inputTokens = session.rawInput ? Math.round(session.rawInput.length / 4) : 0;
        const outputTokens = session.handoff ? Math.round(session.handoff.length / 4)
            : Math.round(JSON.stringify(context).length / 4);

        totalIn += inputTokens;
        totalOut += outputTokens;

        const savedPct = inputTokens > 0
            ? Math.max(0, Math.round((1 - outputTokens / inputTokens) * 100))
            : 0;

        const item = buildSessionItem(session.id, problem, date, inputTokens, outputTokens, savedPct);
        sessionsList.appendChild(item);
    });

    const totalSaved = Math.max(0, totalIn - totalOut);
    statSaved.textContent = totalSaved > 1000
        ? `${(totalSaved / 1000).toFixed(1)}k`
        : String(totalSaved);
}

function buildSessionItem(id, problem, date, inputTokens, outputTokens, savedPct) {
    const item = document.createElement('div');
    item.className = 'session-item';
    item.dataset.id = id;

    // Click to load session
    item.addEventListener('click', () => loadSession(id, item));

    const top = document.createElement('div');
    top.className = 'session-top';

    const problemEl = document.createElement('span');
    problemEl.className = 'session-problem';
    problemEl.textContent = problem;

    const dateEl = document.createElement('span');
    dateEl.className = 'session-date';
    dateEl.textContent = date;

    top.appendChild(problemEl);
    top.appendChild(dateEl);

    const savings = document.createElement('div');
    savings.className = 'session-savings';
    savings.appendChild(buildDonut(savedPct));

    const info = document.createElement('div');
    info.className = 'savings-info';

    const pct = document.createElement('span');
    pct.className = 'savings-pct';
    pct.textContent = `${savedPct}% saved`;

    const barWrap = document.createElement('div');
    barWrap.className = 'savings-bar-wrap';
    barWrap.appendChild(buildBar('Input', inputTokens, inputTokens, 'input'));
    barWrap.appendChild(buildBar('Output', outputTokens, inputTokens, 'output'));

    info.appendChild(pct);
    info.appendChild(barWrap);
    savings.appendChild(info);

    item.appendChild(top);
    item.appendChild(savings);
    return item;
}

// ── Load a specific session ───────────────────────────────────────────────────

async function loadSession(id, itemEl) {
    // Mark active in sidebar
    document.querySelectorAll('.session-item').forEach((el) => el.classList.remove('active'));
    itemEl.classList.add('active');

    try {
        const res = await fetch(`${SESSION_URL}/${id}`, { headers: makeHeaders() });
        extractToken(res);
        if (!res.ok) return;
        const session = await res.json();

        // Clear chat and show this session
        chat.innerHTML = '';

        if (session.rawInput) {
            renderMessage(session.rawInput, 'user', false);
        }

        if (session.handoff) {
            renderHandoffCard(session.handoff, false);
        }

        scrollToBottom();
    } catch (err) {
        console.warn('Could not load session:', err);
    }
}

// ── Submit ────────────────────────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // Deselect any active session
    document.querySelectorAll('.session-item').forEach((el) => el.classList.remove('active'));

    renderMessage(text, 'user', true);
    appendToHistory({ type: 'user', text });

    input.value = '';
    input.style.height = 'auto';
    setLoading(true);

    const loading = addLoadingMessage('Extracting context');

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
        const loadingText = loading.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = 'Generating handoff prompt';

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
        renderHandoffCard(handoff, true);
        appendToHistory({ type: 'handoff', text: handoff });

        saveSession(text, context, handoff)
            .then(() => loadSessions())
            .catch((err) => console.error('Session save failed:', err));

    } catch (err) {
        loading.remove();
        const errMsg = `Something went wrong: ${err.message}`;
        renderMessage(errMsg, 'ai', true);
        appendToHistory({ type: 'ai', text: errMsg });
        console.error(err);
    } finally {
        setLoading(false);
    }
});

// ── Save session ──────────────────────────────────────────────────────────────

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

// save=true means append to history (only for new messages, not restores)
function renderMessage(text, type, save) {
    const div = document.createElement('div');
    div.className = `message ${type}`;

    if (type === 'ai') {
        const label = document.createElement('span');
        label.className = 'ai-label';
        label.textContent = 'Briefly';
        div.appendChild(label);
    }

    const content = document.createElement('span');
    content.textContent = text;
    div.appendChild(content);

    chat.appendChild(div);
    if (save) scrollToBottom();
    return div;
}

function addLoadingMessage(text) {
    const div = document.createElement('div');
    div.className = 'message ai';
    const label = document.createElement('span');
    label.className = 'ai-label';
    label.textContent = 'Briefly';
    const content = document.createElement('span');
    content.className = 'loading-text loading-dots';
    content.textContent = text;
    div.appendChild(label);
    div.appendChild(content);
    chat.appendChild(div);
    scrollToBottom();
    return div;
}

function renderHandoffCard(handoff, save) {
    const card = document.createElement('div');
    card.className = 'handoff-card';

    const header = document.createElement('div');
    header.className = 'handoff-card-header';
    const title = document.createElement('span');
    title.className = 'handoff-card-title';
    title.textContent = 'Handoff Prompt';
    const badge = document.createElement('span');
    badge.className = 'handoff-card-badge';
    badge.textContent = 'Ready to paste';
    header.appendChild(title);
    header.appendChild(badge);

    const body = document.createElement('div');
    body.className = 'handoff-body';
    const pre = document.createElement('pre');
    pre.textContent = handoff;
    body.appendChild(pre);

    const footer = document.createElement('div');
    footer.className = 'handoff-card-footer';
    const hint = document.createElement('span');
    hint.className = 'handoff-hint';
    hint.textContent = 'Paste this into any AI to continue without re-explaining.';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy Handoff';
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(handoff).then(() => {
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = 'Copy Handoff';
                copyBtn.classList.remove('copied');
            }, 2000);
        });
    });
    footer.appendChild(hint);
    footer.appendChild(copyBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    chat.appendChild(card);
    if (save) scrollToBottom();
}

// ── Donut + bars ──────────────────────────────────────────────────────────────

function buildDonut(pct) {
    const size = 40, r = 15;
    const circ = 2 * Math.PI * r;
    const filled = Math.max(0, Math.min(100, pct));
    const offset = circ - (filled / 100) * circ;

    const wrap = document.createElement('div');
    wrap.className = 'donut-wrap';
    wrap.innerHTML = `
    <svg class="donut-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="donut-track" cx="${size / 2}" cy="${size / 2}" r="${r}"/>
      <circle class="donut-fill"
        cx="${size / 2}" cy="${size / 2}" r="${r}"
        stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
        data-offset="${offset}"/>
      <text x="${size / 2}" y="${size / 2 + 4}" text-anchor="middle"
        font-size="8" font-family="Inter,sans-serif"
        font-weight="600" fill="#10B981">${filled}%</text>
    </svg>`;
    requestAnimationFrame(() => {
        const fill = wrap.querySelector('.donut-fill');
        if (fill) setTimeout(() => { fill.style.strokeDashoffset = fill.dataset.offset; }, 50);
    });
    return wrap;
}

function buildBar(label, value, max, type) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    const display = value > 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
    const row = document.createElement('div');
    row.className = 'savings-bar-row';
    row.innerHTML = `
    <span class="bar-label">${label}</span>
    <div class="bar-track"><div class="bar-fill ${type}" style="width:0%" data-pct="${pct}%"></div></div>
    <span class="bar-count">${display}</span>`;
    requestAnimationFrame(() => {
        const fill = row.querySelector('.bar-fill');
        if (fill) setTimeout(() => { fill.style.width = fill.dataset.pct; }, 50);
    });
    return row;
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diffH = Math.floor((Date.now() - d) / 3600000);
    if (diffH < 1) return 'just now';
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
}

function setLoading(state) {
    sendBtn.disabled = state;
    input.disabled = state;
}

function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
}

input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 130) + 'px';
});