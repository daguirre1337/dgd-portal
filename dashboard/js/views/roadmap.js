/* ==========================================================================
   DGD Dashboard - View: Strategic Roadmap
   Swim-lane board with timeline, initiative cards, and status filters.
   Depends on: namespace.js, helpers.js, demo-data.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {
    'use strict';

    var STATUS_MAP = {
        planned:   { label: 'Geplant',        color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
        active:    { label: 'Aktiv',           color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
        completed: { label: 'Abgeschlossen',   color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
        'at-risk': { label: 'Gefaehrdet',      color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' }
    };

    var PRIORITY_COLORS = {
        hoch:    '#EF4444',
        mittel:  '#F59E0B',
        niedrig: '#94A3B8'
    };

    var QUARTERS = [
        { key: 'Q1', label: 'Q1 2026', start: '2026-01-01', end: '2026-03-31' },
        { key: 'Q2', label: 'Q2 2026', start: '2026-04-01', end: '2026-06-30' },
        { key: 'Q3', label: 'Q3 2026', start: '2026-07-01', end: '2026-09-30' }
    ];

    var activeFilter = 'all';

    /* ------------------------------------------------------------------
       Data: merge projects + goals into strategic initiatives
       ------------------------------------------------------------------ */

    function normalizeStatus(raw) {
        var map = {
            aktiv: 'active', geplant: 'planned', abgeschlossen: 'completed',
            pausiert: 'planned', on_track: 'active', at_risk: 'at-risk',
            behind: 'at-risk', completed: 'completed'
        };
        return map[raw] || 'planned';
    }

    function assignQuarter(startDate, endDate) {
        for (var i = 0; i < QUARTERS.length; i++) {
            var q = QUARTERS[i];
            if (startDate && startDate <= q.end && (!endDate || endDate >= q.start)) {
                return q.key;
            }
        }
        if (startDate && startDate > '2026-06-30') return 'Q3';
        return 'Q1';
    }

    function buildInitiatives(projects, goals) {
        var items = [];

        for (var i = 0; i < projects.length; i++) {
            var p = projects[i];
            var ms = p.milestones || [];
            var done = 0;
            for (var m = 0; m < ms.length; m++) { if (ms[m].completed) done++; }

            items.push({
                id: 'proj-' + p.id,
                title: p.title,
                status: normalizeStatus(p.status),
                progress: p.progress || 0,
                owner: p.owner || '',
                priority: p.priority || 'mittel',
                quarter: assignQuarter(p.start_date, p.end_date),
                milestoneDone: done,
                milestoneTotal: ms.length,
                source: 'project'
            });
        }

        for (var g = 0; g < goals.length; g++) {
            var gl = goals[g];
            var kr = gl.key_results || [];
            var krDone = 0;
            for (var k = 0; k < kr.length; k++) {
                if (kr[k].target_value > 0 && kr[k].current_value >= kr[k].target_value) krDone++;
            }

            items.push({
                id: 'goal-' + gl.id,
                title: gl.title,
                status: normalizeStatus(gl.status),
                progress: Math.round(gl.progress || 0),
                owner: gl.owner || 'Unternehmen',
                priority: 'hoch',
                quarter: 'Q' + (gl.quarter || 1),
                milestoneDone: krDone,
                milestoneTotal: kr.length,
                source: 'goal'
            });
        }

        return items;
    }

    /* ------------------------------------------------------------------
       Rendering
       ------------------------------------------------------------------ */

    function renderCard(item) {
        var esc = DGD.helpers.escapeHtml;
        var st = STATUS_MAP[item.status] || STATUS_MAP.planned;
        var prioColor = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.mittel;
        var sourceIcon = item.source === 'goal'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';

        return '<div class="roadmap-card" style="border-left:3px solid ' + prioColor + ';">' +
            '<div class="roadmap-card__header">' +
                '<span class="roadmap-card__title">' + esc(item.title) + '</span>' +
                '<span class="roadmap-card__badge" style="background:' + st.bg + ';color:' + st.color + ';">' + st.label + '</span>' +
            '</div>' +
            '<div class="roadmap-card__progress-row">' +
                '<div class="roadmap-card__progress-track">' +
                    '<div class="roadmap-card__progress-fill" style="width:' + item.progress + '%;background:' + st.color + ';"></div>' +
                '</div>' +
                '<span class="roadmap-card__pct">' + item.progress + '%</span>' +
            '</div>' +
            '<div class="roadmap-card__footer">' +
                '<span class="roadmap-card__owner">' + sourceIcon + ' ' + esc(item.owner) + '</span>' +
                '<span class="roadmap-card__milestones">' + item.milestoneDone + '/' + item.milestoneTotal + ' Meilensteine</span>' +
            '</div>' +
        '</div>';
    }

    function renderTimeline() {
        var today = new Date();
        var yearStart = new Date(2026, 0, 1);
        var yearSpan = new Date(2026, 8, 30) - yearStart; // Q1-Q3 span
        var elapsed = today - yearStart;
        var pct = Math.max(0, Math.min(100, (elapsed / yearSpan) * 100));

        var html = '<div class="roadmap-timeline">';
        for (var i = 0; i < QUARTERS.length; i++) {
            html += '<div class="roadmap-timeline__segment">' +
                '<span class="roadmap-timeline__label">' + QUARTERS[i].label + '</span>' +
            '</div>';
        }
        html += '<div class="roadmap-timeline__marker" style="left:' + pct.toFixed(1) + '%;" title="Heute: ' + today.toLocaleDateString('de-DE') + '">' +
            '<div class="roadmap-timeline__marker-dot"></div>' +
            '<span class="roadmap-timeline__marker-label">Heute</span>' +
        '</div>';
        html += '</div>';
        return html;
    }

    function renderFilters() {
        var filters = [
            { key: 'all',       label: 'Alle' },
            { key: 'active',    label: 'Aktiv' },
            { key: 'planned',   label: 'Geplant' },
            { key: 'at-risk',   label: 'Gefaehrdet' },
            { key: 'completed', label: 'Abgeschlossen' }
        ];
        var html = '<div class="roadmap-filters">';
        for (var i = 0; i < filters.length; i++) {
            var f = filters[i];
            var cls = 'roadmap-filter-btn' + (activeFilter === f.key ? ' roadmap-filter-btn--active' : '');
            html += '<button class="' + cls + '" data-filter="' + f.key + '">' + f.label + '</button>';
        }
        html += '</div>';
        return html;
    }

    function renderBoard(initiatives) {
        var filtered = activeFilter === 'all'
            ? initiatives
            : initiatives.filter(function(it) { return it.status === activeFilter; });

        var lanes = {};
        for (var q = 0; q < QUARTERS.length; q++) {
            lanes[QUARTERS[q].key] = [];
        }

        for (var i = 0; i < filtered.length; i++) {
            var qKey = filtered[i].quarter;
            if (lanes[qKey]) {
                lanes[qKey].push(filtered[i]);
            } else if (lanes.Q3) {
                lanes.Q3.push(filtered[i]);
            }
        }

        var html = '<div class="roadmap-board">';
        for (var q = 0; q < QUARTERS.length; q++) {
            var key = QUARTERS[q].key;
            var cards = lanes[key];
            html += '<div class="roadmap-lane">';
            html += '<div class="roadmap-lane__header">' + QUARTERS[q].label +
                ' <span class="roadmap-lane__count">' + cards.length + '</span></div>';
            html += '<div class="roadmap-lane__body">';
            for (var c = 0; c < cards.length; c++) {
                html += renderCard(cards[c]);
            }
            if (cards.length === 0) {
                html += '<div class="roadmap-lane__empty">Keine Initiativen</div>';
            }
            html += '</div></div>';
        }
        html += '</div>';
        return html;
    }

    function renderSummary(initiatives) {
        var counts = { planned: 0, active: 0, completed: 0, 'at-risk': 0 };
        for (var i = 0; i < initiatives.length; i++) {
            counts[initiatives[i].status] = (counts[initiatives[i].status] || 0) + 1;
        }
        var html = '<div class="roadmap-summary">';
        var keys = ['active', 'planned', 'at-risk', 'completed'];
        for (var k = 0; k < keys.length; k++) {
            var st = STATUS_MAP[keys[k]];
            html += '<div class="roadmap-summary__item">' +
                '<div class="roadmap-summary__count" style="color:' + st.color + ';">' + (counts[keys[k]] || 0) + '</div>' +
                '<div class="roadmap-summary__label">' + st.label + '</div>' +
            '</div>';
        }
        html += '</div>';
        return html;
    }

    /* ------------------------------------------------------------------
       Main view function
       ------------------------------------------------------------------ */

    function render(container, projects, goals) {
        var initiatives = buildInitiatives(projects, goals);

        var html = '<div class="roadmap-view">';
        html += '<div class="roadmap-header">';
        html += '<h2 class="roadmap-title">Strategische Roadmap 2026</h2>';
        html += '<p class="roadmap-subtitle">Projekte und Unternehmensziele im Ueberblick</p>';
        html += '</div>';
        html += renderSummary(initiatives);
        html += renderFilters();
        html += renderTimeline();
        html += renderBoard(initiatives);
        html += '</div>';

        container.innerHTML = html;

        // Bind filter buttons
        var btns = container.querySelectorAll('.roadmap-filter-btn');
        for (var b = 0; b < btns.length; b++) {
            btns[b].addEventListener('click', function(e) {
                activeFilter = e.target.getAttribute('data-filter');
                render(container, projects, goals);
            });
        }
    }

    /* ------------------------------------------------------------------
       Public view entry point
       ------------------------------------------------------------------ */

    DGD.views.roadmap = function(container) {
        var projects = DGD.state.projects || [];
        var goals = DGD.demoData.DEMO_GOALS || [];

        // Try live API, fall back to demo data
        var projectsPromise = dashboardApi._fetch('/projects')
            .then(function(data) {
                return (data && data.projects) ? data.projects : projects;
            })
            .catch(function() { return projects; });

        var goalsPromise = dashboardApi._fetch('/goals')
            .then(function(data) {
                return (data && data.goals) ? data.goals : goals;
            })
            .catch(function() { return goals; });

        // Show loading state
        container.innerHTML = '<div class="roadmap-view"><div class="roadmap-loading">Lade Roadmap...</div></div>';

        Promise.all([projectsPromise, goalsPromise]).then(function(results) {
            var p = results[0] || DGD.demoData.DEMO_PROJECTS;
            var g = results[1] || DGD.demoData.DEMO_GOALS;
            render(container, p, g);
        });
    };

})();
