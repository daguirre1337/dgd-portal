/* ==========================================================================
   DGD Dashboard - Gantt Chart Component
   Horizontal 16-month project timeline with today centered
   ========================================================================== */

var Gantt = {

    CATEGORY_COLORS: {
        portal:    '#8e44ad',
        marketing: '#e74c3c',
        partner:   '#e67e22',
        intern:    '#2980b9',
        kunde:     '#27ae60',
    },

    MONTH_NAMES: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],

    /**
     * Render a horizontal Gantt chart into a container.
     * @param {HTMLElement} container
     * @param {Array} projects
     * @param {Object} options - { onProjectClick: fn }
     */
    render: function(container, projects, options) {
        options = options || {};
        var onProjectClick = options.onProjectClick || null;

        // Calculate 16-month window: 8 months back, today, 7 months forward
        var today = new Date();
        var windowStart = new Date(today.getFullYear(), today.getMonth() - 8, 1);
        var windowEnd = new Date(today.getFullYear(), today.getMonth() + 8, 0); // last day of month+7

        var totalDays = this._daysBetween(windowStart, windowEnd);

        // SVG dimensions
        var labelWidth = 160;
        var chartWidth = 1000;
        var totalWidth = labelWidth + chartWidth;
        var headerHeight = 30;
        var rowHeight = 28;
        var barHeight = 20;
        var barPad = 4;

        // Filter projects that overlap with the window
        var visible = [];
        for (var i = 0; i < projects.length; i++) {
            var p = projects[i];
            if (!p.start_date) continue;
            var pStart = this._parseDate(p.start_date);
            var pEnd = p.end_date ? this._parseDate(p.end_date) : new Date(pStart.getTime() + 30 * 86400000);
            if (pEnd < windowStart || pStart > windowEnd) continue;
            visible.push({ project: p, start: pStart, end: pEnd });
        }

        if (visible.length === 0) {
            container.innerHTML = '<div class="dgd-gantt-empty" style="padding:1.5rem;text-align:center;color:#6c757d;font-size:0.875rem;">Keine Projekte im sichtbaren Zeitraum.</div>';
            return;
        }

        var svgHeight = headerHeight + visible.length * rowHeight + 10;

        var svg = '<svg class="dgd-gantt-svg" viewBox="0 0 ' + totalWidth + ' ' + svgHeight + '" width="100%" preserveAspectRatio="xMinYMin meet">';

        // Month columns
        var d = new Date(windowStart);
        while (d <= windowEnd) {
            var monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            var monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            var x = labelWidth + this._daysBetween(windowStart, monthStart) / totalDays * chartWidth;
            var w = this._daysBetween(monthStart, monthEnd > windowEnd ? windowEnd : monthEnd) / totalDays * chartWidth;

            // Month label
            var label = this.MONTH_NAMES[d.getMonth()];
            if (d.getMonth() === 0 || d.getTime() === windowStart.getTime()) {
                label += ' ' + d.getFullYear();
            }
            svg += '<text class="dgd-gantt__month-label" x="' + (x + 4) + '" y="18">' + label + '</text>';

            // Month separator line
            svg += '<line class="dgd-gantt__month-line" x1="' + x + '" y1="' + headerHeight + '" x2="' + x + '" y2="' + svgHeight + '"/>';

            d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        }

        // Horizontal grid lines (one per row)
        for (var r = 0; r < visible.length; r++) {
            var ry = headerHeight + r * rowHeight;
            svg += '<line x1="' + labelWidth + '" y1="' + ry + '" x2="' + totalWidth + '" y2="' + ry + '" stroke="#f0f0f0" stroke-width="1"/>';
        }

        // Today line
        var todayX = labelWidth + this._daysBetween(windowStart, today) / totalDays * chartWidth;
        svg += '<line class="dgd-gantt__today" x1="' + todayX + '" y1="0" x2="' + todayX + '" y2="' + svgHeight + '"/>';
        svg += '<text x="' + (todayX + 3) + '" y="12" fill="#e74c3c" font-size="9" font-weight="600">HEUTE</text>';

        // Project bars
        for (var j = 0; j < visible.length; j++) {
            var item = visible[j];
            var proj = item.project;
            var color = this.CATEGORY_COLORS[proj.category] || '#6c757d';
            var opacity = proj.status === 'abgeschlossen' ? 0.4 : 0.85;

            // Clip to window
            var barStart = item.start < windowStart ? windowStart : item.start;
            var barEnd = item.end > windowEnd ? windowEnd : item.end;

            var bx = labelWidth + this._daysBetween(windowStart, barStart) / totalDays * chartWidth;
            var bw = this._daysBetween(barStart, barEnd) / totalDays * chartWidth;
            var by = headerHeight + j * rowHeight + barPad;

            // Minimum bar width
            if (bw < 3) bw = 3;

            // Project label (left side)
            var labelText = proj.title.length > 22 ? proj.title.substring(0, 20) + '..' : proj.title;
            svg += '<text class="dgd-gantt__bar-label" x="4" y="' + (by + barHeight / 2 + 4) + '">' + this._esc(labelText) + '</text>';

            // Bar
            svg += '<rect class="dgd-gantt__bar" data-project-id="' + this._esc(proj.id) + '"';
            svg += ' x="' + bx.toFixed(1) + '" y="' + by + '" width="' + bw.toFixed(1) + '" height="' + barHeight + '"';
            svg += ' fill="' + color + '" opacity="' + opacity + '" rx="4" ry="4">';
            svg += '<title>' + this._esc(proj.title) + '</title>';
            svg += '</rect>';

            // Progress fill (darker shade inside bar)
            if (typeof proj.progress === 'number' && proj.progress > 0 && proj.progress < 100) {
                var pw = bw * (proj.progress / 100);
                svg += '<rect x="' + bx.toFixed(1) + '" y="' + by + '" width="' + pw.toFixed(1) + '" height="' + barHeight + '"';
                svg += ' fill="' + color + '" opacity="' + (opacity + 0.15) + '" rx="4" ry="4" style="pointer-events:none;"/>';
            }
        }

        svg += '</svg>';
        container.innerHTML = svg;

        // Attach click handlers
        if (onProjectClick) {
            var bars = container.querySelectorAll('.dgd-gantt__bar');
            for (var b = 0; b < bars.length; b++) {
                (function(bar) {
                    bar.addEventListener('click', function() {
                        var id = bar.getAttribute('data-project-id');
                        if (id) onProjectClick(id);
                    });
                })(bars[b]);
            }
        }

        // Scroll to center (today line)
        var scrollTarget = todayX - container.clientWidth / 2;
        if (scrollTarget > 0) {
            container.scrollLeft = scrollTarget;
        }
    },

    /**
     * Calculate days between two dates.
     */
    _daysBetween: function(d1, d2) {
        return Math.max(0, Math.round((d2 - d1) / 86400000));
    },

    /**
     * Parse YYYY-MM-DD string to Date.
     */
    _parseDate: function(str) {
        var p = str.split('-');
        return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    },

    /**
     * Escape HTML entities.
     */
    _esc: function(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
};
