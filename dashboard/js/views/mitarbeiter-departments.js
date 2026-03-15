/* ==========================================================================
   DGD Dashboard - View: Mitarbeiter - Department Score Cards
   Depends on: mitarbeiter.js (shared utilities)
   ========================================================================== */

(function() {
    'use strict';

    function getShared() {
        return DGD.views.mitarbeiter._shared;
    }

    /* ------------------------------------------------------------------
       Department Score Algorithm (A-F)
       ------------------------------------------------------------------ */

    function computeDeptScore(attPct, overCapCount, anomalyCount) {
        var attS = attPct >= 90 ? 100 : (attPct >= 80 ? 75 : (attPct >= 70 ? 50 : 25));
        var otS  = overCapCount === 0 ? 100 : (overCapCount <= 1 ? 60 : 20);
        var anS  = anomalyCount === 0 ? 100 : (anomalyCount <= 1 ? 70 : 30);
        var total = attS * 0.4 + otS * 0.3 + anS * 0.3;
        var grade, color;
        if (total >= 85) { grade = 'A'; color = '#22c55e'; }
        else if (total >= 70) { grade = 'B'; color = '#84cc16'; }
        else if (total >= 55) { grade = 'C'; color = '#f59e0b'; }
        else if (total >= 40) { grade = 'D'; color = '#f97316'; }
        else { grade = 'F'; color = '#ef4444'; }
        return { grade: grade, color: color, score: Math.round(total) };
    }

    /* ------------------------------------------------------------------
       Build Department Detail Card
       ------------------------------------------------------------------ */

    function buildDeptCard(deptName, deptEmps, attendByUser, overtimeByUser, vacBalByUser, vacUsedByUser, anomalies, deptIdx) {
        var shared = getShared();
        var OT_CAP = shared.OT_CAP;

        var activeEmps = [];
        for (var i = 0; i < deptEmps.length; i++) {
            if (deptEmps[i].isActive) activeEmps.push(deptEmps[i]);
        }
        var activeCount = activeEmps.length;

        // Attendance aggregates
        var attPctSum = 0, attPctCount = 0;
        var deptSoll = 0, deptIst = 0, deptTimeoff = 0, deptHoliday = 0;
        for (var a = 0; a < activeEmps.length; a++) {
            var aRec = attendByUser[activeEmps[a].id];
            if (aRec && (aRec.expectedTime || 0) > 0) {
                attPctSum += (aRec.trackedTime || 0) / aRec.expectedTime;
                attPctCount++;
                deptSoll += (aRec.expectedTime || 0) / 3600;
                deptIst += (aRec.trackedTime || 0) / 3600;
                deptTimeoff += (aRec.timeOffTime || 0) / 3600;
                deptHoliday += (aRec.holidayTime || 0) / 3600;
            }
        }
        var avgAtt = attPctCount > 0 ? Math.round(attPctSum / attPctCount * 100) : 0;
        deptSoll = Math.round(deptSoll); deptIst = Math.round(deptIst);
        deptTimeoff = Math.round(deptTimeoff); deptHoliday = Math.round(deptHoliday);

        // Overtime aggregates
        var totalOtH = 0, overCapCount = 0;
        var empOtList = [];
        for (var o = 0; o < activeEmps.length; o++) {
            var otRec = overtimeByUser[activeEmps[o].id];
            var otH = otRec ? Math.round((otRec.balance || 0) / 3600) : 0;
            totalOtH += otH;
            if (otH >= OT_CAP) overCapCount++;
            empOtList.push({ emp: activeEmps[o], otH: otH, att: attendByUser[activeEmps[o].id] || null });
        }
        var avgOt = activeCount > 0 ? Math.round(totalOtH / activeCount * 10) / 10 : 0;
        empOtList.sort(function(a, b) { return b.otH - a.otH; });

        // Vacation aggregates
        var totalVac = 0, totalVacUsed = 0;
        for (var v = 0; v < activeEmps.length; v++) {
            totalVac += (vacBalByUser[activeEmps[v].id] || 0);
            totalVacUsed += ((vacUsedByUser && vacUsedByUser[activeEmps[v].id]) || 0);
        }
        totalVac = Math.round(totalVac * 10) / 10;
        totalVacUsed = Math.round(totalVacUsed * 10) / 10;
        var totalVacTotal = Math.round((totalVac + totalVacUsed) * 10) / 10;

        // Anomalies for this dept
        var deptAnomalies = [];
        for (var an = 0; an < anomalies.length; an++) {
            for (var ae = 0; ae < deptEmps.length; ae++) {
                if (anomalies[an].employeeId === deptEmps[ae].id) { deptAnomalies.push(anomalies[an]); break; }
            }
        }

        // Score
        var score = computeDeptScore(avgAtt, overCapCount, deptAnomalies.length);

        // Build HTML
        var cortexId = 'cortex-dept-' + deptIdx;
        var h = '';
        h += '<div class="dgd-dept-card" style="animation-delay:' + (deptIdx * 0.08) + 's">';

        // Header
        h += '<div class="dgd-dept-card__header">';
        h += '<div class="dgd-dept-card__title-wrap">';
        h += '<h4 class="dgd-dept-card__name">' + DGD.helpers.escapeHtml(deptName) + '</h4>';
        h += '<span class="dgd-dept-card__count">' + deptEmps.length + ' MA (' + activeCount + ' aktiv)</span>';
        h += '</div>';
        h += '<div class="dgd-dept-card__score" style="background:' + score.color + '" title="Score: ' + score.score + '/100">' + score.grade + '</div>';
        h += '</div>';

        // KPI Mini-Grid
        h += '<div class="dgd-dept-card__kpis">';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val" style="color:' + DGD.helpers.attPctColor(avgAtt) + '">' + avgAtt + '%</span><span class="dgd-dept-kpi__label">\u00D8 Anwesenheit</span><span class="dgd-dept-kpi__target">Ziel: \u226595%</span></div>';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val" style="color:' + DGD.helpers.overtimeColor(totalOtH) + '">' + (totalOtH >= 0 ? '+' : '') + totalOtH + 'h</span><span class="dgd-dept-kpi__label">\u00DCberstunden \u03A3</span></div>';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val">' + (avgOt >= 0 ? '+' : '') + avgOt + 'h</span><span class="dgd-dept-kpi__label">\u00D8/Mitarbeiter</span><span class="dgd-dept-kpi__target">Ziel: \u00b10h</span></div>';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val" style="color:' + (overCapCount > 0 ? '#ef4444' : '#22c55e') + '">' + overCapCount + (overCapCount > 0 ? ' \u26A0' : '') + '</span><span class="dgd-dept-kpi__label">\u00FCber 200h Cap</span><span class="dgd-dept-kpi__target">Ziel: 0</span></div>';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val" style="color:#06b6d4">' + totalVac + (totalVacUsed > 0 ? ' / ' + totalVacTotal : '') + 'd</span><span class="dgd-dept-kpi__label">Resturlaub' + (totalVacUsed > 0 ? ' (' + totalVacUsed + ' gen.)' : '') + '</span></div>';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val" style="color:' + (deptAnomalies.length > 0 ? '#ef4444' : '#94a3b8') + '">' + deptAnomalies.length + '</span><span class="dgd-dept-kpi__label">Anomalien</span><span class="dgd-dept-kpi__target">Ziel: 0</span></div>';
        h += '</div>';

        // Composition bar
        if (deptSoll > 0) {
            var deptStats = { soll: deptSoll, ist: deptIst, timeoff: deptTimeoff, holiday: deptHoliday, fehlzeit: Math.max(0, deptSoll - deptIst - deptTimeoff - deptHoliday) };
            h += DGD.modals.buildCompositionBar(deptStats);
        }

        // Mini employee list
        if (empOtList.length > 0) {
            h += '<div class="dgd-dept-card__employees">';
            h += '<div class="dgd-dept-card__emp-title">Mitarbeiter</div>';
            for (var e = 0; e < empOtList.length; e++) {
                var emp = empOtList[e].emp;
                var eOtH = empOtList[e].otH;
                var empAtt = empOtList[e].att;
                var empAttPct = (empAtt && empAtt.expectedTime > 0) ? Math.round((empAtt.trackedTime || 0) / empAtt.expectedTime * 100) : 0;
                var otPct = Math.min(Math.round(Math.abs(eOtH) / OT_CAP * 100), 100);
                var barClr = eOtH < 0 ? '#ef4444' : (eOtH >= OT_CAP ? '#ef4444' : (eOtH >= OT_CAP * 0.75 ? '#f59e0b' : '#22c55e'));

                h += '<div class="dgd-dept-emp">';
                h += '<span class="dgd-dept-emp__name">' + DGD.helpers.escapeHtml(emp.firstName + ' ' + emp.lastName) + '</span>';
                h += '<span class="dgd-dept-emp__att" style="color:' + DGD.helpers.attPctColor(empAttPct) + '">' + empAttPct + '%</span>';
                h += '<div class="dgd-dept-emp__ot-bar">';
                if (eOtH >= 0) {
                    h += '<div class="dgd-dept-emp__ot-fill" style="width:' + otPct + '%;background:' + barClr + '"></div>';
                    h += '<div class="dgd-dept-emp__ot-cap"></div>';
                } else {
                    h += '<div class="dgd-dept-emp__ot-fill" style="width:' + Math.min(otPct, 50) + '%;background:#ef4444;float:right"></div>';
                }
                h += '</div>';
                h += '<span class="dgd-dept-emp__ot-val" style="color:' + barClr + '">' + (eOtH >= 0 ? '+' : '') + eOtH + 'h</span>';
                if (eOtH >= OT_CAP) h += '<span class="dgd-ot-gauge__alert">\u26A0</span>';
                h += '</div>';
            }
            h += '</div>';
        }

        // Cortex evaluation area
        h += '<div class="dgd-dept-card__cortex">';
        h += '<button class="dgd-dept-card__cortex-btn" onclick="window._requestCortexEval(\'' + DGD.helpers.escapeHtml(deptName) + '\', ' + deptIdx + ')">';
        h += '\uD83E\uDD16 Cortex Analyse anfordern</button>';
        h += '<div id="' + cortexId + '" class="dgd-dept-card__cortex-result"></div>';
        h += '</div>';

        h += '</div>';
        return h;
    }

    /* ------------------------------------------------------------------
       Cortex Department Evaluation (global handler)
       ------------------------------------------------------------------ */

    window._requestCortexEval = function(deptName, deptIdx) {
        var shared = getShared();
        var OT_CAP = shared.OT_CAP;
        var containerId = 'cortex-dept-' + deptIdx;
        var container = document.getElementById(containerId);
        if (!container) return;

        var employees = DGD.state.employees || [];
        var deptEmps = [];
        for (var i = 0; i < employees.length; i++) {
            if ((employees[i].team && employees[i].team.name) === deptName) deptEmps.push(employees[i]);
        }

        var activeCount = 0;
        var attData = [], otData = [];
        for (var e = 0; e < deptEmps.length; e++) {
            if (deptEmps[e].isActive) activeCount++;
            for (var a = 0; a < (DGD.state.attendance || []).length; a++) {
                if (DGD.state.attendance[a].user && DGD.state.attendance[a].user.id === deptEmps[e].id) {
                    var att = DGD.state.attendance[a];
                    attData.push(deptEmps[e].firstName + ' ' + deptEmps[e].lastName + ': ' +
                        Math.round((att.trackedTime||0)/3600) + '/' + Math.round((att.expectedTime||0)/3600) + 'h');
                    break;
                }
            }
            for (var o = 0; o < (DGD.state.overtime || []).length; o++) {
                if (DGD.state.overtime[o].user && DGD.state.overtime[o].user.id === deptEmps[e].id) {
                    otData.push(deptEmps[e].firstName + ' ' + deptEmps[e].lastName + ': ' +
                        Math.round((DGD.state.overtime[o].balance||0)/3600) + 'h');
                    break;
                }
            }
        }

        var prompt = '[DGD Dashboard - Abteilungsanalyse]\n' +
            'Analysiere die Abteilung "' + deptName + '" (' + activeCount + ' aktive MA).\n' +
            'Anwesenheit: ' + attData.join(', ') + '\n' +
            '\u00DCberstunden: ' + otData.join(', ') + '\n' +
            'Bitte bewerte die Abteilung kurz (3-4 S\u00E4tze): St\u00E4rken, Risiken, Handlungsempfehlung. Antworte auf Deutsch.';

        var btn = container.previousElementSibling;
        if (btn) btn.disabled = true;

        shared.streamCortexSSE(prompt, container, btn);
    };

    /* ------------------------------------------------------------------
       Render Departments Section (called from main dispatcher)
       ------------------------------------------------------------------ */

    DGD.views.mitarbeiter.renderDepartments = function(data) {
        var html = '';
        var employees = data.employees;
        var lookups = data.lookups;

        // Build department map
        var abteilungen = {};
        for (var i = 0; i < employees.length; i++) {
            var abtName = (employees[i].team && employees[i].team.name) ? employees[i].team.name : 'Keine Abteilung';
            abteilungen[abtName] = (abteilungen[abtName] || 0) + 1;
        }

        // Gruppen
        var gruppen = {};
        for (var gi = 0; gi < employees.length; gi++) {
            var empTeams = employees[gi].teams || [];
            var seen = {};
            for (var gt = 0; gt < empTeams.length; gt++) {
                var gn = empTeams[gt].name;
                if (gn && !seen[gn]) {
                    seen[gn] = true;
                    gruppen[gn] = (gruppen[gn] || 0) + 1;
                }
            }
        }

        // Department cards
        html += '<div class="dgd-section-card dgd-section-card--transparent" style="margin-bottom:1.5rem">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>';
        html += ' Abteilungen</div>';
        html += '<div class="dgd-dept-grid">';
        var abtNames = Object.keys(abteilungen).sort();
        for (var ab = 0; ab < abtNames.length; ab++) {
            if (abtNames[ab] === 'Keine Abteilung') continue;
            var deptEmps = [];
            for (var de = 0; de < employees.length; de++) {
                var empTeam = (employees[de].team && employees[de].team.name) || 'Keine Abteilung';
                if (empTeam === abtNames[ab]) deptEmps.push(employees[de]);
            }
            html += buildDeptCard(abtNames[ab], deptEmps, lookups.attendByUser, lookups.overtimeByUser, lookups.vacBalByUser, lookups.vacUsedByUser, DGD.state.anomalies || [], ab);
        }
        html += '</div>';
        html += '</div>';

        // Gruppen section
        if (Object.keys(gruppen).length > 0) {
            html += '<div class="dgd-section-card" style="margin-bottom:1.5rem">';
            html += '<div class="dgd-section-card__title">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>';
            html += ' Gruppen</div>';
            html += '<div class="dgd-staff-teams">';
            var grpNames = Object.keys(gruppen).sort();
            for (var gr = 0; gr < grpNames.length; gr++) {
                html += '<div class="dgd-staff-team-chip dgd-staff-team-chip--group">';
                html += '<span class="dgd-staff-team-chip__name">' + DGD.helpers.escapeHtml(grpNames[gr]) + '</span>';
                html += '<span class="dgd-staff-team-chip__count">' + gruppen[grpNames[gr]] + '</span>';
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        }

        return html;
    };
})();
