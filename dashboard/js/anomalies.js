/* ==========================================================================
   DGD Dashboard - Anomaly Detection Module
   Detects attendance anomalies from Tellent HR data,
   notifies Cortex about high-severity findings
   ========================================================================== */

window.DGD = window.DGD || {};

DGD.anomalies = (function() {
    'use strict';

    var CORTEX_BASE = (function() {
        var h = window.location.hostname;
        if (h === 'dgd.digital' || h === 'www.dgd.digital') return 'https://cortex.dgd.digital';
        return 'http://localhost:8000';
    })();

    /**
     * Detect anomalies in attendance data.
     * Checks 5 anomaly types:
     *   1. Low attendance (< 60% tracked vs expected)
     *   2. Excessive time-off (> 40% of expected hours)
     *   3. Significant negative balance (< -20h)
     *   4. Very high overtime (> 30h)
     *   5. No tracked time despite expected hours
     */
    function detect() {
        var anomalies = [];
        var attendance = DGD.state.attendance || [];
        var employees = DGD.state.employees || [];

        // Build employee name lookup
        var empMap = {};
        for (var i = 0; i < employees.length; i++) {
            empMap[employees[i].id] = employees[i];
        }

        for (var a = 0; a < attendance.length; a++) {
            var att = attendance[a];
            if (!att.user || !att.user.id) continue;
            var emp = empMap[att.user.id];
            if (!emp || !emp.isActive) continue;

            var empName = att.user.firstName + ' ' + att.user.lastName;
            var expectedH = Math.round((att.expectedTime || 0) / 3600);
            var trackedH = Math.round((att.trackedTime || 0) / 3600);
            var timeOffH = Math.round((att.timeOffTime || 0) / 3600);
            var balanceH = Math.round((att.balance || 0) / 3600);
            var overtimeH = Math.round((att.overtime || 0) / 3600);

            // 1. Very low attendance (< 50% tracked vs expected, excluding time-off)
            var effectiveTracked = trackedH + timeOffH;
            var attPercent = expectedH > 0 ? Math.round(effectiveTracked / expectedH * 100) : 100;
            if (expectedH > 0 && attPercent < 60) {
                anomalies.push({
                    type: 'low_attendance',
                    severity: attPercent < 40 ? 'high' : 'medium',
                    employeeId: att.user.id,
                    employeeName: empName,
                    description: `Niedrige Anwesenheit: ${attPercent}% (${trackedH}h von ${expectedH}h erwartet)`,
                    value: attPercent,
                });
            }

            // 2. Excessive time-off (more than 40% of expected hours)
            var timeOffPercent = expectedH > 0 ? Math.round(timeOffH / expectedH * 100) : 0;
            if (timeOffPercent > 40 && timeOffH > 40) {
                anomalies.push({
                    type: 'excessive_timeoff',
                    severity: timeOffPercent > 60 ? 'high' : 'medium',
                    employeeId: att.user.id,
                    employeeName: empName,
                    description: `Hohe Abwesenheit: ${timeOffH}h (${timeOffPercent}% der Sollzeit)`,
                    value: timeOffPercent,
                });
            }

            // 3. Significant negative balance (underworked by >20h)
            if (balanceH < -20) {
                anomalies.push({
                    type: 'negative_balance',
                    severity: balanceH < -40 ? 'high' : 'medium',
                    employeeId: att.user.id,
                    employeeName: empName,
                    description: `Negativer Saldo: ${balanceH}h (Unterzeit)`,
                    value: balanceH,
                });
            }

            // 4. Very high overtime (>30h) -- could indicate overwork
            if (overtimeH > 30) {
                anomalies.push({
                    type: 'high_overtime',
                    severity: overtimeH > 50 ? 'high' : 'low',
                    employeeId: att.user.id,
                    employeeName: empName,
                    description: `Hohe Ueberstunden: ${overtimeH}h`,
                    value: overtimeH,
                });
            }

            // 5. No tracked time at all despite expected hours
            if (expectedH > 40 && trackedH === 0 && timeOffH === 0) {
                anomalies.push({
                    type: 'no_tracking',
                    severity: 'high',
                    employeeId: att.user.id,
                    employeeName: empName,
                    description: `Keine Zeiterfassung trotz ${expectedH}h Sollzeit`,
                    value: 0,
                });
            }
        }

        // Sort by severity (high first)
        var severityOrder = { high: 0, medium: 1, low: 2 };
        anomalies.sort(function(a, b) {
            return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
        });

        DGD.state.anomalies = anomalies;
        console.log('[Anomaly] Detected ' + anomalies.length + ' anomalies');

        // Notify Cortex about anomalies if there are high-severity ones
        if (anomalies.length > 0) {
            notifyCortex(anomalies);
        }
    }

    /**
     * Send high-severity anomalies to Cortex AI for alerting.
     * Fire-and-forget -- Cortex may be offline.
     */
    function notifyCortex(anomalies) {
        var highSeverity = [];
        for (var i = 0; i < anomalies.length; i++) {
            if (anomalies[i].severity === 'high') highSeverity.push(anomalies[i]);
        }
        if (highSeverity.length === 0) return;

        // Store anomaly report for Cortex to pick up
        var report = {
            timestamp: new Date().toISOString(),
            anomalyCount: anomalies.length,
            highSeverityCount: highSeverity.length,
            items: highSeverity.map(function(a) {
                return { type: a.type, employee: a.employeeName, description: a.description };
            }),
        };

        // Try to send to Cortex via its API (fire-and-forget)
        try {
            var alertLines = highSeverity.map(function(a) {
                return '- ' + a.employeeName + ': ' + a.description;
            }).join('\n');

            fetch(CORTEX_BASE + '/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                body: JSON.stringify({
                    user_message: '[SYSTEM-ALERT: DGD Dashboard Anomalie-Erkennung]\n' +
                        highSeverity.length + ' kritische Anomalien im Mitarbeiter-Tracking erkannt:\n' +
                        alertLines +
                        '\n\nBitte informiere David bei naechster Gelegenheit ueber diese Auffaelligkeiten.',
                    conversation_history: [],
                }),
            }).catch(function() { /* Cortex may be offline */ });
        } catch(e) { /* Cortex may be offline */ }

        console.log('[Anomaly] Sent ' + highSeverity.length + ' high-severity alerts to Cortex');
    }

    // Public API
    return {
        detect: detect,
        notifyCortex: notifyCortex,
    };
})();
