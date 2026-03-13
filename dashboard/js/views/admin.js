/* ==========================================================================
   DGD Dashboard - View: Admin Panel
   Central feedback overview for quick action on employee requests
   Depends on: namespace.js, helpers.js, api.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {
    'use strict';

    var adminState = {
        tab: 'feedback',
        feedbackType: '',
        feedbackPage: 0,
        feedbackLimit: 50,
    };

    var TYPE_LABELS = {
        pulse: 'Pulse',
        '360': '360-Grad',
        exit: 'Exit',
        custom: 'Custom'
    };

    var TYPE_COLORS = {
        pulse: '#27ae60',
        '360': '#3498db',
        exit: '#e74c3c',
        custom: '#9b59b6'
    };

    function formatDate(iso) {
        if (!iso) return '-';
        try {
            var d = new Date(iso);
            return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
                ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return iso; }
    }

    function renderFeedbackOverview(container) {
        var esc = DGD.helpers.escapeHtml;
        container.innerHTML = '<div class="dgd-section-card"><p style="color:var(--dgd-gray-500);">Lade Feedback...</p></div>';

        var params = { limit: adminState.feedbackLimit, offset: adminState.feedbackPage * adminState.feedbackLimit };
        if (adminState.feedbackType) params.type = adminState.feedbackType;

        dashboardApi.getAllFeedbackResponses(params).then(function(data) {
            if (!data || !data.responses) {
                container.innerHTML = '<div class="dgd-section-card"><p style="color:var(--dgd-gray-500);">Keine Feedback-Daten verfuegbar.</p></div>';
                return;
            }

            var responses = data.responses;
            var total = data.total || 0;
            var html = '';

            // Stats bar
            html += '<div class="dgd-stats-row" style="margin-bottom:1.5rem;">';
            html += '<div class="dgd-stat-card"><div class="dgd-stat-card__value">' + total + '</div><div class="dgd-stat-card__label">Feedback gesamt</div></div>';
            html += '</div>';

            // Filter pills
            html += '<div class="dgd-filter-row" style="margin-bottom:1rem;">';
            var types = [{ key: '', label: 'Alle' }, { key: 'pulse', label: 'Pulse' }, { key: '360', label: '360-Grad' }, { key: 'exit', label: 'Exit' }, { key: 'custom', label: 'Custom' }];
            for (var t = 0; t < types.length; t++) {
                var active = adminState.feedbackType === types[t].key ? ' dgd-filter-pill--active' : '';
                html += '<button class="dgd-filter-pill' + active + '" data-admin-filter="' + types[t].key + '">' + types[t].label + '</button>';
            }
            html += '</div>';

            if (responses.length === 0) {
                html += '<div class="dgd-section-card"><p style="color:var(--dgd-gray-500);">Keine Eintraege fuer diesen Filter.</p></div>';
            } else {
                // Response cards
                for (var i = 0; i < responses.length; i++) {
                    var r = responses[i];
                    var typeColor = TYPE_COLORS[r.template_type] || '#666';
                    var typeLabel = TYPE_LABELS[r.template_type] || r.template_type;
                    var respondent = r.anonymous ? 'Anonym' : esc(r.respondent_name || r.respondent_username || 'Unbekannt');

                    html += '<div class="dgd-section-card dgd-admin-feedback-card" style="animation-delay:' + (i * 0.03) + 's">';

                    // Header row
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">';
                    html += '<div style="display:flex;align-items:center;gap:0.75rem;">';
                    html += '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;color:#fff;background:' + typeColor + ';">' + esc(typeLabel) + '</span>';
                    html += '<strong style="font-size:0.95rem;">' + esc(r.template_title || '') + '</strong>';
                    html += '</div>';
                    html += '<span style="font-size:0.8rem;color:var(--dgd-gray-500);">' + formatDate(r.created_at) + '</span>';
                    html += '</div>';

                    // Respondent
                    html += '<div style="font-size:0.85rem;color:var(--dgd-gray-600);margin-bottom:0.75rem;">';
                    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4-4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                    html += respondent;
                    html += '</div>';

                    // Q&A pairs
                    var questions = r.template_questions || [];
                    var answers = r.answers || [];
                    html += '<div class="dgd-admin-qa-list">';
                    for (var q = 0; q < questions.length; q++) {
                        var quest = questions[q];
                        var answer = answers[q];
                        if (answer === undefined || answer === null || answer === '') continue;

                        html += '<div class="dgd-admin-qa-item">';
                        html += '<div class="dgd-admin-qa-question">' + esc(quest.question || ('Frage ' + (q + 1))) + '</div>';

                        if (quest.type === 'scale') {
                            var val = parseFloat(answer) || 0;
                            var stars = '';
                            for (var s = 1; s <= 5; s++) {
                                stars += s <= val ? '<span style="color:#f39c12;">&#9733;</span>' : '<span style="color:var(--dgd-gray-300);">&#9733;</span>';
                            }
                            html += '<div class="dgd-admin-qa-answer">' + stars + ' <span style="font-weight:600;">' + val + '/5</span></div>';
                        } else if (quest.type === 'text') {
                            html += '<div class="dgd-admin-qa-answer dgd-admin-qa-answer--text">' + esc(String(answer)) + '</div>';
                        } else {
                            html += '<div class="dgd-admin-qa-answer">' + esc(String(answer)) + '</div>';
                        }
                        html += '</div>';
                    }
                    html += '</div>';

                    html += '</div>';
                }
            }

            // Pagination
            if (total > adminState.feedbackLimit) {
                var totalPages = Math.ceil(total / adminState.feedbackLimit);
                var currentPage = adminState.feedbackPage;
                html += '<div style="display:flex;justify-content:center;gap:0.5rem;margin-top:1rem;">';
                if (currentPage > 0) {
                    html += '<button class="dgd-btn dgd-btn--outline dgd-btn--sm" data-admin-page="' + (currentPage - 1) + '">Zurueck</button>';
                }
                html += '<span style="padding:0.4rem 0.75rem;font-size:0.85rem;color:var(--dgd-gray-600);">Seite ' + (currentPage + 1) + ' von ' + totalPages + '</span>';
                if (currentPage < totalPages - 1) {
                    html += '<button class="dgd-btn dgd-btn--outline dgd-btn--sm" data-admin-page="' + (currentPage + 1) + '">Weiter</button>';
                }
                html += '</div>';
            }

            container.innerHTML = html;

            // Bind filter clicks
            var filterBtns = container.querySelectorAll('[data-admin-filter]');
            for (var fb = 0; fb < filterBtns.length; fb++) {
                filterBtns[fb].addEventListener('click', function() {
                    adminState.feedbackType = this.getAttribute('data-admin-filter');
                    adminState.feedbackPage = 0;
                    renderFeedbackOverview(container);
                });
            }

            // Bind pagination clicks
            var pageBtns = container.querySelectorAll('[data-admin-page]');
            for (var pb = 0; pb < pageBtns.length; pb++) {
                pageBtns[pb].addEventListener('click', function() {
                    adminState.feedbackPage = parseInt(this.getAttribute('data-admin-page'));
                    renderFeedbackOverview(container);
                });
            }

        }).catch(function(err) {
            container.innerHTML = '<div class="dgd-section-card"><p style="color:#e74c3c;">Fehler beim Laden: ' + (err.message || 'Unbekannt') + '</p></div>';
        });
    }

    DGD.views.admin = function(container) {
        // Check admin role
        if (!DGD.state.user || DGD.state.user.role !== 'admin') {
            container.innerHTML = '<div class="dgd-section-card"><div class="dgd-alert dgd-alert--error">Zugriff verweigert. Nur Administratoren koennen dieses Panel sehen.</div></div>';
            return;
        }

        var html = '';
        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">';
        html += '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-4px;margin-right:6px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
        html += 'Admin Panel</h1>';
        html += '<div class="dgd-page-header__actions">';
        html += '</div>';
        html += '</div>';

        // Info banner
        html += '<div class="dgd-alert dgd-alert--info" style="margin-bottom:1.5rem;">';
        html += '<strong>Mitarbeiter-Feedback zentral im Blick.</strong> Hier siehst du alle Rueckmeldungen deines Teams – Pulse Checks, 360-Grad-Feedback und Exit-Interviews. So kannst du schnell auf Wuensche und Anpassungen reagieren.';
        html += '</div>';

        html += '<div id="admin-feedback-content"></div>';

        container.innerHTML = html;

        // Load feedback
        var feedbackContainer = document.getElementById('admin-feedback-content');
        if (feedbackContainer) {
            renderFeedbackOverview(feedbackContainer);
        }
    };
})();
