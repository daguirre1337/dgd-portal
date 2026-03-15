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
    const OPENAI_MODEL = 'gpt-4o-mini';
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

    function setApiKey(key) {
        try {
            localStorage.setItem(STORAGE_KEY, key || '');
        } catch (e) {
            console.warn('[Orchestrator] Could not store API key:', e);
        }
    }

    function getApiKey() {
        try {
            return localStorage.getItem(STORAGE_KEY) || '';
        } catch (e) {
            return '';
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
    // Default Fallbacks
    // =========================================================================

    function _defaultBrief(appName, features) {
        const featureList = (features || '').split(',').map(f => f.trim()).filter(Boolean);
        const safeFeatures = featureList.length > 0
            ? featureList
            : ['Schadenmanagement', 'Gutachter-Netzwerk', 'Schnelle Abwicklung'];

        return {
            mood: 'professional',
            primaryColor: '#1A365D',
            accentColor: '#D4A843',
            backgroundMood: 'professional automotive workshop environment, dark blue tones, subtle car silhouettes, insurance industry aesthetics',
            features: safeFeatures,
            slides: [
                { headline: appName || 'DGD Direkt', subline: 'Ihr Partner im Kfz-Schadenmanagement', template: 'hero' },
                { headline: safeFeatures[0] || 'Schadenmanagement', subline: 'Professionelle Schadenbegutachtung aus einer Hand', template: 'feature' },
                { headline: safeFeatures[1] || 'Gutachter-Netzwerk', subline: 'Deutschlandweites Netzwerk zertifizierter Gutachter', template: 'split' },
                { headline: safeFeatures[2] || 'Schnelle Abwicklung', subline: 'Effiziente Prozesse fuer schnelle Regulierung', template: 'fullscreen' },
                { headline: 'Vertrauen & Kompetenz', subline: 'Tausende zufriedene Kunden und Partner', template: 'feature' },
                { headline: 'Jetzt Kontakt aufnehmen', subline: 'Wir sind fuer Sie da', template: 'comparison' },
            ],
        };
    }

    function _defaultSlideTexts(appName, features, slideCount) {
        const brief = _defaultBrief(appName, features);
        return brief.slides.slice(0, slideCount).map(s => ({
            headline: s.headline,
            subline: s.subline,
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
                    content: `You are a design expert for DGD Direkt, a German Kfz-Schadenmanagement company (car damage management and assessment).
You create compelling visual strategies for professional showcase presentations.
DGD brand colors: primary dark blue #1A365D, accent gold #D4A843.
The visual style should convey professionalism, trust, and automotive industry expertise.
Always respond with valid JSON only, no markdown, no explanation.
The JSON must have this structure:
{
  "mood": "string (e.g. professional, bold, trustworthy)",
  "primaryColor": "#hex",
  "accentColor": "#hex",
  "backgroundMood": "string describing the ideal background - should reference automotive, insurance, or professional service imagery",
  "features": ["feature1", "feature2", ...],
  "slides": [
    {"headline": "short powerful headline (max 5 words)", "subline": "explanatory sentence (max 12 words)", "template": "hero|feature|split|fullscreen|comparison"},
    ...
  ]
}
Generate exactly 6 slides. Language: German. Use DGD brand colors (#1A365D, #D4A843) as a foundation.`,
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

    /**
     * Generate a panorama background image via DALL-E 3.
     * Falls back to procedural ShowcasePanorama.generate() on failure.
     */
    async function generatePanoramaImage(brief) {
        if (!hasApiKey()) {
            console.info('[Orchestrator] No API key, falling back to procedural panorama');
            return _proceduralPanoramaFallback(brief);
        }

        try {
            const apiKey = getApiKey();
            const moodDesc = brief.backgroundMood || 'professional automotive workshop environment with dark blue tones';
            const prompt = `${moodDesc}, professional background for DGD Direkt Kfz-Schadenmanagement company, automotive industry aesthetics, subtle car repair workshop or insurance office environment, dark blue (#1A365D) and gold (#D4A843) color palette, no text, no UI elements, smooth gradients, high quality, wide panoramic composition, professional service industry feel`;

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
                    quality: 'standard',
                }),
            });

            if (!response.ok) {
                const errBody = await response.text().catch(() => '');
                throw new Error(`DALL-E API error ${response.status}: ${errBody}`);
            }

            const data = await response.json();
            const imageUrl = data.data?.[0]?.url;

            if (!imageUrl) {
                throw new Error('No image URL in DALL-E response');
            }

            // Load the image into an HTMLImageElement
            const img = await _loadImage(imageUrl);
            return img;
        } catch (err) {
            console.warn('[Orchestrator] DALL-E generation failed, falling back to procedural:', err.message);
            return _proceduralPanoramaFallback(brief);
        }
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
                primary: brief.primaryColor || '#1a3a5c',
                accent: brief.accentColor || '#D4A843',
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

            const messages = [
                {
                    role: 'system',
                    content: `You are an App Store design expert reviewing a showcase project.
The user will give you feedback about the current design. Analyze their feedback and respond with specific changes.
Respond with JSON only:
{
  "slides": [
    {"index": 0, "changes": {"headline": "new text", "subline": "new text", "templateId": "hero"}}
  ],
  "colors": {"primary": "#hex", "accent": "#hex"}
}
Only include fields that should change. Omit unchanged slides and fields.
Language: Match the user's language (German or English).`,
                },
                {
                    role: 'user',
                    content: `Current project:\n${JSON.stringify(projectSummary, null, 2)}\n\nFeedback: ${feedbackText}`,
                },
            ];

            const result = await _callOpenAI(messages, {
                temperature: 0.6,
                max_tokens: 1024,
                response_format: { type: 'json_object' },
            });

            if (result && (result.slides || result.colors)) {
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
        getApiKey,
        hasApiKey,
    };

})();
