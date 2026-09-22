const notificationButton = document.getElementById("notificationButton");
const notificationPanel = document.getElementById("notificationPanel");

notificationButton.addEventListener("click", function () {

    if (notificationPanel.classList.contains("active")) {

        notificationPanel.classList.remove("active");

    } else {

        notificationPanel.classList.add("active");

    }

});
