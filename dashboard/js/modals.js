/* ==========================================================================
   DGD Dashboard - Modals (Employee Detail, Project Create/Edit, Charts)
   Depends on: namespace.js, helpers.js, tellent.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.modals = DGD.modals || {};

(function() {

    /* ------------------------------------------------------------------
       Employee Work Chart (SVG)
       ------------------------------------------------------------------ */

    var MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

    function renderEmployeeChart(containerId, empId) {
        var container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div class="dgd-chart-loading"><span class="dgd-chart-spinner"></span> Lade Arbeitszeitdaten...</div>';

        // Calculate date ranges for last 3 months
        // Current month uses today as end date (not end of month)
        var now = new Date();
        var pad2 = function(n) { return n < 10 ? '0' + n : '' + n; };
        var todayStr = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
        var months = [];
        for (var m = 2; m >= 0; m--) {
            var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
            var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            var isCurrentMonth = (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
            var toDate = isCurrentMonth ? todayStr : (d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(lastDay.getDate()));
            months.push({
                label: MONTH_NAMES_SHORT[d.getMonth()],
                fullLabel: MONTH_NAMES_SHORT[d.getMonth()] + ' ' + d.getFullYear(),
                from: d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-01',
                to: toDate,
                isCurrent: isCurrentMonth,
                data: null
            });
        }

        var loaded = 0;
        function onMonthLoaded() {
            loaded++;
            if (loaded < months.length) return;

            // Extract employee data from each month
            var monthlyData = [];
            for (var i = 0; i < months.length; i++) {
                var empData = null;
                if (months[i].data && months[i].data.statements) {
                    for (var j = 0; j < months[i].data.statements.length; j++) {
                        var st = months[i].data.statements[j];
                        if (st.user && st.user.id === empId) {
                            empData = st;
                            break;
                        }
                    }
                }
                monthlyData.push({
                    label: months[i].label,
                    fullLabel: months[i].fullLabel,
                    isCurrent: months[i].isCurrent || false,
                    soll: empData ? Math.round((empData.expectedTime || 0) / 3600) : 0,
                    ist: empData ? Math.round((empData.trackedTime || 0) / 3600) : 0,
                    timeoff: empData ? Math.round((empData.timeOffTime || 0) / 3600) : 0,
                    holiday: empData ? Math.round((empData.holidayTime || 0) / 3600) : 0,
                    overtime: empData ? Math.round((empData.overtime || 0) / 3600) : 0,
                    balance: empData ? Math.round((empData.balance || 0) / 3600) : 0,
                });
            }

            buildChartSVG(container, monthlyData);
        }

        // Fetch attendance for each month
        for (var i = 0; i < months.length; i++) {
            (function(idx) {
                TellentAPI.getAttendance(months[idx].from, months[idx].to, function(err, data) {
                    if (!err && data) {
                        months[idx].data = data;
                    }
                    onMonthLoaded();
                });
            })(i);
        }
    }

    function buildChartSVG(container, monthlyData) {
        var escapeHtml = DGD.helpers.escapeHtml;

        // Check if any data exists
        var hasData = false;
        for (var i = 0; i < monthlyData.length; i++) {
            if (monthlyData[i].soll > 0 || monthlyData[i].ist > 0) { hasData = true; break; }
        }
        if (!hasData) {
            container.innerHTML = '<div class="dgd-text-muted" style="padding:1rem;text-align:center">Keine Arbeitszeitdaten verfuegbar</div>';
            return;
        }

        var W = 420, H = 200;
        var pad = {top: 20, right: 15, bottom: 38, left: 42};
        var cW = W - pad.left - pad.right;
        var cH = H - pad.top - pad.bottom;
        var n = monthlyData.length;

        // Find max value for scale
        var maxVal = 0;
        for (var i = 0; i < n; i++) {
            maxVal = Math.max(maxVal, monthlyData[i].soll, monthlyData[i].ist);
        }
        maxVal = Math.ceil(maxVal / 20) * 20 + 10;

        var groupW = cW / n;
        var barW = Math.min(groupW * 0.28, 34);
        var gap = barW * 0.4;

        var svg = `<svg viewBox="0 0 ${W} ${H}" class="dgd-chart-svg" xmlns="http://www.w3.org/2000/svg">`;

        // Y-axis grid lines
        var gridSteps = 4;
        var stepVal = maxVal / gridSteps;
        for (var g = 0; g <= gridSteps; g++) {
            var yVal = Math.round(g * stepVal);
            var yPos = pad.top + cH - (yVal / maxVal * cH);
            svg += `<line x1="${pad.left}" y1="${yPos}" x2="${W - pad.right}" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="${g > 0 ? '4,3' : ''}"/>`;
            svg += `<text x="${pad.left - 6}" y="${yPos + 3.5}" text-anchor="end" fill="#94a3b8" font-size="9.5" font-family="inherit">${yVal}h</text>`;
        }

        // Baseline
        svg += `<line x1="${pad.left}" y1="${pad.top + cH}" x2="${W - pad.right}" y2="${pad.top + cH}" stroke="#94a3b8" stroke-width="1"/>`;

        // Stripe pattern for current month (in-progress indicator)
        svg += '<defs><pattern id="stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">';
        svg += '<rect width="3" height="6" fill="rgba(255,255,255,0.35)"/>';
        svg += '</pattern></defs>';

        // Bars for each month
        for (var i = 0; i < n; i++) {
            var d = monthlyData[i];
            var cx = pad.left + groupW * i + groupW / 2;

            // Soll bar (gray/blue-gray)
            var sollH = d.soll / maxVal * cH;
            var sollY = pad.top + cH - sollH;
            svg += `<rect x="${cx - barW - gap / 2}" y="${sollY}" width="${barW}" height="${sollH}" rx="3" fill="#cbd5e1" opacity="0.85">`;
            svg += `<title>Soll: ${d.soll}h (${d.fullLabel}${d.isCurrent ? ' - laufend' : ''})</title></rect>`;

            // Ist bar (color-coded) -- current month always green (incomplete data)
            var istH = d.ist / maxVal * cH;
            var istY = pad.top + cH - istH;
            var istColor = '#22c55e';
            if (d.soll > 0 && !d.isCurrent) {
                var ratio = d.ist / d.soll;
                istColor = ratio >= 0.9 ? '#22c55e' : (ratio >= 0.7 ? '#f59e0b' : '#ef4444');
            }
            svg += `<rect x="${cx + gap / 2}" y="${istY}" width="${barW}" height="${istH}" rx="3" fill="${istColor}">`;
            svg += `<title>Ist: ${d.ist}h (${d.fullLabel}${d.isCurrent ? ' - laufend' : ''})</title></rect>`;

            // Stripe overlay for current month
            if (d.isCurrent) {
                svg += `<rect x="${cx - barW - gap / 2}" y="${sollY}" width="${barW}" height="${sollH}" rx="3" fill="url(#stripe)" pointer-events="none"/>`;
                svg += `<rect x="${cx + gap / 2}" y="${istY}" width="${barW}" height="${istH}" rx="3" fill="url(#stripe)" pointer-events="none"/>`;
            }

            // Value labels on top of bars
            if (d.soll > 0) {
                svg += `<text x="${cx - barW / 2 - gap / 2}" y="${sollY - 5}" text-anchor="middle" fill="#64748b" font-size="9" font-weight="600">${d.soll}</text>`;
            }
            if (d.ist > 0) {
                svg += `<text x="${cx + barW / 2 + gap / 2}" y="${istY - 5}" text-anchor="middle" fill="${istColor}" font-size="9" font-weight="600">${d.ist}</text>`;
            }

            // Month label -- mark current month
            var monthLabel = d.label + (d.isCurrent ? '*' : '');
            svg += `<text x="${cx}" y="${H - pad.bottom + 16}" text-anchor="middle" fill="#475569" font-size="11" font-weight="500">${monthLabel}</text>`;

            // Overtime/deficit indicator (skip deficit for current month -- incomplete)
            if (d.overtime > 0) {
                svg += `<text x="${cx}" y="${H - 4}" text-anchor="middle" fill="#f59e0b" font-size="8" font-weight="600">+${d.overtime}h</text>`;
            } else if (d.balance < 0 && !d.isCurrent) {
                svg += `<text x="${cx}" y="${H - 4}" text-anchor="middle" fill="#ef4444" font-size="8" font-weight="600">${d.balance}h</text>`;
            } else if (d.isCurrent) {
                svg += `<text x="${cx}" y="${H - 4}" text-anchor="middle" fill="#94a3b8" font-size="7.5" font-style="italic">laufend</text>`;
            }
        }

        svg += '</svg>';

        // Legend
        var legend = '<div class="dgd-chart-legend">';
        legend += '<span class="dgd-chart-legend__item"><span class="dgd-chart-legend__dot" style="background:#cbd5e1"></span>Soll</span>';
        legend += '<span class="dgd-chart-legend__item"><span class="dgd-chart-legend__dot" style="background:#22c55e"></span>Ist</span>';
        legend += '</div>';

        // Build time composition section
        var totalData = {ist: 0, timeoff: 0, holiday: 0, fehlzeit: 0, soll: 0};
        for (var i = 0; i < monthlyData.length; i++) {
            totalData.ist += monthlyData[i].ist;
            totalData.soll += monthlyData[i].soll;
            totalData.timeoff += monthlyData[i].timeoff;
            totalData.holiday += monthlyData[i].holiday;
        }
        totalData.fehlzeit = Math.max(0, totalData.soll - totalData.ist - totalData.timeoff - totalData.holiday);

        var compHtml = buildCompositionBar(totalData);

        container.innerHTML = '<div class="dgd-chart-wrapper">' + svg + legend + '</div>' + compHtml;
    }

    function buildCompositionBar(data) {
        var escapeHtml = DGD.helpers.escapeHtml;
        var total = data.ist + data.timeoff + data.holiday + data.fehlzeit;
        if (total <= 0) return '';

        var segments = [
            {label: 'Arbeitszeit', value: data.ist, color: '#22c55e'},
            {label: 'Urlaub / Abwesenheit', value: data.timeoff, color: '#3b82f6'},
            {label: 'Feiertage', value: data.holiday, color: '#8b5cf6'},
        ];
        if (data.fehlzeit > 0) {
            segments.push({label: 'Fehlzeit', value: data.fehlzeit, color: '#ef4444'});
        }

        var html = '<div class="dgd-chart-composition">';
        html += `<div class="dgd-chart-composition__title">Zeitaufteilung (3 Monate gesamt: ${total}h)</div>`;
        html += '<div class="dgd-chart-composition__bar">';
        for (var i = 0; i < segments.length; i++) {
            var pct = total > 0 ? (segments[i].value / total * 100) : 0;
            if (pct < 0.5) continue;
            html += `<div class="dgd-chart-composition__segment" style="width:${pct.toFixed(1)}%;background:${segments[i].color}" title="${segments[i].label}: ${segments[i].value}h (${Math.round(pct)}%)"></div>`;
        }
        html += '</div>';

        html += '<div class="dgd-chart-composition__legend">';
        for (var i = 0; i < segments.length; i++) {
            if (segments[i].value <= 0) continue;
            var pct2 = total > 0 ? Math.round(segments[i].value / total * 100) : 0;
            html += '<span class="dgd-chart-composition__item">';
            html += `<span class="dgd-chart-legend__dot" style="background:${segments[i].color}"></span>`;
            html += `${DGD.helpers.escapeHtml(segments[i].label)} <strong>${segments[i].value}h</strong> (${pct2}%)`;
            html += '</span>';
        }
        html += '</div>';
        html += '</div>';

        return html;
    }

    /* ------------------------------------------------------------------
       Employee Detail Modal
       ------------------------------------------------------------------ */

    function openEmployeeDetail(empId) {
        var state = DGD.state;
        var escapeHtml = DGD.helpers.escapeHtml;

        var emp = null;
        for (var i = 0; i < DGD.state.employees.length; i++) {
            if (DGD.state.employees[i].id === empId) { emp = DGD.state.employees[i]; break; }
        }
        if (!emp) return;

        var empName = emp.firstName + ' ' + emp.lastName;
        var initials = (emp.firstName || '?')[0] + (emp.lastName || '?')[0];

        // Find attendance data
        var attData = null;
        for (var a = 0; a < (DGD.state.attendance || []).length; a++) {
            if (DGD.state.attendance[a].user && DGD.state.attendance[a].user.id === empId) {
                attData = DGD.state.attendance[a]; break;
            }
        }

        // Find time-off balances for this employee
        var empBalances = [];
        for (var b = 0; b < (DGD.state.timeOffBalances || []).length; b++) {
            var bal = DGD.state.timeOffBalances[b];
            if (bal.user && bal.user.id === empId) {
                empBalances.push(bal);
            }
        }

        // Find overtime
        var empOvertime = null;
        for (var o = 0; o < (DGD.state.overtime || []).length; o++) {
            if (DGD.state.overtime[o].user && DGD.state.overtime[o].user.id === empId) {
                empOvertime = DGD.state.overtime[o]; break;
            }
        }

        // Find anomalies for this employee
        var empAnomalies = [];
        for (var an = 0; an < (DGD.state.anomalies || []).length; an++) {
            if (DGD.state.anomalies[an].employeeId === empId) {
                empAnomalies.push(DGD.state.anomalies[an]);
            }
        }

        // Build modal HTML
        var html = '<div class="dgd-modal-overlay" id="emp-modal-overlay">';
        html += '<div class="dgd-modal dgd-modal--lg">';

        // Header
        html += '<div class="dgd-modal__header">';
        html += '<div style="display:flex;align-items:center;gap:12px">';
        html += `<div class="dgd-staff-avatar dgd-staff-avatar--lg">${DGD.helpers.escapeHtml(initials)}</div>`;
        html += `<div><h3 style="margin:0">${DGD.helpers.escapeHtml(empName)}</h3>`;
        html += `<div class="dgd-text-muted">${DGD.helpers.escapeHtml((emp.position && emp.position.name) || 'Keine Position')}</div></div>`;
        html += '</div>';
        html += '<button class="dgd-modal__close" id="emp-modal-close">&times;</button>';
        html += '</div>';

        // Body
        html += '<div class="dgd-modal__body">';

        // Info cards row
        html += '<div class="dgd-emp-info-grid">';

        // Basic info card
        html += '<div class="dgd-emp-card">';
        html += '<div class="dgd-emp-card__title">&#128100; Stammdaten</div>';
        html += `<div class="dgd-emp-card__row"><span>E-Mail</span><span>${DGD.helpers.escapeHtml(emp.email || '\u2014')}</span></div>`;
        html += `<div class="dgd-emp-card__row"><span>Team</span><span>${DGD.helpers.escapeHtml((emp.team && emp.team.name) || '\u2014')}</span></div>`;
        html += `<div class="dgd-emp-card__row"><span>Position</span><span>${DGD.helpers.escapeHtml((emp.position && emp.position.name) || '\u2014')}</span></div>`;
        html += `<div class="dgd-emp-card__row"><span>Status</span><span class="dgd-staff-status dgd-staff-status--${emp.isActive ? 'active' : 'inactive'}">${emp.isActive ? 'Aktiv' : 'Inaktiv'}</span></div>`;
        html += '</div>';

        // Attendance card
        html += '<div class="dgd-emp-card">';
        html += '<div class="dgd-emp-card__title">&#128340; Anwesenheit (letzte 3 Monate)</div>';
        if (attData) {
            var tH = Math.round((attData.trackedTime || 0) / 3600);
            var eH = Math.round((attData.expectedTime || 0) / 3600);
            var toH = Math.round((attData.timeOffTime || 0) / 3600);
            var holH = Math.round((attData.holidayTime || 0) / 3600);
            var balH = Math.round((attData.balance || 0) / 3600);
            var ovH = Math.round((attData.overtime || 0) / 3600);
            var pct = eH > 0 ? Math.round(tH / eH * 100) : 0;
            var pctColor = pct >= 90 ? '#22c55e' : (pct >= 70 ? '#f59e0b' : '#ef4444');

            html += '<div class="dgd-emp-attendance-bar">';
            html += `<div class="dgd-emp-attendance-bar__track"><div class="dgd-emp-attendance-bar__fill" style="width:${Math.min(pct, 100)}%;background:${pctColor}"></div></div>`;
            html += `<span style="font-weight:600;color:${pctColor}">${pct}%</span>`;
            html += '</div>';
            html += `<div class="dgd-emp-card__row"><span>Gearbeitete Zeit</span><strong>${tH}h</strong></div>`;
            html += `<div class="dgd-emp-card__row"><span>Sollzeit</span><span>${eH}h</span></div>`;
            html += `<div class="dgd-emp-card__row"><span>Urlaub/Abwesenheit</span><span>${toH}h</span></div>`;
            html += `<div class="dgd-emp-card__row"><span>Feiertage</span><span>${holH}h</span></div>`;
            html += `<div class="dgd-emp-card__row"><span>Saldo</span><span style="color:${balH >= 0 ? '#22c55e' : '#ef4444'};font-weight:600">${balH >= 0 ? '+' : ''}${balH}h</span></div>`;
            html += `<div class="dgd-emp-card__row"><span>Ueberstunden</span><span>${ovH}h</span></div>`;
        } else {
            html += '<div class="dgd-text-muted">Keine Anwesenheitsdaten verfuegbar</div>';
        }
        html += '</div>';

        html += '</div>'; // end info-grid

        // Work chart section
        html += '<div class="dgd-emp-card" style="margin-top:1rem">';
        html += '<div class="dgd-emp-card__title">&#128202; Arbeitszeitverlauf</div>';
        html += '<div id="emp-work-chart"></div>';
        html += '</div>';

        // Time-off balances
        if (empBalances.length > 0) {
            html += '<div class="dgd-emp-card" style="margin-top:1rem">';
            html += '<div class="dgd-emp-card__title">&#127796; Urlaubskonto & Abwesenheiten</div>';
            html += '<div class="dgd-emp-balances">';
            for (var bi = 0; bi < empBalances.length; bi++) {
                var b2 = empBalances[bi];
                var typeName = (b2.timeOffRule && b2.timeOffRule.timeOffType && b2.timeOffRule.timeOffType.name) || 'Unbekannt';
                var typeColor = (b2.timeOffRule && b2.timeOffRule.timeOffType && b2.timeOffRule.timeOffType.color) || '#6b7280';
                var avail = b2.available || 0;
                var used = b2.used || 0;
                var total = b2.totalAvailable || (avail + used);
                var usedPct = total > 0 ? Math.round(used / total * 100) : 0;

                html += '<div class="dgd-emp-balance-item">';
                html += '<div class="dgd-emp-balance-item__header">';
                html += `<span style="color:${typeColor};font-weight:600">${DGD.helpers.escapeHtml(typeName)}</span>`;
                html += `<span>${used} / ${total} Tage</span>`;
                html += '</div>';
                html += `<div class="dgd-emp-attendance-bar__track"><div class="dgd-emp-attendance-bar__fill" style="width:${usedPct}%;background:${typeColor}"></div></div>`;
                html += `<div class="dgd-emp-card__row dgd-text-sm"><span>Verfuegbar</span><span>${avail} Tage</span></div>`;
                html += '</div>';
            }
            html += '</div></div>';
        }

        // Overtime
        if (empOvertime) {
            var otBalance = Math.round((empOvertime.balance || 0) / 3600);
            html += '<div class="dgd-emp-card" style="margin-top:1rem">';
            html += '<div class="dgd-emp-card__title">&#9200; Ueberstundenkonto</div>';
            html += `<div class="dgd-emp-card__row"><span>Gesamtsaldo</span><span style="font-weight:700;font-size:1.25rem;color:${otBalance >= 0 ? '#22c55e' : '#ef4444'}">${otBalance >= 0 ? '+' : ''}${otBalance}h</span></div>`;
            html += '</div>';
        }

        // Anomalies
        if (empAnomalies.length > 0) {
            html += '<div class="dgd-emp-card dgd-emp-card--warning" style="margin-top:1rem">';
            html += '<div class="dgd-emp-card__title">&#9888; Erkannte Anomalien</div>';
            for (var ea = 0; ea < empAnomalies.length; ea++) {
                var anomaly = empAnomalies[ea];
                var sevClass = 'dgd-anomaly-sev--' + anomaly.severity;
                html += `<div class="dgd-anomaly-detail ${sevClass}">`;
                html += `<span class="dgd-anomaly-detail__sev">${anomaly.severity.toUpperCase()}</span>`;
                html += `<span>${DGD.helpers.escapeHtml(anomaly.description)}</span>`;
                html += '</div>';
            }
            html += '</div>';
        }

        html += '</div>'; // modal body
        html += '</div>'; // modal
        html += '</div>'; // overlay

        var modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = html;

        // Close handlers
        var closeModal = function() { modalContainer.innerHTML = ''; };
        document.getElementById('emp-modal-close').addEventListener('click', closeModal);
        document.getElementById('emp-modal-overlay').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });

        // Load and render work chart
        renderEmployeeChart('emp-work-chart', empId);
    }

    /* ------------------------------------------------------------------
       Project Modal (Create / Edit)
       ------------------------------------------------------------------ */

    function openProjectModal(projectId) {
        var state = DGD.state;
        var escapeHtml = DGD.helpers.escapeHtml;

        var project = null;
        if (projectId) {
            for (var i = 0; i < DGD.state.projects.length; i++) {
                if (DGD.state.projects[i].id === projectId) {
                    project = DGD.state.projects[i];
                    break;
                }
            }
        }
        var isEdit = !!project;
        var title = isEdit ? 'Projekt bearbeiten' : 'Neues Projekt';

        var categories = [
            { value: 'portal', label: 'Portal' },
            { value: 'marketing', label: 'Marketing' },
            { value: 'partner', label: 'Partner' },
            { value: 'intern', label: 'Intern' },
            { value: 'kunde', label: 'Kunde' },
        ];
        var statuses = [
            { value: 'geplant', label: 'Geplant' },
            { value: 'aktiv', label: 'Aktiv' },
            { value: 'abgeschlossen', label: 'Abgeschlossen' },
            { value: 'pausiert', label: 'Pausiert' },
        ];
        var priorities = [
            { value: 'hoch', label: 'Hoch' },
            { value: 'mittel', label: 'Mittel' },
            { value: 'niedrig', label: 'Niedrig' },
        ];

        var p = project || { title: '', description: '', category: 'intern', status: 'geplant', priority: 'mittel', start_date: '', end_date: '', progress: 0, owner: '' };

        var html = '<div class="dgd-modal-overlay" id="project-modal-overlay">';
        html += '<div class="dgd-modal">';

        // Header
        html += '<div class="dgd-modal__header">';
        html += `<h3>${DGD.helpers.escapeHtml(title)}</h3>`;
        html += '<button class="dgd-modal__close" id="modal-close">&times;</button>';
        html += '</div>';

        // Body
        html += '<div class="dgd-modal__body">';
        html += '<form id="project-form" class="dgd-form">';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Titel</label>';
        html += `<input type="text" class="dgd-form__input" id="proj-title" value="${DGD.helpers.escapeHtml(p.title)}" required>`;
        html += '</div>';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Beschreibung</label>';
        html += `<textarea class="dgd-form__input" id="proj-desc" rows="3">${DGD.helpers.escapeHtml(p.description)}</textarea>`;
        html += '</div>';

        // Row: Category + Status
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Kategorie</label>';
        html += '<select class="dgd-form__input" id="proj-category">';
        for (var ci = 0; ci < categories.length; ci++) {
            var sel = p.category === categories[ci].value ? ' selected' : '';
            html += `<option value="${categories[ci].value}"${sel}>${DGD.helpers.escapeHtml(categories[ci].label)}</option>`;
        }
        html += '</select></div>';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Status</label>';
        html += '<select class="dgd-form__input" id="proj-status">';
        for (var si = 0; si < statuses.length; si++) {
            var selS = p.status === statuses[si].value ? ' selected' : '';
            html += `<option value="${statuses[si].value}"${selS}>${DGD.helpers.escapeHtml(statuses[si].label)}</option>`;
        }
        html += '</select></div>';
        html += '</div>';

        // Row: Priority + Progress
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Prioritaet</label>';
        html += '<select class="dgd-form__input" id="proj-priority">';
        for (var pi = 0; pi < priorities.length; pi++) {
            var selP = p.priority === priorities[pi].value ? ' selected' : '';
            html += `<option value="${priorities[pi].value}"${selP}>${DGD.helpers.escapeHtml(priorities[pi].label)}</option>`;
        }
        html += '</select></div>';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Fortschritt (%)</label>';
        html += `<input type="number" class="dgd-form__input" id="proj-progress" min="0" max="100" value="${p.progress || 0}">`;
        html += '</div>';
        html += '</div>';

        // Row: Dates
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Startdatum</label>';
        html += `<input type="date" class="dgd-form__input" id="proj-start" value="${DGD.helpers.escapeHtml(p.start_date)}">`;
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Enddatum</label>';
        html += `<input type="date" class="dgd-form__input" id="proj-end" value="${DGD.helpers.escapeHtml(p.end_date)}">`;
        html += '</div>';
        html += '</div>';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Verantwortlich</label>';
        html += `<input type="text" class="dgd-form__input" id="proj-owner" value="${DGD.helpers.escapeHtml(p.owner || '')}">`;
        html += '</div>';

        html += '</form>';
        html += '</div>';

        // Footer
        html += '<div class="dgd-modal__footer">';
        html += '<button class="dgd-btn dgd-btn--outline dgd-btn--sm" id="modal-cancel" style="color:var(--dgd-gray-600);border-color:var(--dgd-gray-300);">Abbrechen</button>';
        html += '<button class="dgd-btn dgd-btn--primary dgd-btn--sm" id="modal-save">Speichern</button>';
        html += '</div>';

        html += '</div>'; // modal
        html += '</div>'; // overlay

        var modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = html;

        // Bind close
        var closeModal = function() { modalContainer.innerHTML = ''; };
        document.getElementById('modal-close').addEventListener('click', closeModal);
        document.getElementById('modal-cancel').addEventListener('click', closeModal);
        document.getElementById('project-modal-overlay').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });

        // Bind save
        document.getElementById('modal-save').addEventListener('click', function() {
            var data = {
                title: document.getElementById('proj-title').value.trim(),
                description: document.getElementById('proj-desc').value.trim(),
                category: document.getElementById('proj-category').value,
                status: document.getElementById('proj-status').value,
                priority: document.getElementById('proj-priority').value,
                progress: parseInt(document.getElementById('proj-progress').value, 10) || 0,
                start_date: document.getElementById('proj-start').value,
                end_date: document.getElementById('proj-end').value,
                owner: document.getElementById('proj-owner').value.trim(),
            };

            if (!data.title) {
                document.getElementById('proj-title').focus();
                return;
            }

            if (DGD.state.demoMode) {
                if (isEdit) {
                    // Update in local state
                    for (var ui = 0; ui < DGD.state.projects.length; ui++) {
                        if (DGD.state.projects[ui].id === project.id) {
                            for (var key in data) {
                                DGD.state.projects[ui][key] = data[key];
                            }
                            break;
                        }
                    }
                } else {
                    // Create in local state
                    data.id = 'p' + Date.now();
                    data.milestones = [];
                    DGD.state.projects.push(data);
                }
                closeModal();
                DGD.router.route();
            } else {
                var promise = isEdit
                    ? dashboardApi.updateProject(project.id, data)
                    : dashboardApi.createProject(data);
                promise.then(function() {
                    DGD.dataLoader.loadData();
                    closeModal();
                    setTimeout(DGD.router.route, 300);
                });
            }
        });
    }

    /* ------------------------------------------------------------------
       Public API
       ------------------------------------------------------------------ */

    DGD.modals.buildCompositionBar = buildCompositionBar;
    DGD.modals.openEmployeeDetail = openEmployeeDetail;
    DGD.modals.openProjectModal = openProjectModal;
    DGD.modals.renderEmployeeChart = renderEmployeeChart;

})();
