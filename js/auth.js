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

async function getMyAttendance() {

    const user = await requireLogin();

    if (!user) {
        return { data: null, error: { message: "Not logged in" } };
    }

    return await supabaseClient
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

}
