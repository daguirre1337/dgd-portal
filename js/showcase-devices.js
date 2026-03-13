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
    function drawDevice(ctx, deviceType, x, y, scale, screenshot) {
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

        // Draw screenshot if provided
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
