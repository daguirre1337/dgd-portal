/* ==========================================================================
   DGD Dashboard - View: Dateien (Files)
   Upload, manage and list files for Cortex knowledge base
   Depends on: namespace.js, helpers.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {
    'use strict';

    var MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
    var STORAGE_KEY = 'dgd_files'; // fallback for demo mode

    var filesState = {
        search: '',
        sortBy: 'date',
        sortDir: 'desc',
    };

    // --- localStorage fallback (demo mode when API is unavailable) ---

    function loadFilesLocal() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveFilesLocal(files) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    }

    // --- API helpers ---

    function apiDeleteFile(id) {
        return fetch('api/files/' + id, {
            method: 'DELETE',
            credentials: 'same-origin',
        }).then(function(res) { return res.json(); });
    }

    function uploadFile(file) {
        var formData = new FormData();
        formData.append('file', file);

        return fetch('api/files', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData,
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.error) throw new Error(data.message || 'Upload fehlgeschlagen');
            return data;
        });
    }

    // --- Helpers ---

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        var units = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    }

    function formatDate(iso) {
        var d = new Date(iso);
        var day = ('0' + d.getDate()).slice(-2);
        var mon = ('0' + (d.getMonth() + 1)).slice(-2);
        var year = d.getFullYear();
        var hour = ('0' + d.getHours()).slice(-2);
        var min = ('0' + d.getMinutes()).slice(-2);
        return day + '.' + mon + '.' + year + ' ' + hour + ':' + min;
    }

    function getFileIcon(ext) {
        var icons = {
            pdf:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
            doc:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2980b9" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
            docx: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2980b9" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
            xls:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="13" width="8" height="6" rx="1"/></svg>',
            xlsx: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="13" width="8" height="6" rx="1"/></svg>',
            pptx: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="12" cy="15" r="3"/></svg>',
            png:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e44ad" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
            jpg:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e44ad" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
            jpeg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e44ad" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
            gif:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e44ad" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
            webp: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e44ad" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
            csv:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            txt:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7f8c8d" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
            json: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f39c12" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            md:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34495e" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>',
            xml:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            yaml: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9b59b6" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            yml:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9b59b6" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            zip:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#95a5a6" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="10" y="12" width="4" height="6" rx="1"/></svg>',
            html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
        };
        var defaultIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--dgd-gray-500)" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        return icons[ext] || defaultIcon;
    }

    function getExtension(filename) {
        var parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    function getTypLabel(ext) {
        var map = {
            pdf: 'PDF', png: 'Bild', jpg: 'Bild', jpeg: 'Bild', gif: 'Bild', webp: 'Bild', svg: 'Bild',
            doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel', pptx: 'PowerPoint',
            txt: 'Text', csv: 'CSV', json: 'JSON', html: 'HTML',
        };
        return map[ext] || ext.toUpperCase();
    }

    // --- Normalize API file to internal format ---

    function normalizeFile(f) {
        return {
            id: f.id,
            name: f.original_name || f.name,
            size: f.size || 0,
            ext: f.extension || getExtension(f.original_name || f.name || ''),
            date: f.created_at || new Date().toISOString(),
            mime_type: f.mime_type || '',
            uploaded_by: f.uploaded_by || '',
        };
    }

    // --- File processing (upload via API with localStorage fallback) ---

    function processFiles(rawFiles, container) {
        var pending = rawFiles.length;
        var errors = [];

        if (pending === 0) return;

        for (var i = 0; i < rawFiles.length; i++) {
            (function(file) {
                if (file.size > MAX_FILE_SIZE) {
                    pending--;
                    alert('Datei "' + file.name + '" ist zu gross (max. 20 MB).');
                    if (pending === 0) DGD.views.files(container);
                    return;
                }

                uploadFile(file)
                    .then(function() {
                        pending--;
                        if (pending === 0) {
                            DGD.views.files(container);
                        }
                    })
                    .catch(function(err) {
                        console.warn('[Files] Upload failed for ' + file.name + ':', err);
                        errors.push(file.name);
                        // Fallback: save to localStorage
                        var reader = new FileReader();
                        reader.onload = function(e) {
                            var existingFiles = loadFilesLocal();
                            existingFiles.push({
                                id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                                name: file.name,
                                size: file.size,
                                type: file.type,
                                ext: getExtension(file.name),
                                date: new Date().toISOString(),
                                data: e.target.result,
                            });
                            saveFilesLocal(existingFiles);
                            pending--;
                            if (pending === 0) {
                                DGD.views.files(container);
                            }
                        };
                        reader.onerror = function() {
                            pending--;
                            if (pending === 0) {
                                DGD.views.files(container);
                            }
                        };
                        reader.readAsDataURL(file);
                    });
            })(rawFiles[i]);
        }
    }

    // --- Render file list (called after data is loaded) ---

    function renderFileList(container, files, totalSize) {
        var escapeHtml = DGD.helpers.escapeHtml;
        var html = '';

        // Page header
        html += '<div class="dgd-page-header">';
        html += '<h1 class="dgd-page-header__title">Dateien</h1>';
        html += '<div class="dgd-page-header__actions">';
        html += '<button class="dgd-btn dgd-btn--primary" id="files-upload-btn">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:-2px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
        html += 'Datei hochladen</button>';
        html += '</div></div>';

        // Info banner
        html += '<div class="dgd-section-card" style="animation-delay:0.05s;background:var(--dgd-blue-50, #eff6ff);border:1px solid var(--dgd-blue-200, #bfdbfe);">';
        html += '<div style="display:flex;align-items:center;gap:0.75rem;">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--dgd-primary, #2563eb)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        html += '<span style="font-size:var(--dgd-font-size-sm);color:var(--dgd-gray-700);">';
        html += 'Dateien werden sicher auf dem Server gespeichert und stehen allen Teammitgliedern zur Verf&uuml;gung. Cortex kann diese Dateien f&uuml;r die Wissensdatenbank nutzen.';
        html += '</span></div></div>';

        // Drop zone
        html += '<div class="dgd-section-card" style="animation-delay:0.1s">';
        html += '<div id="files-dropzone" style="border:2px dashed var(--dgd-gray-300);border-radius:var(--dgd-radius-lg, 12px);padding:2.5rem 1.5rem;text-align:center;cursor:pointer;transition:all 0.2s ease;">';
        html += '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--dgd-gray-400)" stroke-width="1.5" style="margin-bottom:0.75rem"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
        html += '<p style="margin:0 0 0.25rem;font-weight:600;color:var(--dgd-gray-700);">Dateien hierher ziehen</p>';
        html += '<p style="margin:0;font-size:var(--dgd-font-size-sm);color:var(--dgd-gray-500);">oder klicken, um Dateien auszuw&auml;hlen (PDF, Bilder, Dokumente - max. 20 MB)</p>';
        html += '<input type="file" id="files-input" multiple style="display:none" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv,.json,.html,.md,.xml,.zip,.yaml,.yml,.mp3,.mp4,.wav">';
        html += '</div></div>';

        // Search & stats
        html += '<div class="dgd-section-card" style="animation-delay:0.15s">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem;">';
        html += '<div class="dgd-section-card__title" style="margin-bottom:0">';
        html += 'Hochgeladene Dateien <span style="font-weight:400;color:var(--dgd-gray-500);font-size:var(--dgd-font-size-sm);">(' + files.length + ')</span>';
        html += '</div>';
        html += '<div style="display:flex;gap:0.5rem;align-items:center;">';
        html += '<input type="text" id="files-search" class="dgd-form__input" placeholder="Datei suchen..." value="' + escapeHtml(filesState.search) + '" style="width:220px;padding:0.4rem 0.75rem;font-size:var(--dgd-font-size-sm);">';
        html += '</div></div>';

        // Filter files
        var filtered = files;
        if (filesState.search) {
            var q = filesState.search.toLowerCase();
            filtered = files.filter(function(f) {
                return f.name.toLowerCase().indexOf(q) !== -1 || getTypLabel(f.ext).toLowerCase().indexOf(q) !== -1;
            });
        }

        // Sort files
        filtered.sort(function(a, b) {
            if (filesState.sortBy === 'name') {
                var cmp = a.name.localeCompare(b.name);
                return filesState.sortDir === 'asc' ? cmp : -cmp;
            } else if (filesState.sortBy === 'size') {
                return filesState.sortDir === 'asc' ? a.size - b.size : b.size - a.size;
            } else {
                // date
                return filesState.sortDir === 'asc'
                    ? new Date(a.date) - new Date(b.date)
                    : new Date(b.date) - new Date(a.date);
            }
        });

        if (filtered.length === 0) {
            html += '<div style="text-align:center;padding:2rem 1rem;color:var(--dgd-gray-500);">';
            if (filesState.search) {
                html += '<p>Keine Dateien gefunden f&uuml;r "' + escapeHtml(filesState.search) + '"</p>';
            } else {
                html += '<p>Noch keine Dateien hochgeladen.</p>';
            }
            html += '</div>';
        } else {
            // Table
            html += '<div style="overflow-x:auto;">';
            html += '<table class="dgd-table" style="width:100%;">';
            html += '<thead><tr>';

            var columns = [
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Typ' },
                { key: 'size', label: 'Gr&ouml;sse' },
                { key: 'date', label: 'Datum' },
            ];

            for (var c = 0; c < columns.length; c++) {
                var col = columns[c];
                var sortable = col.key !== 'type';
                var sortIcon = '';
                if (sortable && filesState.sortBy === col.key) {
                    sortIcon = filesState.sortDir === 'asc' ? ' &uarr;' : ' &darr;';
                }
                html += '<th' + (sortable ? ' data-files-sort="' + col.key + '" style="cursor:pointer;user-select:none;"' : '') + '>';
                html += col.label + sortIcon + '</th>';
            }
            html += '<th style="width:80px;text-align:right;">Aktionen</th>';
            html += '</tr></thead><tbody>';

            for (var i = 0; i < filtered.length; i++) {
                var f = filtered[i];
                html += '<tr>';
                html += '<td style="display:flex;align-items:center;gap:0.5rem;">';
                html += getFileIcon(f.ext);
                html += '<span title="' + escapeHtml(f.name) + '">' + escapeHtml(f.name) + '</span>';
                html += '</td>';
                html += '<td><span class="dgd-badge">' + escapeHtml(getTypLabel(f.ext)) + '</span></td>';
                html += '<td>' + formatFileSize(f.size) + '</td>';
                html += '<td>' + formatDate(f.date) + '</td>';
                html += '<td style="text-align:right;">';
                html += '<button class="dgd-btn dgd-btn--outline dgd-btn--sm" data-files-download="' + escapeHtml(f.id) + '" title="Herunterladen" style="margin-right:4px;">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
                html += '</button>';
                html += '<button class="dgd-btn dgd-btn--outline dgd-btn--sm" data-files-delete="' + escapeHtml(f.id) + '" title="L&ouml;schen" style="color:var(--dgd-red, #e74c3c);border-color:var(--dgd-red, #e74c3c);">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
                html += '</button>';
                html += '</td>';
                html += '</tr>';
            }

            html += '</tbody></table></div>';
        }

        // Total size
        var computedTotalSize = totalSize || files.reduce(function(sum, f) { return sum + f.size; }, 0);
        if (files.length > 0) {
            html += '<div style="margin-top:0.75rem;font-size:var(--dgd-font-size-sm);color:var(--dgd-gray-500);">';
            html += 'Gesamt: ' + formatFileSize(computedTotalSize) + ' in ' + files.length + ' Datei' + (files.length !== 1 ? 'en' : '');
            html += '</div>';
        }

        html += '</div>'; // close section card

        container.innerHTML = html;

        // --- Event bindings ---
        bindFileEvents(container);
    }

    // --- Event bindings (extracted for reuse) ---

    function bindFileEvents(container) {
        var dropzone = document.getElementById('files-dropzone');
        var fileInput = document.getElementById('files-input');
        var uploadBtn = document.getElementById('files-upload-btn');
        var searchInput = document.getElementById('files-search');

        // Click to upload
        if (dropzone) {
            dropzone.addEventListener('click', function() { fileInput.click(); });
        }
        if (uploadBtn) {
            uploadBtn.addEventListener('click', function() { fileInput.click(); });
        }

        // File input change
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                if (this.files && this.files.length > 0) {
                    processFiles(this.files, container);
                }
            });
        }

        // Drag & drop
        if (dropzone) {
            dropzone.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.style.borderColor = 'var(--dgd-primary, #2563eb)';
                this.style.background = 'var(--dgd-blue-50, #eff6ff)';
            });
            dropzone.addEventListener('dragleave', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.style.borderColor = 'var(--dgd-gray-300)';
                this.style.background = '';
            });
            dropzone.addEventListener('drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.style.borderColor = 'var(--dgd-gray-300)';
                this.style.background = '';
                if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                    processFiles(e.dataTransfer.files, container);
                }
            });
        }

        // Search
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                filesState.search = this.value;
                DGD.views.files(container);
            });
            // Restore focus and cursor position
            searchInput.focus();
            searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }

        // Sort headers
        var sortHeaders = container.querySelectorAll('[data-files-sort]');
        for (var sh = 0; sh < sortHeaders.length; sh++) {
            sortHeaders[sh].addEventListener('click', function() {
                var key = this.getAttribute('data-files-sort');
                if (filesState.sortBy === key) {
                    filesState.sortDir = filesState.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    filesState.sortBy = key;
                    filesState.sortDir = key === 'date' ? 'desc' : 'asc';
                }
                DGD.views.files(container);
            });
        }

        // Delete buttons
        var deleteBtns = container.querySelectorAll('[data-files-delete]');
        for (var d = 0; d < deleteBtns.length; d++) {
            deleteBtns[d].addEventListener('click', function(e) {
                e.stopPropagation();
                var fileId = this.getAttribute('data-files-delete');
                if (confirm('Datei wirklich loeschen?')) {
                    apiDeleteFile(fileId)
                        .then(function() {
                            DGD.views.files(container);
                        })
                        .catch(function(err) {
                            console.warn('[Files] API delete failed, removing from localStorage:', err);
                            // Fallback: remove from localStorage
                            var localFiles = loadFilesLocal().filter(function(f) { return f.id !== fileId; });
                            saveFilesLocal(localFiles);
                            DGD.views.files(container);
                        });
                }
            });
        }

        // Download buttons
        var downloadBtns = container.querySelectorAll('[data-files-download]');
        for (var dl = 0; dl < downloadBtns.length; dl++) {
            downloadBtns[dl].addEventListener('click', function(e) {
                e.stopPropagation();
                var fileId = this.getAttribute('data-files-download');
                window.open('api/files/' + fileId + '/download');
            });
        }
    }

    // --- Main view entry point ---

    DGD.views.files = function(container) {
        // Show loading state immediately
        container.innerHTML = '<div style="text-align:center;padding:3rem;"><p>Dateien werden geladen...</p></div>';

        // Build API URL with query params
        var url = 'api/files';
        var params = [];
        if (filesState.search) params.push('q=' + encodeURIComponent(filesState.search));
        if (filesState.sortBy) params.push('sort=' + filesState.sortBy);
        params.push('dir=' + filesState.sortDir);
        if (params.length) url += '?' + params.join('&');

        fetch(url, { credentials: 'same-origin' })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data && data.files) {
                    var normalized = data.files.map(normalizeFile);
                    renderFileList(container, normalized, data.total_size || 0);
                } else {
                    renderFileList(container, [], 0);
                }
            })
            .catch(function(err) {
                console.warn('[Files] API error, falling back to localStorage:', err);
                // Fallback to localStorage for demo mode
                var files = loadFilesLocal();
                renderFileList(container, files, 0);
            });
    };
})();
