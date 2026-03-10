/* ==========================================================================
   DGD Dashboard - View: Timeline
   ========================================================================== */

DGD.views.timeline = (function() {
    'use strict';

    var h = DGD.helpers;

    function render(container) {
        var html = '';

        html += `<div class="dgd-page-header">`;
        html += `<h1 class="dgd-page-header__title">Zeitleiste</h1>`;
        html += `<div class="dgd-page-header__actions">`;
        html += `<button class="dgd-btn dgd-btn--primary" id="btn-new-project">`;
        html += `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
        html += ` Neues Projekt</button>`;
        html += `</div></div>`;

        html += `<div class="dgd-filter-row" id="filter-row">`;
        html += renderFilterPills();
        html += `</div>`;

        html += `<div id="gantt-container" class="dgd-gantt-wrapper"></div>`;
        html += `<div id="timeline-container"></div>`;

        container.innerHTML = html;

        var btnNew = document.getElementById('btn-new-project');
        if (btnNew) {
            btnNew.addEventListener('click', function() { DGD.modals.openProjectModal(null); });
        }

        bindFilterPills();
        renderFilteredTimeline();

        var ganttEl = document.getElementById('gantt-container');
        if (ganttEl) {
            Gantt.render(ganttEl, DGD.state.projects, {
                onProjectClick: function(id) { DGD.modals.openProjectModal(id); },
            });
        }
    }

    function renderFilterPills() {
        var categories = [
            { key: null, label: 'Alle' },
            { key: 'portal', label: 'Portal' },
            { key: 'marketing', label: 'Marketing' },
            { key: 'partner', label: 'Partner' },
            { key: 'intern', label: 'Intern' },
            { key: 'kunde', label: 'Kunde' },
        ];
        var statuses = [
            { key: null, label: 'Alle Status' },
            { key: 'aktiv', label: 'Aktiv' },
            { key: 'geplant', label: 'Geplant' },
            { key: 'abgeschlossen', label: 'Abgeschlossen' },
            { key: 'pausiert', label: 'Pausiert' },
        ];

        var html = '';
        for (var i = 0; i < categories.length; i++) {
            var c = categories[i];
            var active = DGD.state.filters.category === c.key ? ' dgd-filter-pill--active' : '';
            html += `<button class="dgd-filter-pill${active}" data-filter-type="category" data-filter-value="${c.key || ''}">${h.escapeHtml(c.label)}</button>`;
        }
        html += `<span style="width:1px;background:var(--dgd-gray-300);margin:0 0.25rem;"></span>`;
        for (var j = 0; j < statuses.length; j++) {
            var s = statuses[j];
            var activeS = DGD.state.filters.status === s.key ? ' dgd-filter-pill--active' : '';
            html += `<button class="dgd-filter-pill${activeS}" data-filter-type="status" data-filter-value="${s.key || ''}">${h.escapeHtml(s.label)}</button>`;
        }
        return html;
    }

    function bindFilterPills() {
        var pills = h.$$('.dgd-filter-pill');
        for (var i = 0; i < pills.length; i++) {
            (function(pill) {
                pill.addEventListener('click', function() {
                    var type = pill.getAttribute('data-filter-type');
                    var value = pill.getAttribute('data-filter-value') || null;
                    DGD.state.filters[type] = value;

                    var siblings = h.$$('.dgd-filter-pill[data-filter-type="' + type + '"]');
                    for (var j = 0; j < siblings.length; j++) {
                        siblings[j].classList.remove('dgd-filter-pill--active');
                    }
                    pill.classList.add('dgd-filter-pill--active');

                    renderFilteredTimeline();
                });
            })(pills[i]);
        }
    }

    function renderFilteredTimeline() {
        var filtered = DGD.state.projects.slice();
        if (DGD.state.filters.category) {
            filtered = filtered.filter(function(p) { return p.category === DGD.state.filters.category; });
        }
        if (DGD.state.filters.status) {
            filtered = filtered.filter(function(p) { return p.status === DGD.state.filters.status; });
        }

        var timelineEl = document.getElementById('timeline-container');
        if (timelineEl) {
            Timeline.render(timelineEl, filtered, {
                compact: false,
                onProjectClick: function(id) {
                    DGD.modals.openProjectModal(id);
                },
            });
        }

        var ganttEl = document.getElementById('gantt-container');
        if (ganttEl) {
            Gantt.render(ganttEl, filtered, {
                onProjectClick: function(id) { DGD.modals.openProjectModal(id); },
            });
        }
    }

    return {
        render: render,
        renderFilterPills: renderFilterPills,
        bindFilterPills: bindFilterPills,
        renderFilteredTimeline: renderFilteredTimeline,
    };
})();
