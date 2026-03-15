/* ==========================================================================
   DGD Dashboard - CRM View: Partner-Aktivierung
   Depends on: crm.js (shared utilities)
   ========================================================================== */

(function() {
    'use strict';

    function getShared() {
        return DGD.views.crm._shared;
    }

    /* ------------------------------------------------------------------
       Render Partner Activation Board
       ------------------------------------------------------------------ */

    function renderActivation(container) {
        var shared = getShared();
        container.innerHTML = '<div class="crm-loading">Partner-Aktivierung wird geladen...</div>';

        shared.safe(shared.api().getCrmPartners()).then(function(data) {
            var partners = data ? (data.partners || []) : [];

            // Classify partners into activation stages
            var columns = {};
            shared.ACTIVATION_STAGES.forEach(function(s) { columns[s.key] = []; });

            partners.forEach(function(p) {
                var stage = determineActivationStage(p);
                if (stage && columns[stage]) {
                    columns[stage].push(p);
                }
            });

            var html = '<div class="crm-activation">';
            shared.ACTIVATION_STAGES.forEach(function(stage) {
                var cards = columns[stage.key] || [];
                html += '<div class="crm-activation__col">';
                html += '<div class="crm-activation__header" style="border-bottom-color:' + stage.color + '">';
                html += '<span>' + shared.esc(stage.label) + '</span>';
                html += '<span class="crm-daily-section__count">' + cards.length + '</span>';
                html += '</div>';

                cards.forEach(function(p) {
                    html += '<div class="crm-activation__card" data-partner-id="' + shared.esc(p.id) + '">';
                    html += '<div style="font-weight:600;font-size:13px;margin-bottom:4px">' + shared.esc(p.name || p.organization || 'Partner') + '</div>';

                    if (p.registered_at) {
                        html += '<div class="crm-activation__timestamp crm-activation__timestamp--done">Registriert: ' + shared.formatDate(p.registered_at) + '</div>';
                    }
                    if (p.verified_at) {
                        html += '<div class="crm-activation__timestamp crm-activation__timestamp--done">Verifiziert: ' + shared.formatDate(p.verified_at) + '</div>';
                    }
                    if (p.test_order_at) {
                        html += '<div class="crm-activation__timestamp crm-activation__timestamp--done">Testschaden: ' + shared.formatDate(p.test_order_at) + '</div>';
                    }

                    html += '<button class="dgd-btn dgd-btn--xs dgd-btn--outline crm-btn-create-order" data-partner-id="' + shared.esc(p.id) + '" style="margin-top:6px">Auftrag anlegen</button>';
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

    /* ------------------------------------------------------------------
       Determine Activation Stage
       ------------------------------------------------------------------ */

    function determineActivationStage(partner) {
        if (partner.first_real_order_at) return null; // fully activated, skip
        if (partner.test_order_at) return 'testschaden';
        if (partner.verified_at) return 'verifiziert';
        if (partner.registered_at) return 'registriert';
        return 'registriert'; // default
    }

    /* ------------------------------------------------------------------
       Order Modal
       ------------------------------------------------------------------ */

    function showOrderModal(partnerId) {
        var shared = getShared();
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

        html += shared.formField('Eingereicht am', 'date', 'crm-o-submitted', new Date().toISOString().substring(0, 10));

        html += shared.formSelect('Status', 'crm-o-status', [
            { key: 'submitted', label: 'Eingereicht' },
            { key: 'in_progress', label: 'In Bearbeitung' },
            { key: 'completed', label: 'Abgeschlossen' },
            { key: 'rejected', label: 'Abgelehnt' },
        ], 'submitted');

        html += shared.formField('Ergebnis', 'text', 'crm-o-result', '');

        html += '<div class="dgd-form__actions">';
        html += '<button type="submit" class="dgd-btn dgd-btn--primary">Erstellen</button>';
        html += '<button type="button" class="dgd-btn dgd-btn--outline" id="crm-order-cancel">Abbrechen</button>';
        html += '</div></form></div></div>';

        var mc = document.getElementById('modal-container');
        mc.innerHTML = html;

        mc.querySelector('#crm-order-close').onclick = shared.closeModal;
        mc.querySelector('#crm-order-cancel').onclick = shared.closeModal;

        mc.querySelector('#crm-order-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var typeRadio = mc.querySelector('input[name="crm-o-type"]:checked');
            shared.api().createCrmOrder({
                partner_id: partnerId,
                type: typeRadio ? typeRadio.value : 'test',
                submitted_at: mc.querySelector('#crm-o-submitted').value || null,
                status: mc.querySelector('#crm-o-status').value,
                result: mc.querySelector('#crm-o-result').value,
            }).then(function() {
                shared.closeModal();
                shared.refreshView();
            });
        });
    }

    // ---- Register sub-module ----

    DGD.views.crmPartners = {
        render: renderActivation
    };
})();
