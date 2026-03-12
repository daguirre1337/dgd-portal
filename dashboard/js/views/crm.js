/* ==========================================================================
   DGD Dashboard - CRM View
   Contacts, Deals Pipeline, Interactions, Trello Import
   Depends on: namespace.js, helpers.js, api.js
   ========================================================================== */

(function() {
    'use strict';

    var $ = function(sel) { return document.querySelector(sel); };

    var STAGES = [
        { key: 'lead',         label: 'Lead',         color: '#94a3b8' },
        { key: 'kontakt',      label: 'Kontakt',      color: '#60a5fa' },
        { key: 'angebot',      label: 'Angebot',      color: '#f59e0b' },
        { key: 'verhandlung',  label: 'Verhandlung',  color: '#a78bfa' },
        { key: 'gewonnen',     label: 'Gewonnen',     color: '#34d399' },
        { key: 'verloren',     label: 'Verloren',     color: '#f87171' },
    ];

    var INTERACTION_TYPES = [
        { key: 'email',   label: 'E-Mail',   icon: '@' },
        { key: 'call',    label: 'Anruf',    icon: '\u260E' },
        { key: 'meeting', label: 'Meeting',  icon: '\u25CB' },
        { key: 'note',    label: 'Notiz',    icon: '\u270E' },
    ];

    function stageLabel(key) {
        var s = STAGES.find(function(st) { return st.key === key; });
        return s ? s.label : key;
    }

    function stageColor(key) {
        var s = STAGES.find(function(st) { return st.key === key; });
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

    // ---- Main View ----

    function render(container, stats, contacts, pipeline) {
        var esc = DGD.helpers.escapeHtml;

        var html = '<div class="crm-view">';

        // KPI Header
        html += '<div class="crm-kpis">';
        html += kpiCard('Kontakte', stats.total_contacts, '', 'crm-kpi--contacts');
        html += kpiCard('Pipeline-Wert', formatCurrency(stats.pipeline_value), stats.open_deals + ' Deals', 'crm-kpi--pipeline');
        html += kpiCard('Gewonnen', formatCurrency(stats.won_value), stats.won_count + ' Deals', 'crm-kpi--won');
        html += kpiCard('Conversion', stats.conversion_rate + '%', stats.won_count + 'W / ' + stats.lost_count + 'V', 'crm-kpi--conv');
        if (stats.overdue_followups > 0) {
            html += kpiCard('Ueberfaellig', stats.overdue_followups, 'Follow-ups', 'crm-kpi--overdue');
        }
        html += '</div>';

        // Toolbar
        html += '<div class="crm-toolbar">';
        html += '<div class="crm-toolbar__left">';
        html += '<button class="dgd-btn dgd-btn--primary dgd-btn--sm" id="crm-add-contact">+ Kontakt</button>';
        html += '<button class="dgd-btn dgd-btn--outline dgd-btn--sm" id="crm-add-deal">+ Deal</button>';
        html += '<button class="dgd-btn dgd-btn--outline dgd-btn--sm" id="crm-import-trello">Trello Import</button>';
        html += '</div>';
        html += '<div class="crm-toolbar__right">';
        html += '<input type="text" class="dgd-form__input dgd-form__input--sm" id="crm-search" placeholder="Suchen...">';
        html += '<select class="dgd-form__input dgd-form__input--sm" id="crm-filter-stage"><option value="">Alle Stages</option>';
        STAGES.forEach(function(s) {
            html += '<option value="' + s.key + '">' + s.label + '</option>';
        });
        html += '</select>';
        html += '</div></div>';

        // Tab switcher
        html += '<div class="crm-tabs">';
        html += '<button class="crm-tab crm-tab--active" data-tab="contacts">Kontakte</button>';
        html += '<button class="crm-tab" data-tab="pipeline">Pipeline</button>';
        html += '</div>';

        // Contacts Table
        html += '<div id="crm-tab-contacts" class="crm-tab-content">';
        html += renderContactsTable(contacts, esc);
        html += '</div>';

        // Pipeline Board
        html += '<div id="crm-tab-pipeline" class="crm-tab-content" style="display:none">';
        html += renderPipeline(pipeline, esc);
        html += '</div>';

        html += '</div>';

        container.innerHTML = html;
        bindEvents(container);
    }

    function kpiCard(label, value, sub, cls) {
        return '<div class="crm-kpi ' + (cls || '') + '">'
            + '<div class="crm-kpi__value">' + value + '</div>'
            + '<div class="crm-kpi__label">' + label + '</div>'
            + (sub ? '<div class="crm-kpi__sub">' + sub + '</div>' : '')
            + '</div>';
    }

    function renderContactsTable(contacts, esc) {
        if (!contacts || contacts.length === 0) {
            return '<div class="crm-empty">Keine Kontakte vorhanden. Erstelle einen neuen Kontakt oder importiere aus Trello.</div>';
        }

        var html = '<table class="crm-table"><thead><tr>';
        html += '<th>Name</th><th>Organisation</th><th>Stage</th><th>Wert</th>';
        html += '<th>Zustaendig</th><th>Follow-up</th><th>Aktionen</th>';
        html += '</tr></thead><tbody>';

        contacts.forEach(function(c) {
            var isOverdue = c.next_followup && new Date(c.next_followup) < new Date();
            html += '<tr class="crm-row' + (isOverdue ? ' crm-row--overdue' : '') + '" data-id="' + c.id + '">';
            html += '<td class="crm-cell--name"><strong>' + esc(c.name) + '</strong>';
            if (c.email) html += '<br><small>' + esc(c.email) + '</small>';
            html += '</td>';
            html += '<td>' + esc(c.organization || '-') + '</td>';
            html += '<td><span class="crm-stage-badge" style="background:' + stageColor(c.pipeline_stage) + '">' + stageLabel(c.pipeline_stage) + '</span></td>';
            html += '<td>' + (c.deal_value > 0 ? formatCurrency(c.deal_value) : '-') + '</td>';
            html += '<td>' + esc(c.assigned_to || '-') + '</td>';
            html += '<td>' + (isOverdue ? '<span class="crm-overdue">' : '') + formatDate(c.next_followup) + (isOverdue ? '</span>' : '') + '</td>';
            html += '<td class="crm-actions">';
            html += '<button class="dgd-btn dgd-btn--sm crm-btn-detail" data-id="' + c.id + '" title="Details">Details</button>';
            html += '<button class="dgd-btn dgd-btn--sm dgd-btn--outline crm-btn-delete" data-id="' + c.id + '" title="Loeschen">&times;</button>';
            html += '</td></tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    function renderPipeline(pipeline, esc) {
        var html = '<div class="crm-pipeline">';

        // Only show active stages (not gewonnen/verloren)
        var activeStages = pipeline.filter(function(p) {
            return p.stage !== 'gewonnen' && p.stage !== 'verloren';
        });

        activeStages.forEach(function(col) {
            html += '<div class="crm-pipeline__col">';
            html += '<div class="crm-pipeline__header" style="border-top:3px solid ' + stageColor(col.stage) + '">';
            html += '<span>' + stageLabel(col.stage) + '</span>';
            html += '<span class="crm-pipeline__count">' + col.count + ' | ' + formatCurrency(col.total_value) + '</span>';
            html += '</div>';

            col.deals.forEach(function(d) {
                html += '<div class="crm-pipeline__card" data-deal-id="' + d.id + '">';
                html += '<div class="crm-pipeline__card-title">' + esc(d.title) + '</div>';
                html += '<div class="crm-pipeline__card-contact">' + esc(d.contact_name || '') + '</div>';
                html += '<div class="crm-pipeline__card-value">' + formatCurrency(d.value) + '</div>';
                if (d.expected_close) {
                    html += '<div class="crm-pipeline__card-date">' + formatDate(d.expected_close) + '</div>';
                }
                html += '</div>';
            });

            if (col.deals.length === 0) {
                html += '<div class="crm-pipeline__empty">Keine Deals</div>';
            }

            html += '</div>';
        });

        // Won/Lost summary
        var won = pipeline.find(function(p) { return p.stage === 'gewonnen'; }) || { count: 0, total_value: 0 };
        var lost = pipeline.find(function(p) { return p.stage === 'verloren'; }) || { count: 0, total_value: 0 };

        html += '<div class="crm-pipeline__summary">';
        html += '<span class="crm-pipeline__won">Gewonnen: ' + won.count + ' (' + formatCurrency(won.total_value) + ')</span>';
        html += '<span class="crm-pipeline__lost">Verloren: ' + lost.count + ' (' + formatCurrency(lost.total_value) + ')</span>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    // ---- Events ----

    function bindEvents(container) {
        // Tab switching
        container.querySelectorAll('.crm-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                container.querySelectorAll('.crm-tab').forEach(function(t) { t.classList.remove('crm-tab--active'); });
                container.querySelectorAll('.crm-tab-content').forEach(function(c) { c.style.display = 'none'; });
                tab.classList.add('crm-tab--active');
                var target = tab.getAttribute('data-tab');
                var el = container.querySelector('#crm-tab-' + target);
                if (el) el.style.display = '';
            });
        });

        // Add Contact
        var addBtn = container.querySelector('#crm-add-contact');
        if (addBtn) addBtn.addEventListener('click', function() { showContactModal(); });

        // Add Deal
        var dealBtn = container.querySelector('#crm-add-deal');
        if (dealBtn) dealBtn.addEventListener('click', function() { showDealModal(); });

        // Trello Import
        var importBtn = container.querySelector('#crm-import-trello');
        if (importBtn) importBtn.addEventListener('click', function() { showTrelloImportModal(); });

        // Search
        var searchInput = container.querySelector('#crm-search');
        var filterStage = container.querySelector('#crm-filter-stage');
        var searchTimer;

        function doSearch() {
            var filters = {};
            if (searchInput && searchInput.value) filters.search = searchInput.value;
            if (filterStage && filterStage.value) filters.stage = filterStage.value;
            dashboardApi.getCrmContacts(filters).then(function(data) {
                if (data) {
                    var tbody = container.querySelector('#crm-tab-contacts');
                    if (tbody) tbody.innerHTML = renderContactsTable(data.contacts, DGD.helpers.escapeHtml);
                    bindTableEvents(container);
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(doSearch, 300);
            });
        }
        if (filterStage) {
            filterStage.addEventListener('change', doSearch);
        }

        bindTableEvents(container);
    }

    function bindTableEvents(container) {
        // Detail buttons
        container.querySelectorAll('.crm-btn-detail').forEach(function(btn) {
            btn.addEventListener('click', function() {
                showContactDetail(btn.getAttribute('data-id'));
            });
        });

        // Delete buttons
        container.querySelectorAll('.crm-btn-delete').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (confirm('Kontakt wirklich loeschen?')) {
                    dashboardApi.deleteCrmContact(btn.getAttribute('data-id')).then(function() {
                        DGD.views.crm($('#main-content'));
                    });
                }
            });
        });

        // Pipeline deal cards
        container.querySelectorAll('.crm-pipeline__card').forEach(function(card) {
            card.addEventListener('click', function() {
                showDealDetail(card.getAttribute('data-deal-id'));
            });
        });
    }

    // ---- Modals ----

    function showContactModal(contact) {
        var esc = DGD.helpers.escapeHtml;
        var isEdit = !!contact;
        var title = isEdit ? 'Kontakt bearbeiten' : 'Neuer Kontakt';

        var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-modal">';
        html += '<div class="dgd-modal crm-modal">';
        html += '<div class="dgd-modal__header"><h3>' + title + '</h3><button class="dgd-modal__close" id="crm-modal-close">&times;</button></div>';
        html += '<form id="crm-contact-form" class="dgd-form">';

        html += '<div class="crm-form-grid">';
        html += formField('Name *', 'text', 'crm-f-name', contact ? contact.name : '');
        html += formField('E-Mail', 'email', 'crm-f-email', contact ? contact.email : '');
        html += formField('Telefon', 'text', 'crm-f-phone', contact ? contact.phone : '');
        html += formField('Organisation', 'text', 'crm-f-org', contact ? contact.organization : '');
        html += formField('Rolle', 'text', 'crm-f-role', contact ? contact.role : '');
        html += formField('Zustaendig', 'text', 'crm-f-assigned', contact ? contact.assigned_to : '');

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Pipeline Stage</label>';
        html += '<select class="dgd-form__input" id="crm-f-stage">';
        STAGES.forEach(function(s) {
            var sel = (contact && contact.pipeline_stage === s.key) ? ' selected' : (!contact && s.key === 'lead' ? ' selected' : '');
            html += '<option value="' + s.key + '"' + sel + '>' + s.label + '</option>';
        });
        html += '</select></div>';

        html += formField('Deal-Wert (EUR)', 'number', 'crm-f-value', contact ? contact.deal_value : '0');
        html += formField('Naechster Follow-up', 'date', 'crm-f-followup', contact && contact.next_followup ? contact.next_followup.substring(0, 10) : '');
        html += '</div>';

        html += '<div class="dgd-form__group">';
        html += '<label class="dgd-form__label">Notizen</label>';
        html += '<textarea class="dgd-form__input" id="crm-f-notes" rows="3">' + esc(contact ? contact.notes || '' : '') + '</textarea>';
        html += '</div>';

        html += '<div class="dgd-form__actions">';
        html += '<button type="submit" class="dgd-btn dgd-btn--primary">' + (isEdit ? 'Speichern' : 'Erstellen') + '</button>';
        html += '<button type="button" class="dgd-btn dgd-btn--outline" id="crm-modal-cancel">Abbrechen</button>';
        html += '</div></form></div></div>';

        var mc = document.getElementById('modal-container');
        mc.innerHTML = html;

        mc.querySelector('#crm-modal-close').onclick = function() { mc.innerHTML = ''; };
        mc.querySelector('#crm-modal-cancel').onclick = function() { mc.innerHTML = ''; };

        mc.querySelector('#crm-contact-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var data = {
                name: mc.querySelector('#crm-f-name').value,
                email: mc.querySelector('#crm-f-email').value,
                phone: mc.querySelector('#crm-f-phone').value,
                organization: mc.querySelector('#crm-f-org').value,
                role: mc.querySelector('#crm-f-role').value,
                assigned_to: mc.querySelector('#crm-f-assigned').value,
                pipeline_stage: mc.querySelector('#crm-f-stage').value,
                deal_value: parseFloat(mc.querySelector('#crm-f-value').value) || 0,
                next_followup: mc.querySelector('#crm-f-followup').value || null,
                notes: mc.querySelector('#crm-f-notes').value,
            };

            var promise = isEdit
                ? dashboardApi.updateCrmContact(contact.id, data)
                : dashboardApi.createCrmContact(data);

            promise.then(function() {
                mc.innerHTML = '';
                DGD.views.crm($('#main-content'));
            });
        });
    }

    function showDealModal(deal) {
        var esc = DGD.helpers.escapeHtml;
        var isEdit = !!deal;

        var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-modal">';
        html += '<div class="dgd-modal crm-modal">';
        html += '<div class="dgd-modal__header"><h3>' + (isEdit ? 'Deal bearbeiten' : 'Neuer Deal') + '</h3><button class="dgd-modal__close" id="crm-modal-close">&times;</button></div>';
        html += '<form id="crm-deal-form" class="dgd-form">';

        // Load contacts for dropdown
        html += '<div class="crm-form-grid">';
        html += formField('Titel *', 'text', 'crm-d-title', deal ? deal.title : '');
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Kontakt *</label>';
        html += '<select class="dgd-form__input" id="crm-d-contact"><option value="">Laden...</option></select></div>';

        html += '<div class="dgd-form__group"><label class="dgd-form__label">Stage</label>';
        html += '<select class="dgd-form__input" id="crm-d-stage">';
        STAGES.forEach(function(s) {
            var sel = (deal && deal.stage === s.key) ? ' selected' : (!deal && s.key === 'lead' ? ' selected' : '');
            html += '<option value="' + s.key + '"' + sel + '>' + s.label + '</option>';
        });
        html += '</select></div>';

        html += formField('Wert (EUR)', 'number', 'crm-d-value', deal ? deal.value : '0');
        html += formField('Wahrscheinlichkeit (%)', 'number', 'crm-d-prob', deal ? deal.probability : '10');
        html += formField('Erwarteter Abschluss', 'date', 'crm-d-close', deal && deal.expected_close ? deal.expected_close.substring(0, 10) : '');
        html += formField('Zustaendig', 'text', 'crm-d-assigned', deal ? deal.assigned_to : '');
        html += '</div>';

        html += '<div class="dgd-form__group"><label class="dgd-form__label">Notizen</label>';
        html += '<textarea class="dgd-form__input" id="crm-d-notes" rows="3">' + esc(deal ? deal.notes || '' : '') + '</textarea></div>';

        html += '<div class="dgd-form__actions">';
        html += '<button type="submit" class="dgd-btn dgd-btn--primary">' + (isEdit ? 'Speichern' : 'Erstellen') + '</button>';
        html += '<button type="button" class="dgd-btn dgd-btn--outline" id="crm-modal-cancel">Abbrechen</button>';
        html += '</div></form></div></div>';

        var mc = document.getElementById('modal-container');
        mc.innerHTML = html;

        // Load contacts into dropdown
        dashboardApi.getCrmContacts().then(function(data) {
            var sel = mc.querySelector('#crm-d-contact');
            if (!sel || !data) return;
            sel.innerHTML = '<option value="">-- Kontakt waehlen --</option>';
            (data.contacts || []).forEach(function(c) {
                var opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name + (c.organization ? ' (' + c.organization + ')' : '');
                if (deal && deal.contact_id === c.id) opt.selected = true;
                sel.appendChild(opt);
            });
        });

        mc.querySelector('#crm-modal-close').onclick = function() { mc.innerHTML = ''; };
        mc.querySelector('#crm-modal-cancel').onclick = function() { mc.innerHTML = ''; };

        mc.querySelector('#crm-deal-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var data = {
                title: mc.querySelector('#crm-d-title').value,
                contact_id: mc.querySelector('#crm-d-contact').value,
                stage: mc.querySelector('#crm-d-stage').value,
                value: parseFloat(mc.querySelector('#crm-d-value').value) || 0,
                probability: parseInt(mc.querySelector('#crm-d-prob').value) || 10,
                expected_close: mc.querySelector('#crm-d-close').value || null,
                assigned_to: mc.querySelector('#crm-d-assigned').value,
                notes: mc.querySelector('#crm-d-notes').value,
            };

            if (!data.contact_id) { alert('Bitte Kontakt auswaehlen'); return; }

            var promise = isEdit
                ? dashboardApi.updateCrmDeal(deal.id, data)
                : dashboardApi.createCrmDeal(data);

            promise.then(function() {
                mc.innerHTML = '';
                DGD.views.crm($('#main-content'));
            });
        });
    }

    function showContactDetail(contactId) {
        var mc = document.getElementById('modal-container');
        mc.innerHTML = '<div class="dgd-modal-overlay crm-modal-overlay"><div class="dgd-modal crm-modal crm-modal--wide"><div class="crm-loading">Laden...</div></div></div>';

        Promise.all([
            dashboardApi.getCrmContacts({ search: '' }).then(function(d) {
                return d ? d.contacts.find(function(c) { return c.id === contactId; }) : null;
            }),
            dashboardApi.getCrmContactInteractions(contactId),
            dashboardApi.getCrmDeals({ contact_id: contactId }),
        ]).then(function(results) {
            var contact = results[0];
            var interactions = results[1] ? results[1].interactions : [];
            var deals = results[2] ? results[2].deals : [];
            if (!contact) { mc.innerHTML = ''; return; }

            var esc = DGD.helpers.escapeHtml;
            var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-modal">';
            html += '<div class="dgd-modal crm-modal crm-modal--wide">';
            html += '<div class="dgd-modal__header"><h3>' + esc(contact.name) + '</h3><button class="dgd-modal__close" id="crm-modal-close">&times;</button></div>';

            html += '<div class="crm-detail">';

            // Contact Info
            html += '<div class="crm-detail__info">';
            html += '<div class="crm-detail__field"><strong>E-Mail:</strong> ' + esc(contact.email || '-') + '</div>';
            html += '<div class="crm-detail__field"><strong>Telefon:</strong> ' + esc(contact.phone || '-') + '</div>';
            html += '<div class="crm-detail__field"><strong>Organisation:</strong> ' + esc(contact.organization || '-') + '</div>';
            html += '<div class="crm-detail__field"><strong>Rolle:</strong> ' + esc(contact.role || '-') + '</div>';
            html += '<div class="crm-detail__field"><strong>Stage:</strong> <span class="crm-stage-badge" style="background:' + stageColor(contact.pipeline_stage) + '">' + stageLabel(contact.pipeline_stage) + '</span></div>';
            html += '<div class="crm-detail__field"><strong>Zustaendig:</strong> ' + esc(contact.assigned_to || '-') + '</div>';
            html += '<div class="crm-detail__field"><strong>Notizen:</strong> ' + esc(contact.notes || '-') + '</div>';
            html += '<div class="crm-detail__actions">';
            html += '<button class="dgd-btn dgd-btn--sm dgd-btn--primary" id="crm-edit-contact">Bearbeiten</button>';
            html += '<button class="dgd-btn dgd-btn--sm dgd-btn--outline" id="crm-add-interaction">+ Interaktion</button>';
            html += '</div></div>';

            // Deals
            if (deals.length > 0) {
                html += '<div class="crm-detail__section"><h4>Deals (' + deals.length + ')</h4>';
                deals.forEach(function(d) {
                    html += '<div class="crm-detail__deal">';
                    html += '<span class="crm-stage-badge" style="background:' + stageColor(d.stage) + '">' + stageLabel(d.stage) + '</span> ';
                    html += '<strong>' + esc(d.title) + '</strong> - ' + formatCurrency(d.value);
                    html += '</div>';
                });
                html += '</div>';
            }

            // Interactions Timeline
            html += '<div class="crm-detail__section"><h4>Interaktionen (' + interactions.length + ')</h4>';
            if (interactions.length === 0) {
                html += '<p class="crm-empty">Noch keine Interaktionen</p>';
            } else {
                interactions.forEach(function(i) {
                    var typeInfo = INTERACTION_TYPES.find(function(t) { return t.key === i.type; }) || { icon: '?', label: i.type };
                    html += '<div class="crm-interaction">';
                    html += '<span class="crm-interaction__icon">' + typeInfo.icon + '</span>';
                    html += '<div class="crm-interaction__content">';
                    html += '<strong>' + typeInfo.label + '</strong> - ' + esc(i.summary);
                    html += '<div class="crm-interaction__date">' + formatDate(i.created_at) + '</div>';
                    html += '</div></div>';
                });
            }
            html += '</div>';

            html += '</div></div></div>';
            mc.innerHTML = html;

            mc.querySelector('#crm-modal-close').onclick = function() { mc.innerHTML = ''; };
            mc.querySelector('#crm-edit-contact').onclick = function() {
                mc.innerHTML = '';
                showContactModal(contact);
            };
            mc.querySelector('#crm-add-interaction').onclick = function() {
                showInteractionModal(contact);
            };
        });
    }

    function showDealDetail(dealId) {
        dashboardApi.getCrmDeals().then(function(data) {
            if (!data) return;
            var deal = data.deals.find(function(d) { return d.id === dealId; });
            if (deal) showDealModal(deal);
        });
    }

    function showInteractionModal(contact) {
        var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-interaction-modal">';
        html += '<div class="dgd-modal crm-modal">';
        html += '<div class="dgd-modal__header"><h3>Neue Interaktion - ' + DGD.helpers.escapeHtml(contact.name) + '</h3><button class="dgd-modal__close" id="crm-int-close">&times;</button></div>';
        html += '<form id="crm-int-form" class="dgd-form">';

        html += '<div class="dgd-form__group"><label class="dgd-form__label">Typ</label>';
        html += '<select class="dgd-form__input" id="crm-int-type">';
        INTERACTION_TYPES.forEach(function(t) {
            html += '<option value="' + t.key + '">' + t.label + '</option>';
        });
        html += '</select></div>';

        html += formField('Zusammenfassung *', 'text', 'crm-int-summary', '');
        html += '<div class="dgd-form__group"><label class="dgd-form__label">Details</label>';
        html += '<textarea class="dgd-form__input" id="crm-int-details" rows="3"></textarea></div>';

        html += '<div class="dgd-form__actions">';
        html += '<button type="submit" class="dgd-btn dgd-btn--primary">Erstellen</button>';
        html += '<button type="button" class="dgd-btn dgd-btn--outline" id="crm-int-cancel">Abbrechen</button>';
        html += '</div></form></div></div>';

        var mc = document.getElementById('modal-container');
        mc.innerHTML = html;

        mc.querySelector('#crm-int-close').onclick = function() { mc.innerHTML = ''; showContactDetail(contact.id); };
        mc.querySelector('#crm-int-cancel').onclick = function() { mc.innerHTML = ''; showContactDetail(contact.id); };

        mc.querySelector('#crm-int-form').addEventListener('submit', function(e) {
            e.preventDefault();
            dashboardApi.createCrmInteraction({
                contact_id: contact.id,
                type: mc.querySelector('#crm-int-type').value,
                summary: mc.querySelector('#crm-int-summary').value,
                details: mc.querySelector('#crm-int-details').value,
            }).then(function() {
                mc.innerHTML = '';
                showContactDetail(contact.id);
            });
        });
    }

    function showTrelloImportModal() {
        var html = '<div class="dgd-modal-overlay crm-modal-overlay" id="crm-modal">';
        html += '<div class="dgd-modal crm-modal">';
        html += '<div class="dgd-modal__header"><h3>Trello CRM Import</h3><button class="dgd-modal__close" id="crm-modal-close">&times;</button></div>';
        html += '<div class="crm-import">';
        html += '<p>Exportiere dein Trello-Board als JSON und lade es hier hoch.</p>';
        html += '<p><small>Trello &rarr; Board &rarr; Menu &rarr; More &rarr; Print and Export &rarr; Export as JSON</small></p>';
        html += '<div class="crm-import__dropzone" id="crm-dropzone">';
        html += '<p>JSON-Datei hierher ziehen oder klicken</p>';
        html += '<input type="file" accept=".json" id="crm-import-file" style="display:none">';
        html += '</div>';
        html += '<div id="crm-import-preview" style="display:none"></div>';
        html += '<div id="crm-import-result" style="display:none"></div>';
        html += '</div></div></div>';

        var mc = document.getElementById('modal-container');
        mc.innerHTML = html;

        mc.querySelector('#crm-modal-close').onclick = function() { mc.innerHTML = ''; };

        var dropzone = mc.querySelector('#crm-dropzone');
        var fileInput = mc.querySelector('#crm-import-file');

        dropzone.onclick = function() { fileInput.click(); };

        dropzone.addEventListener('dragover', function(e) { e.preventDefault(); dropzone.classList.add('crm-import__dropzone--hover'); });
        dropzone.addEventListener('dragleave', function() { dropzone.classList.remove('crm-import__dropzone--hover'); });
        dropzone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropzone.classList.remove('crm-import__dropzone--hover');
            if (e.dataTransfer.files.length) processImportFile(e.dataTransfer.files[0], mc);
        });

        fileInput.addEventListener('change', function() {
            if (fileInput.files.length) processImportFile(fileInput.files[0], mc);
        });
    }

    function processImportFile(file, mc) {
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var data = JSON.parse(e.target.result);
                var cards = data.cards || [];
                var lists = data.lists || [];
                var openCards = cards.filter(function(c) { return !c.closed; });

                var preview = mc.querySelector('#crm-import-preview');
                preview.style.display = '';
                preview.innerHTML = '<h4>Board: ' + DGD.helpers.escapeHtml(data.name || 'Unbenannt') + '</h4>'
                    + '<p>' + openCards.length + ' Karten in ' + lists.length + ' Listen</p>'
                    + '<ul>' + lists.filter(function(l) { return !l.closed; }).map(function(l) {
                        var count = cards.filter(function(c) { return c.idList === l.id && !c.closed; }).length;
                        return '<li>' + DGD.helpers.escapeHtml(l.name) + ' (' + count + ')</li>';
                    }).join('') + '</ul>'
                    + '<button class="dgd-btn dgd-btn--primary" id="crm-do-import">Importieren</button>';

                mc.querySelector('#crm-do-import').onclick = function() {
                    this.disabled = true;
                    this.textContent = 'Importiere...';
                    dashboardApi.importCrmTrello({ board: data }).then(function(res) {
                        var result = mc.querySelector('#crm-import-result');
                        if (result && res) {
                            result.style.display = '';
                            result.innerHTML = '<div class="dgd-alert dgd-alert--success">'
                                + res.imported + ' Kontakte importiert, ' + res.skipped + ' uebersprungen.</div>'
                                + '<button class="dgd-btn dgd-btn--primary" id="crm-import-done">Fertig</button>';
                            mc.querySelector('#crm-import-done').onclick = function() {
                                mc.innerHTML = '';
                                DGD.views.crm($('#main-content'));
                            };
                        }
                    });
                };
            } catch (err) {
                alert('Ungueltige JSON-Datei: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    function formField(label, type, id, value) {
        return '<div class="dgd-form__group">'
            + '<label class="dgd-form__label" for="' + id + '">' + label + '</label>'
            + '<input type="' + type + '" class="dgd-form__input" id="' + id + '" value="' + DGD.helpers.escapeHtml(String(value || '')) + '">'
            + '</div>';
    }

    // ---- Entry Point ----

    var EMPTY_STATS = { total_contacts: 0, pipeline_value: 0, open_deals: 0, won_value: 0, won_count: 0, lost_count: 0, conversion_rate: 0, overdue_followups: 0 };

    function safe(promise) { return promise.catch(function() { return null; }); }

    DGD.views.crm = function(container) {
        container.innerHTML = '<div class="crm-loading">CRM wird geladen...</div>';

        Promise.all([
            safe(dashboardApi.getCrmStats()),
            safe(dashboardApi.getCrmContacts()),
            safe(dashboardApi.getCrmPipeline()),
        ]).then(function(results) {
            var stats = results[0] || EMPTY_STATS;
            var contacts = results[1] ? results[1].contacts : [];
            var pipeline = results[2] ? results[2].pipeline : [];
            render(container, stats, contacts, pipeline);
        });
    };
})();
