/* ==========================================================================
   DGD Dashboard - Export & Report Module
   Depends on: namespace.js, helpers.js
   ========================================================================== */

window.DGD = window.DGD || {};

(function() {
    'use strict';

    var EXPORT_TYPES = {
        kpis:     'KPIs',
        projects: 'Projekte',
        goals:    'Ziele & OKR',
        finance:  'Finanzen',
        full:     'Gesamtbericht'
    };

    // ------------------------------------------------------------------
    //  Export button HTML (inserted by views into their page headers)
    // ------------------------------------------------------------------

    /**
     * Returns HTML for an export button.
     * @param {string} type - Export type (kpis, projects, goals, finance)
     * @returns {string} HTML string
     */
    function exportButtonHtml(type) {
        return '<button class="dgd-btn dgd-btn--outline dgd-btn--sm dgd-btn-export" ' +
               'data-export-type="' + type + '" title="' + (EXPORT_TYPES[type] || type) + ' exportieren">' +
               '\ud83d\udce5 Export</button>';
    }

    // ------------------------------------------------------------------
    //  Export Modal
    // ------------------------------------------------------------------

    function showExportModal(type) {
        var overlay = document.createElement('div');
        overlay.className = 'dgd-modal-overlay dgd-modal-overlay--active';
        overlay.id = 'export-modal-overlay';

        overlay.innerHTML =
            '<div class="dgd-modal dgd-modal--sm">' +
            '  <div class="dgd-modal__header">' +
            '    <h3 class="dgd-modal__title">\ud83d\udce5 ' + (EXPORT_TYPES[type] || type) + ' exportieren</h3>' +
            '    <button class="dgd-modal__close" id="export-modal-close">&times;</button>' +
            '  </div>' +
            '  <div class="dgd-modal__body">' +
            '    <div class="dgd-form__group">' +
            '      <label class="dgd-form__label">Format</label>' +
            '      <div class="dgd-export-options">' +
            '        <label class="dgd-export-option">' +
            '          <input type="radio" name="export-format" value="csv" checked> CSV (Excel)' +
            '        </label>' +
            '        <label class="dgd-export-option">' +
            '          <input type="radio" name="export-format" value="json"> JSON' +
            '        </label>' +
            '        <label class="dgd-export-option">' +
            '          <input type="radio" name="export-format" value="pdf"> PDF (Druckansicht)' +
            '        </label>' +
            '      </div>' +
            '    </div>' +
            '    <div class="dgd-form__group">' +
            '      <label class="dgd-form__label">Umfang</label>' +
            '      <div class="dgd-export-options">' +
            '        <label class="dgd-export-option">' +
            '          <input type="radio" name="export-scope" value="current" checked> Aktuelle Ansicht (' + (EXPORT_TYPES[type] || type) + ')' +
            '        </label>' +
            '        <label class="dgd-export-option">' +
            '          <input type="radio" name="export-scope" value="full"> Alle Daten (Gesamtbericht)' +
            '        </label>' +
            '      </div>' +
            '    </div>' +
            '  </div>' +
            '  <div class="dgd-modal__footer">' +
            '    <button class="dgd-btn dgd-btn--outline" id="export-modal-cancel">Abbrechen</button>' +
            '    <button class="dgd-btn dgd-btn--primary" id="export-modal-download">\ud83d\udce5 Herunterladen</button>' +
            '  </div>' +
            '</div>';

        document.body.appendChild(overlay);

        // Close handlers
        var closeModal = function() {
            overlay.classList.remove('dgd-modal-overlay--active');
            setTimeout(function() { overlay.remove(); }, 200);
        };

        document.getElementById('export-modal-close').addEventListener('click', closeModal);
        document.getElementById('export-modal-cancel').addEventListener('click', closeModal);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeModal();
        });

        // Download handler
        document.getElementById('export-modal-download').addEventListener('click', function() {
            var format = document.querySelector('input[name="export-format"]:checked').value;
            var scope  = document.querySelector('input[name="export-scope"]:checked').value;
            var exportType = scope === 'full' ? 'full' : type;

            if (format === 'pdf') {
                triggerPdfExport();
            } else {
                triggerDownload(exportType, format);
            }
            closeModal();
        });
    }

    // ------------------------------------------------------------------
    //  Download triggers
    // ------------------------------------------------------------------

    function triggerDownload(type, format) {
        var url = '/api/export?type=' + encodeURIComponent(type) + '&format=' + encodeURIComponent(format);

        // Use fetch + blob to trigger download with proper auth (session cookie)
        fetch(url, { credentials: 'include' })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Export fehlgeschlagen: ' + response.status);
                }

                // Extract filename from Content-Disposition header
                var disposition = response.headers.get('Content-Disposition') || '';
                var filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
                var filename = filenameMatch ? filenameMatch[1] : 'cortex_export.' + format;

                return response.blob().then(function(blob) {
                    return { blob: blob, filename: filename };
                });
            })
            .then(function(result) {
                var a = document.createElement('a');
                a.href = URL.createObjectURL(result.blob);
                a.download = result.filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(function() {
                    URL.revokeObjectURL(a.href);
                    a.remove();
                }, 100);

                showExportToast('Export erfolgreich: ' + result.filename);
            })
            .catch(function(err) {
                console.error('Export error:', err);
                showExportToast('Export fehlgeschlagen: ' + err.message, true);
            });
    }

    function triggerPdfExport() {
        document.body.classList.add('dgd-print-mode');
        setTimeout(function() {
            window.print();
            document.body.classList.remove('dgd-print-mode');
        }, 100);
    }

    // ------------------------------------------------------------------
    //  Toast notification
    // ------------------------------------------------------------------

    function showExportToast(message, isError) {
        var toast = document.createElement('div');
        toast.className = 'dgd-export-toast' + (isError ? ' dgd-export-toast--error' : '');
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(function() { toast.classList.add('dgd-export-toast--visible'); }, 10);
        setTimeout(function() {
            toast.classList.remove('dgd-export-toast--visible');
            setTimeout(function() { toast.remove(); }, 300);
        }, 3000);
    }

    // ------------------------------------------------------------------
    //  Global click delegation for export buttons
    // ------------------------------------------------------------------

    document.addEventListener('click', function(e) {
        var btn = e.target.closest('.dgd-btn-export');
        if (btn) {
            var type = btn.getAttribute('data-export-type') || 'kpis';
            showExportModal(type);
        }
    });

    // ------------------------------------------------------------------
    //  Public API
    // ------------------------------------------------------------------

    DGD.export = {
        buttonHtml:  exportButtonHtml,
        showModal:   showExportModal,
        download:    triggerDownload,
        printPdf:    triggerPdfExport
    };

})();
