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

    var ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
    var ICON_MAIL  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
    var ICON_NONE  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#95a5a6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';

    /**
     * Build a unified person list from all data sources:
     *  - TellentHR employees (if connected)
     *  - Registered dashboard users
     *  - Invited people (from invite_codes)
     * Deduplicates by email. Works with or without TellentHR.
     */
    function buildPersonList() {
        var employees = DGD.state.employees || [];
        var inviteCodes = DGD.state.inviteCodes || [];
        var registeredUsers = DGD.state.registeredUsers || [];
        var seen = {}; // lowercase email -> true
        var persons = [];

        // 1) TellentHR employees (primary source when available)
        for (var i = 0; i < employees.length; i++) {
            var emp = employees[i];
            var email = (emp.email || '').toLowerCase();
            var person = {
                name: (emp.firstName || '') + ' ' + (emp.lastName || ''),
                email: emp.email || '',
                position: emp.position ? (emp.position.name || '') : '',
                team: '',
                isActive: emp.isActive !== false,
                source: 'tellent',
            };
            if (emp.team) {
                person.team = emp.team.name || '';
            } else if (emp.teams && emp.teams.length > 0) {
                person.team = emp.teams[0].name || '';
            }
            persons.push(person);
            if (email) seen[email] = true;
        }

        // 2) Registered users not already in TellentHR
        for (var j = 0; j < registeredUsers.length; j++) {
            var ru = registeredUsers[j];
            var ruEmail = (ru.email || '').toLowerCase();
            if (ruEmail && seen[ruEmail]) continue;
            persons.push({
                name: ru.display_name || ru.username || '',
                email: ru.email || '',
                position: ru.role || '',
                team: '',
                isActive: true,
                source: 'dashboard',
            });
            if (ruEmail) seen[ruEmail] = true;
        }

        // 3) Invited people not yet registered and not in TellentHR
        for (var k = 0; k < inviteCodes.length; k++) {
            var ic = inviteCodes[k];
            if (!ic.invited_email) continue;
            var icEmail = ic.invited_email.toLowerCase();
            if (seen[icEmail]) continue;
            persons.push({
                name: ic.invited_name || '',
                email: ic.invited_email,
                position: '',
                team: '',
                isActive: true,
                source: 'invite',
            });
            seen[icEmail] = true;
        }

        return persons;
    }

    function getPersonStatus(email, registeredByEmail, inviteByEmail) {
        var lc = (email || '').toLowerCase();
        var regUser = lc ? registeredByEmail[lc] : null;
        var invite = lc ? inviteByEmail[lc] : null;

        if (regUser) {
            return { status: 'Registriert', cls: 'dgd-emp-status--registered', icon: ICON_CHECK, registered: true };
        }
        if (invite && invite.used_by) {
            return { status: 'Registriert', cls: 'dgd-emp-status--registered', icon: ICON_CHECK, registered: true };
        }
        if (invite) {
            return { status: 'Eingeladen', cls: 'dgd-emp-status--invited', icon: ICON_MAIL, registered: false };
        }
        return { status: 'Nicht eingeladen', cls: 'dgd-emp-status--none', icon: ICON_NONE, registered: false };
    }

    function renderEmployeeList(escapeHtml, formatDate) {
        var inviteCodes = DGD.state.inviteCodes || [];
        var registeredUsers = DGD.state.registeredUsers || [];

        // Build lookups by lowercase email
        var inviteByEmail = {};
        for (var i = 0; i < inviteCodes.length; i++) {
            var ic = inviteCodes[i];
            if (ic.invited_email) {
                inviteByEmail[ic.invited_email.toLowerCase()] = ic;
            }
        }
        var registeredByEmail = {};
        for (var j = 0; j < registeredUsers.length; j++) {
            var ru = registeredUsers[j];
            if (ru.email) {
                registeredByEmail[ru.email.toLowerCase()] = ru;
            }
        }

        var persons = buildPersonList();
        var hasTellent = DGD.state.tellentAvailable;

        var html = '<div class="dgd-section-card" style="animation-delay:0.15s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>';
        html += ' Alle Mitarbeiter';
        html += '<span style="font-weight:400;font-size:0.85em;opacity:0.7;margin-left:0.5rem;">(' + persons.length + ')</span>';
        html += '</div>';

        if (!hasTellent) {
            html += '<div class="dgd-alert dgd-alert--info" style="margin-bottom:1rem;">';
            html += 'TellentHR nicht verbunden &ndash; zeige registrierte &amp; eingeladene Benutzer.';
            html += '</div>';
        }

        if (persons.length === 0) {
            html += '<div class="dgd-alert dgd-alert--info" style="margin:0;">';
            html += 'Keine Mitarbeiter gefunden.';
            html += '</div>';
        } else {
            html += '<div style="overflow-x:auto;">';
            html += '<table class="dgd-table" style="width:100%;">';
            html += '<thead><tr>';
            html += '<th>Name</th>';
            html += '<th>E-Mail</th>';
            if (hasTellent) {
                html += '<th>Position</th>';
                html += '<th>Team</th>';
            }
            html += '<th style="text-align:center;">Dashboard-Status</th>';
            html += '<th></th>';
            html += '</tr></thead>';
            html += '<tbody>';

            for (var k = 0; k < persons.length; k++) {
                var p = persons[k];
                var st = getPersonStatus(p.email, registeredByEmail, inviteByEmail);
                var rowStyle = p.isActive ? '' : ' style="opacity:0.5;"';

                html += '<tr' + rowStyle + '>';
                html += '<td><strong>' + escapeHtml(p.name) + '</strong>';
                if (!p.isActive) html += ' <span style="font-size:0.8em;color:#95a5a6;">(inaktiv)</span>';
                html += '</td>';
                html += '<td style="font-size:0.9em;">' + escapeHtml(p.email) + '</td>';
                if (hasTellent) {
                    html += '<td style="font-size:0.9em;">' + escapeHtml(p.position) + '</td>';
                    html += '<td style="font-size:0.9em;">' + escapeHtml(p.team) + '</td>';
                }
                html += '<td style="text-align:center;">';
                html += '<span class="dgd-emp-status ' + st.cls + '">';
                html += st.icon + ' ' + st.status;
                html += '</span></td>';
                html += '<td>';
                if (!st.registered && p.email && p.isActive) {
                    html += '<button class="dgd-btn dgd-btn--outline dgd-btn--xs btn-quick-invite" '
                        + 'data-email="' + escapeHtml(p.email) + '" '
                        + 'data-name="' + escapeHtml(p.name) + '">'
                        + 'Einladen</button>';
                }
                html += '</td>';
                html += '</tr>';
            }

            html += '</tbody></table></div>';
        }

        html += '</div>';
        return html;
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

        // Employee list section (admin only, requires Tellent)
        if (user.role === 'admin') {
            html += renderEmployeeList(escapeHtml, formatDate);
        }

        // Integrations & APIs section
        html += '<div class="dgd-section-card" style="animation-delay:0.3s;">';
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

        // Bind quick-invite buttons in employee table
        var quickBtns = container.querySelectorAll('.btn-quick-invite');
        for (var qi = 0; qi < quickBtns.length; qi++) {
            quickBtns[qi].addEventListener('click', function() {
                var emailField = document.getElementById('invite-email');
                var nameField = document.getElementById('invite-name');
                if (emailField) emailField.value = this.getAttribute('data-email');
                if (nameField) nameField.value = this.getAttribute('data-name');
                // Scroll to invite section
                emailField && emailField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }
    };
})();
