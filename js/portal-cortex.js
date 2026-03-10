/* ==========================================================================
   Maria Demir Chat Widget - DGD Portal Kundenberaterin
   Connects to Cortex DigitalTwin via SSE streaming API
   ========================================================================== */

var MariaChatWidget = (function() {
    'use strict';

    var CORTEX_URL = 'http://localhost:8000';
    var MAX_HISTORY = 20;

    var _el = null;
    var _open = false;
    var _history = [];
    var _streaming = false;
    var _online = false;

    /* ------------------------------------------------------------------
       DOM Creation
       ------------------------------------------------------------------ */

    function createWidget() {
        if (_el) return;

        _el = document.createElement('div');
        _el.id = 'maria-chat-widget';
        _el.innerHTML =
            '<button class="maria-fab" id="maria-fab" title="Chat mit Maria Demir">' +
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
                '<span class="maria-fab__pulse"></span>' +
            '</button>' +
            '<div class="maria-chat maria-hidden" id="maria-chat">' +
                '<div class="maria-chat__header">' +
                    '<div class="maria-chat__title">' +
                        '<span class="maria-chat__dot" id="maria-dot"></span>' +
                        '<strong>Maria Demir</strong>' +
                        '<span class="maria-chat__status" id="maria-status">Verbinde...</span>' +
                    '</div>' +
                    '<button class="maria-chat__close" id="maria-close">&times;</button>' +
                '</div>' +
                '<div class="maria-chat__messages" id="maria-messages">' +
                    '<div class="maria-msg maria-msg--maria">' +
                        '<div class="maria-msg__bubble">Guten Tag! Ich bin Maria Demir, Ihre pers\u00f6nliche Beraterin beim DGD. Wie kann ich Ihnen helfen?</div>' +
                    '</div>' +
                    '<div class="maria-quick-actions" id="maria-quick-actions">' +
                        '<button class="maria-quick-btn" data-msg="Ich m\u00f6chte einen Schadenfall melden">Schadenfall melden</button>' +
                        '<button class="maria-quick-btn" data-msg="Ich m\u00f6chte den Status meiner Schadensregulierung pr\u00fcfen">Status pr\u00fcfen</button>' +
                        '<button class="maria-quick-btn" data-msg="Ich suche einen Gutachter in meiner N\u00e4he">Gutachter finden</button>' +
                    '</div>' +
                '</div>' +
                '<div class="maria-chat__input">' +
                    '<input type="text" id="maria-input" placeholder="Nachricht an Maria..." autocomplete="off">' +
                    '<button id="maria-send" class="maria-chat__send" disabled>' +
                        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                        '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
                    '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(_el);
        bindEvents();
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

        // Quick action buttons
        var quickBtns = document.querySelectorAll('.maria-quick-btn');
        for (var i = 0; i < quickBtns.length; i++) {
            quickBtns[i].addEventListener('click', function() {
                var msg = this.getAttribute('data-msg');
                if (msg && !_streaming) {
                    // Hide quick actions after first use
                    var qa = document.getElementById('maria-quick-actions');
                    if (qa) qa.style.display = 'none';
                    sendMessage(msg);
                }
            });
        }
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
            status.textContent = 'Offline';
            if (fab) fab.title = 'Maria Demir offline';
        }
    }

    /* ------------------------------------------------------------------
       API: Send Message via SSE Streaming
       ------------------------------------------------------------------ */

    function sendMessage(text) {
        if (_streaming) return;
        _streaming = true;

        _history.push({ role: 'user', content: text });
        if (_history.length > MAX_HISTORY) _history = _history.slice(-MAX_HISTORY);
        appendMessage('user', text);

        var input = document.getElementById('maria-input');
        var send = document.getElementById('maria-send');
        if (input) input.disabled = true;
        if (send) send.disabled = true;

        showTyping();

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
            console.warn('[Maria] Chat error:', err.message);
            removeTyping();
            appendMessage('maria', 'Entschuldigung, die Verbindung konnte nicht hergestellt werden. Bitte versuchen Sie es sp\u00e4ter erneut.');
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

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { MariaChatWidget.init(); });
} else {
    MariaChatWidget.init();
}
