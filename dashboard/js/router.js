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
        'finanzen', 'ziele', 'feedback', 'roadmap', 'showcase', 'settings'
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
        showcase: 'Showcase Builder',
        settings: 'Einstellungen',
    };

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
            case 'showcase':     DGD.views.showcase(content);     break;
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
