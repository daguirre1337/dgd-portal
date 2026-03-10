/* ==========================================================================
   DGD Dashboard - Timeline Component
   Vertical timeline rendering for projects
   ========================================================================== */

var Timeline = {

    CATEGORY_COLORS: {
        portal:    '#8e44ad',
        marketing: '#e74c3c',
        partner:   '#e67e22',
        intern:    '#2980b9',
        kunde:     '#27ae60',
    },

    CATEGORY_LABELS: {
        portal:    'Portal',
        marketing: 'Marketing',
        partner:   'Partner',
        intern:    'Intern',
        kunde:     'Kunde',
    },

    STATUS_LABELS: {
        geplant:       'Geplant',
        aktiv:         'Aktiv',
        abgeschlossen: 'Abgeschlossen',
        pausiert:      'Pausiert',
    },

    /**
     * Render a vertical timeline into a container element.
     * @param {HTMLElement} container - DOM element to render into
     * @param {Array} projects - Array of project objects
     * @param {Object} options - { compact: false, onProjectClick: fn }
     */
    render: function(container, projects, options) {
        options = options || {};
        var compact = !!options.compact;
        var onProjectClick = options.onProjectClick || null;

        // Sort by start_date descending (newest first)
        var sorted = projects.slice().sort(function(a, b) {
            return (b.start_date || '').localeCompare(a.start_date || '');
        });

        if (sorted.length === 0) {
            container.innerHTML = '<div class="dgd-text-center dgd-text-muted" style="padding:3rem 1rem;">' +
                '<p>Keine Projekte gefunden.</p></div>';
            return;
        }

        var html = '<div class="dgd-timeline' + (compact ? ' dgd-timeline--compact' : '') + '">';
        html += '<div class="dgd-timeline__line"></div>';

        for (var i = 0; i < sorted.length; i++) {
            html += this.renderItem(sorted[i], compact);
        }

        html += '</div>';
        container.innerHTML = html;

        // Attach click handlers
        if (onProjectClick) {
            var cards = container.querySelectorAll('.dgd-timeline__card');
            for (var j = 0; j < cards.length; j++) {
                (function(card) {
                    card.addEventListener('click', function() {
                        var id = card.getAttribute('data-project-id');
                        onProjectClick(id);
                    });
                })(cards[j]);
            }
        }
    },

    /**
     * Render a single timeline item.
     * @param {Object} project
     * @param {boolean} compact
     * @returns {string} HTML string
     */
    renderItem: function(project, compact) {
        var cat = project.category || 'intern';
        var html = '<div class="dgd-timeline__item">';

        // Dot
        html += '<div class="dgd-timeline__dot dgd-timeline__dot--' + this._esc(cat) + '"></div>';

        // Date
        html += '<div class="dgd-timeline__date">' + this._formatDateRange(project.start_date, project.end_date) + '</div>';

        // Card
        html += '<div class="dgd-timeline__card" data-project-id="' + this._esc(project.id) + '">';

        // Title
        html += '<div class="dgd-timeline__title">' + this._esc(project.title) + '</div>';

        // Meta row: category badge + status badge + progress
        html += '<div class="dgd-timeline__meta">';
        html += '<span class="dgd-badge dgd-badge--' + this._esc(cat) + '">' + this._esc(this.CATEGORY_LABELS[cat] || cat) + '</span>';
        if (project.status) {
            html += '<span class="dgd-badge dgd-badge--' + this._esc(project.status) + '">' + this._esc(this.STATUS_LABELS[project.status] || project.status) + '</span>';
        }
        if (typeof project.progress === 'number') {
            html += this.renderProgressBar(project.progress);
            html += '<span class="dgd-timeline__progress-text">' + project.progress + '%</span>';
        }
        html += '</div>';

        // Description (hidden in compact mode via CSS)
        if (project.description) {
            html += '<div class="dgd-timeline__desc">' + this._esc(project.description) + '</div>';
        }

        // Milestones (hidden in compact mode via CSS)
        if (project.milestones && project.milestones.length > 0) {
            html += this.renderMilestones(project.milestones);
        }

        html += '</div>'; // card
        html += '</div>'; // item

        return html;
    },

    /**
     * Render milestones checklist inside a timeline card.
     * @param {Array} milestones - [{title, date, completed}]
     * @returns {string} HTML string
     */
    renderMilestones: function(milestones) {
        var html = '<div class="dgd-timeline__milestones">';
        for (var i = 0; i < milestones.length; i++) {
            var m = milestones[i];
            var done = m.completed ? ' dgd-timeline__milestone--done' : '';
            html += '<div class="dgd-timeline__milestone' + done + '">';
            html += '<span class="dgd-timeline__milestone-check">';
            if (m.completed) {
                html += '&#10003;';
            }
            html += '</span>';
            html += '<span>' + this._esc(m.title);
            if (m.date) {
                html += ' <small>(' + this._formatDate(m.date) + ')</small>';
            }
            html += '</span>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    },

    /**
     * Render a small inline progress bar.
     * @param {number} progress - 0-100
     * @returns {string} HTML string
     */
    renderProgressBar: function(progress) {
        var pct = Math.max(0, Math.min(100, progress));
        return '<div class="dgd-timeline__progress-bar">' +
               '<div class="dgd-timeline__progress-fill" style="width:' + pct + '%"></div>' +
               '</div>';
    },

    /**
     * Format a date string (YYYY-MM-DD) to German locale.
     * @param {string} dateStr
     * @returns {string}
     */
    _formatDate: function(dateStr) {
        if (!dateStr) return '';
        var parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return parts[2] + '.' + parts[1] + '.' + parts[0];
    },

    /**
     * Format a date range.
     * @param {string} start
     * @param {string} end
     * @returns {string}
     */
    _formatDateRange: function(start, end) {
        var s = this._formatDate(start);
        var e = this._formatDate(end);
        if (s && e) return s + ' &ndash; ' + e;
        if (s) return 'Ab ' + s;
        if (e) return 'Bis ' + e;
        return '';
    },

    /**
     * Escape HTML entities.
     * @param {*} str
     * @returns {string}
     */
    _esc: function(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    },
};
