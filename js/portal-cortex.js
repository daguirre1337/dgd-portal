/* ==========================================================================
   Maria Demir Chat Widget - DGD Portal Kundenberaterin
   v2.0 - Maria-First Redesign
   - Welcome-Screen Overlay (first visit)
   - Environment-aware Cortex URL (localhost / Cloudflare Tunnel)
   - Fallback responses when Cortex offline
   - Contextual quick actions per page
   - Persistent conversation (sessionStorage)
   - Upgraded FAB with avatar
   ========================================================================== */

var MariaChatWidget = (function() {
    'use strict';

    /* ------------------------------------------------------------------
       Configuration
       ------------------------------------------------------------------ */

    var CORTEX_URL = (function() {
        var host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000';
        return 'https://cortex.dgd.digital';
    })();

    var MAX_HISTORY = 20;
    var STORAGE_KEY = 'maria-chat-history';
    var WELCOME_KEY = 'maria-welcomed';

    /* ------------------------------------------------------------------
       Fallback Responses (when Cortex is offline)
       ------------------------------------------------------------------ */

    var FALLBACK_RESPONSES = [
        {
            keywords: ['schaden', 'unfall', 'meld', 'kaputt', 'crash'],
            response: 'Sie m\u00f6chten einen Schadenfall melden? Das geht ganz einfach! Klicken Sie auf den Button unten, um zum Formular zu gelangen. Sie ben\u00f6tigen nur Ihre Kontaktdaten und eine kurze Beschreibung des Schadens.',
            action: { navigate: '#melden', label: 'Zum Schadenformular' }
        },
        {
            keywords: ['gutachter', 'suche', 'finden', 'n\u00e4he', 'ort', 'plz'],
            response: 'Ich helfe Ihnen gerne, einen Gutachter in Ihrer N\u00e4he zu finden! Nutzen Sie unseren Gutachter-Finder \u2014 geben Sie einfach Ihre Postleitzahl oder Ihren Ort ein.',
            action: { navigate: '#gutachter', label: 'Gutachter-Finder \u00f6ffnen' }
        },
        {
            keywords: ['status', 'fall', 'nummer', 'pr\u00fcfen', 'fortschritt', 'stand'],
            response: 'Um den Status Ihres Schadenfalls zu pr\u00fcfen, ben\u00f6tigen Sie Ihre Fallnummer (z.B. DGD-20260305-ABC1). Diese haben Sie per E-Mail erhalten.',
            action: { navigate: '#status', label: 'Status pr\u00fcfen' }
        },
        {
            keywords: ['kosten', 'preis', 'bezahl', 'geld', 'teuer', 'gratis', 'kostenlos'],
            response: 'Gute Nachricht: F\u00fcr Sie als Gesch\u00e4digter ist das Gutachten kostenlos! Die Kosten tr\u00e4gt die gegnerische Versicherung. Das ist Ihr Recht nach einem unverschuldeten Unfall.'
        },
        {
            keywords: ['partner', 'mitmachen', 'sachverst\u00e4ndig', 'netzwerk', 'beitreten'],
            response: 'Sie m\u00f6chten als Kfz-Sachverst\u00e4ndiger Teil unseres Netzwerks werden? Wir freuen uns \u00fcber Ihr Interesse! Registrieren Sie sich auf unserer Partner-Seite.',
            action: { navigate: '#partner', label: 'Partner werden' }
        },
        {
            keywords: ['rente', 'ruhestand', 'provision', 'empfehlung', 'passiv'],
            response: 'Unser Empfehlungsprogramm f\u00fcr Gutachter im Ruhestand: Verdienen Sie lebenslang an jeder Empfehlung \u2014 ohne einen Finger zu r\u00fchren. Zwischen 50 und 150\u20ac pro vermitteltem Gutachten.',
            action: { navigate: '#rente', label: 'Mehr erfahren' }
        },
        {
            keywords: ['wie lange', 'dauer', 'warten', 'zeit'],
            response: 'In der Regel erstellt unser Gutachter das Gutachten innerhalb von 24\u201348 Stunden nach dem Vor-Ort-Termin. Die gesamte Schadensregulierung kann je nach Versicherung 2\u20136 Wochen dauern.'
        },
        {
            keywords: ['kontakt', 'telefon', 'anruf', 'email', 'erreich'],
            response: 'Sie erreichen uns jederzeit:\n\nTelefon: +49 (0) 800 009 5000 (kostenlos)\nE-Mail: service@deutscher-gutachter-dienst.de\nWeb: dgd.digital'
        },
        {
            keywords: ['hallo', 'hi', 'guten tag', 'moin', 'servus', 'hey'],
            response: 'Guten Tag! Sch\u00f6n, dass Sie da sind. Ich bin Maria Demir, Ihre pers\u00f6nliche Beraterin beim Deutschen Gutachter Dienst. Wie kann ich Ihnen helfen?'
        },
        {
            keywords: ['danke', 'dank', 'super', 'toll', 'prima', 'klasse'],
            response: 'Sehr gerne! Wenn Sie weitere Fragen haben, bin ich jederzeit f\u00fcr Sie da. Ich w\u00fcnsche Ihnen alles Gute!'
        }
    ];

    var FALLBACK_DEFAULT = 'Vielen Dank f\u00fcr Ihre Nachricht! Leider bin ich gerade nicht mit dem Server verbunden. Sie k\u00f6nnen mich aber gerne direkt kontaktieren:\n\nTelefon: +49 (0) 800 009 5000\nE-Mail: service@deutscher-gutachter-dienst.de\n\nOder nutzen Sie die Navigation oben, um direkt zu Ihrem Anliegen zu gelangen.';

    /* ------------------------------------------------------------------
       Contextual Quick Actions per Page
       ------------------------------------------------------------------ */

    var CONTEXT_ACTIONS = {
        'landing': [
            { label: 'Schadenfall melden', msg: 'Ich m\u00f6chte einen Schadenfall melden' },
            { label: 'Gutachter finden', msg: 'Ich suche einen Gutachter in meiner N\u00e4he' },
            { label: 'Status pr\u00fcfen', msg: 'Ich m\u00f6chte den Status meiner Schadensregulierung pr\u00fcfen' }
        ],
        'report-form': [
            { label: 'Hilfe beim Ausf\u00fcllen', msg: 'K\u00f6nnen Sie mir beim Ausf\u00fcllen des Formulars helfen?' },
            { label: 'Was kostet das?', msg: 'Was kostet ein Kfz-Gutachten f\u00fcr mich?' },
            { label: 'Wie geht es weiter?', msg: 'Wie geht es nach der Schadenmeldung weiter?' }
        ],
        'wizard': [
            { label: 'Wie funktioniert die Suche?', msg: 'Wie funktioniert die Gutachter-Suche?' },
            { label: 'Gutachter empfehlen', msg: 'Welchen Gutachter w\u00fcrden Sie mir empfehlen?' }
        ],
        'status-check': [
            { label: 'Fallnummer vergessen?', msg: 'Ich habe meine Fallnummer vergessen. Was kann ich tun?' },
            { label: 'Wie lange dauert es?', msg: 'Wie lange dauert die Schadensregulierung normalerweise?' }
        ],
        'partner': [
            { label: 'Wie werde ich Partner?', msg: 'Wie kann ich als Gutachter Partner beim DGD werden?' },
            { label: 'Welche Qualifikationen?', msg: 'Welche Qualifikationen brauche ich als DGD-Partner?' }
        ],
        'rente': [
            { label: 'Wie hoch ist die Provision?', msg: 'Wie hoch ist die Provision beim Empfehlungsprogramm?' },
            { label: 'Muss ich noch arbeiten?', msg: 'Muss ich als Empfehlungspartner noch aktiv als Gutachter arbeiten?' }
        ]
    };

    /* ------------------------------------------------------------------
       State
       ------------------------------------------------------------------ */

    var _el = null;
    var _welcomeEl = null;
    var _open = false;
    var _history = [];
    var _streaming = false;
    var _online = false;
    var _firstInteraction = true;

    /* ------------------------------------------------------------------
       Helpers
       ------------------------------------------------------------------ */

    function getCurrentView() {
        var hash = window.location.hash || '';
        var routes = {
            '': 'landing', '#': 'landing', '#start': 'landing',
            '#gutachter': 'wizard', '#melden': 'report-form',
            '#status': 'status-check', '#partner': 'partner',
            '#rente': 'rente'
        };
        return routes[hash] || 'landing';
    }

    function findFallbackResponse(text) {
        var lower = text.toLowerCase();
        for (var i = 0; i < FALLBACK_RESPONSES.length; i++) {
            var entry = FALLBACK_RESPONSES[i];
            for (var k = 0; k < entry.keywords.length; k++) {
                if (lower.indexOf(entry.keywords[k]) !== -1) {
                    return entry;
                }
            }
        }
        return { response: FALLBACK_DEFAULT };
    }

    function saveHistory() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_history));
        } catch (e) { /* quota exceeded or private mode */ }
    }

    function loadHistory() {
        try {
            var data = sessionStorage.getItem(STORAGE_KEY);
            if (data) {
                _history = JSON.parse(data);
                if (_history.length > 0) _firstInteraction = false;
            }
        } catch (e) { _history = []; }
    }

    /* ------------------------------------------------------------------
       Welcome Screen
       ------------------------------------------------------------------ */

    function showWelcomeScreen() {
        if (localStorage.getItem(WELCOME_KEY)) return;

        _welcomeEl = document.createElement('div');
        _welcomeEl.className = 'maria-welcome-overlay';
        _welcomeEl.id = 'maria-welcome-overlay';
        _welcomeEl.innerHTML =
            '<div class="maria-welcome">' +
                '<div class="maria-welcome__avatar">' +
                    '<img src="img/dgd-falcon.png" alt="Maria Demir" width="48" height="48">' +
                '</div>' +
                '<div class="maria-welcome__greeting">' +
                    '<h2>Guten Tag! Ich bin Maria.</h2>' +
                    '<p>Ihre pers\u00f6nliche Beraterin beim Deutschen Gutachter Dienst. Ich helfe Ihnen bei Unfallsch\u00e4den, Gutachter-Suche und Schadensregulierung.</p>' +
                '</div>' +
                '<div class="maria-welcome__actions">' +
                    '<button class="maria-welcome__btn maria-welcome__btn--chat" id="maria-welcome-chat">' +
                        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
                        'Chat mit Maria starten' +
                    '</button>' +
                    '<button class="maria-welcome__btn maria-welcome__btn--skip" id="maria-welcome-skip">' +
                        'Direkt zur Webseite \u2192' +
                    '</button>' +
                '</div>' +
                '<div class="maria-welcome__features">' +
                    '<span class="maria-welcome__feature"><span class="maria-welcome__feature-icon">\uD83D\uDCCB</span> Schadenfall melden</span>' +
                    '<span class="maria-welcome__feature"><span class="maria-welcome__feature-icon">\uD83D\uDD0D</span> Gutachter finden</span>' +
                    '<span class="maria-welcome__feature"><span class="maria-welcome__feature-icon">\u2705</span> Status pr\u00fcfen</span>' +
                '</div>' +
            '</div>';

        document.body.appendChild(_welcomeEl);

        document.getElementById('maria-welcome-chat').addEventListener('click', function() {
            dismissWelcome(true);
        });

        document.getElementById('maria-welcome-skip').addEventListener('click', function() {
            dismissWelcome(false);
        });
    }

    function dismissWelcome(openChat) {
        localStorage.setItem(WELCOME_KEY, 'true');
        if (_welcomeEl) {
            _welcomeEl.classList.add('maria-welcome-overlay--closing');
            setTimeout(function() {
                if (_welcomeEl) {
                    _welcomeEl.remove();
                    _welcomeEl = null;
                }
                if (openChat) {
                    // Open the chat panel
                    if (!_open) toggle();
                }
            }, 350);
        }
    }

    /* ------------------------------------------------------------------
       DOM Creation
       ------------------------------------------------------------------ */

    function createWidget() {
        if (_el) return;

        _el = document.createElement('div');
        _el.id = 'maria-chat-widget';
        _el.innerHTML =
            '<button class="maria-fab" id="maria-fab" title="Chat mit Maria Demir">' +
                '<img src="img/dgd-falcon.png" alt="Maria" class="maria-fab__avatar" width="32" height="32">' +
                '<span class="maria-fab__pulse"></span>' +
                '<span class="maria-fab__label" id="maria-fab-label">Maria</span>' +
            '</button>' +
            '<div class="maria-chat maria-hidden" id="maria-chat">' +
                '<div class="maria-chat__header">' +
                    '<div class="maria-chat__title">' +
                        '<span class="maria-chat__dot" id="maria-dot"></span>' +
                        '<div class="maria-chat__title-text">' +
                            '<strong>Maria Demir</strong>' +
                            '<span class="maria-chat__subtitle">Ihre DGD Beraterin</span>' +
                        '</div>' +
                        '<span class="maria-chat__status" id="maria-status">Verbinde...</span>' +
                    '</div>' +
                    '<button class="maria-chat__close" id="maria-close">&times;</button>' +
                '</div>' +
                '<div class="maria-chat__messages" id="maria-messages"></div>' +
                '<div class="maria-chat__input">' +
                    '<input type="text" id="maria-input" placeholder="Nachricht an Maria..." autocomplete="off">' +
                    '<button id="maria-send" class="maria-chat__send" disabled>' +
                        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                        '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
                    '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(_el);

        // Restore history or show initial greeting
        loadHistory();
        renderMessages();

        bindEvents();

        // Auto-hide FAB label after 5 seconds
        setTimeout(function() {
            var lbl = document.getElementById('maria-fab-label');
            if (lbl) lbl.classList.add('maria-fab__label--hidden');
        }, 5000);
    }

    function renderMessages() {
        var msgs = document.getElementById('maria-messages');
        if (!msgs) return;

        msgs.innerHTML = '';

        if (_history.length === 0) {
            // Show initial greeting + quick actions
            var greeting = document.createElement('div');
            greeting.className = 'maria-msg maria-msg--maria';
            greeting.innerHTML = '<div class="maria-msg__bubble">Guten Tag! Ich bin Maria Demir, Ihre pers\u00f6nliche Beraterin beim DGD. Wie kann ich Ihnen helfen?</div>';
            msgs.appendChild(greeting);

            renderQuickActions();
        } else {
            // Restore all messages from history
            for (var i = 0; i < _history.length; i++) {
                var msg = _history[i];
                var role = msg.role === 'user' ? 'user' : 'maria';
                var div = document.createElement('div');
                div.className = 'maria-msg maria-msg--' + role;
                var bubble = document.createElement('div');
                bubble.className = 'maria-msg__bubble';
                bubble.textContent = msg.content;
                div.appendChild(bubble);
                msgs.appendChild(div);
            }
            // Show quick actions after history
            renderQuickActions();
        }

        scrollToBottom();
    }

    function renderQuickActions() {
        var msgs = document.getElementById('maria-messages');
        if (!msgs) return;

        // Remove existing quick actions
        var existing = document.getElementById('maria-quick-actions');
        if (existing) existing.remove();

        var view = getCurrentView();
        var actions = CONTEXT_ACTIONS[view] || CONTEXT_ACTIONS['landing'];

        var container = document.createElement('div');
        container.className = 'maria-quick-actions';
        container.id = 'maria-quick-actions';

        for (var i = 0; i < actions.length; i++) {
            var btn = document.createElement('button');
            btn.className = 'maria-quick-btn';
            btn.setAttribute('data-msg', actions[i].msg);
            btn.textContent = actions[i].label;
            container.appendChild(btn);
        }

        msgs.appendChild(container);
        bindQuickActionEvents();
        scrollToBottom();
    }

    function bindQuickActionEvents() {
        var quickBtns = document.querySelectorAll('.maria-quick-btn');
        for (var i = 0; i < quickBtns.length; i++) {
            quickBtns[i].addEventListener('click', function() {
                var msg = this.getAttribute('data-msg');
                if (msg && !_streaming) {
                    var qa = document.getElementById('maria-quick-actions');
                    if (qa) qa.style.display = 'none';
                    sendMessage(msg);
                }
            });
        }
    }

    function bindEvents() {
        var fab = document.getElementById('maria-fab');
        var close = document.getElementById('maria-close');
        var input = document.getElementById('maria-input');
        var send = document.getElementById('maria-send');

        fab.addEventListener('click', toggle);
        close.addEventListener('click', toggle);

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey && input.value.trim()) {
                e.preventDefault();
                sendMessage(input.value.trim());
                input.value = '';
                send.disabled = true;
            }
        });

        input.addEventListener('input', function() {
            send.disabled = !input.value.trim() || _streaming;
        });

        send.addEventListener('click', function() {
            if (input.value.trim() && !_streaming) {
                sendMessage(input.value.trim());
                input.value = '';
                send.disabled = true;
            }
        });

        // Update quick actions on page navigation
        window.addEventListener('hashchange', function() {
            renderQuickActions();
        });
    }

    /* ------------------------------------------------------------------
       Toggle / UI
       ------------------------------------------------------------------ */

    function toggle() {
        _open = !_open;
        var chat = document.getElementById('maria-chat');
        var fab = document.getElementById('maria-fab');
        if (_open) {
            chat.classList.remove('maria-hidden');
            fab.classList.add('maria-fab--open');
            var input = document.getElementById('maria-input');
            setTimeout(function() { input.focus(); }, 100);
        } else {
            chat.classList.add('maria-hidden');
            fab.classList.remove('maria-fab--open');
        }
    }

    function scrollToBottom() {
        var msgs = document.getElementById('maria-messages');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    function appendMessage(role, text) {
        var msgs = document.getElementById('maria-messages');
        if (!msgs) return;

        // Remove quick actions before appending (will be re-added after response)
        var qa = document.getElementById('maria-quick-actions');
        if (qa) qa.remove();

        var div = document.createElement('div');
        div.className = 'maria-msg maria-msg--' + role;

        var bubble = document.createElement('div');
        bubble.className = 'maria-msg__bubble';
        bubble.textContent = text;
        div.appendChild(bubble);

        msgs.appendChild(div);
        scrollToBottom();
        return bubble;
    }

    function appendActionButton(action) {
        if (!action || !action.navigate) return;
        var msgs = document.getElementById('maria-messages');
        if (!msgs) return;

        var div = document.createElement('div');
        div.className = 'maria-msg maria-msg--maria';
        var btn = document.createElement('button');
        btn.className = 'maria-action-btn';
        btn.textContent = action.label || 'Jetzt \u00f6ffnen';
        btn.addEventListener('click', function() {
            window.location.hash = action.navigate;
        });
        div.appendChild(btn);
        msgs.appendChild(div);
        scrollToBottom();
    }

    function showTyping() {
        var msgs = document.getElementById('maria-messages');
        if (!msgs) return null;

        var div = document.createElement('div');
        div.className = 'maria-msg maria-msg--maria maria-msg--typing';
        div.id = 'maria-typing';
        div.innerHTML = '<div class="maria-msg__bubble">' +
            '<span class="maria-typing"><span></span><span></span><span></span></span>' +
            '</div>';
        msgs.appendChild(div);
        scrollToBottom();
        return div;
    }

    function removeTyping() {
        var el = document.getElementById('maria-typing');
        if (el) el.remove();
    }

    function setOnline(online) {
        _online = online;
        var dot = document.getElementById('maria-dot');
        var status = document.getElementById('maria-status');
        var fab = document.getElementById('maria-fab');
        if (!dot) return;

        if (online) {
            dot.className = 'maria-chat__dot maria-chat__dot--online';
            status.textContent = 'Online';
            if (fab) fab.title = 'Chat mit Maria Demir';
        } else {
            dot.className = 'maria-chat__dot maria-chat__dot--offline';
            status.textContent = 'Offline \u2013 Schnellantworten aktiv';
            if (fab) fab.title = 'Chat mit Maria Demir';
        }
    }

    /* ------------------------------------------------------------------
       API: Send Message via SSE Streaming (with Fallback)
       ------------------------------------------------------------------ */

    function sendMessage(text) {
        if (_streaming) return;
        _streaming = true;
        _firstInteraction = false;

        _history.push({ role: 'user', content: text });
        if (_history.length > MAX_HISTORY) _history = _history.slice(-MAX_HISTORY);
        saveHistory();
        appendMessage('user', text);

        var input = document.getElementById('maria-input');
        var send = document.getElementById('maria-send');
        if (input) input.disabled = true;
        if (send) send.disabled = true;

        showTyping();

        // Try Cortex first, fallback on error
        var body = JSON.stringify({
            user_message: '[DGD Portal - Besucher]\n' + text,
            conversation_history: _history.slice(0, -1),
            role: 'kundenservice'
        });

        fetch(CORTEX_URL + '/api/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: body
        }).then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            setOnline(true);
            return readStream(response);
        }).catch(function(err) {
            console.warn('[Maria] Cortex offline, using fallback:', err.message);
            removeTyping();
            useFallback(text);
            setOnline(false);
            _streaming = false;
            enableInput();
        });
    }

    function useFallback(text) {
        var match = findFallbackResponse(text);

        // Simulate typing delay for natural feel
        setTimeout(function() {
            var bubble = appendMessage('maria', match.response);

            // Store in history
            _history.push({ role: 'assistant', content: match.response });
            if (_history.length > MAX_HISTORY) _history = _history.slice(-MAX_HISTORY);
            saveHistory();

            // Show navigation action button if available
            if (match.action) {
                appendActionButton(match.action);
            }

            // Re-render quick actions after response
            renderQuickActions();
        }, 500);
    }

    function readStream(response) {
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        var fullResponse = '';
        var responseBubble = null;

        function processChunk(result) {
            if (result.done) {
                if (fullResponse) {
                    _history.push({ role: 'assistant', content: fullResponse });
                    if (_history.length > MAX_HISTORY) _history = _history.slice(-MAX_HISTORY);
                    saveHistory();
                }
                _streaming = false;
                enableInput();
                // Re-render quick actions after response
                renderQuickActions();
                return;
            }

            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line.startsWith('data: ')) continue;

                try {
                    var event = JSON.parse(line.slice(6));
                    handleSSEEvent(event, function(text) {
                        fullResponse = text;
                        if (!responseBubble) {
                            removeTyping();
                            responseBubble = appendMessage('maria', text);
                        } else {
                            responseBubble.textContent = text;
                            scrollToBottom();
                        }
                    });
                } catch (e) {
                    // skip malformed events
                }
            }

            return reader.read().then(processChunk);
        }

        return reader.read().then(processChunk);
    }

    function handleSSEEvent(event, onText) {
        switch (event.type) {
            case 'thinking':
                break;
            case 'text':
                if (event.content) onText(event.content);
                break;
            case 'tool_call':
                break;
            case 'error':
                removeTyping();
                appendMessage('maria', 'Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.');
                _streaming = false;
                enableInput();
                break;
        }
    }

    function enableInput() {
        var input = document.getElementById('maria-input');
        var send = document.getElementById('maria-send');
        if (input) { input.disabled = false; input.focus(); }
        if (send) send.disabled = !input || !input.value.trim();
    }

    /* ------------------------------------------------------------------
       Status Check
       ------------------------------------------------------------------ */

    function checkStatus() {
        fetch(CORTEX_URL + '/api/system_status', { method: 'GET' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                setOnline(data && data.ok !== false);
            })
            .catch(function() {
                setOnline(false);
            });
    }

    /* ------------------------------------------------------------------
       Public API
       ------------------------------------------------------------------ */

    return {
        init: function() {
            createWidget();
            checkStatus();
            setInterval(checkStatus, 60000);

            // Show welcome screen on first visit
            showWelcomeScreen();
        },

        destroy: function() {
            if (_el) { _el.remove(); _el = null; }
            if (_welcomeEl) { _welcomeEl.remove(); _welcomeEl = null; }
            _open = false;
            _history = [];
            _streaming = false;
        },

        isOnline: function() {
            return _online;
        },

        open: function() {
            if (!_open) toggle();
        },

        close: function() {
            if (_open) toggle();
        }
    };
})();

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { MariaChatWidget.init(); });
} else {
    MariaChatWidget.init();
}
