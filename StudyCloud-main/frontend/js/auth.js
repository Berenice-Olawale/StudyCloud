
const API_BASE_URL = "http://127.0.0.1:5000";

const TOKEN_KEY = "studycloud_token";
const STUDENT_KEY = "studycloud_student";

const authSection = document.getElementById("authSection");
const appShell = document.getElementById("appShell");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");

// Switch to login form
document.getElementById("showLogin").addEventListener("click", () => {
    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");

    loginError.textContent = "";
    registerError.textContent = "";
});

// Switch to registration form
document.getElementById("showRegister").addEventListener("click", () => {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");

    loginError.textContent = "";
    registerError.textContent = "";
});

// Show application after authentication
function showApplication(student) {
    authSection.classList.add("hidden");
    appShell.classList.remove("hidden");

    updateStudentDetails(student);
}

// Show authentication screen
function showAuthentication() {
    appShell.classList.add("hidden");
    authSection.classList.remove("hidden");
}

// Update student details
function updateStudentDetails(student) {
    if (!student) return;

    const firstName = student.full_name.split(" ")[0];

    const greeting = document.getElementById("welcomeHeading");

    if (greeting) {
        greeting.textContent = `Good morning, ${firstName}.`;
    }

    document.querySelectorAll("[data-student-name]").forEach(element => {
        element.textContent = student.full_name;
    });

    const initials = student.full_name
        .trim()
        .split(/\s+/)
        .map(name => name[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    document.querySelectorAll("[data-student-initials]").forEach(element => {
        element.textContent = initials;
    });
}

// Save login session
function saveSession(token, student) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STUDENT_KEY, JSON.stringify(student));
}

// LOGIN
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    loginError.textContent = "";

    const submitButton = loginForm.querySelector("button[type='submit']");

    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || "Login failed.");
        }

        saveSession(data.access_token, data.student);

        showApplication(data.student);

        loginForm.reset();

        // Load real dashboard data
        await loadDashboardData();

    } catch (error) {
        loginError.textContent = error.message;

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Sign in";
    }
});

// REGISTRATION
registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    registerError.textContent = "";

    const submitButton = registerForm.querySelector("button[type='submit']");

    submitButton.disabled = true;
    submitButton.textContent = "Creating account...";

    const fullName = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    try {
        // Create account
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                full_name: fullName,
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || "Registration failed.");
        }

        // Automatically log in after successful registration
        const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const loginData = await loginResponse.json();

        if (!loginResponse.ok) {
            throw new Error(
                loginData.error || loginData.message ||
                "Account created. Please sign in."
            );
        }

        saveSession(loginData.access_token, loginData.student);

        showApplication(loginData.student);

        registerForm.reset();

        // Load real dashboard data
        await loadDashboardData();

    } catch (error) {
        registerError.textContent = error.message;

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Create account";
    }
});

// Check whether a user already has a valid session
async function checkExistingSession() {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        showAuthentication();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error("Your session has expired.");
        }

        const student = data.student || data;

        localStorage.setItem(STUDENT_KEY, JSON.stringify(student));

        showApplication(student);

        await loadDashboardData();

    } catch (error) {
        console.error("Session verification failed:", error);

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(STUDENT_KEY);

        showAuthentication();
    }
}

// LOGOUT
function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STUDENT_KEY);

    showAuthentication();

    loginForm.reset();
    registerForm.reset();

    loginError.textContent = "";
    registerError.textContent = "";
}

document.getElementById("logoutButton")
    .addEventListener("click", logout);

// Check session when the application starts
checkExistingSession();
