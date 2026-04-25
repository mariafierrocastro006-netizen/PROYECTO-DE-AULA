const form = document.getElementById("loginForm");
const message = document.getElementById("message");

const user = {
    email: "test@correo.com",
    password: "123456"
};

form.addEventListener("submit", function(e) {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (email === user.email && password === user.password) {
        message.style.color = "green";
        message.textContent = "Login exitoso";

        // Guardar sesión
        localStorage.setItem("loggedIn", "true");

        // Redirección simulada
        setTimeout(() => {
            window.location.href = "home.html";
        }, 1000);

    } else {
        message.style.color = "red";
        message.textContent = "Correo o contraseña incorrectos";
    }
});