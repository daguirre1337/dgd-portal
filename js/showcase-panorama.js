/**
 * ShowcasePanorama - Procedural Panorama Background Generator
 * Generates a single 6480x1920 canvas that spans all 6 App Store slides seamlessly.
 */
const ShowcasePanorama = (() => {
    // Design constants
    const DW = 1080;
    const DH = 1920;
    const TOTAL_W = 6480; // 6 slides * 1080

    // --- Color utility helpers ---

    function hexToRgb(hex) {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const n = parseInt(hex, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    }

    function darken(hex, percent) {
        const { r, g, b } = hexToRgb(hex);
        const f = 1 - percent / 100;
        return rgbToHex(r * f, g * f, b * f);
    }

    function lighten(hex, percent) {
        const { r, g, b } = hexToRgb(hex);
        const f = percent / 100;
        return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
    }

    function rgba(hex, alpha) {
        const { r, g, b } = hexToRgb(hex);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    // --- Seeded pseudo-random for deterministic output per mood ---

    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    function seedFromMood(mood) {
        let h = 0;
        for (let i = 0; i < mood.length; i++) {
            h = ((h << 5) - h + mood.charCodeAt(i)) | 0;
        }
        return Math.abs(h) || 42;
    }

    // --- Flowing curves that span the entire panorama for continuity ---

    function drawFlowingCurves(ctx, primary, accent, rand, count = 4) {
        for (let i = 0; i < count; i++) {
            ctx.beginPath();
            const yBase = DH * 0.2 + rand() * DH * 0.6;
            const amplitude = 100 + rand() * 200;
            const color = i % 2 === 0 ? primary : accent;
            ctx.strokeStyle = rgba(color, 0.06 + rand() * 0.08);
            ctx.lineWidth = 2 + rand() * 4;

            ctx.moveTo(0, yBase);
            const segments = 12 + Math.floor(rand() * 8);
            const segW = TOTAL_W / segments;
            for (let s = 1; s <= segments; s++) {
                const cpx = (s - 0.5) * segW;
                const cpy = yBase + (rand() - 0.5) * amplitude * 2;
                const ex = s * segW;
                const ey = yBase + (rand() - 0.5) * amplitude;
                ctx.quadraticCurveTo(cpx, cpy, ex, ey);
            }
            ctx.stroke();
        }
    }

    // --- Mood renderers ---

    function renderProfessional(ctx, primary, accent, rand) {
        // Dark blue gradient background
        const base = darken(primary, 70);
        const mid = darken(primary, 50);
        const grad = ctx.createLinearGradient(0, 0, TOTAL_W, DH);
        grad.addColorStop(0, base);
        grad.addColorStop(0.5, mid);
        grad.addColorStop(1, darken(primary, 60));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, TOTAL_W, DH);

        // Subtle geometric circles
        for (let i = 0; i < 30; i++) {
            const x = rand() * TOTAL_W;
            const y = rand() * DH;
            const r = 30 + rand() * 150;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(lighten(primary, 30), 0.05 + rand() * 0.08);
            ctx.lineWidth = 1 + rand() * 2;
            ctx.stroke();
        }

        // Subtle horizontal lines
        for (let i = 0; i < 15; i++) {
            const y = rand() * DH;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(TOTAL_W, y);
            ctx.strokeStyle = rgba(lighten(primary, 20), 0.03 + rand() * 0.04);
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        drawFlowingCurves(ctx, lighten(primary, 40), accent, rand, 5);
    }

    function renderPlayful(ctx, primary, accent, rand) {
        // Vibrant gradient
        const grad = ctx.createLinearGradient(0, 0, TOTAL_W, DH);
        grad.addColorStop(0, primary);
        grad.addColorStop(0.5, lighten(primary, 20));
        grad.addColorStop(1, accent);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, TOTAL_W, DH);

        // Soft blobs / bubbles
        for (let i = 0; i < 50; i++) {
            const x = rand() * TOTAL_W;
            const y = rand() * DH;
            const r = 20 + rand() * 120;
            const color = i % 3 === 0 ? accent : lighten(primary, 30 + rand() * 30);
            const radGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
            radGrad.addColorStop(0, rgba(color, 0.12 + rand() * 0.08));
            radGrad.addColorStop(1, rgba(color, 0));
            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        drawFlowingCurves(ctx, lighten(accent, 20), lighten(primary, 40), rand, 6);
    }

    function renderMinimal(ctx, primary, accent, rand) {
        // Very subtle gradient
        const grad = ctx.createLinearGradient(0, 0, 0, DH);
        grad.addColorStop(0, lighten(primary, 90));
        grad.addColorStop(1, lighten(primary, 80));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, TOTAL_W, DH);

        // A few very faint shapes
        for (let i = 0; i < 8; i++) {
            const x = rand() * TOTAL_W;
            const y = rand() * DH;
            const r = 80 + rand() * 200;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = rgba(primary, 0.02 + rand() * 0.03);
            ctx.fill();
        }

        drawFlowingCurves(ctx, primary, accent, rand, 2);
    }

    function renderBold(ctx, primary, accent, rand) {
        // Strong diagonal gradient
        const grad = ctx.createLinearGradient(0, 0, TOTAL_W, DH);
        grad.addColorStop(0, darken(primary, 20));
        grad.addColorStop(0.4, primary);
        grad.addColorStop(0.7, accent);
        grad.addColorStop(1, darken(accent, 30));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, TOTAL_W, DH);

        // Large geometric overlays (triangles, rectangles)
        for (let i = 0; i < 12; i++) {
            const x = rand() * TOTAL_W;
            const y = rand() * DH;
            const size = 200 + rand() * 400;
            const color = i % 2 === 0 ? primary : accent;
            ctx.fillStyle = rgba(darken(color, 20), 0.06 + rand() * 0.10);

            if (i % 3 === 0) {
                // Triangle
                ctx.beginPath();
                ctx.moveTo(x, y - size / 2);
                ctx.lineTo(x + size / 2, y + size / 2);
                ctx.lineTo(x - size / 2, y + size / 2);
                ctx.closePath();
                ctx.fill();
            } else {
                // Rotated rectangle
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rand() * Math.PI);
                ctx.fillRect(-size / 2, -size / 4, size, size / 2);
                ctx.restore();
            }
        }

        // Diagonal stripes
        for (let i = 0; i < 8; i++) {
            const offset = rand() * TOTAL_W;
            ctx.beginPath();
            ctx.moveTo(offset, 0);
            ctx.lineTo(offset + DH * 0.5, DH);
            ctx.strokeStyle = rgba(lighten(accent, 30), 0.05 + rand() * 0.07);
            ctx.lineWidth = 3 + rand() * 6;
            ctx.stroke();
        }

        drawFlowingCurves(ctx, lighten(primary, 30), lighten(accent, 30), rand, 4);
    }

    function renderElegant(ctx, primary, accent, rand) {
        // Smooth dark-to-mid gradient
        const grad = ctx.createLinearGradient(0, 0, TOTAL_W * 0.3, DH);
        grad.addColorStop(0, darken(primary, 60));
        grad.addColorStop(0.5, darken(primary, 40));
        grad.addColorStop(1, darken(primary, 50));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, TOTAL_W, DH);

        // Golden ratio spiral arcs
        const phi = 1.618033988749895;
        for (let i = 0; i < 6; i++) {
            const cx = DW * i + DW * 0.5 + (rand() - 0.5) * 200;
            const cy = DH * 0.5 + (rand() - 0.5) * 300;
            let r = 40;
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 4; a += 0.05) {
                r = 40 * Math.pow(phi, a / (Math.PI * 2));
                const px = cx + Math.cos(a) * r;
                const py = cy + Math.sin(a) * r;
                if (a === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
                if (r > 600) break;
            }
            ctx.strokeStyle = rgba(accent, 0.06 + rand() * 0.06);
            ctx.lineWidth = 1.5 + rand() * 2;
            ctx.stroke();
        }

        // Thin elegant arcs
        for (let i = 0; i < 20; i++) {
            const x = rand() * TOTAL_W;
            const y = rand() * DH;
            const r = 100 + rand() * 400;
            const startAngle = rand() * Math.PI * 2;
            const endAngle = startAngle + rand() * Math.PI;
            ctx.beginPath();
            ctx.arc(x, y, r, startAngle, endAngle);
            ctx.strokeStyle = rgba(accent, 0.04 + rand() * 0.06);
            ctx.lineWidth = 1 + rand() * 1.5;
            ctx.stroke();
        }

        drawFlowingCurves(ctx, accent, lighten(primary, 30), rand, 5);
    }

    function renderTech(ctx, primary, accent, rand) {
        // Dark background
        ctx.fillStyle = darken(primary, 85);
        ctx.fillRect(0, 0, TOTAL_W, DH);

        // Grid lines
        const gridSpacing = 60;
        ctx.strokeStyle = rgba(primary, 0.04);
        ctx.lineWidth = 1;
        for (let x = 0; x < TOTAL_W; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, DH);
            ctx.stroke();
        }
        for (let y = 0; y < DH; y += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(TOTAL_W, y);
            ctx.stroke();
        }

        // Circuit-like patterns: horizontal/vertical line segments with right-angle turns
        for (let i = 0; i < 25; i++) {
            let x = rand() * TOTAL_W;
            let y = rand() * DH;
            const segments = 4 + Math.floor(rand() * 6);
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let s = 0; s < segments; s++) {
                const len = 40 + rand() * 200;
                if (s % 2 === 0) {
                    x += (rand() > 0.5 ? 1 : -1) * len;
                } else {
                    y += (rand() > 0.5 ? 1 : -1) * len;
                }
                ctx.lineTo(x, y);
            }
            ctx.strokeStyle = rgba(accent, 0.06 + rand() * 0.08);
            ctx.lineWidth = 1 + rand() * 1.5;
            ctx.stroke();

            // Node dots at endpoints
            ctx.beginPath();
            ctx.arc(x, y, 3 + rand() * 3, 0, Math.PI * 2);
            ctx.fillStyle = rgba(accent, 0.10 + rand() * 0.10);
            ctx.fill();
        }

        // Glow effects: radial gradients at intersection points
        for (let i = 0; i < 12; i++) {
            const gx = rand() * TOTAL_W;
            const gy = rand() * DH;
            const gr = 40 + rand() * 100;
            const radGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            radGrad.addColorStop(0, rgba(accent, 0.10 + rand() * 0.08));
            radGrad.addColorStop(1, rgba(accent, 0));
            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(gx, gy, gr, 0, Math.PI * 2);
            ctx.fill();
        }

        drawFlowingCurves(ctx, accent, lighten(accent, 30), rand, 4);
    }

    // --- Mood dispatcher ---

    const moodRenderers = {
        professional: renderProfessional,
        playful: renderPlayful,
        minimal: renderMinimal,
        bold: renderBold,
        elegant: renderElegant,
        tech: renderTech,
    };

    // --- Public API ---

    /**
     * Generate a 6480x1920 panorama canvas based on a design brief.
     * @param {Object} brief - { primaryColor, accentColor, mood, backgroundMood }
     * @returns {HTMLCanvasElement}
     */
    function generate(brief) {
        const {
            primaryColor = '#2563EB',
            accentColor = '#F59E0B',
            mood = 'professional',
            backgroundMood,
        } = brief || {};

        const activeMood = backgroundMood || mood || 'professional';
        const canvas = document.createElement('canvas');
        canvas.width = TOTAL_W;
        canvas.height = DH;
        const ctx = canvas.getContext('2d');

        const rand = seededRandom(seedFromMood(activeMood));
        const renderer = moodRenderers[activeMood] || moodRenderers.professional;
        renderer(ctx, primaryColor, accentColor, rand);

        return canvas;
    }

    /**
     * Get crop coordinates for a specific slide from the panorama.
     * @param {HTMLCanvasElement} panoramaCanvas - The 6480x1920 panorama
     * @param {number} slideIndex - 0-based slide index (0-5)
     * @returns {{ x: number, y: number, w: number, h: number }}
     */
    function getSliceForSlide(panoramaCanvas, slideIndex) {
        const idx = Math.max(0, Math.min(5, Math.floor(slideIndex)));
        return {
            x: idx * DW,
            y: 0,
            w: DW,
            h: DH,
        };
    }

    /**
     * Draw the panorama slice for one slide onto a target canvas context.
     * @param {CanvasRenderingContext2D} ctx - Target canvas context
     * @param {HTMLCanvasElement} panoramaCanvas - The 6480x1920 panorama
     * @param {number} slideIndex - 0-based slide index (0-5)
     * @param {number} canvasW - Target canvas width
     * @param {number} canvasH - Target canvas height
     */
    function drawSlideBackground(ctx, panoramaCanvas, slideIndex, canvasW, canvasH) {
        const slice = getSliceForSlide(panoramaCanvas, slideIndex);
        ctx.drawImage(
            panoramaCanvas,
            slice.x, slice.y, slice.w, slice.h,
            0, 0, canvasW, canvasH
        );
    }

    return { generate, getSliceForSlide, drawSlideBackground };
})();
