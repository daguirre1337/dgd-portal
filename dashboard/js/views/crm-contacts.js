/* ==========================================================================
   DGD Dashboard - CRM View: Kontakte (Contact Management + Modals)
   Depends on: crm.js (shared utilities)
   ========================================================================== */

(function() {
    'use strict';

    function getShared() {
        return DGD.views.crm._shared;
    }

    /* ------------------------------------------------------------------
       Contacts Table
       ------------------------------------------------------------------ */

    function renderContactsTable(container) {
        var shared = getShared();

        // Toolbar
        var html = '<div class="crm-toolbar">';
        html += '<div class="crm-toolbar__left">';
        html += '<button class="dgd-btn dgd-btn--primary dgd-btn--sm" id="crm-add-contact">+ Kontakt</button>';
        html += '</div>';
        html += '<div class="crm-toolbar__right">';
        html += '<div class="crm-filters">';
        html += '<input type="text" class="dgd-form__input dgd-form__input--sm" id="crm-search" placeholder="Suchen...">';
        html += '<select class="dgd-form__input dgd-form__input--sm" id="crm-filter-stage"><option value="">Alle Listen</option>';
        shared.LEAD_STAGES.forEach(function(s) {
            html += '<option value="' + s.key + '">' + s.label + '</option>';
        });
        html += '</select>';
        html += '<select class="dgd-form__input dgd-form__input--sm" id="crm-filter-type"><option value="">Alle Typen</option>';
        html += '<option value="sv">SV</option><option value="profi">Profi</option>';
        html += '</select>';
        html += '</div></div></div>';

        html += '<div id="crm-contacts-body"><div class="crm-loading">Kontakte werden geladen...</div></div>';

        container.innerHTML = html;

        // Load contacts
        loadContacts(container);

        // Events
        var searchTimer;
        var searchInput = container.querySelector('#crm-search');
        var filterStage = container.querySelector('#crm-filter-stage');
        var filterType = container.querySelector('#crm-filter-type');

        function doSearch() {
            loadContacts(container);
        }

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(doSearch, 300);
            });
        }
        if (filterStage) filterStage.addEventListener('change', doSearch);
        if (filterType) filterType.addEventListener('change', doSearch);

        var addBtn = container.querySelector('#crm-add-contact');
        if (addBtn) addBtn.addEventListener('click', function() { showContactModal(); });
    }

    /* ------------------------------------------------------------------
       Load Contacts
       ------------------------------------------------------------------ */

    function loadContacts(container) {
        var shared = getShared();
        var filters = {};
        var searchInput = container.querySelector('#crm-search');
        var filterStage = container.querySelector('#crm-filter-stage');
        var filterType = container.querySelector('#crm-filter-type');

        if (searchInput && searchInput.value) filters.search = searchInput.value;
        if (filterStage && filterStage.value) filters.stage = filterStage.value;
        if (filterType && filterType.value) filters.partner_type = filterType.value;

        shared.safe(shared.api().getCrmContacts(filters)).then(function(data) {
            var contacts = data ? (data.contacts || []) : [];
            var body = container.querySelector('#crm-contacts-body');
            if (!body) return;

            if (contacts.length === 0) {
                body.innerHTML = '<div class="crm-empty">Keine Kontakte gefunden.</div>';
                return;
            }

            var html = '<table class="crm-table"><thead><tr>';
            html += '<th>Name</th><th>Organisation</th><th>Betriebsart</th><th>Liste</th>';
            html += '<th>Leadquelle</th><th>Next Step</th><th>Datum</th><th>Zust\u00e4ndig</th><th>Aktionen</th>';
            html += '</tr></thead><tbody>';

            contacts.forEach(function(c) {
                var overdue = shared.isOverdue(c.next_step_date);
                html += '<tr class="crm-row' + (overdue ? ' crm-row--overdue' : '') + '" data-id="' + c.id + '">';

                // Name
                html += '<td class="crm-cell--name"><strong>' + shared.esc(c.name) + '</strong>';
                if (c.email) html += '<br><small>' + shared.esc(c.email) + '</small>';
                html += '</td>';

                // Organisation
                html += '<td>' + shared.esc(c.organization || '-') + '</td>';

                // Betriebsart + badges
                html += '<td>';
                html += shared.partnerBadge(c.partner_type, c.ga_count);
                if (c.business_type) html += '<br><small>' + shared.esc(c.business_type) + '</small>';
                html += '</td>';

                // Pipeline stage badge
                html += '<td><span class="crm-stage-badge" style="background:' + shared.stageColor(c.pipeline_stage) + '">' + shared.stageLabel(c.pipeline_stage) + '</span></td>';

                // Leadquelle
                html += '<td>' + shared.esc(c.lead_source || '-') + '</td>';

                // Next Step
                html += '<td>' + shared.esc(c.next_step || '-') + '</td>';

                // Datum
                html += '<td>';
                if (overdue) html += '<span class="crm-overdue">';
                html += shared.formatDate(c.next_step_date);
                if (overdue) html += '</span>';
                html += '</td>';

                // Zustaendig
                html += '<td>' + shared.esc(c.assigned_to || '-') + '</td>';

                // Aktionen
                html += '<td class="crm-actions">';
                html += '<button class="dgd-btn dgd-btn--sm crm-btn-detail" data-id="' + c.id + '">Details</button>';
                html += '<button class="dgd-btn dgd-btn--sm dgd-btn--outline crm-btn-edit" data-id="' + c.id + '">\u270E</button>';
                html += '<button class="dgd-btn dgd-btn--sm dgd-btn--outline crm-btn-delete" data-id="' + c.id + '">&times;</button>';
                html += '</td></tr>';
            });

            html += '</tbody></table>';
            body.innerHTML = html;

            // Bind table events via delegation
            body.addEventListener('click', function(e) {
                var btn = e.target.closest('button');
                if (!btn) return;
                var id = btn.getAttribute('data-id');
                if (!id) return;

                if (btn.classList.contains('crm-btn-detail')) {
                    showContactDetail(id);
                } else if (btn.classList.contains('crm-btn-edit')) {
                    shared.safe(shared.api().getCrmContacts({ search: '' })).then(function(d) {
                        var contact = d ? (d.contacts || []).find(function(c) { return c.id === id; }) : null;
                        if (contact) showContactModal(contact);
                    });
                } else if (btn.classList.contains('crm-btn-delete')) {
                    if (confirm('Kontakt wirklich l\u00f6schen?')) {
                        shared.api().deleteCrmContact(id).then(function() {
                            loadContacts(container);
                        });
                    }
                }
            });
        });
    }

    /* ------------------------------------------------------------------
       Contact Modal (Create/Edit)
       ------------------------------------------------------------------ */

    function showContactModal(contact) {
        var shared = getShared();
        var isEdit = !!contact;
        var title = isEdit ? 'Kontakt bearbeiten' : 'Neuer Kontakt';
        var c = contact || {};

        var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-modal">';
        html += '<div class="dgd-modal crm-modal crm-modal--wide">';
        html += '<div class="dgd-modal__header"><h3>' + title + '</h3><button class="dgd-modal__close" id="crm-modal-close">&times;</button></div>';
        html += '<form id="crm-contact-form" class="dgd-form">';

        // Section 1: Lead-Daten
        html += '<h4 style="margin:0 0 12px;font-size:14px;color:var(--dgd-gray-600)">Lead-Daten</h4>';
        html += '<div class="crm-form-grid">';
        html += shared.formField('Name *', 'text', 'crm-f-name', c.name, 'required');
        html += shared.formField('E-Mail', 'email', 'crm-f-email', c.email);
        html += shared.formField('Telefon', 'text', 'crm-f-phone', c.phone);
        html += shared.formField('Organisation', 'text', 'crm-f-org', c.organization);

        // Leadquelle
        html += shared.formSelect('Leadquelle *', 'crm-f-leadsource', [''].concat(shared.LEADQUELLEN), c.lead_source || '');

        // Partnertyp radio
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Partnertyp *</label>';
        html += '<div style="display:flex;gap:16px">';
        html += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="crm-f-partnertype" value="sv"' + (c.partner_type === 'sv' ? ' checked' : '') + '> SV</label>';
        html += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="crm-f-partnertype" value="profi"' + (c.partner_type === 'profi' ? ' checked' : '') + '> Profi</label>';
        html += '</div></div>';

        html += shared.formField('Umsatzpotenzial', 'number', 'crm-f-potential', c.revenue_potential);

        // Pipeline-Liste
        html += shared.formSelect('Pipeline-Liste *', 'crm-f-stage', shared.LEAD_STAGES, c.pipeline_stage || 'neu');

        html += shared.formField('Next Step *', 'text', 'crm-f-nextstep', c.next_step);
        html += shared.formField('Next Step Datum *', 'datetime-local', 'crm-f-nextstepdate', c.next_step_date ? c.next_step_date.substring(0, 16) : '');
        html += shared.formField('Zust\u00e4ndig', 'text', 'crm-f-assigned', c.assigned_to);
        html += '</div>';

        // Section 2: Zusatzinfos (collapsible)
        html += '<fieldset style="border:1px solid var(--dgd-gray-300);border-radius:8px;padding:12px;margin:12px 0">';
        html += '<legend style="color:var(--dgd-gray-500);font-size:0.85rem;cursor:pointer" id="crm-toggle-extra">Zusatzinfos \u25BC</legend>';
        html += '<div id="crm-extra-fields" class="crm-form-grid">';
        html += shared.formField('Position', 'text', 'crm-f-jobtitle', c.job_title);
        html += shared.formField('Betriebsart', 'text', 'crm-f-biztype', c.business_type);
        html += shared.formField('Webseite', 'url', 'crm-f-website', c.website);
        html += shared.formField('GA-Anzahl', 'number', 'crm-f-gacount', c.ga_count || '0');

        // Address
        html += shared.formField('Stra\u00dfe', 'text', 'crm-f-street', c.street);
        html += shared.formField('PLZ', 'text', 'crm-f-zip', c.zip);
        html += shared.formField('Ort', 'text', 'crm-f-city', c.city);
        html += shared.formField('Bundesland', 'text', 'crm-f-state', c.state);

        html += shared.formField('Gesch\u00e4ftsf\u00fchrer', 'text', 'crm-f-gf', c.geschaeftsfuehrer);
        html += shared.formCheckbox('GF-Match', 'crm-f-gfmatch', c.gf_match);
        html += shared.formCheckbox('Onboarding-Mail versendet', 'crm-f-onboardingmail', c.onboarding_mail_sent);

        html += '</div>'; // crm-form-grid inside fieldset

        // Full-width fields after grid
        html += shared.formTextarea('AI-Research', 'crm-f-airesearch', c.ai_research, 'readonly style="background:var(--dgd-gray-50);color:var(--dgd-gray-600)"');
        html += shared.formTextarea('Firmeninfos', 'crm-f-companyinfo', c.company_info);
        html += shared.formTextarea('Notizen', 'crm-f-notes', c.notes);
        html += '</fieldset>';

        html += '<div class="dgd-form__actions">';
        html += '<button type="submit" class="dgd-btn dgd-btn--primary">' + (isEdit ? 'Speichern' : 'Erstellen') + '</button>';
        html += '<button type="button" class="dgd-btn dgd-btn--outline" id="crm-modal-cancel">Abbrechen</button>';
        html += '</div></form></div></div>';

        var mc = document.getElementById('modal-container');
        mc.innerHTML = html;

        // Collapse toggle
        var toggleBtn = mc.querySelector('#crm-toggle-extra');
        var extraFields = mc.querySelector('#crm-extra-fields');
        if (toggleBtn && extraFields) {
            toggleBtn.addEventListener('click', function() {
                var hidden = extraFields.style.display === 'none';
                extraFields.style.display = hidden ? '' : 'none';
                // Also toggle textareas after the grid
                var textareas = extraFields.parentElement.querySelectorAll('.dgd-form__group');
                // The textareas after crm-extra-fields need special handling - they are siblings
            });
        }

        mc.querySelector('#crm-modal-close').onclick = shared.closeModal;
        mc.querySelector('#crm-modal-cancel').onclick = shared.closeModal;

        mc.querySelector('#crm-contact-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var partnerRadio = mc.querySelector('input[name="crm-f-partnertype"]:checked');
            var data = {
                name: mc.querySelector('#crm-f-name').value,
                email: mc.querySelector('#crm-f-email').value,
                phone: mc.querySelector('#crm-f-phone').value,
                organization: mc.querySelector('#crm-f-org').value,
                lead_source: mc.querySelector('#crm-f-leadsource').value,
                partner_type: partnerRadio ? partnerRadio.value : '',
                revenue_potential: parseFloat(mc.querySelector('#crm-f-potential').value) || 0,
                pipeline_stage: mc.querySelector('#crm-f-stage').value,
                next_step: mc.querySelector('#crm-f-nextstep').value,
                next_step_date: mc.querySelector('#crm-f-nextstepdate').value || null,
                assigned_to: mc.querySelector('#crm-f-assigned').value,
                job_title: mc.querySelector('#crm-f-jobtitle').value,
                business_type: mc.querySelector('#crm-f-biztype').value,
                website: mc.querySelector('#crm-f-website').value,
                ga_count: parseInt(mc.querySelector('#crm-f-gacount').value) || 0,
                street: mc.querySelector('#crm-f-street').value,
                zip: mc.querySelector('#crm-f-zip').value,
                city: mc.querySelector('#crm-f-city').value,
                state: mc.querySelector('#crm-f-state').value,
                geschaeftsfuehrer: mc.querySelector('#crm-f-gf').value,
                gf_match: mc.querySelector('#crm-f-gfmatch').checked,
                onboarding_mail_sent: mc.querySelector('#crm-f-onboardingmail').checked,
                ai_research: mc.querySelector('#crm-f-airesearch').value,
                company_info: mc.querySelector('#crm-f-companyinfo').value,
                notes: mc.querySelector('#crm-f-notes').value,
            };

            var promise = isEdit
                ? shared.api().updateCrmContact(contact.id, data)
                : shared.api().createCrmContact(data);

            promise.then(function() {
                shared.closeModal();
                shared.refreshView();
            });
        });
    }

    /* ------------------------------------------------------------------
       Contact Detail
       ------------------------------------------------------------------ */

    function showContactDetail(contactId) {
        var shared = getShared();
        var mc = document.getElementById('modal-container');
        mc.innerHTML = '<div class="dgd-modal-overlay crm-modal-overlay"><div class="dgd-modal crm-modal crm-modal--wide"><div class="crm-loading">Laden...</div></div></div>';

        Promise.all([
            shared.safe(shared.api().getCrmContacts({ search: '' })).then(function(d) {
                return d ? (d.contacts || []).find(function(c) { return c.id === contactId; }) : null;
            }),
            shared.safe(shared.api().getCrmActivityLog(contactId)),
            shared.safe(shared.api().getCrmTasks({ contact_id: contactId })),
            shared.safe(shared.api().getCrmOrders({ contact_id: contactId })),
        ]).then(function(results) {
            var contact = results[0];
            var activityData = results[1];
            var tasksData = results[2];
            var ordersData = results[3];

            if (!contact) { mc.innerHTML = ''; return; }

            var activities = activityData ? (activityData.activities || []) : [];
            var tasks = tasksData ? (tasksData.tasks || []) : [];
            var orders = ordersData ? (ordersData.orders || []) : [];

            var pendingTasks = tasks.filter(function(t) { return t.status !== 'completed'; });
            var completedTasks = tasks.filter(function(t) { return t.status === 'completed'; });

            var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-modal">';
            html += '<div class="dgd-modal crm-modal crm-modal--wide" style="max-height:90vh;overflow-y:auto">';

            // Header
            html += '<div class="dgd-modal__header">';
            html += '<h3>' + shared.esc(contact.name) + ' ';
            html += shared.partnerBadge(contact.partner_type, contact.ga_count);
            html += '</h3>';
            html += '<button class="dgd-modal__close" id="crm-modal-close">&times;</button>';
            html += '</div>';

            html += '<div class="crm-detail">';

            // Info grid
            html += '<div class="crm-detail__grid">';
            html += detailField('E-Mail', contact.email);
            html += detailField('Telefon', contact.phone);
            html += detailField('Organisation', contact.organization);
            html += detailField('Position', contact.job_title);
            html += detailField('Betriebsart', contact.business_type);
            html += detailField('Webseite', contact.website, true);
            html += detailField('Liste', '<span class="crm-stage-badge" style="background:' + shared.stageColor(contact.pipeline_stage) + '">' + shared.stageLabel(contact.pipeline_stage) + '</span>', false, true);
            html += detailField('Leadquelle', contact.lead_source);
            html += detailField('Next Step', contact.next_step);
            html += detailField('Next Step Datum', shared.formatDate(contact.next_step_date));
            html += detailField('Zust\u00e4ndig', contact.assigned_to);
            html += detailField('GA-Anzahl', contact.ga_count);
            html += detailField('Umsatzpotenzial', contact.revenue_potential ? shared.formatCurrency(contact.revenue_potential) : null);
            html += detailField('Gesch\u00e4ftsf\u00fchrer', contact.geschaeftsfuehrer);
            html += detailField('GF-Match', contact.gf_match ? 'Ja' : 'Nein');

            // Address
            var addr = [contact.street, (contact.zip || '') + ' ' + (contact.city || ''), contact.state].filter(Boolean).join(', ');
            if (addr.trim()) html += detailField('Adresse', addr);

            html += '</div>';

            if (contact.notes) {
                html += '<div style="margin:12px 0;padding:8px 12px;background:var(--dgd-gray-50);border-radius:6px;border-left:3px solid var(--dgd-gray-300)">';
                html += '<strong style="font-size:12px;color:var(--dgd-gray-500)">Notizen</strong><br>';
                html += '<span style="white-space:pre-wrap;font-size:13px">' + shared.esc(contact.notes) + '</span>';
                html += '</div>';
            }

            if (contact.ai_research) {
                html += '<div style="margin:12px 0;padding:8px 12px;background:var(--dgd-gray-50);border-radius:6px;border-left:3px solid #60a5fa">';
                html += '<strong style="font-size:12px;color:var(--dgd-gray-500)">AI-Research</strong><br>';
                html += '<span style="white-space:pre-wrap;font-size:13px">' + shared.esc(contact.ai_research) + '</span>';
                html += '</div>';
            }

            // Action buttons
            html += '<div class="crm-detail__actions" style="margin:16px 0;display:flex;gap:8px">';
            html += '<button class="dgd-btn dgd-btn--sm dgd-btn--primary" id="crm-edit-contact">Bearbeiten</button>';
            html += '<button class="dgd-btn dgd-btn--sm dgd-btn--outline" id="crm-add-task">Task anlegen</button>';
            html += '<button class="dgd-btn dgd-btn--sm dgd-btn--outline" id="crm-add-interaction">Interaktion hinzuf\u00fcgen</button>';
            html += '</div>';

            // Aufgaben section
            html += '<div class="crm-detail__section"><h4>Aufgaben (' + pendingTasks.length + ' offen)</h4>';
            if (pendingTasks.length > 0) {
                pendingTasks.forEach(function(t) {
                    html += '<div class="crm-task-row">';
                    html += '<span class="crm-task-time">' + shared.formatDate(t.due_date) + '</span>';
                    html += '<span class="crm-task-title">' + shared.esc(t.title) + '</span>';
                    html += '<div class="crm-task-actions">';
                    html += '<button class="dgd-btn dgd-btn--xs crm-complete-task" data-task-id="' + shared.esc(t.id) + '">\u2713</button>';
                    html += '<button class="dgd-btn dgd-btn--xs crm-reschedule-task" data-task-id="' + shared.esc(t.id) + '">\u21BB</button>';
                    html += '</div></div>';
                });
            } else {
                html += '<div class="crm-empty" style="padding:8px;font-size:13px">Keine offenen Aufgaben</div>';
            }

            if (completedTasks.length > 0) {
                html += '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:var(--dgd-gray-500)">' + completedTasks.length + ' erledigte Aufgaben</summary>';
                completedTasks.forEach(function(t) {
                    html += '<div class="crm-task-row" style="opacity:0.5;text-decoration:line-through">';
                    html += '<span class="crm-task-time">' + shared.formatDate(t.due_date) + '</span>';
                    html += '<span class="crm-task-title">' + shared.esc(t.title) + '</span>';
                    html += '</div>';
                });
                html += '</details>';
            }
            html += '</div>';

            // Activity Log
            html += '<div class="crm-detail__section"><h4>Aktivit\u00e4ten (' + activities.length + ')</h4>';
            html += '<div class="crm-activity-log">';
            if (activities.length === 0) {
                html += '<div class="crm-empty" style="padding:8px;font-size:13px">Keine Aktivit\u00e4ten</div>';
            } else {
                activities.forEach(function(a) {
                    var iconClass = 'crm-activity-entry__icon';
                    if (a.type === 'stage_change') iconClass += ' crm-activity-entry__icon--stage';
                    else if (a.type === 'task') iconClass += ' crm-activity-entry__icon--task';
                    else iconClass += ' crm-activity-entry__icon--interaction';

                    var icon = '\u2022';
                    if (a.type === 'stage_change') icon = '\u2192';
                    else if (a.type === 'task') icon = '\u2713';
                    else if (a.type === 'email') icon = '@';
                    else if (a.type === 'call') icon = '\u260E';
                    else if (a.type === 'meeting') icon = '\u25CB';
                    else if (a.type === 'note') icon = '\u270E';

                    html += '<div class="crm-activity-entry">';
                    html += '<div class="' + iconClass + '">' + icon + '</div>';
                    html += '<div class="crm-activity-entry__content">';
                    html += '<div>' + shared.esc(a.summary || a.description || '') + '</div>';
                    html += '<div class="crm-activity-entry__time">' + shared.formatDateTime(a.created_at) + '</div>';
                    html += '</div></div>';
                });
            }
            html += '</div></div>';

            // Orders (if partner)
            if (contact.is_partner || orders.length > 0) {
                html += '<div class="crm-detail__section"><h4>Auftr\u00e4ge (' + orders.length + ')</h4>';
                if (orders.length > 0) {
                    html += '<table class="crm-table" style="font-size:13px"><thead><tr>';
                    html += '<th>Typ</th><th>Datum</th><th>Status</th><th>Ergebnis</th>';
                    html += '</tr></thead><tbody>';
                    orders.forEach(function(o) {
                        html += '<tr>';
                        html += '<td>' + shared.esc(o.type || '-') + '</td>';
                        html += '<td>' + shared.formatDate(o.submitted_at) + '</td>';
                        html += '<td>' + shared.esc(o.status || '-') + '</td>';
                        html += '<td>' + shared.esc(o.result || '-') + '</td>';
                        html += '</tr>';
                    });
                    html += '</tbody></table>';
                } else {
                    html += '<div class="crm-empty" style="padding:8px;font-size:13px">Keine Auftr\u00e4ge</div>';
                }
                html += '</div>';
            }

            html += '</div></div></div>';
            mc.innerHTML = html;

            // Bind events
            mc.querySelector('#crm-modal-close').onclick = shared.closeModal;

            mc.querySelector('#crm-edit-contact').onclick = function() {
                shared.closeModal();
                showContactModal(contact);
            };

            mc.querySelector('#crm-add-task').onclick = function() {
                showTaskModal(contactId);
            };

            mc.querySelector('#crm-add-interaction').onclick = function() {
                showInteractionModal(contact);
            };

            // Task complete/reschedule buttons
            mc.querySelectorAll('.crm-complete-task').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    shared.api().updateCrmTask(btn.getAttribute('data-task-id'), { status: 'completed' }).then(function() {
                        showContactDetail(contactId);
                    });
                });
            });

            mc.querySelectorAll('.crm-reschedule-task').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(9, 0, 0, 0);
                    shared.api().updateCrmTask(btn.getAttribute('data-task-id'), { due_date: tomorrow.toISOString() }).then(function() {
                        showContactDetail(contactId);
                    });
                });
            });
        });
    }

    /* ------------------------------------------------------------------
       Detail Field Helper
       ------------------------------------------------------------------ */

    function detailField(label, value, isLink, isHtml) {
        var shared = getShared();
        if (value === null || value === undefined || value === '') value = '-';
        var display;
        if (isHtml) {
            display = value;
        } else if (isLink && value !== '-') {
            display = '<a href="' + shared.esc(String(value)) + '" target="_blank" style="color:#60a5fa">' + shared.esc(String(value)) + '</a>';
        } else {
            display = shared.esc(String(value));
        }
        return '<div class="crm-detail__field"><strong>' + label + ':</strong> ' + display + '</div>';
    }

    /* ------------------------------------------------------------------
       Task Modal
       ------------------------------------------------------------------ */

    function showTaskModal(contactId) {
        var shared = getShared();
        var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-task-modal">';
        html += '<div class="dgd-modal crm-modal">';
        html += '<div class="dgd-modal__header"><h3>Neue Aufgabe</h3><button class="dgd-modal__close" id="crm-task-close">&times;</button></div>';
        html += '<form id="crm-task-form" class="dgd-form">';

        html += shared.formField('Titel *', 'text', 'crm-t-title', '', 'required');
        html += shared.formTextarea('Beschreibung', 'crm-t-desc', '');
        html += shared.formField('F\u00e4llig am *', 'datetime-local', 'crm-t-due', '', 'required');

        html += shared.formSelect('Erinnerungs-Intervall', 'crm-t-reminder', [
            { key: 'none',     label: 'Keine Erinnerung' },
            { key: 'daily',    label: 'T\u00e4glich' },
            { key: '3days',    label: 'Alle 3 Tage' },
            { key: 'weekly',   label: 'W\u00f6chentlich' },
            { key: 'biweekly', label: 'Alle 2 Wochen' },
            { key: 'monthly',  label: 'Monatlich' },
        ], 'none');

        html += '<div class="dgd-form__actions">';
        html += '<button type="submit" class="dgd-btn dgd-btn--primary">Erstellen</button>';
        html += '<button type="button" class="dgd-btn dgd-btn--outline" id="crm-task-cancel">Abbrechen</button>';
        html += '</div></form></div></div>';

        var mc = document.getElementById('modal-container');
        mc.innerHTML = html;

        mc.querySelector('#crm-task-close').onclick = function() { shared.closeModal(); showContactDetail(contactId); };
        mc.querySelector('#crm-task-cancel').onclick = function() { shared.closeModal(); showContactDetail(contactId); };

        mc.querySelector('#crm-task-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var reminder = mc.querySelector('#crm-t-reminder').value;
            shared.api().createCrmTask({
                contact_id: contactId,
                title: mc.querySelector('#crm-t-title').value,
                description: mc.querySelector('#crm-t-desc').value,
                due_date: mc.querySelector('#crm-t-due').value || null,
                reminder_interval: reminder !== 'none' ? reminder : null,
            }).then(function() {
                shared.closeModal();
                showContactDetail(contactId);
            });
        });
    }

    /* ------------------------------------------------------------------
       Interaction Modal
       ------------------------------------------------------------------ */

    function showInteractionModal(contact) {
        var shared = getShared();
        var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-interaction-modal">';
        html += '<div class="dgd-modal crm-modal">';
        html += '<div class="dgd-modal__header"><h3>Neue Interaktion - ' + shared.esc(contact.name) + '</h3><button class="dgd-modal__close" id="crm-int-close">&times;</button></div>';
        html += '<form id="crm-int-form" class="dgd-form">';

        html += shared.formSelect('Typ', 'crm-int-type', shared.INTERACTION_TYPES, 'email');
        html += shared.formField('Zusammenfassung *', 'text', 'crm-int-summary', '', 'required');
        html += shared.formTextarea('Details', 'crm-int-details', '');

        html += '<div class="dgd-form__actions">';
        html += '<button type="submit" class="dgd-btn dgd-btn--primary">Erstellen</button>';
        html += '<button type="button" class="dgd-btn dgd-btn--outline" id="crm-int-cancel">Abbrechen</button>';
        html += '</div></form></div></div>';

        var mc = document.getElementById('modal-container');
        mc.innerHTML = html;

        mc.querySelector('#crm-int-close').onclick = function() { shared.closeModal(); showContactDetail(contact.id); };
        mc.querySelector('#crm-int-cancel').onclick = function() { shared.closeModal(); showContactDetail(contact.id); };

        mc.querySelector('#crm-int-form').addEventListener('submit', function(e) {
            e.preventDefault();
            shared.api().createCrmInteraction({
                contact_id: contact.id,
                type: mc.querySelector('#crm-int-type').value,
                summary: mc.querySelector('#crm-int-summary').value,
                details: mc.querySelector('#crm-int-details').value,
            }).then(function() {
                shared.closeModal();
                showContactDetail(contact.id);
            });
        });
    }

    // ---- Register sub-module ----

    DGD.views.crmContacts = {
        render: renderContactsTable,
        showContactDetail: showContactDetail,
        showContactModal: showContactModal
    };
})();
