/* ==========================================================================
   DGD Dashboard - CRM View: Pipeline Board
   Depends on: crm.js (shared utilities), crm-contacts.js (showContactDetail)
   ========================================================================== */

(function() {
    'use strict';

    function getShared() {
        return DGD.views.crm._shared;
    }

    /* ------------------------------------------------------------------
       Render Pipeline
       ------------------------------------------------------------------ */

    function renderPipeline(container) {
        var shared = getShared();
        container.innerHTML = '<div class="crm-loading">Pipeline wird geladen...</div>';

        shared.safe(shared.api().getCrmContacts()).then(function(data) {
            var contacts = data ? (data.contacts || []) : [];

            // Group contacts by pipeline_stage
            var columns = {};
            shared.LEAD_STAGES.forEach(function(s) { columns[s.key] = []; });
            contacts.forEach(function(c) {
                var stage = c.pipeline_stage || 'neu';
                if (!columns[stage]) columns[stage] = [];
                columns[stage].push(c);
            });

            var html = '<div class="crm-pipeline" style="overflow-x:auto">';
            shared.LEAD_STAGES.forEach(function(stage) {
                var cards = columns[stage.key] || [];
                html += '<div class="crm-pipeline__col" data-stage="' + stage.key + '">';
                html += '<div class="crm-pipeline__header" style="border-top:3px solid ' + stage.color + '">';
                html += '<span>' + shared.esc(stage.label) + '</span>';
                html += '<span class="crm-pipeline__count">' + cards.length + '</span>';
                html += '</div>';

                cards.forEach(function(c) {
                    html += '<div class="crm-pipeline__card" draggable="true" data-contact-id="' + c.id + '">';
                    html += '<div class="crm-pipeline__card-name">' + shared.esc(c.name) + '</div>';
                    html += '<div class="crm-pipeline__card-org">' + shared.esc(c.organization || '') + '</div>';
                    if (c.next_step) {
                        html += '<div class="crm-pipeline__card-step">Next Step: ' + shared.esc(c.next_step) + '</div>';
                    }
                    if (c.next_step_date) {
                        html += '<div class="crm-pipeline__card-date">' + shared.formatDate(c.next_step_date) + '</div>';
                    }
                    html += shared.partnerBadge(c.partner_type, c.ga_count);
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

    /* ------------------------------------------------------------------
       Drag & Drop
       ------------------------------------------------------------------ */

    function bindPipelineDragDrop(container) {
        var shared = getShared();
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

            shared.api().updateCrmContact(contactId, { pipeline_stage: newStage }).then(function() {
                renderPipeline(container);
            });
        });

        // Click on card to show detail
        container.addEventListener('click', function(e) {
            var card = e.target.closest('.crm-pipeline__card');
            if (!card) return;
            var contactId = card.getAttribute('data-contact-id');
            if (contactId && DGD.views.crmContacts) {
                DGD.views.crmContacts.showContactDetail(contactId);
            }
        });
    }

    // ---- Register sub-module ----

    DGD.views.crmPipeline = {
        render: renderPipeline
    };
})();
