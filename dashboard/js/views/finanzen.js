/* ==========================================================================
   DGD Dashboard - View: Finanzen (Finance)
   Depends on: namespace.js, helpers.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {
    var escapeHtml, formatCurrency, formatDate, $;

    function init() {
        escapeHtml = DGD.helpers.escapeHtml;
        formatCurrency = DGD.helpers.formatCurrency;
        formatDate = DGD.helpers.formatDate;
        $ = DGD.helpers.$;
    }

    function renderFinanceChart(monthly) {
        var w = 700, h = 260, padL = 60, padR = 20, padT = 20, padB = 40;
        var chartW = w - padL - padR;
        var chartH = h - padT - padB;
        var maxVal = 0;
        for (var i = 0; i < monthly.length; i++) {
            if (monthly[i].revenue > maxVal) maxVal = monthly[i].revenue;
            if (monthly[i].costs > maxVal) maxVal = monthly[i].costs;
        }
        maxVal = Math.ceil(maxVal / 5000) * 5000;
        var barGroupW = chartW / monthly.length;
        var barW = barGroupW * 0.3;
        var gap = barGroupW * 0.05;

        var svg = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block;" preserveAspectRatio="xMidYMid meet">`;

        // Y-axis grid lines
        for (var g = 0; g <= 4; g++) {
            var yG = padT + (chartH - (g / 4) * chartH);
            var label = DGD.helpers.formatCurrency(Math.round(maxVal * g / 4));
            svg += `<line x1="${padL}" y1="${yG}" x2="${w - padR}" y2="${yG}" stroke="var(--dgd-gray-200)" stroke-width="1"/>`;
            svg += `<text x="${padL - 8}" y="${yG + 4}" text-anchor="end" fill="var(--dgd-gray-500)" font-size="11" font-family="inherit">${label}</text>`;
        }

        // Cumulative profit line points
        var profitPoints = [];
        var cumProfit = 0;
        var maxProfit = 0;
        for (var c = 0; c < monthly.length; c++) {
            cumProfit += monthly[c].revenue - monthly[c].costs;
            if (Math.abs(cumProfit) > maxProfit) maxProfit = Math.abs(cumProfit);
        }
        var profitScale = maxProfit > 0 ? chartH / (maxProfit * 2) : 1;
        var profitMid = padT + chartH / 2;
        cumProfit = 0;

        for (var m = 0; m < monthly.length; m++) {
            var x = padL + m * barGroupW + barGroupW / 2;
            var revH = (monthly[m].revenue / maxVal) * chartH;
            var costH = (monthly[m].costs / maxVal) * chartH;
            var revY = padT + chartH - revH;
            var costY = padT + chartH - costH;

            // Revenue bar (green)
            svg += `<rect x="${x - barW - gap / 2}" y="${revY}" width="${barW}" height="${revH}" rx="3" fill="#27ae60" opacity="0.85"/>`;
            // Cost bar (red)
            svg += `<rect x="${x + gap / 2}" y="${costY}" width="${barW}" height="${costH}" rx="3" fill="#e74c3c" opacity="0.85"/>`;
            // Month label
            svg += `<text x="${x}" y="${h - 10}" text-anchor="middle" fill="var(--dgd-gray-600)" font-size="12" font-weight="600" font-family="inherit">${DGD.helpers.escapeHtml(monthly[m].month)}</text>`;

            // Profit line
            cumProfit += monthly[m].revenue - monthly[m].costs;
            var profitY = profitMid - cumProfit * profitScale;
            profitPoints.push(x.toFixed(1) + ',' + profitY.toFixed(1));
        }

        // Draw profit line
        if (profitPoints.length > 1) {
            svg += `<polyline points="${profitPoints.join(' ')}" fill="none" stroke="#3498db" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
            for (var d = 0; d < profitPoints.length; d++) {
                var pts = profitPoints[d].split(',');
                svg += `<circle cx="${pts[0]}" cy="${pts[1]}" r="4" fill="#3498db" stroke="#fff" stroke-width="1.5"/>`;
            }
        }

        svg += '</svg>';

        // Legend
        svg += '<div style="display:flex;gap:1.5rem;justify-content:center;margin-top:0.75rem;font-size:0.8rem;">';
        svg += '<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:12px;background:#27ae60;border-radius:2px;display:inline-block;"></span> Umsatz</span>';
        svg += '<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:12px;background:#e74c3c;border-radius:2px;display:inline-block;"></span> Kosten</span>';
        svg += '<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:3px;background:#3498db;border-radius:2px;display:inline-block;"></span> Kum. Gewinn</span>';
        svg += '</div>';

        return svg;
    }

    function openExpenseModal() {
        var DEMO_FINANCE = DGD.demoData.DEMO_FINANCE;
        var mc = document.getElementById('modal-container');
        var html = '<div class="dgd-modal-overlay" id="expense-modal-overlay">';
        html += '<div class="dgd-modal">';
        html += '<div class="dgd-modal__header"><h3>Neue Ausgabe</h3><button class="dgd-modal__close" id="expense-modal-close">&times;</button></div>';
        html += '<div class="dgd-modal__body">';
        html += '<form id="expense-form" class="dgd-form">';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Datum</label><input type="date" class="dgd-form__input" id="exp-date" value="2026-03-09" required></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Projekt</label><input type="text" class="dgd-form__input" id="exp-project" placeholder="z.B. Partner-Netzwerk" required></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Beschreibung</label><input type="text" class="dgd-form__input" id="exp-desc" placeholder="z.B. Google Ads Kampagne" required></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Betrag (\u20ac)</label><input type="number" class="dgd-form__input" id="exp-amount" step="0.01" min="0" required></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Kategorie</label><select class="dgd-form__input" id="exp-category"><option>Marketing</option><option>Cloud/API</option><option>Infrastruktur</option><option>Lizenzen</option><option>Entwicklung</option><option>Betrieb</option><option>Sonstiges</option></select></div>';
        html += '</form></div>';
        html += '<div class="dgd-modal__footer"><button class="dgd-btn dgd-btn--outline" id="expense-cancel">Abbrechen</button><button class="dgd-btn dgd-btn--primary" id="expense-save">Speichern</button></div>';
        html += '</div></div>';
        mc.innerHTML = html;

        var closeModal = function() { mc.innerHTML = ''; };
        document.getElementById('expense-modal-close').addEventListener('click', closeModal);
        document.getElementById('expense-cancel').addEventListener('click', closeModal);
        document.getElementById('expense-modal-overlay').addEventListener('click', function(ev) {
            if (ev.target === this) closeModal();
        });
        document.getElementById('expense-save').addEventListener('click', function() {
            // Demo mode: add to list and re-render
            var newExp = {
                date: document.getElementById('exp-date').value,
                project: document.getElementById('exp-project').value,
                desc: document.getElementById('exp-desc').value,
                amount: parseFloat(document.getElementById('exp-amount').value) || 0,
                category: document.getElementById('exp-category').value
            };
            if (newExp.project && newExp.desc && newExp.amount > 0) {
                DGD.demoData.DEMO_FINANCE.expenses.unshift(newExp);
                closeModal();
                DGD.views.finanzen($('#main-content'));
            }
        });
    }

    // Expose openExpenseModal for cross-reference
    DGD.views._openExpenseModal = openExpenseModal;

    DGD.views.finanzen = function(container) {
        init();
        var DEMO_FINANCE = DGD.demoData.DEMO_FINANCE;
        var fin = DGD.demoData.DEMO_FINANCE;
        var html = '';

        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Finanzen</h1>';
        html += '<div class="dgd-page-header__actions">';
        html += '<button class="dgd-btn dgd-btn--primary" id="btn-new-expense">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        html += ' Neue Ausgabe</button>';
        html += (DGD.export ? DGD.export.buttonHtml('finance') : '');
        html += '</div></div>';

        // Summary cards
        var trendPct = fin.summary.revenue > 0 ? Math.round(((fin.summary.revenue - 26200) / 26200) * 100) : 0;
        html += '<div class="dgd-kpi-grid" style="margin-bottom:2rem;">';
        html += '<div class="dgd-kpi-card dgd-kpi-card--umsatz" style="animation-delay:0.05s">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Umsatz (Monat)</span></div>';
        html += `<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value">${DGD.helpers.formatCurrency(fin.summary.revenue)}<span class="dgd-kpi-card__unit">\u20ac</span></span>`;
        html += `<span class="dgd-kpi-card__delta dgd-kpi-card__delta--up">+${trendPct}%</span></div></div>`;

        html += '<div class="dgd-kpi-card dgd-kpi-card--marketing" style="animation-delay:0.1s">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Kosten (Monat)</span></div>';
        html += `<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value">${DGD.helpers.formatCurrency(fin.summary.costs)}<span class="dgd-kpi-card__unit">\u20ac</span></span></div></div>`;

        html += '<div class="dgd-kpi-card dgd-kpi-card--umsatz" style="animation-delay:0.15s">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Gewinn (Monat)</span></div>';
        html += `<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value">${DGD.helpers.formatCurrency(fin.summary.profit)}<span class="dgd-kpi-card__unit">\u20ac</span></span>`;
        html += `<span class="dgd-kpi-card__delta dgd-kpi-card__delta--up">Marge ${Math.round((fin.summary.profit / fin.summary.revenue) * 100)}%</span></div></div>`;

        html += '<div class="dgd-kpi-card dgd-kpi-card--engagement" style="animation-delay:0.2s">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Burn Rate</span></div>';
        html += `<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value">${DGD.helpers.formatCurrency(fin.summary.burnRate)}<span class="dgd-kpi-card__unit">\u20ac/Monat</span></span></div></div>`;
        html += '</div>';

        // Monthly P&L Chart (SVG bar chart)
        html += '<div class="dgd-section-card" style="animation-delay:0.25s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
        html += ' Monatliche GuV (6 Monate)</div>';
        html += renderFinanceChart(fin.monthly);
        html += '</div>';

        // Project Budgets Table
        html += '<div class="dgd-section-card" style="animation-delay:0.3s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
        html += ' Projektbudgets</div>';
        html += '<table class="dgd-table">';
        html += '<thead><tr><th>Projekt</th><th>Budget</th><th>Ausgegeben</th><th>Verbleibend</th><th>Fortschritt</th></tr></thead>';
        html += '<tbody>';
        for (var p = 0; p < fin.projects.length; p++) {
            var proj = fin.projects[p];
            var remaining = proj.budget - proj.spent;
            var pctSpent = proj.budget > 0 ? Math.round((proj.spent / proj.budget) * 100) : 0;
            var barColor = pctSpent < 80 ? '#27ae60' : (pctSpent <= 100 ? '#f39c12' : '#e74c3c');
            html += '<tr>';
            html += `<td><strong>${DGD.helpers.escapeHtml(proj.name)}</strong> <span class="dgd-badge dgd-badge--${proj.status}">${DGD.helpers.escapeHtml(proj.status)}</span></td>`;
            html += `<td>${DGD.helpers.formatCurrency(proj.budget)} \u20ac</td>`;
            html += `<td>${DGD.helpers.formatCurrency(proj.spent)} \u20ac</td>`;
            html += `<td>${DGD.helpers.formatCurrency(remaining)} \u20ac</td>`;
            html += '<td><div style="display:flex;align-items:center;gap:0.5rem;">';
            html += `<div style="flex:1;height:6px;background:var(--dgd-gray-200);border-radius:3px;min-width:60px;"><div style="width:${Math.min(pctSpent, 100)}%;height:100%;background:${barColor};border-radius:3px;"></div></div>`;
            html += `<span style="font-size:0.75rem;font-weight:600;color:${barColor}">${pctSpent}%</span>`;
            html += '</div></td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
        html += '</div>';

        // Recent Expenses
        html += '<div class="dgd-section-card" style="animation-delay:0.35s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
        html += ' Letzte Ausgaben</div>';
        html += '<table class="dgd-table">';
        html += '<thead><tr><th>Datum</th><th>Projekt</th><th>Beschreibung</th><th>Kategorie</th><th style="text-align:right">Betrag</th></tr></thead>';
        html += '<tbody>';
        for (var e = 0; e < fin.expenses.length; e++) {
            var exp = fin.expenses[e];
            html += '<tr>';
            html += `<td>${DGD.helpers.formatDate(exp.date)}</td>`;
            html += `<td>${DGD.helpers.escapeHtml(exp.project)}</td>`;
            html += `<td>${DGD.helpers.escapeHtml(exp.desc)}</td>`;
            html += `<td><span class="dgd-badge dgd-badge--intern">${DGD.helpers.escapeHtml(exp.category)}</span></td>`;
            html += `<td style="text-align:right;font-weight:600;color:#e74c3c;">-${DGD.helpers.formatCurrency(exp.amount)} \u20ac</td>`;
            html += '</tr>';
        }
        html += '</tbody></table>';
        html += '</div>';

        container.innerHTML = html;

        // New expense button
        var btnExp = document.getElementById('btn-new-expense');
        if (btnExp) {
            btnExp.addEventListener('click', function() {
                openExpenseModal();
            });
        }
    };
})();
