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
    }
};
