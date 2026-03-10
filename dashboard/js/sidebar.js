/* ==========================================================================
   DGD Dashboard - Sidebar Module
   Toggle and persist sidebar collapsed/expanded state
   ========================================================================== */

window.DGD = window.DGD || {};

DGD.sidebar = (function() {
    'use strict';

    var $ = function(sel) { return document.querySelector(sel); };

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

    // Public API
    return {
        toggle: toggleSidebar,
        restoreState: restoreSidebarState,
    };
})();
