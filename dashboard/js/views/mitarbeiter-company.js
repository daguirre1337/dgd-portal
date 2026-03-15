/* ==========================================================================
   DGD Dashboard - View: Mitarbeiter - Company Overview
   Attendance Chart, Overtime Timeline, Vacation, KPI Stats, HR Analytics,
   Leaderboard
   Depends on: mitarbeiter.js (shared utilities)
   ========================================================================== */

(function() {
    'use strict';

    function getShared() {
        return DGD.views.mitarbeiter._shared;
    }

    /* ------------------------------------------------------------------
       Company-Wide Stats
       ------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------
       Team Comparison Chart
       ------------------------------------------------------------------ */

    function renderTeamComparisonChart(teamStats) {
        var teams = Object.keys(teamStats).sort(function(a, b) {
            return (teamStats[b].avgAtt || 0) - (teamStats[a].avgAtt || 0);
        });
        if (teams.length === 0) return '';

        var W = 560, rowH = 34, padTop = 10, padLeft = 120, padRight = 55;
        var H = teams.length * rowH + padTop + 30;
        var barAreaW = W - padLeft - padRight;

        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dgd-chart-svg" xmlns="http://www.w3.org/2000/svg">';

        for (var g = 0; g <= 4; g++) {
            var xPos = padLeft + (g / 4) * barAreaW;
            svg += '<line x1="' + xPos + '" y1="' + padTop + '" x2="' + xPos + '" y2="' + (H - 20) + '" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="' + (g > 0 ? '3,3' : '') + '"/>';
            svg += '<text x="' + xPos + '" y="' + (H - 6) + '" text-anchor="middle" fill="#94a3b8" font-size="9">' + (g * 25) + '%</text>';
        }

        for (var i = 0; i < teams.length; i++) {
            var tName = teams[i];
            var ts = teamStats[tName];
            var yCenter = padTop + i * rowH + rowH / 2;
            var avgAtt = ts.avgAtt || 0;
            var barW = Math.max(2, avgAtt / 100 * barAreaW);
            var barColor = DGD.helpers.attPctColor(avgAtt);

            svg += '<text x="' + (padLeft - 8) + '" y="' + (yCenter + 4) + '" text-anchor="end" fill="#475569" font-size="11" font-weight="500">' + DGD.helpers.escapeHtml(tName) + '</text>';
            svg += '<rect x="' + padLeft + '" y="' + (yCenter - 8) + '" width="' + barW + '" height="16" rx="4" fill="' + barColor + '" opacity="0.85">';
            svg += '<title>' + tName + ': ' + avgAtt + '% Anwesenheit (' + ts.count + ' MA)</title></rect>';
            svg += '<text x="' + (padLeft + barW + 6) + '" y="' + (yCenter + 4) + '" fill="' + barColor + '" font-size="10" font-weight="600">' + avgAtt + '%</text>';

            if (i < teams.length - 1) {
                svg += '<line x1="' + padLeft + '" y1="' + (yCenter + rowH / 2) + '" x2="' + (W - padRight) + '" y2="' + (yCenter + rowH / 2) + '" stroke="#f1f5f9" stroke-width="1"/>';
            }
        }

        svg += '<line x1="' + padLeft + '" y1="' + padTop + '" x2="' + padLeft + '" y2="' + (H - 20) + '" stroke="#94a3b8" stroke-width="1"/>';
        svg += '</svg>';
        return svg;
    }

    /* ======================================================================
       Overtime Timeline - async fetch + SVG line chart
       ====================================================================== */

    function loadOvertimeTimeline(containerId, employees, hrOvertimeTotal) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var now = new Date();
        var maxMonths = 18;
        var startDate = new Date(now.getFullYear(), now.getMonth() - maxMonths + 1, 1);
        var systemGoLive = new Date(2025, 0, 1);
        if (startDate < systemGoLive) startDate = systemGoLive;
        var startY = startDate.getFullYear();
        var startM = startDate.getMonth();
        var endY = now.getFullYear();
        var endM = now.getMonth();

        var periods = [];
        for (var y = startY; y <= endY; y++) {
            var mStart = (y === startY) ? startM : 0;
            var mEnd = (y === endY) ? endM : 11;
            for (var m = mStart; m <= mEnd; m++) {
                var from = y + '-' + String(m + 1).padStart(2, '0') + '-01';
                var lastDay;
                if (y === endY && m === endM) {
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

            container.innerHTML = '<div class="dgd-chart-loading"><div class="dgd-chart-spinner"></div>Lade Monat ' + (startIdx + 1) + '/' + periods.length + '...</div>';

            for (var p = startIdx; p < end; p++) {
                (function(idx) {
                    TellentAPI.getAttendance(periods[idx].from, periods[idx].to, function(err, data) {
                        if (!err && data && data.statements) {
                            var monthOT = 0;
                            var monthSoll = 0;
                            var noTrackCount = 0;
                            var withSollCount = 0;
                            for (var s = 0; s < data.statements.length; s++) {
                                var st = data.statements[s];
                                monthOT += (st.overtime != null ? st.overtime :
                                    ((st.trackedTime||0)+(st.timeOffTime||0)+(st.holidayTime||0)-(st.expectedTime||0)));
                                monthSoll += (st.expectedTime || 0);
                                if ((st.expectedTime || 0) > 0) {
                                    withSollCount++;
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

        var W = 700, H = 260;
        var padTop = 25, padBottom = 55, padLeft = 55, padRight = 20;
        var chartW = W - padLeft - padRight;
        var chartH = H - padTop - padBottom;

        var monthlyVals = results.map(function(r) { return r.overtimeH; });
        var allVals = monthlyVals.concat(cumulative);
        var yMin = Math.min(0, Math.min.apply(null, allVals));
        var yMax = Math.max(0, Math.max.apply(null, allVals));
        var yRange = yMax - yMin;
        if (yRange < 10) { yRange = 10; yMin = -5; yMax = 5; }
        yMin -= yRange * 0.1;
        yMax += yRange * 0.1;
        yRange = yMax - yMin;

        function yPos(val) { return padTop + chartH - (val - yMin) / yRange * chartH; }
        function xPos(idx) { return padLeft + (idx + 0.5) / n * chartW; }

        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dgd-chart-svg" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">';

        var gridSteps = 5;
        var stepSize = yRange / gridSteps;
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

        var linePts = [];
        for (var li = 0; li < n; li++) {
            linePts.push(xPos(li) + ',' + yPos(cumulative[li]));
        }
        svg += '<polyline points="' + linePts.join(' ') + '" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';

        for (var di = 0; di < n; di++) {
            var dx = xPos(di), dy = yPos(cumulative[di]);
            svg += '<circle cx="' + dx + '" cy="' + dy + '" r="3" fill="#3b82f6" stroke="#fff" stroke-width="1.5">';
            svg += '<title>' + periods[di].label + ': \u03A3 ' + cumulative[di] + 'h kumuliert</title></circle>';
        }

        var labelEvery = n <= 12 ? 1 : (n <= 24 ? 2 : 3);
        for (var xl = 0; xl < n; xl++) {
            if (xl % labelEvery !== 0 && xl !== n - 1) continue;
            var lx = xPos(xl);
            svg += '<text x="' + lx + '" y="' + (H - padBottom + 14) + '" text-anchor="middle" fill="#64748b" font-size="8" transform="rotate(-45 ' + lx + ' ' + (H - padBottom + 14) + ')">' + periods[xl].label + '</text>';
        }

        svg += '</svg>';

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

    /* ------------------------------------------------------------------
       Cortex Overtime Timeline Evaluation (global handler)
       ------------------------------------------------------------------ */

    window._requestCortexOvertimeEval = function() {
        var shared = getShared();
        var OT_CAP = shared.OT_CAP;
        var container = document.getElementById('cortex-overtime-eval');
        if (!container) return;

        var chartEl = document.getElementById('overtime-timeline-chart');
        var summaryText = '';
        if (chartEl) {
            var statEl = chartEl.querySelector('.dgd-company-overview__stat');
            if (statEl) summaryText = statEl.textContent;
        }

        var timelineData = [];
        if (chartEl) {
            var rects = chartEl.querySelectorAll('rect[rx="2"] title');
            for (var ti = 0; ti < rects.length; ti++) {
                var title = rects[ti].textContent || '';
                if (title) timelineData.push(title);
            }
        }

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

        shared.streamCortexSSE(prompt, container, btn);
    };

    /* ------------------------------------------------------------------
       HR Analytics Card
       ------------------------------------------------------------------ */

    function buildHRAnalyticsCard(employees) {
        var now = new Date();
        var currentYear = now.getFullYear();
        var activeEmps = [], inactiveEmps = [];
        var hires = {}, fires = {};
        var tenures = [];
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

            if (startDate) {
                var hYear = startDate.getFullYear();
                hires[hYear] = (hires[hYear] || 0) + 1;
                var monthsAgo = (now - startDate) / (1000 * 60 * 60 * 24 * 30.44);
                if (monthsAgo <= 12) {
                    recentHires.push({ name: emp.firstName + ' ' + emp.lastName, date: emp.employmentStartDate, active: emp.isActive });
                }
            }

            if (!emp.isActive && startDate) {
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

        var avgTenure = 0;
        if (tenures.length > 0) {
            var sum = 0;
            for (var ts = 0; ts < tenures.length; ts++) sum += tenures[ts].months;
            avgTenure = Math.round(sum / tenures.length);
        }

        var hiresThisYear = hires[currentYear] || 0;
        var firesThisYear = fires[currentYear] || 0;
        var netGrowth = hiresThisYear - firesThisYear;

        var totalHeadcount = employees.length;
        var turnoverPct = totalHeadcount > 0 ? Math.round(inactiveEmps.length / totalHeadcount * 100) : 0;

        var h = '<div class="dgd-hr-analytics">';

        h += '<div class="dgd-dept-card__header">';
        h += '<div>';
        h += '<div class="dgd-dept-card__name">&#128202; HR Analytics</div>';
        h += '<div class="dgd-dept-card__sub">' + employees.length + ' MA gesamt &middot; ' + activeEmps.length + ' aktiv &middot; ' + inactiveEmps.length + ' ausgeschieden</div>';
        h += '</div>';
        h += '</div>';

        h += '<div class="dgd-dept-card__kpis">';

        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:#22c55e">+' + hiresThisYear + '</div>';
        h += '<div class="dgd-dept-kpi__label">Einstellungen ' + currentYear + '</div>';
        h += '</div>';

        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:#ef4444">-' + firesThisYear + '</div>';
        h += '<div class="dgd-dept-kpi__label">Austritte ' + currentYear + '</div>';
        h += '</div>';

        var netColor = netGrowth > 0 ? '#22c55e' : (netGrowth < 0 ? '#ef4444' : '#94a3b8');
        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:' + netColor + '">' + (netGrowth >= 0 ? '+' : '') + netGrowth + '</div>';
        h += '<div class="dgd-dept-kpi__label">Netto-Wachstum</div>';
        h += '</div>';

        var tenureStr = avgTenure >= 12 ? (Math.round(avgTenure / 12 * 10) / 10) + ' J' : avgTenure + ' M';
        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:#3b82f6">' + tenureStr + '</div>';
        h += '<div class="dgd-dept-kpi__label">\u00D8 Betriebszugeh.</div>';
        h += '<div class="dgd-dept-kpi__target">Ziel: \u22652 J</div>';
        h += '</div>';

        var turnClr = turnoverPct > 30 ? '#ef4444' : (turnoverPct > 15 ? '#f59e0b' : '#22c55e');
        h += '<div class="dgd-dept-kpi">';
        h += '<div class="dgd-dept-kpi__val" style="color:' + turnClr + '">' + turnoverPct + '%</div>';
        h += '<div class="dgd-dept-kpi__label">Fluktuation gesamt</div>';
        h += '<div class="dgd-dept-kpi__target">Ziel: &lt;15%</div>';
        h += '</div>';

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

        // Hire/Fire timeline SVG
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
        var shared = getShared();
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

        var CORTEX_BASE = shared.CORTEX_BASE;
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

    /* ------------------------------------------------------------------
       Leaderboard Card
       ------------------------------------------------------------------ */

    function buildLeaderboardCard(employees, attendByUser, overtimeByUser, vacBalByUser, anomalies) {
        var shared = getShared();
        var ranked = [];
        for (var i = 0; i < employees.length; i++) {
            if (!employees[i].isActive) continue;
            var sc = shared.computeEmployeeScore(employees[i], attendByUser, overtimeByUser, vacBalByUser, anomalies);
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

        if (ranked.length >= 3) {
            var podiumOrder = [ranked[1], ranked[0], ranked[2]];
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
                h += shared.renderBadges(pr.achievements);
                h += '<div class="dgd-leaderboard__podium-bar" style="height:' + podiumHeights[p] + '"></div>';
                h += '</div>';
            }
            h += '</div>';
        } else {
            for (var s = 0; s < ranked.length; s++) {
                var sr = ranked[s];
                h += '<div class="dgd-leaderboard__row">';
                h += '<span class="dgd-leaderboard__rank">#' + (s + 1) + '</span>';
                h += '<span class="dgd-leaderboard__row-name">' + DGD.helpers.escapeHtml(sr.emp.firstName + ' ' + sr.emp.lastName) + '</span>';
                h += '<span class="dgd-leaderboard__row-score">' + sr.score + '</span>';
                h += shared.renderBadges(sr.achievements);
                h += '</div>';
            }
        }

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
                h += shared.renderBadges(rr.achievements);
                h += '</div>';
            }
            h += '</div>';
        }

        h += '<div class="dgd-leaderboard__cortex">';
        h += '<button class="dgd-dept-card__cortex-btn" onclick="window._requestCortexLeaderboardEval()">';
        h += '\uD83E\uDD16 Cortex Team-Analyse</button>';
        h += '<div id="cortex-leaderboard-eval" class="dgd-dept-card__cortex-result"></div>';
        h += '</div>';

        h += '</div>';
        return h;
    }

    /* ------------------------------------------------------------------
       Cortex Leaderboard Evaluation (global handler)
       ------------------------------------------------------------------ */

    window._requestCortexLeaderboardEval = function() {
        var shared = getShared();
        var OT_CAP = shared.OT_CAP;
        var container = document.getElementById('cortex-leaderboard-eval');
        if (!container) return;
        var btn = container.previousElementSibling;
        if (btn) btn.disabled = true;

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

        var ranked = [];
        for (var e = 0; e < employees.length; e++) {
            if (!employees[e].isActive) continue;
            var sc = shared.computeEmployeeScore(employees[e], attendByUser, overtimeByUser, vacBalByUser, DGD.state.anomalies || []);
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

        shared.streamCortexSSE(prompt, container, btn);
    };

    /* ------------------------------------------------------------------
       Timesheet Quality Analysis (async)
       ------------------------------------------------------------------ */

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
            var dayStart = null;
            for (var e = 0; e < entries.length; e++) {
                var startAt = entries[e].startAt;
                if (startAt) {
                    var timePart = startAt.length > 10 ? startAt.substring(11, 16) : startAt.substring(0, 5);
                    if (!dayStart || timePart < dayStart) dayStart = timePart;
                }
            }
            if (dayStart) startTimes.push(dayStart);
        }

        if (startTimes.length === 0) {
            return { precise: false, alwaysSameStart: false, allRound: false, unknown: true, startTimes: startTimes, entryCount: entryCount };
        }
        if (startTimes.length === 1) {
            var singleMin = parseInt(startTimes[0].split(':')[1], 10);
            var singleRound = (singleMin === 0 || singleMin === 15 || singleMin === 30 || singleMin === 45);
            return { precise: !singleRound, alwaysSameStart: false, allRound: singleRound, unknown: false, startTimes: startTimes, entryCount: entryCount };
        }

        var allSame = true;
        for (var s = 1; s < startTimes.length; s++) {
            if (startTimes[s] !== startTimes[0]) { allSame = false; break; }
        }

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

    function runTimesheetAnalysis(employees) {
        var activeEmps = [];
        for (var i = 0; i < employees.length; i++) {
            if (employees[i].isActive) activeEmps.push(employees[i]);
        }

        var sampleDates = [];
        var d = new Date();
        while (sampleDates.length < 5) {
            d.setDate(d.getDate() - 1);
            var dow = d.getDay();
            if (dow !== 0 && dow !== 6) {
                sampleDates.push(d.toISOString().substring(0, 10));
            }
        }

        var allPromises = [];
        var empMap = {};

        for (var e = 0; e < activeEmps.length; e++) {
            var empId = activeEmps[e].id;
            empMap[empId] = { emp: activeEmps[e], promises: [] };
            for (var dd = 0; dd < sampleDates.length; dd++) {
                var p = fetchTimesheet(empId, sampleDates[dd]);
                empMap[empId].promises.push(p);
                allPromises.push(p);
            }
        }

        var empIds = Object.keys(empMap);
        var analysisComplete = 0;

        for (var ei = 0; ei < empIds.length; ei++) {
            (function(uid) {
                Promise.all(empMap[uid].promises).then(function(results) {
                    var analysis = analyzeTimesheetEntries(results);
                    if (!DGD.state._timesheetAnalysis) DGD.state._timesheetAnalysis = {};
                    DGD.state._timesheetAnalysis[uid] = analysis;

                    analysisComplete++;
                    if (analysisComplete === empIds.length) {
                        refreshLeaderboard();
                    }
                });
            })(empIds[ei]);
        }
    }

    function refreshLeaderboard() {
        var shared = getShared();
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

        var newCard = buildLeaderboardCard(employees, attendByUser, overtimeByUser, vacBalByUser, DGD.state.anomalies || []);
        var temp = document.createElement('div');
        temp.innerHTML = newCard;
        var newLeaderboard = temp.firstChild;
        if (newLeaderboard) {
            container.parentNode.replaceChild(newLeaderboard, container);
        }
    }

    /* ------------------------------------------------------------------
       Render Company Section (called from main dispatcher)
       ------------------------------------------------------------------ */

    DGD.views.mitarbeiter.renderCompany = function(data) {
        var html = '';
        var shared = getShared();
        var OT_CAP = shared.OT_CAP;
        var employees = data.employees;
        var lookups = data.lookups;
        var hrMode = data.hrMode;
        var avgAttPct = data.avgAttPct;
        var attPctCount = data.attPctCount;
        var totalOvertimeH = data.totalOvertimeH;
        var anomalyCount = data.anomalyCount;

        // Count active/inactive
        var activeCount = 0, inactiveCount = 0;
        var abteilungen = {};
        for (var i = 0; i < employees.length; i++) {
            if (employees[i].isActive) activeCount++;
            else inactiveCount++;
            var abtName = (employees[i].team && employees[i].team.name) ? employees[i].team.name : 'Keine Abteilung';
            abteilungen[abtName] = (abteilungen[abtName] || 0) + 1;
        }

        // Vacation totals
        var totalVacAvailable = 0, totalVacUsedFirm = 0;
        for (var vid in lookups.vacBalByUser) {
            totalVacAvailable += lookups.vacBalByUser[vid];
        }
        for (var vuid in lookups.vacUsedByUser) {
            totalVacUsedFirm += lookups.vacUsedByUser[vuid];
        }
        var totalVacEntitlement = Math.round((totalVacAvailable + totalVacUsedFirm) * 10) / 10;

        // Summary cards
        html += '<div class="dgd-staff-summary">';
        html += DGD.helpers.renderStaffStatCard('Gesamt', employees.length, 'var(--dgd-primary)', '&#128101;');
        html += DGD.helpers.renderStaffStatCard('Aktiv', activeCount, '#22c55e', '&#9989;');
        html += DGD.helpers.renderStaffStatCard('Inaktiv', inactiveCount, '#ef4444', '&#128683;');
        html += DGD.helpers.renderStaffStatCard('Abteilungen', Object.keys(abteilungen).length, '#8b5cf6', '&#127968;');
        html += DGD.helpers.renderStaffStatCard('\u00D8 Anwesenheit', attPctCount > 0 ? (avgAttPct + '%') : '\u2014', '#f59e0b', '&#128337;', '\u226595%');

        var overCapCount = 0;
        for (var capId in lookups.overtimeByUser) {
            if (Math.round((lookups.overtimeByUser[capId].balance || 0) / 3600) >= 200) overCapCount++;
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

        var ts = DGD.demoData.calcTimeSaved();
        html += DGD.helpers.renderStaffStatCard('Eingesparte Zeit', ts.totalH + 'h', '#06b6d4', '&#129302;', ts.weeklyRate + 'h/Woche');

        if (hrMode && DGD.demoData.BETEILIGUNG_CONFIG.enabled && totalOvertimeH > 0) {
            var poolValue = 0;
            for (var eqId in lookups.overtimeByUser) {
                var eqOtH = Math.round((lookups.overtimeByUser[eqId].balance || 0) / 3600);
                if (eqOtH <= 0) continue;
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

        // Leaderboard (HR/Admin only)
        if (hrMode) {
            html += buildLeaderboardCard(employees, lookups.attendByUser, lookups.overtimeByUser, lookups.vacBalByUser, DGD.state.anomalies || []);
        }

        // Company-wide composition bar
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

        // HR Analytics Card (HR/Admin only)
        if (hrMode) {
            html += '<div class="dgd-section-card dgd-section-card--transparent" style="margin-bottom:1.5rem">';
            html += '<div class="dgd-dept-grid">';
            html += buildHRAnalyticsCard(employees);
            html += '</div>';
            html += '</div>';
        }

        // Overtime timeline chart (HR only)
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

        return html;
    };

    // Export async functions for main dispatcher
    DGD.views.mitarbeiter.loadOvertimeTimeline = loadOvertimeTimeline;
    DGD.views.mitarbeiter.runTimesheetAnalysis = runTimesheetAnalysis;
})();
