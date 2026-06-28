const form = document.querySelector('#chat-form');
const input = document.querySelector('#input');
const chat = document.querySelector('#chat');
const sendBtn = document.querySelector('#send-btn');

const API = 'http://localhost:3000';
const EXTRACT_URL = `${API}/extract`;
const HANDOFF_URL = `${API}/handoff/generate`;
const SESSION_URL = `${API}/sessions`;

// ── Submit ────────────────────────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    input.value = '';
    input.style.height = 'auto';
    setLoading(true);

    const loading = addLoadingMessage('Extracting context');

    try {
        // 1. Extract context
        const extractRes = await fetch(EXTRACT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text }),
        });

        if (!extractRes.ok) {
            const err = await extractRes.json();
            throw new Error(err.message ?? 'Extraction failed.');
        }

        const context = await extractRes.json();

        const loadingText = loading.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = 'Generating handoff prompt';

        // 2. Generate handoff
        const handoffRes = await fetch(HANDOFF_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(context),
        });

        if (!handoffRes.ok) {
            const err = await handoffRes.json();
            throw new Error(err.message ?? 'Handoff generation failed.');
        }

        let handoff = await handoffRes.text();
        if (handoff.startsWith('"')) handoff = JSON.parse(handoff);

        loading.remove();
        addHandoffCard(handoff);

        // 3. Save session silently
        saveSession(text, context, handoff).catch((err) =>
            console.warn('Session save failed (non-critical):', err),
        );

    } catch (err) {
        loading.remove();
        addMessage(`Something went wrong: ${err.message}`, 'ai');
        console.error(err);
    } finally {
        setLoading(false);
    }
});

// ── Save session ──────────────────────────────────────────────────────────────

async function saveSession(rawInput, context, handoffOutput) {
    await fetch(SESSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rawInput, context, handoffOutput }),
    });
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function addMessage(text, type) {
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
    scrollToBottom();
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

function addHandoffCard(handoff) {
    const card = document.createElement('div');
    card.className = 'handoff-card';

    // Header
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

    // Body
    const body = document.createElement('div');
    body.className = 'handoff-body';

    const pre = document.createElement('pre');
    pre.textContent = handoff;
    body.appendChild(pre);

    // Footer
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

    // Assemble
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    chat.appendChild(card);
    scrollToBottom();
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
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
});