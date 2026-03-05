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
        '#gutachter-ergebnis': 'wizard-results',
        '#melden': 'report-form',
        '#status': 'status-check',
        '#partner': 'partner',
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
                    `Wir melden uns in Kuerze bei Ihnen.`
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

        // Vorherige Fehler zuruecksetzen
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
                    if (errorEl) errorEl.textContent = 'Bitte geben Sie eine gueltige E-Mail-Adresse ein.';
                }
            }
        }

        return valid;
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

        // Vor dem Formular einfuegen
        const form = document.getElementById('report-form');
        if (form) {
            form.parentNode.insertBefore(alertDiv, form);
        } else {
            // Fallback: In den aktiven View einfuegen
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

        // Menue schliessen bei Klick auf Link
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('dgd-header__nav--open');
                toggle.textContent = '\u2630';
                toggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // =========================================================================
    // Wizard: Gutachter finden
    // =========================================================================

    function initWizard() {
        // Search button
        const searchBtn = document.getElementById('wizard-search-btn');
        const locationInput = document.getElementById('wizard-location');
        const errorEl = document.getElementById('wizard-location-error');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = locationInput.value.trim();
                if (!query) {
                    errorEl.classList.remove('dgd-hidden');
                    return;
                }
                errorEl.classList.add('dgd-hidden');
                geocodeAndSearch(query);
            });
        }

        // Enter key on location input
        if (locationInput) {
            locationInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchBtn.click();
                }
            });
        }

        // GPS button
        const gpsBtn = document.getElementById('wizard-gps-btn');
        if (gpsBtn) {
            gpsBtn.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    errorEl.textContent = 'Geolocation wird von Ihrem Browser nicht unterstuetzt.';
                    errorEl.classList.remove('dgd-hidden');
                    return;
                }
                errorEl.classList.add('dgd-hidden');
                gpsBtn.disabled = true;
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        wizardState.lat = pos.coords.latitude;
                        wizardState.lng = pos.coords.longitude;
                        // Reverse geocode to get city name via backend proxy
                        try {
                            const data = await dgdApi.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
                            wizardState.locationName = data.name || 'Ihr Standort';
                            locationInput.value = wizardState.locationName;
                        } catch {
                            wizardState.locationName = 'Ihr Standort';
                        }
                        gpsBtn.disabled = false;
                        searchPartners();
                    },
                    (err) => {
                        gpsBtn.disabled = false;
                        errorEl.textContent = 'Standort konnte nicht ermittelt werden. Bitte geben Sie einen Ort manuell ein.';
                        errorEl.classList.remove('dgd-hidden');
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });
        }

        // Pill filter buttons
        document.querySelectorAll('.dgd-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.dgd-pill').forEach(p => p.classList.remove('dgd-pill--active'));
                pill.classList.add('dgd-pill--active');
                wizardState.specialty = pill.dataset.specialty || '';
                if (wizardState.lat && wizardState.lng) {
                    searchPartners();
                }
            });
        });

        // Back button
        const backBtn = document.getElementById('wizard-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                navigateTo('gutachter');
            });
        }

        // Partner badge remove button
        const badgeRemove = document.getElementById('partner-badge-remove');
        if (badgeRemove) {
            badgeRemove.addEventListener('click', () => {
                wizardState.selectedPartner = null;
                document.getElementById('selected-partner-badge').classList.add('dgd-hidden');
            });
        }
    }

    async function geocodeAndSearch(query) {
        const errorEl = document.getElementById('wizard-location-error');
        const searchBtn = document.getElementById('wizard-search-btn');

        try {
            searchBtn.disabled = true;
            searchBtn.innerHTML = '<span class="dgd-spinner" style="width:18px;height:18px;border-width:2px;"></span>';

            const result = await dgdApi.geocode(query);

            if (!result.results || result.results.length === 0) {
                errorEl.textContent = 'Standort konnte nicht gefunden werden. Bitte versuchen Sie eine andere Eingabe.';
                errorEl.classList.remove('dgd-hidden');
                return;
            }

            const place = result.results[0];
            wizardState.lat = parseFloat(place.lat);
            wizardState.lng = parseFloat(place.lon || place.lng);
            wizardState.locationName = place.display_name || place.name || query;

            errorEl.classList.add('dgd-hidden');
            await searchPartners();
        } catch (err) {
            errorEl.textContent = 'Fehler bei der Standortsuche. Bitte versuchen Sie es erneut.';
            errorEl.classList.remove('dgd-hidden');
        } finally {
            searchBtn.disabled = false;
            searchBtn.textContent = 'Suchen';
        }
    }

    async function searchPartners() {
        const { lat, lng, specialty } = wizardState;
        try {
            const result = await dgdApi.getNearbyPartners(lat, lng, 50, specialty);
            wizardState.partners = result.partners || [];
        } catch {
            // API not available yet - use empty array
            wizardState.partners = [];
        }
        navigateTo('gutachter-ergebnis');
        // Wait for view to show, then init map
        setTimeout(() => {
            initMap();
            renderPartnerCards();
        }, 100);
    }

    function initMap() {
        const mapEl = document.getElementById('wizard-map');
        if (!mapEl) return;

        // Destroy existing map if any
        if (wizardState.map) {
            wizardState.map.remove();
            wizardState.map = null;
        }

        const { lat, lng, partners } = wizardState;
        const map = L.map('wizard-map').setView([lat, lng], 11);

        // Fix Leaflet default icon path (CDN bug)
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'lib/leaflet/images/marker-icon-2x.png',
            iconUrl: 'lib/leaflet/images/marker-icon.png',
            shadowUrl: 'lib/leaflet/images/marker-shadow.png',
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18,
        }).addTo(map);

        // User marker (blue circle)
        L.circleMarker([lat, lng], {
            radius: 10, fillColor: '#2980b9', color: '#1a3a5c',
            weight: 2, fillOpacity: 0.8
        }).addTo(map).bindPopup('Ihr Standort');

        // Partner markers
        const markers = L.featureGroup();
        partners.forEach(p => {
            const marker = L.marker([p.lat, p.lng])
                .bindPopup(`<b>${escapeHtml(p.name)}</b><br>${p.company || ''}<br>${p.distance_km} km &bull; &#11088; ${p.rating}`);
            marker.on('click', () => highlightPartnerCard(p.id));
            markers.addLayer(marker);
        });
        markers.addTo(map);

        // Fit bounds to show all markers + user
        if (partners.length > 0) {
            const allPoints = [[lat, lng], ...partners.map(p => [p.lat, p.lng])];
            map.fitBounds(allPoints, { padding: [30, 30] });
        }

        wizardState.map = map;
        wizardState.markers = markers;

        // Update header info
        document.getElementById('wizard-location-label').textContent = wizardState.locationName;
        document.getElementById('wizard-results-count').textContent = `${partners.length} Kfz-Gutachter gefunden`;
    }

    function renderPartnerCards() {
        const grid = document.getElementById('wizard-partner-grid');
        const noResults = document.getElementById('wizard-no-results');
        const { partners } = wizardState;

        if (!partners.length) {
            grid.innerHTML = '';
            noResults.classList.remove('dgd-hidden');
            return;
        }
        noResults.classList.add('dgd-hidden');

        grid.innerHTML = partners.map(p => `
            <div class="dgd-partner-card" data-id="${p.id}">
                <div class="dgd-partner-card__header">
                    <div class="dgd-partner-card__avatar">
                        ${escapeHtml(p.name).split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                        <h4 class="dgd-partner-card__name">${escapeHtml(p.name)}</h4>
                        <p class="dgd-partner-card__company">${escapeHtml(p.company || '')}</p>
                    </div>
                </div>
                <div class="dgd-partner-card__meta">
                    <span class="dgd-partner-card__distance">${p.distance_km} km</span>
                    <span class="dgd-partner-card__rating">&#11088; ${p.rating}</span>
                    <span class="dgd-partner-card__specialty">${escapeHtml(p.specialty || 'Allgemein')}</span>
                </div>
                <p class="dgd-partner-card__desc">${escapeHtml(p.description || '')}</p>
                <div class="dgd-partner-card__footer">
                    <span class="dgd-partner-card__location">${escapeHtml(p.plz)} ${escapeHtml(p.city)}</span>
                    <button class="dgd-btn dgd-btn--primary dgd-btn--sm" onclick="window._selectPartner('${p.id}')">
                        Waehlen
                    </button>
                </div>
            </div>
        `).join('');
    }

    function highlightPartnerCard(id) {
        // Remove previous highlights
        document.querySelectorAll('.dgd-partner-card--highlight').forEach(el => {
            el.classList.remove('dgd-partner-card--highlight');
        });
        const card = document.querySelector(`.dgd-partner-card[data-id="${id}"]`);
        if (card) {
            card.classList.add('dgd-partner-card--highlight');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function selectPartner(id) {
        const partner = wizardState.partners.find(p => p.id === id);
        if (!partner) return;
        wizardState.selectedPartner = partner;

        // Show partner badge in form
        document.getElementById('partner-badge-name').textContent = partner.name;
        document.getElementById('partner-badge-detail').textContent =
            `${partner.company || ''} \u2022 ${partner.distance_km} km \u2022 \u2B50 ${partner.rating}`;
        document.getElementById('selected-partner-badge').classList.remove('dgd-hidden');

        navigateTo('melden');
    }
    window._selectPartner = selectPartner;

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
                    errorEl.textContent = 'Bitte fuellen Sie alle Pflichtfelder (*) aus.';
                    errorEl.classList.remove('dgd-hidden');
                    return;
                }

                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(data.email)) {
                    errorEl.textContent = 'Bitte geben Sie eine gueltige E-Mail-Adresse ein.';
                    errorEl.classList.remove('dgd-hidden');
                    return;
                }

                await dgdApi.joinWaitlist(data);

                // Success: hide form, show success message
                form.style.display = 'none';
                successEl.classList.remove('dgd-hidden');

            } catch (err) {
                errorEl.textContent = err.message || 'Fehler beim Senden. Bitte versuchen Sie es spaeter erneut.';
                errorEl.classList.remove('dgd-hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // =========================================================================
    // Initialisierung
    // =========================================================================

    function init() {
        initReportForm();
        initStatusCheck();
        initMobileMenu();
        initWizard();
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
