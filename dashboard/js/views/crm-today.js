/* ==========================================================================
   DGD Dashboard - CRM View: Tagesansicht (Today's Tasks)
   Depends on: crm.js (shared utilities)
   ========================================================================== */

(function() {
    'use strict';

    function getShared() {
        return DGD.views.crm._shared;
    }

    /* ------------------------------------------------------------------
       Render Daily View
       ------------------------------------------------------------------ */

    function renderDailyView(container) {
        var shared = getShared();
        container.innerHTML = '<div class="crm-loading">Tagesansicht wird geladen...</div>';

        shared.safe(shared.api().getCrmTasksToday()).then(function(data) {
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
                html += '<span>' + shared.esc(cat.label) + '</span>';
                html += '<span class="crm-daily-section__count">' + (cat.tasks ? cat.tasks.length : 0) + '</span>';
                html += '</div>';

                if (cat.tasks && cat.tasks.length > 0) {
                    cat.tasks.forEach(function(task) {
                        var rowClass = 'crm-task-row';
                        if (cat.key === 'overdue') rowClass += ' crm-task-row--overdue';

                        html += '<div class="' + rowClass + '">';
                        html += '<span class="crm-task-time">' + shared.esc(shared.formatTime(task.due_date) || '') + '</span>';
                        html += '<a class="crm-task-contact" href="#" data-contact-id="' + shared.esc(task.contact_id || '') + '">' + shared.esc(task.contact_name || 'Unbekannt') + '</a>';
                        html += '<span class="crm-task-title">' + shared.esc(task.title || '') + '</span>';
                        html += '<div class="crm-task-actions">';
                        html += '<button class="dgd-btn dgd-btn--xs" data-action="complete" data-task-id="' + shared.esc(task.id) + '" title="Erledigt">\u2713</button>';
                        html += '<button class="dgd-btn dgd-btn--xs" data-action="reschedule" data-task-id="' + shared.esc(task.id) + '" title="Verschieben">\u21BB</button>';
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

    /* ------------------------------------------------------------------
       Bind Daily Events
       ------------------------------------------------------------------ */

    function bindDailyEvents(container) {
        var shared = getShared();

        container.addEventListener('click', function(e) {
            var target = e.target;

            // Contact link
            if (target.classList.contains('crm-task-contact')) {
                e.preventDefault();
                var contactId = target.getAttribute('data-contact-id');
                if (contactId && DGD.views.crmContacts) {
                    DGD.views.crmContacts.showContactDetail(contactId);
                }
                return;
            }

            // Task actions
            var btn = target.closest('[data-action]');
            if (!btn) return;

            var action = btn.getAttribute('data-action');
            var taskId = btn.getAttribute('data-task-id');
            if (!taskId) return;

            if (action === 'complete') {
                shared.api().updateCrmTask(taskId, { status: 'completed' }).then(function() {
                    renderDailyView(container);
                });
            } else if (action === 'reschedule') {
                // Simple reschedule: move to tomorrow
                var tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0);
                shared.api().updateCrmTask(taskId, { due_date: tomorrow.toISOString() }).then(function() {
                    renderDailyView(container);
                });
            }
        });
    }

    // ---- Register sub-module ----

    DGD.views.crmToday = {
        render: renderDailyView
    };
})();
