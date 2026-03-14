/* ==========================================================================
   DGD Dashboard - View: Showcase Builder
   Depends on: namespace.js
   ========================================================================== */

window.DGD = window.DGD || {};
DGD.views = DGD.views || {};

(function() {
    var _showcaseMounted = false;

    DGD.views.showcase = function(container) {
        // Destroy previous instance if switching away and back
        if (_showcaseMounted && typeof ShowcaseBuilder !== 'undefined' && ShowcaseBuilder.destroy) {
            ShowcaseBuilder.destroy();
        }

        container.innerHTML = '<div id="showcase-builder-mount" style="margin:-1.5rem;height:calc(100vh - 64px);overflow:hidden;"></div>';

        setTimeout(function() {
            if (typeof ShowcaseBuilder !== 'undefined') {
                ShowcaseBuilder.mount('showcase-builder-mount');
                _showcaseMounted = true;
            } else {
                container.innerHTML = '<div class="dgd-section-card">' +
                    '<div class="dgd-section-card__title">Showcase Builder</div>' +
                    '<p style="color:var(--dgd-gray-500)">Builder-Skripte konnten nicht geladen werden.</p>' +
                    '</div>';
            }
        }, 50);
    };
})();
