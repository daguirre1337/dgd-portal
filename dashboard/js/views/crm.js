/* ==========================================================================
   DGD Dashboard - CRM View - Hauptmodul (Tab-Router + Shared State)
   4 Tabs: Tagesansicht, Kontakte, Pipeline, Partner-Aktivierung
   Depends on: namespace.js, helpers.js, api.js
   Sub-modules: crm-today.js, crm-contacts.js, crm-pipeline.js, crm-partners.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {
    'use strict';

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

    // ---- Shared Helpers ----

    function esc(v) { return DGD.helpers.escapeHtml(v); }
    function api() { return window.dashboardApi || DGD.api; }
    function safe(promise) { return promise.catch(function() { return null; }); }

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

    // ---- Shared State ----

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

    // ---- Tab Dispatcher ----

    function loadActiveTab(container) {
        var tabContent = container.querySelector('#crm-tab-content');
        if (!tabContent) return;

        switch (_activeTab) {
            case 'daily':
                if (DGD.views.crmToday) {
                    DGD.views.crmToday.render(tabContent);
                }
                break;
            case 'contacts':
                if (DGD.views.crmContacts) {
                    DGD.views.crmContacts.render(tabContent);
                }
                break;
            case 'pipeline':
                if (DGD.views.crmPipeline) {
                    DGD.views.crmPipeline.render(tabContent);
                }
                break;
            case 'activation':
                if (DGD.views.crmPartners) {
                    DGD.views.crmPartners.render(tabContent);
                }
                break;
        }
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

    // Export shared utilities for sub-modules
    DGD.views.crm._shared = {
        LEAD_STAGES: LEAD_STAGES,
        ACTIVATION_STAGES: ACTIVATION_STAGES,
        LEADQUELLEN: LEADQUELLEN,
        INTERACTION_TYPES: INTERACTION_TYPES,
        esc: esc,
        api: api,
        safe: safe,
        stageLabel: stageLabel,
        stageColor: stageColor,
        formatCurrency: formatCurrency,
        formatDate: formatDate,
        formatDateTime: formatDateTime,
        formatTime: formatTime,
        isOverdue: isOverdue,
        formField: formField,
        formSelect: formSelect,
        formTextarea: formTextarea,
        formCheckbox: formCheckbox,
        partnerBadge: partnerBadge,
        closeModal: closeModal,
        refreshView: refreshView
    };
})();
