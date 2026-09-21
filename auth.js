async function requireLogin() {

    const {
        data,
        error
    } = await supabaseClient.auth.getUser();


    if (error || !data.user) {

        window.location.href = "login.html";

        return null;

    }


    return data.user;

}


async function logoutUser() {

    const {
        error
    } = await supabaseClient.auth.signOut();


    if (error) {

        console.error(error);

        alert(
            "Logout failed: " +
            error.message
        );

        return;

    }


    window.location.href = "login.html";

}

async function getCurrentUser() {

    const {
        data,
        error
    } = await supabaseClient.auth.getUser();


    if (error || !data.user) {

        return null;

    }


    return data.user;

}