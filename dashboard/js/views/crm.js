/* ==========================================================================
   DGD Dashboard - CRM View (Rewrite)
   4 Tabs: Tagesansicht, Kontakte, Pipeline, Partner-Aktivierung
   Depends on: namespace.js, helpers.js, api.js
   ========================================================================== */

(function() {
    'use strict';

    var $ = function(sel) { return document.querySelector(sel); };
    var esc = function(v) { return DGD.helpers.escapeHtml(v); };
    var api = function() { return window.dashboardApi || DGD.api; };

    // ---- Constants ----

    var LEAD_STAGES = [
        { key: 'neu',                  label: 'Neu',                      color: '#94a3b8' },
        { key: 'nicht_erreicht',       label: 'Nicht erreicht',           color: '#64748b' },
        { key: 'quali_terminiert',     label: 'Quali terminiert',         color: '#60a5fa' },
        { key: 'no_show_quali',        label: 'No-Show Quali',            color: '#f97316' },
        { key: 'quali_gefuehrt',       label: 'Quali gef\u00fchrt',      color: '#a78bfa' },
        { key: 'abschluss_terminiert', label: 'Abschluss terminiert',     color: '#22d3ee' },
        { key: 'no_show_abschluss',    label: 'No-Show Abschluss',        color: '#fb923c' },
        { key: 'abschluss_gefuehrt',   label: 'Abschluss gef\u00fchrt',  color: '#8b5cf6' },
        { key: 'entscheidung',         label: 'Entscheidung ausstehend',  color: '#eab308' },
        { key: 'gewonnen',             label: 'Gewonnen',                 color: '#22c55e' },
        { key: 'verloren',             label: 'Verloren',                 color: '#ef4444' },
        { key: 'stillgelegt',          label: 'Stillgelegt / WV',         color: '#6b7280' },
    ];

    var ACTIVATION_STAGES = [
        { key: 'registriert',    label: 'Registriert',    color: '#60a5fa' },
        { key: 'verifiziert',    label: 'Verifiziert',    color: '#a78bfa' },
        { key: 'testschaden',    label: 'Testschaden',    color: '#f59e0b' },
        { key: 'erster_auftrag', label: 'Erster Auftrag', color: '#22c55e' },
    ];

    var LEADQUELLEN = ['Website-Partner', 'Website-Rente', 'Empfehlung', 'Kaltakquise', 'Trello', 'Sonstige'];

    var INTERACTION_TYPES = [
        { key: 'email',   label: 'E-Mail',   icon: '@' },
        { key: 'call',    label: 'Anruf',    icon: '\u260E' },
        { key: 'meeting', label: 'Meeting',  icon: '\u25CB' },
        { key: 'note',    label: 'Notiz',    icon: '\u270E' },
    ];

    // ---- Helpers ----

    function stageLabel(key) {
        var s = LEAD_STAGES.find(function(st) { return st.key === key; });
        return s ? s.label : key;
    }

    function stageColor(key) {
        var s = LEAD_STAGES.find(function(st) { return st.key === key; });
        return s ? s.color : '#94a3b8';
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(val || 0);
    }

    function formatDate(iso) {
        if (!iso) return '-';
        var d = new Date(iso);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatDateTime(iso) {
        if (!iso) return '-';
        var d = new Date(iso);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }

    function formatTime(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }

    function isOverdue(dateStr) {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date();
    }

    function safe(promise) { return promise.catch(function() { return null; }); }

    function formField(label, type, id, value, attrs) {
        attrs = attrs || '';
        return '<div class="dgd-form__group">'
            + '<label class="dgd-form__label" for="' + id + '">' + label + '</label>'
            + '<input type="' + type + '" class="dgd-form__input" id="' + id + '" value="' + esc(String(value || '')) + '" ' + attrs + '>'
            + '</div>';
    }

    function formSelect(label, id, options, selected) {
        var html = '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label" for="' + id + '">' + label + '</label>';
        html += '<select class="dgd-form__input" id="' + id + '">';
        options.forEach(function(opt) {
            var val = typeof opt === 'string' ? opt : opt.key;
            var lbl = typeof opt === 'string' ? opt : opt.label;
            var sel = val === selected ? ' selected' : '';
            html += '<option value="' + esc(val) + '"' + sel + '>' + esc(lbl) + '</option>';
        });
        html += '</select></div>';
        return html;
    }

    function formTextarea(label, id, value, attrs) {
        attrs = attrs || '';
        return '<div class="dgd-form__group">'
            + '<label class="dgd-form__label" for="' + id + '">' + label + '</label>'
            + '<textarea class="dgd-form__input" id="' + id + '" rows="3" ' + attrs + '>' + esc(value || '') + '</textarea>'
            + '</div>';
    }

    function formCheckbox(label, id, checked) {
        return '<div class="dgd-form__group dgd-form__group--inline">'
            + '<label class="dgd-form__label" style="display:flex;align-items:center;gap:6px;cursor:pointer">'
            + '<input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '> ' + label
            + '</label></div>';
    }

    function partnerBadge(partnerType, gaCount) {
        var html = '';
        if (partnerType === 'sv') {
            html += '<span class="crm-label-badge crm-label-badge--sv">SV</span> ';
        } else if (partnerType === 'profi') {
            html += '<span class="crm-label-badge crm-label-badge--profi">Profi</span> ';
            if (gaCount > 10) {
                html += '<span class="crm-label-badge crm-label-badge--top-potential">Top-Potential</span> ';
            }
        }
        return html;
    }

    function closeModal() {
        var mc = document.getElementById('modal-container');
        if (mc) mc.innerHTML = '';
    }

    // Reference to current container for refreshing
    var _container = null;
    var _activeTab = 'daily';

    function refreshView() {
        if (_container) DGD.views.crm(_container);
    }

    // ---- KPI Bar ----

    function renderKpiBar(stats) {
        var s = stats || {};
        var html = '<div class="crm-kpis">';
        html += kpiCard('Kontakte', s.total_contacts || 0, '', 'crm-kpi--contacts');
        html += kpiCard('Aufgaben heute', s.tasks_today || 0, '', 'crm-kpi--tasks', 'background:#dbeafe;color:#1d4ed8');
        html += kpiCard('\u00dcberf\u00e4llig', s.overdue_tasks || 0, '', 'crm-kpi--overdue', (s.overdue_tasks || 0) > 0 ? 'background:#fee2e2;color:#dc2626' : '');
        html += kpiCard('Partner in Aktivierung', s.partners_activating || 0, '', '');
        html += kpiCard('Gewonnen', s.won_count || 0, '', 'crm-kpi--won');
        html += '</div>';
        return html;
    }

    function kpiCard(label, value, sub, cls, badgeStyle) {
        var valueHtml = '<div class="crm-kpi__value"';
        if (badgeStyle) valueHtml += ' style="' + badgeStyle + ';padding:2px 10px;border-radius:8px;display:inline-block"';
        valueHtml += '>' + value + '</div>';
        return '<div class="crm-kpi ' + (cls || '') + '">'
            + valueHtml
            + '<div class="crm-kpi__label">' + label + '</div>'
            + (sub ? '<div class="crm-kpi__sub">' + sub + '</div>' : '')
            + '</div>';
    }

    // ---- Tab Navigation ----

    function renderTabs() {
        var tabs = [
            { key: 'daily',      label: 'Tagesansicht' },
            { key: 'contacts',   label: 'Kontakte' },
            { key: 'pipeline',   label: 'Pipeline' },
            { key: 'activation', label: 'Partner-Aktivierung' },
        ];
        var html = '<div class="crm-tabs">';
        tabs.forEach(function(t) {
            var active = t.key === _activeTab ? ' crm-tab--active' : '';
            html += '<button class="crm-tab' + active + '" data-tab="' + t.key + '">' + t.label + '</button>';
        });
        html += '</div>';
        return html;
    }

    // ---- Daily View ----

    function renderDailyView(container) {
        container.innerHTML = '<div class="crm-loading">Tagesansicht wird geladen...</div>';
        safe(api().getCrmTasksToday()).then(function(data) {
            if (!data || !data.categories) {
                container.innerHTML = '<div class="crm-empty-state">Keine Aufgaben f\u00fcr heute \ud83c\udf89</div>';
                return;
            }

            var cats = data.categories;
            if (cats.length === 0) {
                container.innerHTML = '<div class="crm-empty-state">Keine Aufgaben f\u00fcr heute \ud83c\udf89</div>';
                return;
            }

            var html = '<div class="crm-daily-view">';
            cats.forEach(function(cat) {
                var sectionClass = 'crm-daily-section';
                if (cat.key === 'overdue') sectionClass += ' crm-daily-section--overdue';
                else if (cat.key === 'quali') sectionClass += ' crm-daily-section--quali';
                else if (cat.key === 'abschluss') sectionClass += ' crm-daily-section--abschluss';
                else if (cat.key === 'erstkontakt') sectionClass += ' crm-daily-section--erstkontakt';
                else if (cat.key === 'aktivierung') sectionClass += ' crm-daily-section--aktivierung';

                if (cat.color) {
                    html += '<div class="' + sectionClass + '" style="border-left-color:' + cat.color + '">';
                } else {
                    html += '<div class="' + sectionClass + '">';
                }

                html += '<div class="crm-daily-section__header">';
                html += '<span>' + esc(cat.label) + '</span>';
                html += '<span class="crm-daily-section__count">' + (cat.tasks ? cat.tasks.length : 0) + '</span>';
                html += '</div>';

                if (cat.tasks && cat.tasks.length > 0) {
                    cat.tasks.forEach(function(task) {
                        var rowClass = 'crm-task-row';
                        if (cat.key === 'overdue') rowClass += ' crm-task-row--overdue';

                        html += '<div class="' + rowClass + '">';
                        html += '<span class="crm-task-time">' + esc(formatTime(task.due_date) || '') + '</span>';
                        html += '<a class="crm-task-contact" href="#" data-contact-id="' + esc(task.contact_id || '') + '">' + esc(task.contact_name || 'Unbekannt') + '</a>';
                        html += '<span class="crm-task-title">' + esc(task.title || '') + '</span>';
                        html += '<div class="crm-task-actions">';
                        html += '<button class="dgd-btn dgd-btn--xs" data-action="complete" data-task-id="' + esc(task.id) + '" title="Erledigt">\u2713</button>';
                        html += '<button class="dgd-btn dgd-btn--xs" data-action="reschedule" data-task-id="' + esc(task.id) + '" title="Verschieben">\u21BB</button>';
                        html += '</div>';
                        html += '</div>';
                    });
                } else {
                    html += '<div class="crm-empty-state" style="padding:12px">Keine Aufgaben</div>';
                }

                html += '</div>';
            });
            html += '</div>';

            container.innerHTML = html;
            bindDailyEvents(container);
        });
    }

    function bindDailyEvents(container) {
        container.addEventListener('click', function(e) {
            var target = e.target;

            // Contact link
            if (target.classList.contains('crm-task-contact')) {
                e.preventDefault();
                var contactId = target.getAttribute('data-contact-id');
                if (contactId) showContactDetail(contactId);
                return;
            }

            // Task actions
            var btn = target.closest('[data-action]');
            if (!btn) return;

            var action = btn.getAttribute('data-action');
            var taskId = btn.getAttribute('data-task-id');
            if (!taskId) return;

            if (action === 'complete') {
                api().updateCrmTask(taskId, { status: 'completed' }).then(function() {
                    renderDailyView(container);
                });
            } else if (action === 'reschedule') {
                // Simple reschedule: move to tomorrow
                var tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0);
                api().updateCrmTask(taskId, { due_date: tomorrow.toISOString() }).then(function() {
                    renderDailyView(container);
                });
            }
        });
    }

    // ---- Contacts Table ----

    function renderContactsTable(container) {
        // Toolbar
        var html = '<div class="crm-toolbar">';
        html += '<div class="crm-toolbar__left">';
        html += '<button class="dgd-btn dgd-btn--primary dgd-btn--sm" id="crm-add-contact">+ Kontakt</button>';
        html += '</div>';
        html += '<div class="crm-toolbar__right">';
        html += '<div class="crm-filters">';
        html += '<input type="text" class="dgd-form__input dgd-form__input--sm" id="crm-search" placeholder="Suchen...">';
        html += '<select class="dgd-form__input dgd-form__input--sm" id="crm-filter-stage"><option value="">Alle Listen</option>';
        LEAD_STAGES.forEach(function(s) {
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

    function loadContacts(container) {
        var filters = {};
        var searchInput = container.querySelector('#crm-search');
        var filterStage = container.querySelector('#crm-filter-stage');
        var filterType = container.querySelector('#crm-filter-type');

        if (searchInput && searchInput.value) filters.search = searchInput.value;
        if (filterStage && filterStage.value) filters.stage = filterStage.value;
        if (filterType && filterType.value) filters.partner_type = filterType.value;

        safe(api().getCrmContacts(filters)).then(function(data) {
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
                var overdue = isOverdue(c.next_step_date);
                html += '<tr class="crm-row' + (overdue ? ' crm-row--overdue' : '') + '" data-id="' + c.id + '">';

                // Name
                html += '<td class="crm-cell--name"><strong>' + esc(c.name) + '</strong>';
                if (c.email) html += '<br><small>' + esc(c.email) + '</small>';
                html += '</td>';

                // Organisation
                html += '<td>' + esc(c.organization || '-') + '</td>';

                // Betriebsart + badges
                html += '<td>';
                html += partnerBadge(c.partner_type, c.ga_count);
                if (c.business_type) html += '<br><small>' + esc(c.business_type) + '</small>';
                html += '</td>';

                // Pipeline stage badge
                html += '<td><span class="crm-stage-badge" style="background:' + stageColor(c.pipeline_stage) + '">' + stageLabel(c.pipeline_stage) + '</span></td>';

                // Leadquelle
                html += '<td>' + esc(c.lead_source || '-') + '</td>';

                // Next Step
                html += '<td>' + esc(c.next_step || '-') + '</td>';

                // Datum
                html += '<td>';
                if (overdue) html += '<span class="crm-overdue">';
                html += formatDate(c.next_step_date);
                if (overdue) html += '</span>';
                html += '</td>';

                // Zustaendig
                html += '<td>' + esc(c.assigned_to || '-') + '</td>';

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
                    safe(api().getCrmContacts({ search: '' })).then(function(d) {
                        var contact = d ? (d.contacts || []).find(function(c) { return c.id === id; }) : null;
                        if (contact) showContactModal(contact);
                    });
                } else if (btn.classList.contains('crm-btn-delete')) {
                    if (confirm('Kontakt wirklich l\u00f6schen?')) {
                        api().deleteCrmContact(id).then(function() {
                            loadContacts(container);
                        });
                    }
                }
            });
        });
    }

    // ---- Pipeline ----

    function renderPipeline(container) {
        container.innerHTML = '<div class="crm-loading">Pipeline wird geladen...</div>';

        safe(api().getCrmContacts()).then(function(data) {
            var contacts = data ? (data.contacts || []) : [];

            // Group contacts by pipeline_stage
            var columns = {};
            LEAD_STAGES.forEach(function(s) { columns[s.key] = []; });
            contacts.forEach(function(c) {
                var stage = c.pipeline_stage || 'neu';
                if (!columns[stage]) columns[stage] = [];
                columns[stage].push(c);
            });

            var html = '<div class="crm-pipeline" style="overflow-x:auto">';
            LEAD_STAGES.forEach(function(stage) {
                var cards = columns[stage.key] || [];
                html += '<div class="crm-pipeline__col" data-stage="' + stage.key + '">';
                html += '<div class="crm-pipeline__header" style="border-top:3px solid ' + stage.color + '">';
                html += '<span>' + esc(stage.label) + '</span>';
                html += '<span class="crm-pipeline__count">' + cards.length + '</span>';
                html += '</div>';

                cards.forEach(function(c) {
                    html += '<div class="crm-pipeline__card" draggable="true" data-contact-id="' + c.id + '">';
                    html += '<div class="crm-pipeline__card-name">' + esc(c.name) + '</div>';
                    html += '<div class="crm-pipeline__card-org">' + esc(c.organization || '') + '</div>';
                    if (c.next_step) {
                        html += '<div class="crm-pipeline__card-step">Next Step: ' + esc(c.next_step) + '</div>';
                    }
                    if (c.next_step_date) {
                        html += '<div class="crm-pipeline__card-date">' + formatDate(c.next_step_date) + '</div>';
                    }
                    html += partnerBadge(c.partner_type, c.ga_count);
                    html += '</div>';
                });

                if (cards.length === 0) {
                    html += '<div class="crm-pipeline__empty">Keine Kontakte</div>';
                }

                html += '</div>';
            });
            html += '</div>';

            container.innerHTML = html;
            bindPipelineDragDrop(container);
        });
    }

    function bindPipelineDragDrop(container) {
        var draggedId = null;

        container.addEventListener('dragstart', function(e) {
            var card = e.target.closest('.crm-pipeline__card');
            if (!card) return;
            draggedId = card.getAttribute('data-contact-id');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedId);
            card.classList.add('crm-pipeline__card--dragging');
        });

        container.addEventListener('dragend', function(e) {
            var card = e.target.closest('.crm-pipeline__card');
            if (card) card.classList.remove('crm-pipeline__card--dragging');
            // Remove all drag-over classes
            container.querySelectorAll('.crm-pipeline__col--drag-over').forEach(function(col) {
                col.classList.remove('crm-pipeline__col--drag-over');
            });
        });

        container.addEventListener('dragover', function(e) {
            var col = e.target.closest('.crm-pipeline__col');
            if (!col) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // Remove from all, add to current
            container.querySelectorAll('.crm-pipeline__col--drag-over').forEach(function(c) {
                c.classList.remove('crm-pipeline__col--drag-over');
            });
            col.classList.add('crm-pipeline__col--drag-over');
        });

        container.addEventListener('dragleave', function(e) {
            var col = e.target.closest('.crm-pipeline__col');
            if (col && !col.contains(e.relatedTarget)) {
                col.classList.remove('crm-pipeline__col--drag-over');
            }
        });

        container.addEventListener('drop', function(e) {
            e.preventDefault();
            var col = e.target.closest('.crm-pipeline__col');
            if (!col) return;
            col.classList.remove('crm-pipeline__col--drag-over');

            var contactId = e.dataTransfer.getData('text/plain');
            var newStage = col.getAttribute('data-stage');
            if (!contactId || !newStage) return;

            api().updateCrmContact(contactId, { pipeline_stage: newStage }).then(function() {
                renderPipeline(container);
            });
        });

        // Click on card to show detail
        container.addEventListener('click', function(e) {
            var card = e.target.closest('.crm-pipeline__card');
            if (!card) return;
            var contactId = card.getAttribute('data-contact-id');
            if (contactId) showContactDetail(contactId);
        });
    }

    // ---- Partner Activation ----

    function renderActivation(container) {
        container.innerHTML = '<div class="crm-loading">Partner-Aktivierung wird geladen...</div>';

        safe(api().getCrmPartners()).then(function(data) {
            var partners = data ? (data.partners || []) : [];

            // Classify partners into activation stages
            var columns = {};
            ACTIVATION_STAGES.forEach(function(s) { columns[s.key] = []; });

            partners.forEach(function(p) {
                var stage = determineActivationStage(p);
                if (stage && columns[stage]) {
                    columns[stage].push(p);
                }
            });

            var html = '<div class="crm-activation">';
            ACTIVATION_STAGES.forEach(function(stage) {
                var cards = columns[stage.key] || [];
                html += '<div class="crm-activation__col">';
                html += '<div class="crm-activation__header" style="border-bottom-color:' + stage.color + '">';
                html += '<span>' + esc(stage.label) + '</span>';
                html += '<span class="crm-daily-section__count">' + cards.length + '</span>';
                html += '</div>';

                cards.forEach(function(p) {
                    html += '<div class="crm-activation__card" data-partner-id="' + esc(p.id) + '">';
                    html += '<div style="font-weight:600;font-size:13px;margin-bottom:4px">' + esc(p.name || p.organization || 'Partner') + '</div>';

                    if (p.registered_at) {
                        html += '<div class="crm-activation__timestamp crm-activation__timestamp--done">Registriert: ' + formatDate(p.registered_at) + '</div>';
                    }
                    if (p.verified_at) {
                        html += '<div class="crm-activation__timestamp crm-activation__timestamp--done">Verifiziert: ' + formatDate(p.verified_at) + '</div>';
                    }
                    if (p.test_order_at) {
                        html += '<div class="crm-activation__timestamp crm-activation__timestamp--done">Testschaden: ' + formatDate(p.test_order_at) + '</div>';
                    }

                    html += '<button class="dgd-btn dgd-btn--xs dgd-btn--outline crm-btn-create-order" data-partner-id="' + esc(p.id) + '" style="margin-top:6px">Auftrag anlegen</button>';
                    html += '</div>';
                });

                if (cards.length === 0) {
                    html += '<div class="crm-empty-state" style="padding:16px;font-size:12px">Keine Partner</div>';
                }

                html += '</div>';
            });
            html += '</div>';

            container.innerHTML = html;

            // Bind events
            container.addEventListener('click', function(e) {
                var btn = e.target.closest('.crm-btn-create-order');
                if (btn) {
                    var partnerId = btn.getAttribute('data-partner-id');
                    if (partnerId) showOrderModal(partnerId);
                }
            });
        });
    }

    function determineActivationStage(partner) {
        if (partner.first_real_order_at) return null; // fully activated, skip
        if (partner.test_order_at) return 'testschaden';
        if (partner.verified_at) return 'verifiziert';
        if (partner.registered_at) return 'registriert';
        return 'registriert'; // default
    }

    // ---- Contact Modal (Create/Edit) ----

    function showContactModal(contact) {
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
        html += formField('Name *', 'text', 'crm-f-name', c.name, 'required');
        html += formField('E-Mail', 'email', 'crm-f-email', c.email);
        html += formField('Telefon', 'text', 'crm-f-phone', c.phone);
        html += formField('Organisation', 'text', 'crm-f-org', c.organization);

        // Leadquelle
        html += formSelect('Leadquelle *', 'crm-f-leadsource', [''].concat(LEADQUELLEN), c.lead_source || '');

        // Partnertyp radio
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Partnertyp *</label>';
        html += '<div style="display:flex;gap:16px">';
        html += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="crm-f-partnertype" value="sv"' + (c.partner_type === 'sv' ? ' checked' : '') + '> SV</label>';
        html += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="crm-f-partnertype" value="profi"' + (c.partner_type === 'profi' ? ' checked' : '') + '> Profi</label>';
        html += '</div></div>';

        html += formField('Umsatzpotenzial', 'number', 'crm-f-potential', c.revenue_potential);

        // Pipeline-Liste
        html += formSelect('Pipeline-Liste *', 'crm-f-stage', LEAD_STAGES, c.pipeline_stage || 'neu');

        html += formField('Next Step *', 'text', 'crm-f-nextstep', c.next_step);
        html += formField('Next Step Datum *', 'datetime-local', 'crm-f-nextstepdate', c.next_step_date ? c.next_step_date.substring(0, 16) : '');
        html += formField('Zust\u00e4ndig', 'text', 'crm-f-assigned', c.assigned_to);
        html += '</div>';

        // Section 2: Zusatzinfos (collapsible)
        html += '<fieldset style="border:1px solid var(--dgd-gray-300);border-radius:8px;padding:12px;margin:12px 0">';
        html += '<legend style="color:var(--dgd-gray-500);font-size:0.85rem;cursor:pointer" id="crm-toggle-extra">Zusatzinfos \u25BC</legend>';
        html += '<div id="crm-extra-fields" class="crm-form-grid">';
        html += formField('Position', 'text', 'crm-f-jobtitle', c.job_title);
        html += formField('Betriebsart', 'text', 'crm-f-biztype', c.business_type);
        html += formField('Webseite', 'url', 'crm-f-website', c.website);
        html += formField('GA-Anzahl', 'number', 'crm-f-gacount', c.ga_count || '0');

        // Address
        html += formField('Stra\u00dfe', 'text', 'crm-f-street', c.street);
        html += formField('PLZ', 'text', 'crm-f-zip', c.zip);
        html += formField('Ort', 'text', 'crm-f-city', c.city);
        html += formField('Bundesland', 'text', 'crm-f-state', c.state);

        html += formField('Gesch\u00e4ftsf\u00fchrer', 'text', 'crm-f-gf', c.geschaeftsfuehrer);
        html += formCheckbox('GF-Match', 'crm-f-gfmatch', c.gf_match);
        html += formCheckbox('Onboarding-Mail versendet', 'crm-f-onboardingmail', c.onboarding_mail_sent);

        html += '</div>'; // crm-form-grid inside fieldset

        // Full-width fields after grid
        html += formTextarea('AI-Research', 'crm-f-airesearch', c.ai_research, 'readonly style="background:var(--dgd-gray-50);color:var(--dgd-gray-600)"');
        html += formTextarea('Firmeninfos', 'crm-f-companyinfo', c.company_info);
        html += formTextarea('Notizen', 'crm-f-notes', c.notes);
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

        mc.querySelector('#crm-modal-close').onclick = closeModal;
        mc.querySelector('#crm-modal-cancel').onclick = closeModal;

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
                ? api().updateCrmContact(contact.id, data)
                : api().createCrmContact(data);

            promise.then(function() {
                closeModal();
                refreshView();
            });
        });
    }

    // ---- Contact Detail ----

    function showContactDetail(contactId) {
        var mc = document.getElementById('modal-container');
        mc.innerHTML = '<div class="dgd-modal-overlay crm-modal-overlay"><div class="dgd-modal crm-modal crm-modal--wide"><div class="crm-loading">Laden...</div></div></div>';

        Promise.all([
            safe(api().getCrmContacts({ search: '' })).then(function(d) {
                return d ? (d.contacts || []).find(function(c) { return c.id === contactId; }) : null;
            }),
            safe(api().getCrmActivityLog(contactId)),
            safe(api().getCrmTasks({ contact_id: contactId })),
            safe(api().getCrmOrders({ contact_id: contactId })),
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
            html += '<h3>' + esc(contact.name) + ' ';
            html += partnerBadge(contact.partner_type, contact.ga_count);
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
            html += detailField('Liste', '<span class="crm-stage-badge" style="background:' + stageColor(contact.pipeline_stage) + '">' + stageLabel(contact.pipeline_stage) + '</span>', false, true);
            html += detailField('Leadquelle', contact.lead_source);
            html += detailField('Next Step', contact.next_step);
            html += detailField('Next Step Datum', formatDate(contact.next_step_date));
            html += detailField('Zust\u00e4ndig', contact.assigned_to);
            html += detailField('GA-Anzahl', contact.ga_count);
            html += detailField('Umsatzpotenzial', contact.revenue_potential ? formatCurrency(contact.revenue_potential) : null);
            html += detailField('Gesch\u00e4ftsf\u00fchrer', contact.geschaeftsfuehrer);
            html += detailField('GF-Match', contact.gf_match ? 'Ja' : 'Nein');

            // Address
            var addr = [contact.street, (contact.zip || '') + ' ' + (contact.city || ''), contact.state].filter(Boolean).join(', ');
            if (addr.trim()) html += detailField('Adresse', addr);

            html += '</div>';

            if (contact.notes) {
                html += '<div style="margin:12px 0;padding:8px 12px;background:var(--dgd-gray-50);border-radius:6px;border-left:3px solid var(--dgd-gray-300)">';
                html += '<strong style="font-size:12px;color:var(--dgd-gray-500)">Notizen</strong><br>';
                html += '<span style="white-space:pre-wrap;font-size:13px">' + esc(contact.notes) + '</span>';
                html += '</div>';
            }

            if (contact.ai_research) {
                html += '<div style="margin:12px 0;padding:8px 12px;background:var(--dgd-gray-50);border-radius:6px;border-left:3px solid #60a5fa">';
                html += '<strong style="font-size:12px;color:var(--dgd-gray-500)">AI-Research</strong><br>';
                html += '<span style="white-space:pre-wrap;font-size:13px">' + esc(contact.ai_research) + '</span>';
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
                    html += '<span class="crm-task-time">' + formatDate(t.due_date) + '</span>';
                    html += '<span class="crm-task-title">' + esc(t.title) + '</span>';
                    html += '<div class="crm-task-actions">';
                    html += '<button class="dgd-btn dgd-btn--xs crm-complete-task" data-task-id="' + esc(t.id) + '">\u2713</button>';
                    html += '<button class="dgd-btn dgd-btn--xs crm-reschedule-task" data-task-id="' + esc(t.id) + '">\u21BB</button>';
                    html += '</div></div>';
                });
            } else {
                html += '<div class="crm-empty" style="padding:8px;font-size:13px">Keine offenen Aufgaben</div>';
            }

            if (completedTasks.length > 0) {
                html += '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:var(--dgd-gray-500)">' + completedTasks.length + ' erledigte Aufgaben</summary>';
                completedTasks.forEach(function(t) {
                    html += '<div class="crm-task-row" style="opacity:0.5;text-decoration:line-through">';
                    html += '<span class="crm-task-time">' + formatDate(t.due_date) + '</span>';
                    html += '<span class="crm-task-title">' + esc(t.title) + '</span>';
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
                    html += '<div>' + esc(a.summary || a.description || '') + '</div>';
                    html += '<div class="crm-activity-entry__time">' + formatDateTime(a.created_at) + '</div>';
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
                        html += '<td>' + esc(o.type || '-') + '</td>';
                        html += '<td>' + formatDate(o.submitted_at) + '</td>';
                        html += '<td>' + esc(o.status || '-') + '</td>';
                        html += '<td>' + esc(o.result || '-') + '</td>';
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
            mc.querySelector('#crm-modal-close').onclick = closeModal;

            mc.querySelector('#crm-edit-contact').onclick = function() {
                closeModal();
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
                    api().updateCrmTask(btn.getAttribute('data-task-id'), { status: 'completed' }).then(function() {
                        showContactDetail(contactId);
                    });
                });
            });

            mc.querySelectorAll('.crm-reschedule-task').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(9, 0, 0, 0);
                    api().updateCrmTask(btn.getAttribute('data-task-id'), { due_date: tomorrow.toISOString() }).then(function() {
                        showContactDetail(contactId);
                    });
                });
            });
        });
    }

    function detailField(label, value, isLink, isHtml) {
        if (value === null || value === undefined || value === '') value = '-';
        var display;
        if (isHtml) {
            display = value;
        } else if (isLink && value !== '-') {
            display = '<a href="' + esc(String(value)) + '" target="_blank" style="color:#60a5fa">' + esc(String(value)) + '</a>';
        } else {
            display = esc(String(value));
        }
        return '<div class="crm-detail__field"><strong>' + label + ':</strong> ' + display + '</div>';
    }

    // ---- Task Modal ----

    function showTaskModal(contactId) {
        var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-task-modal">';
        html += '<div class="dgd-modal crm-modal">';
        html += '<div class="dgd-modal__header"><h3>Neue Aufgabe</h3><button class="dgd-modal__close" id="crm-task-close">&times;</button></div>';
        html += '<form id="crm-task-form" class="dgd-form">';

        html += formField('Titel *', 'text', 'crm-t-title', '', 'required');
        html += formTextarea('Beschreibung', 'crm-t-desc', '');
        html += formField('F\u00e4llig am *', 'datetime-local', 'crm-t-due', '', 'required');

        html += formSelect('Erinnerungs-Intervall', 'crm-t-reminder', [
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

        mc.querySelector('#crm-task-close').onclick = function() { closeModal(); showContactDetail(contactId); };
        mc.querySelector('#crm-task-cancel').onclick = function() { closeModal(); showContactDetail(contactId); };

        mc.querySelector('#crm-task-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var reminder = mc.querySelector('#crm-t-reminder').value;
            api().createCrmTask({
                contact_id: contactId,
                title: mc.querySelector('#crm-t-title').value,
                description: mc.querySelector('#crm-t-desc').value,
                due_date: mc.querySelector('#crm-t-due').value || null,
                reminder_interval: reminder !== 'none' ? reminder : null,
            }).then(function() {
                closeModal();
                showContactDetail(contactId);
            });
        });
    }

    // ---- Order Modal ----

    function showOrderModal(partnerId) {
        var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-order-modal">';
        html += '<div class="dgd-modal crm-modal">';
        html += '<div class="dgd-modal__header"><h3>Neuer Auftrag</h3><button class="dgd-modal__close" id="crm-order-close">&times;</button></div>';
        html += '<form id="crm-order-form" class="dgd-form">';

        // Type radio
        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Auftragstyp</label>';
        html += '<div style="display:flex;gap:16px">';
        html += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="crm-o-type" value="test" checked> Test</label>';
        html += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="crm-o-type" value="real"> Real</label>';
        html += '</div></div>';

        html += formField('Eingereicht am', 'date', 'crm-o-submitted', new Date().toISOString().substring(0, 10));

        html += formSelect('Status', 'crm-o-status', [
            { key: 'submitted', label: 'Eingereicht' },
            { key: 'in_progress', label: 'In Bearbeitung' },
            { key: 'completed', label: 'Abgeschlossen' },
            { key: 'rejected', label: 'Abgelehnt' },
        ], 'submitted');

        html += formField('Ergebnis', 'text', 'crm-o-result', '');

        html += '<div class="dgd-form__actions">';
        html += '<button type="submit" class="dgd-btn dgd-btn--primary">Erstellen</button>';
        html += '<button type="button" class="dgd-btn dgd-btn--outline" id="crm-order-cancel">Abbrechen</button>';
        html += '</div></form></div></div>';

        var mc = document.getElementById('modal-container');
        mc.innerHTML = html;

        mc.querySelector('#crm-order-close').onclick = closeModal;
        mc.querySelector('#crm-order-cancel').onclick = closeModal;

        mc.querySelector('#crm-order-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var typeRadio = mc.querySelector('input[name="crm-o-type"]:checked');
            api().createCrmOrder({
                partner_id: partnerId,
                type: typeRadio ? typeRadio.value : 'test',
                submitted_at: mc.querySelector('#crm-o-submitted').value || null,
                status: mc.querySelector('#crm-o-status').value,
                result: mc.querySelector('#crm-o-result').value,
            }).then(function() {
                closeModal();
                refreshView();
            });
        });
    }

    // ---- Interaction Modal ----

    function showInteractionModal(contact) {
        var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-interaction-modal">';
        html += '<div class="dgd-modal crm-modal">';
        html += '<div class="dgd-modal__header"><h3>Neue Interaktion - ' + esc(contact.name) + '</h3><button class="dgd-modal__close" id="crm-int-close">&times;</button></div>';
        html += '<form id="crm-int-form" class="dgd-form">';

        html += formSelect('Typ', 'crm-int-type', INTERACTION_TYPES, 'email');
        html += formField('Zusammenfassung *', 'text', 'crm-int-summary', '', 'required');
        html += formTextarea('Details', 'crm-int-details', '');

        html += '<div class="dgd-form__actions">';
        html += '<button type="submit" class="dgd-btn dgd-btn--primary">Erstellen</button>';
        html += '<button type="button" class="dgd-btn dgd-btn--outline" id="crm-int-cancel">Abbrechen</button>';
        html += '</div></form></div></div>';

        var mc = document.getElementById('modal-container');
        mc.innerHTML = html;

        mc.querySelector('#crm-int-close').onclick = function() { closeModal(); showContactDetail(contact.id); };
        mc.querySelector('#crm-int-cancel').onclick = function() { closeModal(); showContactDetail(contact.id); };

        mc.querySelector('#crm-int-form').addEventListener('submit', function(e) {
            e.preventDefault();
            api().createCrmInteraction({
                contact_id: contact.id,
                type: mc.querySelector('#crm-int-type').value,
                summary: mc.querySelector('#crm-int-summary').value,
                details: mc.querySelector('#crm-int-details').value,
            }).then(function() {
                closeModal();
                showContactDetail(contact.id);
            });
        });
    }

    // ---- Entry Point ----

    DGD.views.crm = function(container) {
        _container = container;
        container.innerHTML = '<div class="crm-loading">CRM wird geladen...</div>';

        safe(api().getCrmStats()).then(function(stats) {
            var s = stats || {};

            var html = '<div class="crm-view">';
            html += renderKpiBar(s);
            html += renderTabs();
            html += '<div id="crm-tab-content"></div>';
            html += '</div>';

            container.innerHTML = html;

            // Tab switching
            container.querySelectorAll('.crm-tab').forEach(function(tab) {
                tab.addEventListener('click', function() {
                    container.querySelectorAll('.crm-tab').forEach(function(t) { t.classList.remove('crm-tab--active'); });
                    tab.classList.add('crm-tab--active');
                    _activeTab = tab.getAttribute('data-tab');
                    loadActiveTab(container);
                });
            });

            loadActiveTab(container);
        });
    };

    function loadActiveTab(container) {
        var tabContent = container.querySelector('#crm-tab-content');
        if (!tabContent) return;

        switch (_activeTab) {
            case 'daily':
                renderDailyView(tabContent);
                break;
            case 'contacts':
                renderContactsTable(tabContent);
                break;
            case 'pipeline':
                renderPipeline(tabContent);
                break;
            case 'activation':
                renderActivation(tabContent);
                break;
        }
    }

})();
