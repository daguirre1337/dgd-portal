/**
 * DGD Portal - API Client
 * Kommunikation mit dem Backend fuer Schadenfall-Verwaltung
 */

const dgdApi = (() => {
    // Base URL - relativ zum aktuellen Host
    const BASE_URL = '/api/dgd';

    /**
     * Interner HTTP-Request-Helper
     */
    async function _request(method, path, body = null) {
        const url = `${BASE_URL}${path}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();

            if (!response.ok) {
                const error = new Error(data.error || `HTTP ${response.status}`);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (err) {
            if (err.status) {
                // Bereits als API-Fehler formatiert
                throw err;
            }
            // Netzwerk- oder Parsing-Fehler
            console.error(`[DGD API] Fehler bei ${method} ${url}:`, err);
            const error = new Error(
                'Verbindung zum Server fehlgeschlagen. Bitte versuchen Sie es spaeter erneut.'
            );
            error.status = 0;
            error.isNetworkError = true;
            throw error;
        }
    }

    return {
        /**
         * Neuen Schadenfall erstellen
         * @param {Object} data - Schadenfall-Daten
         * @param {string} data.customer_name - Name des Kunden
         * @param {string} data.email - E-Mail-Adresse
         * @param {string} data.phone - Telefonnummer
         * @param {string} data.damage_type - Schadensart
         * @param {string} data.description - Beschreibung des Schadens
         * @param {string} data.location - Ort des Schadens
         * @returns {Promise<Object>} Erstellter Schadenfall
         */
        async createCase(data) {
            return _request('POST', '/cases', data);
        },

        /**
         * Einzelnen Schadenfall abrufen
         * @param {string} id - Fall-ID
         * @returns {Promise<Object>} Schadenfall-Details
         */
        async getCase(id) {
            return _request('GET', `/cases/${encodeURIComponent(id)}`);
        },

        /**
         * Alle Schadenfaelle auflisten
         * @returns {Promise<Object>} Liste der Schadenfaelle
         */
        async getCases() {
            return _request('GET', '/cases');
        },

        /**
         * Status eines Schadenfalls abrufen
         * @param {string} id - Fall-ID
         * @returns {Promise<Object>} Status-Informationen
         */
        async getCaseStatus(id) {
            return _request('GET', `/cases/${encodeURIComponent(id)}/status`);
        },

        /**
         * Alle Partner/Gutachter auflisten
         * @param {Object} params - Optionale Filter-Parameter
         * @returns {Promise<Object>} Liste der Partner
         */
        async getPartners(params = {}) {
            const qs = new URLSearchParams(params).toString();
            return _request('GET', `/partners${qs ? '?' + qs : ''}`);
        },

        /**
         * Gutachter in der Naehe suchen
         * @param {number} lat - Breitengrad
         * @param {number} lng - Laengengrad
         * @param {number} radiusKm - Suchradius in km (default 50)
         * @param {string} specialty - Optionale Spezialisierung
         * @returns {Promise<Object>} Nahe Partner
         */
        async getNearbyPartners(lat, lng, radiusKm = 50, specialty = '') {
            const params = new URLSearchParams({ lat, lng, radius_km: radiusKm });
            if (specialty) params.set('specialty', specialty);
            return _request('GET', `/partners/nearby?${params}`);
        },

        /**
         * Einzelnen Partner/Gutachter abrufen
         * @param {string} id - Partner-ID
         * @returns {Promise<Object>} Partner-Details
         */
        async getPartner(id) {
            return _request('GET', `/partners/${encodeURIComponent(id)}`);
        },

        /**
         * Geocoding - Ort/PLZ zu Koordinaten (Server-Proxy)
         * @param {string} query - Suchbegriff (PLZ oder Ortsname)
         * @returns {Promise<Object>} Geocoding-Ergebnis
         */
        async geocode(query) {
            return _request('GET', `/geocode?q=${encodeURIComponent(query)}`);
        },

        /**
         * Reverse Geocoding - Koordinaten zu Ortsname (Server-Proxy)
         * @param {number} lat - Breitengrad
         * @param {number} lng - Laengengrad
         * @returns {Promise<Object>} Reverse-Geocoding-Ergebnis
         */
        async reverseGeocode(lat, lng) {
            return _request('GET', `/geocode/reverse?lat=${lat}&lng=${lng}`);
        },

        /**
         * Partner auf die Warteliste setzen
         * @param {Object} data - Partner-Daten
         * @returns {Promise<Object>} Ergebnis
         */
        async joinWaitlist(data) {
            return _request('POST', '/waitlist', data);
        },

        /**
         * Rente-Empfehlungspartner registrieren
         * @param {Object} data - Partner-Daten
         * @returns {Promise<Object>} Ergebnis
         */
        async joinRenteProgram(data) {
            return _request('POST', '/rente', data);
        },

        /**
         * Dokument zu einem Schadenfall hochladen
         * @param {string} caseId - Fall-ID
         * @param {File} file - Datei zum Hochladen
         * @returns {Promise<Object>} Upload-Ergebnis
         */
        async uploadDocument(caseId, file) {
            const url = `${BASE_URL}/cases/${encodeURIComponent(caseId)}/upload`;
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    body: formData,
                    // Kein Content-Type Header - wird automatisch mit Boundary gesetzt
                });
                const data = await response.json();

                if (!response.ok) {
                    const error = new Error(data.error || `HTTP ${response.status}`);
                    error.status = response.status;
                    error.data = data;
                    throw error;
                }

                return data;
            } catch (err) {
                if (err.status) throw err;
                console.error('[DGD API] Upload-Fehler:', err);
                const error = new Error('Datei-Upload fehlgeschlagen.');
                error.status = 0;
                error.isNetworkError = true;
                throw error;
            }
        },
    };
})();
