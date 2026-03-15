/* ==========================================================================
   DGD Dashboard - Bootstrap
   Wires up event listeners and kicks off authentication.
   All logic lives in the extracted modules (namespace, helpers, auth, etc.)
   ========================================================================== */

(function() {
    'use strict';

    var $ = DGD.helpers.$;
    var $$ = DGD.helpers.$$;

    function init() {
        // Auth form
        $('#login-form').addEventListener('submit', DGD.auth.handleLoginSubmit);
        $('#auth-toggle').addEventListener('click', DGD.auth.toggleAuthMode);

        // Logout
        $('#logout-btn').addEventListener('click', DGD.auth.logout);

        // Sidebar toggle (burger menu)
        $('#sidebar-toggle').addEventListener('click', DGD.sidebar.toggle);
        DGD.sidebar.restoreState();
        DGD.sidebar.initDarkMode();

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
        window.addEventListener('hashchange', DGD.router.route);

        // Check authentication
        DGD.auth.checkAuth();
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
