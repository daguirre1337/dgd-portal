/* ==========================================================================
   DGD Dashboard - Global Namespace
   Must be loaded FIRST before any other DGD module.
   ========================================================================== */

window.DGD = window.DGD || {};

DGD.views = DGD.views || {};

DGD.config = {
    CATEGORY_COLORS: {
        portal:    '#8e44ad',
        marketing: '#e74c3c',
        partner:   '#e67e22',
        intern:    '#2980b9',
        kunde:     '#27ae60',
        umsatz:    '#27ae60',
        kunden:    '#2980b9',
        engagement:'#16a085',
    },
    CATEGORY_LABELS: {
        portal:    'Portal',
        marketing: 'Marketing',
        partner:   'Partner',
        intern:    'Intern',
        kunde:     'Kunde',
    },
    STATUS_LABELS: {
        geplant:       'Geplant',
        aktiv:         'Aktiv',
        abgeschlossen: 'Abgeschlossen',
        pausiert:      'Pausiert',
    },
};

DGD.state = {
    currentView: 'dashboard',
    authenticated: false,
    user: null,
    projects: [],
    kpis: [],
    inviteCodes: [],
    registeredUsers: [],
    isRegisterMode: false,
    demoMode: false,
    tellentAvailable: false,
    tellentData: null,
    employees: [],
    absences: [],
    attendance: [],
    timeOffBalances: [],
    overtime: [],
    anomalies: [],
    filters: { category: null, status: null }
};
