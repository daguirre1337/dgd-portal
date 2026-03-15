/**
 * Showcase Builder - Slide Templates
 * Pre-defined layouts for App Store / Play Store slides
 *
 * Coordinates are in a 1080x1920 design space (Play Store native).
 * The builder scales these to the actual export resolution.
 */

const ShowcaseTemplates = (() => {
    'use strict';

    // Design space (all coordinates are relative to this)
    const DESIGN_W = 1080;
    const DESIGN_H = 1920;

    /**
     * Each template defines:
     *  - id, name, icon (for UI)
     *  - background defaults
     *  - elements[] with type + default positions
     */
    const TEMPLATES = [
        {
            id: 'hero',
            name: 'Hero',
            icon: '\u2B50', // star
            description: 'Headline oben, Device unten',
            background: { type: 'gradient', from: '#1e4976', to: '#3a6ea5', angle: 180 },
            elements: [
                {
                    type: 'text',
                    id: 'headline',
                    content: 'Ihre App.\nEin Statement.',
                    x: 80, y: 160,
                    fontSize: 72, fontWeight: 700,
                    color: '#ffffff',
                    maxWidth: 920,
                    align: 'left',
                    fontFamily: 'Inter',
                },
                {
                    type: 'text',
                    id: 'subline',
                    content: 'Die beste Loesung fuer Ihr Anliegen',
                    x: 80, y: 400,
                    fontSize: 36, fontWeight: 400,
                    color: 'rgba(255,255,255,0.75)',
                    maxWidth: 920,
                    align: 'left',
                    fontFamily: 'Inter',
                },
                {
                    type: 'device',
                    id: 'phone',
                    device: 'iphone',
                    screenshot: null,
                    x: 200, y: 560,
                    scale: 1.5,
                },
            ],
        },
        {
            id: 'feature',
            name: 'Features',
            icon: '\u2726', // sparkle
            description: '3 Feature-Punkte + Device',
            background: { type: 'gradient', from: '#1a3a5c', to: '#2c5282', angle: 135 },
            elements: [
                {
                    type: 'text',
                    id: 'headline',
                    content: 'Alles was Sie\nbrauchen',
                    x: 60, y: 120,
                    fontSize: 56, fontWeight: 700,
                    color: '#ffffff',
                    maxWidth: 500,
                    align: 'left',
                    fontFamily: 'Inter',
                },
                {
                    type: 'text',
                    id: 'feature1',
                    content: '\u2713  Schnell & einfach',
                    x: 60, y: 380,
                    fontSize: 30, fontWeight: 500,
                    color: '#D4A843',
                    maxWidth: 460,
                    align: 'left',
                    fontFamily: 'Inter',
                },
                {
                    type: 'text',
                    id: 'feature2',
                    content: '\u2713  100% transparent',
                    x: 60, y: 440,
                    fontSize: 30, fontWeight: 500,
                    color: '#D4A843',
                    maxWidth: 460,
                    align: 'left',
                    fontFamily: 'Inter',
                },
                {
                    type: 'text',
                    id: 'feature3',
                    content: '\u2713  Deutschlandweit',
                    x: 60, y: 500,
                    fontSize: 30, fontWeight: 500,
                    color: '#D4A843',
                    maxWidth: 460,
                    align: 'left',
                    fontFamily: 'Inter',
                },
                {
                    type: 'device',
                    id: 'phone',
                    device: 'iphone',
                    screenshot: null,
                    x: 520, y: 350,
                    scale: 1.6,
                },
            ],
        },
        {
            id: 'split',
            name: 'Split',
            icon: '\u25EB', // split
            description: 'Text links, Device rechts',
            background: { type: 'solid', color: '#ffffff' },
            elements: [
                {
                    type: 'shape',
                    id: 'accent-bar',
                    shapeType: 'rect',
                    x: 0, y: 0,
                    w: 480, h: 1920,
                    fill: '#1e4976',
                    stroke: 'none',
                },
                {
                    type: 'text',
                    id: 'headline',
                    content: 'So einfach\ngeht\'s',
                    x: 60, y: 700,
                    fontSize: 60, fontWeight: 700,
                    color: '#ffffff',
                    maxWidth: 380,
                    align: 'left',
                    fontFamily: 'Inter',
                },
                {
                    type: 'text',
                    id: 'subline',
                    content: 'In nur 3 Schritten zum Gutachten',
                    x: 60, y: 920,
                    fontSize: 28, fontWeight: 400,
                    color: 'rgba(255,255,255,0.7)',
                    maxWidth: 380,
                    align: 'left',
                    fontFamily: 'Inter',
                },
                {
                    type: 'device',
                    id: 'phone',
                    device: 'iphone',
                    screenshot: null,
                    x: 520, y: 340,
                    scale: 1.45,
                },
            ],
        },
        {
            id: 'fullscreen',
            name: 'Vollbild',
            icon: '\u26F6', // maximize
            description: 'Screenshot fullscreen + Text-Overlay',
            background: { type: 'gradient', from: '#0d1b2a', to: '#1b2d45', angle: 180 },
            elements: [
                {
                    type: 'device',
                    id: 'phone',
                    device: 'iphone',
                    screenshot: null,
                    x: 180, y: 60,
                    scale: 1.7,
                },
                {
                    type: 'shape',
                    id: 'overlay',
                    shapeType: 'rect',
                    x: 0, y: 1400,
                    w: 1080, h: 520,
                    fill: 'rgba(0,0,0,0.75)',
                    stroke: 'none',
                },
                {
                    type: 'text',
                    id: 'headline',
                    content: 'Beeindruckend einfach',
                    x: 80, y: 1500,
                    fontSize: 52, fontWeight: 700,
                    color: '#ffffff',
                    maxWidth: 920,
                    align: 'left',
                    fontFamily: 'Inter',
                },
                {
                    type: 'text',
                    id: 'subline',
                    content: 'Die neue Art der Schadensregulierung',
                    x: 80, y: 1600,
                    fontSize: 30, fontWeight: 400,
                    color: 'rgba(255,255,255,0.8)',
                    maxWidth: 920,
                    align: 'left',
                    fontFamily: 'Inter',
                },
            ],
        },
        {
            id: 'comparison',
            name: 'Vergleich',
            icon: '\u21C4', // arrows
            description: 'Vorher/Nachher, 2 Screenshots',
            background: { type: 'gradient', from: '#2c5282', to: '#1e4976', angle: 180 },
            elements: [
                {
                    type: 'text',
                    id: 'headline',
                    content: 'Vorher vs. Nachher',
                    x: 80, y: 120,
                    fontSize: 52, fontWeight: 700,
                    color: '#ffffff',
                    maxWidth: 920,
                    align: 'center',
                    fontFamily: 'Inter',
                },
                {
                    type: 'text',
                    id: 'label-left',
                    content: 'Ohne DGD',
                    x: 140, y: 280,
                    fontSize: 28, fontWeight: 600,
                    color: '#e74c3c',
                    maxWidth: 300,
                    align: 'center',
                    fontFamily: 'Inter',
                },
                {
                    type: 'text',
                    id: 'label-right',
                    content: 'Mit DGD',
                    x: 640, y: 280,
                    fontSize: 28, fontWeight: 600,
                    color: '#27ae60',
                    maxWidth: 300,
                    align: 'center',
                    fontFamily: 'Inter',
                },
                {
                    type: 'device',
                    id: 'phone-left',
                    device: 'iphone',
                    screenshot: null,
                    x: 40, y: 360,
                    scale: 1.15,
                },
                {
                    type: 'device',
                    id: 'phone-right',
                    device: 'iphone',
                    screenshot: null,
                    x: 550, y: 360,
                    scale: 1.15,
                },
            ],
        },
    ];

    /**
     * Get a deep copy of a template by ID
     */
    function getTemplate(id) {
        const tpl = TEMPLATES.find(t => t.id === id);
        if (!tpl) return null;
        return JSON.parse(JSON.stringify(tpl));
    }

    /**
     * List all template summaries
     */
    function listTemplates() {
        return TEMPLATES.map(t => ({
            id: t.id,
            name: t.name,
            icon: t.icon,
            description: t.description,
        }));
    }

    return {
        DESIGN_W,
        DESIGN_H,
        TEMPLATES,
        getTemplate,
        listTemplates,
    };
})();
