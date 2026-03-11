/* ==========================================================================
   DGD Dashboard - View: KPI Cockpit
   Depends on: namespace.js, helpers.js
   ========================================================================== */

(function() {
    var CATEGORY_COLORS = DGD.config.CATEGORY_COLORS;

    var FA_TO_EMOJI = {
        'fa-file-alt': '\ud83d\udccb', 'fa-handshake': '\ud83e\udd1d', 'fa-euro-sign': '\ud83d\udcb0',
        'fa-chart-line': '\ud83c\udf10', 'fa-percentage': '\ud83d\udcca', 'fa-calculator': '\ud83e\uddee',
        'fa-user-plus': '\ud83d\udc65', 'fa-star': '\u2b50'
    };

    function renderKpiCard(kpi) {
        var escapeHtml = DGD.helpers.escapeHtml;
        var formatCurrency = DGD.helpers.formatCurrency;
        var renderSparkline = DGD.helpers.renderSparkline;

        var catClass = 'dgd-kpi-card--' + DGD.helpers.escapeHtml(kpi.category || '');
        var pct = kpi.target ? Math.min(100, Math.round((kpi.value / kpi.target) * 100)) : 0;
        var displayValue = kpi.unit === '\u20ac' ? DGD.helpers.formatCurrency(kpi.value) : kpi.value;
        var color = CATEGORY_COLORS[kpi.category] || '#6c757d';
        var icon = kpi.icon || '';
        if (FA_TO_EMOJI[icon]) icon = FA_TO_EMOJI[icon];

        // Alert thresholds
        var alertLevel = ''; // '', 'warning', 'critical'
        if (kpi.target) {
            if (kpi.invertTrend) {
                // Lower is better (e.g. Durchlaufzeit): alert when far above target
                if (kpi.value > kpi.target * 1.5) alertLevel = 'critical';
                else if (kpi.value > kpi.target * 1.2) alertLevel = 'warning';
            } else {
                // Higher is better: alert when far below target
                if (pct < 40) alertLevel = 'critical';
                else if (pct < 60) alertLevel = 'warning';
            }
        }

        // Delta calculation
        var delta = kpi.value - (kpi.prevValue != null ? kpi.prevValue : kpi.value);
        var deltaPct = kpi.prevValue ? (Math.abs(delta / kpi.prevValue) * 100).toFixed(1) : '0.0';
        var deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';
        if (kpi.invertTrend) {
            deltaClass = delta < 0 ? 'up' : delta > 0 ? 'down' : 'stable';
        }
        var deltaSign = delta > 0 ? '+' : delta < 0 ? '-' : '';
        var absDelta = Math.abs(delta);
        var deltaDisplay;
        if (kpi.unit === '\u20ac') {
            deltaDisplay = DGD.helpers.formatCurrency(absDelta);
        } else if (kpi.unit === '%' || kpi.unit === '/ 5') {
            deltaDisplay = absDelta.toFixed(1);
        } else if (absDelta !== Math.round(absDelta)) {
            deltaDisplay = absDelta.toFixed(1);
        } else {
            deltaDisplay = absDelta;
        }

        var alertClass = alertLevel ? ' dgd-kpi-card--alert-' + alertLevel : '';
        var html = `<div class="dgd-kpi-card ${catClass}${alertClass}">`;

        // Header: icon + label + alert indicator
        html += '<div class="dgd-kpi-card__header">';
        html += `<span class="dgd-kpi-card__icon">${icon}</span>`;
        html += `<span class="dgd-kpi-card__label">${DGD.helpers.escapeHtml(kpi.name)}</span>`;
        if (alertLevel) {
            var bellColor = alertLevel === 'critical' ? '#e74c3c' : '#f39c12';
            html += `<svg class="dgd-kpi-card__alert-icon" width="14" height="14" viewBox="0 0 24 24" fill="${bellColor}" stroke="none"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`;
        }
        if (kpi._tellent) {
            html += '<span class="dgd-kpi-card__live">LIVE</span>';
        }
        html += '</div>';

        // Value + Delta row
        html += '<div class="dgd-kpi-card__value-row">';
        html += `<span class="dgd-kpi-card__value">${DGD.helpers.escapeHtml(String(displayValue))}<span class="dgd-kpi-card__unit">${DGD.helpers.escapeHtml(kpi.unit)}</span></span>`;
        html += `<span class="dgd-kpi-card__delta dgd-kpi-card__delta--${deltaClass}">`;
        html += `${deltaSign}${deltaDisplay} (${deltaSign}${deltaPct}%)`;
        html += '</span>';
        html += '</div>';

        // Sparkline (28-day trend) with target threshold line
        if (kpi.daily && kpi.daily.length > 0) {
            html += DGD.helpers.renderSparkline(kpi.daily, color, kpi.id, kpi.target || null);
        }

        // Monthly values
        if (kpi.monthly && kpi.monthly.length > 0) {
            html += '<div class="dgd-kpi-card__monthly">';
            for (var m = 0; m < kpi.monthly.length; m++) {
                var mon = kpi.monthly[m];
                var monVal = kpi.unit === '\u20ac' ? DGD.helpers.formatCurrency(mon.value) : mon.value;
                html += '<div class="dgd-kpi-card__monthly-item">';
                html += `<span class="dgd-kpi-card__monthly-label">${DGD.helpers.escapeHtml(mon.label)}</span>`;
                html += `<span class="dgd-kpi-card__monthly-val">${DGD.helpers.escapeHtml(String(monVal))}</span>`;
                html += '</div>';
            }
            html += '</div>';
        }

        // Target progress bar
        if (kpi.target) {
            html += '<div class="dgd-kpi-card__target">';
            html += `<div class="dgd-kpi-card__target-bar"><div class="dgd-kpi-card__target-fill" style="width:${pct}%"></div></div>`;
            html += `<div class="dgd-kpi-card__target-text"><span>${pct}% erreicht</span><span>Ziel: ${DGD.helpers.escapeHtml(String(kpi.target))} ${DGD.helpers.escapeHtml(kpi.unit)}</span></div>`;
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // Expose renderKpiCard for use by dashboard view
    DGD.views._renderKpiCard = renderKpiCard;
    DGD.views._CATEGORY_COLORS = CATEGORY_COLORS;

    DGD.views.kpis = function(container) {
        var state = DGD.state;
        var html = '';
        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">KPI Cockpit</h1>';
        html += '</div>';

        html += '<div class="dgd-kpi-grid">';
        for (var i = 0; i < DGD.state.kpis.length; i++) {
            html += renderKpiCard(DGD.state.kpis[i]);
        }
        html += '</div>';

        container.innerHTML = html;
    };
})();
