/* ==========================================================================
   DGD Dashboard - View: Mitarbeiter - Mein Profil Card
   Depends on: mitarbeiter.js (shared utilities)
   ========================================================================== */

(function() {
    'use strict';

    function getShared() {
        return DGD.views.mitarbeiter._shared;
    }

    /* ------------------------------------------------------------------
       Build personal profile card for the logged-in employee.
       ------------------------------------------------------------------ */

    function buildMyProfileCard(myEmp, attendByUser, overtimeByUser, vacBalByUser, vacUsedByUser, anomalies) {
        if (!myEmp || !myEmp.isActive) return '';

        var shared = getShared();
        var OT_CAP = shared.OT_CAP;

        var sc = shared.computeEmployeeScore(myEmp, attendByUser, overtimeByUser, vacBalByUser, anomalies);
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
        h += shared.renderBadges(sc.achievements);
        h += '</div>';

        // Beteiligungsprogramm
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
            var barPct = Math.min(eq.pct / 5 * 100, 100);
            h += '<div class="dgd-equity-card__bar-wrap">';
            h += '<div class="dgd-equity-card__bar"><div class="dgd-equity-card__bar-fill" style="width:' + barPct + '%"></div></div>';
            h += '<div class="dgd-equity-card__bar-labels"><span>0%</span><span>Bewertung: 3,5 Mio. \u20AC</span><span>5%</span></div>';
            h += '</div>';
            h += '</div>';
        }

        // Recommendations
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
        h += '<button class="dgd-my-profile__cortex-btn" onclick="window._requestCortexMyProfileEval()">';
        h += '\uD83E\uDD16 Cortex Empfehlung anfordern';
        h += '</button>';
        h += '<div id="cortex-my-profile-eval" class="dgd-my-profile__cortex-result"></div>';
        h += '</div>';

        h += '</div>';
        return h;
    }

    /* ------------------------------------------------------------------
       Cortex Personal Profile Recommendation (global handler)
       ------------------------------------------------------------------ */

    window._requestCortexMyProfileEval = function() {
        var shared = getShared();
        var OT_CAP = shared.OT_CAP;
        var container = document.getElementById('cortex-my-profile-eval');
        if (!container) return;

        var myEmp = shared.findMyEmployee();
        if (!myEmp) {
            container.innerHTML = '<div class="dgd-my-profile__cortex-error">\u26A0 Kein Mitarbeiter-Profil verkn\u00FCpft.</div>';
            return;
        }

        var attendByUser = {}, overtimeByUser = {}, vacBalByUser = {};
        for (var a = 0; a < (DGD.state.attendance || []).length; a++) {
            if (DGD.state.attendance[a].user) attendByUser[DGD.state.attendance[a].user.id] = DGD.state.attendance[a];
        }
        for (var o = 0; o < (DGD.state.overtime || []).length; o++) {
            if (DGD.state.overtime[o].user) overtimeByUser[DGD.state.overtime[o].user.id] = DGD.state.overtime[o];
        }
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

        var sc = shared.computeEmployeeScore(myEmp, attendByUser, overtimeByUser, vacBalByUser, DGD.state.anomalies || []);
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

        var badgeNames = [];
        for (var b = 0; b < sc.achievements.length; b++) {
            var badge = sc.achievements[b];
            badgeNames.push(badge.icon + ' ' + badge.label + ' (' + (badge.type === 'malus' ? 'Malus' : badge.type === 'bonus' ? 'Bonus' : 'Info') + ')');
        }

        var isLeader = /CEO|GF|Gesch\u00E4ftsf|C-Level|Head|Lead|Director|VP|Leitung/i.test(posName + ' ' + teamName);

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

        var roleContext = '';
        if (isLeader) {
            roleContext = '\n\nWICHTIG: ' + empName + ' ist ' + posName + ' (F\u00FChrungskraft/Gesch\u00E4ftsf\u00FChrer). ' +
                'Niedrige getrackte Anwesenheit bedeutet NICHT, dass die Person nicht arbeitet \u2014 ' +
                'F\u00FChrungskr\u00E4fte arbeiten oft weit \u00FCber die Soll-Stunden hinaus, tracken aber nicht konsequent. ' +
                'Die hohen \u00DCberstunden best\u00E4tigen das. Gib KEINE Tipps wie "komm p\u00FCnktlich zur Arbeit". ' +
                'Fokussiere stattdessen auf: Delegieren, Selbstf\u00FCrsorge, Team-F\u00FChrung, Work-Life-Balance, und strategische Empfehlungen.';
        }

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

        shared.streamCortexSSE(prompt, container, btn);
    };

    /* ------------------------------------------------------------------
       Render Profile Section (called from main dispatcher)
       ------------------------------------------------------------------ */

    DGD.views.mitarbeiter.renderProfile = function(data) {
        var html = '';
        var employees = data.employees;
        var lookups = data.lookups;
        var myEmp = data.myEmp;

        if (myEmp && myEmp.isActive) {
            html += buildMyProfileCard(myEmp, lookups.attendByUser, lookups.overtimeByUser, lookups.vacBalByUser, lookups.vacUsedByUser, DGD.state.anomalies || []);
        } else if (DGD.state.user && employees.length > 0) {
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

        return html;
    };
})();
