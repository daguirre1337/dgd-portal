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

    /* ------------------------------------------------------------------
       Dark Mode Toggle
       ------------------------------------------------------------------ */

    function initDarkMode() {
        // Restore preference
        var saved = null;
        try { saved = localStorage.getItem('dgd-theme'); } catch(e) {}

        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        // Insert toggle button at bottom of sidebar
        var sidebar = $('#sidebar');
        if (!sidebar) return;

        var nav = sidebar.querySelector('.dgd-sidebar__nav');
        if (!nav) return;

        var toggleBtn = document.createElement('button');
        toggleBtn.className = 'dgd-dark-toggle';
        toggleBtn.id = 'dark-mode-toggle';
        updateToggleLabel(toggleBtn);

        toggleBtn.addEventListener('click', function() {
            var current = document.documentElement.getAttribute('data-theme');
            var next = current === 'dark' ? 'light' : 'dark';
            if (next === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            try { localStorage.setItem('dgd-theme', next); } catch(e) {}
            updateToggleLabel(toggleBtn);
        });

        nav.appendChild(toggleBtn);
    }

    function updateToggleLabel(btn) {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        btn.innerHTML = (isDark ? '☀️' : '🌙') + ' ' + (isDark ? 'Light Mode' : 'Dark Mode');
    }

    // Public API
    return {
        toggle: toggleSidebar,
        restoreState: restoreSidebarState,
        initDarkMode: initDarkMode,
    };
})();
