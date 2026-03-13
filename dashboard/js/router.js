/* ==========================================================================
   DGD Dashboard - Router Module
   Hash-based routing, view dispatching, sidebar active state
   ========================================================================== */

window.DGD = window.DGD || {};

DGD.router = (function() {
    'use strict';

    var $ = function(sel) { return document.querySelector(sel); };
    var $$ = function(sel) { return document.querySelectorAll(sel); };

    var VALID_VIEWS = [
        'dashboard', 'timeline', 'kpis', 'mitarbeiter',
        'finanzen', 'ziele', 'feedback', 'roadmap', 'crm', 'showcase', 'settings', 'admin'
    ];

    var VIEW_TITLES = {
        dashboard: 'Dashboard',
        timeline: 'Zeitleiste',
        kpis: 'KPI Cockpit',
        mitarbeiter: 'Mitarbeiter',
        finanzen: 'Finanzen',
        ziele: 'Ziele & OKR',
        feedback: 'Feedback',
        roadmap: 'Strategische Roadmap',
        crm: 'CRM',
        showcase: 'Showcase Builder',
        settings: 'Einstellungen',
        admin: 'Admin',
    };

    // Cache for page owners
    var _pageOwners = null;

    function loadPageOwners() {
        if (_pageOwners) return Promise.resolve(_pageOwners);
        return dashboardApi.getPageOwners().then(function(data) {
            _pageOwners = (data && data.owners) || {};
            return _pageOwners;
        }).catch(function() { return {}; });
    }

    function renderPageOwner(viewName) {
        var badge = $('#page-owner-badge');
        if (!badge) return;

        loadPageOwners().then(function(owners) {
            var owner = owners[viewName] || 'Daniel';
            badge.textContent = 'Verantwortlich: ' + owner;
            badge.setAttribute('data-view', viewName);
            badge.style.display = '';

            // Admin can click to change
            var isAdmin = DGD.state.user && DGD.state.user.role === 'admin';
            badge.style.cursor = isAdmin ? 'pointer' : 'default';
            badge.onclick = isAdmin ? function() { promptPageOwner(viewName, owner); } : null;
        });
    }

    function promptPageOwner(viewName, currentOwner) {
        var newOwner = prompt('Verantwortlichen aendern fuer "' + (VIEW_TITLES[viewName] || viewName) + '":', currentOwner);
        if (newOwner && newOwner.trim() && newOwner.trim() !== currentOwner) {
            dashboardApi.updatePageOwner(viewName, newOwner.trim()).then(function(res) {
                if (res) {
                    _pageOwners[viewName] = newOwner.trim();
                    var badge = $('#page-owner-badge');
                    if (badge) badge.textContent = 'Verantwortlich: ' + newOwner.trim();
                }
            });
        }
    }

    function route() {
        if (!DGD.state.authenticated) return;
        var hash = window.location.hash.replace('#', '') || 'dashboard';
        if (VALID_VIEWS.indexOf(hash) === -1) hash = 'dashboard';

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
        $('#topbar-title').textContent = VIEW_TITLES[hash] || 'Dashboard';

        // Update page owner badge
        renderPageOwner(hash);

        // Render view
        var content = $('#main-content');
        switch (hash) {
            case 'dashboard':    DGD.views.dashboard(content);    break;
            case 'timeline':     DGD.views.timeline(content);     break;
            case 'kpis':         DGD.views.kpis(content);         break;
            case 'mitarbeiter':  DGD.views.mitarbeiter(content);  break;
            case 'finanzen':     DGD.views.finanzen(content);     break;
            case 'ziele':        DGD.views.ziele(content);        break;
            case 'feedback':     DGD.views.feedback(content);     break;
            case 'roadmap':      DGD.views.roadmap(content);      break;
            case 'crm':          DGD.views.crm(content);          break;
            case 'showcase':     DGD.views.showcase(content);     break;
            case 'admin':        DGD.views.admin(content);        break;
            case 'settings':     DGD.views.settings(content);     break;
        }

        // Close mobile sidebar
        $('#sidebar').classList.remove('dgd-sidebar--open');
    }

    // Public API
    return {
        route: route,
    };
})();
