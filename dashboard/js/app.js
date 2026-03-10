/* ==========================================================================
   DGD Dashboard - Main SPA Application
   Auth, routing, views, CRUD modals
   Falls back to DEMO data when API is unavailable
   ========================================================================== */

(function() {
    'use strict';

    /* ======================================================================
       Helpers
       ====================================================================== */

    function escapeHtml(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    function formatDate(iso) {
        if (!iso) return '';
        var parts = iso.split('-');
        if (parts.length !== 3) return iso;
        return parts[2] + '.' + parts[1] + '.' + parts[0];
    }

    function formatCurrency(val) {
        return Number(val).toLocaleString('de-DE');
    }

    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    /* ======================================================================
       State
       ====================================================================== */

    var state = {
        authenticated: false,
        user: null,
        projects: [],
        kpis: [],
        inviteCodes: [],
        isRegisterMode: false,
        demoMode: false,
        tellentAvailable: false,
        tellentInfo: null,
        employees: [],
        absences: [],
        attendance: [],
        timeOffBalances: [],
        overtime: [],
        anomalies: [],
        filters: { category: null, status: null },
    };

    /* ======================================================================
       Demo Data (used when API is unavailable)
       ====================================================================== */

    var DEMO_USER = {
        id: 'demo', username: 'admin', display_name: 'Administrator',
        role: 'admin', email: 'admin@dgd.digital',
    };

    var DEMO_PROJECTS = [
        {
            id: 'p1', title: 'DGD Portal Launch',
            description: 'Kundenportal dgd.digital mit Gutachter-Suche, Schadensmeldung und Partner-Registrierung.',
            category: 'portal', status: 'abgeschlossen', priority: 'hoch',
            start_date: '2026-01-15', end_date: '2026-03-01', progress: 100, owner: 'Daniel',
            tags: 'web,launch',
            milestones: [
                { title: 'Design fertig', date: '2026-01-25', completed: 1 },
                { title: 'Beta-Test', date: '2026-02-15', completed: 1 },
                { title: 'Go-Live', date: '2026-03-01', completed: 1 },
            ],
        },
        {
            id: 'p2', title: 'Partner-Netzwerk Ausbau',
            description: 'Ausbau des Kfz-Sachverstaendigen-Netzwerks auf 50 Partner deutschlandweit.',
            category: 'partner', status: 'aktiv', priority: 'hoch',
            start_date: '2026-02-01', end_date: '2026-06-30', progress: 45, owner: 'Daniel',
            tags: 'partner,growth',
            milestones: [
                { title: '10 Partner', date: '2026-02-28', completed: 1 },
                { title: '25 Partner', date: '2026-04-30', completed: 0 },
                { title: '50 Partner', date: '2026-06-30', completed: 0 },
            ],
        },
        {
            id: 'p3', title: 'Marketing Kampagne Q2',
            description: 'Online-Marketing: Google Ads, Social Media, Content Marketing fuer mehr Sichtbarkeit.',
            category: 'marketing', status: 'geplant', priority: 'mittel',
            start_date: '2026-04-01', end_date: '2026-06-30', progress: 0, owner: 'Marketing',
            tags: 'ads,social',
            milestones: [
                { title: 'Strategie festlegen', date: '2026-04-05', completed: 0 },
                { title: 'Kampagnen live', date: '2026-04-15', completed: 0 },
            ],
        },
        {
            id: 'p4', title: 'Schadenfall-Automatisierung',
            description: 'Automatisierte Schadenfall-Verarbeitung mit KI-gestuetzter Dokumentenanalyse.',
            category: 'intern', status: 'aktiv', priority: 'mittel',
            start_date: '2026-03-01', end_date: '2026-08-31', progress: 20, owner: 'Tech-Team',
            tags: 'ai,automation',
            milestones: [
                { title: 'Konzept', date: '2026-03-15', completed: 1 },
                { title: 'Prototyp', date: '2026-05-31', completed: 0 },
            ],
        },
        {
            id: 'p5', title: 'Kundenportal v2',
            description: 'Erweiterung: Kunden-Login, Echtzeit-Status, Dokumenten-Upload, Chat.',
            category: 'portal', status: 'geplant', priority: 'niedrig',
            start_date: '2026-07-01', end_date: '2026-12-31', progress: 0, owner: 'Tech-Team',
            tags: 'web,portal',
            milestones: [
                { title: 'Anforderungen', date: '2026-07-15', completed: 0 },
                { title: 'MVP', date: '2026-10-01', completed: 0 },
            ],
        },
    ];

    var DEMO_KPIS = [
        { id: 'k1', name: 'Schadensfaelle / Monat', category: 'kunden', value: 47, unit: 'Faelle', target: 100, trend: 'up', icon: '\ud83d\udccb',
          prevValue: 38, daily: [31,33,35,32,34,36,38,37,39,40,38,41,43,42,44,45,43,44,46,45,44,46,47,45,46,48,47,47], monthly: [{label:'Dez',value:32},{label:'Jan',value:38},{label:'Feb',value:45}] },
        { id: 'k2', name: 'Partner aktiv', category: 'partner', value: 12, unit: 'Partner', target: 50, trend: 'up', icon: '\ud83d\udc65',
          prevValue: 9, daily: [7,7,7,8,8,8,8,9,9,9,9,9,10,10,10,10,10,11,11,11,11,11,12,12,12,12,12,12], monthly: [{label:'Dez',value:7},{label:'Jan',value:9},{label:'Feb',value:11}] },
        { id: 'k3', name: 'Umsatz Q1', category: 'umsatz', value: 28500, unit: '\u20ac', target: 50000, trend: 'up', icon: '\ud83d\udcb0',
          prevValue: 22000, daily: [800,850,920,780,950,1020,1050,980,1100,1080,950,1150,1200,1100,1250,1180,1050,1100,1300,1250,1180,1220,1350,1280,1200,1300,1400,1350], monthly: [{label:'Dez',value:18500},{label:'Jan',value:22000},{label:'Feb',value:26200}] },
        { id: 'k4', name: 'Portal-Besucher / Monat', category: 'portal', value: 1250, unit: 'Besucher', target: 5000, trend: 'up', icon: '\ud83c\udf10',
          prevValue: 980, daily: [32,35,38,28,42,45,48,40,52,55,50,48,58,62,55,50,60,65,58,52,62,68,60,55,65,70,62,58], monthly: [{label:'Dez',value:720},{label:'Jan',value:980},{label:'Feb',value:1180}] },
        { id: 'k5', name: 'Conversion Rate', category: 'portal', value: 3.2, unit: '%', target: 5, trend: 'stable', icon: '\ud83d\udcca',
          prevValue: 3.1, daily: [2.8,2.9,3.0,2.7,3.1,3.2,3.0,2.9,3.3,3.1,3.0,3.2,3.4,3.1,3.0,3.3,3.2,3.1,3.4,3.2,3.0,3.3,3.5,3.2,3.1,3.3,3.2,3.2], monthly: [{label:'Dez',value:2.8},{label:'Jan',value:3.1},{label:'Feb',value:3.2}] },
        { id: 'k6', name: 'Durchschn. Gutachten-Wert', category: 'kunden', value: 2800, unit: '\u20ac', target: 3000, trend: 'up', icon: '\ud83d\udd0d',
          prevValue: 2650, daily: [2500,2550,2600,2480,2650,2700,2680,2600,2750,2720,2650,2780,2800,2700,2750,2820,2780,2700,2850,2800,2750,2820,2880,2800,2780,2850,2820,2800], monthly: [{label:'Dez',value:2450},{label:'Jan',value:2650},{label:'Feb',value:2780}] },
        { id: 'k7', name: 'Partner-Bewerbungen', category: 'partner', value: 8, unit: 'Bewerbungen', target: 20, trend: 'up', icon: '\ud83d\udcdd',
          prevValue: 5, daily: [0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,1,0,0,1,0,0,0,1,0,0,1,0,1], monthly: [{label:'Dez',value:3},{label:'Jan',value:5},{label:'Feb',value:7}] },
        { id: 'k8', name: 'Kundenzufriedenheit', category: 'kunden', value: 4.7, unit: '/ 5', target: 4.8, trend: 'stable', icon: '\u2b50',
          prevValue: 4.6, daily: [4.5,4.5,4.6,4.4,4.6,4.7,4.6,4.5,4.7,4.7,4.6,4.7,4.8,4.7,4.6,4.7,4.8,4.7,4.7,4.8,4.7,4.6,4.7,4.8,4.7,4.7,4.8,4.7], monthly: [{label:'Dez',value:4.4},{label:'Jan',value:4.6},{label:'Feb',value:4.7}] },
        { id: 'k9', name: 'Gutachten / Partner / Monat', category: 'engagement', value: 3.8, unit: 'Gutachten', target: 6, trend: 'up', icon: '\ud83d\udd04',
          prevValue: 3.2, daily: [2.9,3.0,3.1,3.0,3.2,3.3,3.1,3.2,3.4,3.3,3.2,3.4,3.5,3.3,3.4,3.6,3.5,3.4,3.6,3.7,3.5,3.6,3.8,3.7,3.6,3.8,3.9,3.8], monthly: [{label:'Dez',value:2.8},{label:'Jan',value:3.2},{label:'Feb',value:3.6}] },
        { id: 'k10', name: 'Partner Retention Rate', category: 'engagement', value: 78, unit: '%', target: 90, trend: 'up', icon: '\ud83d\udd01',
          prevValue: 72, daily: [68,69,70,69,71,72,71,70,72,73,72,73,74,73,74,75,74,75,76,75,76,77,76,77,78,77,78,78], monthly: [{label:'Dez',value:65},{label:'Jan',value:72},{label:'Feb',value:76}] },
        { id: 'k11', name: 'Durchlaufzeit Auszahlung', category: 'engagement', value: 12, unit: 'Tage', target: 7, trend: 'down', icon: '\u23f1\ufe0f',
          prevValue: 15, invertTrend: true, daily: [18,17,17,16,16,16,15,15,15,14,14,14,14,13,13,13,13,13,12,12,12,12,12,12,12,12,12,12], monthly: [{label:'Dez',value:21},{label:'Jan',value:15},{label:'Feb',value:13}] },
        { id: 'k12', name: 'Lifetime Value / Partner', category: 'engagement', value: 8400, unit: '\u20ac', target: 15000, trend: 'up', icon: '\ud83d\udc8e',
          prevValue: 7200, daily: [6800,6850,6900,6950,7000,7050,7100,7100,7200,7250,7300,7350,7400,7500,7550,7600,7700,7750,7800,7850,7900,8000,8050,8100,8150,8200,8300,8400], monthly: [{label:'Dez',value:6200},{label:'Jan',value:7200},{label:'Feb',value:8100}] },
    ];

    // --- Beteiligungsprogramm Config ---
    var BETEILIGUNG_CONFIG = {
        enabled: true,
        companyValuation: 3500000,
        currency: 'EUR',
        valuationDate: '2026-03-01',
        hourlyRates: {
            'CEO': 85, 'COO': 75,
            'Leiter Schadenmanagement': 55, 'Gutachter': 50,
            'Sachbearbeiter': 40, 'Prompt Engineer': 45, 'Inbound': 35
        },
        defaultHourlyRate: 40
    };

    function getHourlyRate(positionName) {
        if (!positionName) return BETEILIGUNG_CONFIG.defaultHourlyRate;
        for (var key in BETEILIGUNG_CONFIG.hourlyRates) {
            if (positionName.toLowerCase().indexOf(key.toLowerCase()) !== -1) {
                return BETEILIGUNG_CONFIG.hourlyRates[key];
            }
        }
        return BETEILIGUNG_CONFIG.defaultHourlyRate;
    }

    function calcEquity(overtimeH, positionName) {
        var rate = getHourlyRate(positionName);
        var value = Math.max(0, overtimeH) * rate;
        var pct = (value / BETEILIGUNG_CONFIG.companyValuation) * 100;
        return { rate: rate, value: value, pct: pct };
    }

    // --- TimeSaved Config ---
    var TIMESAVED_CONFIG = {
        features: [
            { id: 'anomaly-detection', name: 'Anomalie-Erkennung', hoursPerWeek: 2.0, activeFrom: '2025-03-01' },
            { id: 'auto-reports', name: 'Automatische Berichte', hoursPerWeek: 3.0, activeFrom: '2025-06-01' },
            { id: 'smart-search', name: 'Intelligente Suche', hoursPerWeek: 1.5, activeFrom: '2025-09-01' },
            { id: 'cortex-hr-analysis', name: 'Cortex HR-Analyse', hoursPerWeek: 2.5, activeFrom: '2026-01-01' }
        ],
        developerCompensationPct: 10
    };

    function calcTimeSaved() {
        var now = new Date();
        var totalH = 0;
        var activeFeatures = 0;
        var weeklyRate = 0;
        for (var i = 0; i < TIMESAVED_CONFIG.features.length; i++) {
            var f = TIMESAVED_CONFIG.features[i];
            var from = new Date(f.activeFrom);
            if (from > now) continue;
            activeFeatures++;
            weeklyRate += f.hoursPerWeek;
            var weeks = Math.max(0, (now - from) / (7 * 24 * 60 * 60 * 1000));
            totalH += Math.round(weeks * f.hoursPerWeek * 10) / 10;
        }
        return { totalH: Math.round(totalH), activeFeatures: activeFeatures, weeklyRate: weeklyRate };
    }

    var DEMO_INVITE_CODES = [
        { id: 'ic1', code: 'DEMO-CODE-1', created_by: null, used_by: null, expires_at: '2026-12-31' },
        { id: 'ic2', code: 'DEMO-CODE-2', created_by: null, used_by: null, expires_at: '2026-12-31' },
    ];

    /* ======================================================================
       Auth
       ====================================================================== */

    function checkAuth() {
        dashboardApi.me().then(function(data) {
            if (data && data.user) {
                loginSuccess(data.user);
            } else {
                // API unavailable -- enter demo mode
                enterDemoMode();
            }
        }).catch(function() {
            enterDemoMode();
        });
    }

    function enterDemoMode() {
        state.demoMode = true;
        loginSuccess(DEMO_USER);
    }

    function loginSuccess(user) {
        state.authenticated = true;
        state.user = user;
        $('#login-page').classList.add('dgd-hidden');
        $('#app-shell').classList.remove('dgd-hidden');
        $('#topbar-username').textContent = user.display_name || user.username;
        loadData();
        route();
        // Init Cortex Chat widget
        if (typeof CortexChat !== 'undefined') {
            CortexChat.init(user);
        }
    }

    function logout() {
        if (!state.demoMode) {
            dashboardApi.logout();
        }
        state.authenticated = false;
        state.user = null;
        state.demoMode = false;
        $('#app-shell').classList.add('dgd-hidden');
        $('#login-page').classList.remove('dgd-hidden');
        if (typeof CortexChat !== 'undefined') {
            CortexChat.destroy();
        }
    }

    function handleLoginSubmit(e) {
        e.preventDefault();
        var username = $('#auth-username').value.trim();
        var password = $('#auth-password').value;
        var errorEl = $('#auth-error');
        errorEl.classList.add('dgd-hidden');

        if (state.isRegisterMode) {
            var email = $('#auth-email').value.trim();
            var displayName = $('#auth-displayname').value.trim();
            var code = $('#auth-invite-code').value.trim();
            dashboardApi.register({
                username: username, password: password,
                email: email, display_name: displayName, invite_code: code,
            }).then(function(data) {
                if (data && data.user) {
                    loginSuccess(data.user);
                } else {
                    // Fallback to demo
                    enterDemoMode();
                }
            }).catch(function(err) {
                errorEl.textContent = err.message || 'Registrierung fehlgeschlagen';
                errorEl.classList.remove('dgd-hidden');
            });
        } else {
            dashboardApi.login(username, password).then(function(data) {
                if (data && data.user) {
                    loginSuccess(data.user);
                } else {
                    // API unavailable - demo mode
                    enterDemoMode();
                }
            }).catch(function(err) {
                errorEl.textContent = err.message || 'Anmeldung fehlgeschlagen';
                errorEl.classList.remove('dgd-hidden');
            });
        }
    }

    function toggleAuthMode(e) {
        e.preventDefault();
        state.isRegisterMode = !state.isRegisterMode;
        var isReg = state.isRegisterMode;
        $('#auth-title').textContent = isReg ? 'Registrieren' : 'Anmelden';
        $('#auth-subtitle').textContent = isReg
            ? 'Konto mit Einladungscode erstellen'
            : 'Internes Dashboard fuer DGD-Mitarbeiter';
        $('#auth-email-group').style.display = isReg ? '' : 'none';
        $('#auth-displayname-group').style.display = isReg ? '' : 'none';
        $('#auth-code-group').style.display = isReg ? '' : 'none';
        $('#auth-submit').textContent = isReg ? 'Registrieren' : 'Anmelden';
        $('#auth-toggle').textContent = isReg
            ? 'Bereits registriert? Anmelden'
            : 'Mit Einladungscode registrieren';
        $('#auth-error').classList.add('dgd-hidden');
    }

    /* ======================================================================
       Data Loading
       ====================================================================== */

    function loadData() {
        if (state.demoMode) {
            state.projects = DEMO_PROJECTS.slice();
            state.kpis = DEMO_KPIS.slice();
            state.inviteCodes = DEMO_INVITE_CODES.slice();
            // Try loading Tellent data even in demo mode
            loadTellentData();
            return;
        }
        Promise.all([
            dashboardApi.getProjects(),
            dashboardApi.getKpis(),
            dashboardApi.getInviteCodes()
        ]).then(function(results) {
            state.projects = (results[0] && results[0].projects) ? results[0].projects : DEMO_PROJECTS.slice();
            state.kpis = (results[1] && results[1].kpis) ? results[1].kpis : DEMO_KPIS.slice();
            state.inviteCodes = (results[2] && results[2].codes) ? results[2].codes : DEMO_INVITE_CODES.slice();
            route(); // Re-render with loaded data
        });
        loadTellentData();
    }

    /* ------------------------------------------------------------------
       TellentHR Integration
       ------------------------------------------------------------------ */

    function loadTellentData() {
        if (typeof TellentAPI === 'undefined') return;

        TellentAPI.isAvailable(function(available, info) {
            state.tellentAvailable = available;
            state.tellentInfo = info;

            if (!available) {
                console.log('[Tellent] API not available:', info.error || 'not configured');
                route(); // Re-render to show status
                return;
            }

            console.log('[Tellent] Connected, ' + info.employeeCount + ' employees');

            // Load employee data for KPI enrichment + Mitarbeiter view
            TellentAPI.getEmployees(function(err, data) {
                if (err) { console.warn('[Tellent] employees error:', err); return; }
                state.employees = data.employees || [];
                enrichKpisWithTellent('employees', data);
                route(); // Re-render with employee data

                // After employees loaded, fetch attendance for current + previous month
                var now = new Date();
                var firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                var fromDate = firstOfPrevMonth.toISOString().slice(0, 10);
                var toDate = now.toISOString().slice(0, 10);

                TellentAPI.getAttendance(fromDate, toDate, function(err2, attData) {
                    if (err2) { console.warn('[Tellent] attendance error:', err2); return; }
                    state.attendance = attData.statements || [];
                    console.log('[Tellent] Attendance loaded: ' + state.attendance.length + ' records');
                    detectAnomalies();
                    route();
                });
            });

            // Load absence types
            TellentAPI.getAbsences(function(err, data) {
                if (err) { console.warn('[Tellent] absences error:', err); return; }
                state.absences = data.types || [];
                enrichKpisWithTellent('absences', data);
            });

            // Load time-off balances
            TellentAPI.getTimeOffBalances(function(err, data) {
                if (err) { console.warn('[Tellent] timeoff_balances error:', err); return; }
                state.timeOffBalances = data.balances || [];
                console.log('[Tellent] TimeOff balances: ' + state.timeOffBalances.length);
            });

            // Load overtime
            TellentAPI.getOvertime(function(err, data) {
                if (err) { console.warn('[Tellent] overtime error:', err); return; }
                state.overtime = data.statements || [];
                console.log('[Tellent] Overtime: ' + state.overtime.length);
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
            route();
        }
    }

    function updateKpiValue(kpiId, newValue) {
        for (var i = 0; i < state.kpis.length; i++) {
            if (state.kpis[i].id === kpiId) {
                // Shift current value to prevValue
                state.kpis[i].prevValue = state.kpis[i].value;
                state.kpis[i].value = newValue;
                state.kpis[i]._tellent = true; // Mark as live data
                return;
            }
        }
    }

    /* ======================================================================
       Router
       ====================================================================== */

    function route() {
        if (!state.authenticated) return;
        var hash = window.location.hash.replace('#', '') || 'dashboard';
        var validViews = ['dashboard', 'timeline', 'kpis', 'mitarbeiter', 'finanzen', 'ziele', 'feedback', 'showcase', 'settings'];
        if (validViews.indexOf(hash) === -1) hash = 'dashboard';

        // Update sidebar active state
        var links = $$('.dgd-sidebar__link');
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            if (link.getAttribute('data-view') === hash) {
                link.classList.add('dgd-sidebar__link--active');
            } else {
                link.classList.remove('dgd-sidebar__link--active');
            }
        }

        // Update topbar title
        var titles = {
            dashboard: 'Dashboard',
            timeline: 'Zeitleiste',
            kpis: 'KPI Cockpit',
            mitarbeiter: 'Mitarbeiter',
            finanzen: 'Finanzen',
            ziele: 'Ziele & OKR',
            feedback: 'Feedback',
            showcase: 'Showcase Builder',
            settings: 'Einstellungen',
        };
        $('#topbar-title').textContent = titles[hash] || 'Dashboard';

        // Render view
        var content = $('#main-content');
        switch (hash) {
            case 'dashboard':    renderDashboard(content);    break;
            case 'timeline':     renderTimeline(content);     break;
            case 'kpis':         renderKpis(content);         break;
            case 'mitarbeiter':  renderMitarbeiter(content);  break;
            case 'finanzen':     renderFinanzen(content);     break;
            case 'ziele':        renderZiele(content);        break;
            case 'feedback':     renderFeedback(content);     break;
            case 'showcase':     renderShowcase(content);     break;
            case 'settings':     renderSettings(content);     break;
        }

        // Close mobile sidebar
        $('#sidebar').classList.remove('dgd-sidebar--open');
    }

    /* ======================================================================
       View: Dashboard
       ====================================================================== */

    function renderDashboard(container) {
        // Pick top 4 KPIs for the overview, prioritize key categories
        var priorityOrder = ['kunden', 'partner', 'umsatz', 'portal'];
        var sorted = state.kpis.slice().sort(function(a, b) {
            var ai = priorityOrder.indexOf(a.category);
            var bi = priorityOrder.indexOf(b.category);
            if (ai === -1) ai = 99;
            if (bi === -1) bi = 99;
            return ai - bi;
        });
        var topKpis = sorted.slice(0, 4);

        var html = '';

        // KPI row
        html += '<div class="dgd-kpi-grid" style="margin-bottom:2rem;">';
        for (var k = 0; k < topKpis.length; k++) {
            html += renderKpiCard(topKpis[k]);
        }
        html += '</div>';

        // Business summary row (Goals + Finance + Pulse)
        html += '<div class="dgd-dashboard-biz-row">';

        // Goals summary card
        var gStats = { on_track: 0, at_risk: 0, behind: 0 };
        for (var gi = 0; gi < DEMO_GOALS.length; gi++) {
            var gs = DEMO_GOALS[gi].status;
            if (gs === 'on_track') gStats.on_track++;
            else if (gs === 'at_risk') gStats.at_risk++;
            else if (gs === 'behind') gStats.behind++;
        }
        html += '<div class="dgd-section-card" style="animation-delay:0.25s;flex:1;min-width:200px;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
        html += ' Ziele</div>';
        html += '<div style="display:flex;gap:1rem;margin-bottom:0.5rem;">';
        html += '<div style="text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:#27ae60;">' + gStats.on_track + '</div><div style="font-size:0.7rem;color:var(--dgd-gray-500);">On Track</div></div>';
        html += '<div style="text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:#f39c12;">' + gStats.at_risk + '</div><div style="font-size:0.7rem;color:var(--dgd-gray-500);">At Risk</div></div>';
        html += '<div style="text-align:center;"><div style="font-size:1.5rem;font-weight:700;color:#e74c3c;">' + gStats.behind + '</div><div style="font-size:0.7rem;color:var(--dgd-gray-500);">Behind</div></div>';
        html += '</div>';
        html += '<a href="#ziele" class="dgd-section-card__link">Alle Ziele &rarr;</a>';
        html += '</div>';

        // Finance mini-card
        var fin = DEMO_FINANCE.summary;
        html += '<div class="dgd-section-card" style="animation-delay:0.3s;flex:1;min-width:200px;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>';
        html += ' Finanzen (Monat)</div>';
        html += '<div style="display:flex;flex-direction:column;gap:0.5rem;font-size:var(--dgd-font-size-sm);">';
        html += '<div style="display:flex;justify-content:space-between;"><span style="color:var(--dgd-gray-600);">Umsatz</span><span style="font-weight:700;color:#27ae60;">' + formatCurrency(fin.revenue) + ' \u20ac</span></div>';
        html += '<div style="display:flex;justify-content:space-between;"><span style="color:var(--dgd-gray-600);">Kosten</span><span style="font-weight:700;color:#e74c3c;">' + formatCurrency(fin.costs) + ' \u20ac</span></div>';
        html += '<div style="display:flex;justify-content:space-between;border-top:1px solid var(--dgd-gray-200);padding-top:0.35rem;"><span style="font-weight:600;">Gewinn</span><span style="font-weight:700;color:#27ae60;">' + formatCurrency(fin.profit) + ' \u20ac</span></div>';
        html += '</div>';
        html += '<a href="#finanzen" class="dgd-section-card__link">Details &rarr;</a>';
        html += '</div>';

        // Latest pulse score
        var latestPulse = DEMO_FEEDBACK.trends[DEMO_FEEDBACK.trends.length - 1];
        var pulseAvg = ((latestPulse.satisfaction + latestPulse.workload + latestPulse.teamspirit) / 3).toFixed(1);
        html += '<div class="dgd-section-card" style="animation-delay:0.35s;flex:1;min-width:200px;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
        html += ' Pulse Score</div>';
        html += '<div style="text-align:center;margin:0.5rem 0;">';
        html += '<div style="font-size:2rem;font-weight:700;color:#3498db;">' + pulseAvg + '<span style="font-size:1rem;color:var(--dgd-gray-500);"> / 5</span></div>';
        html += '<div style="font-size:0.75rem;color:var(--dgd-gray-500);">Durchschnitt ' + escapeHtml(latestPulse.week) + '</div>';
        html += '</div>';
        html += '<a href="#feedback" class="dgd-section-card__link">Feedback &rarr;</a>';
        html += '</div>';

        html += '</div>';

        // Projects section
        html += '<div class="dgd-section-card" style="animation-delay:0.4s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
        html += ' Aktuelle Projekte</div>';
        html += '<div id="dashboard-timeline"></div>';
        html += '<a href="#timeline" class="dgd-section-card__link">Alle Projekte anzeigen &rarr;</a>';
        html += '</div>';

        container.innerHTML = html;

        // Render compact timeline (last 5 projects)
        var recentProjects = state.projects.slice(0, 5);
        var timelineContainer = document.getElementById('dashboard-timeline');
        if (timelineContainer) {
            Timeline.render(timelineContainer, recentProjects, {
                compact: true,
                onProjectClick: function(id) {
                    openProjectModal(id);
                },
            });
        }
    }

    /* ======================================================================
       View: Timeline
       ====================================================================== */

    function renderTimeline(container) {
        var html = '';

        // Page header
        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Zeitleiste</h1>';
        html += '<div class="dgd-page-header__actions">';
        html += '<button class="dgd-btn dgd-btn--primary" id="btn-new-project">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        html += ' Neues Projekt</button>';
        html += '</div></div>';

        // Filter row
        html += '<div class="dgd-filter-row" id="filter-row">';
        html += renderFilterPills();
        html += '</div>';

        // Gantt chart
        html += '<div id="gantt-container" class="dgd-gantt-wrapper"></div>';

        // Timeline container
        html += '<div id="timeline-container"></div>';

        container.innerHTML = html;

        // Bind new project button
        var btnNew = document.getElementById('btn-new-project');
        if (btnNew) {
            btnNew.addEventListener('click', function() { openProjectModal(null); });
        }

        // Bind filter pills
        bindFilterPills();

        // Render timeline
        renderFilteredTimeline();

        // Render gantt
        var ganttEl = document.getElementById('gantt-container');
        if (ganttEl) {
            Gantt.render(ganttEl, state.projects, {
                onProjectClick: function(id) { openProjectModal(id); },
            });
        }
    }

    function renderFilterPills() {
        var categories = [
            { key: null, label: 'Alle' },
            { key: 'portal', label: 'Portal' },
            { key: 'marketing', label: 'Marketing' },
            { key: 'partner', label: 'Partner' },
            { key: 'intern', label: 'Intern' },
            { key: 'kunde', label: 'Kunde' },
        ];
        var statuses = [
            { key: null, label: 'Alle Status' },
            { key: 'aktiv', label: 'Aktiv' },
            { key: 'geplant', label: 'Geplant' },
            { key: 'abgeschlossen', label: 'Abgeschlossen' },
            { key: 'pausiert', label: 'Pausiert' },
        ];

        var html = '';
        for (var i = 0; i < categories.length; i++) {
            var c = categories[i];
            var active = state.filters.category === c.key ? ' dgd-filter-pill--active' : '';
            html += '<button class="dgd-filter-pill' + active + '" data-filter-type="category" data-filter-value="' + (c.key || '') + '">' + escapeHtml(c.label) + '</button>';
        }
        html += '<span style="width:1px;background:var(--dgd-gray-300);margin:0 0.25rem;"></span>';
        for (var j = 0; j < statuses.length; j++) {
            var s = statuses[j];
            var activeS = state.filters.status === s.key ? ' dgd-filter-pill--active' : '';
            html += '<button class="dgd-filter-pill' + activeS + '" data-filter-type="status" data-filter-value="' + (s.key || '') + '">' + escapeHtml(s.label) + '</button>';
        }
        return html;
    }

    function bindFilterPills() {
        var pills = $$('.dgd-filter-pill');
        for (var i = 0; i < pills.length; i++) {
            (function(pill) {
                pill.addEventListener('click', function() {
                    var type = pill.getAttribute('data-filter-type');
                    var value = pill.getAttribute('data-filter-value') || null;
                    state.filters[type] = value;

                    // Update active states within same type
                    var siblings = $$('.dgd-filter-pill[data-filter-type="' + type + '"]');
                    for (var j = 0; j < siblings.length; j++) {
                        siblings[j].classList.remove('dgd-filter-pill--active');
                    }
                    pill.classList.add('dgd-filter-pill--active');

                    renderFilteredTimeline();
                });
            })(pills[i]);
        }
    }

    function renderFilteredTimeline() {
        var filtered = state.projects.slice();
        if (state.filters.category) {
            filtered = filtered.filter(function(p) { return p.category === state.filters.category; });
        }
        if (state.filters.status) {
            filtered = filtered.filter(function(p) { return p.status === state.filters.status; });
        }

        var timelineEl = document.getElementById('timeline-container');
        if (timelineEl) {
            Timeline.render(timelineEl, filtered, {
                compact: false,
                onProjectClick: function(id) {
                    openProjectModal(id);
                },
            });
        }

        var ganttEl = document.getElementById('gantt-container');
        if (ganttEl) {
            Gantt.render(ganttEl, filtered, {
                onProjectClick: function(id) { openProjectModal(id); },
            });
        }
    }

    /* ======================================================================
       View: KPI Cockpit
       ====================================================================== */

    function renderKpis(container) {
        var html = '';
        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">KPI Cockpit</h1>';
        html += '</div>';

        html += '<div class="dgd-kpi-grid">';
        for (var i = 0; i < state.kpis.length; i++) {
            html += renderKpiCard(state.kpis[i]);
        }
        html += '</div>';

        container.innerHTML = html;
    }

    var CATEGORY_COLORS = {
        umsatz: '#27ae60', kunden: '#2980b9', partner: '#e67e22',
        portal: '#8e44ad', marketing: '#e74c3c', engagement: '#16a085',
    };

    function renderSparkline(values, color, id, target) {
        var w = 200, h = 40, pad = 2;
        var min = Math.min.apply(null, values);
        var max = Math.max.apply(null, values);
        // Include target in range if present
        if (target != null) {
            if (target < min) min = target;
            if (target > max) max = target;
        }
        var range = max - min || 1;
        var points = [];
        for (var i = 0; i < values.length; i++) {
            var x = pad + (i / (values.length - 1)) * (w - 2 * pad);
            var y = h - pad - ((values[i] - min) / range) * (h - 2 * pad);
            points.push(x.toFixed(1) + ',' + y.toFixed(1));
        }
        var polyline = points.join(' ');
        var fillPoints = pad + ',' + h + ' ' + polyline + ' ' + (w - pad) + ',' + h;
        var svg = '<svg class="dgd-kpi-card__sparkline" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
            '<defs><linearGradient id="sg-' + id + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.3"/>' +
            '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.02"/>' +
            '</linearGradient></defs>' +
            '<polygon points="' + fillPoints + '" fill="url(#sg-' + id + ')"/>' +
            '<polyline points="' + polyline + '" fill="none" stroke="' + color + '" stroke-width="1.5"/>';
        // Target threshold line
        if (target != null) {
            var targetY = h - pad - ((target - min) / range) * (h - 2 * pad);
            svg += '<line x1="' + pad + '" y1="' + targetY.toFixed(1) + '" x2="' + (w - pad) + '" y2="' + targetY.toFixed(1) + '" stroke="#e74c3c" stroke-width="0.8" stroke-dasharray="4,3" opacity="0.6"/>';
        }
        svg += '</svg>';
        return svg;
    }

    var FA_TO_EMOJI = {
        'fa-file-alt': '\ud83d\udccb', 'fa-handshake': '\ud83e\udd1d', 'fa-euro-sign': '\ud83d\udcb0',
        'fa-chart-line': '\ud83c\udf10', 'fa-percentage': '\ud83d\udcca', 'fa-calculator': '\ud83e\uddee',
        'fa-user-plus': '\ud83d\udc65', 'fa-star': '\u2b50'
    };

    function renderKpiCard(kpi) {
        var catClass = 'dgd-kpi-card--' + escapeHtml(kpi.category || '');
        var pct = kpi.target ? Math.min(100, Math.round((kpi.value / kpi.target) * 100)) : 0;
        var displayValue = kpi.unit === '\u20ac' ? formatCurrency(kpi.value) : kpi.value;
        var color = CATEGORY_COLORS[kpi.category] || '#6c757d';
        var icon = kpi.icon || '';
        if (FA_TO_EMOJI[icon]) icon = FA_TO_EMOJI[icon];

        // Alert thresholds
        var alertLevel = ''; // '', 'warning', 'critical'
        if (kpi.target) {
            if (kpi.invertTrend) {
                // Lower is better (e.g. Durchlaufzeit): alert when far above target
                if (kpi.value > kpi.target * 1.5) alertLevel = 'critical';
                else if (kpi.value > kpi.target * 1.2) alertLevel = 'warning';
            } else {
                // Higher is better: alert when far below target
                if (pct < 40) alertLevel = 'critical';
                else if (pct < 60) alertLevel = 'warning';
            }
        }

        // Delta calculation
        var delta = kpi.value - (kpi.prevValue != null ? kpi.prevValue : kpi.value);
        var deltaPct = kpi.prevValue ? (Math.abs(delta / kpi.prevValue) * 100).toFixed(1) : '0.0';
        var deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';
        if (kpi.invertTrend) {
            deltaClass = delta < 0 ? 'up' : delta > 0 ? 'down' : 'stable';
        }
        var deltaSign = delta > 0 ? '+' : delta < 0 ? '-' : '';
        var absDelta = Math.abs(delta);
        var deltaDisplay;
        if (kpi.unit === '\u20ac') {
            deltaDisplay = formatCurrency(absDelta);
        } else if (kpi.unit === '%' || kpi.unit === '/ 5') {
            deltaDisplay = absDelta.toFixed(1);
        } else if (absDelta !== Math.round(absDelta)) {
            deltaDisplay = absDelta.toFixed(1);
        } else {
            deltaDisplay = absDelta;
        }

        var alertClass = alertLevel ? ' dgd-kpi-card--alert-' + alertLevel : '';
        var html = '<div class="dgd-kpi-card ' + catClass + alertClass + '">';

        // Header: icon + label + alert indicator
        html += '<div class="dgd-kpi-card__header">';
        html += '<span class="dgd-kpi-card__icon">' + icon + '</span>';
        html += '<span class="dgd-kpi-card__label">' + escapeHtml(kpi.name) + '</span>';
        if (alertLevel) {
            var bellColor = alertLevel === 'critical' ? '#e74c3c' : '#f39c12';
            html += '<svg class="dgd-kpi-card__alert-icon" width="14" height="14" viewBox="0 0 24 24" fill="' + bellColor + '" stroke="none"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';
        }
        if (kpi._tellent) {
            html += '<span class="dgd-kpi-card__live">LIVE</span>';
        }
        html += '</div>';

        // Value + Delta row
        html += '<div class="dgd-kpi-card__value-row">';
        html += '<span class="dgd-kpi-card__value">' + escapeHtml(String(displayValue));
        html += '<span class="dgd-kpi-card__unit">' + escapeHtml(kpi.unit) + '</span></span>';
        html += '<span class="dgd-kpi-card__delta dgd-kpi-card__delta--' + deltaClass + '">';
        html += deltaSign + deltaDisplay + ' (' + deltaSign + deltaPct + '%)';
        html += '</span>';
        html += '</div>';

        // Sparkline (28-day trend) with target threshold line
        if (kpi.daily && kpi.daily.length > 0) {
            html += renderSparkline(kpi.daily, color, kpi.id, kpi.target || null);
        }

        // Monthly values
        if (kpi.monthly && kpi.monthly.length > 0) {
            html += '<div class="dgd-kpi-card__monthly">';
            for (var m = 0; m < kpi.monthly.length; m++) {
                var mon = kpi.monthly[m];
                var monVal = kpi.unit === '\u20ac' ? formatCurrency(mon.value) : mon.value;
                html += '<div class="dgd-kpi-card__monthly-item">';
                html += '<span class="dgd-kpi-card__monthly-label">' + escapeHtml(mon.label) + '</span>';
                html += '<span class="dgd-kpi-card__monthly-val">' + escapeHtml(String(monVal)) + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        // Target progress bar
        if (kpi.target) {
            html += '<div class="dgd-kpi-card__target">';
            html += '<div class="dgd-kpi-card__target-bar"><div class="dgd-kpi-card__target-fill" style="width:' + pct + '%"></div></div>';
            html += '<div class="dgd-kpi-card__target-text"><span>' + pct + '% erreicht</span><span>Ziel: ' + escapeHtml(String(kpi.target)) + ' ' + escapeHtml(kpi.unit) + '</span></div>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /* ======================================================================
       View: Mitarbeiter (TellentHR) — Helpers
       ====================================================================== */

    function attPctColor(pct) {
        return pct >= 90 ? '#22c55e' : (pct >= 70 ? '#f59e0b' : '#ef4444');
    }

    function overtimeColor(h) {
        return h > 0 ? '#22c55e' : (h < -8 ? '#ef4444' : '#94a3b8');
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
        var OT_CAP = 200;
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
        h += '<h4 class="dgd-dept-card__name">' + escapeHtml(deptName) + '</h4>';
        h += '<span class="dgd-dept-card__count">' + deptEmps.length + ' MA (' + activeCount + ' aktiv)</span>';
        h += '</div>';
        h += '<div class="dgd-dept-card__score" style="background:' + score.color + '" title="Score: ' + score.score + '/100">' + score.grade + '</div>';
        h += '</div>';

        // KPI Mini-Grid
        h += '<div class="dgd-dept-card__kpis">';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val" style="color:' + attPctColor(avgAtt) + '">' + avgAtt + '%</span><span class="dgd-dept-kpi__label">\u00D8 Anwesenheit</span><span class="dgd-dept-kpi__target">Ziel: \u226595%</span></div>';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val" style="color:' + overtimeColor(totalOtH) + '">' + (totalOtH >= 0 ? '+' : '') + totalOtH + 'h</span><span class="dgd-dept-kpi__label">\u00DCberstunden \u03A3</span></div>';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val">' + (avgOt >= 0 ? '+' : '') + avgOt + 'h</span><span class="dgd-dept-kpi__label">\u00D8/Mitarbeiter</span><span class="dgd-dept-kpi__target">Ziel: \u00b10h</span></div>';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val" style="color:' + (overCapCount > 0 ? '#ef4444' : '#22c55e') + '">' + overCapCount + (overCapCount > 0 ? ' \u26A0' : '') + '</span><span class="dgd-dept-kpi__label">\u00FCber 200h Cap</span><span class="dgd-dept-kpi__target">Ziel: 0</span></div>';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val" style="color:#06b6d4">' + totalVac + (totalVacUsed > 0 ? ' / ' + totalVacTotal : '') + 'd</span><span class="dgd-dept-kpi__label">Resturlaub' + (totalVacUsed > 0 ? ' (' + totalVacUsed + ' gen.)' : '') + '</span></div>';
        h += '<div class="dgd-dept-kpi"><span class="dgd-dept-kpi__val" style="color:' + (deptAnomalies.length > 0 ? '#ef4444' : '#94a3b8') + '">' + deptAnomalies.length + '</span><span class="dgd-dept-kpi__label">Anomalien</span><span class="dgd-dept-kpi__target">Ziel: 0</span></div>';
        h += '</div>';

        // Composition bar (reuse existing function)
        if (deptSoll > 0) {
            var deptStats = { soll: deptSoll, ist: deptIst, timeoff: deptTimeoff, holiday: deptHoliday, fehlzeit: Math.max(0, deptSoll - deptIst - deptTimeoff - deptHoliday) };
            h += buildCompositionBar(deptStats);
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
                h += '<span class="dgd-dept-emp__name">' + escapeHtml(emp.firstName + ' ' + emp.lastName) + '</span>';
                h += '<span class="dgd-dept-emp__att" style="color:' + attPctColor(empAttPct) + '">' + empAttPct + '%</span>';
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
        h += '<button class="dgd-dept-card__cortex-btn" onclick="window._requestCortexEval(\'' + escapeHtml(deptName) + '\', ' + deptIdx + ')">';
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
        xhr.open('POST', 'http://localhost:8000/api/chat/stream', true);
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
        var employees = state.employees || [];
        var deptEmps = [];
        for (var i = 0; i < employees.length; i++) {
            if ((employees[i].team && employees[i].team.name) === deptName) deptEmps.push(employees[i]);
        }

        var activeCount = 0;
        var attData = [], otData = [];
        for (var e = 0; e < deptEmps.length; e++) {
            if (deptEmps[e].isActive) activeCount++;
            // Attendance
            for (var a = 0; a < (state.attendance || []).length; a++) {
                if (state.attendance[a].user && state.attendance[a].user.id === deptEmps[e].id) {
                    var att = state.attendance[a];
                    attData.push(deptEmps[e].firstName + ' ' + deptEmps[e].lastName + ': ' +
                        Math.round((att.trackedTime||0)/3600) + '/' + Math.round((att.expectedTime||0)/3600) + 'h');
                    break;
                }
            }
            // Overtime
            for (var o = 0; o < (state.overtime || []).length; o++) {
                if (state.overtime[o].user && state.overtime[o].user.id === deptEmps[e].id) {
                    otData.push(deptEmps[e].firstName + ' ' + deptEmps[e].lastName + ': ' +
                        Math.round((state.overtime[o].balance||0)/3600) + 'h');
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
        var employees = state.employees || [];
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
        for (var a = 0; a < (state.attendance || []).length; a++) {
            if (state.attendance[a].user && state.attendance[a].user.id === empId) { attRec = state.attendance[a]; break; }
        }
        for (var o = 0; o < (state.overtime || []).length; o++) {
            if (state.overtime[o].user && state.overtime[o].user.id === empId) { otRec = state.overtime[o]; break; }
        }
        var currentYear = new Date().getFullYear().toString();
        for (var vb = 0; vb < (state.timeOffBalances || []).length; vb++) {
            var vbal = state.timeOffBalances[vb];
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
        for (var an = 0; an < (state.anomalies || []).length; an++) {
            if ((state.anomalies[an].employeeId || '') === empId) empAnomalies.push(state.anomalies[an].description);
        }

        // Equity calculation for Cortex prompt
        var empEquity = otH > 0 ? calcEquity(otH, empPos) : null;

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
        for (var a = 0; a < (state.attendance || []).length; a++) {
            if (state.attendance[a].user) attendByUser[state.attendance[a].user.id] = state.attendance[a];
        }
        for (var o = 0; o < (state.overtime || []).length; o++) {
            if (state.overtime[o].user) overtimeByUser[state.overtime[o].user.id] = state.overtime[o];
        }
        // Vacation: same logic as renderMitarbeiter — current year only
        var vacUsedByUser = {};
        var currentYear = new Date().getFullYear().toString();
        for (var v = 0; v < (state.timeOffBalances || []).length; v++) {
            var vbal = state.timeOffBalances[v];
            var vTypeName = (vbal.timeOffRule && vbal.timeOffRule.timeOffType && vbal.timeOffRule.timeOffType.name) || '';
            var periodStart = vbal.periodStartDate || '';
            if (vTypeName.toLowerCase().indexOf('urlaub') !== -1 && vbal.user && vbal.user.id && periodStart.indexOf(currentYear) === 0) {
                if (!vacBalByUser[vbal.user.id]) vacBalByUser[vbal.user.id] = 0;
                if (!vacUsedByUser[vbal.user.id]) vacUsedByUser[vbal.user.id] = 0;
                vacBalByUser[vbal.user.id] += (vbal.available || 0);
                vacUsedByUser[vbal.user.id] += (vbal.used || 0);
            }
        }

        var sc = computeEmployeeScore(myEmp, attendByUser, overtimeByUser, vacBalByUser, state.anomalies || []);
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
            var activeEmps = (state.employees || []).filter(function(e) { return e.isActive; });
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
                '- Anomalien im Unternehmen: ' + (state.anomalies || []).length;
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
        for (var i = 0; i < (state.overtime || []).length; i++) {
            var o = state.overtime[i];
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

    var OT_CAP = 200; // 200h hard cap (company-wide constant)

    /**
     * Check if current user has HR/admin privileges.
     */
    function isHRUser() {
        return state.user && (state.user.role === 'admin' || state.user.role === 'hr');
    }

    /**
     * Find the KiwiHR employee matching the logged-in dashboard user.
     * Priority: 1) localStorage override, 2) email match, 3) display_name match
     * Returns the employee object or null.
     */
    function findMyEmployee() {
        if (!state.user) return null;
        var employees = state.employees || [];

        // 1) Check localStorage for manually linked employee ID
        var linkedId = localStorage.getItem('dgd_my_employee_id');
        if (linkedId) {
            for (var k = 0; k < employees.length; k++) {
                if (employees[k].id === linkedId) return employees[k];
            }
        }

        // 2) Match by email
        if (state.user.email) {
            var myEmail = state.user.email.toLowerCase();
            for (var i = 0; i < employees.length; i++) {
                if ((employees[i].email || '').toLowerCase() === myEmail) return employees[i];
            }
        }

        // 3) Fallback: match by display_name
        if (state.user.display_name) {
            var dn = state.user.display_name.toLowerCase().trim();
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
        h += '<div class="dgd-my-profile__avatar">' + escapeHtml(myEmp.firstName.charAt(0) + myEmp.lastName.charAt(0)) + '</div>';
        h += '<div class="dgd-my-profile__info">';
        h += '<div class="dgd-my-profile__name">' + escapeHtml(empName) + '</div>';
        h += '<div class="dgd-my-profile__role">' + escapeHtml(posName) + (posName && teamName ? ' \u2022 ' : '') + escapeHtml(teamName) + '</div>';
        h += '</div>';
        h += '<div class="dgd-my-profile__score">';
        h += '<div class="dgd-my-profile__score-value">' + sc.score + '</div>';
        h += '<div class="dgd-my-profile__score-label">Punkte</div>';
        h += '</div>';
        h += '</div>';

        // Stats grid
        h += '<div class="dgd-my-profile__stats">';
        h += '<div class="dgd-my-profile__stat">';
        h += '<div class="dgd-my-profile__stat-value" style="color:' + attPctColor(sc.attPct) + '">' + sc.attPct + '%</div>';
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
        if (BETEILIGUNG_CONFIG.enabled && otH > 0) {
            var eq = calcEquity(otH, posName);
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
        var tsAnalysis = (state._timesheetAnalysis || {})[emp.id];
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
            h += a.icon + ' ' + marker + escapeHtml(a.label) + '</span>';
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
                    if (!state._timesheetAnalysis) state._timesheetAnalysis = {};
                    state._timesheetAnalysis[uid] = analysis;

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

        var employees = state.employees || [];
        var attendByUser = {};
        for (var at = 0; at < (state.attendance || []).length; at++) {
            var att = state.attendance[at];
            if (att.user && att.user.id) attendByUser[att.user.id] = att;
        }
        var overtimeByUser = {};
        for (var ot = 0; ot < (state.overtime || []).length; ot++) {
            var ovt = state.overtime[ot];
            if (ovt.user && ovt.user.id) overtimeByUser[ovt.user.id] = ovt;
        }
        var vacBalByUser = {};
        var currentYear = new Date().getFullYear().toString();
        for (var vb = 0; vb < (state.timeOffBalances || []).length; vb++) {
            var vbal = state.timeOffBalances[vb];
            var vTypeName = (vbal.timeOffRule && vbal.timeOffRule.timeOffType && vbal.timeOffRule.timeOffType.name) || '';
            var periodStart = vbal.periodStartDate || '';
            if (vTypeName.toLowerCase().indexOf('urlaub') !== -1 && vbal.user && vbal.user.id && periodStart.indexOf(currentYear) === 0) {
                if (!vacBalByUser[vbal.user.id]) vacBalByUser[vbal.user.id] = 0;
                vacBalByUser[vbal.user.id] += (vbal.available || 0);
            }
        }

        // Replace inner HTML of leaderboard
        var newCard = buildLeaderboardCard(employees, attendByUser, overtimeByUser, vacBalByUser, state.anomalies || []);
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
                h += '<div class="dgd-leaderboard__podium-name">' + escapeHtml(empName) + '</div>';
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
                h += '<span class="dgd-leaderboard__row-name">' + escapeHtml(sr.emp.firstName + ' ' + sr.emp.lastName) + '</span>';
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
                h += '<span class="dgd-leaderboard__row-name">' + escapeHtml(rr.emp.firstName + ' ' + rr.emp.lastName) + '</span>';
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
        var employees = state.employees || [];
        var attendByUser = {}, overtimeByUser = {}, vacBalByUser = {};
        for (var i = 0; i < (state.attendance || []).length; i++) {
            var aRec = state.attendance[i];
            if (aRec.user && aRec.user.id) attendByUser[aRec.user.id] = aRec;
        }
        for (var o = 0; o < (state.overtime || []).length; o++) {
            var ovt = state.overtime[o];
            if (ovt.user && ovt.user.id) overtimeByUser[ovt.user.id] = ovt;
        }
        var currentYear = new Date().getFullYear().toString();
        for (var vb = 0; vb < (state.timeOffBalances || []).length; vb++) {
            var vbal = state.timeOffBalances[vb];
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
            var sc = computeEmployeeScore(employees[e], attendByUser, overtimeByUser, vacBalByUser, state.anomalies || []);
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
                h += '<strong>' + escapeHtml(r.name) + '</strong>';
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

        var employees = state.employees || [];
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

        var CORTEX_URL = 'http://localhost:8000';
        var xhr = new XMLHttpRequest();
        xhr.open('POST', CORTEX_URL + '/api/chat/stream', true);
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
                            container.innerHTML = '<div class="dgd-dept-card__cortex-text">\uD83E\uDD16 ' + escapeHtml(responseText) + '</div>';
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
            var barColor = attPctColor(avgAtt);

            // Team name
            svg += '<text x="' + (padLeft - 8) + '" y="' + (yCenter + 4) + '" text-anchor="end" fill="#475569" font-size="11" font-weight="500">' + escapeHtml(tName) + '</text>';

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

    /* ======================================================================
       View: Mitarbeiter (TellentHR)
       ====================================================================== */

    function renderMitarbeiter(container) {
        var html = '';

        // Connection status banner
        if (!state.tellentAvailable) {
            html += '<div class="dgd-staff-notice">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
            html += '<div><strong>TellentHR nicht verbunden</strong><br>Die Mitarbeiterdaten werden aus KiwiHR/TellentHR geladen. ';
            html += 'Bitte API-Key in der <code>.env</code>-Datei konfigurieren.</div>';
            html += '</div>';
            container.innerHTML = html;
            return;
        }

        var employees = state.employees || [];
        var absences = state.absences || [];

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
        for (var at = 0; at < (state.attendance || []).length; at++) {
            var att = state.attendance[at];
            if (att.user && att.user.id) attendByUser[att.user.id] = att;
        }

        var overtimeByUser = {};
        for (var ot = 0; ot < (state.overtime || []).length; ot++) {
            var ovt = state.overtime[ot];
            if (ovt.user && ovt.user.id) overtimeByUser[ovt.user.id] = ovt;
        }

        // Vacation balance lookup per user (only "Urlaub" types, current year)
        var vacBalByUser = {};   // available (remaining) days
        var vacUsedByUser = {};  // used days
        var currentYear = new Date().getFullYear().toString();
        for (var vb = 0; vb < (state.timeOffBalances || []).length; vb++) {
            var vbal = state.timeOffBalances[vb];
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
        for (var oi = 0; oi < (state.overtime || []).length; oi++) {
            totalOvertimeH += Math.round((state.overtime[oi].balance || 0) / 3600);
        }

        var totalVacAvailable = 0, totalVacUsedFirm = 0;
        for (var vid in vacBalByUser) {
            totalVacAvailable += vacBalByUser[vid];
        }
        for (var vuid in vacUsedByUser) {
            totalVacUsedFirm += vacUsedByUser[vuid];
        }
        var totalVacEntitlement = Math.round((totalVacAvailable + totalVacUsedFirm) * 10) / 10;

        var anomalyCount = (state.anomalies || []).length;

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
            html += buildMyProfileCard(myEmp, attendByUser, overtimeByUser, vacBalByUser, vacUsedByUser, state.anomalies || []);
        } else if (state.user && employees.length > 0) {
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
                html += '<option value="' + activeForLink[lj].id + '">' + escapeHtml(activeForLink[lj].firstName + ' ' + activeForLink[lj].lastName) + '</option>';
            }
            html += '</select>';
            html += '<button class="dgd-btn dgd-btn--sm" onclick="window._linkMyEmployee(document.getElementById(\'link-employee-select\').value)" style="font-size:0.8rem">Verkn\u00FCpfen</button>';
            html += '</div></div>';
        }

        // Summary cards (8 cards, 2 rows)
        html += '<div class="dgd-staff-summary">';
        html += renderStaffStatCard('Gesamt', employees.length, 'var(--dgd-primary)', '&#128101;');
        html += renderStaffStatCard('Aktiv', activeCount, '#22c55e', '&#9989;');
        html += renderStaffStatCard('Inaktiv', inactiveCount, '#ef4444', '&#128683;');
        html += renderStaffStatCard('Abteilungen', Object.keys(abteilungen).length, '#8b5cf6', '&#127968;');
        html += renderStaffStatCard('\u00D8 Anwesenheit', attPctCount > 0 ? (avgAttPct + '%') : '\u2014', '#f59e0b', '&#128337;', '\u226595%');
        // Count employees over 200h cap
        var overCapCount = 0;
        for (var capId in overtimeByUser) {
            if (Math.round((overtimeByUser[capId].balance || 0) / 3600) >= 200) overCapCount++;
        }
        var otCardLabel = (totalOvertimeH >= 0 ? '+' : '') + totalOvertimeH + 'h';
        if (overCapCount > 0) otCardLabel += ' (' + overCapCount + ' \u00FC. Cap)';
        html += renderStaffStatCard('\u00DCberstunden', otCardLabel, overCapCount > 0 ? '#ef4444' : (totalOvertimeH > 0 ? '#f59e0b' : '#22c55e'), '&#9200;', '\u00b10h (ausgeglichen)');
        var vacStatLabel = '\u2014';
        if (totalVacAvailable > 0) {
            vacStatLabel = Math.round(totalVacAvailable * 10) / 10 + (totalVacUsedFirm > 0 ? ' / ' + totalVacEntitlement : '') + ' Tage';
        }
        html += renderStaffStatCard('Resturlaub' + (totalVacUsedFirm > 0 ? ' (' + Math.round(totalVacUsedFirm * 10) / 10 + ' gen.)' : ''), vacStatLabel, '#06b6d4', '&#127796;');
        html += renderStaffStatCard('Anomalien', anomalyCount, anomalyCount > 0 ? '#ef4444' : '#94a3b8', '&#9888;', '0');
        // TimeSaved KPI stat card
        var ts = calcTimeSaved();
        html += renderStaffStatCard('Eingesparte Zeit', ts.totalH + 'h', '#06b6d4', '&#129302;', ts.weeklyRate + 'h/Woche');
        // Beteiligungspool stat card (HR only)
        if (hrMode && BETEILIGUNG_CONFIG.enabled && totalOvertimeH > 0) {
            var poolValue = 0;
            for (var eqId in overtimeByUser) {
                var eqOtH = Math.round((overtimeByUser[eqId].balance || 0) / 3600);
                if (eqOtH <= 0) continue;
                // Find employee position
                var eqPos = '';
                for (var eqE = 0; eqE < employees.length; eqE++) {
                    if (employees[eqE].id === eqId) { eqPos = (employees[eqE].position && employees[eqE].position.name) || ''; break; }
                }
                poolValue += calcEquity(eqOtH, eqPos).value;
            }
            var poolPct = (poolValue / BETEILIGUNG_CONFIG.companyValuation * 100).toFixed(1);
            html += renderStaffStatCard('Beteiligungspool', poolValue.toLocaleString('de-DE') + ' \u20AC', '#d97706', '&#128200;', poolPct + '% der 3,5M');
        }
        html += '</div>';

        // Leaderboard with Achievements (HR/Admin only — contains individual scores)
        if (hrMode) {
            html += buildLeaderboardCard(employees, attendByUser, overtimeByUser, vacBalByUser, state.anomalies || []);
        }

        // Company-wide overview composition bar
        if ((state.attendance || []).length > 0) {
            var companyStats = buildCompanyWideStats(state.attendance, employees);
            html += '<div class="dgd-section-card" style="margin-bottom:1.5rem">';
            html += '<div class="dgd-section-card__title">&#128202; Gesamtuebersicht Zeitaufteilung</div>';
            html += '<div class="dgd-company-overview">';
            html += '<span class="dgd-company-overview__stat" style="color:' + attPctColor(avgAttPct) + '">&#216; ' + avgAttPct + '% Anwesenheit</span>';
            html += '<span class="dgd-company-overview__muted">' + companyStats.soll + 'h Soll / ' + companyStats.ist + 'h Ist (' + activeCount + ' aktive MA)</span>';
            html += '</div>';
            html += buildCompositionBar(companyStats);
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
            html += buildDeptCard(abtNames[ab], deptEmps, attendByUser, overtimeByUser, vacBalByUser, vacUsedByUser, state.anomalies || [], ab);
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
                html += '<span class="dgd-staff-team-chip__name">' + escapeHtml(grpNames[gr]) + '</span>';
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
        var empAnomalies = state.anomalies || [];
        if (hrMode && empAnomalies.length > 0) {
            html += '<div class="dgd-anomaly-banner">';
            html += '<div class="dgd-anomaly-banner__icon">&#9888;</div>';
            html += '<div class="dgd-anomaly-banner__content">';
            html += '<strong>' + empAnomalies.length + ' Anomalie' + (empAnomalies.length > 1 ? 'n' : '') + ' erkannt</strong>';
            html += '<div class="dgd-anomaly-banner__list">';
            for (var ai = 0; ai < Math.min(empAnomalies.length, 5); ai++) {
                var an = empAnomalies[ai];
                html += '<div class="dgd-anomaly-item">';
                html += '<span class="dgd-anomaly-item__name">' + escapeHtml(an.employeeName) + '</span>';
                html += '<span class="dgd-anomaly-item__desc">' + escapeHtml(an.description) + '</span>';
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
                var attClr = attPctColor(attPercent);
                attHtml = '<div class="dgd-staff-attendance">';
                attHtml += '<div class="dgd-staff-attendance__bar"><div class="dgd-staff-attendance__fill" style="width:' + Math.min(attPercent, 100) + '%;background:' + attClr + '"></div></div>';
                attHtml += '<span class="dgd-staff-attendance__text">' + trackedH + '/' + expectedH + 'h (' + attPercent + '%)</span>';
                attHtml += '</div>';
            }

            // Overtime cell — 200h hard cap gauge
            var OT_CAP = 200;
            var otInfo = overtimeByUser[emp2.id];
            var otHtml = '\u2014';
            if (otInfo) {
                var otH = Math.round((otInfo.balance || 0) / 3600);
                var otClr = overtimeColor(otH);
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

            html += '<tr class="dgd-staff-row dgd-staff-row--clickable' + (hasAnomaly ? ' dgd-staff-row--anomaly' : '') + '" data-emp-id="' + escapeHtml(emp2.id) + '" data-search="' + escapeHtml((emp2.firstName + ' ' + emp2.lastName + ' ' + ((emp2.position && emp2.position.name) || '') + ' ' + ((emp2.team && emp2.team.name) || '')).toLowerCase()) + '">';
            html += '<td class="dgd-staff-row__name">';
            html += '<div class="dgd-staff-avatar">' + escapeHtml((emp2.firstName || '?')[0] + (emp2.lastName || '?')[0]) + '</div>';
            html += '<div><strong>' + escapeHtml(emp2.firstName + ' ' + emp2.lastName) + '</strong>';
            if (hasAnomaly) html += ' <span class="dgd-anomaly-badge" title="Anomalie erkannt">&#9888;</span>';
            html += '<div class="dgd-staff-row__email">' + escapeHtml(emp2.email || '') + '</div></div>';
            html += '</td>';
            html += '<td>' + escapeHtml((emp2.position && emp2.position.name) || '—') + '</td>';
            html += '<td>' + escapeHtml((emp2.team && emp2.team.name) || '—') + '</td>';
            html += '<td>' + attHtml + '</td>';
            html += '<td>' + otHtml + '</td>';
            html += '<td>' + vacHtml + '</td>';
            html += '<td><span class="dgd-staff-status dgd-staff-status--' + statusClass + '">' + statusLabel + '</span></td>';
            html += '<td class="dgd-staff-row__cortex-cell"><button class="dgd-staff-cortex-btn" data-emp-cortex="' + escapeHtml(emp2.id) + '" title="Cortex Analyse">\uD83E\uDD16</button></td>';
            html += '</tr>';
            // Hidden row for Cortex analysis result
            html += '<tr class="dgd-staff-cortex-row" id="cortex-emp-row-' + escapeHtml(emp2.id) + '" style="display:none">';
            html += '<td colspan="8"><div class="dgd-staff-cortex-container" id="cortex-emp-' + escapeHtml(emp2.id) + '"></div></td>';
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
                if (empId) openEmployeeDetail(empId);
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
            for (var hoi = 0; hoi < (state.overtime || []).length; hoi++) {
                hrOvertimeTotal += Math.round((state.overtime[hoi].balance || 0) / 3600);
            }
            loadOvertimeTimeline('overtime-timeline-chart', employees, hrOvertimeTotal);
        }

        // Run deep timesheet analysis (async) — updates leaderboard when done
        // Also needed for personal profile badges
        runTimesheetAnalysis(employees);
    }

    function renderStaffStatCard(label, value, color, icon, target) {
        var h = '<div class="dgd-staff-stat">' +
            '<div class="dgd-staff-stat__icon" style="background:' + color + '15;color:' + color + '">' + icon + '</div>' +
            '<div class="dgd-staff-stat__value">' + value + '</div>' +
            '<div class="dgd-staff-stat__label">' + escapeHtml(label) + '</div>';
        if (target) {
            h += '<div class="dgd-staff-stat__target">Ziel: ' + escapeHtml(target) + '</div>';
        }
        h += '</div>';
        return h;
    }

    /* ======================================================================
       View: Finanzen (Finance)
       ====================================================================== */

    var DEMO_FINANCE = {
        summary: { revenue: 28500, costs: 18200, profit: 10300, burnRate: 17800 },
        monthly: [
            { month: 'Okt', revenue: 18000, costs: 15500 },
            { month: 'Nov', revenue: 21000, costs: 16200 },
            { month: 'Dez', revenue: 24500, costs: 17000 },
            { month: 'Jan', revenue: 22000, costs: 16800 },
            { month: 'Feb', revenue: 26200, costs: 17500 },
            { month: 'Mär', revenue: 28500, costs: 18200 },
        ],
        projects: [
            { name: 'DGD Portal Launch', budget: 25000, spent: 23800, status: 'abgeschlossen' },
            { name: 'Partner-Netzwerk Ausbau', budget: 15000, spent: 8200, status: 'aktiv' },
            { name: 'Marketing Kampagne Q2', budget: 12000, spent: 0, status: 'geplant' },
            { name: 'Schadenfall-Automatisierung', budget: 35000, spent: 9500, status: 'aktiv' },
            { name: 'Kundenportal v2', budget: 40000, spent: 0, status: 'geplant' },
        ],
        expenses: [
            { date: '2026-03-08', project: 'Partner-Netzwerk', desc: 'Google Ads Kampagne', amount: 1200, category: 'Marketing' },
            { date: '2026-03-07', project: 'Schadenfall-Auto.', desc: 'Claude API Credits', amount: 450, category: 'Cloud/API' },
            { date: '2026-03-06', project: 'DGD Portal', desc: 'Linevast Hosting Q2', amount: 180, category: 'Infrastruktur' },
            { date: '2026-03-05', project: 'Partner-Netzwerk', desc: 'Messe-Material Druck', amount: 890, category: 'Marketing' },
            { date: '2026-03-04', project: 'Allgemein', desc: 'Microsoft 365 Lizenzen', amount: 220, category: 'Lizenzen' },
            { date: '2026-03-03', project: 'Schadenfall-Auto.', desc: 'Testdaten-Aufbereitung', amount: 350, category: 'Entwicklung' },
            { date: '2026-03-01', project: 'Allgemein', desc: 'Bueromiete anteilig', amount: 1500, category: 'Betrieb' },
        ]
    };

    function renderFinanzen(container) {
        var fin = DEMO_FINANCE;
        var html = '';

        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Finanzen</h1>';
        html += '<div class="dgd-page-header__actions">';
        html += '<button class="dgd-btn dgd-btn--primary" id="btn-new-expense">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        html += ' Neue Ausgabe</button>';
        html += '</div></div>';

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

        // Monthly P&L Chart (SVG bar chart)
        html += '<div class="dgd-section-card" style="animation-delay:0.25s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
        html += ' Monatliche GuV (6 Monate)</div>';
        html += renderFinanceChart(fin.monthly);
        html += '</div>';

        // Project Budgets Table
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

        container.innerHTML = html;

        // New expense button
        var btnExp = document.getElementById('btn-new-expense');
        if (btnExp) {
            btnExp.addEventListener('click', function() {
                openExpenseModal();
            });
        }
    }

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

        // Y-axis grid lines
        for (var g = 0; g <= 4; g++) {
            var yG = padT + (chartH - (g / 4) * chartH);
            var label = formatCurrency(Math.round(maxVal * g / 4));
            svg += '<line x1="' + padL + '" y1="' + yG + '" x2="' + (w - padR) + '" y2="' + yG + '" stroke="var(--dgd-gray-200)" stroke-width="1"/>';
            svg += '<text x="' + (padL - 8) + '" y="' + (yG + 4) + '" text-anchor="end" fill="var(--dgd-gray-500)" font-size="11" font-family="inherit">' + label + '</text>';
        }

        // Cumulative profit line points
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

            // Revenue bar (green)
            svg += '<rect x="' + (x - barW - gap / 2) + '" y="' + revY + '" width="' + barW + '" height="' + revH + '" rx="3" fill="#27ae60" opacity="0.85"/>';
            // Cost bar (red)
            svg += '<rect x="' + (x + gap / 2) + '" y="' + costY + '" width="' + barW + '" height="' + costH + '" rx="3" fill="#e74c3c" opacity="0.85"/>';
            // Month label
            svg += '<text x="' + x + '" y="' + (h - 10) + '" text-anchor="middle" fill="var(--dgd-gray-600)" font-size="12" font-weight="600" font-family="inherit">' + escapeHtml(monthly[m].month) + '</text>';

            // Profit line
            cumProfit += monthly[m].revenue - monthly[m].costs;
            var profitY = profitMid - cumProfit * profitScale;
            profitPoints.push(x.toFixed(1) + ',' + profitY.toFixed(1));
        }

        // Draw profit line
        if (profitPoints.length > 1) {
            svg += '<polyline points="' + profitPoints.join(' ') + '" fill="none" stroke="#3498db" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
            for (var d = 0; d < profitPoints.length; d++) {
                var pts = profitPoints[d].split(',');
                svg += '<circle cx="' + pts[0] + '" cy="' + pts[1] + '" r="4" fill="#3498db" stroke="#fff" stroke-width="1.5"/>';
            }
        }

        svg += '</svg>';

        // Legend
        svg += '<div style="display:flex;gap:1.5rem;justify-content:center;margin-top:0.75rem;font-size:0.8rem;">';
        svg += '<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:12px;background:#27ae60;border-radius:2px;display:inline-block;"></span> Umsatz</span>';
        svg += '<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:12px;background:#e74c3c;border-radius:2px;display:inline-block;"></span> Kosten</span>';
        svg += '<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:3px;background:#3498db;border-radius:2px;display:inline-block;"></span> Kum. Gewinn</span>';
        svg += '</div>';

        return svg;
    }

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
            // Demo mode: add to list and re-render
            var newExp = {
                date: document.getElementById('exp-date').value,
                project: document.getElementById('exp-project').value,
                desc: document.getElementById('exp-desc').value,
                amount: parseFloat(document.getElementById('exp-amount').value) || 0,
                category: document.getElementById('exp-category').value
            };
            if (newExp.project && newExp.desc && newExp.amount > 0) {
                DEMO_FINANCE.expenses.unshift(newExp);
                closeModal();
                renderFinanzen($('#main-content'));
            }
        });
    }

    /* ======================================================================
       View: Ziele (Goals / OKR)
       ====================================================================== */

    var DEMO_GOALS = [
        { id: 1, title: 'Partner-Netzwerk auf 50 ausbauen', type: 'company', quarter: 1, year: 2026, status: 'at_risk', progress: 45, key_results: [
            { id: 1, title: 'Aktive Partner', current_value: 23, target_value: 50, unit: 'Partner' },
            { id: 2, title: 'Partner-Bewerbungen', current_value: 8, target_value: 20, unit: 'Bewerbungen' }
        ]},
        { id: 2, title: 'Umsatz Q1 auf 50.000 EUR', type: 'company', quarter: 1, year: 2026, status: 'behind', progress: 57, key_results: [
            { id: 3, title: 'Quartalsumsatz', current_value: 28500, target_value: 50000, unit: 'EUR' }
        ]},
        { id: 3, title: 'Kundenzufriedenheit 4.8+', type: 'company', quarter: 1, year: 2026, status: 'on_track', progress: 94, key_results: [
            { id: 4, title: 'NPS Score', current_value: 4.7, target_value: 4.8, unit: '/5' }
        ]},
        { id: 4, title: 'Marketing-Praesenz aufbauen', type: 'team', owner: 'Marketing', quarter: 1, year: 2026, status: 'on_track', progress: 62, parent_goal_id: 1, key_results: [
            { id: 5, title: 'Portal-Besucher/Monat', current_value: 1250, target_value: 5000, unit: 'Besucher' },
            { id: 6, title: 'Conversion Rate', current_value: 3.2, target_value: 5, unit: '%' }
        ]},
        { id: 5, title: 'Durchlaufzeit auf 7 Tage reduzieren', type: 'team', owner: 'Operations', quarter: 1, year: 2026, status: 'behind', progress: 42, key_results: [
            { id: 7, title: 'Avg Durchlaufzeit', current_value: 12, target_value: 7, unit: 'Tage' }
        ]}
    ];

    var goalsState = { selectedQuarter: 1, selectedYear: 2026 };

    function renderZiele(container) {
        var html = '';
        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Ziele & OKR</h1>';
        html += '<div class="dgd-page-header__actions">';
        html += '<button class="dgd-btn dgd-btn--primary" id="btn-new-goal">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        html += ' Neues Ziel</button>';
        html += '</div></div>';

        // Quarter selector
        html += '<div class="dgd-filter-row">';
        for (var q = 1; q <= 4; q++) {
            var activeQ = q === goalsState.selectedQuarter ? ' dgd-filter-pill--active' : '';
            html += '<button class="dgd-filter-pill' + activeQ + '" data-quarter="' + q + '">Q' + q + '</button>';
        }
        html += '<button class="dgd-filter-pill dgd-filter-pill--active" disabled style="margin-left:auto;cursor:default;">' + goalsState.selectedYear + '</button>';
        html += '</div>';

        // Stats bar
        var stats = { total: 0, on_track: 0, at_risk: 0, behind: 0, completed: 0 };
        var filtered = [];
        for (var g = 0; g < DEMO_GOALS.length; g++) {
            var gl = DEMO_GOALS[g];
            if (gl.quarter === goalsState.selectedQuarter && gl.year === goalsState.selectedYear) {
                filtered.push(gl);
                stats.total++;
                if (gl.status === 'on_track') stats.on_track++;
                else if (gl.status === 'at_risk') stats.at_risk++;
                else if (gl.status === 'behind') stats.behind++;
                else if (gl.status === 'completed') stats.completed++;
            }
        }

        html += '<div class="dgd-goals-stats">';
        html += '<div class="dgd-goals-stats__item"><span class="dgd-goals-stats__num">' + stats.total + '</span><span class="dgd-goals-stats__label">Gesamt</span></div>';
        html += '<div class="dgd-goals-stats__item dgd-goals-stats__item--on_track"><span class="dgd-goals-stats__num">' + stats.on_track + '</span><span class="dgd-goals-stats__label">On Track</span></div>';
        html += '<div class="dgd-goals-stats__item dgd-goals-stats__item--at_risk"><span class="dgd-goals-stats__num">' + stats.at_risk + '</span><span class="dgd-goals-stats__label">At Risk</span></div>';
        html += '<div class="dgd-goals-stats__item dgd-goals-stats__item--behind"><span class="dgd-goals-stats__num">' + stats.behind + '</span><span class="dgd-goals-stats__label">Behind</span></div>';
        html += '<div class="dgd-goals-stats__item dgd-goals-stats__item--completed"><span class="dgd-goals-stats__num">' + stats.completed + '</span><span class="dgd-goals-stats__label">Completed</span></div>';
        html += '</div>';

        // Goals tree - company goals first, then team goals nested under parents
        var companyGoals = [];
        var teamGoals = [];
        for (var f = 0; f < filtered.length; f++) {
            if (filtered[f].type === 'company') companyGoals.push(filtered[f]);
            else teamGoals.push(filtered[f]);
        }

        for (var cg = 0; cg < companyGoals.length; cg++) {
            html += renderGoalCard(companyGoals[cg], 0);
            // Nested team goals
            for (var tg = 0; tg < teamGoals.length; tg++) {
                if (teamGoals[tg].parent_goal_id === companyGoals[cg].id) {
                    html += renderGoalCard(teamGoals[tg], 1);
                }
            }
        }
        // Team goals without parent
        for (var tg2 = 0; tg2 < teamGoals.length; tg2++) {
            if (!teamGoals[tg2].parent_goal_id) {
                html += renderGoalCard(teamGoals[tg2], 0);
            }
        }

        container.innerHTML = html;

        // Quarter filter clicks
        var qBtns = container.querySelectorAll('[data-quarter]');
        for (var qi = 0; qi < qBtns.length; qi++) {
            qBtns[qi].addEventListener('click', function() {
                goalsState.selectedQuarter = parseInt(this.getAttribute('data-quarter'));
                renderZiele(container);
            });
        }

        // New goal button
        var btnGoal = document.getElementById('btn-new-goal');
        if (btnGoal) {
            btnGoal.addEventListener('click', function() {
                openGoalModal();
            });
        }
    }

    function renderGoalCard(goal, level) {
        var statusColors = { on_track: '#27ae60', at_risk: '#f39c12', behind: '#e74c3c', completed: '#3498db' };
        var statusLabels = { on_track: 'On Track', at_risk: 'At Risk', behind: 'Behind', completed: 'Abgeschlossen' };
        var color = statusColors[goal.status] || '#6c757d';
        var indent = level > 0 ? 'margin-left:2rem;' : '';
        var typeBadge = goal.type === 'company' ? 'Unternehmen' : (goal.owner || 'Team');

        var html = '<div class="dgd-goal-card" style="border-left-color:' + color + ';' + indent + '">';
        html += '<div class="dgd-goal-card__header">';
        html += renderProgressRing(goal.progress, color, 40);
        html += '<div class="dgd-goal-card__info">';
        html += '<div class="dgd-goal-card__title">' + escapeHtml(goal.title) + '</div>';
        html += '<div class="dgd-goal-card__meta">';
        html += '<span class="dgd-badge dgd-badge--' + (goal.type === 'company' ? 'portal' : 'intern') + '">' + escapeHtml(typeBadge) + '</span>';
        html += '<span class="dgd-goal-card__status" style="color:' + color + '">' + escapeHtml(statusLabels[goal.status] || goal.status) + '</span>';
        html += '</div></div>';
        html += '<span style="font-size:1.25rem;font-weight:700;color:' + color + '">' + goal.progress + '%</span>';
        html += '</div>';

        // Key Results
        if (goal.key_results && goal.key_results.length > 0) {
            html += '<div class="dgd-goal-card__krs">';
            for (var k = 0; k < goal.key_results.length; k++) {
                var kr = goal.key_results[k];
                var krPct = kr.target_value > 0 ? Math.min(100, Math.round((kr.current_value / kr.target_value) * 100)) : 0;
                var krColor = krPct >= 80 ? '#27ae60' : (krPct >= 50 ? '#f39c12' : '#e74c3c');
                html += '<div class="dgd-goal-card__kr">';
                html += '<div class="dgd-goal-card__kr-title">' + escapeHtml(kr.title) + '</div>';
                html += '<div class="dgd-goal-card__kr-bar">';
                html += '<div class="dgd-goal-card__kr-fill" style="width:' + krPct + '%;background:' + krColor + '"></div>';
                html += '</div>';
                html += '<span class="dgd-goal-card__kr-val">' + kr.current_value + ' / ' + kr.target_value + ' ' + escapeHtml(kr.unit) + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function renderProgressRing(pct, color, size) {
        var r = (size - 6) / 2;
        var c = Math.PI * 2 * r;
        var offset = c - (pct / 100) * c;
        return '<svg width="' + size + '" height="' + size + '" class="dgd-progress-ring">' +
            '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" fill="none" stroke="var(--dgd-gray-200)" stroke-width="3"/>' +
            '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="3" ' +
            'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" stroke-linecap="round" ' +
            'transform="rotate(-90 ' + (size / 2) + ' ' + (size / 2) + ')"/>' +
            '</svg>';
    }

    function openGoalModal() {
        var mc = document.getElementById('modal-container');
        var html = '<div class="dgd-modal-overlay" id="goal-modal-overlay">';
        html += '<div class="dgd-modal">';
        html += '<div class="dgd-modal__header"><h3>Neues Ziel</h3><button class="dgd-modal__close" id="goal-modal-close">&times;</button></div>';
        html += '<div class="dgd-modal__body">';
        html += '<form id="goal-form" class="dgd-form">';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Titel</label><input type="text" class="dgd-form__input" id="goal-title" required></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Beschreibung</label><textarea class="dgd-form__input" id="goal-desc" rows="3"></textarea></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Typ</label><select class="dgd-form__input" id="goal-type"><option value="company">Unternehmen</option><option value="team">Team</option><option value="personal">Persoenlich</option></select></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Verantwortlich</label><input type="text" class="dgd-form__input" id="goal-owner" placeholder="z.B. Marketing"></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Quartal</label><select class="dgd-form__input" id="goal-quarter"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select></div>';
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Jahr</label><input type="number" class="dgd-form__input" id="goal-year" value="2026"></div>';
        html += '</form></div>';
        html += '<div class="dgd-modal__footer"><button class="dgd-btn dgd-btn--outline" id="goal-cancel">Abbrechen</button><button class="dgd-btn dgd-btn--primary" id="goal-save">Speichern</button></div>';
        html += '</div></div>';
        mc.innerHTML = html;

        var closeModal = function() { mc.innerHTML = ''; };
        document.getElementById('goal-modal-close').addEventListener('click', closeModal);
        document.getElementById('goal-cancel').addEventListener('click', closeModal);
        document.getElementById('goal-modal-overlay').addEventListener('click', function(ev) {
            if (ev.target === this) closeModal();
        });
        document.getElementById('goal-save').addEventListener('click', function() {
            var title = document.getElementById('goal-title').value;
            if (title) {
                DEMO_GOALS.push({
                    id: DEMO_GOALS.length + 1,
                    title: title,
                    type: document.getElementById('goal-type').value,
                    owner: document.getElementById('goal-owner').value,
                    quarter: parseInt(document.getElementById('goal-quarter').value),
                    year: parseInt(document.getElementById('goal-year').value),
                    status: 'on_track',
                    progress: 0,
                    key_results: []
                });
                closeModal();
                renderZiele($('#main-content'));
            }
        });
    }

    /* ======================================================================
       View: Feedback
       ====================================================================== */

    var DEMO_FEEDBACK = {
        pulse_filled: false,
        trends: [
            { week: 'KW 1', satisfaction: 4.2, workload: 3.8, teamspirit: 4.5 },
            { week: 'KW 2', satisfaction: 4.1, workload: 3.6, teamspirit: 4.4 },
            { week: 'KW 3', satisfaction: 4.3, workload: 3.9, teamspirit: 4.6 },
            { week: 'KW 4', satisfaction: 4.0, workload: 4.1, teamspirit: 4.3 },
            { week: 'KW 5', satisfaction: 4.4, workload: 3.7, teamspirit: 4.7 },
            { week: 'KW 6', satisfaction: 4.2, workload: 3.5, teamspirit: 4.5 }
        ],
        templates: [
            { id: 1, title: 'Woechentlicher Pulse Check', type: 'pulse', questions: 3, responses: 45, active: true },
            { id: 2, title: 'Q1 Mitarbeiterzufriedenheit', type: 'custom', questions: 10, responses: 12, active: true },
            { id: 3, title: '360\u00b0 Review - Teamleiter', type: '360', questions: 8, responses: 6, active: false }
        ]
    };

    var feedbackState = { tab: 'pulse' };

    function renderFeedback(container) {
        var html = '';
        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Feedback</h1>';
        html += '</div>';

        // Tabs
        html += '<div class="dgd-filter-row">';
        var tabs = [{ key: 'pulse', label: 'Pulse' }, { key: 'surveys', label: 'Umfragen' }, { key: 'ergebnisse', label: 'Ergebnisse' }];
        for (var t = 0; t < tabs.length; t++) {
            var activeT = tabs[t].key === feedbackState.tab ? ' dgd-filter-pill--active' : '';
            html += '<button class="dgd-filter-pill' + activeT + '" data-fb-tab="' + tabs[t].key + '">' + tabs[t].label + '</button>';
        }
        html += '</div>';

        if (feedbackState.tab === 'pulse') {
            html += renderPulseTab();
        } else if (feedbackState.tab === 'surveys') {
            html += renderSurveysTab();
        } else {
            html += renderErgebnisseTab();
        }

        container.innerHTML = html;

        // Tab clicks
        var tabBtns = container.querySelectorAll('[data-fb-tab]');
        for (var tb = 0; tb < tabBtns.length; tb++) {
            tabBtns[tb].addEventListener('click', function() {
                feedbackState.tab = this.getAttribute('data-fb-tab');
                renderFeedback(container);
            });
        }

        // Pulse form submit
        var pulseForm = document.getElementById('pulse-submit-btn');
        if (pulseForm) {
            pulseForm.addEventListener('click', function() {
                DEMO_FEEDBACK.pulse_filled = true;
                renderFeedback(container);
            });
        }

        // Emoji rating clicks
        var ratingBtns = container.querySelectorAll('.dgd-pulse-rating__btn');
        for (var rb = 0; rb < ratingBtns.length; rb++) {
            ratingBtns[rb].addEventListener('click', function() {
                var group = this.parentElement;
                var siblings = group.querySelectorAll('.dgd-pulse-rating__btn');
                for (var s = 0; s < siblings.length; s++) {
                    siblings[s].classList.remove('dgd-pulse-rating__btn--active');
                }
                this.classList.add('dgd-pulse-rating__btn--active');
            });
        }
    }

    function renderPulseTab() {
        var html = '';

        // Pulse status
        html += '<div class="dgd-section-card" style="animation-delay:0.05s">';
        if (DEMO_FEEDBACK.pulse_filled) {
            html += '<div class="dgd-alert dgd-alert--success">Dein Pulse Check fuer diese Woche wurde abgegeben. Danke!</div>';
        } else {
            html += '<div class="dgd-section-card__title">Woechentlicher Pulse Check</div>';
            html += '<p style="color:var(--dgd-gray-600);font-size:var(--dgd-font-size-sm);margin-bottom:1rem;">Wie geht es dir diese Woche? Dein Feedback ist anonym.</p>';

            var questions = [
                { id: 'satisfaction', label: 'Zufriedenheit', emojis: ['\ud83d\ude1e', '\ud83d\ude15', '\ud83d\ude10', '\ud83d\ude42', '\ud83d\ude04'] },
                { id: 'workload', label: 'Workload', emojis: ['\ud83e\udee0', '\ud83d\ude23', '\ud83d\ude10', '\ud83d\ude0a', '\ud83d\udcaa'] },
                { id: 'teamspirit', label: 'Team-Spirit', emojis: ['\ud83d\udc94', '\ud83d\ude14', '\ud83d\ude10', '\ud83e\udd1d', '\ud83d\udd25'] }
            ];

            for (var q = 0; q < questions.length; q++) {
                var qu = questions[q];
                html += '<div class="dgd-pulse-question">';
                html += '<label class="dgd-pulse-question__label">' + escapeHtml(qu.label) + '</label>';
                html += '<div class="dgd-pulse-rating" data-question="' + qu.id + '">';
                for (var e = 0; e < qu.emojis.length; e++) {
                    html += '<button class="dgd-pulse-rating__btn" data-value="' + (e + 1) + '">' + qu.emojis[e] + '</button>';
                }
                html += '</div></div>';
            }

            html += '<button class="dgd-btn dgd-btn--primary dgd-mt-md" id="pulse-submit-btn">Absenden</button>';
        }
        html += '</div>';

        // Weekly trend chart
        html += '<div class="dgd-section-card" style="animation-delay:0.15s">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
        html += ' Woechentlicher Trend (12 Wochen)</div>';
        html += renderPulseTrendChart(DEMO_FEEDBACK.trends);
        html += '</div>';

        return html;
    }

    function renderPulseTrendChart(trends) {
        var w = 600, h = 200, padL = 40, padR = 20, padT = 20, padB = 40;
        var chartW = w - padL - padR;
        var chartH = h - padT - padB;
        var colors = { satisfaction: '#27ae60', workload: '#f39c12', teamspirit: '#3498db' };
        var labels = { satisfaction: 'Zufriedenheit', workload: 'Workload', teamspirit: 'Team-Spirit' };

        var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto;display:block;" preserveAspectRatio="xMidYMid meet">';

        // Y axis (1-5 scale)
        for (var y = 1; y <= 5; y++) {
            var yPos = padT + chartH - ((y - 1) / 4) * chartH;
            svg += '<line x1="' + padL + '" y1="' + yPos + '" x2="' + (w - padR) + '" y2="' + yPos + '" stroke="var(--dgd-gray-200)" stroke-width="1"/>';
            svg += '<text x="' + (padL - 8) + '" y="' + (yPos + 4) + '" text-anchor="end" fill="var(--dgd-gray-500)" font-size="11" font-family="inherit">' + y + '</text>';
        }

        // X axis labels
        for (var xi = 0; xi < trends.length; xi++) {
            var xPos = padL + (xi / (trends.length - 1)) * chartW;
            svg += '<text x="' + xPos + '" y="' + (h - 10) + '" text-anchor="middle" fill="var(--dgd-gray-500)" font-size="10" font-family="inherit">' + escapeHtml(trends[xi].week) + '</text>';
        }

        // Draw lines for each metric
        var keys = ['satisfaction', 'workload', 'teamspirit'];
        for (var ki = 0; ki < keys.length; ki++) {
            var key = keys[ki];
            var points = [];
            for (var pi = 0; pi < trends.length; pi++) {
                var px = padL + (pi / (trends.length - 1)) * chartW;
                var py = padT + chartH - ((trends[pi][key] - 1) / 4) * chartH;
                points.push(px.toFixed(1) + ',' + py.toFixed(1));
            }
            svg += '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + colors[key] + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
            for (var di = 0; di < points.length; di++) {
                var dp = points[di].split(',');
                svg += '<circle cx="' + dp[0] + '" cy="' + dp[1] + '" r="3" fill="' + colors[key] + '" stroke="#fff" stroke-width="1.5"/>';
            }
        }

        svg += '</svg>';

        // Legend
        svg += '<div style="display:flex;gap:1.5rem;justify-content:center;margin-top:0.75rem;font-size:0.8rem;">';
        for (var li = 0; li < keys.length; li++) {
            svg += '<span style="display:flex;align-items:center;gap:0.35rem;"><span style="width:12px;height:3px;background:' + colors[keys[li]] + ';border-radius:2px;display:inline-block;"></span> ' + labels[keys[li]] + '</span>';
        }
        svg += '</div>';

        return svg;
    }

    function renderSurveysTab() {
        var html = '';

        html += '<div class="dgd-section-card" style="animation-delay:0.05s">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">';
        html += '<div class="dgd-section-card__title" style="margin-bottom:0">Umfrage-Vorlagen</div>';
        html += '</div>';

        for (var t = 0; t < DEMO_FEEDBACK.templates.length; t++) {
            var tpl = DEMO_FEEDBACK.templates[t];
            var typeBadgeClass = tpl.type === 'pulse' ? 'aktiv' : (tpl.type === '360' ? 'portal' : 'intern');
            var participation = tpl.responses > 0 ? Math.round((tpl.responses / 50) * 100) : 0;
            html += '<div class="dgd-survey-item">';
            html += '<div class="dgd-survey-item__header">';
            html += '<div><strong>' + escapeHtml(tpl.title) + '</strong>';
            html += ' <span class="dgd-badge dgd-badge--' + typeBadgeClass + '">' + escapeHtml(tpl.type) + '</span>';
            if (!tpl.active) html += ' <span class="dgd-badge dgd-badge--pausiert">Inaktiv</span>';
            html += '</div></div>';
            html += '<div class="dgd-survey-item__stats">';
            html += '<span>' + tpl.questions + ' Fragen</span>';
            html += '<span>' + tpl.responses + ' Antworten</span>';
            html += '<span>Teilnahme: ' + participation + '%</span>';
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';

        return html;
    }

    function renderErgebnisseTab() {
        var html = '';

        html += '<div class="dgd-section-card" style="animation-delay:0.05s">';
        html += '<div class="dgd-section-card__title">Ergebnisse: Woechentlicher Pulse Check</div>';
        html += '<p style="color:var(--dgd-gray-600);font-size:var(--dgd-font-size-sm);margin-bottom:1rem;">Aggregierte Ergebnisse der letzten 6 Wochen (anonym)</p>';

        var avgSat = 0, avgWork = 0, avgTeam = 0;
        var trends = DEMO_FEEDBACK.trends;
        for (var i = 0; i < trends.length; i++) {
            avgSat += trends[i].satisfaction;
            avgWork += trends[i].workload;
            avgTeam += trends[i].teamspirit;
        }
        avgSat = (avgSat / trends.length).toFixed(1);
        avgWork = (avgWork / trends.length).toFixed(1);
        avgTeam = (avgTeam / trends.length).toFixed(1);

        var metrics = [
            { label: 'Zufriedenheit', avg: avgSat, color: '#27ae60' },
            { label: 'Workload', avg: avgWork, color: '#f39c12' },
            { label: 'Team-Spirit', avg: avgTeam, color: '#3498db' }
        ];

        for (var m = 0; m < metrics.length; m++) {
            var met = metrics[m];
            var barPct = ((met.avg - 1) / 4) * 100;
            html += '<div style="margin-bottom:1rem;">';
            html += '<div style="display:flex;justify-content:space-between;margin-bottom:0.35rem;font-size:var(--dgd-font-size-sm);font-weight:600;">';
            html += '<span>' + met.label + '</span><span style="color:' + met.color + '">' + met.avg + ' / 5</span></div>';
            html += '<div style="height:8px;background:var(--dgd-gray-200);border-radius:4px;">';
            html += '<div style="width:' + barPct + '%;height:100%;background:' + met.color + ';border-radius:4px;transition:width 0.6s ease;"></div>';
            html += '</div></div>';
        }

        html += '<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--dgd-gray-200);">';
        html += '<div style="font-size:var(--dgd-font-size-sm);color:var(--dgd-gray-600);">Teilnahmerate: <strong>90%</strong> (45 von 50 Mitarbeitern)</div>';
        html += '</div>';
        html += '</div>';

        return html;
    }

    /* ======================================================================
       View: Showcase Builder
       ====================================================================== */

    var _showcaseMounted = false;

    function renderShowcase(container) {
        // Destroy previous instance if switching away and back
        if (_showcaseMounted && typeof ShowcaseBuilder !== 'undefined' && ShowcaseBuilder.destroy) {
            ShowcaseBuilder.destroy();
        }

        container.innerHTML = '<div id="showcase-builder-mount" style="margin:-1.5rem;min-height:calc(100vh - 64px)"></div>';

        setTimeout(function() {
            if (typeof ShowcaseBuilder !== 'undefined') {
                ShowcaseBuilder.mount('showcase-builder-mount');
                _showcaseMounted = true;
            } else {
                container.innerHTML = '<div class="dgd-section-card">' +
                    '<div class="dgd-section-card__title">Showcase Builder</div>' +
                    '<p style="color:var(--dgd-gray-500)">Builder-Skripte konnten nicht geladen werden.</p>' +
                    '</div>';
            }
        }, 50);
    }

    /* ======================================================================
       View: Settings
       ====================================================================== */

    function renderSettings(container) {
        var user = state.user || {};
        var html = '';

        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Einstellungen</h1>';
        html += '</div>';

        // Profile section
        html += '<div class="dgd-section-card">';
        html += '<div class="dgd-section-card__title">Profil</div>';
        html += '<form id="settings-profile-form" class="dgd-form">';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Benutzername</label>';
        html += '<input type="text" class="dgd-form__input" value="' + escapeHtml(user.username) + '" disabled>';
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Anzeigename</label>';
        html += '<input type="text" class="dgd-form__input" id="settings-displayname" value="' + escapeHtml(user.display_name || '') + '">';
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">E-Mail</label>';
        html += '<input type="email" class="dgd-form__input" id="settings-email" value="' + escapeHtml(user.email || '') + '">';
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Rolle</label>';
        html += '<input type="text" class="dgd-form__input" value="' + escapeHtml(user.role || 'user') + '" disabled>';
        html += '</div>';
        html += '</form>';
        html += '</div>';

        // Invite codes section (admin only)
        if (user.role === 'admin') {
            html += '<div class="dgd-section-card" style="animation-delay:0.1s;">';
            html += '<div class="dgd-section-card__title">Einladungscodes</div>';
            html += '<table class="dgd-table">';
            html += '<thead><tr><th>Code</th><th>Status</th><th>Ablaufdatum</th></tr></thead>';
            html += '<tbody>';
            if (state.inviteCodes.length === 0) {
                html += '<tr><td colspan="3" class="dgd-table__empty">Keine Einladungscodes vorhanden.</td></tr>';
            } else {
                for (var i = 0; i < state.inviteCodes.length; i++) {
                    var ic = state.inviteCodes[i];
                    var statusBadge = ic.used_by
                        ? '<span class="dgd-badge dgd-badge--abgeschlossen">Verwendet</span>'
                        : '<span class="dgd-badge dgd-badge--aktiv">Verfuegbar</span>';
                    html += '<tr>';
                    html += '<td><code>' + escapeHtml(ic.code) + '</code></td>';
                    html += '<td>' + statusBadge + '</td>';
                    html += '<td>' + (ic.expires_at ? formatDate(ic.expires_at) : 'Unbegrenzt') + '</td>';
                    html += '</tr>';
                }
            }
            html += '</tbody></table>';
            html += '<div style="margin-top:1rem;">';
            html += '<button class="dgd-btn dgd-btn--primary dgd-btn--sm" id="btn-new-invite">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
            html += ' Neuen Code erstellen</button>';
            html += '</div>';
            html += '</div>';
        }

        // Integrations & APIs section
        html += '<div class="dgd-section-card" style="animation-delay:0.2s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
        html += ' Integrationen &amp; APIs</div>';

        // Define all integrations
        var integrations = [
            {
                name: 'TellentHR / KiwiHR',
                description: 'Mitarbeiterverwaltung, Abwesenheiten, Teams',
                icon: '&#128101;',
                connected: state.tellentAvailable,
                detail: state.tellentAvailable
                    ? (state.tellentInfo.employeeCount || 0) + ' Mitarbeiter geladen'
                    : (state.tellentInfo && state.tellentInfo.error ? state.tellentInfo.error : 'API-Key in .env konfigurieren'),
                link: '#mitarbeiter',
            },
            {
                name: 'DGD Portal API',
                description: 'Partner, Gutachter-Suche, Warteliste',
                icon: '&#127760;',
                connected: !state.demoMode,
                detail: !state.demoMode ? 'Verbunden mit dgd.digital' : 'Lokal im Demo-Modus',
                link: null,
            },
            {
                name: 'Dashboard API',
                description: 'Projekte, KPIs, Benutzerverwaltung',
                icon: '&#128202;',
                connected: !state.demoMode,
                detail: !state.demoMode
                    ? state.projects.length + ' Projekte, ' + state.kpis.length + ' KPIs'
                    : 'Demo-Daten aktiv',
                link: null,
            },
        ];

        html += '<div class="dgd-integrations">';
        for (var ig = 0; ig < integrations.length; ig++) {
            var intg = integrations[ig];
            var connClass = intg.connected ? 'connected' : 'disconnected';
            html += '<div class="dgd-integration-row">';
            html += '<div class="dgd-integration-row__icon">' + intg.icon + '</div>';
            html += '<div class="dgd-integration-row__info">';
            html += '<div class="dgd-integration-row__name">' + escapeHtml(intg.name) + '</div>';
            html += '<div class="dgd-integration-row__desc">' + escapeHtml(intg.description) + '</div>';
            html += '</div>';
            html += '<div class="dgd-integration-row__status">';
            html += '<span class="dgd-integration-badge dgd-integration-badge--' + connClass + '">';
            html += '<span class="dgd-integration-badge__dot"></span>';
            html += (intg.connected ? 'Verbunden' : 'Nicht verbunden');
            html += '</span>';
            html += '<div class="dgd-integration-row__detail">' + escapeHtml(intg.detail) + '</div>';
            html += '</div>';
            if (intg.link) {
                html += '<a href="' + intg.link + '" class="dgd-btn dgd-btn--outline dgd-btn--sm">&ouml;ffnen</a>';
            }
            html += '</div>';
        }
        html += '</div></div>';

        // Demo mode indicator
        if (state.demoMode) {
            html += '<div class="dgd-alert dgd-alert--info">';
            html += '<strong>Demo-Modus:</strong> API nicht verfuegbar. Alle Daten sind lokale Beispieldaten.';
            html += '</div>';
        }

        container.innerHTML = html;

        // Bind invite code creation
        var btnInvite = document.getElementById('btn-new-invite');
        if (btnInvite) {
            btnInvite.addEventListener('click', function() {
                createInviteCode();
            });
        }
    }

    function createInviteCode() {
        // Generate a random code
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var seg1 = '', seg2 = '';
        for (var i = 0; i < 4; i++) {
            seg1 += chars.charAt(Math.floor(Math.random() * chars.length));
            seg2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        var code = 'DGD-' + seg1 + '-' + seg2;

        if (state.demoMode) {
            state.inviteCodes.push({
                id: 'ic' + Date.now(),
                code: code,
                created_by: state.user.username,
                used_by: null,
                expires_at: '2026-12-31',
            });
            renderSettings($('#main-content'));
        } else {
            dashboardApi.createInviteCode({ code: code }).then(function() {
                loadData();
                setTimeout(function() { renderSettings($('#main-content')); }, 300);
            });
        }
    }

    /* ======================================================================
       Anomaly Detection
       ====================================================================== */

    function detectAnomalies() {
        var anomalies = [];
        var attendance = state.attendance || [];
        var employees = state.employees || [];

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
                    description: 'Niedrige Anwesenheit: ' + attPercent + '% (' + trackedH + 'h von ' + expectedH + 'h erwartet)',
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
                    description: 'Hohe Abwesenheit: ' + timeOffH + 'h (' + timeOffPercent + '% der Sollzeit)',
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
                    description: 'Negativer Saldo: ' + balanceH + 'h (Unterzeit)',
                    value: balanceH,
                });
            }

            // 4. Very high overtime (>30h) — could indicate overwork
            if (overtimeH > 30) {
                anomalies.push({
                    type: 'high_overtime',
                    severity: overtimeH > 50 ? 'high' : 'low',
                    employeeId: att.user.id,
                    employeeName: empName,
                    description: 'Hohe Ueberstunden: ' + overtimeH + 'h',
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
                    description: 'Keine Zeiterfassung trotz ' + expectedH + 'h Sollzeit',
                    value: 0,
                });
            }
        }

        // Sort by severity (high first)
        var severityOrder = { high: 0, medium: 1, low: 2 };
        anomalies.sort(function(a, b) {
            return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
        });

        state.anomalies = anomalies;
        console.log('[Anomaly] Detected ' + anomalies.length + ' anomalies');

        // Notify Cortex about anomalies if there are high-severity ones
        if (anomalies.length > 0) {
            notifyCortexAnomalies(anomalies);
        }
    }

    function notifyCortexAnomalies(anomalies) {
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
            fetch('http://localhost:8000/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                body: JSON.stringify({
                    user_message: '[SYSTEM-ALERT: DGD Dashboard Anomalie-Erkennung]\n' +
                        highSeverity.length + ' kritische Anomalien im Mitarbeiter-Tracking erkannt:\n' +
                        highSeverity.map(function(a) { return '- ' + a.employeeName + ': ' + a.description; }).join('\n') +
                        '\n\nBitte informiere David bei naechster Gelegenheit ueber diese Auffaelligkeiten.',
                    conversation_history: [],
                }),
            }).catch(function() { /* Cortex may be offline */ });
        } catch(e) { /* Cortex may be offline */ }

        console.log('[Anomaly] Sent ' + highSeverity.length + ' high-severity alerts to Cortex');
    }

    /* ======================================================================
       Employee Work Chart (SVG)
       ====================================================================== */

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

        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dgd-chart-svg" xmlns="http://www.w3.org/2000/svg">';

        // Y-axis grid lines
        var gridSteps = 4;
        var stepVal = maxVal / gridSteps;
        for (var g = 0; g <= gridSteps; g++) {
            var yVal = Math.round(g * stepVal);
            var yPos = pad.top + cH - (yVal / maxVal * cH);
            svg += '<line x1="' + pad.left + '" y1="' + yPos + '" x2="' + (W - pad.right) + '" y2="' + yPos + '" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="' + (g > 0 ? '4,3' : '') + '"/>';
            svg += '<text x="' + (pad.left - 6) + '" y="' + (yPos + 3.5) + '" text-anchor="end" fill="#94a3b8" font-size="9.5" font-family="inherit">' + yVal + 'h</text>';
        }

        // Baseline
        svg += '<line x1="' + pad.left + '" y1="' + (pad.top + cH) + '" x2="' + (W - pad.right) + '" y2="' + (pad.top + cH) + '" stroke="#94a3b8" stroke-width="1"/>';

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
            svg += '<rect x="' + (cx - barW - gap / 2) + '" y="' + sollY + '" width="' + barW + '" height="' + sollH + '" rx="3" fill="#cbd5e1" opacity="0.85">';
            svg += '<title>Soll: ' + d.soll + 'h (' + d.fullLabel + (d.isCurrent ? ' - laufend' : '') + ')</title></rect>';

            // Ist bar (color-coded) — current month always green (incomplete data)
            var istH = d.ist / maxVal * cH;
            var istY = pad.top + cH - istH;
            var istColor = '#22c55e';
            if (d.soll > 0 && !d.isCurrent) {
                var ratio = d.ist / d.soll;
                istColor = ratio >= 0.9 ? '#22c55e' : (ratio >= 0.7 ? '#f59e0b' : '#ef4444');
            }
            svg += '<rect x="' + (cx + gap / 2) + '" y="' + istY + '" width="' + barW + '" height="' + istH + '" rx="3" fill="' + istColor + '">';
            svg += '<title>Ist: ' + d.ist + 'h (' + d.fullLabel + (d.isCurrent ? ' - laufend' : '') + ')</title></rect>';

            // Stripe overlay for current month
            if (d.isCurrent) {
                svg += '<rect x="' + (cx - barW - gap / 2) + '" y="' + sollY + '" width="' + barW + '" height="' + sollH + '" rx="3" fill="url(#stripe)" pointer-events="none"/>';
                svg += '<rect x="' + (cx + gap / 2) + '" y="' + istY + '" width="' + barW + '" height="' + istH + '" rx="3" fill="url(#stripe)" pointer-events="none"/>';
            }

            // Value labels on top of bars
            if (d.soll > 0) {
                svg += '<text x="' + (cx - barW / 2 - gap / 2) + '" y="' + (sollY - 5) + '" text-anchor="middle" fill="#64748b" font-size="9" font-weight="600">' + d.soll + '</text>';
            }
            if (d.ist > 0) {
                svg += '<text x="' + (cx + barW / 2 + gap / 2) + '" y="' + (istY - 5) + '" text-anchor="middle" fill="' + istColor + '" font-size="9" font-weight="600">' + d.ist + '</text>';
            }

            // Month label — mark current month
            var monthLabel = d.label + (d.isCurrent ? '*' : '');
            svg += '<text x="' + cx + '" y="' + (H - pad.bottom + 16) + '" text-anchor="middle" fill="#475569" font-size="11" font-weight="500">' + monthLabel + '</text>';

            // Overtime/deficit indicator (skip deficit for current month — incomplete)
            if (d.overtime > 0) {
                svg += '<text x="' + cx + '" y="' + (H - 4) + '" text-anchor="middle" fill="#f59e0b" font-size="8" font-weight="600">+' + d.overtime + 'h</text>';
            } else if (d.balance < 0 && !d.isCurrent) {
                svg += '<text x="' + cx + '" y="' + (H - 4) + '" text-anchor="middle" fill="#ef4444" font-size="8" font-weight="600">' + d.balance + 'h</text>';
            } else if (d.isCurrent) {
                svg += '<text x="' + cx + '" y="' + (H - 4) + '" text-anchor="middle" fill="#94a3b8" font-size="7.5" font-style="italic">laufend</text>';
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
        html += '<div class="dgd-chart-composition__title">Zeitaufteilung (3 Monate gesamt: ' + total + 'h)</div>';
        html += '<div class="dgd-chart-composition__bar">';
        for (var i = 0; i < segments.length; i++) {
            var pct = total > 0 ? (segments[i].value / total * 100) : 0;
            if (pct < 0.5) continue;
            html += '<div class="dgd-chart-composition__segment" style="width:' + pct.toFixed(1) + '%;background:' + segments[i].color + '" title="' + segments[i].label + ': ' + segments[i].value + 'h (' + Math.round(pct) + '%)"></div>';
        }
        html += '</div>';

        html += '<div class="dgd-chart-composition__legend">';
        for (var i = 0; i < segments.length; i++) {
            if (segments[i].value <= 0) continue;
            var pct2 = total > 0 ? Math.round(segments[i].value / total * 100) : 0;
            html += '<span class="dgd-chart-composition__item">';
            html += '<span class="dgd-chart-legend__dot" style="background:' + segments[i].color + '"></span>';
            html += escapeHtml(segments[i].label) + ' <strong>' + segments[i].value + 'h</strong> (' + pct2 + '%)';
            html += '</span>';
        }
        html += '</div>';
        html += '</div>';

        return html;
    }

    /* ======================================================================
       Employee Detail Modal
       ====================================================================== */

    function openEmployeeDetail(empId) {
        var emp = null;
        for (var i = 0; i < state.employees.length; i++) {
            if (state.employees[i].id === empId) { emp = state.employees[i]; break; }
        }
        if (!emp) return;

        var empName = emp.firstName + ' ' + emp.lastName;
        var initials = (emp.firstName || '?')[0] + (emp.lastName || '?')[0];

        // Find attendance data
        var attData = null;
        for (var a = 0; a < (state.attendance || []).length; a++) {
            if (state.attendance[a].user && state.attendance[a].user.id === empId) {
                attData = state.attendance[a]; break;
            }
        }

        // Find time-off balances for this employee
        var empBalances = [];
        for (var b = 0; b < (state.timeOffBalances || []).length; b++) {
            var bal = state.timeOffBalances[b];
            if (bal.user && bal.user.id === empId) {
                empBalances.push(bal);
            }
        }

        // Find overtime
        var empOvertime = null;
        for (var o = 0; o < (state.overtime || []).length; o++) {
            if (state.overtime[o].user && state.overtime[o].user.id === empId) {
                empOvertime = state.overtime[o]; break;
            }
        }

        // Find anomalies for this employee
        var empAnomalies = [];
        for (var an = 0; an < (state.anomalies || []).length; an++) {
            if (state.anomalies[an].employeeId === empId) {
                empAnomalies.push(state.anomalies[an]);
            }
        }

        // Build modal HTML
        var html = '<div class="dgd-modal-overlay" id="emp-modal-overlay">';
        html += '<div class="dgd-modal dgd-modal--lg">';

        // Header
        html += '<div class="dgd-modal__header">';
        html += '<div style="display:flex;align-items:center;gap:12px">';
        html += '<div class="dgd-staff-avatar dgd-staff-avatar--lg">' + escapeHtml(initials) + '</div>';
        html += '<div><h3 style="margin:0">' + escapeHtml(empName) + '</h3>';
        html += '<div class="dgd-text-muted">' + escapeHtml((emp.position && emp.position.name) || 'Keine Position') + '</div></div>';
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
        html += '<div class="dgd-emp-card__row"><span>E-Mail</span><span>' + escapeHtml(emp.email || '—') + '</span></div>';
        html += '<div class="dgd-emp-card__row"><span>Team</span><span>' + escapeHtml((emp.team && emp.team.name) || '—') + '</span></div>';
        html += '<div class="dgd-emp-card__row"><span>Position</span><span>' + escapeHtml((emp.position && emp.position.name) || '—') + '</span></div>';
        html += '<div class="dgd-emp-card__row"><span>Status</span><span class="dgd-staff-status dgd-staff-status--' + (emp.isActive ? 'active' : 'inactive') + '">' + (emp.isActive ? 'Aktiv' : 'Inaktiv') + '</span></div>';
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
            html += '<div class="dgd-emp-attendance-bar__track"><div class="dgd-emp-attendance-bar__fill" style="width:' + Math.min(pct, 100) + '%;background:' + pctColor + '"></div></div>';
            html += '<span style="font-weight:600;color:' + pctColor + '">' + pct + '%</span>';
            html += '</div>';
            html += '<div class="dgd-emp-card__row"><span>Gearbeitete Zeit</span><strong>' + tH + 'h</strong></div>';
            html += '<div class="dgd-emp-card__row"><span>Sollzeit</span><span>' + eH + 'h</span></div>';
            html += '<div class="dgd-emp-card__row"><span>Urlaub/Abwesenheit</span><span>' + toH + 'h</span></div>';
            html += '<div class="dgd-emp-card__row"><span>Feiertage</span><span>' + holH + 'h</span></div>';
            html += '<div class="dgd-emp-card__row"><span>Saldo</span><span style="color:' + (balH >= 0 ? '#22c55e' : '#ef4444') + ';font-weight:600">' + (balH >= 0 ? '+' : '') + balH + 'h</span></div>';
            html += '<div class="dgd-emp-card__row"><span>Ueberstunden</span><span>' + ovH + 'h</span></div>';
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
                html += '<span style="color:' + typeColor + ';font-weight:600">' + escapeHtml(typeName) + '</span>';
                html += '<span>' + used + ' / ' + total + ' Tage</span>';
                html += '</div>';
                html += '<div class="dgd-emp-attendance-bar__track"><div class="dgd-emp-attendance-bar__fill" style="width:' + usedPct + '%;background:' + typeColor + '"></div></div>';
                html += '<div class="dgd-emp-card__row dgd-text-sm"><span>Verfuegbar</span><span>' + avail + ' Tage</span></div>';
                html += '</div>';
            }
            html += '</div></div>';
        }

        // Overtime
        if (empOvertime) {
            var otBalance = Math.round((empOvertime.balance || 0) / 3600);
            html += '<div class="dgd-emp-card" style="margin-top:1rem">';
            html += '<div class="dgd-emp-card__title">&#9200; Ueberstundenkonto</div>';
            html += '<div class="dgd-emp-card__row"><span>Gesamtsaldo</span><span style="font-weight:700;font-size:1.25rem;color:' + (otBalance >= 0 ? '#22c55e' : '#ef4444') + '">' + (otBalance >= 0 ? '+' : '') + otBalance + 'h</span></div>';
            html += '</div>';
        }

        // Anomalies
        if (empAnomalies.length > 0) {
            html += '<div class="dgd-emp-card dgd-emp-card--warning" style="margin-top:1rem">';
            html += '<div class="dgd-emp-card__title">&#9888; Erkannte Anomalien</div>';
            for (var ea = 0; ea < empAnomalies.length; ea++) {
                var anomaly = empAnomalies[ea];
                var sevClass = 'dgd-anomaly-sev--' + anomaly.severity;
                html += '<div class="dgd-anomaly-detail ' + sevClass + '">';
                html += '<span class="dgd-anomaly-detail__sev">' + anomaly.severity.toUpperCase() + '</span>';
                html += '<span>' + escapeHtml(anomaly.description) + '</span>';
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

    /* ======================================================================
       Project Modal (Create / Edit)
       ====================================================================== */

    function openProjectModal(projectId) {
        var project = null;
        if (projectId) {
            for (var i = 0; i < state.projects.length; i++) {
                if (state.projects[i].id === projectId) {
                    project = state.projects[i];
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
        html += '<h3>' + escapeHtml(title) + '</h3>';
        html += '<button class="dgd-modal__close" id="modal-close">&times;</button>';
        html += '</div>';

        // Body
        html += '<div class="dgd-modal__body">';
        html += '<form id="project-form" class="dgd-form">';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Titel</label>';
        html += '<input type="text" class="dgd-form__input" id="proj-title" value="' + escapeHtml(p.title) + '" required>';
        html += '</div>';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Beschreibung</label>';
        html += '<textarea class="dgd-form__input" id="proj-desc" rows="3">' + escapeHtml(p.description) + '</textarea>';
        html += '</div>';

        // Row: Category + Status
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Kategorie</label>';
        html += '<select class="dgd-form__input" id="proj-category">';
        for (var ci = 0; ci < categories.length; ci++) {
            var sel = p.category === categories[ci].value ? ' selected' : '';
            html += '<option value="' + categories[ci].value + '"' + sel + '>' + escapeHtml(categories[ci].label) + '</option>';
        }
        html += '</select></div>';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Status</label>';
        html += '<select class="dgd-form__input" id="proj-status">';
        for (var si = 0; si < statuses.length; si++) {
            var selS = p.status === statuses[si].value ? ' selected' : '';
            html += '<option value="' + statuses[si].value + '"' + selS + '>' + escapeHtml(statuses[si].label) + '</option>';
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
            html += '<option value="' + priorities[pi].value + '"' + selP + '>' + escapeHtml(priorities[pi].label) + '</option>';
        }
        html += '</select></div>';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Fortschritt (%)</label>';
        html += '<input type="number" class="dgd-form__input" id="proj-progress" min="0" max="100" value="' + (p.progress || 0) + '">';
        html += '</div>';
        html += '</div>';

        // Row: Dates
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Startdatum</label>';
        html += '<input type="date" class="dgd-form__input" id="proj-start" value="' + escapeHtml(p.start_date) + '">';
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Enddatum</label>';
        html += '<input type="date" class="dgd-form__input" id="proj-end" value="' + escapeHtml(p.end_date) + '">';
        html += '</div>';
        html += '</div>';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Verantwortlich</label>';
        html += '<input type="text" class="dgd-form__input" id="proj-owner" value="' + escapeHtml(p.owner || '') + '">';
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

            if (state.demoMode) {
                if (isEdit) {
                    // Update in local state
                    for (var ui = 0; ui < state.projects.length; ui++) {
                        if (state.projects[ui].id === project.id) {
                            for (var key in data) {
                                state.projects[ui][key] = data[key];
                            }
                            break;
                        }
                    }
                } else {
                    // Create in local state
                    data.id = 'p' + Date.now();
                    data.milestones = [];
                    state.projects.push(data);
                }
                closeModal();
                route();
            } else {
                var promise = isEdit
                    ? dashboardApi.updateProject(project.id, data)
                    : dashboardApi.createProject(data);
                promise.then(function() {
                    loadData();
                    closeModal();
                    setTimeout(route, 300);
                });
            }
        });
    }

    /* ======================================================================
       Sidebar Toggle (Desktop + Mobile)
       ====================================================================== */

    function toggleSidebar() {
        var sidebar = $('#sidebar');
        var main = $('#main');
        var isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // Mobile: slide in/out as overlay
            sidebar.classList.toggle('dgd-sidebar--open');
            sidebar.classList.remove('dgd-sidebar--collapsed');
        } else {
            // Desktop: collapse/expand with margin shift
            var collapsed = sidebar.classList.toggle('dgd-sidebar--collapsed');
            main.classList.toggle('dgd-main--expanded', collapsed);
            // Persist preference
            try { localStorage.setItem('dgd-sidebar-collapsed', collapsed ? '1' : ''); } catch(e) {}
        }
    }

    function restoreSidebarState() {
        try {
            if (localStorage.getItem('dgd-sidebar-collapsed') === '1' && window.innerWidth > 768) {
                $('#sidebar').classList.add('dgd-sidebar--collapsed');
                $('#main').classList.add('dgd-main--expanded');
            }
        } catch(e) {}
    }

    /* ======================================================================
       Init
       ====================================================================== */

    function init() {
        // Auth form
        $('#login-form').addEventListener('submit', handleLoginSubmit);
        $('#auth-toggle').addEventListener('click', toggleAuthMode);

        // Logout
        $('#logout-btn').addEventListener('click', logout);

        // Sidebar toggle (burger menu)
        $('#sidebar-toggle').addEventListener('click', toggleSidebar);
        restoreSidebarState();

        // Sidebar nav links (close sidebar on mobile after click)
        var navLinks = $$('.dgd-sidebar__link');
        for (var i = 0; i < navLinks.length; i++) {
            navLinks[i].addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    $('#sidebar').classList.remove('dgd-sidebar--open');
                }
            });
        }

        // Hash routing
        window.addEventListener('hashchange', route);

        // Check authentication
        checkAuth();
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
