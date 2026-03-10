/* ==========================================================================
   DGD Dashboard - View: Dashboard (Overview)
   Depends on: namespace.js, helpers.js, views/kpis.js (renderKpiCard)
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

DGD.views.dashboard = function(container) {
    var state = DGD.state;
    var escapeHtml = DGD.helpers.escapeHtml;
    var formatCurrency = DGD.helpers.formatCurrency;
    var DEMO_GOALS = DGD.demoData.DEMO_GOALS;
    var DEMO_FINANCE = DGD.demoData.DEMO_FINANCE;
    var DEMO_FEEDBACK = DGD.demoData.DEMO_FEEDBACK;

    // Pick top 4 KPIs for the overview, prioritize key categories
    var priorityOrder = ['kunden', 'partner', 'umsatz', 'portal'];
    var sorted = DGD.state.kpis.slice().sort(function(a, b) {
        var ai = priorityOrder.indexOf(a.category);
        var bi = priorityOrder.indexOf(b.category);
        if (ai === -1) ai = 99;
        if (bi === -1) bi = 99;
        return ai - bi;
    });
    var topKpis = sorted.slice(0, 4);

    var html = '';

    // KPI row
    html += '<div class="dgd-kpi-grid" style="margin-bottom:2rem;">';
    for (var k = 0; k < topKpis.length; k++) {
        html += DGD.views._renderKpiCard(topKpis[k]);
    }
    html += '</div>';

    // Business summary row (Goals + Finance + Pulse)
    html += '<div class="dgd-dashboard-biz-row">';

    // Goals summary card
    var gStats = { on_track: 0, at_risk: 0, behind: 0 };
    for (var gi = 0; gi < DGD.demoData.DEMO_GOALS.length; gi++) {
        var gs = DGD.demoData.DEMO_GOALS[gi].status;
        if (gs === 'on_track') gStats.on_track++;
        else if (gs === 'at_risk') gStats.at_risk++;
        else if (gs === 'behind') gStats.behind++;
    }
    html += '<div class="dgd-section-card" style="animation-delay:0.25s;flex:1;min-width:200px;">';
    html += '<div class="dgd-section-card__title">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
    html += ' Ziele</div>';
    html += '<div style="display:flex;gap:1rem;margin-bottom:0.5rem;">';
    html += `<div style="text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:#27ae60;">${gStats.on_track}</div><div style="font-size:0.7rem;color:var(--dgd-gray-500);">On Track</div></div>`;
    html += `<div style="text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:#f39c12;">${gStats.at_risk}</div><div style="font-size:0.7rem;color:var(--dgd-gray-500);">At Risk</div></div>`;
    html += `<div style="text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:#e74c3c;">${gStats.behind}</div><div style="font-size:0.7rem;color:var(--dgd-gray-500);">Behind</div></div>`;
    html += '</div>';
    html += '<a href="#ziele" class="dgd-section-card__link">Alle Ziele &rarr;</a>';
    html += '</div>';

    // Finance mini-card
    var fin = DGD.demoData.DEMO_FINANCE.summary;
    html += '<div class="dgd-section-card" style="animation-delay:0.3s;flex:1;min-width:200px;">';
    html += '<div class="dgd-section-card__title">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>';
    html += ' Finanzen (Monat)</div>';
    html += '<div style="display:flex;flex-direction:column;gap:0.5rem;font-size:var(--dgd-font-size-sm);">';
    html += `<div style="display:flex;justify-content:space-between;"><span style="color:var(--dgd-gray-600);">Umsatz</span><span style="font-weight:700;color:#27ae60;">${DGD.helpers.formatCurrency(fin.revenue)} \u20ac</span></div>`;
    html += `<div style="display:flex;justify-content:space-between;"><span style="color:var(--dgd-gray-600);">Kosten</span><span style="font-weight:700;color:#e74c3c;">${DGD.helpers.formatCurrency(fin.costs)} \u20ac</span></div>`;
    html += `<div style="display:flex;justify-content:space-between;border-top:1px solid var(--dgd-gray-200);padding-top:0.35rem;"><span style="font-weight:600;">Gewinn</span><span style="font-weight:700;color:#27ae60;">${DGD.helpers.formatCurrency(fin.profit)} \u20ac</span></div>`;
    html += '</div>';
    html += '<a href="#finanzen" class="dgd-section-card__link">Details &rarr;</a>';
    html += '</div>';

    // Latest pulse score
    var latestPulse = DGD.demoData.DEMO_FEEDBACK.trends[DGD.demoData.DEMO_FEEDBACK.trends.length - 1];
    var pulseAvg = ((latestPulse.satisfaction + latestPulse.workload + latestPulse.teamspirit) / 3).toFixed(1);
    html += '<div class="dgd-section-card" style="animation-delay:0.35s;flex:1;min-width:200px;">';
    html += '<div class="dgd-section-card__title">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
    html += ' Pulse Score</div>';
    html += '<div style="text-align:center;margin:0.5rem 0;">';
    html += `<div style="font-size:2rem;font-weight:700;color:#3498db;">${pulseAvg}<span style="font-size:1rem;color:var(--dgd-gray-500);"> / 5</span></div>`;
    html += `<div style="font-size:0.75rem;color:var(--dgd-gray-500);">Durchschnitt ${DGD.helpers.escapeHtml(latestPulse.week)}</div>`;
    html += '</div>';
    html += '<a href="#feedback" class="dgd-section-card__link">Feedback &rarr;</a>';
    html += '</div>';

    html += '</div>';

    // Projects section
    html += '<div class="dgd-section-card" style="animation-delay:0.4s;">';
    html += '<div class="dgd-section-card__title">';
    html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    html += ' Aktuelle Projekte</div>';
    html += '<div id="dashboard-timeline"></div>';
    html += '<a href="#timeline" class="dgd-section-card__link">Alle Projekte anzeigen &rarr;</a>';
    html += '</div>';

    container.innerHTML = html;

    // Render compact timeline (last 5 projects)
    var recentProjects = DGD.state.projects.slice(0, 5);
    var timelineContainer = document.getElementById('dashboard-timeline');
    if (timelineContainer) {
        Timeline.render(timelineContainer, recentProjects, {
            compact: true,
            onProjectClick: function(id) {
                DGD.modals.openProjectModal(id);
            },
        });
    }
};
