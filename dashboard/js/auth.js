/* ==========================================================================
   DGD Dashboard - Auth Module
   Login, logout, registration, demo mode
   ========================================================================== */

window.DGD = window.DGD || {};

DGD.auth = (function() {
    'use strict';

    var $ = function(sel) { return document.querySelector(sel); };

    function checkAuth() {
        dashboardApi.me().then(function(data) {
            if (data && data.user) {
                loginSuccess(data.user);
            } else {
                enterDemoMode();
            }
        }).catch(function() {
            enterDemoMode();
        });
    }

    function enterDemoMode() {
        DGD.state.demoMode = true;
        loginSuccess(DGD.demoData.DEMO_USER);
    }

    /**
     * Apply role-based visibility to sidebar links.
     * Links with data-role="admin" are hidden for non-admin users.
     */
    function applyRoleGuards(user) {
        var role = (user && user.role) || 'member';
        var adminLinks = document.querySelectorAll('[data-role="admin"]');
        for (var i = 0; i < adminLinks.length; i++) {
            adminLinks[i].style.display = (role === 'admin') ? '' : 'none';
        }
    }

    function loginSuccess(user) {
        DGD.state.authenticated = true;
        DGD.state.user = user;
        $('#login-page').classList.add('dgd-hidden');
        $('#app-shell').classList.remove('dgd-hidden');
        $('#topbar-username').textContent = user.display_name || user.username;
        applyRoleGuards(user);
        DGD.dataLoader.loadData();
        DGD.router.route();
        // Init Cortex Chat widget
        if (typeof CortexChat !== 'undefined') {
            CortexChat.init(user);
        }
    }

    function logout() {
        if (!DGD.state.demoMode) {
            dashboardApi.logout();
        }
        DGD.state.authenticated = false;
        DGD.state.user = null;
        DGD.state.demoMode = false;
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

        if (DGD.state.isRegisterMode) {
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
        DGD.state.isRegisterMode = !DGD.state.isRegisterMode;
        var isReg = DGD.state.isRegisterMode;
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

    // Public API
    return {
        checkAuth: checkAuth,
        enterDemoMode: enterDemoMode,
        loginSuccess: loginSuccess,
        logout: logout,
        handleLoginSubmit: handleLoginSubmit,
        toggleAuthMode: toggleAuthMode,
    };
})();
