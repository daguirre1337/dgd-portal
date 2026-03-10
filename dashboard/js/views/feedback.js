/* ==========================================================================
   DGD Dashboard - View: Feedback
   Depends on: namespace.js, helpers.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {
    var feedbackState = { tab: 'pulse' };

    function renderPulseTab() {
        var escapeHtml = DGD.helpers.escapeHtml;
        var DEMO_FEEDBACK = DGD.demoData.DEMO_FEEDBACK;
        var html = '';

        // Pulse status
        html += '<div class="dgd-section-card" style="animation-delay:0.05s">';
        if (DGD.demoData.DEMO_FEEDBACK.pulse_filled) {
            html += '<div class="dgd-alert dgd-alert--success">Dein Pulse Check fuer diese Woche wurde abgegeben. Danke!</div>';
        } else {
            html += '<div class="dgd-section-card__title">Woechentlicher Pulse Check</div>';
            html += '<p style="color:var(--dgd-gray-600);font-size:var(--dgd-font-size-sm);margin-bottom:1rem;">Wie geht es dir diese Woche? Dein Feedback ist anonym.</p>';

            var questions = [
                { id: 'satisfaction', label: 'Zufriedenheit', emojis: ['\ud83d\ude1e', '\ud83d\ude15', '\ud83d\ude10', '\ud83d\ude42', '\ud83d\ude04'] },
                { id: 'workload', label: 'Workload', emojis: ['\ud83e\udee0', '\ud83d\ude23', '\ud83d\ude10', '\ud83d\ude0a', '\ud83d\udcaa'] },
                { id: 'teamspirit', label: 'Team-Spirit', emojis: ['\ud83d\udc94', '\ud83d\ude14', '\ud83d\ude10', '\ud83e\udd1d', '\ud83d\udd25'] }
            ];

            for (var q = 0; q < questions.length; q++) {
                var qu = questions[q];
                html += '<div class="dgd-pulse-question">';
                html += `<label class="dgd-pulse-question__label">${DGD.helpers.escapeHtml(qu.label)}</label>`;
                html += `<div class="dgd-pulse-rating" data-question="${qu.id}">`;
                for (var e = 0; e < qu.emojis.length; e++) {
                    html += `<button class="dgd-pulse-rating__btn" data-value="${e + 1}">${qu.emojis[e]}</button>`;
                }
                html += '</div></div>';
            }

            html += '<button class="dgd-btn dgd-btn--primary dgd-mt-md" id="pulse-submit-btn">Absenden</button>';
        }
        html += '</div>';

        // Weekly trend chart
        html += '<div class="dgd-section-card" style="animation-delay:0.15s">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
        html += ' Woechentlicher Trend (12 Wochen)</div>';
        html += renderPulseTrendChart(DGD.demoData.DEMO_FEEDBACK.trends);
        html += '</div>';

        return html;
    }

    function renderPulseTrendChart(trends) {
        var escapeHtml = DGD.helpers.escapeHtml;
        var w = 600, h = 200, padL = 40, padR = 20, padT = 20, padB = 40;
        var chartW = w - padL - padR;
        var chartH = h - padT - padB;
        var colors = { satisfaction: '#27ae60', workload: '#f39c12', teamspirit: '#3498db' };
        var labels = { satisfaction: 'Zufriedenheit', workload: 'Workload', teamspirit: 'Team-Spirit' };

        var svg = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block;" preserveAspectRatio="xMidYMid meet">`;

        // Y axis (1-5 scale)
        for (var y = 1; y <= 5; y++) {
            var yPos = padT + chartH - ((y - 1) / 4) * chartH;
            svg += `<line x1="${padL}" y1="${yPos}" x2="${w - padR}" y2="${yPos}" stroke="var(--dgd-gray-200)" stroke-width="1"/>`;
            svg += `<text x="${padL - 8}" y="${yPos + 4}" text-anchor="end" fill="var(--dgd-gray-500)" font-size="11" font-family="inherit">${y}</text>`;
        }

        // X axis labels
        for (var xi = 0; xi < trends.length; xi++) {
            var xPos = padL + (xi / (trends.length - 1)) * chartW;
            svg += `<text x="${xPos}" y="${h - 10}" text-anchor="middle" fill="var(--dgd-gray-500)" font-size="10" font-family="inherit">${DGD.helpers.escapeHtml(trends[xi].week)}</text>`;
        }

        // Draw lines for each metric
        var keys = ['satisfaction', 'workload', 'teamspirit'];
        for (var ki = 0; ki < keys.length; ki++) {
            var key = keys[ki];
            var points = [];
            for (var pi = 0; pi < trends.length; pi++) {
                var px = padL + (pi / (trends.length - 1)) * chartW;
                var py = padT + chartH - ((trends[pi][key] - 1) / 4) * chartH;
                points.push(px.toFixed(1) + ',' + py.toFixed(1));
            }
            svg += `<polyline points="${points.join(' ')}" fill="none" stroke="${colors[key]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
            for (var di = 0; di < points.length; di++) {
                var dp = points[di].split(',');
                svg += `<circle cx="${dp[0]}" cy="${dp[1]}" r="3" fill="${colors[key]}" stroke="#fff" stroke-width="1.5"/>`;
            }
        }

        svg += '</svg>';

        // Legend
        svg += '<div style="display:flex;gap:1.5rem;justify-content:center;margin-top:0.75rem;font-size:0.8rem;">';
        for (var li = 0; li < keys.length; li++) {
            svg += `<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:3px;background:${colors[keys[li]]};border-radius:2px;display:inline-block;"></span> ${labels[keys[li]]}</span>`;
        }
        svg += '</div>';

        return svg;
    }

    function renderSurveysTab() {
        var escapeHtml = DGD.helpers.escapeHtml;
        var DEMO_FEEDBACK = DGD.demoData.DEMO_FEEDBACK;
        var html = '';

        html += '<div class="dgd-section-card" style="animation-delay:0.05s">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">';
        html += '<div class="dgd-section-card__title" style="margin-bottom:0">Umfrage-Vorlagen</div>';
        html += '</div>';

        for (var t = 0; t < DGD.demoData.DEMO_FEEDBACK.templates.length; t++) {
            var tpl = DGD.demoData.DEMO_FEEDBACK.templates[t];
            var typeBadgeClass = tpl.type === 'pulse' ? 'aktiv' : (tpl.type === '360' ? 'portal' : 'intern');
            var participation = tpl.responses > 0 ? Math.round((tpl.responses / 50) * 100) : 0;
            html += '<div class="dgd-survey-item">';
            html += '<div class="dgd-survey-item__header">';
            html += `<div><strong>${DGD.helpers.escapeHtml(tpl.title)}</strong>`;
            html += ` <span class="dgd-badge dgd-badge--${typeBadgeClass}">${DGD.helpers.escapeHtml(tpl.type)}</span>`;
            if (!tpl.active) html += ' <span class="dgd-badge dgd-badge--pausiert">Inaktiv</span>';
            html += '</div></div>';
            html += '<div class="dgd-survey-item__stats">';
            html += `<span>${tpl.questions} Fragen</span>`;
            html += `<span>${tpl.responses} Antworten</span>`;
            html += `<span>Teilnahme: ${participation}%</span>`;
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';

        return html;
    }

    function renderErgebnisseTab() {
        var DEMO_FEEDBACK = DGD.demoData.DEMO_FEEDBACK;
        var html = '';

        html += '<div class="dgd-section-card" style="animation-delay:0.05s">';
        html += '<div class="dgd-section-card__title">Ergebnisse: Woechentlicher Pulse Check</div>';
        html += '<p style="color:var(--dgd-gray-600);font-size:var(--dgd-font-size-sm);margin-bottom:1rem;">Aggregierte Ergebnisse der letzten 6 Wochen (anonym)</p>';

        var avgSat = 0, avgWork = 0, avgTeam = 0;
        var trends = DGD.demoData.DEMO_FEEDBACK.trends;
        for (var i = 0; i < trends.length; i++) {
            avgSat += trends[i].satisfaction;
            avgWork += trends[i].workload;
            avgTeam += trends[i].teamspirit;
        }
        avgSat = (avgSat / trends.length).toFixed(1);
        avgWork = (avgWork / trends.length).toFixed(1);
        avgTeam = (avgTeam / trends.length).toFixed(1);

        var metrics = [
            { label: 'Zufriedenheit', avg: avgSat, color: '#27ae60' },
            { label: 'Workload', avg: avgWork, color: '#f39c12' },
            { label: 'Team-Spirit', avg: avgTeam, color: '#3498db' }
        ];

        for (var m = 0; m < metrics.length; m++) {
            var met = metrics[m];
            var barPct = ((met.avg - 1) / 4) * 100;
            html += '<div style="margin-bottom:1rem;">';
            html += '<div style="display:flex;justify-content:space-between;margin-bottom:0.35rem;font-size:var(--dgd-font-size-sm);font-weight:600;">';
            html += `<span>${met.label}</span><span style="color:${met.color}">${met.avg} / 5</span></div>`;
            html += '<div style="height:8px;background:var(--dgd-gray-200);border-radius:4px;">';
            html += `<div style="width:${barPct}%;height:100%;background:${met.color};border-radius:4px;transition:width 0.6s ease;"></div>`;
            html += '</div></div>';
        }

        html += '<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--dgd-gray-200);">';
        html += '<div style="font-size:var(--dgd-font-size-sm);color:var(--dgd-gray-600);">Teilnahmerate: <strong>90%</strong> (45 von 50 Mitarbeitern)</div>';
        html += '</div>';
        html += '</div>';

        return html;
    }

    DGD.views.feedback = function(container) {
        var DEMO_FEEDBACK = DGD.demoData.DEMO_FEEDBACK;
        var html = '';
        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Feedback</h1>';
        html += '</div>';

        // Tabs
        html += '<div class="dgd-filter-row">';
        var tabs = [{ key: 'pulse', label: 'Pulse' }, { key: 'surveys', label: 'Umfragen' }, { key: 'ergebnisse', label: 'Ergebnisse' }];
        for (var t = 0; t < tabs.length; t++) {
            var activeT = tabs[t].key === feedbackState.tab ? ' dgd-filter-pill--active' : '';
            html += `<button class="dgd-filter-pill${activeT}" data-fb-tab="${tabs[t].key}">${tabs[t].label}</button>`;
        }
        html += '</div>';

        if (feedbackState.tab === 'pulse') {
            html += renderPulseTab();
        } else if (feedbackState.tab === 'surveys') {
            html += renderSurveysTab();
        } else {
            html += renderErgebnisseTab();
        }

        container.innerHTML = html;

        // Tab clicks
        var tabBtns = container.querySelectorAll('[data-fb-tab]');
        for (var tb = 0; tb < tabBtns.length; tb++) {
            tabBtns[tb].addEventListener('click', function() {
                feedbackState.tab = this.getAttribute('data-fb-tab');
                DGD.views.feedback(container);
            });
        }

        // Pulse form submit
        var pulseForm = document.getElementById('pulse-submit-btn');
        if (pulseForm) {
            pulseForm.addEventListener('click', function() {
                DGD.demoData.DEMO_FEEDBACK.pulse_filled = true;
                DGD.views.feedback(container);
            });
        }

        // Emoji rating clicks
        var ratingBtns = container.querySelectorAll('.dgd-pulse-rating__btn');
        for (var rb = 0; rb < ratingBtns.length; rb++) {
            ratingBtns[rb].addEventListener('click', function() {
                var group = this.parentElement;
                var siblings = group.querySelectorAll('.dgd-pulse-rating__btn');
                for (var s = 0; s < siblings.length; s++) {
                    siblings[s].classList.remove('dgd-pulse-rating__btn--active');
                }
                this.classList.add('dgd-pulse-rating__btn--active');
            });
        }
    };
})();
