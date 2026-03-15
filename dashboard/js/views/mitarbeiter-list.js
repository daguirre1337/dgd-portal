/* ==========================================================================
   DGD Dashboard - View: Mitarbeiter - Employee List + Detail Modal
   Depends on: mitarbeiter.js (shared utilities)
   ========================================================================== */

(function() {
    'use strict';

    function getShared() {
        return DGD.views.mitarbeiter._shared;
    }

    /* ------------------------------------------------------------------
       Cortex Employee Evaluation (per employee row) - global handler
       ------------------------------------------------------------------ */

    window._requestCortexEmployeeEval = function(empId, btn) {
        var shared = getShared();
        var OT_CAP = shared.OT_CAP;
        var rowEl = document.getElementById('cortex-emp-row-' + empId);
        var container = document.getElementById('cortex-emp-' + empId);
        if (!rowEl || !container) return;

        // Toggle: if already visible with content, hide it
        if (rowEl.style.display !== 'none' && container.querySelector('.dgd-my-profile__cortex-text')) {
            rowEl.style.display = 'none';
            return;
        }

        rowEl.style.display = '';
        if (btn) btn.disabled = true;

        // Find employee data
        var emp = null;
        var employees = DGD.state.employees || [];
        for (var i = 0; i < employees.length; i++) {
            if (employees[i].id === empId) { emp = employees[i]; break; }
        }
        if (!emp) {
            container.innerHTML = '<div class="dgd-my-profile__cortex-error">Mitarbeiter nicht gefunden</div>';
            if (btn) btn.disabled = false;
            return;
        }

        // Collect employee stats
        var attRec = null, otRec = null, vacDays = 0, vacUsed = 0;
        for (var a = 0; a < (DGD.state.attendance || []).length; a++) {
            if (DGD.state.attendance[a].user && DGD.state.attendance[a].user.id === empId) { attRec = DGD.state.attendance[a]; break; }
        }
        for (var o = 0; o < (DGD.state.overtime || []).length; o++) {
            if (DGD.state.overtime[o].user && DGD.state.overtime[o].user.id === empId) { otRec = DGD.state.overtime[o]; break; }
        }
        var currentYear = new Date().getFullYear().toString();
        for (var vb = 0; vb < (DGD.state.timeOffBalances || []).length; vb++) {
            var vbal = DGD.state.timeOffBalances[vb];
            var vTypeName = (vbal.timeOffRule && vbal.timeOffRule.timeOffType && vbal.timeOffRule.timeOffType.name) || '';
            var periodStart = vbal.periodStartDate || '';
            if (vTypeName.toLowerCase().indexOf('urlaub') !== -1 && vbal.user && vbal.user.id === empId && periodStart.indexOf(currentYear) === 0) {
                vacDays += (vbal.available || 0);
                vacUsed += (vbal.used || 0);
            }
        }

        var attPct = (attRec && attRec.expectedTime > 0) ? Math.round((attRec.trackedTime || 0) / attRec.expectedTime * 100) : 0;
        var trackedH = attRec ? Math.round((attRec.trackedTime || 0) / 3600) : 0;
        var expectedH = attRec ? Math.round((attRec.expectedTime || 0) / 3600) : 0;
        var otH = otRec ? Math.round((otRec.balance || 0) / 3600) : 0;
        var empName = emp.firstName + ' ' + emp.lastName;
        var empPos = (emp.position && emp.position.name) || 'unbekannt';
        var empDept = (emp.team && emp.team.name) || 'unbekannt';

        // Tenure
        var tenureMonths = 0;
        if (emp.employmentStartDate) {
            var sd = new Date(emp.employmentStartDate);
            tenureMonths = Math.max(0, Math.round((new Date() - sd) / (1000 * 60 * 60 * 24 * 30.44)));
        }

        // Anomalies
        var empAnomalies = [];
        for (var an = 0; an < (DGD.state.anomalies || []).length; an++) {
            if ((DGD.state.anomalies[an].employeeId || '') === empId) empAnomalies.push(DGD.state.anomalies[an].description);
        }

        // Equity calculation for Cortex prompt
        var empEquity = otH > 0 ? DGD.demoData.calcEquity(otH, empPos) : null;

        var prompt = 'Du bist Cortex, ein KI-HR-Berater. Bewerte diesen Mitarbeiter kurz und pr\u00E4gnant.\n\n' +
            'MITARBEITER: ' + empName + '\n' +
            '- Position: ' + empPos + ' | Abteilung: ' + empDept + '\n' +
            '- Anwesenheit: ' + attPct + '% (' + trackedH + '/' + expectedH + 'h)\n' +
            '- \u00DCberstunden: ' + (otH >= 0 ? '+' : '') + otH + 'h (Cap: 200h)\n' +
            '- Urlaub: ' + Math.round(vacDays * 10) / 10 + ' verbleibend von ' + Math.round((vacDays + vacUsed) * 10) / 10 + ' Tagen (' + Math.round(vacUsed * 10) / 10 + ' genommen)\n' +
            '- Betriebszugeh\u00F6rigkeit: ' + tenureMonths + ' Monate\n' +
            '- Status: ' + (emp.isActive ? 'Aktiv' : 'Inaktiv') + '\n' +
            (empAnomalies.length > 0 ? '- Anomalien: ' + empAnomalies.join('; ') + '\n' : '- Keine Anomalien\n') +
            (empEquity ? '- Beteiligungsprogramm: ' + empEquity.value.toLocaleString('de-DE') + '\u20AC Anteilswert (' + empEquity.pct.toFixed(2) + '% bei 3,5M Bewertung, ' + empEquity.rate + '\u20AC/h)\n' : '') +
            '\nBewerte in 3-4 S\u00E4tzen: St\u00E4rken, Risiken, eine konkrete Empfehlung. Erw\u00E4hne den Anteilswert wenn vorhanden. Nutze **fett** f\u00FCr Kernaussagen. Deutsch.';

        shared.streamCortexSSE(prompt, container, btn);
    };

    /* ------------------------------------------------------------------
       Render List Section (called from main dispatcher)
       ------------------------------------------------------------------ */

    DGD.views.mitarbeiter.renderList = function(data) {
        var html = '';
        var shared = getShared();
        var OT_CAP = shared.OT_CAP;
        var employees = data.employees;
        var lookups = data.lookups;
        var hrMode = data.hrMode;
        var attendByUser = lookups.attendByUser;
        var overtimeByUser = lookups.overtimeByUser;
        var vacBalByUser = lookups.vacBalByUser;
        var vacUsedByUser = lookups.vacUsedByUser;

        var empAnomalies = DGD.state.anomalies || [];

        // Employee table
        html += '<div class="dgd-section-card">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>';
        html += ' Alle Mitarbeiter (' + employees.length + ')</div>';

        // Search
        html += '<div class="dgd-staff-search">';
        html += '<input type="text" id="staff-search" class="dgd-form__input" placeholder="Mitarbeiter suchen...">';
        html += '</div>';

        // Anomalies banner (HR/Admin only)
        if (hrMode && empAnomalies.length > 0) {
            html += '<div class="dgd-anomaly-banner">';
            html += '<div class="dgd-anomaly-banner__icon">&#9888;</div>';
            html += '<div class="dgd-anomaly-banner__content">';
            html += '<strong>' + empAnomalies.length + ' Anomalie' + (empAnomalies.length > 1 ? 'n' : '') + ' erkannt</strong>';
            html += '<div class="dgd-anomaly-banner__list">';
            for (var ai = 0; ai < Math.min(empAnomalies.length, 5); ai++) {
                var an = empAnomalies[ai];
                html += '<div class="dgd-anomaly-item">';
                html += '<span class="dgd-anomaly-item__name">' + DGD.helpers.escapeHtml(an.employeeName) + '</span>';
                html += '<span class="dgd-anomaly-item__desc">' + DGD.helpers.escapeHtml(an.description) + '</span>';
                html += '</div>';
            }
            if (empAnomalies.length > 5) {
                html += '<div class="dgd-anomaly-item dgd-text-muted">+ ' + (empAnomalies.length - 5) + ' weitere...</div>';
            }
            html += '</div></div></div>';
        }

        html += '<div class="dgd-staff-table-wrap">';
        html += '<table class="dgd-staff-table" id="staff-table">';
        html += '<thead><tr>';
        html += '<th>Name</th><th>Position</th><th>Abteilung</th><th>Anwesenheit</th><th>\u00DCberstunden</th><th>Resturlaub</th><th>Status</th><th></th>';
        html += '</tr></thead><tbody>';

        for (var e = 0; e < employees.length; e++) {
            var emp2 = employees[e];
            var statusClass = emp2.isActive ? 'active' : 'inactive';
            var statusLabel = emp2.isActive ? 'Aktiv' : 'Inaktiv';

            // Attendance info
            var attInfo = attendByUser[emp2.id];
            var attHtml = '\u2014';
            if (attInfo) {
                var trackedH = Math.round((attInfo.trackedTime || 0) / 3600);
                var expectedH = Math.round((attInfo.expectedTime || 0) / 3600);
                var attPercent = expectedH > 0 ? Math.round(trackedH / expectedH * 100) : 0;
                var attClr = DGD.helpers.attPctColor(attPercent);
                attHtml = '<div class="dgd-staff-attendance">';
                attHtml += '<div class="dgd-staff-attendance__bar"><div class="dgd-staff-attendance__fill" style="width:' + Math.min(attPercent, 100) + '%;background:' + attClr + '"></div></div>';
                attHtml += '<span class="dgd-staff-attendance__text">' + trackedH + '/' + expectedH + 'h (' + attPercent + '%)</span>';
                attHtml += '</div>';
            }

            // Overtime cell
            var otInfo = overtimeByUser[emp2.id];
            var otHtml = '\u2014';
            if (otInfo) {
                var otH = Math.round((otInfo.balance || 0) / 3600);
                var otClr = DGD.helpers.overtimeColor(otH);
                var otAbs = Math.abs(otH);
                var otPct = Math.min(Math.round(otAbs / OT_CAP * 100), 100);
                var capExceeded = otH >= OT_CAP;
                var capWarning = otH >= OT_CAP * 0.75;
                var barColor = otH < 0 ? '#ef4444' : (capExceeded ? '#ef4444' : (capWarning ? '#f59e0b' : '#22c55e'));

                otHtml = '<div class="dgd-ot-gauge">';
                otHtml += '<div class="dgd-ot-gauge__bar">';
                if (otH >= 0) {
                    otHtml += '<div class="dgd-ot-gauge__fill" style="width:' + otPct + '%;background:' + barColor + '"></div>';
                    otHtml += '<div class="dgd-ot-gauge__cap" title="200h Cap"></div>';
                } else {
                    otHtml += '<div class="dgd-ot-gauge__fill dgd-ot-gauge__fill--neg" style="width:' + Math.min(otPct, 50) + '%;background:#ef4444"></div>';
                }
                otHtml += '</div>';
                otHtml += '<span class="dgd-ot-gauge__label" style="color:' + barColor + '">' + (otH >= 0 ? '+' : '') + otH + 'h</span>';
                if (capExceeded) otHtml += '<span class="dgd-ot-gauge__alert" title="\u00dcber 200h Cap!">&#9888;</span>';
                otHtml += '</div>';
            }

            // Vacation balance cell
            var vacAvail = vacBalByUser[emp2.id];
            var vacUsedEmp = (vacUsedByUser && vacUsedByUser[emp2.id]) || 0;
            var vacHtml = '\u2014';
            if (vacAvail !== undefined) {
                var vacR = Math.round(vacAvail * 10) / 10;
                var vacT = Math.round((vacAvail + vacUsedEmp) * 10) / 10;
                vacHtml = vacR + (vacUsedEmp > 0 ? ' / ' + vacT : '') + ' Tage';
            }

            // Check if employee has anomalies
            var hasAnomaly = false;
            for (var aIdx = 0; aIdx < empAnomalies.length; aIdx++) {
                if (empAnomalies[aIdx].employeeId === emp2.id) { hasAnomaly = true; break; }
            }

            html += '<tr class="dgd-staff-row dgd-staff-row--clickable' + (hasAnomaly ? ' dgd-staff-row--anomaly' : '') + '" data-emp-id="' + DGD.helpers.escapeHtml(emp2.id) + '" data-search="' + DGD.helpers.escapeHtml((emp2.firstName + ' ' + emp2.lastName + ' ' + ((emp2.position && emp2.position.name) || '') + ' ' + ((emp2.team && emp2.team.name) || '')).toLowerCase()) + '">';
            html += '<td class="dgd-staff-row__name">';
            html += '<div class="dgd-staff-avatar">' + DGD.helpers.escapeHtml((emp2.firstName || '?')[0] + (emp2.lastName || '?')[0]) + '</div>';
            html += '<div><strong>' + DGD.helpers.escapeHtml(emp2.firstName + ' ' + emp2.lastName) + '</strong>';
            if (hasAnomaly) html += ' <span class="dgd-anomaly-badge" title="Anomalie erkannt">&#9888;</span>';
            html += '<div class="dgd-staff-row__email">' + DGD.helpers.escapeHtml(emp2.email || '') + '</div></div>';
            html += '</td>';
            html += '<td>' + DGD.helpers.escapeHtml((emp2.position && emp2.position.name) || '\u2014') + '</td>';
            html += '<td>' + DGD.helpers.escapeHtml((emp2.team && emp2.team.name) || '\u2014') + '</td>';
            html += '<td>' + attHtml + '</td>';
            html += '<td>' + otHtml + '</td>';
            html += '<td>' + vacHtml + '</td>';
            html += '<td><span class="dgd-staff-status dgd-staff-status--' + statusClass + '">' + statusLabel + '</span></td>';
            html += '<td class="dgd-staff-row__cortex-cell"><button class="dgd-staff-cortex-btn" data-emp-cortex="' + DGD.helpers.escapeHtml(emp2.id) + '" title="Cortex Analyse">\uD83E\uDD16</button></td>';
            html += '</tr>';
            // Hidden row for Cortex analysis result
            html += '<tr class="dgd-staff-cortex-row" id="cortex-emp-row-' + DGD.helpers.escapeHtml(emp2.id) + '" style="display:none">';
            html += '<td colspan="8"><div class="dgd-staff-cortex-container" id="cortex-emp-' + DGD.helpers.escapeHtml(emp2.id) + '"></div></td>';
            html += '</tr>';
        }

        html += '</tbody></table></div></div>';

        // Live data footer
        html += '<div class="dgd-tellent-status dgd-tellent-status--connected" style="margin-top:1rem">';
        html += '<span class="dgd-tellent-status__dot"></span>';
        html += 'Live-Daten aus TellentHR/KiwiHR';
        html += '</div>';

        return html;
    };

    /* ------------------------------------------------------------------
       Wire up event handlers (called after innerHTML is set)
       ------------------------------------------------------------------ */

    DGD.views.mitarbeiter.wireListEvents = function() {
        // Wire up search
        var searchInput = document.getElementById('staff-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                var query = this.value.toLowerCase();
                var rows = document.querySelectorAll('.dgd-staff-row');
                for (var r = 0; r < rows.length; r++) {
                    var match = !query || (rows[r].getAttribute('data-search') || '').indexOf(query) !== -1;
                    rows[r].style.display = match ? '' : 'none';
                }
            });
        }

        // Wire up row clicks for employee detail
        var staffRows = document.querySelectorAll('.dgd-staff-row--clickable');
        for (var sr = 0; sr < staffRows.length; sr++) {
            staffRows[sr].addEventListener('click', function() {
                var empId = this.getAttribute('data-emp-id');
                if (empId) DGD.modals.openEmployeeDetail(empId);
            });
        }

        // Wire up Cortex employee buttons
        var cortexBtns = document.querySelectorAll('.dgd-staff-cortex-btn');
        for (var cb = 0; cb < cortexBtns.length; cb++) {
            cortexBtns[cb].addEventListener('click', function(e) {
                e.stopPropagation();
                var empId = this.getAttribute('data-emp-cortex');
                if (empId) window._requestCortexEmployeeEval(empId, this);
            });
        }
    };
})();
