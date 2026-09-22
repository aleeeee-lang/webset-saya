document.addEventListener("DOMContentLoaded", function () {

    const notificationButton =
        document.getElementById("notificationButton");

    const notificationPanel =
        document.getElementById("notificationPanel");

    console.log("Notification JS berhasil dijalankan");
    console.log("Button:", notificationButton);
    console.log("Panel:", notificationPanel);


    notificationButton.addEventListener("click", function () {

        console.log("Tombol notification diklik");

        notificationPanel.classList.toggle("active");

    });

});
