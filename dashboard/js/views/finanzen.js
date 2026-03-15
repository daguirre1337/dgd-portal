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

    /* ======================================================================
       Tab state
       ====================================================================== */
    var activeTab = 'uebersicht';
    var txState = {
        page: 1,
        perPage: 20,
        dateFrom: '',
        dateTo: '',
        category: '',
        search: '',
        transactions: [],
        total: 0,
        stats: null
    };

    /* ======================================================================
       CATEGORY helpers
       ====================================================================== */
    var CATEGORY_LABELS = {
        personnel: 'Personal',
        rent: 'Miete',
        insurance: 'Versicherung',
        fuel: 'Kraftstoff',
        groceries: 'Lebensmittel',
        utilities: 'Nebenkosten',
        telecom: 'Telekom',
        tax: 'Steuer',
        uncategorized: 'Ohne Kategorie'
    };

    var CATEGORY_COLORS = {
        personnel: '#3498db',
        rent: '#9b59b6',
        insurance: '#1abc9c',
        fuel: '#e67e22',
        groceries: '#2ecc71',
        utilities: '#f39c12',
        telecom: '#e74c3c',
        tax: '#95a5a6',
        uncategorized: '#bdc3c7'
    };

    function categoryBadge(cat) {
        var label = CATEGORY_LABELS[cat] || escapeHtml(cat || 'Ohne Kategorie');
        var color = CATEGORY_COLORS[cat] || '#95a5a6';
        return '<span class="dgd-badge" style="background:' + color + '15;color:' + color + ';border:1px solid ' + color + '40;">' + label + '</span>';
    }

    function formatAmountDE(val) {
        var n = Number(val);
        return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
    }

    /* ======================================================================
       SVG bar chart (unchanged from original)
       ====================================================================== */
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

        var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto;display:block;" preserveAspectRatio="xMidYMid meet">';

        for (var g = 0; g <= 4; g++) {
            var yG = padT + (chartH - (g / 4) * chartH);
            var label = formatCurrency(Math.round(maxVal * g / 4));
            svg += '<line x1="' + padL + '" y1="' + yG + '" x2="' + (w - padR) + '" y2="' + yG + '" stroke="var(--dgd-gray-200)" stroke-width="1"/>';
            svg += '<text x="' + (padL - 8) + '" y="' + (yG + 4) + '" text-anchor="end" fill="var(--dgd-gray-500)" font-size="11" font-family="inherit">' + label + '</text>';
        }

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

            svg += '<rect x="' + (x - barW - gap / 2) + '" y="' + revY + '" width="' + barW + '" height="' + revH + '" rx="3" fill="#27ae60" opacity="0.85"/>';
            svg += '<rect x="' + (x + gap / 2) + '" y="' + costY + '" width="' + barW + '" height="' + costH + '" rx="3" fill="#e74c3c" opacity="0.85"/>';
            svg += '<text x="' + x + '" y="' + (h - 10) + '" text-anchor="middle" fill="var(--dgd-gray-600)" font-size="12" font-weight="600" font-family="inherit">' + escapeHtml(monthly[m].month) + '</text>';

            cumProfit += monthly[m].revenue - monthly[m].costs;
            var profitY = profitMid - cumProfit * profitScale;
            profitPoints.push(x.toFixed(1) + ',' + profitY.toFixed(1));
        }

        if (profitPoints.length > 1) {
            svg += '<polyline points="' + profitPoints.join(' ') + '" fill="none" stroke="#3498db" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
            for (var d = 0; d < profitPoints.length; d++) {
                var pts = profitPoints[d].split(',');
                svg += '<circle cx="' + pts[0] + '" cy="' + pts[1] + '" r="4" fill="#3498db" stroke="#fff" stroke-width="1.5"/>';
            }
        }

        svg += '</svg>';
        svg += '<div style="display:flex;gap:1.5rem;justify-content:center;margin-top:0.75rem;font-size:0.8rem;">';
        svg += '<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:12px;background:#27ae60;border-radius:2px;display:inline-block;"></span> Umsatz</span>';
        svg += '<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:12px;background:#e74c3c;border-radius:2px;display:inline-block;"></span> Kosten</span>';
        svg += '<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:3px;background:#3498db;border-radius:2px;display:inline-block;"></span> Kum. Gewinn</span>';
        svg += '</div>';

        return svg;
    }

    /* ======================================================================
       Expense modal (unchanged)
       ====================================================================== */
    function openExpenseModal() {
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

    DGD.views._openExpenseModal = openExpenseModal;

    /* ======================================================================
       Tab Navigation
       ====================================================================== */
    function renderTabBar() {
        var tabs = [
            { id: 'uebersicht', label: 'Uebersicht' },
            { id: 'kontobewegungen', label: 'Kontobewegungen' },
            { id: 'import', label: 'Import' }
        ];
        var html = '<div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap;">';
        for (var i = 0; i < tabs.length; i++) {
            var t = tabs[i];
            var isActive = activeTab === t.id;
            var style = isActive
                ? 'background:var(--dgd-primary,#2563eb);color:#fff;font-weight:600;'
                : 'background:var(--dgd-gray-100,#f3f4f6);color:var(--dgd-gray-600,#4b5563);cursor:pointer;';
            html += '<button class="dgd-badge" data-fin-tab="' + t.id + '" style="' + style + 'padding:0.5rem 1.25rem;font-size:0.9rem;border:none;border-radius:0.5rem;transition:all 0.2s;">' + escapeHtml(t.label) + '</button>';
        }
        html += '</div>';
        return html;
    }

    function bindTabEvents(container, fin) {
        var btns = container.querySelectorAll('[data-fin-tab]');
        for (var i = 0; i < btns.length; i++) {
            btns[i].addEventListener('click', function() {
                var tabId = this.getAttribute('data-fin-tab');
                if (tabId !== activeTab) {
                    activeTab = tabId;
                    renderPage(container, fin);
                }
            });
        }
    }

    /* ======================================================================
       Tab: Uebersicht (original renderFinance)
       ====================================================================== */
    function renderUebersicht(fin) {
        var html = '';

        // Summary cards
        var trendPct = fin.summary.revenue > 0 ? Math.round(((fin.summary.revenue - 26200) / 26200) * 100) : 0;
        html += '<div class="dgd-kpi-grid" style="margin-bottom:2rem;">';
        html += '<div class="dgd-kpi-card dgd-kpi-card--umsatz" style="animation-delay:0.05s">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Umsatz (Monat)</span></div>';
        html += '<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value">' + formatCurrency(fin.summary.revenue) + '<span class="dgd-kpi-card__unit">\u20ac</span></span>';
        html += '<span class="dgd-kpi-card__delta dgd-kpi-card__delta--up">+' + trendPct + '%</span></div></div>';

        html += '<div class="dgd-kpi-card dgd-kpi-card--marketing" style="animation-delay:0.1s">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Kosten (Monat)</span></div>';
        html += '<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value">' + formatCurrency(fin.summary.costs) + '<span class="dgd-kpi-card__unit">\u20ac</span></span></div></div>';

        html += '<div class="dgd-kpi-card dgd-kpi-card--umsatz" style="animation-delay:0.15s">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Gewinn (Monat)</span></div>';
        html += '<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value">' + formatCurrency(fin.summary.profit) + '<span class="dgd-kpi-card__unit">\u20ac</span></span>';
        html += '<span class="dgd-kpi-card__delta dgd-kpi-card__delta--up">Marge ' + Math.round((fin.summary.profit / fin.summary.revenue) * 100) + '%</span></div></div>';

        html += '<div class="dgd-kpi-card dgd-kpi-card--engagement" style="animation-delay:0.2s">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Burn Rate</span></div>';
        html += '<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value">' + formatCurrency(fin.summary.burnRate) + '<span class="dgd-kpi-card__unit">\u20ac/Monat</span></span></div></div>';
        html += '</div>';

        // Monthly P&L Chart
        html += '<div class="dgd-section-card" style="animation-delay:0.25s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
        html += ' Monatliche GuV (6 Monate)</div>';
        html += renderFinanceChart(fin.monthly);
        html += '</div>';

        // Project Budgets
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
            html += '<td><strong>' + escapeHtml(proj.name) + '</strong> <span class="dgd-badge dgd-badge--' + proj.status + '">' + escapeHtml(proj.status) + '</span></td>';
            html += '<td>' + formatCurrency(proj.budget) + ' \u20ac</td>';
            html += '<td>' + formatCurrency(proj.spent) + ' \u20ac</td>';
            html += '<td>' + formatCurrency(remaining) + ' \u20ac</td>';
            html += '<td><div style="display:flex;align-items:center;gap:0.5rem;">';
            html += '<div style="flex:1;height:6px;background:var(--dgd-gray-200);border-radius:3px;min-width:60px;"><div style="width:' + Math.min(pctSpent, 100) + '%;height:100%;background:' + barColor + ';border-radius:3px;"></div></div>';
            html += '<span style="font-size:0.75rem;font-weight:600;color:' + barColor + '">' + pctSpent + '%</span>';
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
            html += '<td>' + formatDate(exp.date) + '</td>';
            html += '<td>' + escapeHtml(exp.project) + '</td>';
            html += '<td>' + escapeHtml(exp.desc) + '</td>';
            html += '<td><span class="dgd-badge dgd-badge--intern">' + escapeHtml(exp.category) + '</span></td>';
            html += '<td style="text-align:right;font-weight:600;color:#e74c3c;">-' + formatCurrency(exp.amount) + ' \u20ac</td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
        html += '</div>';

        return html;
    }

    /* ======================================================================
       Tab: Kontobewegungen
       ====================================================================== */
    function renderKontobewegungen() {
        var html = '';
        var stats = txState.stats || {};
        var income = stats.total_income || 0;
        var expenses = stats.total_expenses || 0;
        var saldo = income - expenses;

        // Summary cards
        html += '<div class="dgd-kpi-grid" style="margin-bottom:1.5rem;">';

        html += '<div class="dgd-kpi-card" style="animation-delay:0.05s;border-left:4px solid #27ae60;">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Einnahmen</span></div>';
        html += '<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value" style="color:#27ae60;">+' + formatAmountDE(income) + '</span></div></div>';

        html += '<div class="dgd-kpi-card" style="animation-delay:0.1s;border-left:4px solid #e74c3c;">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Ausgaben</span></div>';
        html += '<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value" style="color:#e74c3c;">-' + formatAmountDE(Math.abs(expenses)) + '</span></div></div>';

        html += '<div class="dgd-kpi-card" style="animation-delay:0.15s;border-left:4px solid #3498db;">';
        html += '<div class="dgd-kpi-card__header"><span class="dgd-kpi-card__label">Saldo</span></div>';
        html += '<div class="dgd-kpi-card__value-row"><span class="dgd-kpi-card__value" style="color:#3498db;">' + formatAmountDE(saldo) + '</span></div></div>';

        html += '</div>';

        // Filter bar
        html += '<div class="dgd-section-card" style="margin-bottom:1.5rem;animation-delay:0.2s;">';
        html += '<div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;">';

        html += '<div class="dgd-form__group" style="margin:0;flex:0 0 auto;">';
        html += '<label class="dgd-form__label" style="font-size:0.75rem;">Von</label>';
        html += '<input type="date" class="dgd-form__input" id="tx-date-from" value="' + escapeHtml(txState.dateFrom) + '" style="padding:0.4rem 0.6rem;font-size:0.85rem;">';
        html += '</div>';

        html += '<div class="dgd-form__group" style="margin:0;flex:0 0 auto;">';
        html += '<label class="dgd-form__label" style="font-size:0.75rem;">Bis</label>';
        html += '<input type="date" class="dgd-form__input" id="tx-date-to" value="' + escapeHtml(txState.dateTo) + '" style="padding:0.4rem 0.6rem;font-size:0.85rem;">';
        html += '</div>';

        html += '<div class="dgd-form__group" style="margin:0;flex:0 0 auto;">';
        html += '<label class="dgd-form__label" style="font-size:0.75rem;">Kategorie</label>';
        html += '<select class="dgd-form__input" id="tx-category" style="padding:0.4rem 0.6rem;font-size:0.85rem;">';
        html += '<option value="">Alle</option>';
        var cats = ['personnel', 'rent', 'insurance', 'fuel', 'groceries', 'utilities', 'telecom', 'tax', 'uncategorized'];
        for (var ci = 0; ci < cats.length; ci++) {
            var sel = txState.category === cats[ci] ? ' selected' : '';
            html += '<option value="' + cats[ci] + '"' + sel + '>' + (CATEGORY_LABELS[cats[ci]] || cats[ci]) + '</option>';
        }
        html += '</select>';
        html += '</div>';

        html += '<div class="dgd-form__group" style="margin:0;flex:1 1 180px;">';
        html += '<label class="dgd-form__label" style="font-size:0.75rem;">Suche</label>';
        html += '<input type="text" class="dgd-form__input" id="tx-search" placeholder="Freitext-Suche..." value="' + escapeHtml(txState.search) + '" style="padding:0.4rem 0.6rem;font-size:0.85rem;">';
        html += '</div>';

        html += '<button class="dgd-btn dgd-btn--primary" id="tx-filter-btn" style="padding:0.4rem 1rem;font-size:0.85rem;height:fit-content;">Filtern</button>';
        html += '</div>';
        html += '</div>';

        // Transaction table
        html += '<div class="dgd-section-card" style="animation-delay:0.25s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
        html += ' Kontobewegungen</div>';

        if (txState.transactions.length === 0) {
            html += '<div style="text-align:center;padding:2rem;color:var(--dgd-gray-500);">Keine Transaktionen gefunden. Importiere zuerst eine CSV-Datei im "Import"-Tab.</div>';
        } else {
            html += '<table class="dgd-table">';
            html += '<thead><tr><th>Datum</th><th>Beschreibung</th><th>Kategorie</th><th style="text-align:right">Betrag</th></tr></thead>';
            html += '<tbody>';
            for (var t = 0; t < txState.transactions.length; t++) {
                var tx = txState.transactions[t];
                var amt = Number(tx.amount || 0);
                var amtColor = amt >= 0 ? '#27ae60' : '#e74c3c';
                var amtPrefix = amt >= 0 ? '+' : '';
                html += '<tr>';
                html += '<td>' + formatDate(tx.date || '') + '</td>';
                html += '<td>' + escapeHtml(tx.description || tx.desc || '') + '</td>';
                html += '<td>' + categoryBadge(tx.category) + '</td>';
                html += '<td style="text-align:right;font-weight:600;color:' + amtColor + ';">' + amtPrefix + formatAmountDE(amt) + '</td>';
                html += '</tr>';
            }
            html += '</tbody></table>';

            // Pagination
            var totalPages = Math.max(1, Math.ceil(txState.total / txState.perPage));
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--dgd-gray-200,#e5e7eb);">';
            html += '<button class="dgd-btn dgd-btn--outline" id="tx-prev" style="font-size:0.85rem;"' + (txState.page <= 1 ? ' disabled' : '') + '>Zurueck</button>';
            html += '<span style="font-size:0.85rem;color:var(--dgd-gray-600);">Seite ' + txState.page + ' von ' + totalPages + '</span>';
            html += '<button class="dgd-btn dgd-btn--outline" id="tx-next" style="font-size:0.85rem;"' + (txState.page >= totalPages ? ' disabled' : '') + '>Weiter</button>';
            html += '</div>';
        }

        html += '</div>';

        return html;
    }

    function loadTransactions(container, fin) {
        var params = {
            page: txState.page,
            per_page: txState.perPage
        };
        if (txState.dateFrom) params.date_from = txState.dateFrom;
        if (txState.dateTo) params.date_to = txState.dateTo;
        if (txState.category) params.category = txState.category;
        if (txState.search) params.search = txState.search;

        Promise.all([
            dashboardApi.getBankTransactions(params),
            dashboardApi.getTransactionStats()
        ]).then(function(results) {
            var txData = results[0];
            var statsData = results[1];

            if (txData) {
                txState.transactions = txData.transactions || txData.data || [];
                txState.total = txData.total || txState.transactions.length;
            } else {
                txState.transactions = [];
                txState.total = 0;
            }

            if (statsData) {
                txState.stats = statsData;
            }

            renderPage(container, fin);
        });
    }

    function bindKontobewegungEvents(container, fin) {
        var filterBtn = document.getElementById('tx-filter-btn');
        if (filterBtn) {
            filterBtn.addEventListener('click', function() {
                txState.dateFrom = document.getElementById('tx-date-from').value;
                txState.dateTo = document.getElementById('tx-date-to').value;
                txState.category = document.getElementById('tx-category').value;
                txState.search = document.getElementById('tx-search').value;
                txState.page = 1;
                loadTransactions(container, fin);
            });
        }

        // Enter key on search
        var searchInput = document.getElementById('tx-search');
        if (searchInput) {
            searchInput.addEventListener('keydown', function(ev) {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    if (filterBtn) filterBtn.click();
                }
            });
        }

        var prevBtn = document.getElementById('tx-prev');
        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                if (txState.page > 1) {
                    txState.page--;
                    loadTransactions(container, fin);
                }
            });
        }

        var nextBtn = document.getElementById('tx-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                var totalPages = Math.max(1, Math.ceil(txState.total / txState.perPage));
                if (txState.page < totalPages) {
                    txState.page++;
                    loadTransactions(container, fin);
                }
            });
        }
    }

    /* ======================================================================
       Tab: Import
       ====================================================================== */
    function renderImport() {
        var html = '';

        html += '<div class="dgd-section-card" style="animation-delay:0.1s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
        html += ' CSV-Import</div>';

        // Drop zone
        html += '<div id="csv-drop-zone" style="border:2px dashed var(--dgd-gray-300,#d1d5db);border-radius:0.75rem;padding:3rem 2rem;text-align:center;cursor:pointer;transition:all 0.2s;background:var(--dgd-gray-50,#f9fafb);">';
        html += '<div style="margin-bottom:1rem;">';
        html += '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--dgd-gray-400,#9ca3af)" stroke-width="1.5" style="display:inline-block;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
        html += '</div>';
        html += '<div style="font-size:1rem;font-weight:600;color:var(--dgd-gray-700,#374151);margin-bottom:0.5rem;">CSV-Datei hier ablegen oder klicken</div>';
        html += '<div style="font-size:0.8rem;color:var(--dgd-gray-500,#6b7280);">Exportiere deine Umsaetze als CSV aus dem Sparkasse Online-Banking (Semikolon-separiert)</div>';
        html += '<input type="file" id="csv-file-input" accept=".csv" style="display:none;">';
        html += '</div>';

        // Preview area (hidden initially)
        html += '<div id="csv-preview-area" style="display:none;margin-top:1.5rem;">';
        html += '<h4 style="margin-bottom:0.75rem;font-size:0.9rem;color:var(--dgd-gray-700,#374151);">Vorschau</h4>';
        html += '<div id="csv-preview-table" style="overflow-x:auto;"></div>';
        html += '<div style="margin-top:1rem;display:flex;gap:1rem;align-items:center;">';
        html += '<button class="dgd-btn dgd-btn--primary" id="csv-import-btn" disabled>Importieren</button>';
        html += '<span id="csv-row-count" style="font-size:0.85rem;color:var(--dgd-gray-600);"></span>';
        html += '</div>';
        html += '</div>';

        // Progress area (hidden initially)
        html += '<div id="csv-progress-area" style="display:none;margin-top:1.5rem;">';
        html += '<div style="margin-bottom:0.5rem;font-size:0.85rem;color:var(--dgd-gray-600);">Import laeuft...</div>';
        html += '<div style="height:8px;background:var(--dgd-gray-200,#e5e7eb);border-radius:4px;overflow:hidden;">';
        html += '<div id="csv-progress-bar" style="width:0%;height:100%;background:var(--dgd-primary,#2563eb);border-radius:4px;transition:width 0.3s;"></div>';
        html += '</div>';
        html += '</div>';

        // Result area (hidden initially)
        html += '<div id="csv-result-area" style="display:none;margin-top:1.5rem;"></div>';

        html += '</div>';

        return html;
    }

    function bindImportEvents(container, fin) {
        var dropZone = document.getElementById('csv-drop-zone');
        var fileInput = document.getElementById('csv-file-input');
        var previewArea = document.getElementById('csv-preview-area');
        var previewTable = document.getElementById('csv-preview-table');
        var importBtn = document.getElementById('csv-import-btn');
        var rowCount = document.getElementById('csv-row-count');
        var progressArea = document.getElementById('csv-progress-area');
        var progressBar = document.getElementById('csv-progress-bar');
        var resultArea = document.getElementById('csv-result-area');

        if (!dropZone || !fileInput) return;

        var selectedFile = null;
        var parsedLines = [];

        // Click to open file dialog
        dropZone.addEventListener('click', function() {
            fileInput.click();
        });

        // Drag & Drop
        dropZone.addEventListener('dragover', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            dropZone.style.borderColor = 'var(--dgd-primary,#2563eb)';
            dropZone.style.background = 'var(--dgd-primary-light,#eff6ff)';
        });

        dropZone.addEventListener('dragleave', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            dropZone.style.borderColor = 'var(--dgd-gray-300,#d1d5db)';
            dropZone.style.background = 'var(--dgd-gray-50,#f9fafb)';
        });

        dropZone.addEventListener('drop', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            dropZone.style.borderColor = 'var(--dgd-gray-300,#d1d5db)';
            dropZone.style.background = 'var(--dgd-gray-50,#f9fafb)';
            var files = ev.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        });

        fileInput.addEventListener('change', function() {
            if (fileInput.files.length > 0) {
                handleFile(fileInput.files[0]);
            }
        });

        function handleFile(file) {
            if (!file.name.toLowerCase().match(/\.csv$/)) {
                resultArea.style.display = 'block';
                resultArea.innerHTML = '<div style="padding:1rem;background:#fef2f2;border:1px solid #fecaca;border-radius:0.5rem;color:#dc2626;">Bitte waehle eine CSV-Datei aus.</div>';
                return;
            }

            selectedFile = file;
            resultArea.style.display = 'none';
            progressArea.style.display = 'none';

            // Read and preview
            var reader = new FileReader();
            reader.onload = function(ev) {
                var text = ev.target.result;
                var lines = text.split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
                parsedLines = lines;

                // Show preview of first 5 lines
                var previewCount = Math.min(lines.length, 6); // header + 5 data rows
                var tableHtml = '<table class="dgd-table" style="font-size:0.8rem;">';
                for (var li = 0; li < previewCount; li++) {
                    var cells = lines[li].split(';');
                    var tag = li === 0 ? 'th' : 'td';
                    tableHtml += '<tr>';
                    for (var ci = 0; ci < Math.min(cells.length, 8); ci++) {
                        tableHtml += '<' + tag + ' style="white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(cells[ci].replace(/^"|"$/g, '')) + '</' + tag + '>';
                    }
                    if (cells.length > 8) {
                        tableHtml += '<' + tag + '>...</' + tag + '>';
                    }
                    tableHtml += '</tr>';
                }
                tableHtml += '</table>';

                previewTable.innerHTML = tableHtml;
                var dataRows = lines.length > 1 ? lines.length - 1 : 0;
                rowCount.textContent = dataRows + ' Zeilen importieren';
                importBtn.disabled = dataRows === 0;
                importBtn.textContent = dataRows + ' Zeilen importieren';
                previewArea.style.display = 'block';
            };
            reader.readAsText(file, 'UTF-8');
        }

        // Import button
        if (importBtn) {
            importBtn.addEventListener('click', function() {
                if (!selectedFile) return;

                importBtn.disabled = true;
                previewArea.style.display = 'none';
                progressArea.style.display = 'block';
                progressBar.style.width = '0%';
                resultArea.style.display = 'none';

                // Animate progress
                var progress = 0;
                var progressInterval = setInterval(function() {
                    progress += Math.random() * 15;
                    if (progress > 90) progress = 90;
                    progressBar.style.width = Math.round(progress) + '%';
                }, 200);

                var formData = new FormData();
                formData.append('file', selectedFile);

                dashboardApi.importBankCSV(formData).then(function(result) {
                    clearInterval(progressInterval);
                    progressBar.style.width = '100%';

                    setTimeout(function() {
                        progressArea.style.display = 'none';

                        if (result) {
                            var imported = result.imported || result.count || 0;
                            var duplicates = result.duplicates || result.skipped || 0;
                            resultArea.innerHTML = '<div style="padding:1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:0.5rem;color:#16a34a;font-weight:600;">'
                                + '\u2713 ' + imported + ' Transaktionen importiert, ' + duplicates + ' Duplikate uebersprungen'
                                + '</div>';
                        } else {
                            resultArea.innerHTML = '<div style="padding:1rem;background:#fef2f2;border:1px solid #fecaca;border-radius:0.5rem;color:#dc2626;">'
                                + 'Import fehlgeschlagen. Bitte pruefe das CSV-Format und versuche es erneut.'
                                + '</div>';
                        }
                        resultArea.style.display = 'block';

                        // Reset state
                        selectedFile = null;
                        parsedLines = [];
                        importBtn.disabled = true;
                        fileInput.value = '';
                    }, 500);
                });
            });
        }
    }

    /* ======================================================================
       Main page render
       ====================================================================== */
    function renderPage(container, fin) {
        var html = '';

        // Page header
        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Finanzen</h1>';
        html += '<div class="dgd-page-header__actions">';
        if (activeTab === 'uebersicht') {
            html += '<button class="dgd-btn dgd-btn--primary" id="btn-new-expense">';
            html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
            html += ' Neue Ausgabe</button>';
        }
        html += (DGD.export ? DGD.export.buttonHtml('finance') : '');
        html += '</div></div>';

        // Tabs
        html += renderTabBar();

        // Tab content
        if (activeTab === 'uebersicht') {
            html += renderUebersicht(fin);
        } else if (activeTab === 'kontobewegungen') {
            html += renderKontobewegungen();
        } else if (activeTab === 'import') {
            html += renderImport();
        }

        container.innerHTML = html;

        // Bind tab events
        bindTabEvents(container, fin);

        // Bind tab-specific events
        if (activeTab === 'uebersicht') {
            var btnExp = document.getElementById('btn-new-expense');
            if (btnExp) {
                btnExp.addEventListener('click', function() {
                    openExpenseModal();
                });
            }
        } else if (activeTab === 'kontobewegungen') {
            bindKontobewegungEvents(container, fin);
        } else if (activeTab === 'import') {
            bindImportEvents(container, fin);
        }
    }

    /* ======================================================================
       Entry point
       ====================================================================== */
    DGD.views.finanzen = function(container) {
        init();
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--dgd-gray-500);">Finanzdaten werden geladen...</div>';

        // Try real API first
        Promise.all([
            fetch('api/finance/summary', { credentials: 'same-origin' }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
            fetch('api/finance/monthly', { credentials: 'same-origin' }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
            fetch('api/finance/expenses', { credentials: 'same-origin' }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
            fetch('api/finance/projects', { credentials: 'same-origin' }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; })
        ]).then(function(results) {
            var summary = results[0];
            var monthly = results[1];
            var expenses = results[2];
            var projects = results[3];

            var fin;
            if (summary && monthly && expenses && projects) {
                fin = {
                    summary: {
                        revenue: summary.total_revenue || 0,
                        costs: summary.total_expenses || 0,
                        profit: summary.profit || 0,
                        burnRate: summary.total_expenses || 0
                    },
                    monthly: (monthly.months || []).map(function(m) {
                        return { month: m.label, revenue: m.revenue, costs: m.expenses };
                    }),
                    expenses: (expenses.expenses || []).map(function(e) {
                        return { date: e.date, project: e.project_title || '', desc: e.description, amount: e.amount, category: e.category };
                    }),
                    projects: (projects.projects || []).map(function(p) {
                        return { name: p.title, budget: p.budget_eur, spent: p.spent_eur, status: p.status };
                    })
                };
            } else {
                fin = DGD.demoData.DEMO_FINANCE;
            }

            // If on Kontobewegungen tab, load transactions first
            if (activeTab === 'kontobewegungen') {
                loadTransactions(container, fin);
            } else {
                renderPage(container, fin);
            }
        });
    };
})();
