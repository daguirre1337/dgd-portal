/**
 * Showcase Builder - App Store / Play Store Screenshot Builder
 * Canvas-based editor with drag & drop, templates, and Cortex AI
 */

const ShowcaseBuilder = (() => {
    'use strict';

    const DW = ShowcaseTemplates.DESIGN_W; // 1080
    const DH = ShowcaseTemplates.DESIGN_H; // 1920

    // =========================================================================
    // State
    // =========================================================================

    let project = null;       // Current project
    let currentSlide = 0;     // Active slide index (0-5)
    let selectedElement = null; // Selected element ID
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let slideCanvases = [];   // Array of 6 canvases
    let slideCtxs = [];       // Array of 6 contexts
    let previewScale = 1;     // Scale from design -> preview pixels
    let screenshotImages = {}; // Cache: elementId -> HTMLImageElement
    let container = null;     // Root DOM element
    let panoramaCanvas = null; // Panorama background canvas (6480x1920)
    let panoramaImage = null;  // AI-generated panorama Image element
    let isGenerating = false;  // Lock during auto-generation

    // =========================================================================
    // Project Management
    // =========================================================================

    function createProject(appName, platform) {
        project = {
            id: _slug(appName) + '-' + Date.now(),
            appName: appName || 'My App',
            platform: platform || 'both',
            brandColors: { primary: '#184E74', accent: '#CAA876' },
            slides: [],
        };

        // Initialize 6 slides from templates
        const templateOrder = ['hero', 'feature', 'split', 'fullscreen', 'feature', 'comparison'];
        for (let i = 0; i < 6; i++) {
            const tpl = ShowcaseTemplates.getTemplate(templateOrder[i]);
            project.slides.push({
                id: i,
                template: tpl.id,
                background: tpl.background,
                elements: tpl.elements.map((el, idx) => ({
                    ...el,
                    _id: `el_${i}_${idx}`,
                })),
            });
        }

        _saveProject();
        return project;
    }

    function loadProject(id) {
        try {
            const data = localStorage.getItem('showcase_' + id);
            if (data) {
                project = JSON.parse(data);
                return project;
            }
        } catch (e) {
            console.warn('[ShowcaseBuilder] Load failed:', e);
        }
        return null;
    }

    function _saveProject() {
        if (!project) return;
        try {
            localStorage.setItem('showcase_' + project.id, JSON.stringify(project));
            // Also save as "last project" for easy resume
            localStorage.setItem('showcase_last', project.id);
        } catch (e) {
            console.warn('[ShowcaseBuilder] Save failed:', e);
        }
    }

    function listProjects() {
        const projects = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('showcase_') && key !== 'showcase_last') {
                try {
                    const p = JSON.parse(localStorage.getItem(key));
                    projects.push({ id: p.id, appName: p.appName, platform: p.platform });
                } catch { /* skip */ }
            }
        }
        return projects;
    }

    // =========================================================================
    // Canvas Rendering
    // =========================================================================

    function render() {
        if (!slideCanvases.length || !project) return;

        // Render all 6 slides
        for (let i = 0; i < 6; i++) {
            const canvas = slideCanvases[i];
            const ctx = slideCtxs[i];
            if (!canvas || !ctx || !project.slides[i]) continue;
            _renderSlide(ctx, project.slides[i], canvas.width, canvas.height, i);
        }

        // Selection overlay only on active slide
        const activeCtx = slideCtxs[currentSlide];
        if (activeCtx) _renderSelection(activeCtx);
    }

    function _renderSlide(ctx, slide, canvasW, canvasH, slideIndex) {
        const scaleX = canvasW / DW;
        const scaleY = canvasH / DH;
        const scale = Math.min(scaleX, scaleY);

        ctx.clearRect(0, 0, canvasW, canvasH);

        ctx.save();

        // Background: Panorama if available, otherwise template background
        // Prefer canvas (freshly generated/scaled) over raw image
        const pano = panoramaCanvas || panoramaImage;
        if (pano && typeof slideIndex === 'number') {
            if (typeof ShowcasePanorama !== 'undefined') {
                ShowcasePanorama.drawSlideBackground(ctx, pano, slideIndex, canvasW, canvasH);
            } else {
                _drawBackground(ctx, slide.background, canvasW, canvasH);
            }
        } else {
            _drawBackground(ctx, slide.background, canvasW, canvasH);
        }

        // Scene layers (environment, midground, atmosphere, accents)
        if (typeof ShowcaseSceneEngine !== 'undefined' && project?._scenes?.[slideIndex]) {
            ShowcaseSceneEngine.renderScene(
                ctx, project._scenes[slideIndex],
                canvasW, canvasH,
                project.brandColors
            );
        }

        // Elements (draw in order)
        for (const el of slide.elements) {
            _drawElement(ctx, el, scale);
        }

        ctx.restore();
    }

    function _drawBackground(ctx, bg, w, h) {
        if (!bg) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            return;
        }

        if (bg.type === 'solid') {
            ctx.fillStyle = bg.color || '#ffffff';
            ctx.fillRect(0, 0, w, h);
        } else if (bg.type === 'gradient') {
            const angle = (bg.angle || 180) * Math.PI / 180;
            const cx = w / 2, cy = h / 2;
            const len = Math.sqrt(w * w + h * h) / 2;
            const x1 = cx - Math.sin(angle) * len;
            const y1 = cy - Math.cos(angle) * len;
            const x2 = cx + Math.sin(angle) * len;
            const y2 = cy + Math.cos(angle) * len;
            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0, bg.from || '#184E74');
            grad.addColorStop(1, bg.to || '#2c5282');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }
    }

    function _drawElement(ctx, el, scale) {
        const sx = el.x * scale;
        const sy = el.y * scale;

        switch (el.type) {
            case 'text':
                _drawText(ctx, el, scale);
                break;
            case 'device':
                ShowcaseDevices.drawDevice(
                    ctx, el.device || 'iphone',
                    sx, sy, (el.scale || 1) * scale,
                    screenshotImages[el._id] || null
                );
                break;
            case 'shape':
                _drawShape(ctx, el, scale);
                break;
            case 'image':
                _drawImage(ctx, el, scale);
                break;
            case 'badge':
                _drawBadge(ctx, el, scale);
                break;
        }
    }

    function _drawText(ctx, el, scale) {
        const x = el.x * scale;
        const y = el.y * scale;
        const fontSize = (el.fontSize || 36) * scale;
        const maxWidth = (el.maxWidth || DW) * scale;

        ctx.save();
        ctx.font = `${el.fontWeight || 400} ${fontSize}px ${el.fontFamily || 'Inter'}, -apple-system, sans-serif`;
        ctx.fillStyle = el.color || '#000000';
        ctx.textAlign = el.align || 'left';
        ctx.textBaseline = 'top';

        // Word-wrap with newlines
        const lines = _wrapText(ctx, el.content || '', maxWidth);
        const lineHeight = fontSize * 1.2;

        for (let i = 0; i < lines.length; i++) {
            let drawX = x;
            if (el.align === 'center') drawX = x + maxWidth / 2;
            else if (el.align === 'right') drawX = x + maxWidth;
            ctx.fillText(lines[i], drawX, y + i * lineHeight);
        }

        ctx.restore();
    }

    function _wrapText(ctx, text, maxWidth) {
        const result = [];
        const paragraphs = text.split('\n');

        for (const para of paragraphs) {
            if (!para) { result.push(''); continue; }
            const words = para.split(' ');
            let line = '';

            for (const word of words) {
                const test = line ? line + ' ' + word : word;
                const metrics = ctx.measureText(test);
                if (metrics.width > maxWidth && line) {
                    result.push(line);
                    line = word;
                } else {
                    line = test;
                }
            }
            if (line) result.push(line);
        }

        return result;
    }

    function _drawShape(ctx, el, scale) {
        const x = el.x * scale;
        const y = el.y * scale;
        const w = (el.w || 100) * scale;
        const h = (el.h || 100) * scale;

        ctx.save();
        if (el.fill && el.fill !== 'none') {
            ctx.fillStyle = el.fill;
            if (el.shapeType === 'circle') {
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(x, y, w, h);
            }
        }
        if (el.stroke && el.stroke !== 'none') {
            ctx.strokeStyle = el.stroke;
            ctx.lineWidth = 2 * scale;
            if (el.shapeType === 'circle') {
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.strokeRect(x, y, w, h);
            }
        }
        ctx.restore();
    }

    function _drawImage(ctx, el, scale) {
        const img = screenshotImages[el._id];
        if (!img) return;
        const x = el.x * scale;
        const y = el.y * scale;
        const w = (el.width || 200) * scale;
        const h = (el.height || 200) * scale;
        ctx.drawImage(img, x, y, w, h);
    }

    function _drawBadge(ctx, el, scale) {
        const x = el.x * scale;
        const y = el.y * scale;
        const fontSize = 24 * scale;
        const padding = 12 * scale;
        const text = `${el.icon || ''} ${el.label || ''}`.trim();

        ctx.save();
        ctx.font = `600 ${fontSize}px Inter, sans-serif`;
        const metrics = ctx.measureText(text);
        const bw = metrics.width + padding * 2;
        const bh = fontSize + padding * 1.5;

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        if (el.style === 'pill') {
            ctx.beginPath();
            ctx.roundRect(x, y, bw, bh, bh / 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.roundRect(x, y, bw, bh, 6 * scale);
            ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + bw / 2, y + bh / 2);
        ctx.restore();
    }

    function _renderSelection(ctx) {
        if (!selectedElement || !project) return;
        const slide = project.slides[currentSlide];
        const el = slide.elements.find(e => e._id === selectedElement);
        if (!el) return;

        const canvas = slideCanvases[currentSlide];
        const scale = canvas ? (canvas.width / DW) : previewScale;
        const bounds = _getElementBounds(el, scale);
        if (!bounds) return;

        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
        ctx.setLineDash([]);

        // Resize handles
        const handleSize = 8;
        ctx.fillStyle = '#3b82f6';
        const corners = [
            [bounds.x - handleSize / 2, bounds.y - handleSize / 2],
            [bounds.x + bounds.width - handleSize / 2, bounds.y - handleSize / 2],
            [bounds.x - handleSize / 2, bounds.y + bounds.height - handleSize / 2],
            [bounds.x + bounds.width - handleSize / 2, bounds.y + bounds.height - handleSize / 2],
        ];
        for (const [cx, cy] of corners) {
            ctx.fillRect(cx, cy, handleSize, handleSize);
        }
        ctx.restore();
    }

    function _getElementBounds(el, scale) {
        const x = el.x * scale;
        const y = el.y * scale;

        switch (el.type) {
            case 'text': {
                const fontSize = (el.fontSize || 36) * scale;
                const maxWidth = (el.maxWidth || DW) * scale;
                // Approximate text height
                const lineCount = (el.content || '').split('\n').length;
                const height = lineCount * fontSize * 1.3;
                return { x, y, width: maxWidth, height };
            }
            case 'device': {
                const device = ShowcaseDevices.DEVICES[el.device || 'iphone'];
                const s = (el.scale || 1) * scale;
                return { x, y, width: device.width * s, height: device.height * s };
            }
            case 'shape':
                return { x, y, width: (el.w || 100) * scale, height: (el.h || 100) * scale };
            case 'image':
                return { x, y, width: (el.width || 200) * scale, height: (el.height || 200) * scale };
            case 'badge':
                return { x, y, width: 200 * scale, height: 40 * scale };
            default:
                return { x, y, width: 100 * scale, height: 100 * scale };
        }
    }

    // =========================================================================
    // Drag & Drop
    // =========================================================================

    function _initDragDrop() {
        // Drag events are bound per-canvas in _bindSlideCanvasEvents
    }

    function _getActiveCanvas() {
        return slideCanvases[currentSlide] || null;
    }

    function _canvasCoords(e) {
        const canvas = _getActiveCanvas();
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    }

    function _hitTest(px, py) {
        if (!project) return null;
        const slide = project.slides[currentSlide];
        const canvas = slideCanvases[currentSlide];
        const scale = canvas ? (canvas.width / DW) : previewScale;

        // Test in reverse order (top element first)
        for (let i = slide.elements.length - 1; i >= 0; i--) {
            const el = slide.elements[i];
            const bounds = _getElementBounds(el, scale);
            if (bounds &&
                px >= bounds.x && px <= bounds.x + bounds.width &&
                py >= bounds.y && py <= bounds.y + bounds.height) {
                return el;
            }
        }
        return null;
    }

    function _onMouseDown(e) {
        const pos = _canvasCoords(e);
        const hit = _hitTest(pos.x, pos.y);
        const canvas = _getActiveCanvas();

        if (hit) {
            const scale = canvas ? (canvas.width / DW) : previewScale;
            selectedElement = hit._id;
            isDragging = true;
            dragOffset.x = pos.x - hit.x * scale;
            dragOffset.y = pos.y - hit.y * scale;
            if (canvas) canvas.classList.add('dragging');
        } else {
            selectedElement = null;
        }

        _updatePropsPanel();
        render();
    }

    function _onMouseMove(e) {
        const canvas = _getActiveCanvas();
        const pos = _canvasCoords(e);
        const scale = canvas ? (canvas.width / DW) : previewScale;

        if (isDragging && selectedElement && project) {
            const slide = project.slides[currentSlide];
            const el = slide.elements.find(e => e._id === selectedElement);
            if (el) {
                el.x = Math.round((pos.x - dragOffset.x) / scale);
                el.y = Math.round((pos.y - dragOffset.y) / scale);
                render();
            }
        } else {
            // Hover cursor
            const hit = _hitTest(pos.x, pos.y);
            if (canvas) canvas.classList.toggle('hovering', !!hit);
        }
    }

    function _onMouseUp() {
        if (isDragging) {
            isDragging = false;
            const canvas = _getActiveCanvas();
            if (canvas) canvas.classList.remove('dragging');
            _saveProject();
        }
    }

    function _onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        _onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }

    function _onTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        _onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }

    function _bindSlideCanvasEvents(canvas) {
        canvas.addEventListener('mousedown', _onMouseDown);
        canvas.addEventListener('mousemove', _onMouseMove);
        canvas.addEventListener('mouseup', _onMouseUp);
        canvas.addEventListener('mouseleave', _onMouseUp);
        canvas.addEventListener('touchstart', _onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', _onTouchMove, { passive: false });
        canvas.addEventListener('touchend', _onMouseUp);
    }

    // =========================================================================
    // Element Management
    // =========================================================================

    function addElement(type, props = {}) {
        if (!project) return;
        const slide = project.slides[currentSlide];
        const id = `el_${currentSlide}_${Date.now()}`;

        const defaults = {
            text: { type: 'text', content: 'Neuer Text', x: 100, y: 100, fontSize: 40, fontWeight: 700, color: '#ffffff', maxWidth: 800, align: 'left', fontFamily: 'Inter' },
            device: { type: 'device', device: 'iphone', screenshot: null, x: 200, y: 400, scale: 1.3 },
            shape: { type: 'shape', shapeType: 'rect', x: 100, y: 100, w: 300, h: 200, fill: 'rgba(255,255,255,0.1)', stroke: 'none' },
            badge: { type: 'badge', icon: '\u2605', label: 'Feature', x: 100, y: 100, style: 'pill' },
            image: { type: 'image', src: null, x: 100, y: 100, width: 300, height: 300 },
        };

        const el = { ...defaults[type], ...props, _id: id };
        slide.elements.push(el);
        selectedElement = id;
        _saveProject();
        _updateElementsList();
        _updatePropsPanel();
        render();
    }

    function removeElement(elementId) {
        if (!project) return;
        const slide = project.slides[currentSlide];
        slide.elements = slide.elements.filter(e => e._id !== elementId);
        if (selectedElement === elementId) selectedElement = null;
        delete screenshotImages[elementId];
        _saveProject();
        _updateElementsList();
        _updatePropsPanel();
        render();
    }

    function updateElement(elementId, props) {
        if (!project) return;
        const slide = project.slides[currentSlide];
        const el = slide.elements.find(e => e._id === elementId);
        if (el) {
            Object.assign(el, props);
            _saveProject();
            render();
        }
    }

    // =========================================================================
    // Screenshot Upload
    // =========================================================================

    function handleScreenshotUpload(elementId, file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                screenshotImages[elementId] = img;
                // Store data URL in project for persistence
                const slide = project.slides[currentSlide];
                const el = slide.elements.find(e => e._id === elementId);
                if (el) {
                    el.screenshot = e.target.result;
                    _saveProject();
                }
                render();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Restore screenshots from saved data URLs
    function _restoreScreenshots() {
        if (!project) return;
        for (const slide of project.slides) {
            for (const el of slide.elements) {
                if (el.screenshot && typeof el.screenshot === 'string') {
                    const img = new Image();
                    img.onload = () => {
                        screenshotImages[el._id] = img;
                        render();
                    };
                    img.src = el.screenshot;
                }
            }
        }
    }

    // =========================================================================
    // Export
    // =========================================================================

    function exportSlide(slideIndex, platformKey) {
        if (!project || !project.slides[slideIndex]) return;

        const size = ShowcaseDevices.STORE_SIZES[platformKey] ||
                     ShowcaseDevices.STORE_SIZES.playstore;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = size.width;
        offCanvas.height = size.height;
        const offCtx = offCanvas.getContext('2d');

        _renderSlide(offCtx, project.slides[slideIndex], size.width, size.height, slideIndex);

        offCanvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${_slug(project.appName)}_slide${slideIndex + 1}_${platformKey}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    function exportAll(platformKey) {
        if (!project) return;
        // Export all 6 slides sequentially with a small delay
        for (let i = 0; i < project.slides.length; i++) {
            setTimeout(() => exportSlide(i, platformKey), i * 300);
        }
    }

    // =========================================================================
    // DOM / UI Construction
    // =========================================================================

    function mount(containerId) {
        container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = _buildHTML();
        _initCanvas();
        _initDragDrop();
        _bindEvents();

        // Try to load last project or create new
        const lastId = localStorage.getItem('showcase_last');
        if (lastId) {
            const loaded = loadProject(lastId);
            if (loaded) {
                project = loaded;
                _restoreScreenshots();
                _updateUI();
                render();
                return;
            }
        }

        // Show new project dialog
        _showNewProjectDialog();
    }

    function destroy() {
        slideCanvases.forEach(canvas => {
            if (canvas) {
                canvas.removeEventListener('mousedown', _onMouseDown);
                canvas.removeEventListener('mousemove', _onMouseMove);
                canvas.removeEventListener('mouseup', _onMouseUp);
                canvas.removeEventListener('mouseleave', _onMouseUp);
            }
        });
        container = null;
        slideCanvases = [];
        slideCtxs = [];
        project = null;
        selectedElement = null;
        screenshotImages = {};
    }

    function _buildHTML() {
        return `
        <div class="showcase-builder">
            <!-- Canvas: All 6 Slides (full width, no sidebar) -->
            <div class="showcase-canvas">
                <!-- Progress Overlay -->
                <div class="showcase-progress" id="sc-progress" style="display:none;">
                    <div class="showcase-progress__content">
                        <div class="showcase-progress__spinner"></div>
                        <div class="showcase-progress__text" id="sc-progress-text">Generiere...</div>
                        <div class="showcase-progress__bar-wrap">
                            <div class="showcase-progress__bar" id="sc-progress-bar" style="width:0%"></div>
                        </div>
                        <div class="showcase-progress__step" id="sc-progress-step">Step 1/4</div>
                    </div>
                </div>
                <div class="showcase-canvas__strip" id="sc-canvas-strip">
                    ${_buildSlideCanvases()}
                </div>
            </div>

            <!-- Chat Bar (bottom) -->
            <div class="showcase-chat" id="sc-chat">
                <!-- Suggestion Cloud -->
                <div class="showcase-chat__suggestions" id="sc-suggestions">
                    <button class="showcase-chat__chip showcase-chat__chip--generate" id="sc-auto-generate" title="Komplettes Showcase automatisch generieren">
                        \u2728 Generieren
                    </button>
                    <button class="showcase-chat__chip" data-feedback="Heller und freundlicher">\u2600\uFE0F Heller</button>
                    <button class="showcase-chat__chip" data-feedback="Dunkler und serioeser">\uD83C\uDF19 Dunkler</button>
                    <button class="showcase-chat__chip" data-feedback="Professioneller und business-tauglich">\uD83D\uDCBC Pro</button>
                    <button class="showcase-chat__chip" data-feedback="Moderner und trendiger">\u26A1 Modern</button>
                    <button class="showcase-chat__chip" data-feedback="Mehr Kontrast und bessere Lesbarkeit">\uD83D\uDD0D Kontrast</button>
                    <button class="showcase-chat__chip" data-feedback="Andere Farben, kreativer">\uD83C\uDFA8 Farben</button>
                    <button class="showcase-chat__chip" id="sc-export-all" title="Alle 6 Slides exportieren">\u2193 Export</button>
                    <button class="showcase-chat__chip showcase-chat__chip--subtle" id="sc-api-settings" title="API Key">\u2699\uFE0F</button>
                </div>

                <!-- Chat Input -->
                <div class="showcase-chat__input-row">
                    <input type="text" id="sc-chat-input" class="showcase-chat__input"
                        placeholder="Beschreibe was du aendern moechtest... z.B. 'Slide 3 braucht mehr Kontrast'"
                        autocomplete="off">
                    <button class="showcase-chat__send" id="sc-feedback-send" title="Senden">\u27A4</button>
                </div>

                <!-- Status Log (hidden until there's content) -->
                <div class="showcase-chat__log" id="sc-feedback-log"></div>
            </div>

            <!-- Hidden elements needed by existing code -->
            <input type="hidden" id="sc-app-name" value="DGD Portal">
            <select id="sc-platform" style="display:none;">
                <option value="appstore_67">App Store (6.7")</option>
                <option value="playstore" selected>Play Store</option>
                <option value="appstore_65">App Store (6.5")</option>
            </select>
            <div id="sc-props-panel" style="display:none;">
                <div id="sc-templates"></div>
                <select id="sc-bg-type"><option value="gradient">Gradient</option><option value="solid">Solid</option></select>
                <input type="color" id="sc-bg-color1" value="#184E74">
                <input type="text" id="sc-bg-color1-hex" value="#184E74">
                <input type="color" id="sc-bg-color2" value="#CAA876">
                <input type="text" id="sc-bg-color2-hex" value="#CAA876">
                <div id="sc-elements-list"></div>
                <div id="sc-element-props" style="display:none;"><div id="sc-element-props-content"></div></div>
                <div id="sc-upload-section" style="display:none;">
                    <label id="sc-upload-drop"><input type="file" accept="image/*" id="sc-upload-input" style="display:none;"></label>
                </div>
            </div>
        </div>`;
    }

    function _buildSlideCanvases() {
        let html = '';
        for (let i = 0; i < 6; i++) {
            html += `
            <div class="showcase-canvas__slide ${i === 0 ? 'showcase-canvas__slide--active' : ''}" data-slide="${i}">
                <span class="showcase-canvas__slide-label">${i + 1}</span>
                <canvas id="sc-slide-canvas-${i}"></canvas>
            </div>`;
        }
        return html;
    }

    // =========================================================================
    // Canvas Setup
    // =========================================================================

    function _initCanvas() {
        slideCanvases = [];
        slideCtxs = [];

        for (let i = 0; i < 6; i++) {
            const canvas = document.getElementById(`sc-slide-canvas-${i}`);
            if (!canvas) continue;
            slideCanvases.push(canvas);
            slideCtxs.push(canvas.getContext('2d'));
            _bindSlideCanvasEvents(canvas);
        }

        _resizeCanvas();
        window.addEventListener('resize', _resizeCanvas);
    }

    function _resizeCanvas() {
        if (!slideCanvases.length) return;
        const strip = document.getElementById('sc-canvas-strip');
        if (!strip) return;

        // Use the showcase-builder root or mount container for true available width
        const root = container.querySelector('.showcase-builder') || container;
        const availableWidth = root.clientWidth - 24; // minus padding
        const canvasArea = strip.parentElement;
        const maxH = canvasArea.getBoundingClientRect().height - 24;

        // Fit all 6 slides within available width
        const gapTotal = 3 * 5; // 3px gap × 5 gaps
        let w = Math.floor((availableWidth - gapTotal) / 6);
        let h = Math.floor(w * (DH / DW)); // maintain 9:16 aspect ratio

        // If too tall, scale down from height
        if (h > maxH) {
            h = Math.max(maxH, 200);
            w = Math.floor(h * (DW / DH));
        }

        w = Math.max(60, w);
        h = Math.max(107, h);

        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 0; i < slideCanvases.length; i++) {
            const canvas = slideCanvases[i];
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width = `${Math.round(w)}px`;
            canvas.style.height = `${Math.round(h)}px`;
        }

        previewScale = slideCanvases[0].width / DW;

        render();
    }

    // =========================================================================
    // Event Bindings
    // =========================================================================

    function _bindEvents() {
        // Slide selection (click on slide wrapper to activate)
        container.querySelectorAll('.showcase-canvas__slide').forEach((el) => {
            el.addEventListener('click', (e) => {
                const idx = parseInt(el.dataset.slide);
                if (idx !== currentSlide) {
                    currentSlide = idx;
                    selectedElement = null;
                    _updateSlideSelection();
                    _updateUI();
                    render();
                }
            });
        });

        // Template selection
        container.querySelectorAll('.showcase-templates__item').forEach((el) => {
            el.addEventListener('click', () => {
                _applyTemplate(el.dataset.template);
            });
        });

        // Add element buttons
        container.querySelectorAll('[data-add]').forEach((btn) => {
            btn.addEventListener('click', () => addElement(btn.dataset.add));
        });

        // Background controls
        const bgType = document.getElementById('sc-bg-type');
        const bgColor1 = document.getElementById('sc-bg-color1');
        const bgColor1Hex = document.getElementById('sc-bg-color1-hex');
        const bgColor2 = document.getElementById('sc-bg-color2');
        const bgColor2Hex = document.getElementById('sc-bg-color2-hex');

        if (bgType) bgType.addEventListener('change', _onBackgroundChange);
        if (bgColor1) {
            bgColor1.addEventListener('input', () => { bgColor1Hex.value = bgColor1.value; _onBackgroundChange(); });
            bgColor1Hex.addEventListener('change', () => { bgColor1.value = bgColor1Hex.value; _onBackgroundChange(); });
        }
        if (bgColor2) {
            bgColor2.addEventListener('input', () => { bgColor2Hex.value = bgColor2.value; _onBackgroundChange(); });
            bgColor2Hex.addEventListener('change', () => { bgColor2.value = bgColor2Hex.value; _onBackgroundChange(); });
        }

        // App name
        const appNameInput = document.getElementById('sc-app-name');
        if (appNameInput) {
            appNameInput.addEventListener('change', () => {
                if (project) {
                    project.appName = appNameInput.value;
                    _saveProject();
                }
            });
        }

        // Export buttons
        const exportCurrent = document.getElementById('sc-export-current');
        const exportAllBtn = document.getElementById('sc-export-all');
        const saveBtn = document.getElementById('sc-save');
        const platformSelect = document.getElementById('sc-platform');

        if (exportCurrent) {
            exportCurrent.addEventListener('click', () => {
                exportSlide(currentSlide, platformSelect.value);
            });
        }
        if (exportAllBtn) {
            exportAllBtn.addEventListener('click', () => {
                exportAll(platformSelect.value);
            });
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                _saveProject();
                saveBtn.textContent = '\u2713 Gespeichert!';
                setTimeout(() => { saveBtn.textContent = '\u2713 Speichern'; }, 1500);
            });
        }

        // Cortex generation
        const cortexBtn = document.getElementById('sc-cortex-gen');
        if (cortexBtn) {
            cortexBtn.addEventListener('click', _onCortexGenerate);
        }

        // Auto-Generate button
        const autoGenBtn = document.getElementById('sc-auto-generate');
        if (autoGenBtn) {
            autoGenBtn.addEventListener('click', _onAutoGenerate);
        }

        // API Settings button
        const apiBtn = document.getElementById('sc-api-settings');
        if (apiBtn) {
            apiBtn.addEventListener('click', _showApiKeyDialog);
        }

        // Feedback send button (chat mode)
        const feedbackBtn = document.getElementById('sc-feedback-send');
        if (feedbackBtn) {
            feedbackBtn.addEventListener('click', _onFeedbackSend);
        }

        // Chat input: send on Enter
        const chatInput = document.getElementById('sc-chat-input');
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    _onFeedbackSend();
                }
            });
        }

        // Feedback quick-chips (suggestion cloud)
        container.querySelectorAll('[data-feedback]').forEach(chip => {
            chip.addEventListener('click', () => {
                const chatIn = document.getElementById('sc-chat-input');
                if (chatIn) chatIn.value = chip.dataset.feedback;
                _onFeedbackSend();
            });
        });

        // New project button
        const newBtn = document.getElementById('sc-new-project');
        if (newBtn) {
            newBtn.addEventListener('click', _showNewProjectDialog);
        }

        // Screenshot upload
        const uploadInput = document.getElementById('sc-upload-input');
        const uploadDrop = document.getElementById('sc-upload-drop');

        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                if (e.target.files[0] && selectedElement) {
                    handleScreenshotUpload(selectedElement, e.target.files[0]);
                }
            });
        }
        if (uploadDrop) {
            uploadDrop.addEventListener('dragover', (e) => { e.preventDefault(); uploadDrop.style.borderColor = 'var(--dgd-secondary)'; });
            uploadDrop.addEventListener('dragleave', () => { uploadDrop.style.borderColor = ''; });
            uploadDrop.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadDrop.style.borderColor = '';
                if (e.dataTransfer.files[0] && selectedElement) {
                    handleScreenshotUpload(selectedElement, e.dataTransfer.files[0]);
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!container || container.style.display === 'none') return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedElement) {
                    removeElement(selectedElement);
                    e.preventDefault();
                }
            }
            if (e.key === 'Escape') {
                selectedElement = null;
                _updatePropsPanel();
                render();
            }
        });
    }

    // =========================================================================
    // UI Update Helpers
    // =========================================================================

    function _updateUI() {
        _updateSlideSelection();
        _updateElementsList();
        _updatePropsPanel();
        _updateBackgroundControls();
        _updateExportInfo();

        const appNameInput = document.getElementById('sc-app-name');
        if (appNameInput && project) {
            appNameInput.value = project.appName;
        }
    }

    function _updateSlideSelection() {
        container.querySelectorAll('.showcase-canvas__slide').forEach((el, i) => {
            el.classList.toggle('showcase-canvas__slide--active', i === currentSlide);
        });
    }

    function _updateElementsList() {
        const list = document.getElementById('sc-elements-list');
        if (!list || !project) return;

        const slide = project.slides[currentSlide];
        const icons = { text: '\u270E', device: '\uD83D\uDCF1', shape: '\u25A0', badge: '\u2605', image: '\uD83D\uDDBC' };

        list.innerHTML = slide.elements.map(el => `
            <div class="showcase-elements__item ${el._id === selectedElement ? 'showcase-elements__item--selected' : ''}"
                 data-element="${el._id}">
                <span class="showcase-elements__item-icon">${icons[el.type] || '\u25CF'}</span>
                <span class="showcase-elements__item-name">${el.content ? el.content.slice(0, 25) : el.id || el.type}</span>
                <span class="showcase-elements__item-delete" data-delete="${el._id}" title="Entfernen">\u00D7</span>
            </div>
        `).join('');

        // Bind clicks
        list.querySelectorAll('.showcase-elements__item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.dataset.delete) {
                    removeElement(e.target.dataset.delete);
                    return;
                }
                selectedElement = item.dataset.element;
                _updateElementsList();
                _updatePropsPanel();
                render();
            });
        });
    }

    function _updatePropsPanel() {
        const propsEl = document.getElementById('sc-element-props');
        const propsContent = document.getElementById('sc-element-props-content');
        const uploadSection = document.getElementById('sc-upload-section');

        if (!propsEl || !propsContent) return;

        if (!selectedElement || !project) {
            propsEl.style.display = 'none';
            if (uploadSection) uploadSection.style.display = 'none';
            return;
        }

        const slide = project.slides[currentSlide];
        const el = slide.elements.find(e => e._id === selectedElement);
        if (!el) {
            propsEl.style.display = 'none';
            if (uploadSection) uploadSection.style.display = 'none';
            return;
        }

        propsEl.style.display = 'block';

        let html = '';

        if (el.type === 'text') {
            html += `
                <div class="showcase-props__row">
                    <label>Text</label>
                    <textarea id="sc-prop-text" rows="3">${_escHTML(el.content || '')}</textarea>
                    <button class="showcase-btn showcase-btn--cortex showcase-btn--sm" id="sc-improve-text" style="margin-top:4px;">
                        \uD83E\uDD16 Verbessern
                    </button>
                </div>
                <div class="showcase-props__row-inline">
                    <label>Groesse</label>
                    <input type="number" id="sc-prop-fontSize" value="${el.fontSize || 36}" min="12" max="120" style="width:70px;">
                    <label>Gewicht</label>
                    <select id="sc-prop-fontWeight" style="width:80px;">
                        <option value="400" ${el.fontWeight === 400 ? 'selected' : ''}>Normal</option>
                        <option value="500" ${el.fontWeight === 500 ? 'selected' : ''}>Medium</option>
                        <option value="600" ${el.fontWeight === 600 ? 'selected' : ''}>Semi</option>
                        <option value="700" ${el.fontWeight === 700 ? 'selected' : ''}>Bold</option>
                    </select>
                </div>
                <div class="showcase-props__color-input">
                    <input type="color" id="sc-prop-color" value="${el.color && el.color.startsWith('#') ? el.color : '#ffffff'}">
                    <input type="text" id="sc-prop-color-hex" value="${el.color || '#ffffff'}" style="width:100px;">
                </div>
                <div class="showcase-props__row-inline" style="margin-top:6px;">
                    <label>Align</label>
                    <select id="sc-prop-align">
                        <option value="left" ${el.align === 'left' ? 'selected' : ''}>Links</option>
                        <option value="center" ${el.align === 'center' ? 'selected' : ''}>Mitte</option>
                        <option value="right" ${el.align === 'right' ? 'selected' : ''}>Rechts</option>
                    </select>
                </div>`;
        } else if (el.type === 'device') {
            html += `
                <div class="showcase-props__row">
                    <label>Device</label>
                    <select id="sc-prop-device">
                        <option value="iphone" ${el.device === 'iphone' ? 'selected' : ''}>iPhone</option>
                        <option value="android" ${el.device === 'android' ? 'selected' : ''}>Android</option>
                    </select>
                </div>
                <div class="showcase-props__row-inline">
                    <label>Skalierung</label>
                    <input type="range" id="sc-prop-scale" min="0.5" max="2.5" step="0.05" value="${el.scale || 1}" style="flex:1;">
                    <span id="sc-prop-scale-val">${(el.scale || 1).toFixed(2)}</span>
                </div>`;
            // Show upload section for device elements
            if (uploadSection) uploadSection.style.display = 'block';
        } else if (el.type === 'shape') {
            html += `
                <div class="showcase-props__row-inline">
                    <label>Form</label>
                    <select id="sc-prop-shapeType">
                        <option value="rect" ${el.shapeType === 'rect' ? 'selected' : ''}>Rechteck</option>
                        <option value="circle" ${el.shapeType === 'circle' ? 'selected' : ''}>Kreis</option>
                    </select>
                </div>
                <div class="showcase-props__row-inline">
                    <label>B</label>
                    <input type="number" id="sc-prop-w" value="${el.w || 100}" style="width:70px;">
                    <label>H</label>
                    <input type="number" id="sc-prop-h" value="${el.h || 100}" style="width:70px;">
                </div>
                <div class="showcase-props__color-input">
                    <label style="min-width:40px;">Fill</label>
                    <input type="color" id="sc-prop-fill" value="${el.fill && el.fill.startsWith('#') ? el.fill : '#ffffff'}">
                    <input type="text" id="sc-prop-fill-hex" value="${el.fill || 'rgba(255,255,255,0.1)'}" style="width:120px;">
                </div>`;
        } else if (el.type === 'badge') {
            html += `
                <div class="showcase-props__row-inline">
                    <label>Icon</label>
                    <input type="text" id="sc-prop-icon" value="${el.icon || ''}" style="width:50px;">
                    <label>Label</label>
                    <input type="text" id="sc-prop-label" value="${_escHTML(el.label || '')}" style="flex:1;">
                </div>
                <div class="showcase-props__row-inline">
                    <label>Stil</label>
                    <select id="sc-prop-badge-style">
                        <option value="pill" ${el.style === 'pill' ? 'selected' : ''}>Pill</option>
                        <option value="square" ${el.style === 'square' ? 'selected' : ''}>Eckig</option>
                    </select>
                </div>`;
        }

        // Position (for all types)
        html += `
            <div class="showcase-props__row-inline" style="margin-top:8px;">
                <label>X</label>
                <input type="number" id="sc-prop-x" value="${el.x || 0}" style="width:70px;">
                <label>Y</label>
                <input type="number" id="sc-prop-y" value="${el.y || 0}" style="width:70px;">
            </div>`;

        propsContent.innerHTML = html;

        // Hide upload for non-device elements
        if (el.type !== 'device' && uploadSection) {
            uploadSection.style.display = 'none';
        }

        // Bind property change events
        _bindPropEvents(el);
    }

    function _bindPropEvents(el) {
        const bind = (id, prop, transform) => {
            const input = document.getElementById(id);
            if (!input) return;
            const eventType = input.tagName === 'SELECT' ? 'change' :
                             input.type === 'range' ? 'input' :
                             input.type === 'color' ? 'input' : 'change';
            input.addEventListener(eventType, () => {
                const value = transform ? transform(input.value) : input.value;
                updateElement(el._id, { [prop]: value });

                // Sync hex <-> color picker
                if (id === 'sc-prop-color') {
                    const hex = document.getElementById('sc-prop-color-hex');
                    if (hex) hex.value = input.value;
                }
                if (id === 'sc-prop-color-hex') {
                    const picker = document.getElementById('sc-prop-color');
                    if (picker && input.value.startsWith('#')) picker.value = input.value;
                }
                if (id === 'sc-prop-scale') {
                    const valSpan = document.getElementById('sc-prop-scale-val');
                    if (valSpan) valSpan.textContent = parseFloat(input.value).toFixed(2);
                }
            });
        };

        // Text properties
        bind('sc-prop-text', 'content');
        bind('sc-prop-fontSize', 'fontSize', v => parseInt(v));
        bind('sc-prop-fontWeight', 'fontWeight', v => parseInt(v));
        bind('sc-prop-color', 'color');
        bind('sc-prop-color-hex', 'color');
        bind('sc-prop-align', 'align');

        // Device properties
        bind('sc-prop-device', 'device');
        bind('sc-prop-scale', 'scale', v => parseFloat(v));

        // Shape properties
        bind('sc-prop-shapeType', 'shapeType');
        bind('sc-prop-w', 'w', v => parseInt(v));
        bind('sc-prop-h', 'h', v => parseInt(v));
        bind('sc-prop-fill', 'fill');
        bind('sc-prop-fill-hex', 'fill');

        // Badge properties
        bind('sc-prop-icon', 'icon');
        bind('sc-prop-label', 'label');
        bind('sc-prop-badge-style', 'style');

        // Position
        bind('sc-prop-x', 'x', v => parseInt(v));
        bind('sc-prop-y', 'y', v => parseInt(v));

        // Cortex improve button
        const improveBtn = document.getElementById('sc-improve-text');
        if (improveBtn) {
            improveBtn.addEventListener('click', async () => {
                const textInput = document.getElementById('sc-prop-text');
                if (!textInput) return;
                improveBtn.disabled = true;
                improveBtn.textContent = '\u23F3 Wird verbessert...';
                const improved = await ShowcaseCortex.improveText(textInput.value, 'headline');
                textInput.value = improved;
                updateElement(el._id, { content: improved });
                improveBtn.disabled = false;
                improveBtn.textContent = '\uD83E\uDD16 Verbessern';
            });
        }
    }

    function _updateBackgroundControls() {
        if (!project) return;
        const slide = project.slides[currentSlide];
        const bg = slide.background;

        const bgType = document.getElementById('sc-bg-type');
        const bgColor1 = document.getElementById('sc-bg-color1');
        const bgColor1Hex = document.getElementById('sc-bg-color1-hex');
        const bgColor2 = document.getElementById('sc-bg-color2');
        const bgColor2Hex = document.getElementById('sc-bg-color2-hex');
        const bgColor2Row = document.getElementById('sc-bg-color2-row');

        if (bgType) bgType.value = bg.type;
        if (bg.type === 'solid') {
            if (bgColor1) bgColor1.value = bg.color || '#ffffff';
            if (bgColor1Hex) bgColor1Hex.value = bg.color || '#ffffff';
            if (bgColor2Row) bgColor2Row.style.display = 'none';
        } else {
            if (bgColor1) bgColor1.value = bg.from || '#184E74';
            if (bgColor1Hex) bgColor1Hex.value = bg.from || '#184E74';
            if (bgColor2) bgColor2.value = bg.to || '#2c5282';
            if (bgColor2Hex) bgColor2Hex.value = bg.to || '#2c5282';
            if (bgColor2Row) bgColor2Row.style.display = 'flex';
        }
    }

    function _updateExportInfo() {
        const info = document.getElementById('sc-export-info');
        if (info && project) {
            info.textContent = `Slide ${currentSlide + 1}/6 \u2022 ${project.appName}`;
        }
    }

    function _onBackgroundChange() {
        if (!project) return;
        const slide = project.slides[currentSlide];
        const bgType = document.getElementById('sc-bg-type');
        const bgColor1 = document.getElementById('sc-bg-color1');
        const bgColor2 = document.getElementById('sc-bg-color2');
        const bgColor2Row = document.getElementById('sc-bg-color2-row');

        if (bgType.value === 'solid') {
            slide.background = { type: 'solid', color: bgColor1.value };
            if (bgColor2Row) bgColor2Row.style.display = 'none';
        } else {
            slide.background = { type: 'gradient', from: bgColor1.value, to: bgColor2.value, angle: 180 };
            if (bgColor2Row) bgColor2Row.style.display = 'flex';
        }

        _saveProject();
        render();
    }

    function _applyTemplate(templateId) {
        if (!project) return;
        const tpl = ShowcaseTemplates.getTemplate(templateId);
        if (!tpl) return;

        const slide = project.slides[currentSlide];
        slide.template = tpl.id;
        slide.background = tpl.background;
        slide.elements = tpl.elements.map((el, idx) => ({
            ...el,
            _id: `el_${currentSlide}_${idx}`,
        }));
        selectedElement = null;

        // Clear cached screenshots for this slide
        for (const key of Object.keys(screenshotImages)) {
            if (key.startsWith(`el_${currentSlide}_`)) {
                delete screenshotImages[key];
            }
        }

        _saveProject();
        _updateUI();
        render();

        // Highlight active template
        container.querySelectorAll('.showcase-templates__item').forEach(el => {
            el.classList.toggle('showcase-templates__item--active', el.dataset.template === templateId);
        });
    }

    // =========================================================================
    // Cortex Integration
    // =========================================================================

    async function _onCortexGenerate() {
        const btn = document.getElementById('sc-cortex-gen');
        if (!btn || !project) return;

        btn.disabled = true;
        btn.textContent = '\u23F3 Generiere...';

        const appName = project.appName;
        // Collect existing text elements as features hint
        const features = project.slides
            .flatMap(s => s.elements)
            .filter(e => e.type === 'text' && e.id !== 'headline' && e.id !== 'subline')
            .map(e => e.content)
            .filter(Boolean)
            .join(', ');

        const texts = await ShowcaseCortex.generateSlideTexts(appName, features || 'App Features', 6);

        // Apply texts to slides
        for (let i = 0; i < Math.min(texts.length, project.slides.length); i++) {
            const slide = project.slides[i];
            const headlineEl = slide.elements.find(e => e.id === 'headline');
            const sublineEl = slide.elements.find(e => e.id === 'subline');
            if (headlineEl && texts[i].headline) headlineEl.content = texts[i].headline;
            if (sublineEl && texts[i].subline) sublineEl.content = texts[i].subline;
        }

        _saveProject();
        _updateUI();
        render();

        btn.disabled = false;
        btn.textContent = '\uD83E\uDD16 Cortex Texte';
    }

    // =========================================================================
    // Auto-Generate (One-Click Pipeline)
    // =========================================================================

    async function _onAutoGenerate() {
        if (isGenerating) return;
        if (!project) return;

        const hasOrchestrator = typeof ShowcaseOrchestrator !== 'undefined';
        if (!hasOrchestrator) {
            alert('ShowcaseOrchestrator module not loaded.');
            return;
        }

        isGenerating = true;
        const btn = document.getElementById('sc-auto-generate');
        if (btn) { btn.disabled = true; btn.textContent = '\u23F3 Generiere...'; }

        // Show progress overlay
        const progressEl = document.getElementById('sc-progress');
        if (progressEl) progressEl.style.display = 'flex';

        // Listen to progress events
        ShowcaseOrchestrator.onProgress((info) => {
            const textEl = document.getElementById('sc-progress-text');
            const barEl = document.getElementById('sc-progress-bar');
            const stepEl = document.getElementById('sc-progress-step');
            if (textEl) textEl.textContent = info.message || 'Generiere...';
            if (barEl) barEl.style.width = (info.percent || 0) + '%';
            if (stepEl) stepEl.textContent = `Step ${info.step || 1}/${info.totalSteps || 4}`;
        });

        try {
            const appName = project.appName || 'My App';
            const features = document.getElementById('sc-app-name')?.value || appName;

            const result = await ShowcaseOrchestrator.autoGenerate(appName, '', {});

            if (result) {
                // Apply generated brief to project
                if (result.brief) {
                    project.brandColors = {
                        primary: result.brief.primaryColor || '#184E74',
                        accent: result.brief.accentColor || '#CAA876',
                    };
                }

                // Apply panorama
                if (result.panorama) {
                    console.log('[Builder] Panorama received:', result.panorama.constructor.name,
                        result.panorama.width + 'x' + result.panorama.height);
                    if (result.panorama instanceof HTMLCanvasElement) {
                        panoramaCanvas = result.panorama;
                        panoramaImage = null;
                    } else if (result.panorama instanceof HTMLImageElement) {
                        panoramaImage = result.panorama;
                        panoramaCanvas = null;
                    }
                } else {
                    console.warn('[Builder] No panorama in result!');
                }

                // Apply texts + templates to slides
                if (result.slides && result.slides.length) {
                    const templateOrder = ['hero', 'feature', 'split', 'fullscreen', 'feature', 'comparison'];
                    for (let i = 0; i < Math.min(result.slides.length, 6); i++) {
                        const slideData = result.slides[i];
                        const tplId = slideData.template || templateOrder[i];
                        const tpl = ShowcaseTemplates.getTemplate(tplId);
                        if (tpl) {
                            project.slides[i].template = tpl.id;
                            // Update background colors from brief
                            if (result.brief) {
                                project.slides[i].background = {
                                    type: 'gradient',
                                    from: result.brief.primaryColor || '#184E74',
                                    to: result.brief.accentColor || '#2c5282',
                                    angle: 135 + i * 15,
                                };
                            }
                            // Apply text content
                            project.slides[i].elements = tpl.elements.map((el, idx) => {
                                const newEl = { ...el, _id: `el_${i}_${idx}` };
                                if (el.id === 'headline' && slideData.headline) newEl.content = slideData.headline;
                                if (el.id === 'subline' && slideData.subline) newEl.content = slideData.subline;
                                // Apply brand colors to text
                                if (result.brief && el.type === 'text') {
                                    if (el.id === 'headline') newEl.color = '#ffffff';
                                    if (el.color === '#CAA876') newEl.color = result.brief.accentColor || '#CAA876';
                                }
                                return newEl;
                            });
                        }
                    }
                }

                // Apply scene layers from Scene Engine iterations
                if (result.project && result.project._scenes) {
                    project._scenes = result.project._scenes;
                }

                _saveProject();
                _updateUI();
                render();
            }
        } catch (err) {
            console.error('[ShowcaseBuilder] Auto-generate error:', err);
            const textEl = document.getElementById('sc-progress-text');
            if (textEl) textEl.textContent = 'Fehler: ' + err.message;
        }

        // Hide progress after delay
        setTimeout(() => {
            if (progressEl) progressEl.style.display = 'none';
        }, 800);

        isGenerating = false;
        if (btn) { btn.disabled = false; btn.textContent = '\u2728 Auto-Generate'; }
    }

    // =========================================================================
    // Feedback System
    // =========================================================================

    async function _onFeedbackSend() {
        const chatInput = document.getElementById('sc-chat-input');
        const feedbackLog = document.getElementById('sc-feedback-log');
        const btn = document.getElementById('sc-feedback-send');
        if (!chatInput || !chatInput.value.trim() || !project) return;

        const feedbackText = chatInput.value.trim();
        if (btn) { btn.disabled = true; btn.textContent = '\u23F3'; }

        // Show user message in log
        if (feedbackLog) {
            feedbackLog.style.display = 'block';
            feedbackLog.innerHTML += `<div class="showcase-chat__msg showcase-chat__msg--user">${_escHTML(feedbackText)}</div>`;
            feedbackLog.scrollTop = feedbackLog.scrollHeight;
        }

        try {
            if (typeof ShowcaseOrchestrator !== 'undefined') {
                const changes = await ShowcaseOrchestrator.submitFeedback(feedbackText, project);
                if (changes && changes.slides) {
                    for (const slideChange of changes.slides) {
                        const idx = slideChange.index;
                        if (idx >= 0 && idx < project.slides.length) {
                            const slide = project.slides[idx];
                            if (slideChange.changes) {
                                const c = slideChange.changes;
                                if (c.headline) {
                                    const el = slide.elements.find(e => e.id === 'headline');
                                    if (el) el.content = c.headline;
                                }
                                if (c.subline) {
                                    const el = slide.elements.find(e => e.id === 'subline');
                                    if (el) el.content = c.subline;
                                }
                            }
                        }
                    }
                }
                if (changes && changes.colors) {
                    if (changes.colors.primary) {
                        for (const slide of project.slides) {
                            if (slide.background.type === 'gradient') {
                                slide.background.from = changes.colors.primary;
                            }
                        }
                    }
                }
                // Regenerate panorama with new colors if needed
                if (changes && changes.colors && typeof ShowcasePanorama !== 'undefined') {
                    const brief = {
                        primaryColor: changes.colors.primary || project.brandColors.primary,
                        accentColor: changes.colors.accent || project.brandColors.accent,
                        mood: 'professional',
                    };
                    panoramaCanvas = ShowcasePanorama.generate(brief);
                }

                _saveProject();
                _updateUI();
                render();

                if (feedbackLog) {
                    feedbackLog.innerHTML += `<div class="showcase-chat__msg showcase-chat__msg--ai">\u2713 Aenderungen angewendet</div>`;
                    feedbackLog.scrollTop = feedbackLog.scrollHeight;
                }
            }
        } catch (err) {
            console.error('[ShowcaseBuilder] Feedback error:', err);
            if (feedbackLog) {
                feedbackLog.innerHTML += `<div class="showcase-chat__msg showcase-chat__msg--error">\u2717 ${err.message}</div>`;
            }
        }

        chatInput.value = '';
        if (btn) { btn.disabled = false; btn.textContent = '\u27A4'; }
    }

    // =========================================================================
    // API Key Dialog
    // =========================================================================

    function _showApiKeyDialog() {
        const currentKey = typeof ShowcaseOrchestrator !== 'undefined'
            ? ShowcaseOrchestrator.getApiKey() || '' : localStorage.getItem('showcase_openai_key') || '';
        const masked = currentKey ? currentKey.slice(0, 7) + '...' + currentKey.slice(-4) : '';

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:12px;padding:32px;max-width:450px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <h3 style="margin:0 0 8px;color:#184E74;">\u2699\uFE0F OpenAI API Key</h3>
                <p style="margin:0 0 4px;color:#6c757d;font-size:13px;">Fuer AI-Bildgenerierung (DALL-E 3) und intelligente Texte (GPT-4o-mini).</p>
                <p style="margin:0 0 16px;color:#6c757d;font-size:12px;">${masked ? 'Aktuell: ' + masked : 'Noch kein Key gespeichert.'}</p>
                <input type="password" id="sc-api-key-input" value="${currentKey}"
                    style="width:100%;padding:10px 14px;border:2px solid #dee2e6;border-radius:8px;font-size:14px;font-family:monospace;outline:none;"
                    placeholder="sk-...">
                <p style="margin:8px 0 0;font-size:11px;color:#aaa;">Wird lokal im Browser gespeichert. Nie an Server gesendet.</p>
                <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
                    <button id="sc-api-cancel" class="showcase-btn">Abbrechen</button>
                    <button id="sc-api-clear" class="showcase-btn" style="color:var(--dgd-danger);">Loeschen</button>
                    <button id="sc-api-save" class="showcase-btn showcase-btn--primary">Speichern</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const input = document.getElementById('sc-api-key-input');
        input.focus();

        document.getElementById('sc-api-save').addEventListener('click', () => {
            const key = input.value.trim();
            if (key) {
                if (typeof ShowcaseOrchestrator !== 'undefined') {
                    ShowcaseOrchestrator.setApiKey(key);
                } else {
                    localStorage.setItem('showcase_openai_key', key);
                }
            }
            overlay.remove();
        });
        document.getElementById('sc-api-clear').addEventListener('click', () => {
            if (typeof ShowcaseOrchestrator !== 'undefined') {
                ShowcaseOrchestrator.setApiKey('');
            }
            localStorage.removeItem('showcase_openai_key');
            overlay.remove();
        });
        document.getElementById('sc-api-cancel').addEventListener('click', () => overlay.remove());
    }

    // =========================================================================
    // Panorama Management
    // =========================================================================

    function setPanorama(canvasOrImage) {
        if (canvasOrImage instanceof HTMLCanvasElement) {
            panoramaCanvas = canvasOrImage;
            panoramaImage = null;
        } else if (canvasOrImage instanceof HTMLImageElement) {
            panoramaImage = canvasOrImage;
            panoramaCanvas = null;
        }
        render();
    }

    function clearPanorama() {
        panoramaCanvas = null;
        panoramaImage = null;
        render();
    }

    // =========================================================================
    // New Project Dialog
    // =========================================================================

    function _showNewProjectDialog() {
        // Inline dialog instead of prompt() for better UX
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:12px;padding:32px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <h3 style="margin:0 0 8px;color:#184E74;">Neues Showcase-Projekt</h3>
                <p style="margin:0 0 16px;color:#6c757d;font-size:14px;">Gib den Namen deiner App ein.</p>
                <input type="text" id="sc-new-name" value="${project ? project.appName : 'DGD Portal'}"
                    style="width:100%;padding:10px 14px;border:2px solid #dee2e6;border-radius:8px;font-size:16px;font-family:Inter,sans-serif;outline:none;"
                    placeholder="App Name">
                <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
                    <button id="sc-new-cancel" class="showcase-btn">Abbrechen</button>
                    <button id="sc-new-ok" class="showcase-btn showcase-btn--primary">Erstellen</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const input = document.getElementById('sc-new-name');
        input.focus();
        input.select();

        const doCreate = () => {
            const name = input.value.trim();
            if (name) {
                createProject(name, 'both');
                currentSlide = 0;
                selectedElement = null;
                screenshotImages = {};
                _updateUI();
                render();
            }
            overlay.remove();
        };

        document.getElementById('sc-new-ok').addEventListener('click', doCreate);
        document.getElementById('sc-new-cancel').addEventListener('click', () => {
            overlay.remove();
            // If no project at all, create a default
            if (!project) {
                createProject('DGD Portal', 'both');
                _updateUI();
                render();
            }
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCreate(); });
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    function _slug(text) {
        return (text || 'app').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function _escHTML(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // =========================================================================
    // Public API
    // =========================================================================

    return {
        mount,
        destroy,
        createProject,
        loadProject,
        listProjects,
        addElement,
        removeElement,
        updateElement,
        exportSlide,
        exportAll,
        render,
        setPanorama,
        clearPanorama,
        get project() { return project; },
        get currentSlide() { return currentSlide; },
    };
})();
