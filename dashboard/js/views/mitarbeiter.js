/* ==========================================================================
   DGD Dashboard - View: Mitarbeiter (TellentHR)
   Depends on: namespace.js, helpers.js, demo-data.js, modals.js, tellent.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {
    'use strict';

    var OT_CAP = 200; // 200h hard cap (company-wide constant)
    

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

        // Composition bar (reuse existing function)
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
                var otH = empOtList[e].otH;
                var empAtt = empOtList[e].att;
                var empAttPct = (empAtt && empAtt.expectedTime > 0) ? Math.round((empAtt.trackedTime || 0) / empAtt.expectedTime * 100) : 0;
                var otPct = Math.min(Math.round(Math.abs(otH) / OT_CAP * 100), 100);
                var barClr = otH < 0 ? '#ef4444' : (otH >= OT_CAP ? '#ef4444' : (otH >= OT_CAP * 0.75 ? '#f59e0b' : '#22c55e'));

                h += '<div class="dgd-dept-emp">';
                h += '<span class="dgd-dept-emp__name">' + DGD.helpers.escapeHtml(emp.firstName + ' ' + emp.lastName) + '</span>';
                h += '<span class="dgd-dept-emp__att" style="color:' + DGD.helpers.attPctColor(empAttPct) + '">' + empAttPct + '%</span>';
                h += '<div class="dgd-dept-emp__ot-bar">';
                if (otH >= 0) {
                    h += '<div class="dgd-dept-emp__ot-fill" style="width:' + otPct + '%;background:' + barClr + '"></div>';
                    h += '<div class="dgd-dept-emp__ot-cap"></div>';
                } else {
                    h += '<div class="dgd-dept-emp__ot-fill" style="width:' + Math.min(otPct, 50) + '%;background:#ef4444;float:right"></div>';
                }
                h += '</div>';
                h += '<span class="dgd-dept-emp__ot-val" style="color:' + barClr + '">' + (otH >= 0 ? '+' : '') + otH + 'h</span>';
                if (otH >= OT_CAP) h += '<span class="dgd-ot-gauge__alert">\u26A0</span>';
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
       Cortex Progress Bar Helper
       ------------------------------------------------------------------ */

    function createCortexProgress(container) {
        // Clear container and render progress UI
        container.innerHTML =
            '<div class="dgd-cortex-progress">' +
            '<div class="dgd-cortex-progress__label">Cortex analysiert\u2026</div>' +
            '<div class="dgd-cortex-progress__track"><div class="dgd-cortex-progress__fill"></div></div>' +
            '<div class="dgd-cortex-progress__pct">0%</div>' +
            '</div>';

        var fillEl = container.querySelector('.dgd-cortex-progress__fill');
        var pctEl = container.querySelector('.dgd-cortex-progress__pct');
        var startTime = Date.now();
        var currentPct = 0;
        var done = false;

        // Logarithmic curve: fast 0-60, slow 60-85, crawl 85-95
        var iv = setInterval(function() {
            if (done) return;
            var elapsed = (Date.now() - startTime) / 1000; // seconds
            var target;
            if (elapsed < 10) {
                target = elapsed * 6; // 0-60 in 10s
            } else if (elapsed < 25) {
                target = 60 + (elapsed - 10) * 1.67; // 60-85 in 15s
            } else if (elapsed < 55) {
                target = 85 + (elapsed - 25) * 0.33; // 85-95 in 30s
            } else {
                target = 95; // cap at 95
            }
            currentPct = Math.min(Math.round(target), 95);
            if (fillEl) fillEl.style.width = currentPct + '%';
            if (pctEl) pctEl.textContent = currentPct + '%';
        }, 250);

        return {
            complete: function() {
                done = true;
                clearInterval(iv);
                currentPct = 100;
                if (fillEl) fillEl.style.width = '100%';
                if (pctEl) pctEl.textContent = '100%';
                // Fade out after brief delay
                setTimeout(function() {
                    var prog = container.querySelector('.dgd-cortex-progress');
                    if (prog) prog.style.display = 'none';
                }, 600);
            },
            destroy: function() {
                done = true;
                clearInterval(iv);
            }
        };
    }

    /* ------------------------------------------------------------------
       Shared Cortex Markdown Renderer
       ------------------------------------------------------------------ */

    function renderCortexMd(text) {
        var safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        safe = safe.replace(/\n/g, '<br>');
        return safe;
    }

    /* ------------------------------------------------------------------
       Cortex URL Auto-Detect (production vs local)
       ------------------------------------------------------------------ */
    var CORTEX_BASE = (function() {
        var h = window.location.hostname;
        if (h === 'dgd.digital' || h === 'www.dgd.digital') {
            return 'https://cortex.dgd.digital';
        }
        return 'http://localhost:8000';
    })();

    /* ------------------------------------------------------------------
       Shared Cortex SSE Streaming Helper
       ------------------------------------------------------------------ */

    function streamCortexSSE(prompt, container, btn) {
        var progress = createCortexProgress(container);
        var fullText = '';
        var lastIdx = 0;
        var idleTimer = null;
        var firstChunk = true;

        function reenableBtn() {
            if (btn) btn.disabled = false;
            container.innerHTML = '<div class="dgd-my-profile__cortex-text">' + renderCortexMd(fullText) + '</div>';
        }

        function resetIdle() {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(reenableBtn, 5000);
        }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', CORTEX_BASE + '/api/chat/stream', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onreadystatechange = function() {
            if (xhr.readyState >= 3 && xhr.responseText) {
                var chunk = xhr.responseText.substring(lastIdx);
                lastIdx = xhr.responseText.length;
                var lines = chunk.split('\n');
                for (var li = 0; li < lines.length; li++) {
                    var line = lines[li].trim();
                    if (line.indexOf('data: ') === 0) {
                        try {
                            var evt = JSON.parse(line.substring(6));
                            if (evt.type === 'text' && evt.content) {
                                if (firstChunk) {
                                    progress.complete();
                                    firstChunk = false;
                                }
                                fullText += evt.content;
                                // Keep progress hidden, show streaming text
                                var progDiv = container.querySelector('.dgd-cortex-progress');
                                if (progDiv) progDiv.style.display = 'none';
                                // Update or create text container
                                var textDiv = container.querySelector('.dgd-my-profile__cortex-text');
                                if (!textDiv) {
                                    textDiv = document.createElement('div');
                                    textDiv.className = 'dgd-my-profile__cortex-text';
                                    container.appendChild(textDiv);
                                }
                                textDiv.innerHTML = renderCortexMd(fullText);
                                resetIdle();
                            }
                        } catch (e) {}
                    }
                }
            }
            if (xhr.readyState === 4) {
                progress.destroy();
                if (idleTimer) clearTimeout(idleTimer);
                setTimeout(reenableBtn, 300);
            }
        };

        xhr.onerror = function() {
            progress.destroy();
            container.innerHTML = '<div class="dgd-my-profile__cortex-error">Cortex nicht erreichbar</div>';
            if (btn) btn.disabled = false;
        };

        xhr.send(JSON.stringify({
            user_message: prompt,
            conversation_history: []
        }));
    }

    /* ------------------------------------------------------------------
       Cortex Department Evaluation (SSE)
       ------------------------------------------------------------------ */

    window._requestCortexEval = function(deptName, deptIdx) {
        var containerId = 'cortex-dept-' + deptIdx;
        var container = document.getElementById(containerId);
        if (!container) return;

        // Collect dept data from current state
        var employees = DGD.state.employees || [];
        var deptEmps = [];
        for (var i = 0; i < employees.length; i++) {
            if ((employees[i].team && employees[i].team.name) === deptName) deptEmps.push(employees[i]);
        }

        var activeCount = 0;
        var attData = [], otData = [];
        for (var e = 0; e < deptEmps.length; e++) {
            if (deptEmps[e].isActive) activeCount++;
            // Attendance
            for (var a = 0; a < (DGD.state.attendance || []).length; a++) {
                if (DGD.state.attendance[a].user && DGD.state.attendance[a].user.id === deptEmps[e].id) {
                    var att = DGD.state.attendance[a];
                    attData.push(deptEmps[e].firstName + ' ' + deptEmps[e].lastName + ': ' +
                        Math.round((att.trackedTime||0)/3600) + '/' + Math.round((att.expectedTime||0)/3600) + 'h');
                    break;
                }
            }
            // Overtime
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

        streamCortexSSE(prompt, container, btn);
    };

    /* ------------------------------------------------------------------
       Cortex Employee Evaluation (per employee row)
       ------------------------------------------------------------------ */

    window._requestCortexEmployeeEval = function(empId, btn) {
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

        streamCortexSSE(prompt, container, btn);
    };

    /* ------------------------------------------------------------------
       Cortex Personal Profile Recommendation
       ------------------------------------------------------------------ */

    window._requestCortexMyProfileEval = function() {
        var container = document.getElementById('cortex-my-profile-eval');
        if (!container) return;

        // Find the linked employee
        var myEmp = findMyEmployee();
        if (!myEmp) {
            container.innerHTML = '<div class="dgd-my-profile__cortex-error">\u26A0 Kein Mitarbeiter-Profil verkn\u00FCpft.</div>';
            return;
        }

        // Compute score & collect data
        var attendByUser = {}, overtimeByUser = {}, vacBalByUser = {};
        for (var a = 0; a < (DGD.state.attendance || []).length; a++) {
            if (DGD.state.attendance[a].user) attendByUser[DGD.state.attendance[a].user.id] = DGD.state.attendance[a];
        }
        for (var o = 0; o < (DGD.state.overtime || []).length; o++) {
            if (DGD.state.overtime[o].user) overtimeByUser[DGD.state.overtime[o].user.id] = DGD.state.overtime[o];
        }
        // Vacation: same logic as renderMitarbeiter — current year only
        var vacUsedByUser = {};
        var currentYear = new Date().getFullYear().toString();
        for (var v = 0; v < (DGD.state.timeOffBalances || []).length; v++) {
            var vbal = DGD.state.timeOffBalances[v];
            var vTypeName = (vbal.timeOffRule && vbal.timeOffRule.timeOffType && vbal.timeOffRule.timeOffType.name) || '';
            var periodStart = vbal.periodStartDate || '';
            if (vTypeName.toLowerCase().indexOf('urlaub') !== -1 && vbal.user && vbal.user.id && periodStart.indexOf(currentYear) === 0) {
                if (!vacBalByUser[vbal.user.id]) vacBalByUser[vbal.user.id] = 0;
                if (!vacUsedByUser[vbal.user.id]) vacUsedByUser[vbal.user.id] = 0;
                vacBalByUser[vbal.user.id] += (vbal.available || 0);
                vacUsedByUser[vbal.user.id] += (vbal.used || 0);
            }
        }

        var sc = computeEmployeeScore(myEmp, attendByUser, overtimeByUser, vacBalByUser, DGD.state.anomalies || []);
        var empName = myEmp.firstName + ' ' + myEmp.lastName;
        var attRec = attendByUser[myEmp.id];
        var otRec = overtimeByUser[myEmp.id];
        var attH = attRec ? Math.round((attRec.trackedTime || 0) / 3600) : 0;
        var expH = attRec ? Math.round((attRec.expectedTime || 0) / 3600) : 0;
        var otH = otRec ? Math.round((otRec.balance || 0) / 3600) : 0;
        var vacDays = vacBalByUser[myEmp.id] || 0;
        var vacUsed = vacUsedByUser[myEmp.id] || 0;
        var vacTotal = Math.round((vacDays + vacUsed) * 10) / 10;
        var posName = (myEmp.position && myEmp.position.name) || 'unbekannt';
        var teamName = (myEmp.team && myEmp.team.name) || 'kein Team';

        // Build badge list
        var badgeNames = [];
        for (var b = 0; b < sc.achievements.length; b++) {
            var badge = sc.achievements[b];
            badgeNames.push(badge.icon + ' ' + badge.label + ' (' + (badge.type === 'malus' ? 'Malus' : badge.type === 'bonus' ? 'Bonus' : 'Info') + ')');
        }

        // Detect leadership role (CEO, GF, C-Level, Head of, Lead, etc.)
        var isLeader = /CEO|GF|Gesch\u00E4ftsf|C-Level|Head|Lead|Director|VP|Leitung/i.test(posName + ' ' + teamName);

        // Gather team overview for leaders
        var teamSummary = '';
        if (isLeader) {
            var activeEmps = (DGD.state.employees || []).filter(function(e) { return e.isActive; });
            var totalOT = 0, otAboveCap = 0, lowAttCount = 0;
            for (var te = 0; te < activeEmps.length; te++) {
                var teOt = overtimeByUser[activeEmps[te].id];
                var teH = teOt ? Math.round((teOt.balance || 0) / 3600) : 0;
                totalOT += teH;
                if (teH > OT_CAP) otAboveCap++;
                var teAtt = attendByUser[activeEmps[te].id];
                if (teAtt && (teAtt.expectedTime || 0) > 0) {
                    var tePct = Math.round((teAtt.trackedTime || 0) / teAtt.expectedTime * 100);
                    if (tePct < 80) lowAttCount++;
                }
            }
            teamSummary = '\n\nTeam-\u00DCbersicht (als F\u00FChrungskraft relevant):\n' +
                '- Aktive Mitarbeiter: ' + activeEmps.length + '\n' +
                '- Gesamt-\u00DCberstundensaldo Firma: ' + (totalOT >= 0 ? '+' : '') + totalOT + 'h\n' +
                '- MA \u00FCber ' + OT_CAP + 'h-Cap: ' + otAboveCap + '\n' +
                '- MA mit Anwesenheit <80%: ' + lowAttCount + '\n' +
                '- Anomalien im Unternehmen: ' + (DGD.state.anomalies || []).length;
        }

        // Role context for prompt
        var roleContext = '';
        if (isLeader) {
            roleContext = '\n\nWICHTIG: ' + empName + ' ist ' + posName + ' (F\u00FChrungskraft/Gesch\u00E4ftsf\u00FChrer). ' +
                'Niedrige getrackte Anwesenheit bedeutet NICHT, dass die Person nicht arbeitet \u2014 ' +
                'F\u00FChrungskr\u00E4fte arbeiten oft weit \u00FCber die Soll-Stunden hinaus, tracken aber nicht konsequent. ' +
                'Die hohen \u00DCberstunden best\u00E4tigen das. Gib KEINE Tipps wie "komm p\u00FCnktlich zur Arbeit". ' +
                'Fokussiere stattdessen auf: Delegieren, Selbstf\u00FCrsorge, Team-F\u00FChrung, Work-Life-Balance, und strategische Empfehlungen.';
        }

        // Build detailed prompt
        var prompt = '[DGD Dashboard - Pers\u00F6nliche Empfehlung]\n' +
            'Gib ' + empName + ' (' + posName + ', Team: ' + teamName + ') personalisierte Empfehlungen.\n\n' +
            'Aktuelle Kennzahlen:\n' +
            '- Anwesenheit (getrackt): ' + sc.attPct + '% (' + attH + 'h von ' + expH + 'h Soll)\n' +
            '- \u00DCberstunden: ' + (otH >= 0 ? '+' : '') + otH + 'h (Cap: ' + OT_CAP + 'h)\n' +
            '- Urlaub: ' + Math.round(vacDays * 10) / 10 + ' verbleibend von ' + vacTotal + ' Tagen (' + vacUsed + ' genommen)\n' +
            '- Leaderboard-Score: ' + sc.score + '/100 Punkte\n' +
            '- Betriebszugeh\u00F6rigkeit: ' + sc.tenure + ' Monate\n' +
            '- Zeiterfassung: ' + (sc.trackingUnknown ? 'keine Daten' : (sc.trackingPrecise ? 'pr\u00E4zise' : 'ungenau')) + '\n' +
            '- Badges: ' + (badgeNames.length > 0 ? badgeNames.join(', ') : 'keine') +
            roleContext + teamSummary + '\n\n' +
            'Gib 3-4 konkrete, pers\u00F6nliche Empfehlungen basierend auf diesen Daten. ' +
            (isLeader ? 'Gib zus\u00E4tzlich 1-2 Empfehlungen zur Team-F\u00FChrung. ' : '') +
            'Sei motivierend aber ehrlich. Nenne Verbesserungspotenziale und St\u00E4rken. ' +
            'Sprich die Person direkt an (Du-Form). Antworte auf Deutsch, kurz und knapp.';

        var btn = container.previousElementSibling;
        if (btn && btn.tagName === 'BUTTON') btn.disabled = true;

        streamCortexSSE(prompt, container, btn);
    };

    /* ------------------------------------------------------------------
       Cortex Overtime Timeline Evaluation
       ------------------------------------------------------------------ */

    window._requestCortexOvertimeEval = function() {
        var container = document.getElementById('cortex-overtime-eval');
        if (!container) return;

        // Collect summary data from the timeline chart
        var chartEl = document.getElementById('overtime-timeline-chart');
        var summaryText = '';
        if (chartEl) {
            var statEl = chartEl.querySelector('.dgd-company-overview__stat');
            if (statEl) summaryText = statEl.textContent;
        }

        // Extract monthly timeline data from SVG tooltips for temporal trend
        var timelineData = [];
        if (chartEl) {
            var rects = chartEl.querySelectorAll('rect[rx="2"] title');
            for (var ti = 0; ti < rects.length; ti++) {
                var title = rects[ti].textContent || '';
                if (title) timelineData.push(title);
            }
        }

        // Collect per-employee overtime data
        var otData = [];
        var otAboveCap = [], otNegative = [], otHealthy = [];
        for (var i = 0; i < (DGD.state.overtime || []).length; i++) {
            var o = DGD.state.overtime[i];
            if (o.user) {
                var h = Math.round((o.balance || 0) / 3600);
                var name = o.user.firstName + ' ' + o.user.lastName;
                otData.push(name + ': ' + (h >= 0 ? '+' : '') + h + 'h');
                if (h > OT_CAP) otAboveCap.push(name + ' (' + h + 'h)');
                else if (h < 0) otNegative.push(name + ' (' + h + 'h)');
                else otHealthy.push(name);
            }
        }

        var prompt = '[DGD Dashboard - \u00DCberstunden-Trendanalyse]\n' +
            'Analysiere den \u00DCberstunden-Zeitverlauf der Firma DGD.\n\n' +
            'KONTEXT: Die Grafik zeigt monatliche \u00DCberstunden-\u00C4nderungen (Balken) und den kumulierten Saldo aller MA (blaue Linie).\n' +
            'Ein sinkender kumulierter Saldo bedeutet: Die Firma baut insgesamt Minusstunden auf (MA arbeiten weniger als Soll).\n' +
            'Ein steigender Saldo bedeutet: \u00DCberstunden wachsen.\n\n' +
            'Kumuliert: ' + (summaryText || 'unbekannt') + '\n\n' +
            (timelineData.length > 0 ? 'Monatlicher Verlauf:\n' + timelineData.join('\n') + '\n\n' : '') +
            'Aktuelle Salden pro MA:\n' + otData.join('\n') + '\n\n' +
            (otAboveCap.length > 0 ? '\u26A0 \u00DCber ' + OT_CAP + 'h-Cap: ' + otAboveCap.join(', ') + '\n' : '') +
            (otNegative.length > 0 ? 'Negative Salden: ' + otNegative.join(', ') + '\n' : '') +
            '\n200h-Cap pro Person firmenweit.\n\n' +
            'Bitte analysiere:\n' +
            '1. Was zeigt der zeitliche Trend? (Verschlechterung/Verbesserung)\n' +
            '2. Wer ist besonders auff\u00E4llig und warum?\n' +
            '3. Was l\u00E4uft gut?\n' +
            '4. Konkrete Handlungsempfehlungen f\u00FCr die Gesch\u00E4ftsf\u00FChrung.\n' +
            'Antworte auf Deutsch, strukturiert, 5-8 S\u00E4tze.';

        var btn = container.previousElementSibling;
        if (btn) btn.disabled = true;

        streamCortexSSE(prompt, container, btn);
    };

    /* ==================================================================
       GAMIFICATION: Leaderboard + Achievement System
       ================================================================== */

    /**
     * Check if current user has HR/admin privileges.
     */
    function isHRUser() {
        return DGD.state.user && (DGD.state.user.role === 'admin' || DGD.state.user.role === 'hr');
    }

    /**
     * Find the KiwiHR employee matching the logged-in dashboard user.
     * Priority: 1) localStorage override, 2) email match, 3) display_name match
     * Returns the employee object or null.
     */
    function findMyEmployee() {
        if (!DGD.state.user) return null;
        var employees = DGD.state.employees || [];

        // 1) Check localStorage for manually linked employee ID
        var linkedId = localStorage.getItem('dgd_my_employee_id');
        if (linkedId) {
            for (var k = 0; k < employees.length; k++) {
                if (employees[k].id === linkedId) return employees[k];
            }
        }

        // 2) Match by email
        if (DGD.state.user.email) {
            var myEmail = DGD.state.user.email.toLowerCase();
            for (var i = 0; i < employees.length; i++) {
                if ((employees[i].email || '').toLowerCase() === myEmail) return employees[i];
            }
        }

        // 3) Fallback: match by display_name
        if (DGD.state.user.display_name) {
            var dn = DGD.state.user.display_name.toLowerCase().trim();
            for (var j = 0; j < employees.length; j++) {
                var empName = ((employees[j].firstName || '') + ' ' + (employees[j].lastName || '')).toLowerCase().trim();
                if (empName === dn) return employees[j];
            }
        }
        return null;
    }

    /**
     * Link the current dashboard user to a KiwiHR employee (stores in localStorage).
     */
    window._linkMyEmployee = function(employeeId) {
        if (employeeId) {
            localStorage.setItem('dgd_my_employee_id', employeeId);
        } else {
            localStorage.removeItem('dgd_my_employee_id');
        }
        // Re-render
        var mainEl = document.querySelector('.dgd-main');
        if (mainEl) renderMitarbeiter(mainEl);
    };

    /**
     * Build personal profile card for the logged-in employee.
     */
    function buildMyProfileCard(myEmp, attendByUser, overtimeByUser, vacBalByUser, vacUsedByUser, anomalies) {
        if (!myEmp || !myEmp.isActive) return '';

        var sc = computeEmployeeScore(myEmp, attendByUser, overtimeByUser, vacBalByUser, anomalies);
        var empName = myEmp.firstName + ' ' + myEmp.lastName;
        var teamName = (myEmp.team && myEmp.team.name) || 'Kein Team';
        var posName = (myEmp.position && myEmp.position.name) || '';
        var attRec = attendByUser[myEmp.id];
        var otRec = overtimeByUser[myEmp.id];
        var vacDays = vacBalByUser[myEmp.id] || 0;
        var vacUsed = (vacUsedByUser && vacUsedByUser[myEmp.id]) || 0;
        var vacTotal = Math.round((vacDays + vacUsed) * 10) / 10;
        var attH = attRec ? Math.round((attRec.trackedTime || 0) / 3600) : 0;
        var expH = attRec ? Math.round((attRec.expectedTime || 0) / 3600) : 0;
        var otH = otRec ? Math.round((otRec.balance || 0) / 3600) : 0;

        var h = '<div class="dgd-my-profile">';
        h += '<div class="dgd-my-profile__header">';
        h += '<div class="dgd-my-profile__avatar">' + DGD.helpers.escapeHtml(myEmp.firstName.charAt(0) + myEmp.lastName.charAt(0)) + '</div>';
        h += '<div class="dgd-my-profile__info">';
        h += '<div class="dgd-my-profile__name">' + DGD.helpers.escapeHtml(empName) + '</div>';
        h += '<div class="dgd-my-profile__role">' + DGD.helpers.escapeHtml(posName) + (posName && teamName ? ' \u2022 ' : '') + DGD.helpers.escapeHtml(teamName) + '</div>';
        h += '</div>';
        h += '<div class="dgd-my-profile__score">';
        h += '<div class="dgd-my-profile__score-value">' + sc.score + '</div>';
        h += '<div class="dgd-my-profile__score-label">Punkte</div>';
        h += '</div>';
        h += '</div>';

        // Stats grid
        h += '<div class="dgd-my-profile__stats">';
        h += '<div class="dgd-my-profile__stat">';
        h += '<div class="dgd-my-profile__stat-value" style="color:' + DGD.helpers.attPctColor(sc.attPct) + '">' + sc.attPct + '%</div>';
        h += '<div class="dgd-my-profile__stat-label">Anwesenheit</div>';
        h += '</div>';
        h += '<div class="dgd-my-profile__stat">';
        h += '<div class="dgd-my-profile__stat-value">' + attH + 'h / ' + expH + 'h</div>';
        h += '<div class="dgd-my-profile__stat-label">Ist / Soll</div>';
        h += '</div>';
        h += '<div class="dgd-my-profile__stat">';
        var otColor = otH > OT_CAP ? '#ef4444' : (otH > 100 ? '#f59e0b' : (otH >= 0 ? '#22c55e' : '#64748b'));
        h += '<div class="dgd-my-profile__stat-value" style="color:' + otColor + '">' + (otH >= 0 ? '+' : '') + otH + 'h</div>';
        h += '<div class="dgd-my-profile__stat-label">\u00DCberstunden</div>';
        h += '</div>';
        h += '<div class="dgd-my-profile__stat">';
        h += '<div class="dgd-my-profile__stat-value" style="color:#06b6d4">' + Math.round(vacDays * 10) / 10 + ' / ' + vacTotal + '</div>';
        h += '<div class="dgd-my-profile__stat-label">Resturlaub' + (vacUsed > 0 ? ' (' + vacUsed + ' genommen)' : '') + '</div>';
        h += '</div>';
        h += '</div>';

        // Badges
        h += '<div class="dgd-my-profile__badges">';
        h += '<div class="dgd-my-profile__badges-title">Deine Achievements</div>';
        h += renderBadges(sc.achievements);
        h += '</div>';

        // Beteiligungsprogramm — equity participation section
        if (DGD.demoData.BETEILIGUNG_CONFIG.enabled && otH > 0) {
            var eq = DGD.demoData.calcEquity(otH, posName);
            h += '<div class="dgd-equity-card">';
            h += '<div class="dgd-equity-card__title">\uD83D\uDCC8 Dein Beteiligungsprogramm</div>';
            h += '<div class="dgd-equity-card__grid">';
            h += '<div class="dgd-equity-card__item">';
            h += '<div class="dgd-equity-card__value">' + (otH >= 0 ? '+' : '') + otH + 'h</div>';
            h += '<div class="dgd-equity-card__label">\u00DCberstunden</div>';
            h += '</div>';
            h += '<div class="dgd-equity-card__item">';
            h += '<div class="dgd-equity-card__value">\u00D7 ' + eq.rate + '\u20AC/h</div>';
            h += '<div class="dgd-equity-card__label">Stundensatz</div>';
            h += '</div>';
            h += '<div class="dgd-equity-card__item">';
            h += '<div class="dgd-equity-card__value" style="color:#d97706">' + eq.value.toLocaleString('de-DE') + ' \u20AC</div>';
            h += '<div class="dgd-equity-card__label">Anteilswert</div>';
            h += '</div>';
            h += '<div class="dgd-equity-card__item">';
            h += '<div class="dgd-equity-card__value" style="color:#8b5cf6;font-size:1.3rem">' + eq.pct.toFixed(2) + '%</div>';
            h += '<div class="dgd-equity-card__label">Firmenbeteiligung</div>';
            h += '</div>';
            h += '</div>';
            // Visual bar
            var barPct = Math.min(eq.pct / 5 * 100, 100); // 5% = full bar
            h += '<div class="dgd-equity-card__bar-wrap">';
            h += '<div class="dgd-equity-card__bar"><div class="dgd-equity-card__bar-fill" style="width:' + barPct + '%"></div></div>';
            h += '<div class="dgd-equity-card__bar-labels"><span>0%</span><span>Bewertung: 3,5 Mio. \u20AC</span><span>5%</span></div>';
            h += '</div>';
            h += '</div>';
        }

        // Recommendations — Static quick tips + Cortex AI button
        h += '<div class="dgd-my-profile__tips">';
        h += '<div class="dgd-my-profile__tips-title">\uD83D\uDCA1 Empfehlungen</div>';
        var tips = [];
        if (sc.attPct < 85) tips.push('Versuche deine Anwesenheit auf \u00FCber 85% zu bringen.');
        if (otH > 100) tips.push('Deine \u00DCberstunden sind hoch (' + otH + 'h). Achte auf Work-Life-Balance.');
        if (otH > OT_CAP) tips.push('\u26A0\uFE0F Du hast den \u00DCberstunden-Cap (' + OT_CAP + 'h) \u00FCberschritten!');
        if (sc.alwaysSameStart) tips.push('Trage deine Zeiten minutengenau ein statt Standardzeiten.');
        if (!sc.trackingPrecise && !sc.alwaysSameStart && attRec) tips.push('Pr\u00E4zisere Zeiterfassung verbessert deinen Score.');
        if (vacDays > 20) tips.push('Du hast noch ' + Math.round(vacDays) + ' Urlaubstage \u2014 plane deinen n\u00E4chsten Urlaub!');
        if (tips.length === 0) tips.push('\uD83C\uDF1F Alles im gr\u00FCnen Bereich! Weiter so.');
        for (var t = 0; t < tips.length; t++) {
            h += '<div class="dgd-my-profile__tip">' + tips[t] + '</div>';
        }
        // Cortex AI personalized recommendation
        h += '<button class="dgd-my-profile__cortex-btn" onclick="window._requestCortexMyProfileEval()">';
        h += '\uD83E\uDD16 Cortex Empfehlung anfordern';
        h += '</button>';
        h += '<div id="cortex-my-profile-eval" class="dgd-my-profile__cortex-result"></div>';
        h += '</div>';

        h += '</div>';
        return h;
    }

    /**
     * Compute composite score (0-100) and achievements for one employee.
     * Includes: Tracking precision analysis, Overdrive mechanic, all badges.
     */
    function computeEmployeeScore(emp, attendByUser, overtimeByUser, vacBalByUser, anomalies) {
        var now = new Date();
        var result = { score: 0, achievements: [], attPct: 0, otH: 0, tenure: 0, vacDays: 0, trackingPrecise: false };
        if (!emp.isActive) return result;

        // --- Data ---
        var attRec = attendByUser[emp.id];
        var otRec = overtimeByUser[emp.id];
        var attPct = 0;
        if (attRec && (attRec.expectedTime || 0) > 0) {
            attPct = Math.round((attRec.trackedTime || 0) / attRec.expectedTime * 100);
        }
        var otH = otRec ? Math.round((otRec.balance || 0) / 3600) : 0;
        var vacDays = vacBalByUser[emp.id] || 0;
        var tenureMonths = 0;
        if (emp.employmentStartDate) {
            tenureMonths = Math.max(0, Math.round((now - new Date(emp.employmentStartDate)) / (1000 * 60 * 60 * 24 * 30.44)));
        }
        // Count anomalies for this employee
        var empAnomalyCount = 0;
        for (var a = 0; a < (anomalies || []).length; a++) {
            if (anomalies[a].employeeId === emp.id || anomalies[a].employeeName === (emp.firstName + ' ' + emp.lastName)) {
                empAnomalyCount++;
            }
        }

        // --- Tracking Precision Analysis ---
        // Phase 1: Basic heuristic from monthly aggregates
        var trackingPrecise = false;
        var alwaysSameStart = false;
        if (attRec && (attRec.trackedTime || 0) > 0) {
            var monthlyOvertimeSec = attRec.overtime || 0;
            var balanceSec = (attRec.trackedTime || 0) - (attRec.expectedTime || 0);
            if (Math.abs(monthlyOvertimeSec) > 300 || Math.abs(balanceSec) > 300) {
                trackingPrecise = true;
            }
            if ((attRec.trackedTime % 1800) !== 0) {
                trackingPrecise = true;
            }
        }

        // Phase 2: Override with deep timesheet analysis if available
        // (loaded async after initial render — checks actual start times)
        var tsAnalysis = (DGD.state._timesheetAnalysis || {})[emp.id];
        var trackingUnknown = false;
        if (tsAnalysis) {
            if (tsAnalysis.unknown) {
                // No timesheet entries found — can't determine precision
                trackingUnknown = true;
                trackingPrecise = false; // neutral — don't reward or penalize
            } else if (tsAnalysis.alwaysSameStart) {
                // Employee always enters the EXACT same start time → not genuine tracking
                trackingPrecise = false;
                alwaysSameStart = true;
            } else if (tsAnalysis.allRound && !tsAnalysis.precise) {
                // Always round times (00/15/30/45) → likely not minute-precise
                trackingPrecise = false;
            } else if (tsAnalysis.precise) {
                trackingPrecise = true;
            }
        }

        result.trackingPrecise = trackingPrecise;
        result.alwaysSameStart = alwaysSameStart;

        result.attPct = attPct;
        result.otH = otH;
        result.tenure = tenureMonths;
        result.vacDays = vacDays;

        // --- Scoring (0-100) ---
        // Attendance (30%)
        var attScore = Math.min(attPct, 100);

        // Overtime balance (20%) — healthy = 0-50h
        var otScore;
        if (otH < 0) otScore = 50;
        else if (otH <= 50) otScore = 100;
        else if (otH <= 100) otScore = 80;  // Overdrive zone: still OK
        else if (otH <= 150) otScore = 50;  // Overdrive wearing off
        else if (otH < OT_CAP) otScore = 25; // Danger zone
        else otScore = 5;                    // Over cap: near-zero

        // Anomaly-free (15%)
        var anomScore = empAnomalyCount === 0 ? 100 : (empAnomalyCount === 1 ? 60 : 20);

        // Tracking precision (10%) — rewards real tracking, penalizes fake/routine entries
        var trackScore;
        var trackMalus = 0;
        if (trackingUnknown) {
            trackScore = 50; // neutral — no data to judge
        } else if (trackingPrecise) {
            trackScore = 100;
        } else {
            trackScore = 0;
            if (attRec && (attRec.trackedTime || 0) > 0) trackMalus = -5;
        }
        if (alwaysSameStart) trackMalus = -5; // Penalty for always-same-start-time

        // Vacation usage (10%)
        var vacScore;
        if (attRec && vacDays <= 5) vacScore = 100;
        else if (vacDays <= 15) vacScore = 75;
        else vacScore = 50;

        // Tenure bonus (10%)
        var tenureScore;
        if (tenureMonths >= 24) tenureScore = 100;
        else if (tenureMonths >= 12) tenureScore = 75;
        else if (tenureMonths >= 6) tenureScore = 50;
        else tenureScore = 25;

        // Overdrive bonus: +5 points for 20-100h overtime (productive push)
        // But MALUS after 100h: -3 per 25h over 100
        var overdriveBonus = 0;
        if (otH >= 20 && otH <= 100) {
            overdriveBonus = 5;
        } else if (otH > 100 && otH <= 150) {
            overdriveBonus = -3; // Malus: pushed too long
        } else if (otH > 150) {
            overdriveBonus = -8; // Heavy malus: burnout risk
        }

        result.score = Math.round(
            attScore * 0.30 +
            otScore * 0.20 +
            anomScore * 0.15 +
            trackScore * 0.10 +
            vacScore * 0.10 +
            tenureScore * 0.10 +
            overdriveBonus +
            trackMalus
        );
        // Clamp 0-100
        result.score = Math.max(0, Math.min(100, result.score));

        // --- Achievements ---
        // type: 'bonus' (green border, ▲), 'malus' (red border, ▼), 'neutral' (grey border), 'info' (blue border)
        // Colors are colorblind-safe: distinct shapes + text markers, not just hue

        // "Pünktlich" requires REAL tracking (varied start times), not just high attendance %
        if (attPct >= 95 && trackingPrecise && !alwaysSameStart) {
            result.achievements.push({ icon: '\u23F0', label: 'P\u00FCnktlich', type: 'bonus' });
        }
        // "Routine-Eintrag" — always same start time = likely retroactive/fake entries
        if (alwaysSameStart) {
            result.achievements.push({ icon: '\uD83D\uDCCB', label: 'Routine-Eintrag', type: 'malus' });
        }
        if (attPct >= 85 && tenureMonths > 12) {
            result.achievements.push({ icon: '\uD83C\uDFC3', label: 'Marathonl\u00E4ufer', type: 'bonus' });
        }
        if (otH >= 0 && otH <= 50) {
            result.achievements.push({ icon: '\u2696\uFE0F', label: 'Ausgeglichen', type: 'bonus' });
        }

        // Overdrive: 20-100h overtime = productive push (+5 pts)
        if (otH >= 20 && otH <= 100) {
            result.achievements.push({ icon: '\uD83D\uDD25', label: 'Overdrive', type: 'bonus' });
        }
        // Overdrive burned out: 100-200h = pushed too long (malus active)
        if (otH > 100 && otH < OT_CAP) {
            result.achievements.push({ icon: '\uD83E\uDEAB', label: 'Overdrive Malus', type: 'malus' });
        }

        if (result.score >= 85) {
            result.achievements.push({ icon: '\uD83D\uDE80', label: '\u00DCberflieger', type: 'bonus' });
        }
        if (tenureMonths >= 24) {
            result.achievements.push({ icon: '\uD83C\uDFC6', label: 'Veteran', type: 'info' });
        }
        if (tenureMonths < 6) {
            result.achievements.push({ icon: '\uD83C\uDF31', label: 'Newcomer', type: 'info' });
        }
        if (vacDays > 0 && attPct > 80) {
            result.achievements.push({ icon: '\uD83C\uDF34', label: 'Urlaubsprofi', type: 'bonus' });
        }
        if (otH >= OT_CAP) {
            result.achievements.push({ icon: '\u26A0\uFE0F', label: 'Alarm', type: 'malus' });
        }
        // Clean Sheet: only meaningful if there ARE anomalies in the company
        if (empAnomalyCount === 0 && (anomalies || []).length > 0) {
            result.achievements.push({ icon: '\u2728', label: 'Clean Sheet', type: 'bonus' });
        }

        // Tracking precision badges (only if we have actual timesheet data to judge)
        if (!trackingUnknown) {
            if (trackingPrecise) {
                result.achievements.push({ icon: '\uD83C\uDFAF', label: 'Pr\u00E4zise', type: 'bonus' });
            } else if (attRec && (attRec.trackedTime || 0) > 0) {
                result.achievements.push({ icon: '\uD83D\uDD50', label: 'Stempeluhr', type: 'malus' });
            }
        }

        return result;
    }

    /**
     * Render badge pills for an employee.
     */
    function renderBadges(achievements, maxShow) {
        if (!achievements || achievements.length === 0) return '';
        var limit = maxShow || achievements.length;
        var h = '<div class="dgd-leaderboard__badges">';
        for (var i = 0; i < Math.min(achievements.length, limit); i++) {
            var a = achievements[i];
            // Colorblind-safe: type determines class (bonus=green+▲, malus=red+▼, info=blue, neutral=grey)
            var typeClass = 'dgd-badge--' + (a.type || 'neutral');
            var marker = '';
            if (a.type === 'bonus') marker = '▲ ';
            else if (a.type === 'malus') marker = '▼ ';
            h += '<span class="dgd-leaderboard__badge ' + typeClass + '">';
            h += a.icon + ' ' + marker + DGD.helpers.escapeHtml(a.label) + '</span>';
        }
        if (achievements.length > limit) {
            h += '<span class="dgd-leaderboard__badge dgd-badge--neutral">+' + (achievements.length - limit) + '</span>';
        }
        h += '</div>';
        return h;
    }

    /* ------------------------------------------------------------------
       Timesheet Quality Analysis (async)
       Samples recent workdays per employee to detect:
       - Always-same start times ("Routine-Eintrag")
       - Genuine varied tracking ("Echte Zeiterfassung")
       ------------------------------------------------------------------ */

    /**
     * Fetch timesheet for one employee/date. Returns promise.
     */
    function fetchTimesheet(userId, date) {
        return new Promise(function(resolve) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', '/api/tellent.php?action=timesheet&userId=' + userId + '&date=' + date, true);
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    resolve(data);
                } catch(e) { resolve(null); }
            };
            xhr.onerror = function() { resolve(null); };
            xhr.timeout = 10000;
            xhr.ontimeout = function() { resolve(null); };
            xhr.send();
        });
    }

    /**
     * Analyze timesheet entries for pattern detection.
     * Returns: { precise: bool, alwaysSameStart: bool, startTimes: [], entryCount: int }
     */
    function analyzeTimesheetEntries(timesheets) {
        var startTimes = [];
        var entryCount = 0;

        for (var d = 0; d < timesheets.length; d++) {
            var ts = timesheets[d];
            if (!ts || !ts.data || !ts.data.timesheet) continue;
            var sheet = ts.data.timesheet;
            var entries = sheet.timesheetEntries || [];
            if (entries.length === 0) continue;

            entryCount += entries.length;
            // Take the earliest startAt of the day
            var dayStart = null;
            for (var e = 0; e < entries.length; e++) {
                var startAt = entries[e].startAt;
                if (startAt) {
                    // Extract HH:MM from ISO timestamp or time string
                    var timePart = startAt.length > 10 ? startAt.substring(11, 16) : startAt.substring(0, 5);
                    if (!dayStart || timePart < dayStart) dayStart = timePart;
                }
            }
            if (dayStart) startTimes.push(dayStart);
        }

        if (startTimes.length === 0) {
            // No timesheet entries found — can't determine precision → "unknown"
            return { precise: false, alwaysSameStart: false, allRound: false, unknown: true, startTimes: startTimes, entryCount: entryCount };
        }
        if (startTimes.length === 1) {
            // Only 1 data point — insufficient for pattern detection
            var singleMin = parseInt(startTimes[0].split(':')[1], 10);
            var singleRound = (singleMin === 0 || singleMin === 15 || singleMin === 30 || singleMin === 45);
            return { precise: !singleRound, alwaysSameStart: false, allRound: singleRound, unknown: false, startTimes: startTimes, entryCount: entryCount };
        }

        // Check if all start times are identical
        var allSame = true;
        for (var s = 1; s < startTimes.length; s++) {
            if (startTimes[s] !== startTimes[0]) { allSame = false; break; }
        }

        // Check if start times are always round (00 or 30 minutes)
        var allRound = true;
        for (var r = 0; r < startTimes.length; r++) {
            var mins = parseInt(startTimes[r].split(':')[1], 10);
            if (mins !== 0 && mins !== 15 && mins !== 30 && mins !== 45) {
                allRound = false; break;
            }
        }

        return {
            precise: !allSame && !allRound,
            alwaysSameStart: allSame,
            allRound: allRound,
            startTimes: startTimes,
            entryCount: entryCount
        };
    }

    /**
     * Run async timesheet analysis for all active employees, then re-render leaderboard.
     */
    function runTimesheetAnalysis(employees) {
        var activeEmps = [];
        for (var i = 0; i < employees.length; i++) {
            if (employees[i].isActive) activeEmps.push(employees[i]);
        }

        // Sample 5 recent workdays (skip weekends)
        var sampleDates = [];
        var d = new Date();
        while (sampleDates.length < 5) {
            d.setDate(d.getDate() - 1);
            var dow = d.getDay();
            if (dow !== 0 && dow !== 6) { // skip Sun/Sat
                sampleDates.push(d.toISOString().substring(0, 10));
            }
        }

        // Fetch timesheets: for each employee, fetch all sample dates
        var allPromises = [];
        var empMap = {}; // userId -> [promise results]

        for (var e = 0; e < activeEmps.length; e++) {
            var empId = activeEmps[e].id;
            empMap[empId] = { emp: activeEmps[e], promises: [] };
            for (var dd = 0; dd < sampleDates.length; dd++) {
                var p = fetchTimesheet(empId, sampleDates[dd]);
                empMap[empId].promises.push(p);
                allPromises.push(p);
            }
        }

        // When all fetches complete, analyze and store results
        var empIds = Object.keys(empMap);
        var analysisComplete = 0;

        for (var ei = 0; ei < empIds.length; ei++) {
            (function(uid) {
                Promise.all(empMap[uid].promises).then(function(results) {
                    var analysis = analyzeTimesheetEntries(results);
                    // Store in global state for leaderboard re-render
                    if (!DGD.state._timesheetAnalysis) DGD.state._timesheetAnalysis = {};
                    DGD.state._timesheetAnalysis[uid] = analysis;

                    analysisComplete++;
                    if (analysisComplete === empIds.length) {
                        // All analyses done — re-render leaderboard
                        refreshLeaderboard();
                    }
                });
            })(empIds[ei]);
        }
    }

    /**
     * Re-render just the leaderboard section with updated timesheet analysis.
     */
    function refreshLeaderboard() {
        var container = document.querySelector('.dgd-leaderboard');
        if (!container) return;

        var employees = DGD.state.employees || [];
        var attendByUser = {};
        for (var at = 0; at < (DGD.state.attendance || []).length; at++) {
            var att = DGD.state.attendance[at];
            if (att.user && att.user.id) attendByUser[att.user.id] = att;
        }
        var overtimeByUser = {};
        for (var ot = 0; ot < (DGD.state.overtime || []).length; ot++) {
            var ovt = DGD.state.overtime[ot];
            if (ovt.user && ovt.user.id) overtimeByUser[ovt.user.id] = ovt;
        }
        var vacBalByUser = {};
        var currentYear = new Date().getFullYear().toString();
        for (var vb = 0; vb < (DGD.state.timeOffBalances || []).length; vb++) {
            var vbal = DGD.state.timeOffBalances[vb];
            var vTypeName = (vbal.timeOffRule && vbal.timeOffRule.timeOffType && vbal.timeOffRule.timeOffType.name) || '';
            var periodStart = vbal.periodStartDate || '';
            if (vTypeName.toLowerCase().indexOf('urlaub') !== -1 && vbal.user && vbal.user.id && periodStart.indexOf(currentYear) === 0) {
                if (!vacBalByUser[vbal.user.id]) vacBalByUser[vbal.user.id] = 0;
                vacBalByUser[vbal.user.id] += (vbal.available || 0);
            }
        }

        // Replace inner HTML of leaderboard
        var newCard = buildLeaderboardCard(employees, attendByUser, overtimeByUser, vacBalByUser, DGD.state.anomalies || []);
        var temp = document.createElement('div');
        temp.innerHTML = newCard;
        var newLeaderboard = temp.firstChild;
        if (newLeaderboard) {
            container.parentNode.replaceChild(newLeaderboard, container);
        }
    }

    /**
     * Build the full leaderboard card with podium + ranked list.
     */
    function buildLeaderboardCard(employees, attendByUser, overtimeByUser, vacBalByUser, anomalies) {
        // Score all active employees
        var ranked = [];
        for (var i = 0; i < employees.length; i++) {
            if (!employees[i].isActive) continue;
            var sc = computeEmployeeScore(employees[i], attendByUser, overtimeByUser, vacBalByUser, anomalies);
            ranked.push({
                emp: employees[i],
                score: sc.score,
                achievements: sc.achievements,
                attPct: sc.attPct,
                otH: sc.otH,
                tenure: sc.tenure
            });
        }

        if (ranked.length === 0) return '';

        ranked.sort(function(a, b) { return b.score - a.score; });

        var h = '<div class="dgd-section-card dgd-leaderboard" style="margin-bottom:1.5rem">';
        h += '<div class="dgd-section-card__title">\uD83C\uDFC5 Mitarbeiter-Leaderboard</div>';

        // --- Podium (Top 3) ---
        if (ranked.length >= 3) {
            var podiumOrder = [ranked[1], ranked[0], ranked[2]]; // Silver, Gold, Bronze
            var medals = ['\uD83E\uDD48', '\uD83E\uDD47', '\uD83E\uDD49'];
            var podiumClasses = ['dgd-podium--silver', 'dgd-podium--gold', 'dgd-podium--bronze'];
            var podiumHeights = ['120px', '150px', '100px'];

            h += '<div class="dgd-leaderboard__podium">';
            for (var p = 0; p < 3; p++) {
                var pr = podiumOrder[p];
                var empName = pr.emp.firstName + ' ' + (pr.emp.lastName ? pr.emp.lastName.charAt(0) + '.' : '');
                h += '<div class="dgd-leaderboard__podium-item ' + podiumClasses[p] + '">';
                h += '<div class="dgd-leaderboard__medal">' + medals[p] + '</div>';
                h += '<div class="dgd-leaderboard__podium-name">' + DGD.helpers.escapeHtml(empName) + '</div>';
                h += '<div class="dgd-leaderboard__podium-score">' + pr.score + ' Pkt</div>';
                h += renderBadges(pr.achievements);
                h += '<div class="dgd-leaderboard__podium-bar" style="height:' + podiumHeights[p] + '"></div>';
                h += '</div>';
            }
            h += '</div>';
        } else {
            // Less than 3 employees: simple list
            for (var s = 0; s < ranked.length; s++) {
                var sr = ranked[s];
                h += '<div class="dgd-leaderboard__row">';
                h += '<span class="dgd-leaderboard__rank">#' + (s + 1) + '</span>';
                h += '<span class="dgd-leaderboard__row-name">' + DGD.helpers.escapeHtml(sr.emp.firstName + ' ' + sr.emp.lastName) + '</span>';
                h += '<span class="dgd-leaderboard__row-score">' + sr.score + '</span>';
                h += renderBadges(sr.achievements);
                h += '</div>';
            }
        }

        // --- Ranked List (4+) ---
        if (ranked.length > 3) {
            h += '<div class="dgd-leaderboard__list">';
            for (var r = 3; r < ranked.length; r++) {
                var rr = ranked[r];
                var barPct = Math.round(rr.score);
                var barClr = rr.score >= 80 ? '#22c55e' : (rr.score >= 60 ? '#f59e0b' : '#ef4444');
                h += '<div class="dgd-leaderboard__row">';
                h += '<span class="dgd-leaderboard__rank">' + (r + 1) + '.</span>';
                h += '<span class="dgd-leaderboard__row-name">' + DGD.helpers.escapeHtml(rr.emp.firstName + ' ' + rr.emp.lastName) + '</span>';
                h += '<div class="dgd-leaderboard__bar-wrap">';
                h += '<div class="dgd-leaderboard__bar" style="width:' + barPct + '%;background:' + barClr + '"></div>';
                h += '</div>';
                h += '<span class="dgd-leaderboard__row-score">' + rr.score + '</span>';
                h += renderBadges(rr.achievements);
                h += '</div>';
            }
            h += '</div>';
        }

        // Cortex Leaderboard evaluation
        h += '<div class="dgd-leaderboard__cortex">';
        h += '<button class="dgd-dept-card__cortex-btn" onclick="window._requestCortexLeaderboardEval()">';
        h += '\uD83E\uDD16 Cortex Team-Analyse</button>';
        h += '<div id="cortex-leaderboard-eval" class="dgd-dept-card__cortex-result"></div>';
        h += '</div>';

        h += '</div>';
        return h;
    }

    /* ------------------------------------------------------------------
       Cortex Leaderboard Evaluation (SSE)
       ------------------------------------------------------------------ */

    window._requestCortexLeaderboardEval = function() {
        var container = document.getElementById('cortex-leaderboard-eval');
        if (!container) return;
        var btn = container.previousElementSibling;
        if (btn) btn.disabled = true;

        // Rebuild data from state
        var employees = DGD.state.employees || [];
        var attendByUser = {}, overtimeByUser = {}, vacBalByUser = {};
        for (var i = 0; i < (DGD.state.attendance || []).length; i++) {
            var aRec = DGD.state.attendance[i];
            if (aRec.user && aRec.user.id) attendByUser[aRec.user.id] = aRec;
        }
        for (var o = 0; o < (DGD.state.overtime || []).length; o++) {
            var ovt = DGD.state.overtime[o];
            if (ovt.user && ovt.user.id) overtimeByUser[ovt.user.id] = ovt;
        }
        var currentYear = new Date().getFullYear().toString();
        for (var vb = 0; vb < (DGD.state.timeOffBalances || []).length; vb++) {
            var vbal = DGD.state.timeOffBalances[vb];
            var vTypeName = (vbal.timeOffRule && vbal.timeOffRule.timeOffType && vbal.timeOffRule.timeOffType.name) || '';
            var periodStart = vbal.periodStartDate || '';
            if (vTypeName.toLowerCase().indexOf('urlaub') !== -1 && vbal.user && vbal.user.id && periodStart.indexOf(currentYear) === 0) {
                if (!vacBalByUser[vbal.user.id]) vacBalByUser[vbal.user.id] = 0;
                vacBalByUser[vbal.user.id] += (vbal.available || 0);
            }
        }

        // Compute scores for all active employees
        var ranked = [];
        for (var e = 0; e < employees.length; e++) {
            if (!employees[e].isActive) continue;
            var sc = computeEmployeeScore(employees[e], attendByUser, overtimeByUser, vacBalByUser, DGD.state.anomalies || []);
            ranked.push({
                name: employees[e].firstName + ' ' + employees[e].lastName,
                position: (employees[e].position && employees[e].position.name) || '',
                dept: (employees[e].team && employees[e].team.name) || '',
                score: sc.score,
                attPct: sc.attPct,
                otH: sc.otH,
                tenure: sc.tenure,
                badges: sc.achievements.map(function(a) { return a.icon + ' ' + a.label; }).join(', ')
            });
        }
        ranked.sort(function(a, b) { return b.score - a.score; });

        var avgScore = ranked.length > 0 ? Math.round(ranked.reduce(function(s, r) { return s + r.score; }, 0) / ranked.length) : 0;
        var topPerformers = ranked.filter(function(r) { return r.score >= 80; }).length;
        var atRisk = ranked.filter(function(r) { return r.score < 60; }).length;

        // Build summary table for Cortex
        var table = 'Rang | Name | Abt | Score | Anw% | \u00DCberstunden | Badges\n';
        for (var ri = 0; ri < ranked.length; ri++) {
            var rr = ranked[ri];
            table += (ri + 1) + '. | ' + rr.name + ' | ' + rr.dept + ' | ' + rr.score + ' | ' + rr.attPct + '% | ' + (rr.otH >= 0 ? '+' : '') + rr.otH + 'h | ' + rr.badges + '\n';
        }

        var prompt = 'Du bist Cortex, ein KI-HR-Berater. Analysiere das Mitarbeiter-Leaderboard.\n\n' +
            'TEAM-\u00dcBERSICHT:\n' +
            '- ' + ranked.length + ' aktive Mitarbeiter\n' +
            '- Durchschnitts-Score: ' + avgScore + '/100\n' +
            '- Top-Performer (>80): ' + topPerformers + '\n' +
            '- At Risk (<60): ' + atRisk + '\n\n' +
            'RANGLISTE:\n' + table + '\n' +
            'SCORING: Anwesenheit 35%, \u00dcberstunden-Balance 25%, Anomalie-frei 20%, Urlaubsnutzung 10%, Betriebszugeh\u00f6rigkeit 10%\n\n' +
            'Analysiere bitte:\n' +
            '1. **Gesamt-Teamgesundheit**: Wie steht das Team insgesamt da?\n' +
            '2. **St\u00e4rken**: Was l\u00e4uft gut? Wer ist Vorbild?\n' +
            '3. **Risiken**: Wer braucht Aufmerksamkeit und warum?\n' +
            '4. **Abteilungsvergleich**: Gibt es auff\u00e4llige Unterschiede zwischen Abteilungen?\n' +
            '5. **Empfehlungen**: 2-3 konkrete Ma\u00dfnahmen f\u00fcr die Gesch\u00e4ftsf\u00fchrung\n\n' +
            'Halte dich kurz und pr\u00e4gnant. Nutze **fett** f\u00fcr wichtige Begriffe.';

        streamCortexSSE(prompt, container, btn);
    };

    /* ------------------------------------------------------------------
       HR Analytics Card — Hire/Fire Rate, Tenure, Turnover KPIs
       Replaces the "Keine Abteilung" card
       ------------------------------------------------------------------ */

    function buildHRAnalyticsCard(employees) {
        var now = new Date();
        var currentYear = now.getFullYear();
        var activeEmps = [], inactiveEmps = [];
        var hires = {}, fires = {}; // by year
        var tenures = []; // in months for active employees
        var recentHires = [], recentFires = [];

        for (var i = 0; i < employees.length; i++) {
            var emp = employees[i];
            var startDate = emp.employmentStartDate ? new Date(emp.employmentStartDate) : null;
            var endDate = emp.employmentEndDate ? new Date(emp.employmentEndDate) : null;

            if (emp.isActive) {
                activeEmps.push(emp);
                if (startDate) {
                    var tenureMs = now - startDate;
                    var tenureMonths = Math.max(0, Math.round(tenureMs / (1000 * 60 * 60 * 24 * 30.44)));
                    tenures.push({ emp: emp, months: tenureMonths });
                }
            } else {
                inactiveEmps.push(emp);
            }

            // Track hires by year
            if (startDate) {
                var hYear = startDate.getFullYear();
                hires[hYear] = (hires[hYear] || 0) + 1;
                // Recent hires (last 12 months)
                var monthsAgo = (now - startDate) / (1000 * 60 * 60 * 24 * 30.44);
                if (monthsAgo <= 12) {
                    recentHires.push({ name: emp.firstName + ' ' + emp.lastName, date: emp.employmentStartDate, active: emp.isActive });
                }
            }

            // Track fires/exits (inactive employees with an end date or start date as proxy)
            if (!emp.isActive && startDate) {
                // Use start date year as approximate exit year (no endDate in API)
                var exitApprox = endDate || startDate;
                var fYear = exitApprox.getFullYear();
                fires[fYear] = (fires[fYear] || 0) + 1;
                var fireMonthsAgo = (now - exitApprox) / (1000 * 60 * 60 * 24 * 30.44);
                if (fireMonthsAgo <= 12) {
                    recentFires.push({ name: emp.firstName + ' ' + emp.lastName, date: emp.employmentStartDate });
                }
            }
        }

        // Tenure distribution buckets
        var tenureBuckets = { '<3M': 0, '3-6M': 0, '6-12M': 0, '1-2J': 0, '2-5J': 0, '>5J': 0 };
        for (var t = 0; t < tenures.length; t++) {
            var m = tenures[t].months;
            if (m < 3) tenureBuckets['<3M']++;
            else if (m < 6) tenureBuckets['3-6M']++;
            else if (m < 12) tenureBuckets['6-12M']++;
            else if (m < 24) tenureBuckets['1-2J']++;
            else if (m < 60) tenureBuckets['2-5J']++;
            else tenureBuckets['>5J']++;
        }

        // Average tenure in months
        var avgTenure = 0;
        if (tenures.length > 0) {
            var sum = 0;
            for (var ts = 0; ts < tenures.length; ts++) sum += tenures[ts].months;
            avgTenure = Math.round(sum / tenures.length);
        }

        // Current year stats
        var hiresThisYear = hires[currentYear] || 0;
        var firesThisYear = fires[currentYear] || 0;
        var netGrowth = hiresThisYear - firesThisYear;

        // Turnover rate: exits / avg headcount * 100
        var totalHeadcount = employees.length;
        var turnoverPct = totalHeadcount > 0 ? Math.round(inactiveEmps.length / totalHeadcount * 100) : 0;

        // Build card HTML
        var h = '<div class="dgd-hr-analytics">';

        // Header
        h += '<div class="dgd-dept-card__header">';
        h += '<div>';
        h += '<div class="dgd-dept-card__name">&#128202; HR Analytics</div>';
        h += '<div class="dgd-dept-card__sub">' + employees.length + ' MA gesamt &middot; ' + activeEmps.length + ' aktiv &middot; ' + inactiveEmps.length + ' ausgeschieden</div>';
        h += '</div>';
        h += '</div>';

        // KPI Grid (6 values)
        h += '<div class="dgd-dept-card__kpis">';

        // 1. Hires this year
        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:#22c55e">+' + hiresThisYear + '</div>';
        h += '<div class="dgd-dept-kpi__label">Einstellungen ' + currentYear + '</div>';
        h += '</div>';

        // 2. Exits this year
        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:#ef4444">-' + firesThisYear + '</div>';
        h += '<div class="dgd-dept-kpi__label">Austritte ' + currentYear + '</div>';
        h += '</div>';

        // 3. Net growth
        var netColor = netGrowth > 0 ? '#22c55e' : (netGrowth < 0 ? '#ef4444' : '#94a3b8');
        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:' + netColor + '">' + (netGrowth >= 0 ? '+' : '') + netGrowth + '</div>';
        h += '<div class="dgd-dept-kpi__label">Netto-Wachstum</div>';
        h += '</div>';

        // 4. Avg tenure
        var tenureStr = avgTenure >= 12 ? (Math.round(avgTenure / 12 * 10) / 10) + ' J' : avgTenure + ' M';
        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:#3b82f6">' + tenureStr + '</div>';
        h += '<div class="dgd-dept-kpi__label">\u00D8 Betriebszugeh.</div>';
        h += '<div class="dgd-dept-kpi__target">Ziel: \u22652 J</div>';
        h += '</div>';

        // 5. Turnover rate
        var turnClr = turnoverPct > 30 ? '#ef4444' : (turnoverPct > 15 ? '#f59e0b' : '#22c55e');
        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:' + turnClr + '">' + turnoverPct + '%</div>';
        h += '<div class="dgd-dept-kpi__label">Fluktuation gesamt</div>';
        h += '<div class="dgd-dept-kpi__target">Ziel: &lt;15%</div>';
        h += '</div>';

        // 6. Retention rate
        var retentionPct = 100 - turnoverPct;
        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:' + (retentionPct >= 70 ? '#22c55e' : '#f59e0b') + '">' + retentionPct + '%</div>';
        h += '<div class="dgd-dept-kpi__label">Retention Rate</div>';
        h += '<div class="dgd-dept-kpi__target">Ziel: &gt;85%</div>';
        h += '</div>';

        h += '</div>';

        // Tenure distribution bar chart
        h += '<div class="dgd-hr-tenure">';
        h += '<div class="dgd-hr-tenure__title">Betriebszugeh\u00F6rigkeit (aktive MA)</div>';
        var bucketKeys = Object.keys(tenureBuckets);
        var maxBucket = 1;
        for (var bk = 0; bk < bucketKeys.length; bk++) {
            if (tenureBuckets[bucketKeys[bk]] > maxBucket) maxBucket = tenureBuckets[bucketKeys[bk]];
        }
        h += '<div class="dgd-hr-tenure__bars">';
        var tenureColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4'];
        for (var b = 0; b < bucketKeys.length; b++) {
            var val = tenureBuckets[bucketKeys[b]];
            var pct = maxBucket > 0 ? Math.round(val / maxBucket * 100) : 0;
            h += '<div class="dgd-hr-tenure__col">';
            h += '<div class="dgd-hr-tenure__count">' + val + '</div>';
            h += '<div class="dgd-hr-tenure__bar" style="height:' + Math.max(4, pct) + '%;background:' + tenureColors[b] + '"></div>';
            h += '<div class="dgd-hr-tenure__label">' + bucketKeys[b] + '</div>';
            h += '</div>';
        }
        h += '</div>';
        h += '</div>';

        // Hire/Fire timeline SVG (last 3 years)
        var years = [];
        for (var y = currentYear - 2; y <= currentYear; y++) years.push(y);
        h += '<div class="dgd-hr-timeline">';
        h += '<div class="dgd-hr-tenure__title">Einstellungen vs. Austritte</div>';
        var maxYVal = 1;
        for (var yy = 0; yy < years.length; yy++) {
            var hVal = hires[years[yy]] || 0;
            var fVal = fires[years[yy]] || 0;
            if (hVal > maxYVal) maxYVal = hVal;
            if (fVal > maxYVal) maxYVal = fVal;
        }
        h += '<div class="dgd-hr-timeline__bars">';
        for (var yi = 0; yi < years.length; yi++) {
            var hV = hires[years[yi]] || 0;
            var fV = fires[years[yi]] || 0;
            var hPct = Math.round(hV / maxYVal * 100);
            var fPct = Math.round(fV / maxYVal * 100);
            h += '<div class="dgd-hr-timeline__group">';
            h += '<div class="dgd-hr-timeline__pair">';
            h += '<div class="dgd-hr-timeline__col">';
            h += '<div class="dgd-hr-timeline__count" style="color:#22c55e">+' + hV + '</div>';
            h += '<div class="dgd-hr-tenure__bar" style="height:' + Math.max(4, hPct) + '%;background:#22c55e"></div>';
            h += '</div>';
            h += '<div class="dgd-hr-timeline__col">';
            h += '<div class="dgd-hr-timeline__count" style="color:#ef4444">-' + fV + '</div>';
            h += '<div class="dgd-hr-tenure__bar" style="height:' + Math.max(4, fPct) + '%;background:#ef4444"></div>';
            h += '</div>';
            h += '</div>';
            h += '<div class="dgd-hr-timeline__year">' + years[yi] + '</div>';
            h += '</div>';
        }
        h += '</div>';
        h += '<div class="dgd-hr-timeline__legend">';
        h += '<span style="color:#22c55e">\u25CF Einstellungen</span>';
        h += '<span style="color:#ef4444">\u25CF Austritte</span>';
        h += '</div>';
        h += '</div>';

        // Recent activity list
        if (recentHires.length > 0 || recentFires.length > 0) {
            h += '<div class="dgd-hr-recent">';
            h += '<div class="dgd-hr-tenure__title">Letzte 12 Monate</div>';
            var allRecent = [];
            for (var rh = 0; rh < recentHires.length; rh++) {
                allRecent.push({ name: recentHires[rh].name, date: recentHires[rh].date, type: 'hire', active: recentHires[rh].active });
            }
            for (var rf = 0; rf < recentFires.length; rf++) {
                allRecent.push({ name: recentFires[rf].name, date: recentFires[rf].date, type: 'exit' });
            }
            allRecent.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

            for (var ar = 0; ar < Math.min(allRecent.length, 8); ar++) {
                var r = allRecent[ar];
                var icon = r.type === 'hire' ? '\u2795' : '\u274C';
                var rClr = r.type === 'hire' ? '#22c55e' : '#ef4444';
                var label = r.type === 'hire' ? 'Eintritt' : 'Austritt';
                if (r.type === 'hire' && r.active === false) label = 'Eintritt \u2192 Austritt';
                h += '<div class="dgd-hr-recent__item">';
                h += '<span style="color:' + rClr + '">' + icon + '</span> ';
                h += '<strong>' + DGD.helpers.escapeHtml(r.name) + '</strong>';
                h += ' <span class="dgd-text-muted">' + (r.date || '') + ' &middot; ' + label + '</span>';
                h += '</div>';
            }
            h += '</div>';
        }

        // Cortex evaluation
        h += '<div class="dgd-dept-card__cortex">';
        h += '<button class="dgd-dept-card__cortex-btn" onclick="window._requestCortexHRAnalysis()">';
        h += '\uD83E\uDD16 Cortex HR-Analyse</button>';
        h += '<div id="cortex-hr-eval" class="dgd-dept-card__cortex-result"></div>';
        h += '</div>';

        h += '</div>';
        return h;
    }

    /* Cortex HR Analysis (SSE) */
    window._requestCortexHRAnalysis = function() {
        var container = document.getElementById('cortex-hr-eval');
        if (!container) return;

        var employees = DGD.state.employees || [];
        var activeCount = 0, inactiveCount = 0;
        var tenures = [];
        var now = new Date();

        for (var i = 0; i < employees.length; i++) {
            if (employees[i].isActive) {
                activeCount++;
                if (employees[i].employmentStartDate) {
                    var start = new Date(employees[i].employmentStartDate);
                    tenures.push(employees[i].firstName + ' ' + employees[i].lastName + ': ' +
                        Math.round((now - start) / (1000 * 60 * 60 * 24 * 30.44)) + ' Monate');
                }
            } else {
                inactiveCount++;
            }
        }

        var prompt = '[DGD Dashboard - HR Analyse]\n' +
            'Analysiere die HR-Kennzahlen des Unternehmens DGD:\n' +
            '- ' + activeCount + ' aktive MA, ' + inactiveCount + ' ausgeschieden\n' +
            '- Betriebszugeh\u00F6rigkeit: ' + tenures.join(', ') + '\n' +
            '- Fluktuation: ' + Math.round(inactiveCount / employees.length * 100) + '%\n' +
            'Bewerte: Ist die Fluktuation gesund? Gibt es Risiken? Empfehlungen f\u00FCr Retention? 3-4 S\u00E4tze, Deutsch.';

        container.innerHTML = '<div class="dgd-dept-card__cortex-loading">\uD83E\uDD16 Cortex analysiert...</div>';
        var btn = container.previousElementSibling;
        if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', CORTEX_BASE + '/api/chat/stream', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        var responseText = '';
        var lastIdx = 0;

        xhr.onprogress = function() {
            var chunk = xhr.responseText.substring(lastIdx);
            lastIdx = xhr.responseText.length;
            var lines = chunk.split('\n');
            for (var l = 0; l < lines.length; l++) {
                var line = lines[l].trim();
                if (line.indexOf('data: ') === 0) {
                    try {
                        var evt = JSON.parse(line.substring(6));
                        if (evt.type === 'text' && evt.content) {
                            responseText += evt.content;
                            container.innerHTML = '<div class="dgd-dept-card__cortex-text">\uD83E\uDD16 ' + DGD.helpers.escapeHtml(responseText) + '</div>';
                        }
                    } catch(e) {}
                }
            }
        };

        xhr.onerror = function() {
            container.innerHTML = '<div class="dgd-dept-card__cortex-error">\u26A0 Cortex nicht erreichbar</div>';
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        };

        xhr.onload = function() {
            if (!responseText) {
                container.innerHTML = '<div class="dgd-dept-card__cortex-error">\u26A0 Keine Antwort von Cortex</div>';
            }
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        };

        xhr.timeout = 120000;
        xhr.send(JSON.stringify({
            user_message: prompt,
            conversation_history: []
        }));
    };

    function buildCompanyWideStats(attendance, employees) {
        var activeIds = {};
        for (var i = 0; i < employees.length; i++) {
            if (employees[i].isActive) activeIds[employees[i].id] = true;
        }
        var t = {soll: 0, ist: 0, timeoff: 0, holiday: 0};
        for (var a = 0; a < attendance.length; a++) {
            var att = attendance[a];
            if (!att.user || !activeIds[att.user.id]) continue;
            t.soll += (att.expectedTime || 0) / 3600;
            t.ist += (att.trackedTime || 0) / 3600;
            t.timeoff += (att.timeOffTime || 0) / 3600;
            t.holiday += (att.holidayTime || 0) / 3600;
        }
        t.soll = Math.round(t.soll);
        t.ist = Math.round(t.ist);
        t.timeoff = Math.round(t.timeoff);
        t.holiday = Math.round(t.holiday);
        t.fehlzeit = Math.max(0, t.soll - t.ist - t.timeoff - t.holiday);
        return t;
    }

    function renderTeamComparisonChart(teamStats) {
        var teams = Object.keys(teamStats).sort(function(a, b) {
            return (teamStats[b].avgAtt || 0) - (teamStats[a].avgAtt || 0);
        });
        if (teams.length === 0) return '';

        var W = 560, rowH = 34, padTop = 10, padLeft = 120, padRight = 55;
        var H = teams.length * rowH + padTop + 30;
        var barAreaW = W - padLeft - padRight;

        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dgd-chart-svg" xmlns="http://www.w3.org/2000/svg">';

        // Grid lines at 25/50/75/100%
        for (var g = 0; g <= 4; g++) {
            var xPos = padLeft + (g / 4) * barAreaW;
            svg += '<line x1="' + xPos + '" y1="' + padTop + '" x2="' + xPos + '" y2="' + (H - 20) + '" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="' + (g > 0 ? '3,3' : '') + '"/>';
            svg += '<text x="' + xPos + '" y="' + (H - 6) + '" text-anchor="middle" fill="#94a3b8" font-size="9">' + (g * 25) + '%</text>';
        }

        // Bars per team
        for (var i = 0; i < teams.length; i++) {
            var tName = teams[i];
            var ts = teamStats[tName];
            var yCenter = padTop + i * rowH + rowH / 2;
            var avgAtt = ts.avgAtt || 0;
            var barW = Math.max(2, avgAtt / 100 * barAreaW);
            var barColor = DGD.helpers.attPctColor(avgAtt);

            // Team name
            svg += '<text x="' + (padLeft - 8) + '" y="' + (yCenter + 4) + '" text-anchor="end" fill="#475569" font-size="11" font-weight="500">' + DGD.helpers.escapeHtml(tName) + '</text>';

            // Attendance bar
            svg += '<rect x="' + padLeft + '" y="' + (yCenter - 8) + '" width="' + barW + '" height="16" rx="4" fill="' + barColor + '" opacity="0.85">';
            svg += '<title>' + tName + ': ' + avgAtt + '% Anwesenheit (' + ts.count + ' MA)</title></rect>';

            // Percentage label
            svg += '<text x="' + (padLeft + barW + 6) + '" y="' + (yCenter + 4) + '" fill="' + barColor + '" font-size="10" font-weight="600">' + avgAtt + '%</text>';

            // Row separator
            if (i < teams.length - 1) {
                svg += '<line x1="' + padLeft + '" y1="' + (yCenter + rowH / 2) + '" x2="' + (W - padRight) + '" y2="' + (yCenter + rowH / 2) + '" stroke="#f1f5f9" stroke-width="1"/>';
            }
        }

        // Baseline
        svg += '<line x1="' + padLeft + '" y1="' + padTop + '" x2="' + padLeft + '" y2="' + (H - 20) + '" stroke="#94a3b8" stroke-width="1"/>';

        svg += '</svg>';
        return svg;
    }

    /* ======================================================================
       Overtime Timeline – async fetch + SVG line chart
       ====================================================================== */

    function loadOvertimeTimeline(containerId, employees, hrOvertimeTotal) {
        var container = document.getElementById(containerId);
        if (!container) return;

        // Go back max 18 months from now, but never before 2025-01-01 (system go-live)
        var now = new Date();
        var maxMonths = 18;
        var startDate = new Date(now.getFullYear(), now.getMonth() - maxMonths + 1, 1);
        var systemGoLive = new Date(2025, 0, 1); // 01.01.2025
        if (startDate < systemGoLive) startDate = systemGoLive;
        var startY = startDate.getFullYear();
        var startM = startDate.getMonth();
        var endY = now.getFullYear();
        var endM = now.getMonth();

        // Build monthly periods
        var periods = [];

        for (var y = startY; y <= endY; y++) {
            var mStart = (y === startY) ? startM : 0;
            var mEnd = (y === endY) ? endM : 11;
            for (var m = mStart; m <= mEnd; m++) {
                var from = y + '-' + String(m + 1).padStart(2, '0') + '-01';
                var lastDay;
                if (y === endY && m === endM) {
                    // Current month: use today
                    lastDay = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
                } else {
                    var ld = new Date(y, m + 1, 0);
                    lastDay = ld.getFullYear() + '-' + String(ld.getMonth() + 1).padStart(2, '0') + '-' + String(ld.getDate()).padStart(2, '0');
                }
                var monthNames = ['Jan', 'Feb', 'M\u00E4r', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
                periods.push({
                    from: from,
                    to: lastDay,
                    label: monthNames[m] + ' ' + String(y).slice(2),
                    isCurrent: (y === endY && m === endM)
                });
            }
        }

        // Fetch periods sequentially in batches of 3
        var results = new Array(periods.length);
        var batchSize = 3;

        function fetchBatch(startIdx) {
            var end = Math.min(startIdx + batchSize, periods.length);
            var batchDone = 0;
            var batchTotal = end - startIdx;
            if (batchTotal <= 0) {
                buildOvertimeTimelineSVG(container, periods, results, hrOvertimeTotal);
                return;
            }

            // Update loading text
            container.innerHTML = '<div class="dgd-chart-loading"><div class="dgd-chart-spinner"></div>Lade Monat ' + (startIdx + 1) + '/' + periods.length + '...</div>';

            for (var p = startIdx; p < end; p++) {
                (function(idx) {
                    TellentAPI.getAttendance(periods[idx].from, periods[idx].to, function(err, data) {
                        if (!err && data && data.statements) {
                            var monthOT = 0;
                            var monthSoll = 0;
                            var noTrackCount = 0; // MA with expected > 0 but tracked == 0
                            var withSollCount = 0; // MA with expected > 0
                            for (var s = 0; s < data.statements.length; s++) {
                                var st = data.statements[s];
                                // overtime = tracked + timeOff + holiday - expected
                                monthOT += (st.overtime != null ? st.overtime :
                                    ((st.trackedTime||0)+(st.timeOffTime||0)+(st.holidayTime||0)-(st.expectedTime||0)));
                                monthSoll += (st.expectedTime || 0);
                                if ((st.expectedTime || 0) > 0) {
                                    withSollCount++;
                                    // Flag as "no tracking" if person has 0 tracked hours despite having soll
                                    if ((st.trackedTime || 0) === 0) {
                                        noTrackCount++;
                                    }
                                }
                            }
                            var quality = withSollCount > 0 ? 1 - (noTrackCount / withSollCount) : 1;
                            results[idx] = {
                                overtimeH: Math.round(monthOT / 3600),
                                sollH: Math.round(monthSoll / 3600),
                                quality: quality,
                                noTrackCount: noTrackCount,
                                withSollCount: withSollCount
                            };
                        } else {
                            results[idx] = { overtimeH: 0, sollH: 0, quality: 1, noTrackCount: 0, withSollCount: 0 };
                        }

                        batchDone++;
                        if (batchDone === batchTotal) {
                            fetchBatch(end);
                        }
                    });
                })(p);
            }
        }

        fetchBatch(0);
    }

    function buildOvertimeTimelineSVG(container, periods, results, hrOvertimeTotal) {
        // Compute cumulative overtime, anchored to HR balance
        // HR balance = historicalStart + sum(monthly deltas)
        // So: historicalStart = hrBalance - sum(monthly deltas)
        var sumDeltas = 0;
        for (var sd = 0; sd < results.length; sd++) {
            sumDeltas += results[sd].overtimeH;
        }
        var openingBalance = (hrOvertimeTotal || 0) - sumDeltas;

        var cumulative = [];
        var running = openingBalance;
        for (var i = 0; i < periods.length; i++) {
            running += results[i].overtimeH;
            cumulative.push(running);
        }

        var n = periods.length;
        if (n === 0) { container.innerHTML = '<em>Keine Daten</em>'; return; }

        // Chart dimensions
        var W = 700, H = 260;
        var padTop = 25, padBottom = 55, padLeft = 55, padRight = 20;
        var chartW = W - padLeft - padRight;
        var chartH = H - padTop - padBottom;

        // Y-axis: min/max of monthly overtime delta AND cumulative
        var monthlyVals = results.map(function(r) { return r.overtimeH; });
        var allVals = monthlyVals.concat(cumulative);
        var yMin = Math.min(0, Math.min.apply(null, allVals));
        var yMax = Math.max(0, Math.max.apply(null, allVals));
        var yRange = yMax - yMin;
        if (yRange < 10) { yRange = 10; yMin = -5; yMax = 5; }
        // Add padding
        yMin -= yRange * 0.1;
        yMax += yRange * 0.1;
        yRange = yMax - yMin;

        function yPos(val) { return padTop + chartH - (val - yMin) / yRange * chartH; }
        function xPos(idx) { return padLeft + (idx + 0.5) / n * chartW; }

        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dgd-chart-svg" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">';

        // Grid lines
        var gridSteps = 5;
        var stepSize = yRange / gridSteps;
        // Round step to nice number (minimum 1h)
        if (stepSize < 1) {
            stepSize = 1;
        } else {
            var mag = Math.pow(10, Math.floor(Math.log10(stepSize)));
            stepSize = Math.ceil(stepSize / mag) * mag;
        }

        var gridStart = Math.floor(yMin / stepSize) * stepSize;
        for (var g = gridStart; g <= yMax; g += stepSize) {
            var gy = yPos(g);
            if (gy < padTop - 5 || gy > padTop + chartH + 5) continue;
            var dashStyle = Math.abs(g) < 0.5 ? '' : ' stroke-dasharray="3,3"';
            var strokeW = Math.abs(g) < 0.5 ? '1.5' : '0.8';
            var strokeClr = Math.abs(g) < 0.5 ? '#94a3b8' : '#e2e8f0';
            svg += '<line x1="' + padLeft + '" y1="' + gy + '" x2="' + (W - padRight) + '" y2="' + gy + '" stroke="' + strokeClr + '" stroke-width="' + strokeW + '"' + dashStyle + '/>';
            svg += '<text x="' + (padLeft - 6) + '" y="' + (gy + 3) + '" text-anchor="end" fill="#94a3b8" font-size="9">' + Math.round(g) + 'h</text>';
        }

        // Bars (monthly delta)
        var barW = Math.max(4, chartW / n * 0.55);
        for (var b = 0; b < n; b++) {
            var val = results[b].overtimeH;
            var bx = xPos(b) - barW / 2;
            var zeroY = yPos(0);
            var barY, barH;
            if (val >= 0) {
                barY = yPos(val);
                barH = zeroY - barY;
            } else {
                barY = zeroY;
                barH = yPos(val) - zeroY;
            }
            var barClr = val >= 0 ? '#f59e0b' : '#ef4444';
            var isIncomplete = results[b].quality < 0.7;
            var barOp = isIncomplete ? '0.25' : (periods[b].isCurrent ? '0.5' : '0.7');
            svg += '<rect x="' + bx + '" y="' + barY + '" width="' + barW + '" height="' + Math.max(1, barH) + '" rx="2" fill="' + barClr + '" opacity="' + barOp + '"' + (isIncomplete ? ' stroke="' + barClr + '" stroke-width="1" stroke-dasharray="3,2"' : '') + '>';
            var tooltipExtra = isIncomplete ? ' \u26A0 ' + results[b].noTrackCount + '/' + results[b].withSollCount + ' MA ohne Buchung' : '';
            svg += '<title>' + periods[b].label + ': ' + (val >= 0 ? '+' : '') + val + 'h (\u03A3 ' + cumulative[b] + 'h)' + tooltipExtra + '</title></rect>';
            if (isIncomplete) {
                svg += '<text x="' + xPos(b) + '" y="' + (barY - 4) + '" text-anchor="middle" fill="#ef4444" font-size="10">\u26A0</text>';
            }
        }

        // Cumulative line
        var linePts = [];
        for (var li = 0; li < n; li++) {
            linePts.push(xPos(li) + ',' + yPos(cumulative[li]));
        }
        svg += '<polyline points="' + linePts.join(' ') + '" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';

        // Dots on cumulative line
        for (var di = 0; di < n; di++) {
            var dx = xPos(di), dy = yPos(cumulative[di]);
            svg += '<circle cx="' + dx + '" cy="' + dy + '" r="3" fill="#3b82f6" stroke="#fff" stroke-width="1.5">';
            svg += '<title>' + periods[di].label + ': \u03A3 ' + cumulative[di] + 'h kumuliert</title></circle>';
        }

        // X-axis labels (show every nth to avoid overlap)
        var labelEvery = n <= 12 ? 1 : (n <= 24 ? 2 : 3);
        for (var xl = 0; xl < n; xl++) {
            if (xl % labelEvery !== 0 && xl !== n - 1) continue;
            var lx = xPos(xl);
            svg += '<text x="' + lx + '" y="' + (H - padBottom + 14) + '" text-anchor="middle" fill="#64748b" font-size="8" transform="rotate(-45 ' + lx + ' ' + (H - padBottom + 14) + ')">' + periods[xl].label + '</text>';
        }

        svg += '</svg>';

        // Legend + summary
        var lastCum = cumulative[n - 1];
        var summaryHtml = '<div class="dgd-company-overview" style="margin-bottom:0.5rem">';
        summaryHtml += '<span class="dgd-company-overview__stat" style="color:' + (lastCum >= 0 ? '#f59e0b' : '#ef4444') + '">\u03A3 ' + (lastCum >= 0 ? '+' : '') + lastCum + 'h Gesamt-Saldo</span>';
        summaryHtml += '<span class="dgd-company-overview__muted">' + n + ' Monate seit ' + periods[0].label + (openingBalance ? ' (Startsaldo: ' + (openingBalance >= 0 ? '+' : '') + openingBalance + 'h)' : '') + '</span>';
        summaryHtml += '</div>';

        var legendHtml = '<div class="dgd-chart-legend" style="margin-top:0.25rem">';
        legendHtml += '<div class="dgd-chart-legend__item"><span class="dgd-chart-legend__dot" style="background:#f59e0b"></span>Monatl. \u00DCberstunden</div>';
        legendHtml += '<div class="dgd-chart-legend__item"><span class="dgd-chart-legend__dot" style="background:#ef4444"></span>Monatl. Minusstunden</div>';
        legendHtml += '<div class="dgd-chart-legend__item"><span class="dgd-chart-legend__dot" style="background:#3b82f6"></span>Kumuliert (\u03A3)</div>';
        legendHtml += '</div>';

        container.innerHTML = summaryHtml + svg + legendHtml;
    }

    

    function renderMitarbeiter(container) {
        var html = '';

        // Connection status banner
        if (!DGD.state.tellentAvailable) {
            html += '<div class="dgd-staff-notice">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
            html += '<div><strong>TellentHR nicht verbunden</strong><br>Die Mitarbeiterdaten werden aus KiwiHR/TellentHR geladen. ';
            html += 'Bitte API-Key in der <code>.env</code>-Datei konfigurieren.</div>';
            html += '</div>';
            container.innerHTML = html;
            return;
        }

        var employees = DGD.state.employees || [];
        var absences = DGD.state.absences || [];

        // ---- Build lookups ----
        var activeCount = 0, inactiveCount = 0;
        var abteilungen = {}, gruppen = {}, positions = {};
        for (var i = 0; i < employees.length; i++) {
            var emp = employees[i];
            if (emp.isActive) activeCount++;
            else inactiveCount++;
            // Abteilung = primary team
            var abtName = (emp.team && emp.team.name) ? emp.team.name : 'Keine Abteilung';
            abteilungen[abtName] = (abteilungen[abtName] || 0) + 1;
            // Gruppen = all teams (deduplicated)
            var empTeams = emp.teams || [];
            var seen = {};
            for (var gt = 0; gt < empTeams.length; gt++) {
                var gn = empTeams[gt].name;
                if (gn && !seen[gn]) {
                    seen[gn] = true;
                    gruppen[gn] = (gruppen[gn] || 0) + 1;
                }
            }
            var posName = (emp.position && emp.position.name) ? emp.position.name : 'Keine Position';
            positions[posName] = (positions[posName] || 0) + 1;
        }

        var attendByUser = {};
        for (var at = 0; at < (DGD.state.attendance || []).length; at++) {
            var att = DGD.state.attendance[at];
            if (att.user && att.user.id) attendByUser[att.user.id] = att;
        }

        var overtimeByUser = {};
        for (var ot = 0; ot < (DGD.state.overtime || []).length; ot++) {
            var ovt = DGD.state.overtime[ot];
            if (ovt.user && ovt.user.id) overtimeByUser[ovt.user.id] = ovt;
        }

        // Vacation balance lookup per user (only "Urlaub" types, current year)
        var vacBalByUser = {};   // available (remaining) days
        var vacUsedByUser = {};  // used days
        var currentYear = new Date().getFullYear().toString();
        for (var vb = 0; vb < (DGD.state.timeOffBalances || []).length; vb++) {
            var vbal = DGD.state.timeOffBalances[vb];
            var vTypeName = (vbal.timeOffRule && vbal.timeOffRule.timeOffType && vbal.timeOffRule.timeOffType.name) || '';
            var periodStart = vbal.periodStartDate || '';
            if (vTypeName.toLowerCase().indexOf('urlaub') !== -1 && vbal.user && vbal.user.id && periodStart.indexOf(currentYear) === 0) {
                if (!vacBalByUser[vbal.user.id]) vacBalByUser[vbal.user.id] = 0;
                if (!vacUsedByUser[vbal.user.id]) vacUsedByUser[vbal.user.id] = 0;
                vacBalByUser[vbal.user.id] += (vbal.available || 0);
                vacUsedByUser[vbal.user.id] += (vbal.used || 0);
            }
        }

        // ---- Aggregate stats ----
        var attPctSum = 0, attPctCount = 0;
        for (var uid in attendByUser) {
            var aRec = attendByUser[uid];
            if ((aRec.expectedTime || 0) > 0) {
                attPctSum += (aRec.trackedTime || 0) / aRec.expectedTime;
                attPctCount++;
            }
        }
        var avgAttPct = attPctCount > 0 ? Math.round(attPctSum / attPctCount * 100) : 0;

        var totalOvertimeH = 0;
        for (var oi = 0; oi < (DGD.state.overtime || []).length; oi++) {
            totalOvertimeH += Math.round((DGD.state.overtime[oi].balance || 0) / 3600);
        }

        var totalVacAvailable = 0, totalVacUsedFirm = 0;
        for (var vid in vacBalByUser) {
            totalVacAvailable += vacBalByUser[vid];
        }
        for (var vuid in vacUsedByUser) {
            totalVacUsedFirm += vacUsedByUser[vuid];
        }
        var totalVacEntitlement = Math.round((totalVacAvailable + totalVacUsedFirm) * 10) / 10;

        var anomalyCount = (DGD.state.anomalies || []).length;

        // ---- Build team comparison stats ----
        var teamCompStats = {};
        for (var ei = 0; ei < employees.length; ei++) {
            var empC = employees[ei];
            if (!empC.isActive) continue;
            var tNameC = (empC.team && empC.team.name) ? empC.team.name : 'Keine Abteilung';
            if (!teamCompStats[tNameC]) teamCompStats[tNameC] = {attSum: 0, attCount: 0, count: 0};
            teamCompStats[tNameC].count++;
            var attRec = attendByUser[empC.id];
            if (attRec && (attRec.expectedTime || 0) > 0) {
                teamCompStats[tNameC].attSum += (attRec.trackedTime || 0) / attRec.expectedTime * 100;
                teamCompStats[tNameC].attCount++;
            }
        }
        for (var tn in teamCompStats) {
            teamCompStats[tn].avgAtt = teamCompStats[tn].attCount > 0 ? Math.round(teamCompStats[tn].attSum / teamCompStats[tn].attCount) : 0;
        }

        // ============================================================
        // RENDER HTML
        // ============================================================

        var hrMode = isHRUser();
        var myEmp = findMyEmployee();

        // Personal profile card (always shown at the top for the logged-in employee)
        if (myEmp && myEmp.isActive) {
            html += buildMyProfileCard(myEmp, attendByUser, overtimeByUser, vacBalByUser, vacUsedByUser, DGD.state.anomalies || []);
        } else if (DGD.state.user && employees.length > 0) {
            // No match found — show link prompt
            html += '<div class="dgd-my-profile" style="padding:1rem">';
            html += '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">';
            html += '<span style="font-size:0.85rem;color:#475569">\uD83D\uDD17 Dein Profil verkn\u00FCpfen:</span>';
            html += '<select id="link-employee-select" class="dgd-form__input" style="max-width:250px;font-size:0.8rem">';
            html += '<option value="">Mitarbeiter w\u00E4hlen\u2026</option>';
            var activeForLink = [];
            for (var li = 0; li < employees.length; li++) {
                if (employees[li].isActive) activeForLink.push(employees[li]);
            }
            activeForLink.sort(function(a,b) { return (a.firstName+a.lastName).localeCompare(b.firstName+b.lastName); });
            for (var lj = 0; lj < activeForLink.length; lj++) {
                html += '<option value="' + activeForLink[lj].id + '">' + DGD.helpers.escapeHtml(activeForLink[lj].firstName + ' ' + activeForLink[lj].lastName) + '</option>';
            }
            html += '</select>';
            html += '<button class="dgd-btn dgd-btn--sm" onclick="window._linkMyEmployee(document.getElementById(\'link-employee-select\').value)" style="font-size:0.8rem">Verkn\u00FCpfen</button>';
            html += '</div></div>';
        }

        // Summary cards (8 cards, 2 rows)
        html += '<div class="dgd-staff-summary">';
        html += DGD.helpers.renderStaffStatCard('Gesamt', employees.length, 'var(--dgd-primary)', '&#128101;');
        html += DGD.helpers.renderStaffStatCard('Aktiv', activeCount, '#22c55e', '&#9989;');
        html += DGD.helpers.renderStaffStatCard('Inaktiv', inactiveCount, '#ef4444', '&#128683;');
        html += DGD.helpers.renderStaffStatCard('Abteilungen', Object.keys(abteilungen).length, '#8b5cf6', '&#127968;');
        html += DGD.helpers.renderStaffStatCard('\u00D8 Anwesenheit', attPctCount > 0 ? (avgAttPct + '%') : '\u2014', '#f59e0b', '&#128337;', '\u226595%');
        // Count employees over 200h cap
        var overCapCount = 0;
        for (var capId in overtimeByUser) {
            if (Math.round((overtimeByUser[capId].balance || 0) / 3600) >= 200) overCapCount++;
        }
        var otCardLabel = (totalOvertimeH >= 0 ? '+' : '') + totalOvertimeH + 'h';
        if (overCapCount > 0) otCardLabel += ' (' + overCapCount + ' \u00FC. Cap)';
        html += DGD.helpers.renderStaffStatCard('\u00DCberstunden', otCardLabel, overCapCount > 0 ? '#ef4444' : (totalOvertimeH > 0 ? '#f59e0b' : '#22c55e'), '&#9200;', '\u00b10h (ausgeglichen)');
        var vacStatLabel = '\u2014';
        if (totalVacAvailable > 0) {
            vacStatLabel = Math.round(totalVacAvailable * 10) / 10 + (totalVacUsedFirm > 0 ? ' / ' + totalVacEntitlement : '') + ' Tage';
        }
        html += DGD.helpers.renderStaffStatCard('Resturlaub' + (totalVacUsedFirm > 0 ? ' (' + Math.round(totalVacUsedFirm * 10) / 10 + ' gen.)' : ''), vacStatLabel, '#06b6d4', '&#127796;');
        html += DGD.helpers.renderStaffStatCard('Anomalien', anomalyCount, anomalyCount > 0 ? '#ef4444' : '#94a3b8', '&#9888;', '0');
        // TimeSaved KPI stat card
        var ts = DGD.demoData.calcTimeSaved();
        html += DGD.helpers.renderStaffStatCard('Eingesparte Zeit', ts.totalH + 'h', '#06b6d4', '&#129302;', ts.weeklyRate + 'h/Woche');
        // Beteiligungspool stat card (HR only)
        if (hrMode && DGD.demoData.BETEILIGUNG_CONFIG.enabled && totalOvertimeH > 0) {
            var poolValue = 0;
            for (var eqId in overtimeByUser) {
                var eqOtH = Math.round((overtimeByUser[eqId].balance || 0) / 3600);
                if (eqOtH <= 0) continue;
                // Find employee position
                var eqPos = '';
                for (var eqE = 0; eqE < employees.length; eqE++) {
                    if (employees[eqE].id === eqId) { eqPos = (employees[eqE].position && employees[eqE].position.name) || ''; break; }
                }
                poolValue += DGD.demoData.calcEquity(eqOtH, eqPos).value;
            }
            var poolPct = (poolValue / DGD.demoData.BETEILIGUNG_CONFIG.companyValuation * 100).toFixed(1);
            html += DGD.helpers.renderStaffStatCard('Beteiligungspool', poolValue.toLocaleString('de-DE') + ' \u20AC', '#d97706', '&#128200;', poolPct + '% der 3,5M');
        }
        html += '</div>';

        // Leaderboard with Achievements (HR/Admin only — contains individual scores)
        if (hrMode) {
            html += buildLeaderboardCard(employees, attendByUser, overtimeByUser, vacBalByUser, DGD.state.anomalies || []);
        }

        // Company-wide overview composition bar
        if ((DGD.state.attendance || []).length > 0) {
            var companyStats = buildCompanyWideStats(DGD.state.attendance, employees);
            html += '<div class="dgd-section-card" style="margin-bottom:1.5rem">';
            html += '<div class="dgd-section-card__title">&#128202; Gesamtuebersicht Zeitaufteilung</div>';
            html += '<div class="dgd-company-overview">';
            html += '<span class="dgd-company-overview__stat" style="color:' + DGD.helpers.attPctColor(avgAttPct) + '">&#216; ' + avgAttPct + '% Anwesenheit</span>';
            html += '<span class="dgd-company-overview__muted">' + companyStats.soll + 'h Soll / ' + companyStats.ist + 'h Ist (' + activeCount + ' aktive MA)</span>';
            html += '</div>';
            html += DGD.modals.buildCompositionBar(companyStats);
            html += '</div>';
        }

        // HR Analytics Card (HR/Admin only — contains sensitive company KPIs)
        if (hrMode) {
            html += '<div class="dgd-section-card dgd-section-card--transparent" style="margin-bottom:1.5rem">';
            html += '<div class="dgd-dept-grid">';
            html += buildHRAnalyticsCard(employees);
            html += '</div>';
            html += '</div>';
        }

        // Abteilungen — Detail Cards with KPIs + Cortex Evaluation
        html += '<div class="dgd-section-card dgd-section-card--transparent" style="margin-bottom:1.5rem">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>';
        html += ' Abteilungen</div>';
        html += '<div class="dgd-dept-grid">';
        var abtNames = Object.keys(abteilungen).sort();
        for (var ab = 0; ab < abtNames.length; ab++) {
            // Skip "Keine Abteilung" — those employees are covered in HR Analytics
            if (abtNames[ab] === 'Keine Abteilung') continue;
            // Collect employees for this department
            var deptEmps = [];
            for (var de = 0; de < employees.length; de++) {
                var empTeam = (employees[de].team && employees[de].team.name) || 'Keine Abteilung';
                if (empTeam === abtNames[ab]) deptEmps.push(employees[de]);
            }
            html += buildDeptCard(abtNames[ab], deptEmps, attendByUser, overtimeByUser, vacBalByUser, vacUsedByUser, DGD.state.anomalies || [], ab);
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

        // Overtime timeline chart (HR/Admin only — individual overtime data)
        if (hrMode) {
            html += '<div class="dgd-section-card" style="margin-bottom:1.5rem">';
            html += '<div class="dgd-section-card__title">&#9200; \u00DCberstunden im Zeitverlauf</div>';
            html += '<div class="dgd-chart-explainer">';
            html += '<strong>Balken</strong> = monatliche \u00DCberstunden-\u00C4nderung (&#x1F7E7; Plus / &#x1F7E5; Minus) &nbsp;|&nbsp; ';
            html += '<strong>Blaue Linie</strong> = kumulierter Saldo aller MA \u00FCber die Zeit. ';
            html += 'Sinkt die Linie, baut die Firma insgesamt Minusstunden auf. Steigt sie, wachsen die \u00DCberstunden.';
            html += '</div>';
            html += '<div id="overtime-timeline-chart">';
            html += '<div class="dgd-chart-loading"><div class="dgd-chart-spinner"></div>Lade historische Daten...</div>';
            html += '</div>';
            html += '<div class="dgd-dept-card__cortex" style="margin-top:0.75rem">';
            html += '<button class="dgd-dept-card__cortex-btn" onclick="window._requestCortexOvertimeEval()">';
            html += '\uD83E\uDD16 Cortex Analyse: \u00DCberstunden-Trend</button>';
            html += '<div id="cortex-overtime-eval" class="dgd-dept-card__cortex-result"></div>';
            html += '</div>';
            html += '</div>';
        }

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
        var empAnomalies = DGD.state.anomalies || [];
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
            var attHtml = '—';
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

            // Overtime cell — 200h hard cap gauge
            var otInfo = overtimeByUser[emp2.id];
            var otHtml = '\u2014';
            if (otInfo) {
                var otH = Math.round((otInfo.balance || 0) / 3600);
                var otClr = DGD.helpers.overtimeColor(otH);
                var otAbs = Math.abs(otH);
                var otPct = Math.min(Math.round(otAbs / OT_CAP * 100), 100);
                var capExceeded = otH >= OT_CAP;
                var capWarning = otH >= OT_CAP * 0.75; // 150h+
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

            // Vacation balance cell (remaining / total)
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
            html += '<td>' + DGD.helpers.escapeHtml((emp2.position && emp2.position.name) || '—') + '</td>';
            html += '<td>' + DGD.helpers.escapeHtml((emp2.team && emp2.team.name) || '—') + '</td>';
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

        container.innerHTML = html;

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
                e.stopPropagation(); // Don't trigger row click
                var empId = this.getAttribute('data-emp-cortex');
                if (empId) window._requestCortexEmployeeEval(empId, this);
            });
        }

        // Load overtime timeline asynchronously (HR only)
        if (hrMode) {
            // Pass current HR overtime balance so chart can anchor cumulative line
            var hrOvertimeTotal = 0;
            for (var hoi = 0; hoi < (DGD.state.overtime || []).length; hoi++) {
                hrOvertimeTotal += Math.round((DGD.state.overtime[hoi].balance || 0) / 3600);
            }
            loadOvertimeTimeline('overtime-timeline-chart', employees, hrOvertimeTotal);
        }

        // Run deep timesheet analysis (async) — updates leaderboard when done
        // Also needed for personal profile badges
        runTimesheetAnalysis(employees);
    }

    // Export the main render function
    DGD.views.mitarbeiter = renderMitarbeiter;
})();
