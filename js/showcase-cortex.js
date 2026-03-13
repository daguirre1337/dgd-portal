/**
 * Showcase Builder - Cortex AI Integration
 * Generates compelling slide texts via SSE streaming
 */

const ShowcaseCortex = (() => {
    'use strict';

    const CORTEX_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:8000'
        : '';

    /**
     * Generate slide texts for all 6 slides
     * @param {string} appName
     * @param {string} features - Comma-separated feature list
     * @param {number} slideCount
     * @returns {Promise<Array<{headline: string, subline: string}>>}
     */
    async function generateSlideTexts(appName, features, slideCount = 6) {
        const prompt = `[ShowcaseBuilder] Du bist ein App-Store-Marketing-Experte. Generiere genau ${slideCount} Slide-Texte fuer die App "${appName}".

Features: ${features}

WICHTIG: Antworte NUR mit einem JSON-Array. Kein Markdown, kein Erklaerungstext.
Format:
[
  {"headline": "Kurzer, praegnanter Titel (max 5 Worte)", "subline": "Erklaerung in einem Satz"},
  ...
]

Regeln:
- Slide 1: Hero/Hauptaussage der App
- Slide 2-4: Einzelne Features hervorheben
- Slide 5: Social Proof / Vertrauen
- Slide 6: Call to Action
- Deutsch, professionell, kurz und praegnant
- Headlines: max 5 Worte, kraftvoll
- Sublines: max 12 Worte, erklaerend`;

        try {
            const response = await fetch(`${CORTEX_BASE}/api/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: prompt,
                    role: 'techie',
                    source: 'showcase_builder',
                    history: [],
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Read SSE stream and collect full response
            const fullText = await _readSSEStream(response);

            // Parse JSON from response (may be wrapped in markdown code block)
            return _parseSlideTexts(fullText, slideCount);
        } catch (err) {
            console.warn('[ShowcaseCortex] Generation failed:', err.message);
            return _fallbackTexts(appName, slideCount);
        }
    }

    /**
     * Improve a single text
     * @param {string} currentText
     * @param {string} context - e.g. "headline" or "subline"
     * @returns {Promise<string>}
     */
    async function improveText(currentText, context) {
        const prompt = `[ShowcaseBuilder] Verbessere diesen App-Store-${context}:
"${currentText}"

Antworte NUR mit dem verbesserten Text, ohne Anfuehrungszeichen oder Erklaerung. Max 8 Worte fuer Headlines, max 15 Worte fuer Sublines.`;

        try {
            const response = await fetch(`${CORTEX_BASE}/api/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: prompt,
                    role: 'techie',
                    source: 'showcase_builder',
                    history: [],
                }),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await _readSSEStream(response);
            return text.replace(/^["']|["']$/g, '').trim() || currentText;
        } catch {
            return currentText;
        }
    }

    /**
     * Check if Cortex is available
     */
    async function isAvailable() {
        try {
            const res = await fetch(`${CORTEX_BASE}/api/health`, { method: 'GET' });
            return res.ok;
        } catch {
            return false;
        }
    }

    // ---- Internal helpers ----

    async function _readSSEStream(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.token) {
                            fullText += data.token;
                        } else if (data.text) {
                            fullText += data.text;
                        } else if (data.response) {
                            fullText = data.response;
                        }
                    } catch {
                        // Non-JSON SSE data, append raw
                        const raw = line.slice(6).trim();
                        if (raw && raw !== '[DONE]') {
                            fullText += raw;
                        }
                    }
                }
            }
        }

        return fullText.trim();
    }

    function _parseSlideTexts(text, count) {
        // Try to extract JSON array from response
        let jsonStr = text;

        // Strip markdown code fences
        const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        // Find array brackets
        const arrStart = jsonStr.indexOf('[');
        const arrEnd = jsonStr.lastIndexOf(']');
        if (arrStart !== -1 && arrEnd !== -1) {
            jsonStr = jsonStr.slice(arrStart, arrEnd + 1);
        }

        try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Pad to count if needed
                while (parsed.length < count) {
                    parsed.push({ headline: 'Feature', subline: 'Beschreibung hier' });
                }
                return parsed.slice(0, count);
            }
        } catch (e) {
            console.warn('[ShowcaseCortex] JSON parse failed:', e.message);
        }

        // Fallback
        return _fallbackTexts('App', count);
    }

    function _fallbackTexts(appName, count) {
        const defaults = [
            { headline: appName, subline: 'Die smarte Loesung fuer Sie' },
            { headline: 'Einfach & Schnell', subline: 'In wenigen Sekunden zum Ergebnis' },
            { headline: 'Alles auf einen Blick', subline: 'Uebersichtlich und intuitiv' },
            { headline: '100% Sicher', subline: 'Ihre Daten sind geschuetzt' },
            { headline: 'Tausende vertrauen uns', subline: 'Ueber 500 zufriedene Partner' },
            { headline: 'Jetzt starten', subline: 'Kostenlos herunterladen' },
        ];
        return defaults.slice(0, count);
    }

    return {
        generateSlideTexts,
        improveText,
        isAvailable,
    };
})();
