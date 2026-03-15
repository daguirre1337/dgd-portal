/**
 * Showcase Scene Engine - Multi-Layer Iterative Scene Composition
 *
 * Builds atmospheric scenes through multiple visual layers,
 * then uses AI vision to analyze, critique, and improve iteratively.
 *
 * Flow: Auto-Generate → 5 iterations of:
 *   1. Render all layers to canvas
 *   2. Capture canvas as image
 *   3. Send to AI vision for critique
 *   4. Parse critique into layer modifications
 *   5. Apply modifications, add new elements/layers
 *
 * Layer hierarchy (back to front):
 *   0. Sky/Gradient base
 *   1. Environment (landscape, buildings, horizon)
 *   2. Mid-ground (vehicles, workshop elements, props)
 *   3. Atmosphere (light effects, particles, color overlays)
 *   4. Content (text, device mockups - from templates)
 *   5. Accents (borders, highlights, decorative touches)
 */

const ShowcaseSceneEngine = (() => {
    'use strict';

    const DW = 1080;
    const DH = 1920;

    // =========================================================================
    // Scene Element Library - Automotive / Kfz-Betrieb themed
    // =========================================================================

    const ELEMENT_LIBRARY = {
        // --- Layer 1: Environment ---
        environment: [
            {
                id: 'horizon_line',
                draw: (ctx, w, h, opts) => {
                    const y = opts.y || h * 0.35;
                    const grad = ctx.createLinearGradient(0, 0, 0, y + 100);
                    grad.addColorStop(0, opts.skyTop || 'rgba(15,36,64,0.9)');
                    grad.addColorStop(0.7, opts.skyMid || 'rgba(26,58,92,0.7)');
                    grad.addColorStop(1, opts.skyBottom || 'rgba(44,82,130,0.4)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, w, y + 100);
                },
            },
            {
                id: 'cityscape',
                draw: (ctx, w, h, opts) => {
                    const baseY = opts.baseY || h * 0.32;
                    const count = opts.count || 12;
                    const color = opts.color || 'rgba(10,25,50,0.6)';
                    ctx.fillStyle = color;
                    const rand = _seeded(opts.seed || 42);
                    for (let i = 0; i < count; i++) {
                        const bw = 40 + rand() * 80;
                        const bh = 60 + rand() * 200;
                        const bx = (w / count) * i + rand() * 30;
                        ctx.fillRect(bx, baseY - bh, bw, bh + 20);
                        // Windows
                        ctx.fillStyle = 'rgba(212,168,67,0.15)';
                        for (let wy = baseY - bh + 15; wy < baseY - 10; wy += 25) {
                            for (let wx = bx + 8; wx < bx + bw - 8; wx += 18) {
                                if (rand() > 0.4) {
                                    ctx.fillRect(wx, wy, 8, 12);
                                }
                            }
                        }
                        ctx.fillStyle = color;
                    }
                },
            },
            {
                id: 'road',
                draw: (ctx, w, h, opts) => {
                    const y = opts.y || h * 0.38;
                    const roadH = opts.height || h * 0.12;
                    // Road surface
                    const grad = ctx.createLinearGradient(0, y, 0, y + roadH);
                    grad.addColorStop(0, opts.colorTop || 'rgba(40,40,50,0.7)');
                    grad.addColorStop(1, opts.colorBottom || 'rgba(30,30,40,0.5)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, y, w, roadH);
                    // Lane markings
                    ctx.setLineDash([30, 50]);
                    ctx.strokeStyle = opts.markingColor || 'rgba(255,255,255,0.2)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(0, y + roadH / 2);
                    ctx.lineTo(w, y + roadH / 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                },
            },
            {
                id: 'workshop_floor',
                draw: (ctx, w, h, opts) => {
                    const y = opts.y || h * 0.50;
                    const floorH = h - y;
                    // Concrete floor gradient
                    const grad = ctx.createLinearGradient(0, y, 0, h);
                    grad.addColorStop(0, opts.colorTop || 'rgba(45,50,60,0.5)');
                    grad.addColorStop(0.5, opts.colorMid || 'rgba(35,40,48,0.4)');
                    grad.addColorStop(1, opts.colorBottom || 'rgba(25,30,38,0.3)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, y, w, floorH);
                    // Grid lines (workshop floor tiles)
                    ctx.strokeStyle = opts.gridColor || 'rgba(255,255,255,0.03)';
                    ctx.lineWidth = 1;
                    const gridSize = opts.gridSize || 80;
                    for (let gx = 0; gx < w; gx += gridSize) {
                        ctx.beginPath();
                        ctx.moveTo(gx, y);
                        ctx.lineTo(gx, h);
                        ctx.stroke();
                    }
                    for (let gy = y; gy < h; gy += gridSize) {
                        ctx.beginPath();
                        ctx.moveTo(0, gy);
                        ctx.lineTo(w, gy);
                        ctx.stroke();
                    }
                },
            },
        ],

        // --- Layer 2: Mid-ground (vehicles, props) ---
        midground: [
            {
                id: 'car_silhouette',
                draw: (ctx, w, h, opts) => {
                    const cx = opts.x || w * 0.5;
                    const cy = opts.y || h * 0.40;
                    const s = opts.scale || 1;
                    const color = opts.color || 'rgba(20,30,50,0.4)';
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.scale(s, s);
                    ctx.fillStyle = color;
                    // Simplified car body
                    ctx.beginPath();
                    ctx.moveTo(-120, 0);
                    ctx.lineTo(-100, -35);
                    ctx.lineTo(-60, -55);
                    ctx.lineTo(40, -55);
                    ctx.lineTo(80, -35);
                    ctx.lineTo(120, -25);
                    ctx.lineTo(130, 0);
                    ctx.lineTo(110, 10);
                    // Rear wheel well
                    ctx.arc(85, 10, 22, 0, Math.PI, false);
                    ctx.lineTo(50, 10);
                    ctx.lineTo(-40, 10);
                    // Front wheel well
                    ctx.arc(-65, 10, 22, 0, Math.PI, false);
                    ctx.lineTo(-120, 10);
                    ctx.closePath();
                    ctx.fill();
                    // Windshield highlight
                    ctx.fillStyle = 'rgba(100,150,200,0.1)';
                    ctx.beginPath();
                    ctx.moveTo(-55, -52);
                    ctx.lineTo(-95, -32);
                    ctx.lineTo(-40, -32);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                },
            },
            {
                id: 'tool_rack',
                draw: (ctx, w, h, opts) => {
                    const x = opts.x || w * 0.1;
                    const y = opts.y || h * 0.25;
                    const color = opts.color || 'rgba(60,70,80,0.3)';
                    ctx.save();
                    ctx.fillStyle = color;
                    // Vertical rack
                    ctx.fillRect(x, y, 8, 200);
                    ctx.fillRect(x + 80, y, 8, 200);
                    // Shelves
                    for (let sy = 0; sy < 4; sy++) {
                        ctx.fillRect(x - 5, y + sy * 55, 98, 5);
                    }
                    // Tool shapes on shelves
                    ctx.fillStyle = 'rgba(212,168,67,0.15)';
                    const rand = _seeded(opts.seed || 77);
                    for (let sy = 0; sy < 3; sy++) {
                        for (let tx = 0; tx < 3; tx++) {
                            if (rand() > 0.3) {
                                const tw = 12 + rand() * 18;
                                const th = 15 + rand() * 30;
                                ctx.fillRect(x + 10 + tx * 25, y + sy * 55 + 8, tw, th);
                            }
                        }
                    }
                    ctx.restore();
                },
            },
            {
                id: 'lift_post',
                draw: (ctx, w, h, opts) => {
                    const x = opts.x || w * 0.8;
                    const y = opts.y || h * 0.20;
                    const postH = opts.height || 300;
                    const color = opts.color || 'rgba(70,80,90,0.25)';
                    ctx.save();
                    ctx.fillStyle = color;
                    // Vertical post
                    ctx.fillRect(x, y, 16, postH);
                    // Base plate
                    ctx.fillRect(x - 20, y + postH - 5, 56, 10);
                    // Arm
                    ctx.fillRect(x - 60, y + postH * 0.4, 80, 6);
                    ctx.fillRect(x + 16, y + postH * 0.4, 80, 6);
                    // Hydraulic cylinder
                    ctx.fillStyle = 'rgba(212,168,67,0.12)';
                    ctx.fillRect(x + 3, y + 20, 10, postH * 0.35);
                    ctx.restore();
                },
            },
        ],

        // --- Layer 3: Atmosphere ---
        atmosphere: [
            {
                id: 'light_beam',
                draw: (ctx, w, h, opts) => {
                    const x = opts.x || w * 0.3;
                    const spread = opts.spread || 200;
                    const alpha = opts.alpha || 0.06;
                    const color = opts.color || '#D4A843';
                    const grad = ctx.createLinearGradient(x, 0, x, h * 0.7);
                    grad.addColorStop(0, _rgba(color, alpha * 2));
                    grad.addColorStop(0.5, _rgba(color, alpha));
                    grad.addColorStop(1, _rgba(color, 0));
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.moveTo(x - 20, 0);
                    ctx.lineTo(x - spread, h * 0.7);
                    ctx.lineTo(x + spread, h * 0.7);
                    ctx.lineTo(x + 20, 0);
                    ctx.closePath();
                    ctx.fill();
                },
            },
            {
                id: 'bokeh',
                draw: (ctx, w, h, opts) => {
                    const count = opts.count || 15;
                    const rand = _seeded(opts.seed || 99);
                    for (let i = 0; i < count; i++) {
                        const bx = rand() * w;
                        const by = rand() * h * 0.6;
                        const br = 5 + rand() * 30;
                        const alpha = 0.03 + rand() * 0.08;
                        const color = rand() > 0.5
                            ? (opts.primaryColor || '#D4A843')
                            : (opts.secondaryColor || '#ffffff');
                        const radGrad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
                        radGrad.addColorStop(0, _rgba(color, alpha * 1.5));
                        radGrad.addColorStop(0.7, _rgba(color, alpha * 0.5));
                        radGrad.addColorStop(1, _rgba(color, 0));
                        ctx.fillStyle = radGrad;
                        ctx.beginPath();
                        ctx.arc(bx, by, br, 0, Math.PI * 2);
                        ctx.fill();
                    }
                },
            },
            {
                id: 'dust_particles',
                draw: (ctx, w, h, opts) => {
                    const count = opts.count || 40;
                    const rand = _seeded(opts.seed || 123);
                    ctx.fillStyle = opts.color || 'rgba(255,255,255,0.08)';
                    for (let i = 0; i < count; i++) {
                        const px = rand() * w;
                        const py = rand() * h;
                        const pr = 1 + rand() * 3;
                        ctx.beginPath();
                        ctx.arc(px, py, pr, 0, Math.PI * 2);
                        ctx.fill();
                    }
                },
            },
            {
                id: 'color_overlay',
                draw: (ctx, w, h, opts) => {
                    const color = opts.color || '#1a3a5c';
                    const alpha = opts.alpha || 0.15;
                    ctx.fillStyle = _rgba(color, alpha);
                    ctx.fillRect(0, 0, w, h);
                },
            },
            {
                id: 'vignette',
                draw: (ctx, w, h, opts) => {
                    const strength = opts.strength || 0.4;
                    const radGrad = ctx.createRadialGradient(
                        w / 2, h / 2, Math.min(w, h) * 0.3,
                        w / 2, h / 2, Math.max(w, h) * 0.8
                    );
                    radGrad.addColorStop(0, 'rgba(0,0,0,0)');
                    radGrad.addColorStop(1, `rgba(0,0,0,${strength})`);
                    ctx.fillStyle = radGrad;
                    ctx.fillRect(0, 0, w, h);
                },
            },
            {
                id: 'lens_flare',
                draw: (ctx, w, h, opts) => {
                    const cx = opts.x || w * 0.7;
                    const cy = opts.y || h * 0.15;
                    const size = opts.size || 120;
                    const color = opts.color || '#D4A843';
                    // Main flare
                    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
                    grad.addColorStop(0, _rgba(color, 0.3));
                    grad.addColorStop(0.3, _rgba(color, 0.08));
                    grad.addColorStop(1, _rgba(color, 0));
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, size, 0, Math.PI * 2);
                    ctx.fill();
                    // Secondary rings
                    for (let i = 1; i <= 3; i++) {
                        const rx = cx + (w / 2 - cx) * i * 0.3;
                        const ry = cy + (h / 2 - cy) * i * 0.3;
                        const rs = size * (0.3 - i * 0.06);
                        const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, rs);
                        rg.addColorStop(0, _rgba(color, 0.06));
                        rg.addColorStop(1, _rgba(color, 0));
                        ctx.fillStyle = rg;
                        ctx.beginPath();
                        ctx.arc(rx, ry, rs, 0, Math.PI * 2);
                        ctx.fill();
                    }
                },
            },
        ],

        // --- Layer 5: Accents ---
        accents: [
            {
                id: 'gold_stripe',
                draw: (ctx, w, h, opts) => {
                    const y = opts.y || h * 0.48;
                    const thickness = opts.thickness || 3;
                    const color = opts.color || '#D4A843';
                    const alpha = opts.alpha || 0.4;
                    ctx.strokeStyle = _rgba(color, alpha);
                    ctx.lineWidth = thickness;
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(w, y);
                    ctx.stroke();
                },
            },
            {
                id: 'corner_accent',
                draw: (ctx, w, h, opts) => {
                    const size = opts.size || 60;
                    const color = opts.color || '#D4A843';
                    const alpha = opts.alpha || 0.25;
                    const margin = opts.margin || 30;
                    ctx.strokeStyle = _rgba(color, alpha);
                    ctx.lineWidth = 2;
                    // Top-left
                    ctx.beginPath();
                    ctx.moveTo(margin, margin + size);
                    ctx.lineTo(margin, margin);
                    ctx.lineTo(margin + size, margin);
                    ctx.stroke();
                    // Bottom-right
                    ctx.beginPath();
                    ctx.moveTo(w - margin - size, h - margin);
                    ctx.lineTo(w - margin, h - margin);
                    ctx.lineTo(w - margin, h - margin - size);
                    ctx.stroke();
                },
            },
            {
                id: 'diagonal_accent',
                draw: (ctx, w, h, opts) => {
                    const color = opts.color || '#D4A843';
                    const alpha = opts.alpha || 0.08;
                    const count = opts.count || 5;
                    ctx.strokeStyle = _rgba(color, alpha);
                    ctx.lineWidth = opts.lineWidth || 2;
                    for (let i = 0; i < count; i++) {
                        const offset = (w / count) * i + w * 0.1;
                        ctx.beginPath();
                        ctx.moveTo(offset, 0);
                        ctx.lineTo(offset - h * 0.3, h);
                        ctx.stroke();
                    }
                },
            },
        ],
    };

    // =========================================================================
    // Scene Presets - Starting configurations per slide type
    // =========================================================================

    const SCENE_PRESETS = {
        hero: {
            layers: [
                { elements: [{ libId: 'horizon_line', layer: 'environment', opts: { y: 0.35 } }] },
                { elements: [{ libId: 'cityscape', layer: 'environment', opts: { baseY: 0.32, count: 10 } }] },
                { elements: [{ libId: 'road', layer: 'environment', opts: { y: 0.38 } }] },
                { elements: [
                    { libId: 'car_silhouette', layer: 'midground', opts: { x: 0.25, y: 0.42, scale: 1.2 } },
                ] },
                { elements: [
                    { libId: 'light_beam', layer: 'atmosphere', opts: { x: 0.5, spread: 250, alpha: 0.05 } },
                    { libId: 'bokeh', layer: 'atmosphere', opts: { count: 12, seed: 42 } },
                ] },
                { elements: [{ libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.35 } }] },
            ],
        },
        feature: {
            layers: [
                { elements: [{ libId: 'workshop_floor', layer: 'environment', opts: { y: 0.45 } }] },
                { elements: [
                    { libId: 'tool_rack', layer: 'midground', opts: { x: 0.05, y: 0.18, seed: 55 } },
                    { libId: 'lift_post', layer: 'midground', opts: { x: 0.88, y: 0.15, height: 350 } },
                ] },
                { elements: [
                    { libId: 'dust_particles', layer: 'atmosphere', opts: { count: 30, seed: 88 } },
                    { libId: 'light_beam', layer: 'atmosphere', opts: { x: 0.7, spread: 180, alpha: 0.04 } },
                ] },
                { elements: [{ libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.3 } }] },
            ],
        },
        split: {
            layers: [
                { elements: [{ libId: 'horizon_line', layer: 'environment', opts: { y: 0.30 } }] },
                { elements: [
                    { libId: 'car_silhouette', layer: 'midground', opts: { x: 0.7, y: 0.35, scale: 0.9 } },
                ] },
                { elements: [
                    { libId: 'bokeh', layer: 'atmosphere', opts: { count: 8, seed: 33 } },
                    { libId: 'lens_flare', layer: 'atmosphere', opts: { x: 0.8, y: 0.12, size: 100 } },
                ] },
                { elements: [
                    { libId: 'gold_stripe', layer: 'accents', opts: { y: 0.50 } },
                ] },
                { elements: [{ libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.3 } }] },
            ],
        },
        fullscreen: {
            layers: [
                { elements: [{ libId: 'workshop_floor', layer: 'environment', opts: { y: 0.50 } }] },
                { elements: [
                    { libId: 'car_silhouette', layer: 'midground', opts: { x: 0.5, y: 0.48, scale: 1.8 } },
                ] },
                { elements: [
                    { libId: 'light_beam', layer: 'atmosphere', opts: { x: 0.4, spread: 300, alpha: 0.07 } },
                    { libId: 'dust_particles', layer: 'atmosphere', opts: { count: 50, seed: 200 } },
                    { libId: 'bokeh', layer: 'atmosphere', opts: { count: 20, seed: 150 } },
                ] },
                { elements: [
                    { libId: 'corner_accent', layer: 'accents', opts: { size: 50, alpha: 0.3 } },
                ] },
                { elements: [{ libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.45 } }] },
            ],
        },
        comparison: {
            layers: [
                { elements: [{ libId: 'horizon_line', layer: 'environment', opts: { y: 0.28 } }] },
                { elements: [{ libId: 'cityscape', layer: 'environment', opts: { baseY: 0.26, count: 8 } }] },
                { elements: [
                    { libId: 'car_silhouette', layer: 'midground', opts: { x: 0.15, y: 0.34, scale: 0.7 } },
                    { libId: 'car_silhouette', layer: 'midground', opts: { x: 0.85, y: 0.34, scale: 0.7 } },
                ] },
                { elements: [
                    { libId: 'bokeh', layer: 'atmosphere', opts: { count: 10, seed: 66 } },
                    { libId: 'diagonal_accent', layer: 'accents', opts: { count: 3, alpha: 0.05 } },
                ] },
                { elements: [{ libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.3 } }] },
            ],
        },
    };

    // =========================================================================
    // Core: Render scene layers onto a canvas
    // =========================================================================

    /**
     * Render scene layers for a single slide.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} scene - { layers: [...] }
     * @param {number} w - Canvas width
     * @param {number} h - Canvas height
     * @param {Object} colors - { primary, accent }
     */
    function renderScene(ctx, scene, w, h, colors) {
        if (!scene || !scene.layers) return;

        const primary = colors?.primary || '#1a3a5c';
        const accent = colors?.accent || '#D4A843';

        for (const layer of scene.layers) {
            if (!layer.elements) continue;
            for (const elem of layer.elements) {
                const libEntry = _findLibEntry(elem.libId, elem.layer);
                if (!libEntry) continue;

                // Resolve relative positions to absolute pixels
                const resolvedOpts = _resolveOpts(elem.opts, w, h, primary, accent);
                try {
                    libEntry.draw(ctx, w, h, resolvedOpts);
                } catch (e) {
                    console.warn(`[SceneEngine] Draw error for ${elem.libId}:`, e);
                }
            }
        }
    }

    /**
     * Get the default scene for a template type.
     */
    function getPreset(templateId) {
        const preset = SCENE_PRESETS[templateId] || SCENE_PRESETS.hero;
        return JSON.parse(JSON.stringify(preset));
    }

    // =========================================================================
    // AI Vision Iteration Loop
    // =========================================================================

    /**
     * Run the iterative improvement loop.
     * @param {Object} project - ShowcaseBuilder project
     * @param {Object} options - { apiKey, iterations, onProgress, targetAudience }
     * @returns {Promise<Object>} Updated project with scene data
     */
    async function iterateWithVision(project, options = {}) {
        const iterations = options.iterations || 5;
        const apiKey = options.apiKey || '';
        const targetAudience = options.targetAudience || 'Kfz-Betriebe, Autowerkstaetten, Gutachter';
        const onProgress = options.onProgress || (() => {});

        // Initialize scenes for each slide
        if (!project._scenes) {
            project._scenes = {};
            for (let i = 0; i < project.slides.length; i++) {
                const templateId = project.slides[i].template || 'hero';
                project._scenes[i] = getPreset(templateId);
            }
        }

        for (let iter = 0; iter < iterations; iter++) {
            onProgress({
                iteration: iter + 1,
                total: iterations,
                phase: 'rendering',
                message: `Iteration ${iter + 1}/${iterations}: Szene rendern...`,
                percent: Math.round(((iter * 3) / (iterations * 3)) * 100),
            });

            // 1. Render all slides to capture images
            const slideImages = [];
            for (let i = 0; i < Math.min(project.slides.length, 6); i++) {
                const img = _renderSlideToImage(project, i);
                slideImages.push(img);
            }

            // 2. Create composite preview image (3x2 grid)
            const compositeDataUrl = _createComposite(slideImages);

            onProgress({
                iteration: iter + 1,
                total: iterations,
                phase: 'analyzing',
                message: `Iteration ${iter + 1}/${iterations}: AI analysiert Szene...`,
                percent: Math.round(((iter * 3 + 1) / (iterations * 3)) * 100),
            });

            // 3. Send to AI vision for critique
            let critique = null;
            if (apiKey) {
                try {
                    critique = await _visionCritique(compositeDataUrl, project, iter, iterations, targetAudience, apiKey);
                } catch (e) {
                    console.warn(`[SceneEngine] Vision critique failed (iter ${iter + 1}):`, e.message);
                }
            }

            // Fallback: procedural improvements if no API key or vision failed
            if (!critique) {
                critique = _proceduralCritique(iter, iterations);
            }

            onProgress({
                iteration: iter + 1,
                total: iterations,
                phase: 'improving',
                message: `Iteration ${iter + 1}/${iterations}: ${critique.summary || 'Verbesserungen anwenden...'}`,
                percent: Math.round(((iter * 3 + 2) / (iterations * 3)) * 100),
            });

            // 4. Apply critique changes to scenes
            _applyCritique(project, critique, iter);
        }

        onProgress({
            iteration: iterations,
            total: iterations,
            phase: 'done',
            message: 'Szenenkomposition abgeschlossen!',
            percent: 100,
        });

        return project;
    }

    // =========================================================================
    // Vision API: Critique via GPT-4o
    // =========================================================================

    async function _visionCritique(imageDataUrl, project, currentIter, totalIters, targetAudience, apiKey) {
        const slidesSummary = project.slides.map((s, i) => {
            const hl = s.elements?.find(e => e.id === 'headline');
            return `Slide ${i + 1} (${s.template}): "${hl?.content || ''}"`;
        }).join('\n');

        const layerSummary = Object.entries(project._scenes || {}).map(([idx, scene]) => {
            const elems = (scene.layers || []).flatMap(l => l.elements || []);
            return `Slide ${parseInt(idx) + 1}: ${elems.map(e => e.libId).join(', ')}`;
        }).join('\n');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `Du bist ein visueller Design-Kritiker fuer App Store Screenshots.
Zielgruppe: ${targetAudience}
Marke: DGD Direkt (Kfz-Schadenmanagement) - Dunkelblau #1A365D, Gold #D4A843

Dies ist Iteration ${currentIter + 1} von ${totalIters}. Fruehe Iterationen: Grundaufbau. Spaetere: Feinschliff.

Aktuelle Szenen-Elemente pro Slide:
${layerSummary}

Slides:
${slidesSummary}

Verfuegbare Elemente zum Hinzufuegen:
- Environment: horizon_line, cityscape, road, workshop_floor
- Midground: car_silhouette, tool_rack, lift_post
- Atmosphere: light_beam, bokeh, dust_particles, color_overlay, vignette, lens_flare
- Accents: gold_stripe, corner_accent, diagonal_accent

Antworte NUR mit JSON:
{
  "summary": "Kurze Zusammenfassung der Verbesserungen (1 Satz, deutsch)",
  "changes": [
    {
      "slideIndex": 0,
      "action": "add|modify|remove",
      "element": {
        "libId": "element_id",
        "layer": "environment|midground|atmosphere|accents",
        "opts": { ... }
      }
    }
  ]
}

Regeln:
- Max 4 Aenderungen pro Iteration
- Fruehe Iter: Landschaft/Umgebung aufbauen
- Mittlere Iter: Atmosphaere (Licht, Bokeh, Partikel)
- Spaete Iter: Akzente und Feintuning
- Alle Positionen als Faktor (0.0-1.0), NICHT in Pixeln
- Denke an die Zielgruppe: Werkstatt-Atmosphaere, Autos, Professionalitaet`,
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `Analysiere dieses Screenshot-Set (3x2 Grid, Slides 1-6). Was fehlt? Wie kann die Atmosphaere fuer ${targetAudience} verbessert werden? Iteration ${currentIter + 1}/${totalIters}.`,
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageDataUrl,
                                    detail: 'low',
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 1024,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI Vision API error ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        try {
            return JSON.parse(content);
        } catch {
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1].trim());
            }
            // Try finding raw JSON
            const braceStart = content.indexOf('{');
            const braceEnd = content.lastIndexOf('}');
            if (braceStart !== -1 && braceEnd > braceStart) {
                return JSON.parse(content.slice(braceStart, braceEnd + 1));
            }
            throw new Error('Could not parse vision critique response');
        }
    }

    // =========================================================================
    // Procedural Critique Fallback (no API key)
    // =========================================================================

    function _proceduralCritique(currentIter, totalIters) {
        const phase = currentIter / totalIters;

        if (phase < 0.3) {
            // Early: Add environment elements
            return {
                summary: 'Landschaft und Umgebung aufbauen',
                changes: [
                    { slideIndex: 0, action: 'add', element: { libId: 'cityscape', layer: 'environment', opts: { baseY: 0.32, count: 14, seed: currentIter * 10 + 1 } } },
                    { slideIndex: 1, action: 'add', element: { libId: 'workshop_floor', layer: 'environment', opts: { y: 0.48, gridSize: 60 } } },
                    { slideIndex: 2, action: 'add', element: { libId: 'road', layer: 'environment', opts: { y: 0.36, height: 0.10 } } },
                    { slideIndex: 4, action: 'add', element: { libId: 'cityscape', layer: 'environment', opts: { baseY: 0.30, count: 10, seed: currentIter * 10 + 5 } } },
                ],
            };
        } else if (phase < 0.6) {
            // Mid: Add midground + atmosphere
            return {
                summary: 'Fahrzeuge und Lichteffekte hinzufuegen',
                changes: [
                    { slideIndex: 0, action: 'add', element: { libId: 'car_silhouette', layer: 'midground', opts: { x: 0.7, y: 0.40, scale: 1.0 } } },
                    { slideIndex: 1, action: 'add', element: { libId: 'light_beam', layer: 'atmosphere', opts: { x: 0.3, spread: 200, alpha: 0.06 } } },
                    { slideIndex: 3, action: 'add', element: { libId: 'bokeh', layer: 'atmosphere', opts: { count: 18, seed: currentIter * 7 } } },
                    { slideIndex: 5, action: 'add', element: { libId: 'car_silhouette', layer: 'midground', opts: { x: 0.5, y: 0.38, scale: 1.3 } } },
                ],
            };
        } else {
            // Late: Accents and final touches
            return {
                summary: 'Akzente und Feinschliff',
                changes: [
                    { slideIndex: 0, action: 'add', element: { libId: 'corner_accent', layer: 'accents', opts: { size: 50, alpha: 0.25 } } },
                    { slideIndex: 2, action: 'add', element: { libId: 'gold_stripe', layer: 'accents', opts: { y: 0.47, alpha: 0.3 } } },
                    { slideIndex: 3, action: 'add', element: { libId: 'lens_flare', layer: 'atmosphere', opts: { x: 0.6, y: 0.10, size: 100 } } },
                    { slideIndex: 4, action: 'add', element: { libId: 'dust_particles', layer: 'atmosphere', opts: { count: 35, seed: currentIter * 13 } } },
                ],
            };
        }
    }

    // =========================================================================
    // Apply Critique Changes
    // =========================================================================

    function _applyCritique(project, critique, iterIndex) {
        if (!critique || !critique.changes) return;

        for (const change of critique.changes) {
            const idx = change.slideIndex;
            if (idx < 0 || idx >= 6) continue;

            if (!project._scenes[idx]) {
                const templateId = project.slides[idx]?.template || 'hero';
                project._scenes[idx] = getPreset(templateId);
            }

            const scene = project._scenes[idx];

            switch (change.action) {
                case 'add':
                    if (change.element) {
                        // Add to the appropriate position (before vignette if present)
                        const lastLayer = scene.layers[scene.layers.length - 1];
                        const hasVignette = lastLayer?.elements?.some(e => e.libId === 'vignette');

                        if (hasVignette) {
                            // Insert before vignette layer
                            scene.layers.splice(scene.layers.length - 1, 0, {
                                elements: [change.element],
                            });
                        } else {
                            scene.layers.push({ elements: [change.element] });
                        }
                    }
                    break;

                case 'modify':
                    if (change.element) {
                        // Find and update existing element
                        for (const layer of scene.layers) {
                            for (const elem of (layer.elements || [])) {
                                if (elem.libId === change.element.libId) {
                                    Object.assign(elem.opts, change.element.opts || {});
                                }
                            }
                        }
                    }
                    break;

                case 'remove':
                    if (change.element) {
                        for (const layer of scene.layers) {
                            layer.elements = (layer.elements || []).filter(
                                e => e.libId !== change.element.libId
                            );
                        }
                        // Remove empty layers
                        scene.layers = scene.layers.filter(l => l.elements && l.elements.length > 0);
                    }
                    break;
            }
        }
    }

    // =========================================================================
    // Render Helpers
    // =========================================================================

    /**
     * Render a single slide to an offscreen canvas and return data URL.
     */
    function _renderSlideToImage(project, slideIndex) {
        const canvas = document.createElement('canvas');
        canvas.width = DW;
        canvas.height = DH;
        const ctx = canvas.getContext('2d');

        const slide = project.slides[slideIndex];
        if (!slide) return canvas.toDataURL('image/jpeg', 0.7);

        // 1. Draw background gradient
        const bg = slide.background;
        if (bg) {
            if (bg.type === 'solid') {
                ctx.fillStyle = bg.color || '#1a3a5c';
                ctx.fillRect(0, 0, DW, DH);
            } else if (bg.type === 'gradient') {
                const grad = ctx.createLinearGradient(0, 0, 0, DH);
                grad.addColorStop(0, bg.from || '#1a3a5c');
                grad.addColorStop(1, bg.to || '#2c5282');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, DW, DH);
            }
        } else {
            ctx.fillStyle = '#1a3a5c';
            ctx.fillRect(0, 0, DW, DH);
        }

        // 2. Draw scene layers
        const scene = project._scenes?.[slideIndex];
        if (scene) {
            renderScene(ctx, scene, DW, DH, project.brandColors);
        }

        // 3. Draw template elements (text, devices, shapes)
        for (const el of (slide.elements || [])) {
            _drawElementSimple(ctx, el, 1);
        }

        return canvas.toDataURL('image/jpeg', 0.6);
    }

    /**
     * Create a 3x2 composite of all 6 slides for vision analysis.
     */
    function _createComposite(slideDataUrls) {
        const canvas = document.createElement('canvas');
        const thumbW = 360;
        const thumbH = 640;
        canvas.width = thumbW * 3;
        canvas.height = thumbH * 2;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let loaded = 0;
        const images = [];

        // Synchronous draw since we have data URLs
        for (let i = 0; i < Math.min(slideDataUrls.length, 6); i++) {
            const img = new Image();
            img.src = slideDataUrls[i];
            const col = i % 3;
            const row = Math.floor(i / 3);
            // Draw when available (data URLs load synchronously in most browsers)
            try {
                ctx.drawImage(img, col * thumbW, row * thumbH, thumbW, thumbH);
            } catch (e) {
                // Fill with placeholder
                ctx.fillStyle = '#1a3a5c';
                ctx.fillRect(col * thumbW, row * thumbH, thumbW, thumbH);
            }
        }

        return canvas.toDataURL('image/jpeg', 0.7);
    }

    /**
     * Simple element drawing for offscreen render (no interactivity).
     */
    function _drawElementSimple(ctx, el, scale) {
        if (el.type === 'text') {
            const x = el.x * scale;
            const y = el.y * scale;
            const fontSize = (el.fontSize || 36) * scale;
            ctx.save();
            ctx.font = `${el.fontWeight || 400} ${fontSize}px Inter, -apple-system, sans-serif`;
            ctx.fillStyle = el.color || '#ffffff';
            ctx.textAlign = el.align || 'left';
            ctx.textBaseline = 'top';
            const lines = (el.content || '').split('\n');
            const lineHeight = fontSize * 1.2;
            for (let i = 0; i < lines.length; i++) {
                let drawX = x;
                const maxW = (el.maxWidth || DW) * scale;
                if (el.align === 'center') drawX = x + maxW / 2;
                else if (el.align === 'right') drawX = x + maxW;
                ctx.fillText(lines[i], drawX, y + i * lineHeight);
            }
            ctx.restore();
        } else if (el.type === 'shape') {
            ctx.save();
            if (el.fill && el.fill !== 'none') {
                ctx.fillStyle = el.fill;
                ctx.fillRect(el.x * scale, el.y * scale, (el.w || 100) * scale, (el.h || 100) * scale);
            }
            ctx.restore();
        } else if (el.type === 'device') {
            if (typeof ShowcaseDevices !== 'undefined') {
                ShowcaseDevices.drawDevice(ctx, el.device || 'iphone', el.x * scale, el.y * scale, (el.scale || 1) * scale, null);
            }
        }
    }

    // =========================================================================
    // Utility Helpers
    // =========================================================================

    function _findLibEntry(libId, layerName) {
        const categories = {
            environment: ELEMENT_LIBRARY.environment,
            midground: ELEMENT_LIBRARY.midground,
            atmosphere: ELEMENT_LIBRARY.atmosphere,
            accents: ELEMENT_LIBRARY.accents,
        };

        // Search specified category first
        const cat = categories[layerName];
        if (cat) {
            const entry = cat.find(e => e.id === libId);
            if (entry) return entry;
        }

        // Fallback: search all categories
        for (const entries of Object.values(categories)) {
            const entry = entries.find(e => e.id === libId);
            if (entry) return entry;
        }

        return null;
    }

    /**
     * Resolve relative opts (0-1 factors) to pixel values.
     */
    function _resolveOpts(opts, w, h, primary, accent) {
        if (!opts) return {};
        const resolved = { ...opts };

        // Position factors → pixels
        const posKeys = ['x', 'y', 'baseY'];
        for (const key of posKeys) {
            if (typeof resolved[key] === 'number' && resolved[key] >= 0 && resolved[key] <= 1.0) {
                resolved[key] = key.includes('y') || key.includes('Y')
                    ? resolved[key] * h
                    : resolved[key] * w;
            }
        }

        // Height factor → pixels
        if (typeof resolved.height === 'number' && resolved.height > 0 && resolved.height <= 1.0) {
            resolved.height = resolved.height * h;
        }

        // Spread factor → pixels
        if (typeof resolved.spread === 'number' && resolved.spread > 0 && resolved.spread <= 1.0) {
            resolved.spread = resolved.spread * w;
        }

        // Size factor → pixels
        if (typeof resolved.size === 'number' && resolved.size > 0 && resolved.size <= 1.0) {
            resolved.size = resolved.size * Math.min(w, h);
        }

        // Inject brand colors if not specified
        if (!resolved.primaryColor) resolved.primaryColor = primary;
        if (!resolved.secondaryColor) resolved.secondaryColor = accent;

        return resolved;
    }

    function _seeded(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    function _rgba(hex, alpha) {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        const n = parseInt(hex, 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        return `rgba(${r},${g},${b},${alpha})`;
    }

    // =========================================================================
    // Public API
    // =========================================================================

    return {
        renderScene,
        getPreset,
        iterateWithVision,
        ELEMENT_LIBRARY,
        SCENE_PRESETS,
    };
})();
