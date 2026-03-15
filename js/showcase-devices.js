/**
 * Showcase Builder - Device Mockup Definitions
 * SVG device frames for iPhone and Android phones
 */

const ShowcaseDevices = (() => {
    'use strict';

    // Device dimensions at 1x scale (used for Canvas rendering)
    const DEVICES = {
        iphone: {
            name: 'iPhone 15 Pro',
            // Outer frame dimensions
            width: 390,
            height: 844,
            // Screen area within frame
            screen: { x: 20, y: 20, width: 350, height: 804 },
            // Corner radius
            radius: 50,
            // Notch / Dynamic Island
            island: { x: 147, y: 10, width: 96, height: 28, radius: 14 },
            // Frame color
            frameColor: '#1a1a1a',
            frameBorder: '#333',
            frameWidth: 3,
        },
        android: {
            name: 'Pixel 8',
            width: 390,
            height: 844,
            screen: { x: 16, y: 16, width: 358, height: 812 },
            radius: 36,
            // Punch-hole camera
            punchHole: { cx: 195, cy: 28, r: 8 },
            frameColor: '#1a1a1a',
            frameBorder: '#333',
            frameWidth: 3,
        }
    };

    // Export dimensions for each store
    const STORE_SIZES = {
        appstore_67: { width: 1290, height: 2796, label: 'App Store (6.7")' },
        appstore_65: { width: 1284, height: 2778, label: 'App Store (6.5")' },
        playstore: { width: 1080, height: 1920, label: 'Play Store' },
    };

    /**
     * Draw a device frame on a canvas context
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} deviceType - 'iphone' or 'android'
     * @param {number} x - Position X on canvas
     * @param {number} y - Position Y on canvas
     * @param {number} scale - Scale factor
     * @param {HTMLImageElement|null} screenshot - Screenshot image to fill screen
     */
    function drawDevice(ctx, deviceType, x, y, scale, screenshot, placeholderMode) {
        const device = DEVICES[deviceType];
        if (!device) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        const w = device.width;
        const h = device.height;
        const r = device.radius;

        // Outer frame shadow
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 8;

        // Frame body
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, r);
        ctx.fillStyle = device.frameColor;
        ctx.fill();

        // Remove shadow for inner elements
        ctx.shadowColor = 'transparent';

        // Frame border highlight
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, r);
        ctx.strokeStyle = device.frameBorder;
        ctx.lineWidth = device.frameWidth;
        ctx.stroke();

        // Screen area
        const s = device.screen;
        ctx.beginPath();
        ctx.roundRect(s.x, s.y, s.width, s.height, r - 10);
        ctx.fillStyle = '#000';
        ctx.fill();

        // Draw screenshot or placeholder
        if (screenshot) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(s.x, s.y, s.width, s.height, r - 10);
            ctx.clip();
            // Cover-fit the screenshot
            const imgRatio = screenshot.width / screenshot.height;
            const screenRatio = s.width / s.height;
            let drawW, drawH, drawX, drawY;
            if (imgRatio > screenRatio) {
                drawH = s.height;
                drawW = drawH * imgRatio;
                drawX = s.x - (drawW - s.width) / 2;
                drawY = s.y;
            } else {
                drawW = s.width;
                drawH = drawW / imgRatio;
                drawX = s.x;
                drawY = s.y - (drawH - s.height) / 2;
            }
            ctx.drawImage(screenshot, drawX, drawY, drawW, drawH);
            ctx.restore();
        } else {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(s.x, s.y, s.width, s.height, r - 10);
            ctx.clip();

            if (placeholderMode === 'ohne-dgd') {
                _drawOhneDGDScreen(ctx, s);
            } else if (placeholderMode === 'mit-dgd') {
                _drawMitDGDScreen(ctx, s);
            } else {
                _drawDefaultPlaceholder(ctx, s);
            }

            ctx.restore();
        }

        // Device-specific elements
        if (deviceType === 'iphone' && device.island) {
            // Dynamic Island
            const di = device.island;
            ctx.beginPath();
            ctx.roundRect(di.x, di.y, di.width, di.height, di.radius);
            ctx.fillStyle = '#000';
            ctx.fill();
        }

        if (deviceType === 'android' && device.punchHole) {
            // Punch-hole camera
            const ph = device.punchHole;
            ctx.beginPath();
            ctx.arc(ph.cx, ph.cy, ph.r, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();
        }

        // Status bar indicators (subtle)
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '12px -apple-system, sans-serif';
        ctx.textBaseline = 'middle';
        const barY = s.y + 14;
        ctx.textAlign = 'left';
        ctx.fillText('9:41', s.x + 16, barY);
        ctx.textAlign = 'right';
        ctx.fillText('100%', s.x + s.width - 16, barY);

        ctx.restore();
    }

    // =========================================================================
    // Placeholder Screens
    // =========================================================================

    function _drawDefaultPlaceholder(ctx, s) {
        const plGrad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.height);
        plGrad.addColorStop(0, '#112840');
        plGrad.addColorStop(0.3, '#184E74');
        plGrad.addColorStop(0.7, '#1a3d5c');
        plGrad.addColorStop(1, '#0f1f35');
        ctx.fillStyle = plGrad;
        ctx.fillRect(s.x, s.y, s.width, s.height);

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(s.x, s.y, s.width, s.height * 0.06);

        const cx = s.x + s.width / 2;
        const cy = s.y + s.height * 0.22;
        const logoR = Math.min(s.width, s.height) * 0.1;

        ctx.beginPath();
        ctx.arc(cx, cy, logoR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(202,168,118,0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(202,168,118,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(202,168,118,0.8)';
        ctx.font = `700 ${logoR * 0.8}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DGD', cx, cy);

        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = `600 ${s.height * 0.03}px Inter, sans-serif`;
        ctx.fillText('DGD Direkt', cx, cy + logoR + s.height * 0.04);

        const cardW = s.width * 0.85;
        const cardH = s.height * 0.08;
        const cardX = s.x + (s.width - cardW) / 2;
        const cardStartY = s.y + s.height * 0.42;
        for (let i = 0; i < 4; i++) {
            const cy2 = cardStartY + i * (cardH + s.height * 0.025);
            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            ctx.beginPath();
            ctx.roundRect(cardX, cy2, cardW, cardH, 6);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(cardX + cardW * 0.05, cy2 + cardH * 0.3, cardW * 0.5, cardH * 0.15);
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(cardX + cardW * 0.05, cy2 + cardH * 0.55, cardW * 0.35, cardH * 0.15);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(s.x, s.y + s.height * 0.92, s.width, s.height * 0.08);
        const dotR = s.width * 0.015;
        for (let d = 0; d < 4; d++) {
            const dotX = s.x + s.width * (0.2 + d * 0.2);
            const dotY = s.y + s.height * 0.96;
            ctx.beginPath();
            ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
            ctx.fillStyle = d === 0 ? 'rgba(202,168,118,0.7)' : 'rgba(255,255,255,0.2)';
            ctx.fill();
        }
    }

    function _drawOhneDGDScreen(ctx, s) {
        // "Ohne DGD" = Chaos, missed calls, analog
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(s.x, s.y, s.width, s.height);

        // Status bar
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(s.x, s.y, s.width, s.height * 0.06);

        const f = s.height * 0.028; // base font size
        const pad = s.width * 0.08;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Red notification badge
        let y = s.y + s.height * 0.1;
        ctx.fillStyle = '#dc3545';
        ctx.beginPath();
        ctx.roundRect(s.x + pad, y, s.width - pad * 2, s.height * 0.06, 8);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${f}px Inter, sans-serif`;
        ctx.fillText('3 verpasste Anrufe', s.x + pad * 1.5, y + s.height * 0.015);

        // Missed call entries
        const calls = [
            { name: 'Gutachter Max M.', time: 'vor 2 Std.', icon: '📞' },
            { name: 'Mustermann GmbH', time: 'vor 4 Std.', icon: '📞' },
            { name: 'Werkstatt Mueller', time: 'gestern', icon: '📞' },
        ];
        y += s.height * 0.09;
        for (const call of calls) {
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.roundRect(s.x + pad, y, s.width - pad * 2, s.height * 0.08, 6);
            ctx.fill();

            ctx.fillStyle = 'rgba(220,53,69,0.8)';
            ctx.font = `400 ${f * 1.2}px Inter, sans-serif`;
            ctx.fillText(call.icon, s.x + pad * 1.5, y + s.height * 0.015);

            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = `500 ${f * 0.85}px Inter, sans-serif`;
            ctx.fillText(call.name, s.x + pad * 2.5, y + s.height * 0.015);

            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = `400 ${f * 0.7}px Inter, sans-serif`;
            ctx.fillText(call.time, s.x + pad * 2.5, y + s.height * 0.045);

            y += s.height * 0.1;
        }

        // Pending tasks - messy
        y += s.height * 0.03;
        ctx.fillStyle = 'rgba(255,165,0,0.7)';
        ctx.font = `600 ${f * 0.85}px Inter, sans-serif`;
        ctx.fillText('Offene Vorgaenge:', s.x + pad, y);
        y += s.height * 0.045;

        const tasks = ['Gutachten #2847 — Rueckruf!', 'Foto nachreichen KFZ BN-421', 'Freigabe Kostenvoranschlag'];
        for (const task of tasks) {
            ctx.fillStyle = 'rgba(255,165,0,0.15)';
            ctx.beginPath();
            ctx.roundRect(s.x + pad, y, s.width - pad * 2, s.height * 0.05, 4);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `400 ${f * 0.7}px Inter, sans-serif`;
            ctx.fillText(task, s.x + pad * 1.5, y + s.height * 0.015);
            y += s.height * 0.065;
        }

        // Bottom: stressed status
        ctx.fillStyle = 'rgba(220,53,69,0.1)';
        ctx.fillRect(s.x, s.y + s.height * 0.88, s.width, s.height * 0.12);
        ctx.fillStyle = 'rgba(220,53,69,0.6)';
        ctx.font = `600 ${f * 0.75}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('12 unerledigte Aufgaben', s.x + s.width / 2, s.y + s.height * 0.925);
    }

    function _drawMitDGDScreen(ctx, s) {
        // "Mit DGD" = Alles erledigt, digital, effizient
        const plGrad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.height);
        plGrad.addColorStop(0, '#112840');
        plGrad.addColorStop(0.3, '#184E74');
        plGrad.addColorStop(1, '#0f1f35');
        ctx.fillStyle = plGrad;
        ctx.fillRect(s.x, s.y, s.width, s.height);

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(s.x, s.y, s.width, s.height * 0.06);

        const f = s.height * 0.028;
        const pad = s.width * 0.08;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Success header
        let y = s.y + s.height * 0.1;
        ctx.fillStyle = 'rgba(39,174,96,0.2)';
        ctx.beginPath();
        ctx.roundRect(s.x + pad, y, s.width - pad * 2, s.height * 0.06, 8);
        ctx.fill();
        ctx.fillStyle = '#27ae60';
        ctx.font = `700 ${f}px Inter, sans-serif`;
        ctx.fillText('Alle Vorgaenge erledigt', s.x + pad * 1.5, y + s.height * 0.015);

        // Completed items
        const items = [
            { text: 'Gutachten digital uebermittelt', icon: '✅', detail: 'Schadenakte #4721' },
            { text: 'Kostenvoranschlag freigegeben', icon: '✅', detail: 'Automatisch geprueft' },
            { text: 'Kunde informiert via App', icon: '✅', detail: 'Push-Nachricht gesendet' },
        ];
        y += s.height * 0.09;
        for (const item of items) {
            ctx.fillStyle = 'rgba(39,174,96,0.08)';
            ctx.beginPath();
            ctx.roundRect(s.x + pad, y, s.width - pad * 2, s.height * 0.08, 6);
            ctx.fill();

            ctx.fillStyle = '#27ae60';
            ctx.font = `400 ${f * 1.0}px Inter, sans-serif`;
            ctx.fillText(item.icon, s.x + pad * 1.5, y + s.height * 0.012);

            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = `500 ${f * 0.8}px Inter, sans-serif`;
            ctx.fillText(item.text, s.x + pad * 2.8, y + s.height * 0.012);

            ctx.fillStyle = 'rgba(202,168,118,0.6)';
            ctx.font = `400 ${f * 0.65}px Inter, sans-serif`;
            ctx.fillText(item.detail, s.x + pad * 2.8, y + s.height * 0.042);

            y += s.height * 0.1;
        }

        // Stats
        y += s.height * 0.03;
        ctx.fillStyle = 'rgba(202,168,118,0.12)';
        ctx.beginPath();
        ctx.roundRect(s.x + pad, y, s.width - pad * 2, s.height * 0.12, 8);
        ctx.fill();

        ctx.fillStyle = '#CAA876';
        ctx.font = `700 ${f * 1.5}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('12 Min.', s.x + s.width / 2, y + s.height * 0.015);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `400 ${f * 0.7}px Inter, sans-serif`;
        ctx.fillText('Durchschn. Bearbeitungszeit', s.x + s.width / 2, y + s.height * 0.07);

        // Bottom nav
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(s.x, s.y + s.height * 0.92, s.width, s.height * 0.08);
        const dotR = s.width * 0.015;
        ctx.textAlign = 'center';
        for (let d = 0; d < 4; d++) {
            const dotX = s.x + s.width * (0.2 + d * 0.2);
            const dotY = s.y + s.height * 0.96;
            ctx.beginPath();
            ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
            ctx.fillStyle = d === 0 ? 'rgba(202,168,118,0.7)' : 'rgba(255,255,255,0.2)';
            ctx.fill();
        }
    }

    /**
     * Get the screen rect of a device at given position and scale
     * (for hit-testing and element placement)
     */
    function getScreenRect(deviceType, x, y, scale) {
        const device = DEVICES[deviceType];
        if (!device) return null;
        const s = device.screen;
        return {
            x: x + s.x * scale,
            y: y + s.y * scale,
            width: s.width * scale,
            height: s.height * scale,
        };
    }

    return {
        DEVICES,
        STORE_SIZES,
        drawDevice,
        getScreenRect,
    };
})();
