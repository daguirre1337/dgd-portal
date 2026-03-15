/* ==========================================================================
   Cortex Chat Widget - Floating chat for DGD Dashboard
   Connects to Cortex DigitalTwin via SSE streaming API
   ========================================================================== */

var CortexChat = (function() {
    'use strict';

    var CORTEX_URL = (function() {
        var host = window.location.hostname;
        if (host === 'dgd.digital' || host === 'www.dgd.digital') {
            return 'https://cortex.dgd.digital';
        }
        // Local development
        return 'http://localhost:8000';
    })();
    var MAX_HISTORY = 20;

    var _el = null;       // widget root element
    var _open = false;
    var _history = [];
    var _streaming = false;
    var _online = false;
    var _user = null;

    /* ------------------------------------------------------------------
       DOM Creation
       ------------------------------------------------------------------ */

    function createWidget() {
        if (_el) return;

        _el = document.createElement('div');
        _el.id = 'cortex-chat-widget';
        _el.innerHTML =
            '<button class="dgd-cortex-fab" id="cortex-fab" title="Cortex Chat">' +
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
                '<span class="dgd-cortex-fab__pulse"></span>' +
            '</button>' +
            '<div class="dgd-cortex-chat dgd-hidden" id="cortex-chat">' +
                '<div class="dgd-cortex-chat__header">' +
                    '<div class="dgd-cortex-chat__title">' +
                        '<span class="dgd-cortex-chat__dot" id="cortex-dot"></span>' +
                        '<strong>Cortex</strong>' +
                        '<span class="dgd-cortex-chat__status" id="cortex-status">Verbinde...</span>' +
                    '</div>' +
                    '<button class="dgd-cortex-chat__close" id="cortex-close">&times;</button>' +
                '</div>' +
                '<div class="dgd-cortex-chat__messages" id="cortex-messages">' +
                    '<div class="dgd-cortex-msg dgd-cortex-msg--cortex">' +
                        '<div class="dgd-cortex-msg__bubble">Hallo! Ich bin Cortex, der digitale Assistent von DGD. ' +
                        'Wie kann ich helfen?</div>' +
                    '</div>' +
                '</div>' +
                '<div class="dgd-cortex-chat__input">' +
                    '<input type="text" id="cortex-input" placeholder="Nachricht an Cortex..." autocomplete="off">' +
                    '<button id="cortex-send" class="dgd-cortex-chat__send" disabled>' +
                        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                        '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
                    '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(_el);
        bindEvents();
    }

    function bindEvents() {
        var fab = document.getElementById('cortex-fab');
        var close = document.getElementById('cortex-close');
        var input = document.getElementById('cortex-input');
        var send = document.getElementById('cortex-send');

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
    }

    /* ------------------------------------------------------------------
       Toggle / UI
       ------------------------------------------------------------------ */

    function toggle() {
        _open = !_open;
        var chat = document.getElementById('cortex-chat');
        var fab = document.getElementById('cortex-fab');
        if (_open) {
            chat.classList.remove('dgd-hidden');
            fab.classList.add('dgd-cortex-fab--open');
            var input = document.getElementById('cortex-input');
            setTimeout(function() { input.focus(); }, 100);
        } else {
            chat.classList.add('dgd-hidden');
            fab.classList.remove('dgd-cortex-fab--open');
        }
    }

    function scrollToBottom() {
        var msgs = document.getElementById('cortex-messages');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    function appendMessage(role, text) {
        var msgs = document.getElementById('cortex-messages');
        if (!msgs) return;

        var div = document.createElement('div');
        div.className = 'dgd-cortex-msg dgd-cortex-msg--' + role;

        var bubble = document.createElement('div');
        bubble.className = 'dgd-cortex-msg__bubble';
        bubble.textContent = text;
        div.appendChild(bubble);

        msgs.appendChild(div);
        scrollToBottom();
        return bubble;
    }

    function showTyping() {
        var msgs = document.getElementById('cortex-messages');
        if (!msgs) return null;

        var div = document.createElement('div');
        div.className = 'dgd-cortex-msg dgd-cortex-msg--cortex dgd-cortex-msg--typing';
        div.id = 'cortex-typing';
        div.innerHTML = '<div class="dgd-cortex-msg__bubble">' +
            '<span class="dgd-cortex-typing"><span></span><span></span><span></span></span>' +
            '</div>';
        msgs.appendChild(div);
        scrollToBottom();
        return div;
    }

    function removeTyping() {
        var el = document.getElementById('cortex-typing');
        if (el) el.remove();
    }

    function setOnline(online) {
        _online = online;
        var dot = document.getElementById('cortex-dot');
        var status = document.getElementById('cortex-status');
        var fab = document.getElementById('cortex-fab');
        if (!dot) return;

        if (online) {
            dot.className = 'dgd-cortex-chat__dot dgd-cortex-chat__dot--online';
            status.textContent = 'Online';
            if (fab) fab.title = 'Cortex Chat';
        } else {
            dot.className = 'dgd-cortex-chat__dot dgd-cortex-chat__dot--offline';
            status.textContent = 'Offline';
            if (fab) fab.title = 'Cortex offline';
        }
    }

    /* ------------------------------------------------------------------
       API: Send Message via SSE Streaming
       ------------------------------------------------------------------ */

    function sendMessage(text) {
        if (_streaming) return;
        _streaming = true;

        // Add user message
        _history.push({ role: 'user', content: text });
        if (_history.length > MAX_HISTORY) _history = _history.slice(-MAX_HISTORY);
        appendMessage('user', text);

        // Disable input
        var input = document.getElementById('cortex-input');
        var send = document.getElementById('cortex-send');
        if (input) input.disabled = true;
        if (send) send.disabled = true;

        showTyping();

        // Build request with user context + current page
        var contextPrefix = '';
        if (_user) {
            var currentView = (window.location.hash || '#dashboard').replace('#', '') || 'dashboard';
            var viewTitles = {
                dashboard: 'Dashboard (Uebersicht)',
                timeline: 'Zeitleiste',
                kpis: 'KPI Cockpit',
                mitarbeiter: 'Mitarbeiter',
                finanzen: 'Finanzen',
                ziele: 'Ziele & OKR',
                feedback: 'Feedback',
                roadmap: 'Strategische Roadmap',
                crm: 'CRM (Vertrieb)',
                showcase: 'Showcase Builder',
                settings: 'Einstellungen',
                admin: 'Admin Panel'
            };
            var viewLabel = viewTitles[currentView] || currentView;
            contextPrefix = '[DGD Dashboard - User: ' + (_user.display_name || _user.username) +
                ' (' + (_user.role || 'member') + ') - Aktuelle Seite: ' + viewLabel + ']\n';
        }

        var body = JSON.stringify({
            user_message: contextPrefix + text,
            conversation_history: _history.slice(0, -1) // exclude current message (already in user_message)
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
            console.warn('[Cortex] Chat error:', err.message);
            removeTyping();
            appendMessage('cortex', 'Verbindung zu Cortex fehlgeschlagen. Bitte spaeter erneut versuchen.');
            setOnline(false);
            _streaming = false;
            enableInput();
        });
    }

    function readStream(response) {
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        var fullResponse = '';
        var responseBubble = null;

        function processChunk(result) {
            if (result.done) {
                // Stream complete
                if (fullResponse) {
                    _history.push({ role: 'assistant', content: fullResponse });
                    if (_history.length > MAX_HISTORY) _history = _history.slice(-MAX_HISTORY);
                }
                _streaming = false;
                enableInput();
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
                            responseBubble = appendMessage('cortex', text);
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
                // Keep typing indicator
                break;
            case 'text':
                if (event.content) onText(event.content);
                break;
            case 'tool_call':
                // Could show tool usage indicator
                break;
            case 'error':
                removeTyping();
                appendMessage('cortex', 'Fehler: ' + (event.message || 'Unbekannt'));
                _streaming = false;
                enableInput();
                break;
        }
    }

    function enableInput() {
        var input = document.getElementById('cortex-input');
        var send = document.getElementById('cortex-send');
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
        init: function(user) {
            _user = user || null;
            createWidget();
            checkStatus();
            // Re-check every 60s
            setInterval(checkStatus, 60000);
        },

        destroy: function() {
            if (_el) {
                _el.remove();
                _el = null;
            }
            _open = false;
            _history = [];
            _streaming = false;
        },

        isOnline: function() {
            return _online;
        }
    };
})();
