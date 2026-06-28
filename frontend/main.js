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
    setLoading(true);

    const loading = addLoadingMessage('Extracting context');

    try {
        // 1. Extract context from the pasted conversation
        const extractRes = await fetch(EXTRACT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // sends the sessionToken cookie
            body: JSON.stringify({ text }),
        });

        if (!extractRes.ok) {
            const err = await extractRes.json();
            throw new Error(err.message ?? 'Extraction failed.');
        }

        const context = await extractRes.json();

        loading.querySelector('.ai-label + span, .loading-text').textContent =
            'Generating handoff prompt…';

        // 2. Generate the handoff prompt from extracted context
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

        const handoff = await handoffRes.text();

        loading.remove();

        addHandoffCard(handoff);

        // 3. Save session in background — don't block UI if this fails
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
        body: JSON.stringify({
            rawInput,
            context,
            handoffOutput,
        }),
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
    // Wrapper sits outside .message so it can go full width
    const card = document.createElement('div');
    card.className = 'handoff-card';

    // Header row
    const header = document.createElement('div');
    header.className = 'handoff-card-header';

    const title = document.createElement('span');
    title.className = 'handoff-card-title';
    title.textContent = 'Handoff Prompt';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    Copy
  `;

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(handoff).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied
      `;
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        `;
            }, 2000);
        });
    });

    header.appendChild(title);
    header.appendChild(copyBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'handoff-body';

    const pre = document.createElement('pre');
    pre.textContent = handoff;

    body.appendChild(pre);
    card.appendChild(header);
    card.appendChild(body);
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

// ── Auto-grow textarea ────────────────────────────────────────────────────────

input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
});