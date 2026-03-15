/* ==========================================================================
   DGD Dashboard - View: Mitarbeiter (TellentHR) - Hauptmodul
   Depends on: namespace.js, helpers.js, demo-data.js, modals.js, tellent.js
   Sub-modules: mitarbeiter-profile.js, mitarbeiter-departments.js,
                mitarbeiter-company.js, mitarbeiter-list.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {
    'use strict';

    var OT_CAP = 200; // 200h hard cap (company-wide constant)

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
       Cortex Progress Bar Helper
       ------------------------------------------------------------------ */

    function createCortexProgress(container) {
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

        var iv = setInterval(function() {
            if (done) return;
            var elapsed = (Date.now() - startTime) / 1000;
            var target;
            if (elapsed < 10) {
                target = elapsed * 6;
            } else if (elapsed < 25) {
                target = 60 + (elapsed - 10) * 1.67;
            } else if (elapsed < 55) {
                target = 85 + (elapsed - 25) * 0.33;
            } else {
                target = 95;
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
                                var progDiv = container.querySelector('.dgd-cortex-progress');
                                if (progDiv) progDiv.style.display = 'none';
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
       Employee Score Algorithm
       ------------------------------------------------------------------ */

    function computeEmployeeScore(emp, attendByUser, overtimeByUser, vacBalByUser, anomalies) {
        var now = new Date();
        var result = { score: 0, achievements: [], attPct: 0, otH: 0, tenure: 0, vacDays: 0, trackingPrecise: false };
        if (!emp.isActive) return result;

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
        var empAnomalyCount = 0;
        for (var a = 0; a < (anomalies || []).length; a++) {
            if (anomalies[a].employeeId === emp.id || anomalies[a].employeeName === (emp.firstName + ' ' + emp.lastName)) {
                empAnomalyCount++;
            }
        }

        // --- Tracking Precision Analysis ---
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

        var tsAnalysis = (DGD.state._timesheetAnalysis || {})[emp.id];
        var trackingUnknown = false;
        if (tsAnalysis) {
            if (tsAnalysis.unknown) {
                trackingUnknown = true;
                trackingPrecise = false;
            } else if (tsAnalysis.alwaysSameStart) {
                trackingPrecise = false;
                alwaysSameStart = true;
            } else if (tsAnalysis.allRound && !tsAnalysis.precise) {
                trackingPrecise = false;
            } else if (tsAnalysis.precise) {
                trackingPrecise = true;
            }
        }

        result.trackingPrecise = trackingPrecise;
        result.alwaysSameStart = alwaysSameStart;
        result.trackingUnknown = trackingUnknown;
        result.attPct = attPct;
        result.otH = otH;
        result.tenure = tenureMonths;
        result.vacDays = vacDays;

        // --- Scoring (0-100) ---
        var attScore = Math.min(attPct, 100);

        var otScore;
        if (otH < 0) otScore = 50;
        else if (otH <= 50) otScore = 100;
        else if (otH <= 100) otScore = 80;
        else if (otH <= 150) otScore = 50;
        else if (otH < OT_CAP) otScore = 25;
        else otScore = 5;

        var anomScore = empAnomalyCount === 0 ? 100 : (empAnomalyCount === 1 ? 60 : 20);

        var trackScore;
        var trackMalus = 0;
        if (trackingUnknown) {
            trackScore = 50;
        } else if (trackingPrecise) {
            trackScore = 100;
        } else {
            trackScore = 0;
            if (attRec && (attRec.trackedTime || 0) > 0) trackMalus = -5;
        }
        if (alwaysSameStart) trackMalus = -5;

        var vacScore;
        if (attRec && vacDays <= 5) vacScore = 100;
        else if (vacDays <= 15) vacScore = 75;
        else vacScore = 50;

        var tenureScore;
        if (tenureMonths >= 24) tenureScore = 100;
        else if (tenureMonths >= 12) tenureScore = 75;
        else if (tenureMonths >= 6) tenureScore = 50;
        else tenureScore = 25;

        var overdriveBonus = 0;
        if (otH >= 20 && otH <= 100) {
            overdriveBonus = 5;
        } else if (otH > 100 && otH <= 150) {
            overdriveBonus = -3;
        } else if (otH > 150) {
            overdriveBonus = -8;
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
        result.score = Math.max(0, Math.min(100, result.score));

        // --- Achievements ---
        if (attPct >= 95 && trackingPrecise && !alwaysSameStart) {
            result.achievements.push({ icon: '\u23F0', label: 'P\u00FCnktlich', type: 'bonus' });
        }
        if (alwaysSameStart) {
            result.achievements.push({ icon: '\uD83D\uDCCB', label: 'Routine-Eintrag', type: 'malus' });
        }
        if (attPct >= 85 && tenureMonths > 12) {
            result.achievements.push({ icon: '\uD83C\uDFC3', label: 'Marathonl\u00E4ufer', type: 'bonus' });
        }
        if (otH >= 0 && otH <= 50) {
            result.achievements.push({ icon: '\u2696\uFE0F', label: 'Ausgeglichen', type: 'bonus' });
        }
        if (otH >= 20 && otH <= 100) {
            result.achievements.push({ icon: '\uD83D\uDD25', label: 'Overdrive', type: 'bonus' });
        }
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
        if (empAnomalyCount === 0 && (anomalies || []).length > 0) {
            result.achievements.push({ icon: '\u2728', label: 'Clean Sheet', type: 'bonus' });
        }
        if (!trackingUnknown) {
            if (trackingPrecise) {
                result.achievements.push({ icon: '\uD83C\uDFAF', label: 'Pr\u00E4zise', type: 'bonus' });
            } else if (attRec && (attRec.trackedTime || 0) > 0) {
                result.achievements.push({ icon: '\uD83D\uDD50', label: 'Stempeluhr', type: 'malus' });
            }
        }

        return result;
    }

    /* ------------------------------------------------------------------
       Render Badges
       ------------------------------------------------------------------ */

    function renderBadges(achievements, maxShow) {
        if (!achievements || achievements.length === 0) return '';
        var limit = maxShow || achievements.length;
        var h = '<div class="dgd-leaderboard__badges">';
        for (var i = 0; i < Math.min(achievements.length, limit); i++) {
            var a = achievements[i];
            var typeClass = 'dgd-badge--' + (a.type || 'neutral');
            var marker = '';
            if (a.type === 'bonus') marker = '\u25B2 ';
            else if (a.type === 'malus') marker = '\u25BC ';
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
       HR User Check
       ------------------------------------------------------------------ */

    function isHRUser() {
        return DGD.state.user && (DGD.state.user.role === 'admin' || DGD.state.user.role === 'hr');
    }

    /* ------------------------------------------------------------------
       Find My Employee
       ------------------------------------------------------------------ */

    function findMyEmployee() {
        if (!DGD.state.user) return null;
        var employees = DGD.state.employees || [];

        var linkedId = localStorage.getItem('dgd_my_employee_id');
        if (linkedId) {
            for (var k = 0; k < employees.length; k++) {
                if (employees[k].id === linkedId) return employees[k];
            }
        }

        if (DGD.state.user.email) {
            var myEmail = DGD.state.user.email.toLowerCase();
            for (var i = 0; i < employees.length; i++) {
                if ((employees[i].email || '').toLowerCase() === myEmail) return employees[i];
            }
        }

        if (DGD.state.user.display_name) {
            var dn = DGD.state.user.display_name.toLowerCase().trim();
            for (var j = 0; j < employees.length; j++) {
                var empName = ((employees[j].firstName || '') + ' ' + (employees[j].lastName || '')).toLowerCase().trim();
                if (empName === dn) return employees[j];
            }
        }
        return null;
    }

    /* ------------------------------------------------------------------
       Link My Employee (global handler)
       ------------------------------------------------------------------ */

    window._linkMyEmployee = function(employeeId) {
        if (employeeId) {
            localStorage.setItem('dgd_my_employee_id', employeeId);
        } else {
            localStorage.removeItem('dgd_my_employee_id');
        }
        var mainEl = document.querySelector('.dgd-main');
        if (mainEl) renderMitarbeiter(mainEl);
    };

    /* ------------------------------------------------------------------
       Build Vacation Lookups Helper
       ------------------------------------------------------------------ */

    function buildVacationLookups() {
        var vacBalByUser = {};
        var vacUsedByUser = {};
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
        return { vacBalByUser: vacBalByUser, vacUsedByUser: vacUsedByUser };
    }

    /* ------------------------------------------------------------------
       Build Data Lookups Helper
       ------------------------------------------------------------------ */

    function buildDataLookups() {
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

        var vacLookups = buildVacationLookups();

        return {
            attendByUser: attendByUser,
            overtimeByUser: overtimeByUser,
            vacBalByUser: vacLookups.vacBalByUser,
            vacUsedByUser: vacLookups.vacUsedByUser
        };
    }

    /* ------------------------------------------------------------------
       Main Dispatcher: renderMitarbeiter
       ------------------------------------------------------------------ */

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
        var lookups = buildDataLookups();
        var hrMode = isHRUser();
        var myEmp = findMyEmployee();
        var shared = DGD.views.mitarbeiter._shared;

        // Aggregate stats for company section
        var attPctSum = 0, attPctCount = 0;
        for (var uid in lookups.attendByUser) {
            var aRec = lookups.attendByUser[uid];
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

        var anomalyCount = (DGD.state.anomalies || []).length;

        // Data object passed to sub-modules
        var data = {
            employees: employees,
            lookups: lookups,
            hrMode: hrMode,
            myEmp: myEmp,
            avgAttPct: avgAttPct,
            attPctCount: attPctCount,
            totalOvertimeH: totalOvertimeH,
            anomalyCount: anomalyCount
        };

        // 1. Profile card
        if (DGD.views.mitarbeiter.renderProfile) {
            html += DGD.views.mitarbeiter.renderProfile(data);
        }

        // 2. Company overview (stat cards, composition bar, overtime timeline)
        if (DGD.views.mitarbeiter.renderCompany) {
            html += DGD.views.mitarbeiter.renderCompany(data);
        }

        // 3. Department cards
        if (DGD.views.mitarbeiter.renderDepartments) {
            html += DGD.views.mitarbeiter.renderDepartments(data);
        }

        // 4. Employee list
        if (DGD.views.mitarbeiter.renderList) {
            html += DGD.views.mitarbeiter.renderList(data);
        }

        container.innerHTML = html;

        // Wire up event handlers from sub-modules
        if (DGD.views.mitarbeiter.wireListEvents) {
            DGD.views.mitarbeiter.wireListEvents();
        }

        // Load overtime timeline asynchronously (HR only)
        if (hrMode) {
            var hrOvertimeTotal = totalOvertimeH;
            if (DGD.views.mitarbeiter.loadOvertimeTimeline) {
                DGD.views.mitarbeiter.loadOvertimeTimeline('overtime-timeline-chart', employees, hrOvertimeTotal);
            }
        }

        // Run deep timesheet analysis (async)
        if (DGD.views.mitarbeiter.runTimesheetAnalysis) {
            DGD.views.mitarbeiter.runTimesheetAnalysis(employees);
        }
    }

    // Export the main render function
    DGD.views.mitarbeiter = renderMitarbeiter;

    // Export shared utilities for sub-modules
    DGD.views.mitarbeiter._shared = {
        OT_CAP: OT_CAP,
        CORTEX_BASE: CORTEX_BASE,
        createCortexProgress: createCortexProgress,
        renderCortexMd: renderCortexMd,
        streamCortexSSE: streamCortexSSE,
        computeEmployeeScore: computeEmployeeScore,
        renderBadges: renderBadges,
        isHRUser: isHRUser,
        findMyEmployee: findMyEmployee,
        buildVacationLookups: buildVacationLookups,
        buildDataLookups: buildDataLookups
    };
})();
