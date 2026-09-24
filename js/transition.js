(function () {
    const ORDER = [
        "index",
        "attendance",
        "dashboard",
        "history",
        "my-attendance"
    ];

    function pageIndex(url) {
        let name = new URL(url).pathname.split("/").pop().replace(".html", "");
        if (name === "") name = "index";
        return ORDER.indexOf(name);
    }

    window.addEventListener("pagereveal", function (event) {
        if (!event.viewTransition) return;
        if (!window.navigation || !navigation.activation) return;

        const from = navigation.activation.from;
        const to = navigation.activation.entry;
        if (!from || !to) return;

        const fromIndex = pageIndex(from.url);
        const toIndex = pageIndex(to.url);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

        const cls = toIndex > fromIndex ? "vt-forward" : "vt-back";
        document.documentElement.classList.add(cls);

        event.viewTransition.finished.finally(function () {
            document.documentElement.classList.remove(cls);
        });
    });
})();
