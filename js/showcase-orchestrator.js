/**
 * Showcase Builder 2.0 - One-Click Orchestrator
 * Coordinates the full automated showcase generation pipeline:
 *   Brief -> Panorama -> Texts -> Compose
 *
 * Dependencies: ShowcaseBuilder, ShowcaseCortex, ShowcaseTemplates,
 *               ShowcasePanorama, ShowcaseDevices
 */

const ShowcaseOrchestrator = (() => {
    'use strict';

    // =========================================================================
    // Constants
    // =========================================================================

    const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
    const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
    const OPENAI_MODEL = 'gpt-4o';
    const DALLE_MODEL = 'dall-e-3';
    const DALLE_SIZE = '1792x1024';
    const STORAGE_KEY = 'showcase_openai_key';

    const STATES = {
        IDLE: 'idle',
        BRIEFING: 'briefing',
        GENERATING_PANORAMA: 'generating_panorama',
        GENERATING_TEXTS: 'generating_texts',
        COMPOSING: 'composing',
        DONE: 'done',
        ERROR: 'error',
    };

    // =========================================================================
    // State
    // =========================================================================

    let _state = STATES.IDLE;
    let _progressCallbacks = [];
    let _lastPanoramaPrompt = ''; // Track last DALL-E prompt for iterative refinement

    // =========================================================================
    // Progress system
    // =========================================================================

    function onProgress(callback) {
        if (typeof callback === 'function') {
            _progressCallbacks.push(callback);
        }
    }

    function _emitProgress(state, step, totalSteps, message) {
        _state = state;
        const percent = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;
        const event = { state, step, totalSteps, message, percent };
        for (const cb of _progressCallbacks) {
            try {
                cb(event);
            } catch (e) {
                console.warn('[Orchestrator] Progress callback error:', e);
            }
        }
    }

    // =========================================================================
    // API Key Management
    // =========================================================================

    // Injected key from .env (set by preview page or server-side rendering)
    let _envApiKey = '';

    function setEnvApiKey(key) {
        _envApiKey = key || '';
    }

    function setApiKey(key) {
        try {
            localStorage.setItem(STORAGE_KEY, key || '');
        } catch (e) {
            console.warn('[Orchestrator] Could not store API key:', e);
        }
    }

    function getApiKey() {
        // Priority: localStorage > .env injected > empty
        try {
            return localStorage.getItem(STORAGE_KEY) || _envApiKey || '';
        } catch (e) {
            return _envApiKey || '';
        }
    }

    function hasApiKey() {
        return getApiKey().length > 0;
    }

    // =========================================================================
    // OpenAI Helper
    // =========================================================================

    /**
     * Centralized OpenAI API call with error handling.
     * @param {Array} messages - Chat messages array
     * @param {Object} options - { model, max_tokens, temperature, response_format }
     * @returns {Promise<Object>} Parsed response content
     */
    async function _callOpenAI(messages, options = {}) {
        const apiKey = options.apiKey || getApiKey();
        if (!apiKey) {
            throw new Error('No OpenAI API key configured');
        }

        const model = options.model || OPENAI_MODEL;
        const max_tokens = options.max_tokens || 2048;
        const temperature = options.temperature ?? 0.7;

        const body = {
            model,
            messages,
            max_tokens,
            temperature,
        };

        if (options.response_format) {
            body.response_format = options.response_format;
        }

        const response = await fetch(OPENAI_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            throw new Error(`OpenAI API error ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Try to parse as JSON, return raw string if that fails
        try {
            return JSON.parse(content);
        } catch {
            // Attempt to extract JSON from markdown code blocks
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[1].trim());
                } catch {
                    // fall through
                }
            }
            return content;
        }
    }

    // =========================================================================
    // DGD Brand Profile (Single Source of Truth)
    // =========================================================================

    const DGD_BRAND = {
        company: {
            fullName: 'DGD Deutscher Gutachter Dienst GmbH',
            shortName: 'DGD Direkt',
            industry: 'Kfz-Schadenmanagement & Gutachten',
            tagline: 'Freiheit für Alle.',
            mission: 'Mit DGD Direkt bauen wir das weltweit erste digitale Netzwerk für Gutachten.',
            description: 'DGD Direkt ist die digitale Plattform der DGD Deutscher Gutachter Dienst GmbH für Kfz-Schadenmanagement und Gutachten.',
            targetAudience: ['Kfz-Betriebe', 'Kfz-Sachverständige', 'Flotten- & Leasinggesellschaften', 'Geschädigte Privatpersonen', 'Kanzleien / Verkehrsrechtsanwälte'],
            usps: [
                'Unabhängige Plattform ohne Versicherer als Anteilseigner.',
                'Digitale Schadenaufnahme vor Ort mit zentraler Qualitätssicherung.',
                'API-first und KI-gestützte Prozessplattform.',
            ],
        },
        branding: {
            primaryColor: '#184E74',
            secondaryColor: '#1B1B1B',
            accentColor: '#CAA876',
            backgroundColor: '#F0F0F0',
            textColor: '#1B1B1B',
            gradientFrom: '#184E74',
            gradientTo: '#CAA876',
            fonts: ['SF Pro Display', 'Roboto'],
        },
        app: {
            name: 'DGD Direkt',
            subtitle: 'Für Kfz-Profis',
            features: [
                'Digitale Schadenaufnahme für Haftpflichtschäden',
                'Kundensignatur und Abtretungserklärung direkt auf dem Gerät',
                'Vollständige Falldatenerfassung mit Pflichtfeldern',
                'Foto- und Mediendokumentation des Fahrzeugschadens',
                'Adressdaten speichern und per Karte auswählen',
                'Fahrzeugbewertungen und Test-/Echtaufträge',
            ],
            headlines: [
                'Haftpflichtschäden digital aufnehmen',
                'Kundensignatur direkt im Prozess',
                'Pflichtfelder statt Rückfragen',
                'Bilder hochladen. DGD prüft weiter.',
                'Mehr als nur Haftpflicht',
                'Weniger Büro. Mehr Wirkung.',
            ],
            sublines: [
                'Erfasse den Schaden direkt im Betrieb oder vor Ort mit der DGD Direkt App.',
                'Die Abtretungserklärung wird direkt auf dem Gerät unterschrieben.',
                'Besichtigungsort, Fahrzeugdaten und Schadeninfos werden strukturiert dokumentiert.',
                'Fotos und Falldaten gehen direkt an DGD zur Prüfung weiter.',
                'Zusätzlich Fahrzeugbewertungen und WertCheck-Leistungen möglich.',
                'DGD übernimmt Vollständigkeitscheck, Nachforderungen und Statuskommunikation.',
            ],
        },
        visual: {
            mood: 'professionell, vertrauenswürdig, modern, präzise',
            dallePromptHint: 'Photorealistischer Hintergrund für eine deutsche Marke im digitalen Kfz-Schadenmanagement: modernes Unfallfahrzeug in sauberer Werkstatt oder am Vor-Ort-Termin, Tablet oder Smartphone zur digitalen Schadenaufnahme sichtbar, dezente UI-Overlays, hochwertige Lichtstimmung, seriös und vertrauenswürdig, Farben aus dem Corporate Design mit Blau #184E74, Schwarz #1B1B1B, Beige #CAA876 und hellen Flächen #F0F0F0, keine Cartoon-Optik, keine überladene Stockfoto-Ästhetik.',
        },
    };

    // =========================================================================
    // Default Fallbacks (using DGD Brand Profile)
    // =========================================================================

    function _defaultBrief(appName, features) {
        const featureList = (features || '').split(',').map(f => f.trim()).filter(Boolean);
        const safeFeatures = featureList.length > 0
            ? featureList
            : DGD_BRAND.app.features.slice(0, 3);

        return {
            mood: DGD_BRAND.visual.mood,
            primaryColor: DGD_BRAND.branding.primaryColor,
            accentColor: DGD_BRAND.branding.accentColor,
            backgroundMood: DGD_BRAND.visual.dallePromptHint,
            features: safeFeatures,
            slides: DGD_BRAND.app.headlines.map((headline, i) => ({
                headline,
                subline: DGD_BRAND.app.sublines[i] || '',
                template: ['hero', 'feature', 'split', 'fullscreen', 'feature', 'comparison'][i],
            })),
        };
    }

    function _defaultSlideTexts(appName, features, slideCount) {
        return DGD_BRAND.app.headlines.slice(0, slideCount).map((headline, i) => ({
            headline,
            subline: DGD_BRAND.app.sublines[i] || '',
        }));
    }

    // =========================================================================
    // 1. Generate Brief
    // =========================================================================

    /**
     * Generate a design brief via OpenAI GPT-4o-mini.
     * Falls back to sensible defaults if no API key or on error.
     */
    async function generateBrief(appName, features) {
        if (!hasApiKey()) {
            console.info('[Orchestrator] No API key, using default brief');
            return _defaultBrief(appName, features);
        }

        try {
            const messages = [
                {
                    role: 'system',
                    content: `Du bist ein Design-Experte für DGD Direkt (Deutscher Gutachter Dienst GmbH).
DGD bietet digitales Kfz-Schadenmanagement: Schadenaufnahme, Gutachten, Qualitätssicherung.
Zielgruppe: ${DGD_BRAND.company.targetAudience.join(', ')}
Markenfarben: Blau ${DGD_BRAND.branding.primaryColor}, Beige/Gold ${DGD_BRAND.branding.accentColor}, Schwarz ${DGD_BRAND.branding.secondaryColor}
Claim: "${DGD_BRAND.company.tagline}"
USPs: ${DGD_BRAND.company.usps.join(' | ')}
App-Features: ${DGD_BRAND.app.features.join(', ')}

Antworte NUR mit validem JSON:
{
  "mood": "string",
  "primaryColor": "${DGD_BRAND.branding.primaryColor}",
  "accentColor": "${DGD_BRAND.branding.accentColor}",
  "backgroundMood": "string - Bildbeschreibung passend zu Kfz-Schadenmanagement",
  "features": ["feature1", "feature2", ...],
  "slides": [
    {"headline": "max 5 Wörter", "subline": "max 12 Wörter", "template": "hero|feature|split|fullscreen|comparison"},
    ...
  ]
}
Genau 6 Slides. Sprache: Deutsch. Farben: ${DGD_BRAND.branding.primaryColor} und ${DGD_BRAND.branding.accentColor}.`,
                },
                {
                    role: 'user',
                    content: `Create a design brief for the app "${appName || 'My App'}".
Features: ${features || 'General purpose app'}
Generate 6 slide concepts with compelling German headlines and sublines.`,
                },
            ];

            const result = await _callOpenAI(messages, {
                temperature: 0.8,
                response_format: { type: 'json_object' },
            });

            // Validate the result has required fields
            if (result && result.mood && result.slides && Array.isArray(result.slides)) {
                return result;
            }

            console.warn('[Orchestrator] Brief response missing required fields, using defaults');
            return _defaultBrief(appName, features);
        } catch (err) {
            console.warn('[Orchestrator] Brief generation failed, using defaults:', err.message);
            return _defaultBrief(appName, features);
        }
    }

    // =========================================================================
    // 2. Generate Panorama Image (DALL-E 3)
    // =========================================================================

    // Panorama target size: 6 slides × 1080×1920
    const PANO_W = 6480;
    const PANO_H = 1920;

    /**
     * Generate a panorama background via DALL-E 3.
     * DALL-E max is 1792×1024, so we scale it up to 6480×1920 canvas
     * and optionally blend with procedural layers for richness.
     * Falls back to procedural ShowcasePanorama.generate() on failure.
     * @returns {HTMLCanvasElement} 6480×1920 panorama canvas
     */
    async function generatePanoramaImage(brief) {
        if (!hasApiKey()) {
            console.info('[Orchestrator] No API key, falling back to procedural panorama');
            return _proceduralPanoramaFallback(brief);
        }

        const apiKey = getApiKey();
        const moodDesc = brief.backgroundMood || DGD_BRAND.visual.dallePromptHint;
        const prompt = `${moodDesc}. Ultra-wide seamless panoramic composition, no text, no UI elements, no logos, no words, continuous scene that can be divided into 6 equal vertical panels. High quality, detailed.`;
        _lastPanoramaPrompt = moodDesc;
        console.log('[Orchestrator] DALL-E prompt mood:', moodDesc);

        // Retry up to 3 times (DALL-E sometimes returns 500)
        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[Orchestrator] Requesting DALL-E panorama (attempt ${attempt}/${MAX_RETRIES})...`);

                const response = await fetch(OPENAI_IMAGES_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: DALLE_MODEL,
                        prompt,
                        n: 1,
                        size: DALLE_SIZE,
                        quality: 'hd',
                        response_format: 'b64_json',
                    }),
                });

                if (!response.ok) {
                    const errBody = await response.text().catch(() => '');
                    const status = response.status;
                    // Retry on 500/502/503/429
                    if ((status >= 500 || status === 429) && attempt < MAX_RETRIES) {
                        const wait = attempt * 2000; // 2s, 4s
                        console.warn(`[Orchestrator] DALL-E ${status}, retrying in ${wait}ms...`);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }
                    throw new Error(`DALL-E API error ${status}: ${errBody.slice(0, 200)}`);
                }

                const data = await response.json();
                const b64 = data.data?.[0]?.b64_json;

                if (!b64) {
                    throw new Error('No b64_json in DALL-E response');
                }

                const dalleImg = await _loadImage('data:image/png;base64,' + b64);
                console.log(`[Orchestrator] DALL-E image loaded: ${dalleImg.naturalWidth}x${dalleImg.naturalHeight}`);

                const panoCanvas = _scaleToPanorama(dalleImg, brief);
                console.log(`[Orchestrator] Panorama canvas ready: ${panoCanvas.width}x${panoCanvas.height}`);

                return panoCanvas;
            } catch (err) {
                if (attempt < MAX_RETRIES) {
                    console.warn(`[Orchestrator] DALL-E attempt ${attempt} failed: ${err.message}, retrying...`);
                    await new Promise(r => setTimeout(r, attempt * 2000));
                    continue;
                }
                console.warn('[Orchestrator] DALL-E generation failed after retries, falling back to procedural:', err.message);
                return _proceduralPanoramaFallback(brief);
            }
        }

        return _proceduralPanoramaFallback(brief);
    }

    /**
     * Scale a DALL-E image (1792×1024) to the full 6480×1920 panorama canvas.
     * Uses cover-fit scaling so the entire canvas is filled, then adds
     * subtle procedural overlays for depth and brand consistency.
     * @param {HTMLImageElement} img - The DALL-E source image
     * @param {Object} brief - Design brief with colors
     * @returns {HTMLCanvasElement} 6480×1920 panorama
     */
    function _scaleToPanorama(img, brief) {
        const canvas = document.createElement('canvas');
        canvas.width = PANO_W;
        canvas.height = PANO_H;
        const ctx = canvas.getContext('2d');

        // Cover-fit: scale image to fill entire panorama (may crop top/bottom)
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        const scaleX = PANO_W / imgW;
        const scaleY = PANO_H / imgH;
        const scale = Math.max(scaleX, scaleY); // cover
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const offsetX = (PANO_W - drawW) / 2;
        const offsetY = (PANO_H - drawH) / 2;

        // Draw scaled DALL-E image as base
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

        // Add subtle brand-colored vignette overlay for consistency
        const primary = brief?.primaryColor || DGD_BRAND.branding.primaryColor;
        const accent = brief?.accentColor || DGD_BRAND.branding.accentColor;

        // Top gradient (brand blue, subtle)
        const topGrad = ctx.createLinearGradient(0, 0, 0, PANO_H * 0.25);
        topGrad.addColorStop(0, _hexToRgba(primary, 0.3));
        topGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, PANO_W, PANO_H * 0.25);

        // Bottom gradient (darker for text readability)
        const botGrad = ctx.createLinearGradient(0, PANO_H * 0.7, 0, PANO_H);
        botGrad.addColorStop(0, 'rgba(0,0,0,0)');
        botGrad.addColorStop(1, _hexToRgba(primary, 0.4));
        ctx.fillStyle = botGrad;
        ctx.fillRect(0, PANO_H * 0.7, PANO_W, PANO_H * 0.3);

        // Subtle edge vignette
        const vigGrad = ctx.createRadialGradient(
            PANO_W / 2, PANO_H / 2, PANO_W * 0.3,
            PANO_W / 2, PANO_H / 2, PANO_W * 0.55
        );
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, PANO_W, PANO_H);

        return canvas;
    }

    /**
     * Convert hex color to rgba string.
     */
    function _hexToRgba(hex, alpha) {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        const n = parseInt(hex, 16);
        return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
    }

    /**
     * Load an image URL into an HTMLImageElement.
     */
    function _loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image: ' + url));
            img.src = url;
        });
    }

    /**
     * Fallback to procedural panorama generation.
     */
    function _proceduralPanoramaFallback(brief) {
        try {
            if (typeof ShowcasePanorama !== 'undefined' && ShowcasePanorama.generate) {
                return ShowcasePanorama.generate(brief);
            }
        } catch (e) {
            console.warn('[Orchestrator] Procedural panorama fallback also failed:', e);
        }
        return null;
    }

    // =========================================================================
    // 3. Generate Slide Texts
    // =========================================================================

    /**
     * Generate slide texts via OpenAI or fallback to ShowcaseCortex / defaults.
     */
    async function _generateTexts(appName, features, slideCount, options = {}) {
        const useCortex = options.useCortex || false;

        // Strategy 1: OpenAI direct
        if (hasApiKey() && !useCortex) {
            try {
                const messages = [
                    {
                        role: 'system',
                        content: `You are an App Store marketing expert. Generate exactly ${slideCount} slide texts for app screenshots.
Respond with a JSON array only, no markdown.
Format: [{"headline": "max 5 words", "subline": "max 12 words"}, ...]
Rules:
- Slide 1: Hero / main statement
- Slide 2-4: Individual features
- Slide 5: Social proof / trust
- Slide 6: Call to action
- Language: German, professional, concise`,
                    },
                    {
                        role: 'user',
                        content: `App: "${appName}"\nFeatures: ${features}\nGenerate ${slideCount} slide texts.`,
                    },
                ];

                const result = await _callOpenAI(messages, {
                    temperature: 0.7,
                    max_tokens: 1024,
                });

                if (Array.isArray(result) && result.length >= slideCount) {
                    return result.slice(0, slideCount);
                }
                // If result is an object with a slides array
                if (result && Array.isArray(result.slides)) {
                    return result.slides.slice(0, slideCount);
                }

                console.warn('[Orchestrator] Text generation returned unexpected format');
            } catch (err) {
                console.warn('[Orchestrator] OpenAI text generation failed:', err.message);
            }
        }

        // Strategy 2: ShowcaseCortex (local Cortex AI)
        if (typeof ShowcaseCortex !== 'undefined') {
            try {
                if (ShowcaseCortex.isAvailable && (await ShowcaseCortex.isAvailable())) {
                    const texts = await ShowcaseCortex.generateSlideTexts(appName, features, slideCount);
                    if (texts && texts.length > 0) {
                        return texts;
                    }
                }
            } catch (err) {
                console.warn('[Orchestrator] Cortex text generation failed:', err.message);
            }
        }

        // Strategy 3: Defaults
        console.info('[Orchestrator] Using default slide texts');
        return _defaultSlideTexts(appName, features, slideCount);
    }

    // =========================================================================
    // 4. Auto Generate (One-Click Pipeline)
    // =========================================================================

    /**
     * Full One-Click pipeline: Brief -> Panorama -> Texts -> Compose.
     * @param {string} appName
     * @param {string} features - Comma-separated
     * @param {Object} options - { openaiKey, useCortex }
     * @returns {Promise<Object>} Composed project object
     */
    async function autoGenerate(appName, features, options = {}) {
        const sceneIterations = options.sceneIterations || 5;
        const totalSteps = 4 + sceneIterations;

        // Optionally set API key from options
        if (options.openaiKey) {
            setApiKey(options.openaiKey);
        }

        try {
            // ---- Step 1: Generate brief ----
            _emitProgress(STATES.BRIEFING, 1, totalSteps, 'Design-Brief erstellen...');
            let brief;
            try {
                brief = await generateBrief(appName, features);
            } catch (err) {
                console.warn('[Orchestrator] Brief step failed, using defaults:', err.message);
                brief = _defaultBrief(appName, features);
            }

            // ---- Step 2: Generate panorama ----
            _emitProgress(STATES.GENERATING_PANORAMA, 2, totalSteps, 'Panorama-Hintergrund generieren...');
            let panoramaImage = null;
            try {
                panoramaImage = await generatePanoramaImage(brief);
            } catch (err) {
                console.warn('[Orchestrator] Panorama step failed:', err.message);
                panoramaImage = _proceduralPanoramaFallback(brief);
            }

            // ---- Step 3: Generate texts ----
            _emitProgress(STATES.GENERATING_TEXTS, 3, totalSteps, 'Slide-Texte generieren...');
            let slideTexts;
            try {
                slideTexts = await _generateTexts(appName, features, 6, options);
            } catch (err) {
                console.warn('[Orchestrator] Texts step failed, using defaults:', err.message);
                slideTexts = _defaultSlideTexts(appName, features, 6);
            }

            // ---- Step 4: Compose base project ----
            _emitProgress(STATES.COMPOSING, 4, totalSteps, 'Basis-Projekt zusammenstellen...');
            let project;
            try {
                project = _composeProject(appName, brief, panoramaImage, slideTexts);
            } catch (err) {
                console.error('[Orchestrator] Compose step failed:', err);
                _emitProgress(STATES.ERROR, 4, totalSteps, 'Composition failed: ' + err.message);
                throw err;
            }

            // ---- Steps 5-9: Scene Engine Iterative Composition ----
            if (typeof ShowcaseSceneEngine !== 'undefined') {
                try {
                    await ShowcaseSceneEngine.iterateWithVision(project, {
                        apiKey: getApiKey(),
                        iterations: sceneIterations,
                        targetAudience: options.targetAudience || 'Kfz-Betriebe, Autowerkstaetten, Gutachter',
                        onProgress: (evt) => {
                            const step = 4 + evt.iteration;
                            const phase = evt.phase === 'done' ? 'DONE' : evt.phase;
                            _emitProgress(
                                phase === 'DONE' ? STATES.DONE : STATES.COMPOSING,
                                step,
                                totalSteps,
                                evt.message || `Szene iterieren (${evt.iteration}/${evt.total})...`
                            );
                        },
                    });
                } catch (err) {
                    console.warn('[Orchestrator] Scene iteration failed (non-fatal):', err.message);
                }
            }

            _emitProgress(STATES.DONE, totalSteps, totalSteps, 'Showcase fertig!');
            return { brief, panorama: panoramaImage, slides: slideTexts, project };
        } catch (err) {
            _emitProgress(STATES.ERROR, 0, totalSteps, 'Pipeline fehlgeschlagen: ' + err.message);
            throw err;
        }
    }

    /**
     * Compose the final project from generated assets.
     */
    function _composeProject(appName, brief, panoramaImage, slideTexts) {
        // Create project via ShowcaseBuilder
        const project = ShowcaseBuilder.createProject(appName, 'both');

        // Apply brand colors from brief
        if (project && brief) {
            project.brandColors = {
                primary: brief.primaryColor || DGD_BRAND.branding.primaryColor,
                accent: brief.accentColor || DGD_BRAND.branding.accentColor,
            };
        }

        // Apply templates from brief
        if (project && brief.slides && Array.isArray(brief.slides)) {
            for (let i = 0; i < Math.min(project.slides.length, brief.slides.length); i++) {
                const briefSlide = brief.slides[i];
                if (briefSlide.template) {
                    const tpl = ShowcaseTemplates.getTemplate(briefSlide.template);
                    if (tpl) {
                        project.slides[i].template = tpl.id;
                    }
                }
            }
        }

        // Apply panorama background to all slides
        if (panoramaImage && typeof ShowcasePanorama !== 'undefined' && ShowcasePanorama.drawSlideBackground) {
            project._panoramaImage = panoramaImage;
            project._usePanorama = true;
        }

        // Apply generated texts to slides
        if (slideTexts && Array.isArray(slideTexts)) {
            for (let i = 0; i < Math.min(project.slides.length, slideTexts.length); i++) {
                const text = slideTexts[i];
                if (!text) continue;

                const slide = project.slides[i];
                for (const el of slide.elements) {
                    if (el.id === 'headline' || el.type === 'text' && el.id === 'headline') {
                        el.content = text.headline || el.content;
                    }
                    if (el.id === 'subline' || el.type === 'text' && el.id === 'subline') {
                        el.content = text.subline || el.content;
                    }
                }
            }
        }

        // Apply gradient backgrounds with brief colors
        if (brief.primaryColor) {
            for (const slide of project.slides) {
                if (slide.background && slide.background.type === 'gradient') {
                    slide.background.from = brief.primaryColor;
                    slide.background.to = brief.accentColor || brief.primaryColor;
                }
            }
        }

        return project;
    }

    // =========================================================================
    // 5. Submit Feedback
    // =========================================================================

    /**
     * Process user feedback via OpenAI and return change instructions.
     * @param {string} feedbackText - User's feedback
     * @param {Object} project - Current project state
     * @returns {Promise<Object>} Changes to apply: {slides: [{index, changes}], colors?}
     */
    async function submitFeedback(feedbackText, project) {
        if (!hasApiKey()) {
            console.warn('[Orchestrator] No API key for feedback processing');
            return null;
        }

        try {
            // Build a compact project summary for context
            const projectSummary = {
                appName: project.appName,
                brandColors: project.brandColors,
                slides: project.slides.map((s, i) => {
                    const headline = s.elements.find(e => e.id === 'headline');
                    const subline = s.elements.find(e => e.id === 'subline');
                    return {
                        index: i,
                        template: s.template,
                        headline: headline?.content || '',
                        subline: subline?.content || '',
                    };
                }),
            };

            // Detect if user provided a comprehensive creative brief (long text)
            const isCreativeBrief = feedbackText.length > 300;

            const messages = [
                {
                    role: 'system',
                    content: `You are an App Store design expert for "${DGD_BRAND.company.name}" (${DGD_BRAND.company.industry}).
The user gives feedback about the current showcase design. Analyze and respond with JSON:

{
  "action": "update",
  "message": "Short summary of changes (in user's language)",
  "slides": [
    {"index": 0, "changes": {"headline": "new text", "subline": "new text", "templateId": "hero"}}
  ],
  "colors": {"primary": "#hex", "accent": "#hex"},
  "regeneratePanorama": false,
  "panoramaHint": ""
}

Available templates: "hero", "feature", "split", "fullscreen", "comparison"
There are exactly 6 slides (index 0-5).

PANORAMA RULES:
- "regeneratePanorama": TRUE for ANY visual/image/background/style change request
- "panoramaHint": A DETAILED English DALL-E prompt (3-6 sentences, up to 800 chars). This IS the image generation prompt.
  Include: art style, perspective, lighting, color palette, objects, mood, scene composition.
  IMPORTANT: Build upon the current panorama description — keep what works, add/modify what the user requests.
  If the user provides a comprehensive creative brief, distill its visual essence into an optimal DALL-E prompt.
  The panorama is ONE ultra-wide image (6480x1920) that gets sliced into 6 vertical panels.
  Describe a continuous left-to-right scene that works as 6 connected segments.

SLIDE TEXT RULES:
- Update ALL 6 slide headlines and sublines when the user provides a story/narrative
- Headlines: max 5 words, punchy, emotional
- Sublines: max 15 words, descriptive
- Language: Match user's language
- For a 6-slide narrative, each slide should tell one chapter of the story

${isCreativeBrief ? `CREATIVE BRIEF MODE: The user provided a detailed creative brief. You MUST:
1. Extract the visual style and create an optimal panoramaHint (set regeneratePanorama: true)
2. Create fitting headlines/sublines for ALL 6 slides based on the story described
3. Set colors if the brief specifies brand colors
4. The panoramaHint should capture: art style, scene type, perspective, key objects, color progression, mood progression` : ''}`,
                },
                {
                    role: 'user',
                    content: `Current project:\n${JSON.stringify(projectSummary, null, 2)}\n\nCurrent panorama: "${_lastPanoramaPrompt || 'default DGD automotive scene'}"\n\nUser feedback:\n${feedbackText}`,
                },
            ];

            const result = await _callOpenAI(messages, {
                temperature: 0.5,
                max_tokens: isCreativeBrief ? 2048 : 1024,
                response_format: { type: 'json_object' },
            });

            if (result && (result.slides || result.colors || result.regeneratePanorama || result.message)) {
                return result;
            }

            console.warn('[Orchestrator] Feedback response had unexpected format');
            return null;
        } catch (err) {
            console.warn('[Orchestrator] Feedback processing failed:', err.message);
            return null;
        }
    }

    // =========================================================================
    // Public API
    // =========================================================================

    return {
        autoGenerate,
        generateBrief,
        generatePanoramaImage,
        submitFeedback,
        onProgress,
        setApiKey,
        setEnvApiKey,
        getApiKey,
        hasApiKey,
        getLastPanoramaPrompt: () => _lastPanoramaPrompt,
    };

})();
