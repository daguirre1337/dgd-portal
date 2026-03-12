/* ==========================================================================
   DGD Dashboard - API Client
   Gracefully falls back to demo data when API is unavailable
   ========================================================================== */

var dashboardApi = {
    _base: 'api',

    _fetch: function(path, options) {
        options = options || {};
        return fetch(this._base + path, {
            credentials: 'same-origin',
            headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {}),
            method: options.method || 'GET',
            body: options.body || undefined,
        })
        .then(function(res) {
            if (res.status === 401) {
                if (window.DGD && DGD.state && DGD.state.demoMode) return null;
                window.location.hash = '#login';
                throw new Error('Nicht autorisiert');
            }
            return res.json().then(function(data) {
                if (!res.ok) throw new Error(data.error || 'API-Fehler');
                return data;
            });
        })
        .catch(function(err) {
            if (err.message === 'Nicht autorisiert') throw err;
            console.warn('[Dashboard API]', err.message);
            return null;
        });
    },

    login: function(username, password) {
        return this._fetch('/auth/login', { method: 'POST', body: JSON.stringify({ username: username, password: password }) });
    },

    register: function(data) {
        return this._fetch('/auth/register', { method: 'POST', body: JSON.stringify(data) });
    },

    logout: function() {
        return this._fetch('/auth/logout', { method: 'POST' });
    },

    me: function() {
        return this._fetch('/auth/me');
    },

    getProjects: function(filters) {
        var q = filters ? '?' + new URLSearchParams(filters) : '';
        return this._fetch('/projects' + q);
    },

    createProject: function(data) {
        return this._fetch('/projects', { method: 'POST', body: JSON.stringify(data) });
    },

    updateProject: function(id, data) {
        return this._fetch('/projects/' + id, { method: 'PUT', body: JSON.stringify(data) });
    },

    deleteProject: function(id) {
        return this._fetch('/projects/' + id, { method: 'DELETE' });
    },

    getKpis: function() {
        return this._fetch('/kpis');
    },

    updateKpi: function(data) {
        return this._fetch('/kpis', { method: 'POST', body: JSON.stringify(data) });
    },

    getInviteCodes: function() {
        return this._fetch('/invite-codes');
    },

    createInviteCode: function(data) {
        return this._fetch('/invite-codes', { method: 'POST', body: JSON.stringify(data) });
    },

    getUsers: function() {
        return this._fetch('/admin/users');
    },

    // Page Owners
    getPageOwners: function() {
        return this._fetch('/admin/page-owners');
    },
    updatePageOwner: function(viewName, ownerName) {
        return this._fetch('/admin/page-owners/' + viewName, { method: 'PUT', body: JSON.stringify({ owner_name: ownerName }) });
    },

    // CRM - Contacts
    getCrmContacts: function(filters) {
        var q = filters ? '?' + new URLSearchParams(filters) : '';
        return this._fetch('/crm/contacts' + q);
    },
    createCrmContact: function(data) {
        return this._fetch('/crm/contacts', { method: 'POST', body: JSON.stringify(data) });
    },
    updateCrmContact: function(id, data) {
        return this._fetch('/crm/contacts/' + id, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteCrmContact: function(id) {
        return this._fetch('/crm/contacts/' + id, { method: 'DELETE' });
    },
    getCrmContactInteractions: function(id) {
        return this._fetch('/crm/contacts/' + id + '/interactions');
    },

    // CRM - Deals
    getCrmDeals: function(filters) {
        var q = filters ? '?' + new URLSearchParams(filters) : '';
        return this._fetch('/crm/deals' + q);
    },
    createCrmDeal: function(data) {
        return this._fetch('/crm/deals', { method: 'POST', body: JSON.stringify(data) });
    },
    updateCrmDeal: function(id, data) {
        return this._fetch('/crm/deals/' + id, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteCrmDeal: function(id) {
        return this._fetch('/crm/deals/' + id, { method: 'DELETE' });
    },

    // CRM - Interactions
    createCrmInteraction: function(data) {
        return this._fetch('/crm/interactions', { method: 'POST', body: JSON.stringify(data) });
    },

    // CRM - Stats & Pipeline
    getCrmStats: function() {
        return this._fetch('/crm/stats');
    },
    getCrmPipeline: function() {
        return this._fetch('/crm/pipeline');
    },

    // CRM - Import
    importCrmTrello: function(data) {
        return this._fetch('/crm/import/trello', { method: 'POST', body: JSON.stringify(data) });
    },
};
