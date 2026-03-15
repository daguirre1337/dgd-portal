/**
 * Showcase Scene Engine v2 - Premium Visual Composition
 *
 * Creates a unified, high-quality atmospheric background across all 6 slides.
 * Uses sophisticated gradients, smooth curves, premium bokeh, and abstract
 * geometric accents — NO crude/blocky shapes.
 *
 * Design philosophy:
 * - Unified panoramic feel: all slides share the same visual atmosphere
 * - Premium gradients with 5+ color stops
 * - Smooth bezier curves for landscapes
 * - Large, soft bokeh and light effects
 * - DGD brand: Dunkelblau #184E74, Gold #CAA876
 */

const ShowcaseSceneEngine = (() => {
    'use strict';

    const DW = 1080;
    const DH = 1920;

    // =========================================================================
    // Premium Element Library
    // =========================================================================

    const ELEMENT_LIBRARY = {
        // --- Layer 1: Environment (rich backgrounds, landscapes) ---
        environment: [
            {
                id: 'premium_sky',
                draw: (ctx, w, h, opts) => {
                    // Full-height opaque sky gradient - REPLACES dark template background
                    const grad = ctx.createLinearGradient(0, 0, 0, h);
                    const t = opts.theme || 0; // 0-1 shift across slides for variety
                    // Brighter, richer navy-to-blue gradient (fully opaque)
                    grad.addColorStop(0, opts.top || `rgb(${12 + t * 8},${28 + t * 10},${58 + t * 12})`);
                    grad.addColorStop(0.2, opts.mid1 || `rgb(${18 + t * 12},${42 + t * 14},${78 + t * 15})`);
                    grad.addColorStop(0.45, opts.mid2 || `rgb(${26 + t * 16},${58 + t * 18},${105 + t * 18})`);
                    grad.addColorStop(0.7, opts.mid3 || `rgb(${22 + t * 14},${48 + t * 15},${90 + t * 16})`);
                    grad.addColorStop(1, opts.bottom || `rgb(${14 + t * 10},${32 + t * 12},${65 + t * 14})`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, w, h);
                },
            },
            {
                id: 'smooth_hills',
                draw: (ctx, w, h, opts) => {
                    const baseY = (opts.baseY || 0.4) * h;
                    const amplitude = (opts.amplitude || 0.08) * h;
                    const layers = opts.layers || 3;
                    const seed = opts.seed || 42;
                    const rand = _seeded(seed);

                    for (let layer = 0; layer < layers; layer++) {
                        const layerAlpha = 0.3 + layer * 0.15;
                        const layerOffset = layer * amplitude * 0.4;
                        const r = 15 + layer * 12;
                        const g = 35 + layer * 15;
                        const b = 65 + layer * 20;

                        ctx.fillStyle = `rgba(${r},${g},${b},${layerAlpha})`;
                        ctx.beginPath();
                        ctx.moveTo(0, h);

                        // Smooth bezier curves for organic hills
                        const points = 8 + layer * 2;
                        const segW = w / points;
                        let lastY = baseY + layerOffset + rand() * amplitude;
                        ctx.lineTo(0, lastY);

                        for (let i = 1; i <= points; i++) {
                            const nextY = baseY + layerOffset + (rand() - 0.3) * amplitude;
                            const cpx1 = (i - 0.66) * segW;
                            const cpx2 = (i - 0.33) * segW;
                            const cpy1 = lastY + (rand() - 0.5) * amplitude * 0.5;
                            const cpy2 = nextY + (rand() - 0.5) * amplitude * 0.5;
                            ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, i * segW, nextY);
                            lastY = nextY;
                        }

                        ctx.lineTo(w, h);
                        ctx.closePath();
                        ctx.fill();
                    }
                },
            },
            {
                id: 'city_silhouette',
                draw: (ctx, w, h, opts) => {
                    const baseY = (opts.baseY || 0.35) * h;
                    const seed = opts.seed || 55;
                    const rand = _seeded(seed);
                    const alpha = opts.alpha || 0.25;

                    // Gradient fill for city - darker than sky for contrast
                    const grad = ctx.createLinearGradient(0, baseY - 200, 0, baseY + 50);
                    grad.addColorStop(0, `rgba(5,10,25,${alpha * 0.5})`);
                    grad.addColorStop(0.5, `rgba(8,16,38,${alpha * 0.85})`);
                    grad.addColorStop(1, `rgba(10,20,45,${alpha * 1.2})`);

                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.moveTo(0, baseY + 20);

                    // Organic city skyline with varied heights
                    let x = 0;
                    while (x < w) {
                        const bw = 30 + rand() * 60;
                        const bh = 40 + rand() * 180;
                        const gap = rand() * 15;

                        // Smooth tower tops (rounded rects via arcs)
                        const topRadius = 3 + rand() * 8;
                        ctx.lineTo(x + gap, baseY);
                        ctx.lineTo(x + gap, baseY - bh + topRadius);
                        ctx.quadraticCurveTo(x + gap, baseY - bh, x + gap + topRadius, baseY - bh);
                        ctx.lineTo(x + gap + bw - topRadius, baseY - bh);
                        ctx.quadraticCurveTo(x + gap + bw, baseY - bh, x + gap + bw, baseY - bh + topRadius);
                        ctx.lineTo(x + gap + bw, baseY);

                        x += bw + gap + rand() * 10;
                    }

                    ctx.lineTo(w, baseY + 20);
                    ctx.closePath();
                    ctx.fill();

                    // Tiny warm windows
                    ctx.fillStyle = `rgba(212,168,67,${alpha * 0.4})`;
                    const rand2 = _seeded(seed + 100);
                    x = 0;
                    const rand3 = _seeded(seed);
                    while (x < w) {
                        const bw = 30 + rand3() * 60;
                        const bh = 40 + rand3() * 180;
                        const gap = rand3() * 15;
                        rand3(); // skip

                        for (let wy = baseY - bh + 20; wy < baseY - 5; wy += 18) {
                            for (let wx = x + gap + 6; wx < x + gap + bw - 6; wx += 14) {
                                if (rand2() > 0.55) {
                                    ctx.fillRect(wx, wy, 5, 7);
                                }
                            }
                        }
                        x += bw + gap + rand3() * 10;
                    }
                },
            },
            {
                id: 'ground_plane',
                draw: (ctx, w, h, opts) => {
                    const y = (opts.y || 0.5) * h;
                    const grad = ctx.createLinearGradient(0, y, 0, h);
                    grad.addColorStop(0, opts.top || 'rgba(20,35,60,0.7)');
                    grad.addColorStop(0.3, opts.mid || 'rgba(16,28,52,0.6)');
                    grad.addColorStop(1, opts.bottom || 'rgba(12,22,45,0.45)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, y, w, h - y);

                    // Subtle reflection line
                    if (opts.reflection !== false) {
                        const reflGrad = ctx.createLinearGradient(0, y, 0, y + 3);
                        reflGrad.addColorStop(0, 'rgba(212,168,67,0.15)');
                        reflGrad.addColorStop(1, 'rgba(212,168,67,0)');
                        ctx.fillStyle = reflGrad;
                        ctx.fillRect(0, y, w, 3);
                    }
                },
            },
        ],

        // --- Layer 2: Mid-ground (abstract vehicle shapes, refined props) ---
        midground: [
            {
                id: 'car_silhouette',
                draw: (ctx, w, h, opts) => {
                    const cx = (opts.x || 0.5) * w;
                    const cy = (opts.y || 0.45) * h;
                    const s = (opts.scale || 1) * (w / DW);
                    const alpha = opts.alpha || 0.2;

                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.scale(s, s);

                    // Premium car with smooth curves
                    const carGrad = ctx.createLinearGradient(-150, -70, 150, 20);
                    carGrad.addColorStop(0, `rgba(15,25,50,${alpha * 0.6})`);
                    carGrad.addColorStop(0.5, `rgba(20,35,65,${alpha})`);
                    carGrad.addColorStop(1, `rgba(12,20,42,${alpha * 0.8})`);
                    ctx.fillStyle = carGrad;

                    ctx.beginPath();
                    // Smooth sedan profile with bezier curves
                    ctx.moveTo(-150, 5);
                    ctx.bezierCurveTo(-145, -10, -130, -25, -110, -35);
                    ctx.bezierCurveTo(-90, -50, -70, -60, -40, -65);
                    ctx.bezierCurveTo(-10, -68, 20, -68, 50, -62);
                    ctx.bezierCurveTo(75, -55, 95, -42, 110, -30);
                    ctx.bezierCurveTo(125, -20, 140, -10, 150, 0);
                    ctx.bezierCurveTo(152, 5, 148, 12, 140, 15);
                    // Bottom with wheel wells
                    ctx.bezierCurveTo(120, 15, 110, 8, 100, 15);
                    ctx.arc(85, 15, 18, 0, Math.PI, false);
                    ctx.lineTo(50, 15);
                    ctx.lineTo(-35, 15);
                    ctx.arc(-60, 15, 18, 0, Math.PI, false);
                    ctx.bezierCurveTo(-100, 8, -130, 8, -150, 5);
                    ctx.closePath();
                    ctx.fill();

                    // Windshield highlight
                    const glassGrad = ctx.createLinearGradient(-80, -60, 10, -30);
                    glassGrad.addColorStop(0, `rgba(80,130,200,${alpha * 0.5})`);
                    glassGrad.addColorStop(1, `rgba(60,100,160,${alpha * 0.15})`);
                    ctx.fillStyle = glassGrad;
                    ctx.beginPath();
                    ctx.moveTo(-35, -62);
                    ctx.bezierCurveTo(-55, -58, -80, -45, -95, -32);
                    ctx.lineTo(-40, -32);
                    ctx.bezierCurveTo(-35, -45, -33, -55, -35, -62);
                    ctx.closePath();
                    ctx.fill();

                    // Headlight glow
                    const hlGrad = ctx.createRadialGradient(145, -5, 0, 145, -5, 30);
                    hlGrad.addColorStop(0, `rgba(212,168,67,${alpha * 0.8})`);
                    hlGrad.addColorStop(0.5, `rgba(212,168,67,${alpha * 0.2})`);
                    hlGrad.addColorStop(1, `rgba(212,168,67,0)`);
                    ctx.fillStyle = hlGrad;
                    ctx.beginPath();
                    ctx.arc(145, -5, 30, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                },
            },
            {
                id: 'abstract_gauge',
                draw: (ctx, w, h, opts) => {
                    const cx = (opts.x || 0.5) * w;
                    const cy = (opts.y || 0.3) * h;
                    const r = (opts.radius || 80) * (w / DW);
                    const alpha = opts.alpha || 0.12;
                    const color = opts.color || '#CAA876';

                    ctx.save();
                    ctx.translate(cx, cy);

                    // Gauge ring
                    ctx.strokeStyle = _rgba(color, alpha);
                    ctx.lineWidth = 3 * (w / DW);
                    ctx.beginPath();
                    ctx.arc(0, 0, r, -Math.PI * 0.8, Math.PI * 0.8);
                    ctx.stroke();

                    // Tick marks
                    ctx.strokeStyle = _rgba(color, alpha * 0.7);
                    ctx.lineWidth = 2 * (w / DW);
                    for (let a = -0.8; a <= 0.8; a += 0.2) {
                        const angle = Math.PI * a;
                        ctx.beginPath();
                        ctx.moveTo(Math.cos(angle) * r * 0.85, Math.sin(angle) * r * 0.85);
                        ctx.lineTo(Math.cos(angle) * r * 0.95, Math.sin(angle) * r * 0.95);
                        ctx.stroke();
                    }

                    // Needle
                    const needleAngle = Math.PI * (opts.needlePos || 0.3);
                    ctx.strokeStyle = _rgba(color, alpha * 1.5);
                    ctx.lineWidth = 2.5 * (w / DW);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(needleAngle) * r * 0.75, Math.sin(needleAngle) * r * 0.75);
                    ctx.stroke();

                    // Center dot
                    ctx.fillStyle = _rgba(color, alpha);
                    ctx.beginPath();
                    ctx.arc(0, 0, 4 * (w / DW), 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                },
            },
            {
                id: 'shield_icon',
                draw: (ctx, w, h, opts) => {
                    const cx = (opts.x || 0.5) * w;
                    const cy = (opts.y || 0.3) * h;
                    const s = (opts.scale || 1) * (w / DW);
                    const alpha = opts.alpha || 0.1;
                    const color = opts.color || '#CAA876';

                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.scale(s, s);

                    // Shield shape
                    ctx.strokeStyle = _rgba(color, alpha);
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(0, -50);
                    ctx.bezierCurveTo(-35, -45, -45, -30, -45, -10);
                    ctx.bezierCurveTo(-45, 15, -30, 35, 0, 50);
                    ctx.bezierCurveTo(30, 35, 45, 15, 45, -10);
                    ctx.bezierCurveTo(45, -30, 35, -45, 0, -50);
                    ctx.closePath();
                    ctx.stroke();

                    // Checkmark inside
                    ctx.strokeStyle = _rgba(color, alpha * 1.3);
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(-15, 5);
                    ctx.lineTo(-3, 18);
                    ctx.lineTo(18, -12);
                    ctx.stroke();

                    ctx.restore();
                },
            },
        ],

        // --- Layer 3: Atmosphere (premium light effects) ---
        atmosphere: [
            {
                id: 'light_beam',
                draw: (ctx, w, h, opts) => {
                    const x = (opts.x || 0.3) * w;
                    const spread = (opts.spread || 0.25) * w;
                    const alpha = opts.alpha || 0.04;
                    const color = opts.color || '#CAA876';
                    const reachY = (opts.reach || 0.75) * h;

                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';

                    const grad = ctx.createLinearGradient(x, 0, x, reachY);
                    grad.addColorStop(0, _rgba(color, alpha * 2.5));
                    grad.addColorStop(0.3, _rgba(color, alpha * 1.5));
                    grad.addColorStop(0.7, _rgba(color, alpha * 0.5));
                    grad.addColorStop(1, _rgba(color, 0));
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.moveTo(x - 15, 0);
                    ctx.lineTo(x - spread, reachY);
                    ctx.lineTo(x + spread, reachY);
                    ctx.lineTo(x + 15, 0);
                    ctx.closePath();
                    ctx.fill();

                    ctx.restore();
                },
            },
            {
                id: 'premium_bokeh',
                draw: (ctx, w, h, opts) => {
                    const count = opts.count || 20;
                    const rand = _seeded(opts.seed || 99);
                    const maxY = (opts.maxY || 0.7) * h;

                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';

                    for (let i = 0; i < count; i++) {
                        const bx = rand() * w;
                        const by = rand() * maxY;
                        const br = (12 + rand() * 55) * (w / DW);
                        const alpha = 0.04 + rand() * 0.1;
                        const isGold = rand() > 0.4;
                        const color = isGold
                            ? (opts.goldColor || '#CAA876')
                            : (opts.blueColor || '#4A90C4');

                        // Soft gaussian-like bokeh
                        const radGrad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
                        radGrad.addColorStop(0, _rgba(color, alpha * 2));
                        radGrad.addColorStop(0.3, _rgba(color, alpha * 1.2));
                        radGrad.addColorStop(0.7, _rgba(color, alpha * 0.3));
                        radGrad.addColorStop(1, _rgba(color, 0));
                        ctx.fillStyle = radGrad;
                        ctx.beginPath();
                        ctx.arc(bx, by, br, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();
                },
            },
            {
                id: 'dust_particles',
                draw: (ctx, w, h, opts) => {
                    const count = opts.count || 50;
                    const rand = _seeded(opts.seed || 123);

                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';

                    for (let i = 0; i < count; i++) {
                        const px = rand() * w;
                        const py = rand() * h;
                        const pr = (1 + rand() * 2.5) * (w / DW);
                        const alpha = 0.05 + rand() * 0.15;
                        const radGrad = ctx.createRadialGradient(px, py, 0, px, py, pr * 3);
                        radGrad.addColorStop(0, `rgba(255,255,255,${alpha})`);
                        radGrad.addColorStop(1, 'rgba(255,255,255,0)');
                        ctx.fillStyle = radGrad;
                        ctx.beginPath();
                        ctx.arc(px, py, pr * 3, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();
                },
            },
            {
                id: 'color_overlay',
                draw: (ctx, w, h, opts) => {
                    const color = opts.color || '#184E74';
                    const alpha = opts.alpha || 0.1;
                    ctx.fillStyle = _rgba(color, alpha);
                    ctx.fillRect(0, 0, w, h);
                },
            },
            {
                id: 'vignette',
                draw: (ctx, w, h, opts) => {
                    const strength = opts.strength || 0.3;
                    const radGrad = ctx.createRadialGradient(
                        w / 2, h / 2, Math.min(w, h) * 0.35,
                        w / 2, h / 2, Math.max(w, h) * 0.75
                    );
                    radGrad.addColorStop(0, 'rgba(0,0,0,0)');
                    radGrad.addColorStop(0.6, `rgba(0,0,0,${strength * 0.3})`);
                    radGrad.addColorStop(1, `rgba(0,0,0,${strength})`);
                    ctx.fillStyle = radGrad;
                    ctx.fillRect(0, 0, w, h);
                },
            },
            {
                id: 'lens_flare',
                draw: (ctx, w, h, opts) => {
                    const cx = (opts.x || 0.7) * w;
                    const cy = (opts.y || 0.12) * h;
                    const size = (opts.size || 150) * (w / DW);
                    const color = opts.color || '#CAA876';

                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';

                    // Main soft glow
                    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
                    grad.addColorStop(0, _rgba(color, 0.25));
                    grad.addColorStop(0.15, _rgba(color, 0.12));
                    grad.addColorStop(0.4, _rgba(color, 0.04));
                    grad.addColorStop(1, _rgba(color, 0));
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, size, 0, Math.PI * 2);
                    ctx.fill();

                    // Bright center
                    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.12);
                    coreGrad.addColorStop(0, _rgba('#ffffff', 0.3));
                    coreGrad.addColorStop(1, _rgba('#ffffff', 0));
                    ctx.fillStyle = coreGrad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, size * 0.12, 0, Math.PI * 2);
                    ctx.fill();

                    // Secondary rings along light path
                    for (let i = 1; i <= 4; i++) {
                        const rx = cx + (w * 0.5 - cx) * i * 0.22;
                        const ry = cy + (h * 0.5 - cy) * i * 0.22;
                        const rs = size * (0.2 - i * 0.03);
                        if (rs < 5) continue;
                        const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, rs);
                        rg.addColorStop(0, _rgba(color, 0.05));
                        rg.addColorStop(0.5, _rgba(color, 0.02));
                        rg.addColorStop(1, _rgba(color, 0));
                        ctx.fillStyle = rg;
                        ctx.beginPath();
                        ctx.arc(rx, ry, rs, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();
                },
            },
            {
                id: 'ambient_glow',
                draw: (ctx, w, h, opts) => {
                    const cx = (opts.x || 0.5) * w;
                    const cy = (opts.y || 0.4) * h;
                    const size = (opts.size || 400) * (w / DW);
                    const color = opts.color || '#3A6EA5';
                    const alpha = opts.alpha || 0.2;

                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';

                    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
                    grad.addColorStop(0, _rgba(color, alpha * 1.5));
                    grad.addColorStop(0.4, _rgba(color, alpha * 0.7));
                    grad.addColorStop(1, _rgba(color, 0));
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, size, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                },
            },
        ],

        // --- Layer 5: Accents (refined decorative touches) ---
        accents: [
            {
                id: 'gold_stripe',
                draw: (ctx, w, h, opts) => {
                    const y = (opts.y || 0.48) * h;
                    const thickness = (opts.thickness || 2) * (w / DW);
                    const color = opts.color || '#CAA876';
                    const alpha = opts.alpha || 0.3;

                    // Gradient stripe that fades at edges
                    const grad = ctx.createLinearGradient(0, y, w, y);
                    grad.addColorStop(0, _rgba(color, 0));
                    grad.addColorStop(0.15, _rgba(color, alpha));
                    grad.addColorStop(0.85, _rgba(color, alpha));
                    grad.addColorStop(1, _rgba(color, 0));
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, y - thickness / 2, w, thickness);

                    // Glow around stripe
                    const glowGrad = ctx.createLinearGradient(0, y - 15, 0, y + 15);
                    glowGrad.addColorStop(0, _rgba(color, 0));
                    glowGrad.addColorStop(0.5, _rgba(color, alpha * 0.15));
                    glowGrad.addColorStop(1, _rgba(color, 0));
                    ctx.fillStyle = glowGrad;
                    ctx.fillRect(w * 0.1, y - 15, w * 0.8, 30);
                },
            },
            {
                id: 'corner_accent',
                draw: (ctx, w, h, opts) => {
                    const size = (opts.size || 50) * (w / DW);
                    const color = opts.color || '#CAA876';
                    const alpha = opts.alpha || 0.2;
                    const margin = (opts.margin || 25) * (w / DW);
                    const lineW = 1.5 * (w / DW);

                    ctx.strokeStyle = _rgba(color, alpha);
                    ctx.lineWidth = lineW;
                    ctx.lineCap = 'round';

                    // Top-left
                    ctx.beginPath();
                    ctx.moveTo(margin, margin + size);
                    ctx.lineTo(margin, margin);
                    ctx.lineTo(margin + size, margin);
                    ctx.stroke();

                    // Top-right
                    ctx.beginPath();
                    ctx.moveTo(w - margin - size, margin);
                    ctx.lineTo(w - margin, margin);
                    ctx.lineTo(w - margin, margin + size);
                    ctx.stroke();

                    // Bottom-left
                    ctx.beginPath();
                    ctx.moveTo(margin, h - margin - size);
                    ctx.lineTo(margin, h - margin);
                    ctx.lineTo(margin + size, h - margin);
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
                id: 'diagonal_lines',
                draw: (ctx, w, h, opts) => {
                    const color = opts.color || '#CAA876';
                    const alpha = opts.alpha || 0.04;
                    const count = opts.count || 6;
                    const lineW = (opts.lineWidth || 1) * (w / DW);

                    ctx.save();
                    ctx.strokeStyle = _rgba(color, alpha);
                    ctx.lineWidth = lineW;

                    for (let i = 0; i < count; i++) {
                        const offset = (w / (count + 1)) * (i + 1);
                        ctx.beginPath();
                        ctx.moveTo(offset, 0);
                        ctx.lineTo(offset - h * 0.2, h);
                        ctx.stroke();
                    }

                    ctx.restore();
                },
            },
            {
                id: 'gradient_border',
                draw: (ctx, w, h, opts) => {
                    const thickness = (opts.thickness || 3) * (w / DW);
                    const color = opts.color || '#CAA876';
                    const alpha = opts.alpha || 0.15;
                    const margin = (opts.margin || 15) * (w / DW);

                    ctx.save();
                    ctx.strokeStyle = _rgba(color, alpha);
                    ctx.lineWidth = thickness;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';

                    // Rounded rect border with gradient fade
                    const r = 12 * (w / DW);
                    ctx.beginPath();
                    ctx.moveTo(margin + r, margin);
                    ctx.lineTo(w - margin - r, margin);
                    ctx.quadraticCurveTo(w - margin, margin, w - margin, margin + r);
                    ctx.lineTo(w - margin, h - margin - r);
                    ctx.quadraticCurveTo(w - margin, h - margin, w - margin - r, h - margin);
                    ctx.lineTo(margin + r, h - margin);
                    ctx.quadraticCurveTo(margin, h - margin, margin, h - margin - r);
                    ctx.lineTo(margin, margin + r);
                    ctx.quadraticCurveTo(margin, margin, margin + r, margin);
                    ctx.closePath();
                    ctx.stroke();

                    ctx.restore();
                },
            },
        ],
    };

    // =========================================================================
    // Unified Scene Presets - Rich from the start!
    // =========================================================================

    const SCENE_PRESETS = {
        hero: {
            layers: [
                { elements: [
                    { libId: 'premium_sky', layer: 'environment', opts: { theme: 0 } },
                    { libId: 'smooth_hills', layer: 'environment', opts: { baseY: 0.42, amplitude: 0.06, layers: 3, seed: 42 } },
                    { libId: 'ground_plane', layer: 'environment', opts: { y: 0.52 } },
                    { libId: 'ambient_glow', layer: 'atmosphere', opts: { x: 0.5, y: 0.3, size: 500, color: '#184E74', alpha: 0.12 } },
                    { libId: 'premium_bokeh', layer: 'atmosphere', opts: { count: 12, seed: 42 } },
                    { libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.3 } },
                ] },
            ],
        },
        feature: {
            layers: [
                { elements: [
                    { libId: 'premium_sky', layer: 'environment', opts: { theme: 0.2 } },
                    { libId: 'smooth_hills', layer: 'environment', opts: { baseY: 0.4, amplitude: 0.07, layers: 3, seed: 55 } },
                    { libId: 'ground_plane', layer: 'environment', opts: { y: 0.5 } },
                    { libId: 'ambient_glow', layer: 'atmosphere', opts: { x: 0.6, y: 0.35, size: 400, color: '#CAA876', alpha: 0.06 } },
                    { libId: 'premium_bokeh', layer: 'atmosphere', opts: { count: 10, seed: 55 } },
                    { libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.28 } },
                ] },
            ],
        },
        split: {
            layers: [
                { elements: [
                    { libId: 'premium_sky', layer: 'environment', opts: { theme: 0.4 } },
                    { libId: 'smooth_hills', layer: 'environment', opts: { baseY: 0.45, amplitude: 0.05, layers: 2, seed: 70 } },
                    { libId: 'ground_plane', layer: 'environment', opts: { y: 0.55 } },
                    { libId: 'ambient_glow', layer: 'atmosphere', opts: { x: 0.3, y: 0.4, size: 350, color: '#184E74', alpha: 0.1 } },
                    { libId: 'premium_bokeh', layer: 'atmosphere', opts: { count: 8, seed: 70 } },
                    { libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.25 } },
                ] },
            ],
        },
        fullscreen: {
            layers: [
                { elements: [
                    { libId: 'premium_sky', layer: 'environment', opts: { theme: 0.6 } },
                    { libId: 'smooth_hills', layer: 'environment', opts: { baseY: 0.38, amplitude: 0.08, layers: 3, seed: 85 } },
                    { libId: 'ground_plane', layer: 'environment', opts: { y: 0.48 } },
                    { libId: 'ambient_glow', layer: 'atmosphere', opts: { x: 0.5, y: 0.25, size: 450, color: '#CAA876', alpha: 0.08 } },
                    { libId: 'premium_bokeh', layer: 'atmosphere', opts: { count: 15, seed: 85 } },
                    { libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.3 } },
                ] },
            ],
        },
        comparison: {
            layers: [
                { elements: [
                    { libId: 'premium_sky', layer: 'environment', opts: { theme: 0.8 } },
                    { libId: 'smooth_hills', layer: 'environment', opts: { baseY: 0.43, amplitude: 0.06, layers: 2, seed: 100 } },
                    { libId: 'ground_plane', layer: 'environment', opts: { y: 0.53 } },
                    { libId: 'ambient_glow', layer: 'atmosphere', opts: { x: 0.5, y: 0.35, size: 380, color: '#184E74', alpha: 0.1 } },
                    { libId: 'premium_bokeh', layer: 'atmosphere', opts: { count: 10, seed: 100 } },
                    { libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.28 } },
                ] },
            ],
        },
    };

    // =========================================================================
    // Core: Render scene layers onto a canvas
    // =========================================================================

    function renderScene(ctx, scene, w, h, colors, options) {
        if (!scene || !scene.layers) return;

        const primary = colors?.primary || '#184E74';
        const accent = colors?.accent || '#CAA876';
        const skipEnvironment = options?.skipEnvironment || false;

        for (const layer of scene.layers) {
            if (!layer.elements) continue;
            for (const elem of layer.elements) {
                // Skip environment-layer elements when DALL-E panorama is active
                if (skipEnvironment && elem.layer === 'environment') continue;

                const libEntry = _findLibEntry(elem.libId, elem.layer);
                if (!libEntry) continue;

                const resolvedOpts = _resolveOpts(elem.opts, w, h, primary, accent);
                try {
                    libEntry.draw(ctx, w, h, resolvedOpts);
                } catch (e) {
                    console.warn(`[SceneEngine] Draw error for ${elem.libId}:`, e);
                }
            }
        }
    }

    function getPreset(templateId) {
        const preset = SCENE_PRESETS[templateId] || SCENE_PRESETS.hero;
        return JSON.parse(JSON.stringify(preset));
    }

    // =========================================================================
    // AI Vision Iteration Loop
    // =========================================================================

    async function iterateWithVision(project, options = {}) {
        const iterations = options.iterations || 5;
        const apiKey = options.apiKey || '';
        const targetAudience = options.targetAudience || 'Kfz-Betriebe, Autowerkstaetten, Gutachter';
        const onProgress = options.onProgress || (() => {});

        // Initialize scenes for each slide with rich presets
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

            // 3. Get critique (AI or procedural)
            let critique = null;
            if (apiKey) {
                try {
                    critique = await _visionCritique(compositeDataUrl, project, iter, iterations, targetAudience, apiKey);
                } catch (e) {
                    console.warn(`[SceneEngine] Vision critique failed (iter ${iter + 1}):`, e.message);
                }
            }

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

            // 4. Apply changes
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

        const availableElements = `
- Environment: premium_sky, smooth_hills, city_silhouette, ground_plane
- Midground: car_silhouette, abstract_gauge, shield_icon
- Atmosphere: light_beam, premium_bokeh, dust_particles, color_overlay, vignette, lens_flare, ambient_glow
- Accents: gold_stripe, corner_accent, diagonal_lines, gradient_border`;

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
Marke: DGD Direkt (Kfz-Schadenmanagement) - Dunkelblau #184E74, Gold #CAA876

Dies ist Iteration ${currentIter + 1} von ${totalIters}. Fruehe Iterationen: Feinschliff. Spaetere: Akzente und Details.

Aktuelle Szenen-Elemente pro Slide:
${layerSummary}

Slides:
${slidesSummary}

Verfuegbare Elemente:${availableElements}

Antworte NUR mit kompaktem JSON. Kurze opts.

Format: {"summary":"text","changes":[{"slideIndex":0,"action":"add","element":{"libId":"id","layer":"atmosphere","opts":{"x":0.5}}}]}

Regeln:
- Max 4 Aenderungen pro Iteration (KURZ halten!)
- opts: nur x, y, scale, alpha, seed, count, size als Zahlen (0.0-1.0)
- Einheitliche Atmosphaere ueber alle Slides`,
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `Slides 1-6 fuer ${targetAudience}. Iter ${currentIter + 1}/${totalIters}. Max 4 kompakte Aenderungen als JSON.`,
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
                max_tokens: 600,
                temperature: 0.4,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            throw new Error(`OpenAI Vision API error ${response.status}: ${errBody.slice(0, 200)}`);
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '';

        // Debug log raw response
        console.log('[SceneEngine] GPT-4o raw response:', content.slice(0, 500));

        // Clean up response - remove markdown fences, leading text
        content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

        // Try multiple parsing strategies
        // 1. Direct parse
        try {
            return JSON.parse(content);
        } catch { /* continue */ }

        // 2. Extract JSON object between first { and last }
        const braceStart = content.indexOf('{');
        const braceEnd = content.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd > braceStart) {
            try {
                return JSON.parse(content.slice(braceStart, braceEnd + 1));
            } catch { /* continue */ }

            // 3. Try fixing common issues (trailing commas, etc.)
            try {
                let cleaned = content.slice(braceStart, braceEnd + 1);
                cleaned = cleaned.replace(/,\s*([}\]])/g, '$1'); // remove trailing commas
                cleaned = cleaned.replace(/'/g, '"'); // single to double quotes
                return JSON.parse(cleaned);
            } catch { /* continue */ }
        }

        console.warn('[SceneEngine] Could not parse response:', content.slice(0, 300));
        throw new Error('Could not parse vision critique response');
    }

    // =========================================================================
    // Procedural Critique Fallback
    // =========================================================================

    function _proceduralCritique(currentIter, _totalIters) {
        const PHASES = [
            // Phase 1: Add city silhouettes for urban/automotive feel
            {
                summary: 'Stadtsilhouetten fuer urbane Kfz-Atmosphaere',
                changes: [
                    { slideIndex: 0, action: 'add', element: { libId: 'city_silhouette', layer: 'environment', opts: { baseY: 0.38, seed: 42, alpha: 0.2 } } },
                    { slideIndex: 1, action: 'add', element: { libId: 'city_silhouette', layer: 'environment', opts: { baseY: 0.36, seed: 55, alpha: 0.18 } } },
                    { slideIndex: 2, action: 'add', element: { libId: 'city_silhouette', layer: 'environment', opts: { baseY: 0.40, seed: 70, alpha: 0.15 } } },
                    { slideIndex: 3, action: 'add', element: { libId: 'city_silhouette', layer: 'environment', opts: { baseY: 0.34, seed: 85, alpha: 0.2 } } },
                    { slideIndex: 4, action: 'add', element: { libId: 'city_silhouette', layer: 'environment', opts: { baseY: 0.39, seed: 100, alpha: 0.17 } } },
                    { slideIndex: 5, action: 'add', element: { libId: 'city_silhouette', layer: 'environment', opts: { baseY: 0.37, seed: 115, alpha: 0.2 } } },
                ],
            },
            // Phase 2: Vehicles, shields, and light beams
            {
                summary: 'Fahrzeuge und Lichtstrahlen platzieren',
                changes: [
                    { slideIndex: 0, action: 'add', element: { libId: 'light_beam', layer: 'atmosphere', opts: { x: 0.5, spread: 0.3, alpha: 0.04 } } },
                    { slideIndex: 0, action: 'add', element: { libId: 'car_silhouette', layer: 'midground', opts: { x: 0.3, y: 0.5, scale: 1.1, alpha: 0.15 } } },
                    { slideIndex: 1, action: 'add', element: { libId: 'light_beam', layer: 'atmosphere', opts: { x: 0.65, spread: 0.22, alpha: 0.035 } } },
                    { slideIndex: 2, action: 'add', element: { libId: 'shield_icon', layer: 'midground', opts: { x: 0.15, y: 0.35, scale: 1.2, alpha: 0.08 } } },
                    { slideIndex: 3, action: 'add', element: { libId: 'car_silhouette', layer: 'midground', opts: { x: 0.55, y: 0.48, scale: 1.4, alpha: 0.12 } } },
                    { slideIndex: 4, action: 'add', element: { libId: 'light_beam', layer: 'atmosphere', opts: { x: 0.35, spread: 0.25, alpha: 0.04 } } },
                    { slideIndex: 5, action: 'add', element: { libId: 'lens_flare', layer: 'atmosphere', opts: { x: 0.5, y: 0.08, size: 130 } } },
                ],
            },
            // Phase 3: Lens flares and dust particles for depth
            {
                summary: 'Lens Flares und Partikel fuer Tiefe',
                changes: [
                    { slideIndex: 0, action: 'add', element: { libId: 'lens_flare', layer: 'atmosphere', opts: { x: 0.75, y: 0.1, size: 160 } } },
                    { slideIndex: 1, action: 'add', element: { libId: 'dust_particles', layer: 'atmosphere', opts: { count: 40, seed: 88 } } },
                    { slideIndex: 2, action: 'add', element: { libId: 'lens_flare', layer: 'atmosphere', opts: { x: 0.8, y: 0.12, size: 120 } } },
                    { slideIndex: 3, action: 'add', element: { libId: 'dust_particles', layer: 'atmosphere', opts: { count: 35, seed: 200 } } },
                    { slideIndex: 4, action: 'add', element: { libId: 'lens_flare', layer: 'atmosphere', opts: { x: 0.6, y: 0.15, size: 100 } } },
                    { slideIndex: 5, action: 'add', element: { libId: 'dust_particles', layer: 'atmosphere', opts: { count: 30, seed: 150 } } },
                ],
            },
            // Phase 4: Gold accents and gauges
            {
                summary: 'Gold-Akzente und Brandingelemente',
                changes: [
                    { slideIndex: 0, action: 'add', element: { libId: 'corner_accent', layer: 'accents', opts: { size: 45, alpha: 0.2 } } },
                    { slideIndex: 1, action: 'add', element: { libId: 'gold_stripe', layer: 'accents', opts: { y: 0.46, alpha: 0.25 } } },
                    { slideIndex: 2, action: 'add', element: { libId: 'abstract_gauge', layer: 'midground', opts: { x: 0.85, y: 0.25, radius: 60, alpha: 0.08 } } },
                    { slideIndex: 3, action: 'add', element: { libId: 'corner_accent', layer: 'accents', opts: { size: 40, alpha: 0.18 } } },
                    { slideIndex: 4, action: 'add', element: { libId: 'shield_icon', layer: 'midground', opts: { x: 0.85, y: 0.2, scale: 0.8, alpha: 0.07 } } },
                    { slideIndex: 5, action: 'add', element: { libId: 'corner_accent', layer: 'accents', opts: { size: 50, alpha: 0.22 } } },
                    { slideIndex: 5, action: 'add', element: { libId: 'gold_stripe', layer: 'accents', opts: { y: 0.92, alpha: 0.2 } } },
                ],
            },
            // Phase 5: Final polish - gradient borders, diagonal lines, bokeh boost
            {
                summary: 'Finaler Feinschliff und Rahmen',
                changes: [
                    { slideIndex: 0, action: 'add', element: { libId: 'gradient_border', layer: 'accents', opts: { alpha: 0.08 } } },
                    { slideIndex: 1, action: 'add', element: { libId: 'diagonal_lines', layer: 'accents', opts: { count: 5, alpha: 0.03 } } },
                    { slideIndex: 2, action: 'add', element: { libId: 'dust_particles', layer: 'atmosphere', opts: { count: 25, seed: 333 } } },
                    { slideIndex: 3, action: 'add', element: { libId: 'gradient_border', layer: 'accents', opts: { alpha: 0.07 } } },
                    { slideIndex: 4, action: 'add', element: { libId: 'dust_particles', layer: 'atmosphere', opts: { count: 20, seed: 444 } } },
                    { slideIndex: 5, action: 'add', element: { libId: 'gradient_border', layer: 'accents', opts: { alpha: 0.09 } } },
                    { slideIndex: 0, action: 'modify', element: { libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.35 } } },
                    { slideIndex: 3, action: 'modify', element: { libId: 'vignette', layer: 'atmosphere', opts: { strength: 0.35 } } },
                ],
            },
        ];

        const idx = Math.min(currentIter, PHASES.length - 1);
        return PHASES[idx];
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
                        // Add element to the first (and usually only) layer group
                        if (scene.layers.length > 0) {
                            scene.layers[0].elements.push(change.element);
                        } else {
                            scene.layers.push({ elements: [change.element] });
                        }
                    }
                    break;

                case 'modify':
                    if (change.element) {
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
                        scene.layers = scene.layers.filter(l => l.elements && l.elements.length > 0);
                    }
                    break;
            }
        }
    }

    // =========================================================================
    // Render Helpers
    // =========================================================================

    function _renderSlideToImage(project, slideIndex) {
        // Use SMALL resolution for vision analysis (keeps data URLs small)
        const rw = 360;
        const rh = 640;
        const scaleX = rw / DW;
        const scaleY = rh / DH;

        const canvas = document.createElement('canvas');
        canvas.width = rw;
        canvas.height = rh;
        const ctx = canvas.getContext('2d');

        const slide = project.slides[slideIndex];
        if (!slide) return canvas.toDataURL('image/jpeg', 0.5);

        // 1. Draw background gradient
        const bg = slide.background;
        if (bg) {
            if (bg.type === 'solid') {
                ctx.fillStyle = bg.color || '#184E74';
                ctx.fillRect(0, 0, rw, rh);
            } else if (bg.type === 'gradient') {
                const grad = ctx.createLinearGradient(0, 0, 0, rh);
                grad.addColorStop(0, bg.from || '#184E74');
                grad.addColorStop(1, bg.to || '#2c5282');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, rw, rh);
            }
        } else {
            ctx.fillStyle = '#184E74';
            ctx.fillRect(0, 0, rw, rh);
        }

        // 2. Draw scene layers (at reduced size)
        const scene = project._scenes?.[slideIndex];
        if (scene) {
            renderScene(ctx, scene, rw, rh, project.brandColors);
        }

        // 3. Draw template elements (scaled down)
        const scale = Math.min(scaleX, scaleY);
        for (const el of (slide.elements || [])) {
            _drawElementSimple(ctx, el, scale);
        }

        return canvas.toDataURL('image/jpeg', 0.5);
    }

    function _createComposite(slideDataUrls) {
        const canvas = document.createElement('canvas');
        const thumbW = 360;
        const thumbH = 640;
        canvas.width = thumbW * 3;
        canvas.height = thumbH * 2;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#0a1628';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < Math.min(slideDataUrls.length, 6); i++) {
            const img = new Image();
            img.src = slideDataUrls[i];
            const col = i % 3;
            const row = Math.floor(i / 3);
            try {
                ctx.drawImage(img, col * thumbW, row * thumbH, thumbW, thumbH);
            } catch (e) {
                ctx.fillStyle = '#184E74';
                ctx.fillRect(col * thumbW, row * thumbH, thumbW, thumbH);
            }
        }

        return canvas.toDataURL('image/jpeg', 0.7);
    }

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
            ctx.fillStyle = el.fill || 'rgba(0,0,0,0.5)';
            ctx.fillRect(el.x * scale, el.y * scale, (el.w || 100) * scale, (el.h || 100) * scale);
            ctx.restore();
        }
    }

    // =========================================================================
    // Utility Helpers
    // =========================================================================

    function _findLibEntry(libId, layerHint) {
        // Search in hinted layer first, then all layers
        const layerOrder = layerHint
            ? [layerHint, ...Object.keys(ELEMENT_LIBRARY).filter(k => k !== layerHint)]
            : Object.keys(ELEMENT_LIBRARY);

        for (const layerKey of layerOrder) {
            const layer = ELEMENT_LIBRARY[layerKey];
            if (!layer) continue;
            const entry = layer.find(e => e.id === libId);
            if (entry) return entry;
        }
        return null;
    }

    function _resolveOpts(opts, w, h, primary, accent) {
        if (!opts) return {};
        const resolved = { ...opts };
        // Replace color tokens
        if (resolved.color === 'primary') resolved.color = primary;
        if (resolved.color === 'accent') resolved.color = accent;
        return resolved;
    }

    function _seeded(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return s / 2147483647;
        };
    }

    function _rgba(hex, alpha) {
        if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
            // Already rgb/rgba - just replace alpha
            const match = hex.match(/[\d.]+/g);
            if (match && match.length >= 3) {
                return `rgba(${match[0]},${match[1]},${match[2]},${alpha})`;
            }
        }
        // Hex to rgba
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
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
        DW,
        DH,
    };
})();
