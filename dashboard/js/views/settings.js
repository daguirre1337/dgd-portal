/* ==========================================================================
   DGD Dashboard - View: Settings
   Depends on: namespace.js, helpers.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {

    function generateCode() {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var seg1 = '', seg2 = '';
        for (var i = 0; i < 4; i++) {
            seg1 += chars.charAt(Math.floor(Math.random() * chars.length));
            seg2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return 'DGD-' + seg1 + '-' + seg2;
    }

    function getDashboardUrl() {
        // Use current origin, or fallback to dgd.digital
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return window.location.origin + '/dashboard/';
        }
        return window.location.origin + '/dashboard/';
    }

    function inviteByEmail() {
        var $ = DGD.helpers.$;
        var emailInput = $('#invite-email');
        var nameInput = $('#invite-name');
        var email = (emailInput.value || '').trim();
        var name = (nameInput.value || '').trim();
        var errorEl = $('#invite-error');

        if (!email) {
            errorEl.textContent = 'Bitte E-Mail-Adresse eingeben.';
            errorEl.style.display = 'block';
            emailInput.focus();
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errorEl.textContent = 'Ungueltige E-Mail-Adresse.';
            errorEl.style.display = 'block';
            emailInput.focus();
            return;
        }

        errorEl.style.display = 'none';
        var code = generateCode();
        var dashUrl = getDashboardUrl();
        var registerUrl = dashUrl + '#register?code=' + encodeURIComponent(code);

        var greeting = name ? ('Hallo ' + name) : 'Hallo';
        var subject = 'Einladung zum DGD Dashboard';
        var body = greeting + ',\n\n'
            + 'du wurdest zum DGD Dashboard eingeladen.\n\n'
            + 'Registriere dich hier:\n' + registerUrl + '\n\n'
            + 'Dein Einladungscode: ' + code + '\n\n'
            + 'Viele Gruesse,\n'
            + (DGD.state.user.display_name || DGD.state.user.username);

        var doInvite = function(result) {
            // Open mailto: link
            var mailto = 'mailto:' + encodeURIComponent(email)
                + '?subject=' + encodeURIComponent(subject)
                + '&body=' + encodeURIComponent(body);
            window.open(mailto, '_blank');

            // Show success
            emailInput.value = '';
            nameInput.value = '';
            var successEl = $('#invite-success');
            successEl.innerHTML = 'Einladung erstellt! E-Mail-Fenster geoeffnet.<br>'
                + '<code style="font-size:0.85em;user-select:all">' + DGD.helpers.escapeHtml(code) + '</code>';
            successEl.style.display = 'block';

            // Reload to show new code in table
            if (!DGD.state.demoMode) {
                DGD.dataLoader.loadData();
            }
            setTimeout(function() { DGD.views.settings($('#main-content')); }, 2000);
        };

        if (DGD.state.demoMode) {
            DGD.state.inviteCodes.push({
                id: 'ic' + Date.now(),
                code: code,
                created_by: DGD.state.user.username,
                used_by: null,
                invited_email: email,
                invited_name: name,
                expires_at: '2026-12-31',
            });
            doInvite();
        } else {
            dashboardApi.createInviteCode({
                code: code,
                invited_email: email,
                invited_name: name,
            }).then(doInvite).catch(function(err) {
                errorEl.textContent = err.message || 'Fehler beim Erstellen der Einladung.';
                errorEl.style.display = 'block';
            });
        }
    }

    DGD.views.settings = function(container) {
        var state = DGD.state;
        var escapeHtml = DGD.helpers.escapeHtml;
        var formatDate = DGD.helpers.formatDate;

        var user = DGD.state.user || {};
        var html = '';

        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Einstellungen</h1>';
        html += '</div>';

        // Profile section
        html += '<div class="dgd-section-card">';
        html += '<div class="dgd-section-card__title">Profil</div>';
        html += '<form id="settings-profile-form" class="dgd-form">';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Benutzername</label>';
        html += `<input type="text" class="dgd-form__input" value="${DGD.helpers.escapeHtml(user.username)}" disabled>`;
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Anzeigename</label>';
        html += `<input type="text" class="dgd-form__input" id="settings-displayname" value="${DGD.helpers.escapeHtml(user.display_name || '')}">`;
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">E-Mail</label>';
        html += `<input type="email" class="dgd-form__input" id="settings-email" value="${DGD.helpers.escapeHtml(user.email || '')}">`;
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Rolle</label>';
        html += `<input type="text" class="dgd-form__input" value="${DGD.helpers.escapeHtml(user.role || 'user')}" disabled>`;
        html += '</div>';
        html += '</form>';
        html += '</div>';

        // Invite by email section (admin only)
        if (user.role === 'admin') {
            html += '<div class="dgd-section-card" style="animation-delay:0.1s;">';
            html += '<div class="dgd-section-card__title">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
            html += ' Mitarbeiter einladen</div>';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">';
            html += '<div class="dgd-form__group" style="margin:0;">';
            html += '<label class="dgd-form__label">E-Mail-Adresse</label>';
            html += '<input type="email" class="dgd-form__input" id="invite-email" placeholder="tamino@example.com">';
            html += '</div>';
            html += '<div class="dgd-form__group" style="margin:0;">';
            html += '<label class="dgd-form__label">Name (optional)</label>';
            html += '<input type="text" class="dgd-form__input" id="invite-name" placeholder="Tamino">';
            html += '</div>';
            html += '</div>';
            html += '<div id="invite-error" class="dgd-alert dgd-alert--error" style="display:none;margin-bottom:1rem;"></div>';
            html += '<div id="invite-success" class="dgd-alert dgd-alert--success" style="display:none;margin-bottom:1rem;"></div>';
            html += '<button class="dgd-btn dgd-btn--primary dgd-btn--sm" id="btn-invite-email">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
            html += ' Einladung senden</button>';
            html += '</div>';
        }

        // Integrations & APIs section
        html += '<div class="dgd-section-card" style="animation-delay:0.2s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
        html += ' Integrationen &amp; APIs</div>';

        // Define all integrations
        var integrations = [
            {
                name: 'TellentHR / KiwiHR',
                description: 'Mitarbeiterverwaltung, Abwesenheiten, Teams',
                icon: '&#128101;',
                connected: DGD.state.tellentAvailable,
                detail: DGD.state.tellentAvailable
                    ? (DGD.state.tellentInfo.employeeCount || 0) + ' Mitarbeiter geladen'
                    : (DGD.state.tellentInfo && DGD.state.tellentInfo.error ? DGD.state.tellentInfo.error : 'API-Key in .env konfigurieren'),
                link: '#mitarbeiter',
            },
            {
                name: 'DGD Portal API',
                description: 'Partner, Gutachter-Suche, Warteliste',
                icon: '&#127760;',
                connected: !DGD.state.demoMode,
                detail: !DGD.state.demoMode ? 'Verbunden mit dgd.digital' : 'Lokal im Demo-Modus',
                link: null,
            },
            {
                name: 'Dashboard API',
                description: 'Projekte, KPIs, Benutzerverwaltung',
                icon: '&#128202;',
                connected: !DGD.state.demoMode,
                detail: !DGD.state.demoMode
                    ? DGD.state.projects.length + ' Projekte, ' + DGD.state.kpis.length + ' KPIs'
                    : 'Demo-Daten aktiv',
                link: null,
            },
        ];

        html += '<div class="dgd-integrations">';
        for (var ig = 0; ig < integrations.length; ig++) {
            var intg = integrations[ig];
            var connClass = intg.connected ? 'connected' : 'disconnected';
            html += '<div class="dgd-integration-row">';
            html += `<div class="dgd-integration-row__icon">${intg.icon}</div>`;
            html += '<div class="dgd-integration-row__info">';
            html += `<div class="dgd-integration-row__name">${DGD.helpers.escapeHtml(intg.name)}</div>`;
            html += `<div class="dgd-integration-row__desc">${DGD.helpers.escapeHtml(intg.description)}</div>`;
            html += '</div>';
            html += '<div class="dgd-integration-row__status">';
            html += `<span class="dgd-integration-badge dgd-integration-badge--${connClass}">`;
            html += '<span class="dgd-integration-badge__dot"></span>';
            html += (intg.connected ? 'Verbunden' : 'Nicht verbunden');
            html += '</span>';
            html += `<div class="dgd-integration-row__detail">${DGD.helpers.escapeHtml(intg.detail)}</div>`;
            html += '</div>';
            if (intg.link) {
                html += `<a href="${intg.link}" class="dgd-btn dgd-btn--outline dgd-btn--sm">&ouml;ffnen</a>`;
            }
            html += '</div>';
        }
        html += '</div></div>';

        // Demo mode indicator
        if (DGD.state.demoMode) {
            html += '<div class="dgd-alert dgd-alert--info">';
            html += '<strong>Demo-Modus:</strong> API nicht verfuegbar. Alle Daten sind lokale Beispieldaten.';
            html += '</div>';
        }

        container.innerHTML = html;

        // Bind invite by email
        var btnInviteEmail = document.getElementById('btn-invite-email');
        if (btnInviteEmail) {
            btnInviteEmail.addEventListener('click', function() {
                inviteByEmail();
            });
        }
    };
})();
