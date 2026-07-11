const form = document.querySelector('#chat-form') as HTMLFormElement;
const input = document.querySelector('#input') as HTMLTextAreaElement;
const chat = document.querySelector('#chat') as HTMLElement;
const sendBtn = document.querySelector('#send-btn') as HTMLButtonElement;
const sidebar = document.querySelector('#sidebar') as HTMLElement;
const topbar = document.querySelector('#topbar') as HTMLElement;
const sessionsList = document.querySelector('#sessions-list') as HTMLElement;
const statSessions = document.querySelector('#stat-sessions') as HTMLElement;
const statSaved = document.querySelector('#stat-saved') as HTMLElement;

const API = 'http://localhost:3000';
const EXTRACT_URL = `${API}/extract`;
const HANDOFF_URL = `${API}/handoff/generate`;
const SESSION_URL = `${API}/sessions`;

const TOKEN_KEY = 'briefly_session_token';
const CHAT_KEY = 'briefly_chat_history';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatHistoryEntry {
    type: 'user' | 'ai' | 'handoff';
    text: string;
}

interface SessionContext {
    problem?: string;
    conversationSummary?: string;
    [key: string]: unknown;
}

interface Session {
    id: number;
    context?: SessionContext;
    handoff?: string;
    rawInput?: string;
    createdAt?: string;
    _name?: string;
}

interface SaveSessionResponse {
    id: number;
    [key: string]: unknown;
}

// ── Active session state ──────────────────────────────────────────────────────

let activeSessionId: number | string | null = null;
let activeSessionName: string | null = null;
let allSessions: Session[] = [];

// Snapshot of the original welcome screen markup so we can restore it exactly
const welcomeScreenTemplate = (document.querySelector('#welcome-screen') as HTMLElement).outerHTML;

function showWelcomeScreen(): void {
    chat.innerHTML = welcomeScreenTemplate;
}

// ── Token ─────────────────────────────────────────────────────────────────────

function getToken(): string {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) { t = crypto.randomUUID(); localStorage.setItem(TOKEN_KEY, t); }
    return t;
}

function makeHeaders(withBody = false): Record<string, string> {
    const h: Record<string, string> = { 'x-session-token': getToken() };
    if (withBody) h['Content-Type'] = 'application/json';
    return h;
}

function extractToken(res: Response): void {
    const t = res.headers.get('x-session-token');
    if (t) localStorage.setItem(TOKEN_KEY, t);
}

// ── Chat persistence ──────────────────────────────────────────────────────────

function getChatHistory(): ChatHistoryEntry[] {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); }
    catch { return []; }
}

function appendChatHistory(entry: ChatHistoryEntry): void {
    const h = getChatHistory();
    h.push(entry);
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(h)); } catch { }
}

function restoreChat(): void {
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

const railCollapsed = document.querySelector('#rail-collapsed') as HTMLElement;

function closeSidebar(): void {
    sidebar.classList.add('hidden');
    railCollapsed.classList.add('visible');
}

function openSidebar(): void {
    sidebar.classList.remove('hidden');
    railCollapsed.classList.remove('visible');
}

(document.querySelector('#sidebar-toggle') as HTMLElement).addEventListener('click', closeSidebar);
(document.querySelector('#rail-collapsed-expand') as HTMLElement).addEventListener('click', openSidebar);
(document.querySelector('#rail-collapsed-sessions') as HTMLElement).addEventListener('click', openSidebar);
(document.querySelector('#rail-collapsed-new') as HTMLElement).addEventListener('click', () => {
    (document.querySelector('#btn-new-context') as HTMLElement).click();
});

// ── New context ───────────────────────────────────────────────────────────────

(document.querySelector('#btn-new-context') as HTMLElement).addEventListener('click', () => {
    try { localStorage.removeItem(CHAT_KEY); } catch { }
    setActiveSession(null, null);
    showWelcomeScreen();
    document.querySelectorAll('.session-row').forEach(el => el.classList.remove('active'));
    input.focus();
});

// ── Topbar session title ──────────────────────────────────────────────────────

const topbarBrand = document.querySelector('#topbar-brand') as HTMLElement;
const topbarSessionTitle = document.querySelector('#topbar-session-title') as HTMLElement;
const topbarSessionName = document.querySelector('#topbar-session-name') as HTMLElement;
const topbarDropdown = document.querySelector('#topbar-dropdown') as HTMLElement;
const topbarMenuBtn = document.querySelector('#topbar-session-menu-btn') as HTMLElement;

function setActiveSession(id: number | string | null, name: string | null): void {
    activeSessionId = id;
    activeSessionName = name;

    if (id) {
        topbar.classList.remove('hidden');
        topbarBrand.classList.add('hidden');
        topbarSessionTitle.classList.add('visible');
        topbarSessionName.textContent = name || 'Session';
    } else {
        topbar.classList.add('hidden');
        topbarBrand.classList.remove('hidden');
        topbarSessionTitle.classList.remove('visible');
        topbarDropdown.classList.remove('open');
    }
}

topbarMenuBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    topbarDropdown.classList.toggle('open');
});

(document.querySelector('#topbar-rename') as HTMLElement).addEventListener('click', () => {
    topbarDropdown.classList.remove('open');
    if (activeSessionId) openRenameModal(activeSessionId, activeSessionName);
});

(document.querySelector('#topbar-delete') as HTMLElement).addEventListener('click', () => {
    topbarDropdown.classList.remove('open');
    if (activeSessionId) openDeleteModal(activeSessionId);
});

// ── Rename modal ──────────────────────────────────────────────────────────────

const renameOverlay = document.querySelector('#rename-overlay') as HTMLElement;
const renameInput = document.querySelector('#rename-input') as HTMLInputElement;
const renameConfirm = document.querySelector('#rename-confirm') as HTMLElement;
let renamingId: number | string | null = null;

function openRenameModal(id: number | string, currentName: string | null): void {
    renamingId = id;
    renameInput.value = currentName || '';
    renameOverlay.classList.add('open');
    setTimeout(() => { renameInput.focus(); renameInput.select(); }, 50);
}

function closeRenameModal(): void {
    renameOverlay.classList.remove('open');
    renamingId = null;
}

(document.querySelector('#rename-cancel') as HTMLElement).addEventListener('click', closeRenameModal);
(document.querySelector('#rename-cancel-x') as HTMLElement).addEventListener('click', closeRenameModal);

renameConfirm.addEventListener('click', async () => {
    const newName = renameInput.value.trim();
    if (!newName || !renamingId) return;
    await doRenameSession(renamingId, newName);
    closeRenameModal();
});

renameInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') renameConfirm.click();
    if (e.key === 'Escape') closeRenameModal();
});

async function doRenameSession(id: number | string, newName: string): Promise<void> {
    const row = document.querySelector(`.session-row[data-id="${id}"]`);
    if (row) {
        const titleEl = row.querySelector('.session-row-title');
        if (titleEl) titleEl.textContent = newName;
    }
    if (activeSessionId === id) {
        activeSessionName = newName;
        topbarSessionName.textContent = newName;
    }
    const s = allSessions.find(s => String(s.id) === String(id));
    if (s) s._name = newName;

    console.log('Renamed session', id, 'to', newName);
}

// ── Delete modal ──────────────────────────────────────────────────────────────

const deleteOverlay = document.querySelector('#delete-overlay') as HTMLElement;
const deleteConfirm = document.querySelector('#delete-confirm') as HTMLElement;
let deletingId: number | string | null = null;

function openDeleteModal(id: number | string): void {
    deletingId = id;
    deleteOverlay.classList.add('open');
}

function closeDeleteModal(): void {
    deleteOverlay.classList.remove('open');
    deletingId = null;
}

(document.querySelector('#delete-cancel') as HTMLElement).addEventListener('click', closeDeleteModal);
(document.querySelector('#delete-cancel-x') as HTMLElement).addEventListener('click', closeDeleteModal);

deleteConfirm.addEventListener('click', async () => {
    if (!deletingId) return;
    await doDeleteSession(deletingId);
    closeDeleteModal();
});

async function doDeleteSession(id: number | string): Promise<void> {
    try {
        const res = await fetch(`${SESSION_URL}/${id}`, {
            method: 'DELETE',
            headers: makeHeaders(),
        });
        extractToken(res);
    } catch (err) {
        console.warn('Delete failed:', err);
    }

    const row = document.querySelector(`.session-row[data-id="${id}"]`);
    if (row) row.remove();

    if (activeSessionId === String(id) || activeSessionId === id) {
        try { localStorage.removeItem(CHAT_KEY); } catch { }
        setActiveSession(null, null);
        showWelcomeScreen();
    }

    loadSessions();
}

// ── Close dropdowns when clicking outside ─────────────────────────────────────

document.addEventListener('click', (e: MouseEvent) => {
    if (!topbarMenuBtn.contains(e.target as Node) && !topbarDropdown.contains(e.target as Node)) {
        topbarDropdown.classList.remove('open');
    }
    document.querySelectorAll('.session-row-dropdown.open').forEach(dd => {
        dd.classList.remove('open');
    });
    if (e.target === renameOverlay) closeRenameModal();
    if (e.target === deleteOverlay) closeDeleteModal();
});

// ── Init ──────────────────────────────────────────────────────────────────────

restoreChat();
loadSessions();

// ── Sessions ──────────────────────────────────────────────────────────────────

async function loadSessions(): Promise<void> {
    try {
        const res = await fetch(SESSION_URL, { headers: makeHeaders() });
        extractToken(res);
        if (!res.ok) return;
        const sessions: Session[] = await res.json();
        allSessions = sessions;
        renderSessions(sessions);
    } catch (err) {
        console.warn('loadSessions:', err);
    }
}

function renderSessions(sessions: Session[]): void {
    if (!sessions?.length) {
        sessionsList.innerHTML = '<div class="session-nav-empty">No sessions yet. Paste a conversation to start.</div>';
        statSessions.textContent = '0';
        statSaved.textContent = '0';
        return;
    }

    statSessions.textContent = String(sessions.length);
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
        if (String(s.id) === String(activeSessionId)) row.classList.add('active');
        sessionsList.appendChild(row);
    });

    const saved = Math.max(0, totalIn - totalOut);
    statSaved.textContent = saved > 1000 ? `${(saved / 1000).toFixed(1)}k` : String(saved);
}

function buildRow(
    id: number,
    problem: string,
    date: string,
    inT: number,
    outT: number,
    pct: number
): HTMLElement {
    const row = document.createElement('div');
    row.className = 'session-row';
    row.dataset.id = String(id);

    row.addEventListener('click', (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('.session-row-ellipsis') ||
            (e.target as HTMLElement).closest('.session-row-dropdown')) return;
        loadSession(id, row, problem);
    });

    const donutWrap = document.createElement('div');
    donutWrap.className = 'session-row-donut';
    donutWrap.appendChild(buildDonut(pct, 34));

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

    const ellipsis = document.createElement('button');
    ellipsis.className = 'session-row-ellipsis';
    ellipsis.title = 'Session options';
    ellipsis.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';

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

    ellipsis.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        document.querySelectorAll('.session-row-dropdown.open').forEach(dd => dd.classList.remove('open'));
        dropdown.classList.toggle('open');
    });

    dropdown.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        const action = (e.target as HTMLElement).closest('[data-action]')?.getAttribute('data-action');
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

async function loadSession(id: number | string, rowEl: HTMLElement, name: string): Promise<void> {
    document.querySelectorAll('.session-row').forEach(el => el.classList.remove('active'));
    rowEl.classList.add('active');
    setActiveSession(id, name);

    try {
        const res = await fetch(`${SESSION_URL}/${id}`, { headers: makeHeaders() });
        extractToken(res);
        if (!res.ok) return;
        const session: Session = await res.json();

        chat.innerHTML = '';
        if (session.rawInput) renderMsg(session.rawInput, 'user', false);
        if (session.handoff) renderReceipt(session.handoff, false);
        scrollBottom();
    } catch (err) {
        console.warn('loadSession:', err);
    }
}

// ── Submit ────────────────────────────────────────────────────────────────────

form.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    document.querySelectorAll('.session-row').forEach(el => el.classList.remove('active'));
    setActiveSession(null, null);

    if (chat.querySelector('#welcome-screen')) chat.innerHTML = '';

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

        if (extractRes.status === 429) {
            const err = await extractRes.json();
            throw new Error(err.message ?? 'Too Many Requests wait, try again after 60 seconds');
        }

        if (!extractRes.ok) {
            const err = await extractRes.json();
            throw new Error(err.message ?? 'Extraction failed.');
        }

        const context: SessionContext = await extractRes.json();
        const lt = loading.querySelector('.loading-text');
        if (lt) lt.textContent = 'Generating handoff';

        const handoffRes = await fetch(HANDOFF_URL, {
            method: 'POST',
            headers: makeHeaders(true),
            body: JSON.stringify(context),
        });
        extractToken(handoffRes);

        if (handoffRes.status === 429) {
            throw new Error('Too many requests, please wait 60 seconds.');
        }

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
                const ctx = context ?? {};
                const name = ctx.problem || ctx.conversationSummary || 'New session';
                setActiveSession(saved?.id, name);
                loadSessions();
            })
            .catch((err) => console.error('saveSession:', err));

    } catch (err) {
        loading.remove();

        const isRateLimit = (err as Error).message?.toLowerCase().includes('too many')
            || (err as Error).message?.includes('429')
            || (err as Error).message?.includes('rate');

        const msg = isRateLimit
            ? 'Rate limit reached. Please wait 60 seconds before trying again.'
            : `Something went wrong: ${(err as Error).message}`;

        renderMsg(msg, 'ai', true);
        appendChatHistory({ type: 'ai', text: msg });
        console.error(err);
    } finally {
        setLoading(false);
    }
});

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveSession(
    rawInput: string,
    context: SessionContext,
    handoffOutput: string
): Promise<SaveSessionResponse> {
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

function renderMsg(text: string, type: 'user' | 'ai', save: boolean): HTMLElement {
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

function renderLoading(text: string): HTMLElement {
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

function renderReceipt(handoff: string, save: boolean): void {
    const card = document.createElement('div');
    card.className = 'receipt';

    const topbarEl = document.createElement('div');
    topbarEl.className = 'receipt-topbar';
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
    topbarEl.appendChild(left);
    topbarEl.appendChild(tag);

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

    card.appendChild(topbarEl);
    card.appendChild(body);
    card.appendChild(footer);
    chat.appendChild(card);
    if (save) scrollBottom();
}

// ── Donut + mini bars ─────────────────────────────────────────────────────────

function buildDonut(pct: number, size = 40): HTMLElement {
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
        const fill = wrap.querySelector('.donut-fill') as SVGCircleElement | null;
        if (fill) setTimeout(() => { fill.style.strokeDashoffset = (fill as HTMLElement).dataset.offset!; }, 60);
    });
    return wrap;
}

function buildBarMini(label: string, value: number, max: number, type: 'in' | 'out'): HTMLElement {
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
        const fill = row.querySelector('.bar-mini-fill') as HTMLElement | null;
        if (fill) setTimeout(() => { fill.style.width = fill.dataset.pct!; }, 60);
    });
    return row;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const h = Math.floor((Date.now() - d.getTime()) / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
}

function setLoading(state: boolean): void {
    sendBtn.disabled = state;
    input.disabled = state;
}

function scrollBottom(): void { chat.scrollTop = chat.scrollHeight; }

input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
});