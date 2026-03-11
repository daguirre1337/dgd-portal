/* ==========================================================================
   DGD Dashboard - View: Ziele (Goals / OKR)
   Depends on: namespace.js, helpers.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {
    var goalsState = { selectedQuarter: 1, selectedYear: 2026 };

    function renderGoalCard(goal, level) {
        var escapeHtml = DGD.helpers.escapeHtml;
        var renderProgressRing = DGD.helpers.renderProgressRing;

        var statusColors = { on_track: '#27ae60', at_risk: '#f39c12', behind: '#e74c3c', completed: '#3498db' };
        var statusLabels = { on_track: 'On Track', at_risk: 'At Risk', behind: 'Behind', completed: 'Abgeschlossen' };
        var color = statusColors[goal.status] || '#6c757d';
        var indent = level > 0 ? 'margin-left:2rem;' : '';
        var typeBadge = goal.type === 'company' ? 'Unternehmen' : (goal.owner || 'Team');

        var html = `<div class="dgd-goal-card" style="border-left-color:${color};${indent}">`;
        html += '<div class="dgd-goal-card__header">';
        html += DGD.helpers.renderProgressRing(goal.progress, color, 40);
        html += '<div class="dgd-goal-card__info">';
        html += `<div class="dgd-goal-card__title">${DGD.helpers.escapeHtml(goal.title)}</div>`;
        html += '<div class="dgd-goal-card__meta">';
        html += `<span class="dgd-badge dgd-badge--${goal.type === 'company' ? 'portal' : 'intern'}">${DGD.helpers.escapeHtml(typeBadge)}</span>`;
        html += `<span class="dgd-goal-card__status" style="color:${color}">${DGD.helpers.escapeHtml(statusLabels[goal.status] || goal.status)}</span>`;
        html += '</div></div>';
        html += `<span style="font-size:1.25rem;font-weight:700;color:${color}">${goal.progress}%</span>`;
        html += '</div>';

        // Key Results
        if (goal.key_results && goal.key_results.length > 0) {
            html += '<div class="dgd-goal-card__krs">';
            for (var k = 0; k < goal.key_results.length; k++) {
                var kr = goal.key_results[k];
                var krPct = kr.target_value > 0 ? Math.min(100, Math.round((kr.current_value / kr.target_value) * 100)) : 0;
                var krColor = krPct >= 80 ? '#27ae60' : (krPct >= 50 ? '#f39c12' : '#e74c3c');
                html += '<div class="dgd-goal-card__kr">';
                html += `<div class="dgd-goal-card__kr-title">${DGD.helpers.escapeHtml(kr.title)}</div>`;
                html += '<div class="dgd-goal-card__kr-bar">';
                html += `<div class="dgd-goal-card__kr-fill" style="width:${krPct}%;background:${krColor}"></div>`;
                html += '</div>';
                html += `<span class="dgd-goal-card__kr-val">${kr.current_value} / ${kr.target_value} ${DGD.helpers.escapeHtml(kr.unit)}</span>`;
                html += '</div>';
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function openGoalModal() {
        var DEMO_GOALS = DGD.demoData.DEMO_GOALS;
        var $ = DGD.helpers.$;
        var mc = document.getElementById('modal-container');
        var html = '<div class="dgd-modal-overlay" id="goal-modal-overlay">';
        html += '<div class="dgd-modal">';
        html += '<div class="dgd-modal__header"><h3>Neues Ziel</h3><button class="dgd-modal__close" id="goal-modal-close">&times;</button></div>';
        html += '<div class="dgd-modal__body">';
        html += '<form id="goal-form" class="dgd-form">';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Titel</label><input type="text" class="dgd-form__input" id="goal-title" required></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Beschreibung</label><textarea class="dgd-form__input" id="goal-desc" rows="3"></textarea></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Typ</label><select class="dgd-form__input" id="goal-type"><option value="company">Unternehmen</option><option value="team">Team</option><option value="personal">Persoenlich</option></select></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Verantwortlich</label><input type="text" class="dgd-form__input" id="goal-owner" placeholder="z.B. Marketing"></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Quartal</label><select class="dgd-form__input" id="goal-quarter"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Jahr</label><input type="number" class="dgd-form__input" id="goal-year" value="2026"></div>';
        html += '</form></div>';
        html += '<div class="dgd-modal__footer"><button class="dgd-btn dgd-btn--outline" id="goal-cancel">Abbrechen</button><button class="dgd-btn dgd-btn--primary" id="goal-save">Speichern</button></div>';
        html += '</div></div>';
        mc.innerHTML = html;

        var closeModal = function() { mc.innerHTML = ''; };
        document.getElementById('goal-modal-close').addEventListener('click', closeModal);
        document.getElementById('goal-cancel').addEventListener('click', closeModal);
        document.getElementById('goal-modal-overlay').addEventListener('click', function(ev) {
            if (ev.target === this) closeModal();
        });
        document.getElementById('goal-save').addEventListener('click', function() {
            var title = document.getElementById('goal-title').value;
            if (title) {
                DGD.demoData.DEMO_GOALS.push({
                    id: DGD.demoData.DEMO_GOALS.length + 1,
                    title: title,
                    type: document.getElementById('goal-type').value,
                    owner: document.getElementById('goal-owner').value,
                    quarter: parseInt(document.getElementById('goal-quarter').value),
                    year: parseInt(document.getElementById('goal-year').value),
                    status: 'on_track',
                    progress: 0,
                    key_results: []
                });
                closeModal();
                DGD.views.ziele($('#main-content'));
            }
        });
    }

    DGD.views.ziele = function(container) {
        var DEMO_GOALS = DGD.demoData.DEMO_GOALS;
        var html = '';
        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Ziele & OKR</h1>';
        html += '<div class="dgd-page-header__actions">';
        html += '<button class="dgd-btn dgd-btn--primary" id="btn-new-goal">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        html += ' Neues Ziel</button>';
        html += (DGD.export ? DGD.export.buttonHtml('goals') : '');
        html += '</div></div>';

        // Quarter selector
        html += '<div class="dgd-filter-row">';
        for (var q = 1; q <= 4; q++) {
            var activeQ = q === goalsState.selectedQuarter ? ' dgd-filter-pill--active' : '';
            html += `<button class="dgd-filter-pill${activeQ}" data-quarter="${q}">Q${q}</button>`;
        }
        html += `<button class="dgd-filter-pill dgd-filter-pill--active" disabled style="margin-left:auto;cursor:default;">${goalsState.selectedYear}</button>`;
        html += '</div>';

        // Stats bar
        var stats = { total: 0, on_track: 0, at_risk: 0, behind: 0, completed: 0 };
        var filtered = [];
        for (var g = 0; g < DGD.demoData.DEMO_GOALS.length; g++) {
            var gl = DGD.demoData.DEMO_GOALS[g];
            if (gl.quarter === goalsState.selectedQuarter && gl.year === goalsState.selectedYear) {
                filtered.push(gl);
                stats.total++;
                if (gl.status === 'on_track') stats.on_track++;
                else if (gl.status === 'at_risk') stats.at_risk++;
                else if (gl.status === 'behind') stats.behind++;
                else if (gl.status === 'completed') stats.completed++;
            }
        }

        html += '<div class="dgd-goals-stats">';
        html += `<div class="dgd-goals-stats__item"><span class="dgd-goals-stats__num">${stats.total}</span><span class="dgd-goals-stats__label">Gesamt</span></div>`;
        html += `<div class="dgd-goals-stats__item dgd-goals-stats__item--on_track"><span class="dgd-goals-stats__num">${stats.on_track}</span><span class="dgd-goals-stats__label">On Track</span></div>`;
        html += `<div class="dgd-goals-stats__item dgd-goals-stats__item--at_risk"><span class="dgd-goals-stats__num">${stats.at_risk}</span><span class="dgd-goals-stats__label">At Risk</span></div>`;
        html += `<div class="dgd-goals-stats__item dgd-goals-stats__item--behind"><span class="dgd-goals-stats__num">${stats.behind}</span><span class="dgd-goals-stats__label">Behind</span></div>`;
        html += `<div class="dgd-goals-stats__item dgd-goals-stats__item--completed"><span class="dgd-goals-stats__num">${stats.completed}</span><span class="dgd-goals-stats__label">Completed</span></div>`;
        html += '</div>';

        // Goals tree - company goals first, then team goals nested under parents
        var companyGoals = [];
        var teamGoals = [];
        for (var f = 0; f < filtered.length; f++) {
            if (filtered[f].type === 'company') companyGoals.push(filtered[f]);
            else teamGoals.push(filtered[f]);
        }

        for (var cg = 0; cg < companyGoals.length; cg++) {
            html += renderGoalCard(companyGoals[cg], 0);
            // Nested team goals
            for (var tg = 0; tg < teamGoals.length; tg++) {
                if (teamGoals[tg].parent_goal_id === companyGoals[cg].id) {
                    html += renderGoalCard(teamGoals[tg], 1);
                }
            }
        }
        // Team goals without parent
        for (var tg2 = 0; tg2 < teamGoals.length; tg2++) {
            if (!teamGoals[tg2].parent_goal_id) {
                html += renderGoalCard(teamGoals[tg2], 0);
            }
        }

        container.innerHTML = html;

        // Quarter filter clicks
        var qBtns = container.querySelectorAll('[data-quarter]');
        for (var qi = 0; qi < qBtns.length; qi++) {
            qBtns[qi].addEventListener('click', function() {
                goalsState.selectedQuarter = parseInt(this.getAttribute('data-quarter'));
                DGD.views.ziele(container);
            });
        }

        // New goal button
        var btnGoal = document.getElementById('btn-new-goal');
        if (btnGoal) {
            btnGoal.addEventListener('click', function() {
                openGoalModal();
            });
        }
    };
})();
