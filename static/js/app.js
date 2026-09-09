(function () {
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('wateropt-theme', theme);
        const box = document.getElementById('themeSwitch');
        if (box) {
            box.querySelectorAll('button').forEach(function (b) {
                b.classList.toggle('active', b.dataset.themeOpt === theme);
            });
        }
    }

    function initTheme() {
        const saved = localStorage.getItem('wateropt-theme') || 'light';
        const box = document.getElementById('themeSwitch');
        if (box) {
            box.querySelectorAll('button').forEach(function (b) {
                b.addEventListener('click', function () { applyTheme(b.dataset.themeOpt); });
            });
        }
        applyTheme(saved);
    }

    function toggleDetails(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const isHidden = el.classList.contains('hidden') || getComputedStyle(el).display === 'none';
        el.style.display = isHidden ? 'block' : 'none';
    }

    // KPI boxes: ẩn chi tiết ban đầu (trừ ô đầu khi có sẵn)
    function initDetails() {
        document.querySelectorAll('.metric-details').forEach(function (el, idx) {
            if (idx > 0) el.style.display = 'none';
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initTheme();
        initDetails();
    });

    window.toggleDetails = toggleDetails;
})();