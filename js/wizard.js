/**
 * DGD Portal - Fullscreen Wizard Engine
 * Reusable multi-step wizard with gamification, animations, and mobile support.
 *
 * Usage:
 *   const wizard = new DGDWizard({
 *       containerId: 'my-container',
 *       steps: [ ... ],
 *       onComplete: (formData) => { ... },
 *       onStepChange: (index, step) => { ... },
 *   });
 *   wizard.render();
 */

class DGDWizard {

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @param {Object} config
     * @param {string}   config.containerId        - DOM element ID to render wizard into
     * @param {Array}    config.steps              - Array of step configuration objects
     * @param {Function} [config.onComplete]       - Called with collected formData on finish
     * @param {Function} [config.onStepChange]     - Called with (stepIndex, step) on navigation
     * @param {boolean}  [config.showStepIndicators=true]
     * @param {boolean}  [config.allowBack=true]
     */
    constructor(config) {
        if (!config || !config.containerId || !Array.isArray(config.steps) || config.steps.length === 0) {
            throw new Error('[DGDWizard] containerId and at least one step are required.');
        }

        this._containerId = config.containerId;
        this._steps = config.steps;
        this._onComplete = config.onComplete || null;
        this._onStepChange = config.onStepChange || null;
        this._showStepIndicators = config.showStepIndicators !== false;
        this._allowBack = config.allowBack !== false;

        this._currentIndex = 0;
        this._isAnimating = false;
        this._direction = 'forward'; // 'forward' | 'backward'

        // DOM references (set in render)
        this._overlay = null;
        this._progressFill = null;
        this._progressLabel = null;
        this._indicatorRow = null;
        this._encouragementEl = null;
        this._contentArea = null;
        this._contentInner = null;
        this._btnBack = null;
        this._btnNext = null;
        this._mobileLabel = null;

        // Store rendered step containers so data is preserved when navigating back
        this._stepContainers = new Array(this._steps.length).fill(null);

        // Bound handlers for cleanup
        this._handleKeydown = this._onKeydown.bind(this);
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Build the wizard DOM and insert it into the container element.
     */
    render() {
        const container = document.getElementById(this._containerId);
        if (!container) {
            throw new Error(`[DGDWizard] Container element "#${this._containerId}" not found.`);
        }

        // Build overlay
        this._overlay = this._createElement('div', 'dgd-wizard-overlay');

        // -- Progress bar --
        const progressWrap = this._createElement('div', 'dgd-wizard-progress');
        const progressTrack = this._createElement('div', 'dgd-wizard-progress__track');
        this._progressFill = this._createElement('div', 'dgd-wizard-progress__fill');
        progressTrack.appendChild(this._progressFill);
        this._progressLabel = this._createElement('span', 'dgd-wizard-progress__label');
        progressWrap.appendChild(progressTrack);
        progressWrap.appendChild(this._progressLabel);
        this._overlay.appendChild(progressWrap);

        // -- Step indicators --
        if (this._showStepIndicators) {
            this._indicatorRow = this._createElement('div', 'dgd-wizard-indicators');
            this._mobileLabel = this._createElement('span', 'dgd-wizard-indicators__mobile');
            this._indicatorRow.appendChild(this._mobileLabel);
            this._buildIndicators();
            this._overlay.appendChild(this._indicatorRow);
        }

        // -- Encouragement --
        this._encouragementEl = this._createElement('div', 'dgd-wizard-encouragement');
        this._overlay.appendChild(this._encouragementEl);

        // -- Content area --
        this._contentArea = this._createElement('div', 'dgd-wizard-content');
        this._contentInner = this._createElement('div', 'dgd-wizard-content__inner');
        this._contentArea.appendChild(this._contentInner);
        this._overlay.appendChild(this._contentArea);

        // -- Action buttons --
        const actionsWrap = this._createElement('div', 'dgd-wizard-actions');

        this._btnBack = this._createElement('button', 'dgd-btn dgd-btn--outline-dark dgd-wizard-actions__back');
        this._btnBack.type = 'button';
        this._btnBack.innerHTML = '&larr; Zur\u00fcck';
        this._btnBack.addEventListener('click', () => this.prevStep());

        this._btnNext = this._createElement('button', 'dgd-btn dgd-btn--primary dgd-wizard-actions__next');
        this._btnNext.type = 'button';
        this._btnNext.textContent = 'Weiter';
        this._btnNext.addEventListener('click', () => this.nextStep());

        actionsWrap.appendChild(this._btnBack);
        actionsWrap.appendChild(this._btnNext);
        this._overlay.appendChild(actionsWrap);

        // Insert into container
        container.innerHTML = '';
        container.appendChild(this._overlay);

        // Keyboard navigation
        document.addEventListener('keydown', this._handleKeydown);

        // Render initial step
        this._showStep(this._currentIndex, false);
    }

    /**
     * Advance to the next step (validates first).
     * On the last step, triggers onComplete.
     */
    nextStep() {
        if (this._isAnimating) return;

        const step = this._steps[this._currentIndex];

        // Validate current step
        if (typeof step.validate === 'function' && !step.validate()) {
            this._shakeNextButton();
            return;
        }

        // Last step => complete
        if (this._currentIndex >= this._steps.length - 1) {
            this._complete();
            return;
        }

        this._direction = 'forward';
        const nextIdx = this._currentIndex + 1;
        this._animateTransition(nextIdx);
    }

    /**
     * Go back to the previous step.
     */
    prevStep() {
        if (this._isAnimating) return;
        if (!this._allowBack) return;
        if (this._currentIndex <= 0) return;

        this._direction = 'backward';
        const prevIdx = this._currentIndex - 1;
        this._animateTransition(prevIdx);
    }

    /**
     * Jump to a specific step by index.
     * @param {number} index
     */
    goToStep(index) {
        if (this._isAnimating) return;
        if (index < 0 || index >= this._steps.length) return;
        if (index === this._currentIndex) return;

        this._direction = index > this._currentIndex ? 'forward' : 'backward';
        this._animateTransition(index);
    }

    /**
     * @returns {Object} Current step configuration object.
     */
    getCurrentStep() {
        return this._steps[this._currentIndex];
    }

    /**
     * @returns {number} Current step index (0-based).
     */
    getStepIndex() {
        return this._currentIndex;
    }

    /**
     * Collect all input/select/textarea values from every rendered step.
     * @returns {Object} key-value map (input name or id => value)
     */
    getFormData() {
        const data = {};
        this._stepContainers.forEach(container => {
            if (!container) return;
            const inputs = container.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                const key = input.name || input.id;
                if (!key) return;
                if (input.type === 'checkbox') {
                    data[key] = input.checked;
                } else if (input.type === 'radio') {
                    if (input.checked) data[key] = input.value;
                } else {
                    data[key] = input.value;
                }
            });
        });
        return data;
    }

    /**
     * Remove the wizard from the DOM and detach all event listeners.
     */
    destroy() {
        document.removeEventListener('keydown', this._handleKeydown);

        // Notify current step of leave
        const step = this._steps[this._currentIndex];
        if (step && typeof step.onLeave === 'function') {
            try { step.onLeave(); } catch (_) { /* ignore */ }
        }

        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }

        this._overlay = null;
        this._stepContainers.fill(null);
    }

    /**
     * Update the encouragement message dynamically.
     * @param {string} text
     */
    setEncouragement(text) {
        if (!this._encouragementEl) return;
        this._encouragementEl.textContent = text || '';
        if (text) {
            // Re-trigger fade-in animation
            this._encouragementEl.classList.remove('dgd-wizard-encouragement--animate');
            // Force reflow
            void this._encouragementEl.offsetWidth;
            this._encouragementEl.classList.add('dgd-wizard-encouragement--animate');
        }
    }

    // =========================================================================
    // Private - Rendering
    // =========================================================================

    /**
     * Show a step without animation (used for initial render).
     * @param {number} index
     * @param {boolean} animate
     */
    _showStep(index, animate) {
        const step = this._steps[index];

        // Update current index
        this._currentIndex = index;

        // Render step content (or reuse existing)
        this._renderStepContent(index);

        // Update progress bar
        this._updateProgress();

        // Update indicators
        if (this._showStepIndicators) {
            this._updateIndicators();
        }

        // Encouragement
        if (step.encouragement && index > 0) {
            this.setEncouragement(step.encouragement);
        } else {
            this._encouragementEl.textContent = '';
        }

        // Full-width toggle
        if (step.fullWidth) {
            this._contentArea.classList.add('dgd-wizard-content--fullwidth');
        } else {
            this._contentArea.classList.remove('dgd-wizard-content--fullwidth');
        }

        // Back button visibility
        this._btnBack.style.visibility = (this._allowBack && index > 0) ? 'visible' : 'hidden';

        // Next button label
        const isLast = index >= this._steps.length - 1;
        this._btnNext.textContent = step.nextLabel || (isLast ? 'Abschliessen' : 'Weiter');
        if (step.backLabel && this._btnBack) {
            this._btnBack.innerHTML = step.backLabel;
        } else {
            this._btnBack.innerHTML = '&larr; Zur\u00fcck';
        }

        // Callback
        if (typeof this._onStepChange === 'function') {
            this._onStepChange(index, step);
        }

        // Step onEnter
        if (typeof step.onEnter === 'function') {
            // Defer slightly so DOM is painted
            requestAnimationFrame(() => {
                step.onEnter();
                // Dispatch custom event for things like Leaflet map
                this._contentArea.dispatchEvent(new CustomEvent('wizard-step-enter', {
                    bubbles: true,
                    detail: { stepIndex: index, stepId: step.id },
                }));
            });
        }
    }

    /**
     * Render step content into the content area.
     * Reuses previously rendered containers to preserve input state.
     * @param {number} index
     */
    _renderStepContent(index) {
        const step = this._steps[index];

        // Create container on first visit
        if (!this._stepContainers[index]) {
            const el = this._createElement('div', 'dgd-wizard-step');
            el.setAttribute('data-step-id', step.id || `step-${index}`);

            // Title
            if (step.title) {
                const h2 = document.createElement('h2');
                h2.className = 'dgd-wizard-step__title';
                h2.textContent = step.title;
                el.appendChild(h2);
            }

            // Subtitle
            if (step.subtitle) {
                const sub = document.createElement('p');
                sub.className = 'dgd-wizard-step__subtitle';
                sub.textContent = step.subtitle;
                el.appendChild(sub);
            }

            // Custom content rendered by step.render()
            const contentEl = this._createElement('div', 'dgd-wizard-step__content');
            el.appendChild(contentEl);

            if (typeof step.render === 'function') {
                step.render(contentEl, this);
            }

            this._stepContainers[index] = el;
        }

        // Swap into content inner
        this._contentInner.innerHTML = '';
        this._contentInner.appendChild(this._stepContainers[index]);
    }

    /**
     * Build the step indicator circles and connecting lines.
     */
    _buildIndicators() {
        // Remove any existing desktop indicators (keep mobile label)
        const existing = this._indicatorRow.querySelectorAll('.dgd-wizard-indicator, .dgd-wizard-indicator__line');
        existing.forEach(el => el.remove());

        this._steps.forEach((step, i) => {
            if (i > 0) {
                const line = this._createElement('span', 'dgd-wizard-indicator__line');
                this._indicatorRow.appendChild(line);
            }

            const circle = this._createElement('span', 'dgd-wizard-indicator');
            circle.setAttribute('data-index', i);
            circle.textContent = i + 1;

            if (step.icon) {
                circle.setAttribute('data-icon', step.icon);
            }

            this._indicatorRow.appendChild(circle);
        });
    }

    /**
     * Update indicator states (pending, active, done) and mobile label.
     */
    _updateIndicators() {
        const indicators = this._indicatorRow.querySelectorAll('.dgd-wizard-indicator');
        const lines = this._indicatorRow.querySelectorAll('.dgd-wizard-indicator__line');

        indicators.forEach((el, i) => {
            el.classList.remove('dgd-wizard-indicator--active', 'dgd-wizard-indicator--done');

            if (i < this._currentIndex) {
                el.classList.add('dgd-wizard-indicator--done');
                el.innerHTML = '&#10003;'; // checkmark
            } else if (i === this._currentIndex) {
                el.classList.add('dgd-wizard-indicator--active');
                el.textContent = i + 1;
            } else {
                el.textContent = i + 1;
            }
        });

        // Lines: done (green) up to current
        lines.forEach((line, i) => {
            if (i < this._currentIndex) {
                line.classList.add('dgd-wizard-indicator__line--done');
            } else {
                line.classList.remove('dgd-wizard-indicator__line--done');
            }
        });

        // Mobile label
        if (this._mobileLabel) {
            this._mobileLabel.textContent = `Schritt ${this._currentIndex + 1} von ${this._steps.length}`;
        }
    }

    /**
     * Update progress bar width and label.
     */
    _updateProgress() {
        const total = this._steps.length;
        const pct = Math.round(((this._currentIndex + 1) / total) * 100);

        if (this._progressFill) {
            this._progressFill.style.width = pct + '%';
        }
        if (this._progressLabel) {
            this._progressLabel.textContent = pct + '%';
            // Bounce animation class
            this._progressLabel.classList.remove('dgd-wizard-progress__label--bounce');
            void this._progressLabel.offsetWidth;
            this._progressLabel.classList.add('dgd-wizard-progress__label--bounce');
        }
    }

    // =========================================================================
    // Private - Transitions
    // =========================================================================

    /**
     * Animate from current step to target index.
     * @param {number} targetIndex
     */
    _animateTransition(targetIndex) {
        this._isAnimating = true;

        const currentStep = this._steps[this._currentIndex];
        const oldContent = this._contentInner;

        // Notify leaving step
        if (typeof currentStep.onLeave === 'function') {
            try { currentStep.onLeave(); } catch (_) { /* ignore */ }
        }

        // Determine animation classes
        const outClass = this._direction === 'forward'
            ? 'dgd-wizard-content--slide-out-left'
            : 'dgd-wizard-content--slide-out-right';
        const inClass = this._direction === 'forward'
            ? 'dgd-wizard-content--slide-in-right'
            : 'dgd-wizard-content--slide-in-left';

        // Animate out
        this._contentInner.classList.add(outClass);

        const onOutEnd = () => {
            this._contentInner.removeEventListener('animationend', onOutEnd);
            this._contentInner.classList.remove(outClass);

            // Switch step content
            this._showStep(targetIndex, true);

            // Animate in
            this._contentInner.classList.add(inClass);

            const onInEnd = () => {
                this._contentInner.removeEventListener('animationend', onInEnd);
                this._contentInner.classList.remove(inClass);
                this._isAnimating = false;
            };

            this._contentInner.addEventListener('animationend', onInEnd, { once: true });
        };

        this._contentInner.addEventListener('animationend', onOutEnd, { once: true });

        // Fallback if animation doesn't fire (e.g. prefers-reduced-motion)
        setTimeout(() => {
            if (this._isAnimating) {
                this._contentInner.classList.remove(outClass, inClass);
                this._showStep(targetIndex, false);
                this._isAnimating = false;
            }
        }, 700);
    }

    // =========================================================================
    // Private - Completion & Celebration
    // =========================================================================

    /**
     * Handle wizard completion: celebration animation + callback.
     */
    _complete() {
        // Final progress
        if (this._progressFill) {
            this._progressFill.style.width = '100%';
        }
        if (this._progressLabel) {
            this._progressLabel.textContent = '100%';
        }

        // Show celebration in content area
        this._contentInner.innerHTML = '';

        const celebration = this._createElement('div', 'dgd-wizard-celebration');

        // Success icon with animation
        const iconWrap = this._createElement('div', 'dgd-wizard-celebration__icon');
        iconWrap.innerHTML = `
            <svg class="dgd-wizard-celebration__checkmark" viewBox="0 0 52 52" width="80" height="80">
                <circle class="dgd-wizard-celebration__circle" cx="26" cy="26" r="24"
                        fill="none" stroke="var(--dgd-accent)" stroke-width="3"/>
                <path class="dgd-wizard-celebration__check" fill="none" stroke="var(--dgd-accent)"
                      stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
                      d="M14 27l7 7 16-16"/>
            </svg>`;
        celebration.appendChild(iconWrap);

        const title = document.createElement('h2');
        title.className = 'dgd-wizard-celebration__title';
        title.textContent = 'Fertig!';
        celebration.appendChild(title);

        const msg = document.createElement('p');
        msg.className = 'dgd-wizard-celebration__message';
        msg.textContent = 'Alle Schritte wurden erfolgreich abgeschlossen.';
        celebration.appendChild(msg);

        this._contentInner.appendChild(celebration);

        // Launch confetti particles
        this._launchConfetti(celebration);

        // Hide navigation buttons
        this._btnBack.style.visibility = 'hidden';
        this._btnNext.style.display = 'none';

        // Update indicators
        if (this._showStepIndicators) {
            this._updateIndicators();
        }

        // Encouragement
        this.setEncouragement('');

        // Collect form data and callback
        const formData = this.getFormData();
        if (typeof this._onComplete === 'function') {
            // Small delay so celebration animation is visible
            setTimeout(() => {
                this._onComplete(formData);
            }, 800);
        }
    }

    /**
     * Create CSS-based confetti particles inside a container.
     * @param {HTMLElement} container
     */
    _launchConfetti(container) {
        const colors = [
            'var(--dgd-accent)',
            'var(--dgd-secondary)',
            'var(--dgd-accent-light)',
            'var(--dgd-warning)',
            'var(--dgd-primary)',
        ];

        const confettiContainer = this._createElement('div', 'dgd-wizard-confetti');
        container.appendChild(confettiContainer);

        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('span');
            particle.className = 'dgd-wizard-confetti__particle';
            particle.style.setProperty('--x', `${Math.random() * 200 - 100}px`);
            particle.style.setProperty('--y', `${Math.random() * -200 - 50}px`);
            particle.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
            particle.style.setProperty('--delay', `${Math.random() * 0.4}s`);
            particle.style.setProperty('--color', colors[i % colors.length]);
            confettiContainer.appendChild(particle);
        }
    }

    // =========================================================================
    // Private - Keyboard & Utilities
    // =========================================================================

    /**
     * Handle keyboard events for navigation.
     * @param {KeyboardEvent} e
     */
    _onKeydown(e) {
        // Only handle if wizard is visible
        if (!this._overlay || !this._overlay.offsetParent === null) return;

        // Don't capture when user is typing in an input/textarea
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'textarea') return;

        if (e.key === 'Enter' && tag !== 'button') {
            e.preventDefault();
            this.nextStep();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.prevStep();
        }
    }

    /**
     * Brief shake animation on the next button when validation fails.
     */
    _shakeNextButton() {
        if (!this._btnNext) return;
        this._btnNext.classList.remove('dgd-wizard-actions__next--shake');
        void this._btnNext.offsetWidth;
        this._btnNext.classList.add('dgd-wizard-actions__next--shake');
    }

    /**
     * Shorthand to create an element with a className string.
     * @param {string} tag
     * @param {string} className
     * @returns {HTMLElement}
     */
    _createElement(tag, className) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        return el;
    }
}
