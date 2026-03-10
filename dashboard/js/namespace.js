/* ==========================================================================
   DGD Dashboard - Global Namespace
   Must be loaded FIRST before any other DGD module.
   ========================================================================== */

window.DGD = window.DGD || {};

DGD.state = {
    currentView: 'dashboard',
    authenticated: false,
    user: null,
    projects: [],
    kpis: [],
    inviteCodes: [],
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
