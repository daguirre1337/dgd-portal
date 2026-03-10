/* ==========================================================================
   DGD Dashboard - Demo / Fallback Data
   Used when the real API is unavailable.
   Depends on: namespace.js
   ========================================================================== */

window.DGD = window.DGD || {};

DGD.demoData = {

    /* ------------------------------------------------------------------
       User & Invite Codes
       ------------------------------------------------------------------ */

    DEMO_USER: {
        id: 'demo', username: 'admin', display_name: 'Administrator',
        role: 'admin', email: 'admin@dgd.digital'
    },

    DEMO_INVITE_CODES: [
        { id: 'ic1', code: 'DEMO-CODE-1', created_by: null, used_by: null, expires_at: '2026-12-31' },
        { id: 'ic2', code: 'DEMO-CODE-2', created_by: null, used_by: null, expires_at: '2026-12-31' }
    ],

    /* ------------------------------------------------------------------
       Projects
       ------------------------------------------------------------------ */

    DEMO_PROJECTS: [
        {
            id: 'p1', title: 'DGD Portal Launch',
            description: 'Kundenportal dgd.digital mit Gutachter-Suche, Schadensmeldung und Partner-Registrierung.',
            category: 'portal', status: 'abgeschlossen', priority: 'hoch',
            start_date: '2026-01-15', end_date: '2026-03-01', progress: 100, owner: 'Daniel',
            tags: 'web,launch',
            milestones: [
                { title: 'Design fertig', date: '2026-01-25', completed: 1 },
                { title: 'Beta-Test', date: '2026-02-15', completed: 1 },
                { title: 'Go-Live', date: '2026-03-01', completed: 1 }
            ]
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
                { title: '50 Partner', date: '2026-06-30', completed: 0 }
            ]
        },
        {
            id: 'p3', title: 'Marketing Kampagne Q2',
            description: 'Online-Marketing: Google Ads, Social Media, Content Marketing fuer mehr Sichtbarkeit.',
            category: 'marketing', status: 'geplant', priority: 'mittel',
            start_date: '2026-04-01', end_date: '2026-06-30', progress: 0, owner: 'Marketing',
            tags: 'ads,social',
            milestones: [
                { title: 'Strategie festlegen', date: '2026-04-05', completed: 0 },
                { title: 'Kampagnen live', date: '2026-04-15', completed: 0 }
            ]
        },
        {
            id: 'p4', title: 'Schadenfall-Automatisierung',
            description: 'Automatisierte Schadenfall-Verarbeitung mit KI-gestuetzter Dokumentenanalyse.',
            category: 'intern', status: 'aktiv', priority: 'mittel',
            start_date: '2026-03-01', end_date: '2026-08-31', progress: 20, owner: 'Tech-Team',
            tags: 'ai,automation',
            milestones: [
                { title: 'Konzept', date: '2026-03-15', completed: 1 },
                { title: 'Prototyp', date: '2026-05-31', completed: 0 }
            ]
        },
        {
            id: 'p5', title: 'Kundenportal v2',
            description: 'Erweiterung: Kunden-Login, Echtzeit-Status, Dokumenten-Upload, Chat.',
            category: 'portal', status: 'geplant', priority: 'niedrig',
            start_date: '2026-07-01', end_date: '2026-12-31', progress: 0, owner: 'Tech-Team',
            tags: 'web,portal',
            milestones: [
                { title: 'Anforderungen', date: '2026-07-15', completed: 0 },
                { title: 'MVP', date: '2026-10-01', completed: 0 }
            ]
        }
    ],

    /* ------------------------------------------------------------------
       KPIs
       ------------------------------------------------------------------ */

    DEMO_KPIS: [
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
          prevValue: 7200, daily: [6800,6850,6900,6950,7000,7050,7100,7100,7200,7250,7300,7350,7400,7500,7550,7600,7700,7750,7800,7850,7900,8000,8050,8100,8150,8200,8300,8400], monthly: [{label:'Dez',value:6200},{label:'Jan',value:7200},{label:'Feb',value:8100}] }
    ],

    /* ------------------------------------------------------------------
       Beteiligungsprogramm (Equity participation)
       ------------------------------------------------------------------ */

    BETEILIGUNG_CONFIG: {
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
    },

    getHourlyRate(positionName) {
        var cfg = DGD.demoData.BETEILIGUNG_CONFIG;
        if (!positionName) return cfg.defaultHourlyRate;
        for (var key in cfg.hourlyRates) {
            if (positionName.toLowerCase().indexOf(key.toLowerCase()) !== -1) {
                return cfg.hourlyRates[key];
            }
        }
        return cfg.defaultHourlyRate;
    },

    calcEquity(overtimeH, positionName) {
        var cfg = DGD.demoData.BETEILIGUNG_CONFIG;
        var rate = DGD.demoData.getHourlyRate(positionName);
        var value = Math.max(0, overtimeH) * rate;
        var pct = (value / cfg.companyValuation) * 100;
        return { rate: rate, value: value, pct: pct };
    },

    /* ------------------------------------------------------------------
       TimeSaved Config (Cortex AI savings)
       ------------------------------------------------------------------ */

    TIMESAVED_CONFIG: {
        features: [
            { id: 'anomaly-detection', name: 'Anomalie-Erkennung', hoursPerWeek: 2.0, activeFrom: '2025-03-01' },
            { id: 'auto-reports', name: 'Automatische Berichte', hoursPerWeek: 3.0, activeFrom: '2025-06-01' },
            { id: 'smart-search', name: 'Intelligente Suche', hoursPerWeek: 1.5, activeFrom: '2025-09-01' },
            { id: 'cortex-hr-analysis', name: 'Cortex HR-Analyse', hoursPerWeek: 2.5, activeFrom: '2026-01-01' }
        ],
        developerCompensationPct: 10
    },

    calcTimeSaved() {
        var now = new Date();
        var totalH = 0;
        var activeFeatures = 0;
        var weeklyRate = 0;
        var features = DGD.demoData.TIMESAVED_CONFIG.features;
        for (var i = 0; i < features.length; i++) {
            var f = features[i];
            var from = new Date(f.activeFrom);
            if (from > now) continue;
            activeFeatures++;
            weeklyRate += f.hoursPerWeek;
            var weeks = Math.max(0, (now - from) / (7 * 24 * 60 * 60 * 1000));
            totalH += Math.round(weeks * f.hoursPerWeek * 10) / 10;
        }
        return { totalH: Math.round(totalH), activeFeatures: activeFeatures, weeklyRate: weeklyRate };
    },

    /* ------------------------------------------------------------------
       Finance
       ------------------------------------------------------------------ */

    DEMO_FINANCE: {
        summary: { revenue: 28500, costs: 18200, profit: 10300, burnRate: 17800 },
        monthly: [
            { month: 'Okt', revenue: 18000, costs: 15500 },
            { month: 'Nov', revenue: 21000, costs: 16200 },
            { month: 'Dez', revenue: 24500, costs: 17000 },
            { month: 'Jan', revenue: 22000, costs: 16800 },
            { month: 'Feb', revenue: 26200, costs: 17500 },
            { month: 'M\u00e4r', revenue: 28500, costs: 18200 }
        ],
        projects: [
            { name: 'DGD Portal Launch', budget: 25000, spent: 23800, status: 'abgeschlossen' },
            { name: 'Partner-Netzwerk Ausbau', budget: 15000, spent: 8200, status: 'aktiv' },
            { name: 'Marketing Kampagne Q2', budget: 12000, spent: 0, status: 'geplant' },
            { name: 'Schadenfall-Automatisierung', budget: 35000, spent: 9500, status: 'aktiv' },
            { name: 'Kundenportal v2', budget: 40000, spent: 0, status: 'geplant' }
        ],
        expenses: [
            { date: '2026-03-08', project: 'Partner-Netzwerk', desc: 'Google Ads Kampagne', amount: 1200, category: 'Marketing' },
            { date: '2026-03-07', project: 'Schadenfall-Auto.', desc: 'Claude API Credits', amount: 450, category: 'Cloud/API' },
            { date: '2026-03-06', project: 'DGD Portal', desc: 'Linevast Hosting Q2', amount: 180, category: 'Infrastruktur' },
            { date: '2026-03-05', project: 'Partner-Netzwerk', desc: 'Messe-Material Druck', amount: 890, category: 'Marketing' },
            { date: '2026-03-04', project: 'Allgemein', desc: 'Microsoft 365 Lizenzen', amount: 220, category: 'Lizenzen' },
            { date: '2026-03-03', project: 'Schadenfall-Auto.', desc: 'Testdaten-Aufbereitung', amount: 350, category: 'Entwicklung' },
            { date: '2026-03-01', project: 'Allgemein', desc: 'Bueromiete anteilig', amount: 1500, category: 'Betrieb' }
        ]
    },

    /* ------------------------------------------------------------------
       Goals / OKR
       ------------------------------------------------------------------ */

    DEMO_GOALS: [
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
    ],

    /* ------------------------------------------------------------------
       Feedback
       ------------------------------------------------------------------ */

    DEMO_FEEDBACK: {
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
    }
};
