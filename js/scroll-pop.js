(function () {
    function initScrollPop() {
        var icons = document.querySelectorAll(".insight-icon");
        if (!icons.length) return;

        if (!("IntersectionObserver" in window)) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var el = entry.target;
                if (entry.isIntersecting) {
                    el.classList.remove("icon-pop");
                    void el.offsetWidth;
                    el.classList.add("icon-pop");
                } else {
                    el.classList.remove("icon-pop");
                }
            });
        }, { threshold: 0.6 });

        icons.forEach(function (icon) {
            observer.observe(icon);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initScrollPop);
    } else {
        initScrollPop();
    }
})();
