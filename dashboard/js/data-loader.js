/* ==========================================================================
   DGD Dashboard - Data Loader Module
   Loads projects, KPIs, invite codes, Tellent HR data
   ========================================================================== */

window.DGD = window.DGD || {};

DGD.dataLoader = (function() {
    'use strict';

    function loadData() {
        if (DGD.state.demoMode) {
            DGD.state.projects = DGD.demoData.DEMO_PROJECTS.slice();
            DGD.state.kpis = DGD.demoData.DEMO_KPIS.slice();
            DGD.state.inviteCodes = DGD.demoData.DEMO_INVITE_CODES.slice();
            // Try loading Tellent data even in demo mode
            loadTellentData();
            return;
        }
        Promise.all([
            dashboardApi.getProjects(),
            dashboardApi.getKpis(),
            dashboardApi.getInviteCodes()
        ]).then(function(results) {
            DGD.state.projects = (results[0] && results[0].projects) ? results[0].projects : DGD.demoData.DEMO_PROJECTS.slice();
            DGD.state.kpis = (results[1] && results[1].kpis) ? results[1].kpis : DGD.demoData.DEMO_KPIS.slice();
            DGD.state.inviteCodes = (results[2] && results[2].codes) ? results[2].codes : DGD.demoData.DEMO_INVITE_CODES.slice();
            DGD.router.route(); // Re-render with loaded data
        });
        loadTellentData();
    }

    /* ------------------------------------------------------------------
       TellentHR Integration
       ------------------------------------------------------------------ */

    function loadTellentData() {
        if (typeof TellentAPI === 'undefined') return;

        TellentAPI.isAvailable(function(available, info) {
            DGD.state.tellentAvailable = available;
            DGD.state.tellentInfo = info;

            if (!available) {
                console.log('[Tellent] API not available:', info.error || 'not configured');
                DGD.router.route(); // Re-render to show status
                return;
            }

            console.log('[Tellent] Connected, ' + info.employeeCount + ' employees');

            // Load employee data for KPI enrichment + Mitarbeiter view
            TellentAPI.getEmployees(function(err, data) {
                if (err) { console.warn('[Tellent] employees error:', err); return; }
                DGD.state.employees = data.employees || [];
                enrichKpisWithTellent('employees', data);
                DGD.router.route(); // Re-render with employee data

                // After employees loaded, fetch attendance for current + previous month
                var now = new Date();
                var firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                var fromDate = firstOfPrevMonth.toISOString().slice(0, 10);
                var toDate = now.toISOString().slice(0, 10);

                TellentAPI.getAttendance(fromDate, toDate, function(err2, attData) {
                    if (err2) { console.warn('[Tellent] attendance error:', err2); return; }
                    DGD.state.attendance = attData.statements || [];
                    console.log('[Tellent] Attendance loaded: ' + DGD.state.attendance.length + ' records');
                    DGD.anomalies.detect();
                    DGD.router.route();
                });
            });

            // Load absence types
            TellentAPI.getAbsences(function(err, data) {
                if (err) { console.warn('[Tellent] absences error:', err); return; }
                DGD.state.absences = data.types || [];
                enrichKpisWithTellent('absences', data);
            });

            // Load time-off balances
            TellentAPI.getTimeOffBalances(function(err, data) {
                if (err) { console.warn('[Tellent] timeoff_balances error:', err); return; }
                DGD.state.timeOffBalances = data.balances || [];
                console.log('[Tellent] TimeOff balances: ' + DGD.state.timeOffBalances.length);
            });

            // Load overtime
            TellentAPI.getOvertime(function(err, data) {
                if (err) { console.warn('[Tellent] overtime error:', err); return; }
                DGD.state.overtime = data.statements || [];
                console.log('[Tellent] Overtime: ' + DGD.state.overtime.length);
            });
        });
    }

    /**
     * Enrich existing KPIs with live Tellent data.
     * Updates the KPI value + prevValue and re-renders if on KPI view.
     */
    function enrichKpisWithTellent(type, data) {
        if (type === 'employees' && data.employees) {
            // Update k6 (Portal-Nutzer) with active employee count
            var activeCount = 0;
            for (var i = 0; i < data.employees.length; i++) {
                if (data.employees[i].status === 'active') activeCount++;
            }
            updateKpiValue('k6', activeCount);
        }

        if (type === 'absences' && data.balances) {
            // Calculate average used days per employee
            var totalUsed = 0;
            var userIds = {};
            for (var j = 0; j < data.balances.length; j++) {
                var b = data.balances[j];
                if (b.user && b.user.id) {
                    if (!userIds[b.user.id]) {
                        userIds[b.user.id] = 0;
                    }
                    userIds[b.user.id] += (b.used || 0);
                    totalUsed += (b.used || 0);
                }
            }
            // Could update a "Abwesenheitsquote" KPI here when added
        }

        // Re-render current view if on dashboard or KPIs
        var hash = window.location.hash.replace('#', '') || 'dashboard';
        if (hash === 'dashboard' || hash === 'kpis') {
            DGD.router.route();
        }
    }

    function updateKpiValue(kpiId, newValue) {
        for (var i = 0; i < DGD.state.kpis.length; i++) {
            if (DGD.state.kpis[i].id === kpiId) {
                // Shift current value to prevValue
                DGD.state.kpis[i].prevValue = DGD.state.kpis[i].value;
                DGD.state.kpis[i].value = newValue;
                DGD.state.kpis[i]._tellent = true; // Mark as live data
                return;
            }
        }
    }

    // Public API
    return {
        loadData: loadData,
        loadTellentData: loadTellentData,
        enrichKpisWithTellent: enrichKpisWithTellent,
        updateKpiValue: updateKpiValue,
    };
})();
