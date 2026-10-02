/* =========================================================
   TOAST / SNACKBAR
   Lightweight replacement for alert() popups.
   Usage: showToast("Message", "success" | "error" | "info")
========================================================= */

(function () {

    function ensureContainer() {
        let c = document.getElementById("toastContainer");

        if (!c) {
            c = document.createElement("div");
            c.id = "toastContainer";
            document.body.appendChild(c);
        }

        return c;
    }

    window.showToast = function (message, type) {
        type = type || "info";

        const container = ensureContainer();

        const toast = document.createElement("div");
        toast.className = "app-toast app-toast-" + type;
        toast.textContent = message;

        container.appendChild(toast);

        // Force layout so the enter transition plays
        requestAnimationFrame(function () {
            toast.classList.add("show");
        });

        setTimeout(function () {
            toast.classList.remove("show");
            setTimeout(function () {
                toast.remove();
            }, 250);
        }, 3200);
    };

})();
