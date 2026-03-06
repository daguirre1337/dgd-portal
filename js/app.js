/**
 * DGD Portal - Hauptanwendung
 * SPA-Navigation, Formular-Handling, Status-Abfrage
 */

(function () {
    'use strict';

    // =========================================================================
    // State
    // =========================================================================

    const state = {
        currentView: 'landing',
        cases: [],
        currentCase: null,
        loading: false,
    };

    // Wizard state for Gutachter-Finder flow
    let wizardState = {
        lat: null,
        lng: null,
        locationName: '',
        specialty: 'kfz',
        partners: [],
        selectedPartner: null,
        map: null,
        markers: null,
    };

    // =========================================================================
    // Router (Hash-basiert)
    // =========================================================================

    const routes = {
        '': 'landing',
        '#': 'landing',
        '#start': 'landing',
        '#gutachter': 'wizard',
        '#melden': 'report-form',
        '#status': 'status-check',
        '#partner': 'partner',
        '#impressum': 'impressum',
        '#datenschutz': 'datenschutz',
        '#agb': 'agb',
    };

    function navigateTo(hash) {
        window.location.hash = hash;
    }

    function handleRoute() {
        const hash = window.location.hash || '';
        const viewName = routes[hash] || 'landing';
        showView(viewName);
    }

    function showView(viewName) {
        state.currentView = viewName;

        // Alle Views ausblenden
        document.querySelectorAll('.dgd-view').forEach(view => {
            view.classList.remove('dgd-view--active');
        });

        // Aktive View einblenden
        const activeView = document.getElementById(`view-${viewName}`);
        if (activeView) {
            activeView.classList.add('dgd-view--active');
        }

        // Nav-Links aktualisieren
        document.querySelectorAll('.dgd-header__nav a').forEach(link => {
            link.classList.remove('active');
            const linkHash = link.getAttribute('href') || '';
            if (routes[linkHash] === viewName) {
                link.classList.add('active');
            }
        });

        // Scroll nach oben
        window.scrollTo(0, 0);

        // Destroy Gutachter wizard when leaving
        if (gutachterWizard && viewName !== 'wizard') {
            gutachterWizard.destroy();
            gutachterWizard = null;
        }

        // Init landing map when landing view is shown
        if (viewName === 'landing') {
            setTimeout(initLandingMap, 150);
        }

        // Init Gutachter wizard when its view is shown
        if (viewName === 'wizard') {
            setTimeout(initGutachterWizard, 50);
        }
    }

    // =========================================================================
    // Formular: Schadenfall melden
    // =========================================================================

    function initReportForm() {
        const form = document.getElementById('report-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Validierung
            if (!validateForm(form)) return;

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="dgd-spinner"></span> Wird gesendet...';

                const formData = {
                    customer_name: form.querySelector('#field-name').value.trim(),
                    email: form.querySelector('#field-email').value.trim(),
                    phone: form.querySelector('#field-phone').value.trim(),
                    damage_type: form.querySelector('#field-damage-type').value,
                    description: form.querySelector('#field-description').value.trim(),
                    location: form.querySelector('#field-location').value.trim(),
                };

                if (wizardState.selectedPartner) {
                    formData.partner_id = wizardState.selectedPartner.id;
                }

                const result = await dgdApi.createCase(formData);
                showSuccess(
                    `Ihr Schadenfall wurde erfolgreich gemeldet. ` +
                    `Ihre Fallnummer: <strong>${result.case_id || result.id}</strong>. ` +
                    `Wir melden uns in Kürze bei Ihnen.`
                );
                form.reset();
            } catch (err) {
                showError(err.message || 'Fehler beim Senden. Bitte versuchen Sie es erneut.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    function validateForm(form) {
        let valid = true;
        const required = form.querySelectorAll('[required]');

        // Vorherige Fehler zurücksetzen
        form.querySelectorAll('.dgd-form__group--error').forEach(group => {
            group.classList.remove('dgd-form__group--error');
        });

        required.forEach(field => {
            if (!field.value.trim()) {
                valid = false;
                const group = field.closest('.dgd-form__group');
                if (group) group.classList.add('dgd-form__group--error');
            }
        });

        // E-Mail-Validierung
        const emailField = form.querySelector('#field-email');
        if (emailField && emailField.value.trim()) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(emailField.value.trim())) {
                valid = false;
                const group = emailField.closest('.dgd-form__group');
                if (group) {
                    group.classList.add('dgd-form__group--error');
                    const errorEl = group.querySelector('.dgd-form__error');
                    if (errorEl) errorEl.textContent = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
                }
            }
        }

        return valid;
    }

    // =========================================================================
    // Photo Upload + Description Hint
    // =========================================================================

    function initPhotoUpload() {
        var zone = document.getElementById('photo-upload-zone');
        var input = document.getElementById('photo-upload-input');
        var preview = document.getElementById('photo-preview');
        if (!zone || !input || !preview) return;

        zone.querySelector('.dgd-upload-zone__browse').addEventListener('click', function (e) {
            e.stopPropagation();
            input.click();
        });
        zone.addEventListener('click', function () { input.click(); });

        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            zone.classList.add('dgd-upload-zone--dragover');
        });
        zone.addEventListener('dragleave', function () {
            zone.classList.remove('dgd-upload-zone--dragover');
        });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('dgd-upload-zone--dragover');
            handleFiles(e.dataTransfer.files);
        });

        input.addEventListener('change', function () {
            handleFiles(input.files);
            input.value = '';
        });

        function handleFiles(files) {
            Array.from(files).forEach(function (file) {
                if (!file.type.match(/^image\//)) return;
                if (file.size > 10 * 1024 * 1024) return;

                var reader = new FileReader();
                reader.onload = function (e) {
                    var thumb = document.createElement('div');
                    thumb.className = 'dgd-upload-zone__thumb';
                    thumb.innerHTML =
                        '<img src="' + e.target.result + '" alt="Vorschau">' +
                        '<button type="button" class="dgd-upload-zone__thumb-remove">&times;</button>';
                    thumb.querySelector('.dgd-upload-zone__thumb-remove')
                        .addEventListener('click', function (ev) {
                            ev.stopPropagation();
                            thumb.remove();
                        });
                    preview.appendChild(thumb);
                };
                reader.readAsDataURL(file);
            });
        }
    }

    function initDescriptionHint() {
        var desc = document.getElementById('field-description');
        var hint = document.getElementById('description-hint');
        if (!desc || !hint) return;

        desc.addEventListener('input', function () {
            var len = desc.value.trim().length;
            if (len >= 20) {
                hint.textContent = len + ' Zeichen';
                hint.classList.add('dgd-form__hint--success');
            } else {
                hint.textContent = 'Mindestens 20 Zeichen empfohlen';
                hint.classList.remove('dgd-form__hint--success');
            }
        });
    }

    // =========================================================================
    // Status-Abfrage
    // =========================================================================

    function initStatusCheck() {
        const form = document.getElementById('status-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const caseId = form.querySelector('#field-case-id').value.trim();
            if (!caseId) return;

            const resultContainer = document.getElementById('status-result');
            resultContainer.innerHTML = '<div class="dgd-text-center"><span class="dgd-spinner"></span> Status wird abgerufen...</div>';

            try {
                const result = await dgdApi.getCase(caseId);
                renderStatusResult(resultContainer, result);
            } catch (err) {
                if (err.status === 404) {
                    resultContainer.innerHTML =
                        '<div class="dgd-alert dgd-alert--error">Kein Schadenfall mit dieser Nummer gefunden.</div>';
                } else {
                    resultContainer.innerHTML =
                        `<div class="dgd-alert dgd-alert--error">${err.message}</div>`;
                }
            }
        });
    }

    function renderStatusResult(container, caseData) {
        const statusLabels = {
            'pending': 'Eingang',
            'in_review': 'In Bearbeitung',
            'completed': 'Abgeschlossen',
            'cancelled': 'Storniert',
        };

        const statusLabel = statusLabels[caseData.status] || caseData.status;
        const badgeClass = `dgd-badge--${caseData.status}`;

        container.innerHTML = `
            <div class="dgd-card dgd-status-detail">
                <div class="dgd-card__header">
                    <h3 class="dgd-card__title">Schadenfall ${caseData.id}</h3>
                    <span class="dgd-badge ${badgeClass}">${statusLabel}</span>
                </div>
                <div class="dgd-card__body">
                    <div class="dgd-status-detail__row">
                        <span class="dgd-status-detail__label">Name:</span>
                        <span>${escapeHtml(caseData.customer_name)}</span>
                    </div>
                    <div class="dgd-status-detail__row">
                        <span class="dgd-status-detail__label">Schadensart:</span>
                        <span>${escapeHtml(caseData.damage_type)}</span>
                    </div>
                    <div class="dgd-status-detail__row">
                        <span class="dgd-status-detail__label">Ort:</span>
                        <span>${escapeHtml(caseData.location)}</span>
                    </div>
                    <div class="dgd-status-detail__row">
                        <span class="dgd-status-detail__label">Beschreibung:</span>
                        <span>${escapeHtml(caseData.description)}</span>
                    </div>
                    <div class="dgd-status-detail__row">
                        <span class="dgd-status-detail__label">Erstellt am:</span>
                        <span>${formatDate(caseData.created_at)}</span>
                    </div>
                    <div class="dgd-status-detail__row">
                        <span class="dgd-status-detail__label">Zuletzt aktualisiert:</span>
                        <span>${formatDate(caseData.updated_at)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // Nachrichten (Success / Error)
    // =========================================================================

    function showSuccess(message) {
        showMessage('success', message);
    }

    function showError(message) {
        showMessage('error', message);
    }

    function showMessage(type, message) {
        // Vorherige Nachrichten entfernen
        document.querySelectorAll('.dgd-alert--dynamic').forEach(el => el.remove());

        const alertDiv = document.createElement('div');
        alertDiv.className = `dgd-alert dgd-alert--${type} dgd-alert--dynamic`;
        alertDiv.innerHTML = message;

        // Vor dem Formular einfügen
        const form = document.getElementById('report-form');
        if (form) {
            form.parentNode.insertBefore(alertDiv, form);
        } else {
            // Fallback: In den aktiven View einfügen
            const activeView = document.querySelector('.dgd-view--active');
            if (activeView) {
                activeView.insertBefore(alertDiv, activeView.firstChild);
            }
        }

        // Automatisch ausblenden nach 8 Sekunden
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transition = 'opacity 0.3s ease';
            setTimeout(() => alertDiv.remove(), 300);
        }, 8000);
    }

    // =========================================================================
    // Hilfsfunktionen
    // =========================================================================

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    }

    // =========================================================================
    // Mobile Menu Toggle
    // =========================================================================

    function initMobileMenu() {
        const toggle = document.querySelector('.dgd-header__menu-toggle');
        const nav = document.querySelector('.dgd-header__nav');
        if (!toggle || !nav) return;

        toggle.addEventListener('click', () => {
            nav.classList.toggle('dgd-header__nav--open');
            const isOpen = nav.classList.contains('dgd-header__nav--open');
            toggle.textContent = isOpen ? '\u2715' : '\u2630';
            toggle.setAttribute('aria-expanded', isOpen);
        });

        // Menü schliessen bei Klick auf Link
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('dgd-header__nav--open');
                toggle.textContent = '\u2630';
                toggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // =========================================================================
    // Wizard: Gutachter finden (DGDWizard Fullscreen)
    // =========================================================================

    let gutachterWizard = null;

    function initGutachterWizard() {
        if (gutachterWizard) return;

        gutachterWizard = new DGDWizard({
            containerId: 'gutachter-wizard-mount',
            steps: [stepLocation(), stepResults(), stepConfirmation()],
            onComplete: function () {
                setupPartnerBadge(wizardState.selectedPartner);
                navigateTo('melden');
            },
        });
        gutachterWizard.render();
    }

    // -- Step 1: Location + Map Preview --

    function stepLocation() {
        let step1Map = null;
        let step1MarkerLayer = null;

        return {
            id: 'location',
            title: 'Wo ist Ihr Fahrzeug?',
            subtitle: 'Geben Sie Ihre PLZ oder Ihren Ort ein, um Gutachter in Ihrer Nähe zu finden.',
            fullWidth: true,
            hideNext: true,
            encouragement: 'Wir finden den besten Gutachter in Ihrer Nähe!',

            render: function (contentEl) {
                contentEl.innerHTML =
                    '<div class="dgd-gutachter-search">' +
                        '<div class="dgd-gutachter-search__bar">' +
                            '<div class="dgd-gutachter-search__input-wrap">' +
                                '<input type="text" id="gw-location-input" class="dgd-form__input dgd-form__input--lg" placeholder="PLZ oder Ort eingeben (z.B. 10115 oder Berlin)">' +
                                '<button type="button" id="gw-gps-btn" class="dgd-gutachter-search__gps" title="Meinen Standort verwenden">📍</button>' +
                            '</div>' +
                            '<button type="button" id="gw-search-btn" class="dgd-btn dgd-btn--primary dgd-btn--lg">Suchen</button>' +
                        '</div>' +
                        '<div id="gw-location-error" class="dgd-alert dgd-alert--error dgd-hidden dgd-mt-md"></div>' +
                    '</div>' +

                    '<div class="dgd-gutachter-trust">' +
                        '<div class="dgd-gutachter-trust__badge"><span class="dgd-gutachter-trust__icon">✅</span><span>Kostenlos für Geschädigte</span></div>' +
                        '<div class="dgd-gutachter-trust__badge"><span class="dgd-gutachter-trust__icon">👥</span><span>500+ Sachverständige</span></div>' +
                        '<div class="dgd-gutachter-trust__badge"><span class="dgd-gutachter-trust__icon">📋</span><span>Zertifiziert &amp; Unabhängig</span></div>' +
                    '</div>' +

                    '<div class="dgd-landing-map__legend">' +
                        '<span class="dgd-legend-item"><span class="dgd-legend-dot" style="background:#1a3a5c"></span> Kfz-Sachverständige</span>' +
                        '<span id="gw-partner-count" class="dgd-landing-map__count"></span>' +
                    '</div>' +

                    '<div id="gw-preview-map" class="dgd-map dgd-map--wizard-preview"></div>';

                // Event listeners
                var searchBtn = contentEl.querySelector('#gw-search-btn');
                var locationInput = contentEl.querySelector('#gw-location-input');
                var errorEl = contentEl.querySelector('#gw-location-error');
                var gpsBtn = contentEl.querySelector('#gw-gps-btn');

                searchBtn.addEventListener('click', function () {
                    doSearch(locationInput, errorEl, searchBtn);
                });
                locationInput.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') { e.preventDefault(); doSearch(locationInput, errorEl, searchBtn); }
                });
                gpsBtn.addEventListener('click', function () {
                    doGPS(locationInput, errorEl, gpsBtn);
                });

            },

            onEnter: function () {
                setTimeout(function () {
                    var mapEl = document.getElementById('gw-preview-map');
                    if (!mapEl) return;
                    if (step1Map) { step1Map.invalidateSize(); return; }

                    step1Map = L.map('gw-preview-map', { scrollWheelZoom: false }).setView([51.16, 10.45], 6);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                        maxZoom: 18,
                    }).addTo(step1Map);
                    step1Map.once('click', function () { step1Map.scrollWheelZoom.enable(); });

                    loadPartnersOnMap(step1Map, function (layer) { step1MarkerLayer = layer; });
                }, 150);
            },

            validate: function () {
                if (!wizardState.lat || !wizardState.lng) {
                    var err = document.getElementById('gw-location-error');
                    if (err) {
                        err.textContent = 'Bitte geben Sie einen Standort ein oder nutzen Sie die GPS-Funktion.';
                        err.classList.remove('dgd-hidden');
                    }
                    return false;
                }
                return true;
            },
        };
    }

    // -- Step 2: Results Map + Partner Cards --

    function stepResults() {
        let resultsMap = null;

        return {
            id: 'results',
            title: 'Ihr Gutachter in der Nähe',
            subtitle: '',
            fullWidth: true,
            hideNext: true,
            encouragement: '',

            render: function (contentEl) {
                contentEl.innerHTML =
                    '<div class="dgd-gutachter-results">' +
                        '<div class="dgd-gutachter-results__layout">' +
                            '<div class="dgd-gutachter-results__map-col">' +
                                '<div id="gw-results-map" class="dgd-map dgd-map--wizard-results"></div>' +
                            '</div>' +
                            '<div class="dgd-gutachter-results__cards-col">' +
                                '<div class="dgd-results-header">' +
                                    '<span id="gw-results-location" class="dgd-results-header__location"></span>' +
                                    '<span id="gw-results-count" class="dgd-results-header__count"></span>' +
                                '</div>' +
                                '<div id="gw-no-results" class="dgd-alert dgd-alert--info dgd-hidden dgd-mt-md">' +
                                    'Keine Gutachter in dieser Region gefunden.' +
                                    '<button class="dgd-btn dgd-btn--outline-dark dgd-btn--sm dgd-mt-sm" id="gw-expand-radius">Suchradius erweitern</button>' +
                                '</div>' +
                                '<div id="gw-partner-grid" class="dgd-partner-grid"></div>' +
                            '</div>' +
                        '</div>' +
                    '</div>';

                contentEl.querySelector('#gw-expand-radius')?.addEventListener('click', function () {
                    expandSearchRadius();
                });
            },

            onEnter: function () {
                var partners = wizardState.partners;

                if (gutachterWizard) {
                    gutachterWizard.setEncouragement(
                        partners.length + ' Sachverständige gefunden! Wählen Sie Ihren Gutachter.'
                    );
                }

                var locLabel = document.getElementById('gw-results-location');
                var countLabel = document.getElementById('gw-results-count');
                if (locLabel) locLabel.textContent = wizardState.locationName;
                if (countLabel) countLabel.textContent = partners.length + ' Gutachter';

                setTimeout(function () {
                    var mapEl = document.getElementById('gw-results-map');
                    if (!mapEl) return;
                    if (resultsMap) { resultsMap.remove(); resultsMap = null; }

                    resultsMap = initResultsMap(mapEl);
                    renderWizardPartnerCards();
                }, 100);
            },

            onLeave: function () {
                if (resultsMap) { resultsMap.remove(); resultsMap = null; }
            },

            validate: function () {
                if (!wizardState.selectedPartner) return false;
                return true;
            },
        };
    }

    // -- Step 3: Confirmation + Testimonials --

    function stepConfirmation() {
        return {
            id: 'confirmation',
            title: 'Gutachter gewählt!',
            subtitle: 'Ihr Sachverständiger steht bereit.',
            fullWidth: false,
            encouragement: 'Perfekt! Ihr Gutachter steht bereit.',
            nextLabel: 'Jetzt Schaden melden',

            render: function () { /* Dynamic content in onEnter */ },

            onEnter: function () {
                var p = wizardState.selectedPartner;
                if (!p) return;

                var contentEl = document.querySelector('[data-step-id="confirmation"] .dgd-wizard-step__content');
                if (!contentEl) return;

                var stars = '\u2605'.repeat(Math.round(p.rating || 5)) + '\u2606'.repeat(5 - Math.round(p.rating || 5));
                var spec = SPECIALTY_LABELS[p.specialty] || 'Gutachter';
                var initials = escapeHtml(p.name).split(' ').map(function (n) { return n[0]; }).join('').substring(0, 2);

                contentEl.innerHTML =
                    '<div class="dgd-gutachter-chosen">' +
                        '<div class="dgd-gutachter-chosen__card">' +
                            '<div class="dgd-partner-card__avatar dgd-partner-card__avatar--lg">' + initials + '</div>' +
                            '<h3>' + escapeHtml(p.name) + '</h3>' +
                            '<p class="dgd-text-muted">' + escapeHtml(p.company || '') + '</p>' +
                            '<div class="dgd-gutachter-chosen__meta">' +
                                '<span class="dgd-gutachter-chosen__rating">' + stars + ' ' + p.rating + '</span>' +
                                '<span class="dgd-gutachter-chosen__specialty">' + escapeHtml(spec) + '</span>' +
                            '</div>' +
                            '<p class="dgd-gutachter-chosen__location">📍 ' + escapeHtml((p.plz || '') + ' ' + (p.city || '')) + '</p>' +
                        '</div>' +
                        '<div class="dgd-gutachter-chosen__actions">' +
                            '<button class="dgd-btn dgd-btn--primary dgd-btn--lg" id="gw-report-btn">Jetzt Schaden melden</button>' +
                            '<a href="tel:+498000095000" class="dgd-btn dgd-btn--outline-dark dgd-btn--lg">📞 Anrufen</a>' +
                        '</div>' +
                    '</div>' +
                    '<div class="dgd-gutachter-testimonials">' +
                        '<h3 class="dgd-gutachter-testimonials__title">Das sagen unsere Kunden</h3>' +
                        '<div class="dgd-gutachter-testimonials__grid">' + renderTestimonials() + '</div>' +
                    '</div>';

                contentEl.querySelector('#gw-report-btn')?.addEventListener('click', function () {
                    setupPartnerBadge(p);
                    navigateTo('melden');
                });

                // Confetti!
                if (gutachterWizard) {
                    setTimeout(function () { gutachterWizard.triggerConfetti(); }, 200);
                }
            },
        };
    }

    // -- Wizard Helpers --

    async function doSearch(inputEl, errorEl, searchBtn) {
        var query = inputEl.value.trim();
        if (!query) {
            errorEl.textContent = 'Bitte geben Sie eine PLZ oder einen Ort ein.';
            errorEl.classList.remove('dgd-hidden');
            return;
        }
        errorEl.classList.add('dgd-hidden');

        try {
            searchBtn.disabled = true;
            searchBtn.innerHTML = '<span class="dgd-spinner" style="width:18px;height:18px;border-width:2px;"></span>';

            var result = await dgdApi.geocode(query);
            if (!result.results || result.results.length === 0) {
                errorEl.textContent = 'Standort konnte nicht gefunden werden. Bitte versuchen Sie eine andere Eingabe.';
                errorEl.classList.remove('dgd-hidden');
                return;
            }

            var place = result.results[0];
            wizardState.lat = parseFloat(place.lat);
            wizardState.lng = parseFloat(place.lon || place.lng);
            wizardState.locationName = place.display_name || place.name || query;

            await searchPartnersAndAdvance();
        } catch (err) {
            // API unavailable - use demo data with distance
            wizardState.lat = wizardState.lat || 50.5;
            wizardState.lng = wizardState.lng || 10.0;
            wizardState.locationName = query;
            wizardState.partners = getDemoPartnersNearby(wizardState.lat, wizardState.lng);
            if (gutachterWizard) gutachterWizard.goToStep(1);
        } finally {
            searchBtn.disabled = false;
            searchBtn.textContent = 'Suchen';
        }
    }

    async function doGPS(inputEl, errorEl, gpsBtn) {
        if (!navigator.geolocation) {
            errorEl.textContent = 'Geolocation wird von Ihrem Browser nicht unterstützt.';
            errorEl.classList.remove('dgd-hidden');
            return;
        }
        errorEl.classList.add('dgd-hidden');
        gpsBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async function (pos) {
                wizardState.lat = pos.coords.latitude;
                wizardState.lng = pos.coords.longitude;
                try {
                    var data = await dgdApi.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
                    wizardState.locationName = data.name || 'Ihr Standort';
                    inputEl.value = wizardState.locationName;
                } catch (e) {
                    wizardState.locationName = 'Ihr Standort';
                    inputEl.value = 'Ihr Standort';
                }
                gpsBtn.disabled = false;
                await searchPartnersAndAdvance();
            },
            function () {
                gpsBtn.disabled = false;
                errorEl.textContent = 'Standort konnte nicht ermittelt werden. Bitte manuell eingeben.';
                errorEl.classList.remove('dgd-hidden');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    async function searchPartnersAndAdvance() {
        try {
            var result = await dgdApi.getNearbyPartners(wizardState.lat, wizardState.lng, 50, wizardState.specialty);
            wizardState.partners = result.partners || [];
        } catch (e) {
            // API unavailable - fallback to demo data
            wizardState.partners = getDemoPartnersNearby(wizardState.lat, wizardState.lng);
        }
        if (gutachterWizard) gutachterWizard.goToStep(1);
    }

    async function expandSearchRadius() {
        try {
            var result = await dgdApi.getNearbyPartners(wizardState.lat, wizardState.lng, 100, wizardState.specialty);
            wizardState.partners = result.partners || [];
        } catch (e) {
            wizardState.partners = getDemoPartnersNearby(wizardState.lat, wizardState.lng, 200);
        }
        // Re-enter step 2
        if (gutachterWizard) {
            gutachterWizard.goToStep(0);
            setTimeout(function () { gutachterWizard.goToStep(1); }, 50);
        }
    }

    function getDemoPartnersNearby(lat, lng, maxKm) {
        maxKm = maxKm || 999;
        return DEMO_PARTNERS.map(function (p) {
            var d = haversineKm(lat, lng, p.lat, p.lng);
            return Object.assign({}, p, { distance_km: Math.round(d) });
        }).filter(function (p) { return p.distance_km <= maxKm; })
          .sort(function (a, b) { return a.distance_km - b.distance_km; });
    }

    function haversineKm(lat1, lon1, lat2, lon2) {
        var R = 6371;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function loadPartnersOnMap(map, cb) {
        fetch('api/dgd/partners')
            .then(function (r) { if (!r.ok) throw new Error('API'); return r.json(); })
            .then(function (data) {
                var partners = data.partners || data || [];
                if (partners.length === 0) throw new Error('empty');
                var layer = addWizardPartnersToMap(map, partners);
                if (cb) cb(layer);
            })
            .catch(function () {
                var layer = addWizardPartnersToMap(map, DEMO_PARTNERS);
                if (cb) cb(layer);
            });
    }

    function addWizardPartnersToMap(map, partners) {
        var countEl = document.getElementById('gw-partner-count');
        if (countEl) countEl.textContent = partners.length + ' Gutachter deutschlandweit';

        var layer = L.featureGroup();
        partners.forEach(function (p) {
            if (!p.lat) return;
            var lng = p.lng || p.lon;
            if (!lng) return;

            var marker = L.marker([p.lat, lng], { icon: createSpecialtyIcon(p.specialty) });
            marker.bindPopup(createPartnerPopup(p), { maxWidth: 300, minWidth: 220 });
            marker._partnerSpecialty = p.specialty;
            marker._partnerId = p.id;
            layer.addLayer(marker);
        });
        layer.addTo(map);
        return layer;
    }

    function initResultsMap(mapEl) {
        var lat = wizardState.lat, lng = wizardState.lng, partners = wizardState.partners;

        var map = L.map(mapEl).setView([lat, lng], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18,
        }).addTo(map);

        // User location (blue circle)
        L.circleMarker([lat, lng], {
            radius: 10, fillColor: '#2980b9', color: '#1a3a5c',
            weight: 2, fillOpacity: 0.8,
        }).addTo(map).bindPopup('Ihr Standort');

        // Partner markers
        var allPoints = [[lat, lng]];
        partners.forEach(function (p) {
            if (!p.lat) return;
            var pLng = p.lng || p.lon;
            if (!pLng) return;

            var marker = L.marker([p.lat, pLng], { icon: createSpecialtyIcon(p.specialty) });
            marker.bindPopup(createPartnerPopup(p), { maxWidth: 300, minWidth: 220 });
            marker.on('click', function () { highlightPartnerCard(p.id); });
            marker.addTo(map);
            allPoints.push([p.lat, pLng]);
        });

        if (partners.length > 0) {
            map.fitBounds(allPoints, { padding: [30, 30] });
        }

        return map;
    }

    function renderWizardPartnerCards() {
        var grid = document.getElementById('gw-partner-grid');
        var noResults = document.getElementById('gw-no-results');
        var partners = wizardState.partners;

        if (!partners.length) {
            if (grid) grid.innerHTML = '';
            if (noResults) noResults.classList.remove('dgd-hidden');
            return;
        }
        if (noResults) noResults.classList.add('dgd-hidden');

        grid.innerHTML = partners.map(function (p) {
            var initials = escapeHtml(p.name).split(' ').map(function (n) { return n[0]; }).join('').substring(0, 2);
            var spec = SPECIALTY_LABELS[p.specialty] || p.specialty || 'Allgemein';
            return '<div class="dgd-partner-card" data-id="' + p.id + '">' +
                '<div class="dgd-partner-card__header">' +
                    '<div class="dgd-partner-card__avatar">' + initials + '</div>' +
                    '<div><h4 class="dgd-partner-card__name">' + escapeHtml(p.name) + '</h4>' +
                    '<p class="dgd-partner-card__company">' + escapeHtml(p.company || '') + '</p></div>' +
                '</div>' +
                '<div class="dgd-partner-card__meta">' +
                    '<span class="dgd-partner-card__distance">' + (p.distance_km || '?') + ' km</span>' +
                    '<span class="dgd-partner-card__rating">⭐ ' + p.rating + '</span>' +
                    '<span class="dgd-partner-card__specialty">' + escapeHtml(spec) + '</span>' +
                '</div>' +
                '<p class="dgd-partner-card__desc">' + escapeHtml(p.description || '') + '</p>' +
                '<div class="dgd-partner-card__footer">' +
                    '<span class="dgd-partner-card__location">' + escapeHtml(p.plz) + ' ' + escapeHtml(p.city) + '</span>' +
                    '<button class="dgd-btn dgd-btn--primary dgd-btn--sm" onclick="window._selectPartner(\'' + p.id + '\')">Auswählen</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    function highlightPartnerCard(id) {
        document.querySelectorAll('.dgd-partner-card--highlight').forEach(function (el) {
            el.classList.remove('dgd-partner-card--highlight');
        });
        var card = document.querySelector('.dgd-partner-card[data-id="' + id + '"]');
        if (card) {
            card.classList.add('dgd-partner-card--highlight');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function selectPartner(id) {
        var partner = wizardState.partners.find(function (p) { return p.id === id; }) ||
                      DEMO_PARTNERS.find(function (p) { return p.id === id; });
        if (!partner) return;
        wizardState.selectedPartner = partner;

        if (gutachterWizard) {
            gutachterWizard.goToStep(2);
        } else {
            setupPartnerBadge(partner);
            navigateTo('melden');
        }
    }
    window._selectPartner = selectPartner;

    function setupPartnerBadge(partner) {
        if (!partner) return;
        var nameEl = document.getElementById('partner-badge-name');
        var detailEl = document.getElementById('partner-badge-detail');
        var badgeEl = document.getElementById('selected-partner-badge');
        if (nameEl) nameEl.textContent = partner.name;
        if (detailEl) detailEl.textContent =
            (partner.company || '') + ' \u2022 ' + (partner.distance_km || '?') + ' km \u2022 \u2B50 ' + partner.rating;
        if (badgeEl) badgeEl.classList.remove('dgd-hidden');
    }

    function renderTestimonials() {
        var testimonials = [
            { text: 'Schnell, unkompliziert und kostenlos. Der Gutachter war am nächsten Tag da.', author: 'Michael K., Berlin', rating: 5 },
            { text: 'Dank DGD habe ich 3.200\u20AC mehr von der Versicherung bekommen.', author: 'Sandra W., München', rating: 5 },
            { text: 'Sehr professionell. Kann ich nur weiterempfehlen!', author: 'Thomas H., Hamburg', rating: 5 },
        ];
        return testimonials.map(function (t) {
            return '<div class="dgd-testimonial">' +
                '<div class="dgd-testimonial__stars">' + '\u2605'.repeat(t.rating) + '</div>' +
                '<p class="dgd-testimonial__text">\u201E' + escapeHtml(t.text) + '\u201C</p>' +
                '<p class="dgd-testimonial__author">\u2014 ' + escapeHtml(t.author) + '</p>' +
            '</div>';
        }).join('');
    }

    // =========================================================================
    // Partner-Warteliste
    // =========================================================================

    function initPartnerForm() {
        const form = document.getElementById('partner-form');
        if (!form) return;

        const specialtySelect = document.getElementById('partner-specialty');
        const otherWrap = document.getElementById('partner-other-wrap');

        // Show/hide "Sonstiges" field
        if (specialtySelect && otherWrap) {
            specialtySelect.addEventListener('change', () => {
                if (specialtySelect.value === 'sonstiges') {
                    otherWrap.style.display = '';
                } else {
                    otherWrap.style.display = 'none';
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const successEl = document.getElementById('partner-success');
            const errorEl = document.getElementById('partner-error');

            // Reset messages
            successEl.classList.add('dgd-hidden');
            errorEl.classList.add('dgd-hidden');

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="dgd-spinner"></span> Wird gesendet...';

                const data = {
                    name: document.getElementById('partner-name').value.trim(),
                    company: document.getElementById('partner-company').value.trim(),
                    email: document.getElementById('partner-email').value.trim(),
                    phone: document.getElementById('partner-phone').value.trim(),
                    specialty: document.getElementById('partner-specialty').value,
                    other_specialty: document.getElementById('partner-other-specialty').value.trim(),
                    plz: document.getElementById('partner-plz').value.trim(),
                    city: document.getElementById('partner-city').value.trim(),
                    experience_years: document.getElementById('partner-experience').value || null,
                    certifications: document.getElementById('partner-certifications').value.trim(),
                    message: document.getElementById('partner-message').value.trim(),
                };

                // Client-side validation
                if (!data.name || !data.email || !data.phone || !data.specialty || !data.plz || !data.city) {
                    errorEl.textContent = 'Bitte füllen Sie alle Pflichtfelder (*) aus.';
                    errorEl.classList.remove('dgd-hidden');
                    return;
                }

                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(data.email)) {
                    errorEl.textContent = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
                    errorEl.classList.remove('dgd-hidden');
                    return;
                }

                await dgdApi.joinWaitlist(data);

                // Success: hide form, show success message
                form.style.display = 'none';
                successEl.classList.remove('dgd-hidden');

            } catch (err) {
                errorEl.textContent = err.message || 'Fehler beim Senden. Bitte versuchen Sie es später erneut.';
                errorEl.classList.remove('dgd-hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // =========================================================================
    // Landing Map (GeoDirectory - Deutschland-Übersicht)
    // =========================================================================

    let landingMap = null;

    // Fallback partner data for when the API is unavailable
    const DEMO_PARTNERS = [
        { id: 'demo-1', name: 'Hans Müller', company: 'Müller Kfz-Gutachten', city: 'Berlin', plz: '10115', specialty: 'kfz', lat: 52.5200, lng: 13.4050, rating: 4.8, review_count: 127, description: 'Erfahrener Kfz-Sachverständiger mit über 15 Jahren Erfahrung. TÜV-zertifiziert.' },
        { id: 'demo-2', name: 'Peter Schmidt', company: 'Schmidt Gutachten Hamburg', city: 'Hamburg', plz: '20095', specialty: 'kfz', lat: 53.5511, lng: 9.9937, rating: 4.6, review_count: 89, description: 'Spezialist für Kfz-Schaden und Wertgutachten.' },
        { id: 'demo-3', name: 'Anna Weber', company: 'Weber Sachverständigenbüro', city: 'München', plz: '80331', specialty: 'kfz', lat: 48.1351, lng: 11.5820, rating: 4.9, review_count: 203, description: 'Top-bewertete Sachverständige in München.' },
        { id: 'demo-4', name: 'Klaus Fischer', company: 'Fischer Kfz-Gutachten', city: 'Köln', plz: '50667', specialty: 'kfz', lat: 50.9375, lng: 6.9603, rating: 4.7, review_count: 64, description: 'Kfz-Sachverständiger in Köln. IHK-zertifiziert.' },
        { id: 'demo-5', name: 'Sabine Braun', company: 'Braun Kfz-Sachverständige', city: 'Frankfurt', plz: '60311', specialty: 'kfz', lat: 50.1109, lng: 8.6821, rating: 4.5, review_count: 56, description: 'Unabhängige Kfz-Sachverständige im Rhein-Main-Gebiet.' },
        { id: 'demo-6', name: 'Thomas Wagner', company: 'Wagner Kfz-Gutachten Stuttgart', city: 'Stuttgart', plz: '70173', specialty: 'kfz', lat: 48.7758, lng: 9.1829, rating: 4.4, review_count: 38, description: 'Kfz-Sachverständiger in Stuttgart. DEKRA-zertifiziert.' },
        { id: 'demo-7', name: 'Maria Hofmann', company: 'Hofmann Automotive Experts', city: 'Düsseldorf', plz: '40213', specialty: 'kfz', lat: 51.2277, lng: 6.7735, rating: 4.8, review_count: 112, description: 'Kfz-Sachverständige, Schwerpunkt Oldtimer-Bewertung.' },
        { id: 'demo-8', name: 'Stefan Becker', company: 'Becker Kfz-Sachverständige', city: 'Leipzig', plz: '04109', specialty: 'kfz', lat: 51.3397, lng: 12.3731, rating: 4.3, review_count: 41, description: 'Kfz-Sachverständiger in Sachsen.' },
        { id: 'demo-9', name: 'Julia Richter', company: 'Richter Kfz-Gutachten Dresden', city: 'Dresden', plz: '01067', specialty: 'kfz', lat: 51.0504, lng: 13.7373, rating: 4.6, review_count: 73, description: 'Kfz-Sachverständige in Dresden. Spezialistin für Unfallgutachten.' },
        { id: 'demo-10', name: 'Michael Koch', company: 'Koch Kfz-Gutachten Hannover', city: 'Hannover', plz: '30159', specialty: 'kfz', lat: 52.3759, lng: 9.7320, rating: 4.2, review_count: 35, description: 'Kfz-Sachverständiger in Niedersachsen.' },
        { id: 'demo-11', name: 'Laura Schäfer', company: 'Schäfer Sachverständigenbüro', city: 'Nürnberg', plz: '90402', specialty: 'kfz', lat: 49.4521, lng: 11.0767, rating: 4.7, review_count: 91, description: 'Kfz-Sachverständige in Franken.' },
        { id: 'demo-12', name: 'Frank Zimmermann', company: 'Zimmermann Kfz-Gutachten', city: 'Dortmund', plz: '44135', specialty: 'kfz', lat: 51.5136, lng: 7.4653, rating: 4.5, review_count: 58, description: 'Kfz-Sachverständiger im Ruhrgebiet.' },
    ];

    const SPECIALTY_LABELS = {
        kfz: 'Kfz-Sachverständiger',
        gebaeude: 'Gebäude-Sachverständiger',
        hausrat: 'Hausrat-Sachverständiger',
        allgemein: 'Allgemeiner Gutachter',
    };

    const SPECIALTY_COLORS = {
        kfz: '#1a3a5c',
        gebaeude: '#e67e22',
        hausrat: '#8e44ad',
        allgemein: '#27ae60',
    };

    function createPartnerPopup(p) {
        var spec = SPECIALTY_LABELS[p.specialty] || p.specialty || 'Gutachter';
        var color = SPECIALTY_COLORS[p.specialty] || '#1a3a5c';
        var stars = '★'.repeat(Math.round(p.rating || 5)) + '☆'.repeat(5 - Math.round(p.rating || 5));
        return '<div class="dgd-map-popup">' +
            '<div class="dgd-map-popup__header">' +
                '<strong>' + escapeHtml(p.name) + '</strong>' +
                '<span class="dgd-map-popup__badge" style="background:' + color + '">' + escapeHtml(spec) + '</span>' +
            '</div>' +
            '<div class="dgd-map-popup__company">' + escapeHtml(p.company || '') + '</div>' +
            '<div class="dgd-map-popup__meta">' +
                '<span class="dgd-map-popup__stars">' + stars + '</span> ' +
                '<span>' + (p.rating || '5.0') + ' (' + (p.review_count || 0) + ' Bewertungen)</span>' +
            '</div>' +
            '<div class="dgd-map-popup__location">📍 ' + escapeHtml(p.plz + ' ' + p.city) + '</div>' +
            (p.description ? '<div class="dgd-map-popup__desc">' + escapeHtml(p.description) + '</div>' : '') +
            '<button class="dgd-btn dgd-btn--primary dgd-btn--sm dgd-map-popup__btn" onclick="window.location.hash=\'#melden\'">Schaden melden</button>' +
        '</div>';
    }

    function createSpecialtyIcon(specialty) {
        var color = SPECIALTY_COLORS[specialty] || '#1a3a5c';
        return L.divIcon({
            className: 'dgd-map-marker',
            html: '<div class="dgd-map-marker__pin" style="background:' + color + '"></div>',
            iconSize: [24, 32],
            iconAnchor: [12, 32],
            popupAnchor: [0, -28],
        });
    }

    function addPartnersToMap(map, partners) {
        var partnerCount = document.getElementById('landing-partner-count');
        if (partnerCount) {
            partnerCount.textContent = partners.length + ' Gutachter deutschlandweit';
        }

        partners.forEach(function(p) {
            if (!p.lat) return;
            var lng = p.lng || p.lon;
            if (!lng) return;

            L.marker([p.lat, lng], { icon: createSpecialtyIcon(p.specialty) })
                .addTo(map)
                .bindPopup(createPartnerPopup(p), { maxWidth: 300, minWidth: 220 });
        });
    }

    function initLandingMap() {
        var mapEl = document.getElementById('landing-map');
        if (!mapEl || landingMap) return;

        // Only init when visible
        if (mapEl.offsetParent === null) return;

        landingMap = L.map('landing-map', {
            scrollWheelZoom: false,
        }).setView([51.16, 10.45], 6);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18,
        }).addTo(landingMap);

        // Enable scroll zoom only after click on map
        landingMap.once('click', function() {
            landingMap.scrollWheelZoom.enable();
        });

        // Try API first, fallback to demo data
        fetch('api/dgd/partners')
            .then(function(r) {
                if (!r.ok) throw new Error('API error');
                return r.json();
            })
            .then(function(data) {
                var partners = data.partners || data || [];
                if (partners.length === 0) throw new Error('empty');
                addPartnersToMap(landingMap, partners);
            })
            .catch(function() {
                // API not available - use demo data
                addPartnersToMap(landingMap, DEMO_PARTNERS);
            });
    }

    // =========================================================================
    // Initialisierung
    // =========================================================================

    function initConstructionBanner() {
        const banner = document.getElementById('constructionBanner');
        const closeBtn = banner?.querySelector('.dgd-construction-banner__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => banner.classList.add('hidden'));
        }
    }

    function init() {
        initConstructionBanner();
        initReportForm();
        initPhotoUpload();
        initDescriptionHint();
        initStatusCheck();
        initMobileMenu();
        initPartnerForm();

        // Router starten
        window.addEventListener('hashchange', handleRoute);
        handleRoute();

        console.log('[DGD Portal] Anwendung initialisiert');
    }

    // DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
