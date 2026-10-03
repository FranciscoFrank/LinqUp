if (!isLoggedIn()) {
    location.href = withCulture("/auth/login");
}
