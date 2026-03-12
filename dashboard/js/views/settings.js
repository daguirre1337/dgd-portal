/* ==========================================================================
   DGD Dashboard - View: Settings
   Sections: Profil, Benutzerverwaltung, Einladungen, Mitarbeiterliste, Integrationen
   Depends on: namespace.js, helpers.js, api.js
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
        return window.location.origin + '/dashboard/';
    }

    /* ------------------------------------------------------------------
       Invite by Email - Creates code + sends email via Cortex/PHP
       ------------------------------------------------------------------ */
    function inviteByEmail() {
        var $ = DGD.helpers.$;
        var emailInput = $('#invite-email');
        var nameInput = $('#invite-name');
        var email = (emailInput.value || '').trim();
        var name = (nameInput.value || '').trim();
        var errorEl = $('#invite-error');
        var successEl = $('#invite-success');
        var btnEl = $('#btn-invite-email');

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
        successEl.style.display = 'none';

        // Disable button during process
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<span class="dgd-spinner-sm"></span> Wird gesendet...';
        }

        var code = generateCode();

        function onSuccess(sendResult) {
            emailInput.value = '';
            nameInput.value = '';

            var sentText = '';
            if (sendResult && sendResult.sent_via === 'cortex') {
                sentText = 'via Cortex Gmail';
            } else if (sendResult && sendResult.sent_via === 'php_mail') {
                sentText = 'via Server-Mail';
            }

            successEl.innerHTML = '<strong>Einladung gesendet!</strong> ' + (sentText ? '(' + sentText + ')' : '') + '<br>'
                + '<span style="font-size:0.9em;">E-Mail an: ' + DGD.helpers.escapeHtml(email) + '</span><br>'
                + '<div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem;">'
                + '<code style="font-size:0.85em;user-select:all;padding:0.25rem 0.5rem;background:var(--dgd-bg);border-radius:4px;">' + DGD.helpers.escapeHtml(code) + '</code>'
                + '<button class="dgd-btn dgd-btn--outline dgd-btn--xs" id="btn-copy-code" title="Code kopieren">'
                + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
                + ' Kopieren</button>'
                + '</div>';
            successEl.style.display = 'block';

            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Einladung senden';
            }

            // Bind copy button
            setTimeout(function() {
                var copyBtn = document.getElementById('btn-copy-code');
                if (copyBtn) {
                    copyBtn.addEventListener('click', function() {
                        var url = getDashboardUrl() + '#register?code=' + encodeURIComponent(code);
                        navigator.clipboard.writeText('Einladungscode: ' + code + '\nRegistrierung: ' + url).then(function() {
                            copyBtn.textContent = 'Kopiert!';
                            setTimeout(function() { copyBtn.textContent = 'Kopieren'; }, 2000);
                        });
                    });
                }
            }, 50);

            // Reload data to refresh tables
            if (!DGD.state.demoMode) {
                DGD.dataLoader.loadData();
            }
            setTimeout(function() { DGD.views.settings(document.getElementById('main-content')); }, 3000);
        }

        function onError(err) {
            errorEl.textContent = err.message || 'Fehler beim Senden der Einladung.';
            errorEl.style.display = 'block';
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Einladung senden';
            }
        }

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
            onSuccess({ sent_via: 'demo' });
        } else {
            // Step 1: Create invite code
            dashboardApi.createInviteCode({
                code: code,
                invited_email: email,
                invited_name: name,
            }).then(function(result) {
                if (!result || !result.id) {
                    throw new Error('Invite-Code konnte nicht erstellt werden.');
                }
                // Step 2: Send email via Cortex/PHP
                return dashboardApi.sendInviteEmail(result.id);
            }).then(function(sendResult) {
                onSuccess(sendResult);
            }).catch(onError);
        }
    }

    /* ------------------------------------------------------------------
       Icons
       ------------------------------------------------------------------ */
    var ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
    var ICON_MAIL  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
    var ICON_NONE  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#95a5a6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';

    /* ------------------------------------------------------------------
       Person List (TellentHR + Users + Invites)
       ------------------------------------------------------------------ */
    function buildPersonList() {
        var employees = DGD.state.employees || [];
        var inviteCodes = DGD.state.inviteCodes || [];
        var registeredUsers = DGD.state.registeredUsers || [];
        var seen = {};
        var persons = [];

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

    function getPersonStatus(email, registeredByEmail, inviteByEmailMap) {
        var lc = (email || '').toLowerCase();
        var regUser = lc ? registeredByEmail[lc] : null;
        var invite = lc ? inviteByEmailMap[lc] : null;

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

    /* ------------------------------------------------------------------
       Section: Benutzerverwaltung (admin only)
       ------------------------------------------------------------------ */
    function renderUserManagement(escapeHtml) {
        var users = DGD.state.registeredUsers || [];
        var currentUser = DGD.state.user || {};

        var html = '<div class="dgd-section-card" style="animation-delay:0.1s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z"/><circle cx="12" cy="8" r="4"/></svg>';
        html += ' Benutzerverwaltung';
        html += '<span style="font-weight:400;font-size:0.85em;opacity:0.7;margin-left:0.5rem;">(' + users.length + ')</span>';
        html += '</div>';

        if (users.length === 0) {
            html += '<div class="dgd-alert dgd-alert--info" style="margin:0;">Keine registrierten Benutzer.</div>';
        } else {
            html += '<div style="overflow-x:auto;">';
            html += '<table class="dgd-table" style="width:100%;">';
            html += '<thead><tr>';
            html += '<th>Benutzer</th><th>E-Mail</th><th>Rolle</th><th>Registriert</th><th>Letzter Login</th><th></th>';
            html += '</tr></thead><tbody>';

            for (var i = 0; i < users.length; i++) {
                var u = users[i];
                var isSelf = u.id === currentUser.id;
                var initials = (u.display_name || u.username || '??').split(' ').map(function(w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase();
                var rowCls = isSelf ? ' style="background:var(--dgd-bg);"' : '';

                html += '<tr' + rowCls + '>';
                // Avatar + name
                html += '<td><div style="display:flex;align-items:center;gap:0.5rem;">';
                html += '<div style="width:32px;height:32px;border-radius:50%;background:var(--dgd-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75em;font-weight:600;">' + initials + '</div>';
                html += '<div><strong>' + escapeHtml(u.display_name || u.username) + '</strong>';
                if (isSelf) html += ' <span style="font-size:0.75em;color:var(--dgd-primary);">(Du)</span>';
                html += '<br><span style="font-size:0.8em;color:var(--dgd-text-muted);">@' + escapeHtml(u.username) + '</span>';
                html += '</div></div></td>';
                // Email
                html += '<td style="font-size:0.9em;">' + escapeHtml(u.email || '') + '</td>';
                // Role dropdown
                html += '<td>';
                if (isSelf) {
                    html += '<span class="dgd-badge dgd-badge--primary">Admin</span>';
                } else {
                    html += '<select class="dgd-form__input dgd-form__input--sm user-role-select" data-user-id="' + u.id + '" style="width:auto;padding:0.25rem 0.5rem;">';
                    html += '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Admin</option>';
                    html += '<option value="member"' + (u.role === 'member' ? ' selected' : '') + '>Member</option>';
                    html += '</select>';
                }
                html += '</td>';
                // Registered
                html += '<td style="font-size:0.85em;">' + (u.created_at ? DGD.helpers.formatDate(u.created_at) : '-') + '</td>';
                // Last login
                html += '<td style="font-size:0.85em;">' + (u.last_login ? DGD.helpers.formatDate(u.last_login) : 'Nie') + '</td>';
                // Delete
                html += '<td>';
                if (!isSelf) {
                    html += '<button class="dgd-btn dgd-btn--outline dgd-btn--xs btn-delete-user" data-user-id="' + u.id + '" data-user-name="' + escapeHtml(u.display_name || u.username) + '" style="color:#e74c3c;border-color:#e74c3c;" title="Benutzer loeschen">';
                    html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
                    html += '</button>';
                }
                html += '</td>';
                html += '</tr>';
            }

            html += '</tbody></table></div>';
        }

        html += '</div>';
        return html;
    }

    /* ------------------------------------------------------------------
       Section: Invite-Tabelle (bestehende Codes)
       ------------------------------------------------------------------ */
    function renderInviteTable(escapeHtml) {
        var codes = DGD.state.inviteCodes || [];
        if (codes.length === 0) return '';

        var html = '<div style="margin-top:1rem;">';
        html += '<div style="font-weight:600;font-size:0.9em;margin-bottom:0.5rem;color:var(--dgd-text-muted);">Bestehende Einladungen (' + codes.length + ')</div>';
        html += '<div style="overflow-x:auto;">';
        html += '<table class="dgd-table" style="width:100%;font-size:0.9em;">';
        html += '<thead><tr>';
        html += '<th>Empfaenger</th><th>Code</th><th>Status</th><th>Erstellt</th><th>E-Mail</th><th></th>';
        html += '</tr></thead><tbody>';

        for (var i = 0; i < codes.length; i++) {
            var ic = codes[i];
            var isUsed = !!ic.used_by;
            var isExpired = ic.expires_at && new Date(ic.expires_at) < new Date();

            var statusBadge;
            if (isUsed) {
                statusBadge = '<span class="dgd-badge dgd-badge--success">Eingeloest</span>';
                if (ic.used_by_name) statusBadge += ' <span style="font-size:0.85em;">' + escapeHtml(ic.used_by_name) + '</span>';
            } else if (isExpired) {
                statusBadge = '<span class="dgd-badge dgd-badge--danger">Abgelaufen</span>';
            } else {
                statusBadge = '<span class="dgd-badge dgd-badge--warning">Offen</span>';
            }

            var emailStatus = '';
            if (ic.email_sent_at) {
                emailStatus = '<span style="color:#27ae60;" title="' + escapeHtml(ic.email_sent_at) + '">✓ ' + (ic.sent_via === 'cortex' ? 'Gmail' : 'Server') + '</span>';
            } else {
                emailStatus = '<span style="color:#95a5a6;">—</span>';
            }

            html += '<tr' + (isUsed ? ' style="opacity:0.6;"' : '') + '>';
            html += '<td>' + escapeHtml(ic.invited_name || '') + '<br><span style="font-size:0.85em;color:var(--dgd-text-muted);">' + escapeHtml(ic.invited_email || '') + '</span></td>';
            html += '<td><code style="font-size:0.85em;user-select:all;">' + escapeHtml(ic.code) + '</code></td>';
            html += '<td>' + statusBadge + '</td>';
            html += '<td style="font-size:0.85em;">' + (ic.created_at ? DGD.helpers.formatDate(ic.created_at) : '') + '</td>';
            html += '<td>' + emailStatus + '</td>';
            html += '<td>';
            if (!isUsed && !isExpired && ic.invited_email) {
                html += '<button class="dgd-btn dgd-btn--outline dgd-btn--xs btn-resend-invite" data-code-id="' + ic.id + '" title="Erneut senden">Erneut senden</button>';
            }
            html += '</td>';
            html += '</tr>';
        }

        html += '</tbody></table></div></div>';
        return html;
    }

    /* ------------------------------------------------------------------
       Section: Employee List (TellentHR merged)
       ------------------------------------------------------------------ */
    function renderEmployeeList(escapeHtml) {
        var inviteCodes = DGD.state.inviteCodes || [];
        var registeredUsers = DGD.state.registeredUsers || [];

        var inviteByEmailMap = {};
        for (var i = 0; i < inviteCodes.length; i++) {
            var ic = inviteCodes[i];
            if (ic.invited_email) {
                inviteByEmailMap[ic.invited_email.toLowerCase()] = ic;
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

        var html = '<div class="dgd-section-card" style="animation-delay:0.2s;">';
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
            html += '<div class="dgd-alert dgd-alert--info" style="margin:0;">Keine Mitarbeiter gefunden.</div>';
        } else {
            html += '<div style="overflow-x:auto;">';
            html += '<table class="dgd-table" style="width:100%;">';
            html += '<thead><tr>';
            html += '<th>Name</th><th>E-Mail</th>';
            if (hasTellent) {
                html += '<th>Position</th><th>Team</th>';
            }
            html += '<th style="text-align:center;">Dashboard-Status</th><th></th>';
            html += '</tr></thead><tbody>';

            for (var k = 0; k < persons.length; k++) {
                var p = persons[k];
                var st = getPersonStatus(p.email, registeredByEmail, inviteByEmailMap);
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
                html += '</td></tr>';
            }

            html += '</tbody></table></div>';
        }

        html += '</div>';
        return html;
    }

    /* ------------------------------------------------------------------
       Main Settings View
       ------------------------------------------------------------------ */
    DGD.views.settings = function(container) {
        var escapeHtml = DGD.helpers.escapeHtml;
        var user = DGD.state.user || {};
        var html = '';

        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Einstellungen</h1>';
        html += '</div>';

        // --- 1. Profile section ---
        html += '<div class="dgd-section-card">';
        html += '<div class="dgd-section-card__title">Profil</div>';
        html += '<form id="settings-profile-form" class="dgd-form">';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Benutzername</label>';
        html += '<input type="text" class="dgd-form__input" value="' + escapeHtml(user.username || '') + '" disabled>';
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Anzeigename</label>';
        html += '<input type="text" class="dgd-form__input" id="settings-displayname" value="' + escapeHtml(user.display_name || '') + '">';
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">E-Mail</label>';
        html += '<input type="email" class="dgd-form__input" id="settings-email" value="' + escapeHtml(user.email || '') + '">';
        html += '</div>';
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Rolle</label>';
        html += '<input type="text" class="dgd-form__input" value="' + escapeHtml(user.role || 'member') + '" disabled>';
        html += '</div>';
        html += '</form></div>';

        // --- 2. Benutzerverwaltung (admin only) ---
        if (user.role === 'admin') {
            html += renderUserManagement(escapeHtml);
        }

        // --- 3. Einladungen (admin only) ---
        if (user.role === 'admin') {
            html += '<div class="dgd-section-card" style="animation-delay:0.15s;">';
            html += '<div class="dgd-section-card__title">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
            html += ' Mitarbeiter einladen</div>';

            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">';
            html += '<div class="dgd-form__group" style="margin:0;">';
            html += '<label class="dgd-form__label">E-Mail-Adresse</label>';
            html += '<input type="email" class="dgd-form__input" id="invite-email" placeholder="tamino@dgd-direkt.de">';
            html += '</div>';
            html += '<div class="dgd-form__group" style="margin:0;">';
            html += '<label class="dgd-form__label">Name (optional)</label>';
            html += '<input type="text" class="dgd-form__input" id="invite-name" placeholder="Tamino Lenz">';
            html += '</div></div>';

            html += '<div id="invite-error" class="dgd-alert dgd-alert--error" style="display:none;margin-bottom:1rem;"></div>';
            html += '<div id="invite-success" class="dgd-alert dgd-alert--success" style="display:none;margin-bottom:1rem;"></div>';

            html += '<button class="dgd-btn dgd-btn--primary dgd-btn--sm" id="btn-invite-email">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
            html += ' Einladung senden</button>';

            // Invite codes table
            html += renderInviteTable(escapeHtml);
            html += '</div>';
        }

        // --- 4. Employee list (admin only) ---
        if (user.role === 'admin') {
            html += renderEmployeeList(escapeHtml);
        }

        // --- 5. Integrations & APIs ---
        html += '<div class="dgd-section-card" style="animation-delay:0.3s;">';
        html += '<div class="dgd-section-card__title">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
        html += ' Integrationen &amp; APIs</div>';

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
                name: 'Cortex DigitalTwin',
                description: 'KI-Assistent, E-Mail-Versand, Chat',
                icon: '&#129302;',
                connected: false, // checked async below
                detail: 'localhost:8000',
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
            html += '<div class="dgd-integration-row__icon">' + intg.icon + '</div>';
            html += '<div class="dgd-integration-row__info">';
            html += '<div class="dgd-integration-row__name">' + escapeHtml(intg.name) + '</div>';
            html += '<div class="dgd-integration-row__desc">' + escapeHtml(intg.description) + '</div>';
            html += '</div>';
            html += '<div class="dgd-integration-row__status">';
            html += '<span class="dgd-integration-badge dgd-integration-badge--' + connClass + '">';
            html += '<span class="dgd-integration-badge__dot"></span>';
            html += (intg.connected ? 'Verbunden' : 'Nicht verbunden');
            html += '</span>';
            html += '<div class="dgd-integration-row__detail">' + escapeHtml(intg.detail) + '</div>';
            html += '</div>';
            if (intg.link) {
                html += '<a href="' + intg.link + '" class="dgd-btn dgd-btn--outline dgd-btn--sm">&ouml;ffnen</a>';
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

        // --- Event Bindings ---

        // Invite button
        var btnInviteEmail = document.getElementById('btn-invite-email');
        if (btnInviteEmail) {
            btnInviteEmail.addEventListener('click', inviteByEmail);
        }

        // Quick-invite buttons
        var quickBtns = container.querySelectorAll('.btn-quick-invite');
        for (var qi = 0; qi < quickBtns.length; qi++) {
            quickBtns[qi].addEventListener('click', function() {
                var emailField = document.getElementById('invite-email');
                var nameField = document.getElementById('invite-name');
                if (emailField) emailField.value = this.getAttribute('data-email');
                if (nameField) nameField.value = this.getAttribute('data-name');
                emailField && emailField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        // Resend invite buttons
        var resendBtns = container.querySelectorAll('.btn-resend-invite');
        for (var ri = 0; ri < resendBtns.length; ri++) {
            resendBtns[ri].addEventListener('click', function() {
                var btn = this;
                var codeId = btn.getAttribute('data-code-id');
                btn.disabled = true;
                btn.textContent = 'Sende...';
                dashboardApi.sendInviteEmail(codeId).then(function(result) {
                    btn.textContent = 'Gesendet!';
                    btn.style.color = '#27ae60';
                    setTimeout(function() { DGD.views.settings(container); }, 2000);
                }).catch(function(err) {
                    btn.textContent = 'Fehler';
                    btn.style.color = '#e74c3c';
                    btn.disabled = false;
                });
            });
        }

        // Role dropdowns
        var roleSelects = container.querySelectorAll('.user-role-select');
        for (var rs = 0; rs < roleSelects.length; rs++) {
            roleSelects[rs].addEventListener('change', function() {
                var sel = this;
                var userId = sel.getAttribute('data-user-id');
                var newRole = sel.value;
                sel.disabled = true;
                dashboardApi.updateUserRole(userId, newRole).then(function() {
                    sel.disabled = false;
                    sel.style.borderColor = '#27ae60';
                    setTimeout(function() { sel.style.borderColor = ''; }, 2000);
                }).catch(function(err) {
                    sel.disabled = false;
                    sel.style.borderColor = '#e74c3c';
                    alert('Fehler: ' + (err.message || 'Rolle konnte nicht geaendert werden'));
                });
            });
        }

        // Delete user buttons
        var delBtns = container.querySelectorAll('.btn-delete-user');
        for (var di = 0; di < delBtns.length; di++) {
            delBtns[di].addEventListener('click', function() {
                var btn = this;
                var userId = btn.getAttribute('data-user-id');
                var userName = btn.getAttribute('data-user-name');
                if (!confirm('Benutzer "' + userName + '" wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.')) {
                    return;
                }
                btn.disabled = true;
                dashboardApi.deleteUser(userId).then(function() {
                    // Reload to refresh user list
                    DGD.dataLoader.loadData();
                    setTimeout(function() { DGD.views.settings(container); }, 500);
                }).catch(function(err) {
                    btn.disabled = false;
                    alert('Fehler: ' + (err.message || 'Benutzer konnte nicht geloescht werden'));
                });
            });
        }
    };
})();
