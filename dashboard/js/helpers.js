/* ==========================================================================
   DGD Dashboard - Helper Utilities
   Depends on: namespace.js
   ========================================================================== */

window.DGD = window.DGD || {};

DGD.helpers = {

    /* ------------------------------------------------------------------
       DOM shortcuts
       ------------------------------------------------------------------ */

    $(sel) { return document.querySelector(sel); },
    $$(sel) { return document.querySelectorAll(sel); },

    /* ------------------------------------------------------------------
       Sanitisation & formatting
       ------------------------------------------------------------------ */

    escapeHtml(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    },

    formatDate(iso) {
        if (!iso) return '';
        var parts = iso.split('-');
        if (parts.length !== 3) return iso;
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    },

    formatCurrency(val) {
        return Number(val).toLocaleString('de-DE');
    },

    /* ------------------------------------------------------------------
       Color helpers (HR / Tellent views)
       ------------------------------------------------------------------ */

    attPctColor(pct) {
        return pct >= 90 ? '#22c55e' : (pct >= 70 ? '#f59e0b' : '#ef4444');
    },

    overtimeColor(h) {
        return h > 0 ? '#22c55e' : (h < -8 ? '#ef4444' : '#94a3b8');
    },

    /* ------------------------------------------------------------------
       Micro-components (return HTML strings)
       ------------------------------------------------------------------ */

    renderSparkline(values, color, id, target) {
        var w = 200, h = 40, pad = 2;
        var min = Math.min.apply(null, values);
        var max = Math.max.apply(null, values);
        // Include target in range if present
        if (target != null) {
            if (target < min) min = target;
            if (target > max) max = target;
        }
        var range = max - min || 1;
        var points = [];
        for (var i = 0; i < values.length; i++) {
            var x = pad + (i / (values.length - 1)) * (w - 2 * pad);
            var y = h - pad - ((values[i] - min) / range) * (h - 2 * pad);
            points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
        var polyline = points.join(' ');
        var fillPoints = `${pad},${h} ${polyline} ${w - pad},${h}`;
        var svg = `<svg class="dgd-kpi-card__sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">` +
            `<defs><linearGradient id="sg-${id}" x1="0" y1="0" x2="0" y2="1">` +
            `<stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>` +
            `<stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>` +
            `</linearGradient></defs>` +
            `<polygon points="${fillPoints}" fill="url(#sg-${id})"/>` +
            `<polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
        // Target threshold line
        if (target != null) {
            var targetY = h - pad - ((target - min) / range) * (h - 2 * pad);
            svg += `<line x1="${pad}" y1="${targetY.toFixed(1)}" x2="${w - pad}" y2="${targetY.toFixed(1)}" stroke="#e74c3c" stroke-width="0.8" stroke-dasharray="4,3" opacity="0.6"/>`;
        }
        svg += '</svg>';
        return svg;
    },

    renderStaffStatCard(label, value, color, icon, target) {
        var esc = DGD.helpers.escapeHtml;
        var h = `<div class="dgd-staff-stat">` +
            `<div class="dgd-staff-stat__icon" style="background:${color}15;color:${color}">${icon}</div>` +
            `<div class="dgd-staff-stat__value">${value}</div>` +
            `<div class="dgd-staff-stat__label">${esc(label)}</div>`;
        if (target) {
            h += `<div class="dgd-staff-stat__target">Ziel: ${esc(target)}</div>`;
        }
        h += '</div>';
        return h;
    },

    renderProgressRing(pct, color, size) {
        var r = (size - 6) / 2;
        var c = Math.PI * 2 * r;
        var offset = c - (pct / 100) * c;
        return `<svg width="${size}" height="${size}" class="dgd-progress-ring">` +
            `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--dgd-gray-200)" stroke-width="3"/>` +
            `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="3" ` +
            `stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" stroke-linecap="round" ` +
            `transform="rotate(-90 ${size / 2} ${size / 2})"/>` +
            `</svg>`;
    },

    /* ------------------------------------------------------------------
       Form Validation
       Usage: var errors = DGD.helpers.validateForm({
           name:   { required: true, maxLength: 100 },
           email:  { required: true, type: 'email' },
           amount: { required: true, type: 'number', min: 0 },
       }, formData);
       Returns: { valid: true/false, errors: { field: 'message', ... } }
       ------------------------------------------------------------------ */

    validateForm(rules, data) {
        var errors = {};
        var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        for (var field in rules) {
            if (!rules.hasOwnProperty(field)) continue;
            var rule = rules[field];
            var val  = data[field];
            var label = rule.label || field;

            // Required
            if (rule.required && (val == null || String(val).trim() === '')) {
                errors[field] = label + ' ist ein Pflichtfeld';
                continue;
            }

            // Skip further checks if empty and not required
            if (val == null || String(val).trim() === '') continue;

            var strVal = String(val).trim();

            // Max length
            if (rule.maxLength && strVal.length > rule.maxLength) {
                errors[field] = label + ' darf max. ' + rule.maxLength + ' Zeichen haben';
                continue;
            }

            // Min length
            if (rule.minLength && strVal.length < rule.minLength) {
                errors[field] = label + ' muss mind. ' + rule.minLength + ' Zeichen haben';
                continue;
            }

            // Email
            if (rule.type === 'email' && !emailRe.test(strVal)) {
                errors[field] = 'Bitte gueltige E-Mail-Adresse eingeben';
                continue;
            }

            // Number
            if (rule.type === 'number') {
                var num = parseFloat(strVal.replace(',', '.'));
                if (isNaN(num)) {
                    errors[field] = label + ' muss eine Zahl sein';
                    continue;
                }
                if (rule.min != null && num < rule.min) {
                    errors[field] = label + ' muss mindestens ' + rule.min + ' sein';
                    continue;
                }
                if (rule.max != null && num > rule.max) {
                    errors[field] = label + ' darf max. ' + rule.max + ' sein';
                    continue;
                }
            }

            // Date
            if (rule.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
                errors[field] = label + ' muss ein gueltiges Datum sein (JJJJ-MM-TT)';
                continue;
            }

            // Custom validator
            if (typeof rule.validate === 'function') {
                var msg = rule.validate(val, data);
                if (msg) {
                    errors[field] = msg;
                }
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors: errors
        };
    },

    /**
     * Show inline validation errors under form fields.
     * Expects fields to have a parent with class 'dgd-form-group'.
     * @param {HTMLFormElement|HTMLElement} form
     * @param {Object} errors  { fieldName: 'error message' }
     */
    showFormErrors(form, errors) {
        // Clear previous errors
        var oldErrors = form.querySelectorAll('.dgd-form-error');
        for (var i = 0; i < oldErrors.length; i++) {
            oldErrors[i].remove();
        }
        var oldInvalid = form.querySelectorAll('.dgd-input--invalid');
        for (var j = 0; j < oldInvalid.length; j++) {
            oldInvalid[j].classList.remove('dgd-input--invalid');
        }

        for (var field in errors) {
            if (!errors.hasOwnProperty(field)) continue;
            var input = form.querySelector('[name="' + field + '"]');
            if (!input) continue;
            input.classList.add('dgd-input--invalid');
            var errorEl = document.createElement('div');
            errorEl.className = 'dgd-form-error';
            errorEl.textContent = errors[field];
            errorEl.style.cssText = 'color:#ef4444;font-size:0.8rem;margin-top:4px';
            input.parentNode.appendChild(errorEl);
        }
    },

    /**
     * Clear all validation errors from a form.
     */
    clearFormErrors(form) {
        var oldErrors = form.querySelectorAll('.dgd-form-error');
        for (var i = 0; i < oldErrors.length; i++) {
            oldErrors[i].remove();
        }
        var oldInvalid = form.querySelectorAll('.dgd-input--invalid');
        for (var j = 0; j < oldInvalid.length; j++) {
            oldInvalid[j].classList.remove('dgd-input--invalid');
        }
    },

    /* ------------------------------------------------------------------
       Pagination Component
       Usage: DGD.helpers.renderPagination(total, limit, offset, callback)
       Returns HTML string with pagination controls.
       callback(newOffset) is called on page change.
       ------------------------------------------------------------------ */

    renderPagination(total, limit, offset, containerId) {
        if (total <= limit) return '';

        var totalPages  = Math.ceil(total / limit);
        var currentPage = Math.floor(offset / limit) + 1;

        var html = '<div class="dgd-pagination" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;padding:12px 0">';

        // Previous
        html += '<button class="dgd-btn dgd-btn--sm" ' +
            (currentPage <= 1 ? 'disabled' : '') +
            ' onclick="DGD.helpers._paginate(\'' + containerId + '\',' + ((currentPage - 2) * limit) + ')">' +
            '&larr; Zurueck</button>';

        // Page numbers (show max 7 pages with ellipsis)
        var startPage = Math.max(1, currentPage - 3);
        var endPage   = Math.min(totalPages, currentPage + 3);

        if (startPage > 1) {
            html += '<button class="dgd-btn dgd-btn--sm" onclick="DGD.helpers._paginate(\'' + containerId + '\',0)">1</button>';
            if (startPage > 2) html += '<span style="color:var(--dgd-gray-400)">...</span>';
        }

        for (var p = startPage; p <= endPage; p++) {
            var isActive = p === currentPage;
            html += '<button class="dgd-btn dgd-btn--sm' + (isActive ? ' dgd-btn--primary' : '') + '" ' +
                (isActive ? 'disabled' : '') +
                ' onclick="DGD.helpers._paginate(\'' + containerId + '\',' + ((p - 1) * limit) + ')">' +
                p + '</button>';
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += '<span style="color:var(--dgd-gray-400)">...</span>';
            html += '<button class="dgd-btn dgd-btn--sm" onclick="DGD.helpers._paginate(\'' + containerId + '\',' + ((totalPages - 1) * limit) + ')">' + totalPages + '</button>';
        }

        // Next
        html += '<button class="dgd-btn dgd-btn--sm" ' +
            (currentPage >= totalPages ? 'disabled' : '') +
            ' onclick="DGD.helpers._paginate(\'' + containerId + '\',' + (currentPage * limit) + ')">' +
            'Weiter &rarr;</button>';

        html += '<span style="color:var(--dgd-gray-500);font-size:0.85rem;margin-left:12px">' +
            'Seite ' + currentPage + ' von ' + totalPages + ' (' + total + ' Eintraege)</span>';

        html += '</div>';
        return html;
    },

    /** Internal: pagination callback registry */
    _paginateCallbacks: {},

    /** Register a pagination callback for a container */
    registerPagination(containerId, callback) {
        DGD.helpers._paginateCallbacks[containerId] = callback;
    },

    /** Internal: dispatch pagination event */
    _paginate(containerId, newOffset) {
        var cb = DGD.helpers._paginateCallbacks[containerId];
        if (typeof cb === 'function') {
            cb(newOffset);
        }
    }
};
