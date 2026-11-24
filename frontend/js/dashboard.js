
const DASHBOARD_API_BASE_URL = "http://127.0.0.1:5000";

let tasks = [];
let courses = [];
let currentWeeklyGoal = 10;

// Get the saved login token
function getToken() {
    return localStorage.getItem("studycloud_token");
}

// Make authenticated API requests
async function apiRequest(endpoint, options = {}) {

    const token = getToken();

    if (!token) {
        throw new Error("Please log in to continue.");
    }

    const headers = {
        "Authorization": `Bearer ${token}`,
        ...options.headers
    };

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
        `${DASHBOARD_API_BASE_URL}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

// Format dates
function formatDate(date) {
    if (!date) return "No due date";

    const formatted = new Date(date + "T00:00:00");

    return formatted.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short"
    });
}

// Calculate deadline status
function getDueLabel(date) {
    if (!date) return "No due date";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadline = new Date(date + "T00:00:00");

    const difference = Math.round(
        (deadline - today) / (1000 * 60 * 60 * 24)
    );

    if (difference < 0) {
        return Math.abs(difference) + " days overdue";
    }

    if (difference === 0) {
        return "Due today";
    }

    if (difference === 1) {
        return "Due tomorrow";
    }

    return "Due " + formatDate(date);
}

// Escape user-entered text before displaying it
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return replacements[character];
    });
}

// Show notification
function showToast(message) {
    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2300);
}

// Sort tasks by deadline
function sortTasks(taskList) {
    return [...taskList].sort((a, b) => {
        return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
    });
}

// Create the HTML for one task

function createTaskHTML(task) {
    return `
        <div class="task-row ${task.completed ? "complete" : ""}">

            <button
                class="task-check ${task.completed ? "done" : ""}"
                data-toggle="${task.id}"
                aria-label="Toggle task completion">

                ${task.completed ? '<i data-lucide="check"></i>' : ""}
            </button>

            <div class="task-info">
                <strong>${escapeHTML(task.title)}</strong>

                <small>
                    ${escapeHTML(task.course || "General")}
                    · ${getDueLabel(task.dueDate)}
                </small>
            </div>

            <span class="priority ${escapeHTML(task.priority)}">
                ${escapeHTML(task.priority)}
            </span>

            <span class="task-date">
                ${formatDate(task.dueDate)}
            </span>

            <div class="task-actions">
                <button
                    type="button"
                    class="secondary-button"
                    data-edit="${task.id}">
                    Edit
                </button>

                <button
                    type="button"
                    class="secondary-button"
                    data-delete="${task.id}">
                    Delete
                </button>
            </div>

        </div>
    `;
}


// Display tasks on the Tasks page
function renderTasks() {
    const filter = document.getElementById("taskFilter");
    const allTasksContainer = document.getElementById("allTasks");
    const emptyMessage = document.getElementById("emptyAll");

    if (!filter || !allTasksContainer || !emptyMessage) return;

    let filteredTasks = sortTasks(tasks);

    if (filter.value === "pending") {
        filteredTasks = filteredTasks.filter(task => !task.completed);
    }

    if (filter.value === "completed") {
        filteredTasks = filteredTasks.filter(task => task.completed);
    }

    allTasksContainer.innerHTML =
        filteredTasks.map(createTaskHTML).join("");

    emptyMessage.classList.toggle(
        "hidden",
        filteredTasks.length > 0
    );

    if (window.lucide) {
        lucide.createIcons();
    }
}

// Load courses and update all course dropdowns
async function loadCourses() {

    const data = await apiRequest("/api/courses/");

    courses = data.courses || [];

    const dropdowns = [
        document.getElementById("taskCourse"),
        document.getElementById("materialCourse"),
        document.getElementById("studyCourse")
    ];

    dropdowns.forEach(dropdown => {

        if (!dropdown) return;

        const previousValue = dropdown.value;

        dropdown.innerHTML =
            '<option value="">No course selected</option>';

        courses.forEach(course => {

            const option = document.createElement("option");

            option.value = course.id;
            option.textContent = course.course_name;

            dropdown.appendChild(option);
        });

        if (courses.some(course => String(course.id) === previousValue)) {
            dropdown.value = previousValue;
        }
    });

    renderCourses();
}

// LOAD AND DISPLAY WEEKLY STUDY PROGRESS

function formatStudyHours(hours) {
    return Number(Number(hours).toFixed(2)).toString();
}

async function loadStudyProgress() {

    const data = await apiRequest("/api/study/summary");

    const totalHours = Number(data.total_hours || 0);
    const weeklyGoal = Number(data.weekly_goal || 0);
    const percentage = Number(data.percentage || 0);

    currentWeeklyGoal = weeklyGoal;

    const percentElement =
        document.getElementById("weeklyProgressPercent");

    const hoursElement =
        document.getElementById("weeklyHoursText");

    const progressBar =
        document.getElementById("weeklyProgressBar");

    const totalElement =
        document.getElementById("weeklyStudyHours");

    if (percentElement) {
        percentElement.textContent = `${percentage}%`;
    }

    if (hoursElement) {
        hoursElement.textContent =
            `${formatStudyHours(totalHours)} / ${formatStudyHours(weeklyGoal)} hrs`;
    }

    if (progressBar) {
        progressBar.style.width = `${Math.min(percentage, 100)}%`;
    }

    if (totalElement) {
        totalElement.textContent =
            `${formatStudyHours(totalHours)} hrs`;
    }

    // Update the seven daily chart bars

    const dailyHours = data.daily_hours || [];

    const bars = document.querySelectorAll(
        "#studyProgressChart .bar"
    );

    const maxHours = Math.max(...dailyHours.map(Number), 0);

    bars.forEach((bar, index) => {

        const hours = Number(dailyHours[index] || 0);

        const height = maxHours > 0
            ? (hours / maxHours) * 100
            : 0;

        bar.style.height = `${height}%`;
        bar.title = `${formatStudyHours(hours)} hours`;

    });
}


// DISPLAY COURSES
function renderCourses() {

    const container = document.getElementById("coursesGrid");
    const dashboardContainer = document.getElementById("dashboardCoursesGrid");
    const empty = document.getElementById("emptyCourses");

    function getCourseStyle(courseName) {

        const name = courseName.toLowerCase();

        if (name.includes("programming") || name.includes("computer")) {
            return { icon: "code", color: "indigo" };
        }

        if (name.includes("database") || name.includes("sql")) {
            return { icon: "database", color: "teal" };
        }

        if (name.includes("cloud")) {
            return { icon: "cloud", color: "orange" };
        }

        if (name.includes("artificial") || name.includes("intelligence") || name.includes("ai")) {
            return { icon: "brain", color: "rose" };
        }

        if (name.includes("math")) {
            return { icon: "calculator", color: "blue" };
        }

        return { icon: "book-open", color: "indigo" };
    }

    function createCourseCard(course, showActions) {

        const style = getCourseStyle(course.course_name || "");

        return `
            <div class="course-card">

                <div class="course-icon ${style.color}">
                    <i data-lucide="${style.icon}"></i>
                </div>

                <small>${escapeHTML(course.course_code || "YOUR COURSE")}</small>

                <h4>${escapeHTML(course.course_name)}</h4>

                <p>${escapeHTML(course.description || "No description added yet.")}</p>

                ${showActions ? `
                    <div class="course-actions">

                        <button type="button"
                            class="secondary-button"
                            data-course-edit="${course.id}">
                            Edit
                        </button>

                        <button type="button"
                            class="secondary-button"
                            data-course-delete="${course.id}">
                            Delete
                        </button>

                    </div>
                ` : ""}

            </div>
        `;
    }

    // Full course cards with management buttons
    if (container) {
        container.innerHTML = courses
            .map(course => createCourseCard(course, true))
            .join("");
    }

    // Cleaner course cards on Overview
    if (dashboardContainer) {
        dashboardContainer.innerHTML = courses
            .map(course => createCourseCard(course, false))
            .join("");
    }

    if (empty) {
        empty.classList.toggle("hidden", courses.length > 0);
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}






// OPEN COURSE FORM
function openCourseModal(course = null) {

    document.getElementById("courseForm").reset();

    document.getElementById("courseId").value = course?.id || "";

    document.getElementById("courseName").value =
        course?.course_name || "";

    document.getElementById("courseCode").value =
        course?.course_code || "";

    document.getElementById("courseDescription").value =
        course?.description || "";

    document.getElementById("courseModalTitle").textContent =
        course ? "Edit course" : "Add a course";

    document.getElementById("courseModal").classList.remove("hidden");
}


// CLOSE COURSE FORM
function closeCourseModal() {
    document.getElementById("courseModal").classList.add("hidden");
}


// SAVE COURSE
async function saveCourse(event) {

    event.preventDefault();

    const id = document.getElementById("courseId").value;

    const courseData = {
        course_name: document.getElementById("courseName").value.trim(),
        course_code: document.getElementById("courseCode").value.trim(),
        description: document.getElementById("courseDescription").value.trim()
    };

    try {

        await apiRequest(
            id ? `/api/courses/${id}` : "/api/courses/",
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(courseData)
            }
        );

        closeCourseModal();

        await loadCourses();
        await loadTasks();
        await loadDashboardData();

        showToast(id ? "Course updated!" : "Course added!");

    } catch (error) {
        showToast(error.message);
    }
}


// DELETE COURSE
async function deleteCourse(id) {

    const course = courses.find(item => item.id === id);

    if (!course) return;

    if (!confirm(`Delete ${course.course_name}?`)) return;

    try {

        await apiRequest(`/api/courses/${id}`, {
            method: "DELETE"
        });

        await loadCourses();
        await loadTasks();
        await loadMaterials();
        await loadDashboardData();

        showToast("Course deleted successfully!");

    } catch (error) {
        showToast(error.message);
    }
}

// Load tasks from the database
async function loadTasks() {
    const data = await apiRequest("/api/tasks/");

    const courseMap = {};

    courses.forEach(course => {
        courseMap[course.id] = course.course_name;
    });

    tasks = (data.tasks || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        courseId: task.course_id,
        course: courseMap[task.course_id] || "General",
        dueDate: task.due_date ? task.due_date.substring(0, 10) : "",
        priority: task.priority,
        completed: task.is_completed
    }));

    renderTasks();
}

// STUDY MATERIALS

let materials = [];


// LOAD MATERIALS
async function loadMaterials() {

    const data = await apiRequest("/api/materials/");

    materials = data.materials || [];

    renderMaterials();
}


// DISPLAY MATERIALS
function renderMaterials() {

    const container = document.getElementById("materialsGrid");
    const empty = document.getElementById("emptyMaterials");

    if (!container || !empty) return;

    const courseMap = {};

    courses.forEach(course => {
        courseMap[course.id] = course.course_name;
    });

    container.innerHTML = materials.map(material => `

        <div class="material-card">

            <div class="material-icon">
                <i data-lucide="file-text"></i>
            </div>

            <h3>${escapeHTML(material.title)}</h3>

            <p>${escapeHTML(material.file_name)}</p>

            <small>
                ${escapeHTML(courseMap[material.course_id] || "General")}
            </small>

            <small>
                Uploaded: ${new Date(material.uploaded_at).toLocaleDateString()}
            </small>

            <div class="material-actions">

                <button class="primary-button"
                    data-material-download="${material.id}">
                    Download
                </button>

                <button class="secondary-button"
                    data-material-delete="${material.id}">
                    Delete
                </button>

            </div>

        </div>

    `).join("");

    empty.classList.toggle("hidden", materials.length > 0);

    if (window.lucide) lucide.createIcons();
}


// OPEN UPLOAD FORM
function openMaterialModal() {

    document.getElementById("materialForm").reset();

    document.getElementById("materialModal").classList.remove("hidden");
}


// CLOSE UPLOAD FORM
function closeMaterialModal() {

    document.getElementById("materialModal").classList.add("hidden");
}


// UPLOAD MATERIAL
async function uploadMaterial(event) {

    event.preventDefault();

    const file = document.getElementById("materialFile").files[0];

    if (!file) {
        showToast("Please select a file.");
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast("File size must not exceed 10 MB.");
        return;
    }

    const formData = new FormData();

    formData.append("file", file);

    formData.append(
        "title",
        document.getElementById("materialTitle").value.trim()
    );

    formData.append(
        "description",
        document.getElementById("materialDescription").value.trim()
    );

    formData.append(
        "course_id",
        document.getElementById("materialCourse").value
    );

    const button = document.getElementById("materialSubmit");

    button.disabled = true;
    button.textContent = "Uploading...";

    try {

        await apiRequest("/api/materials/", {
            method: "POST",
            body: formData
        });

        closeMaterialModal();

        await loadMaterials();

        showToast("Material uploaded successfully!");

    } catch (error) {

        showToast(error.message);

    } finally {

        button.disabled = false;
        button.textContent = "Upload material";
    }
}


// DOWNLOAD MATERIAL
async function downloadMaterial(id) {

    try {

        const response = await fetch(
            `${DASHBOARD_API_BASE_URL}/api/materials/${id}/download`,
            {
                headers: {
                    Authorization: `Bearer ${getToken()}`
                }
            }
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || "Download failed.");
        }

        const blob = await response.blob();

        const material = materials.find(item => item.id === id);

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = material?.file_name || "study-material";

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);

        showToast("Download started!");

    } catch (error) {

        showToast(error.message);
    }
}


// DELETE MATERIAL
async function deleteMaterial(id) {

    const material = materials.find(item => item.id === id);

    if (!material) return;

    if (!confirm(`Delete "${material.title}"?`)) return;

    try {

        await apiRequest(`/api/materials/${id}`, {
            method: "DELETE"
        });

        await loadMaterials();

        showToast("Material deleted successfully!");

    } catch (error) {

        showToast(error.message);
    }
}

// Load both courses and tasks
async function loadTasksAndCourses() {
    try {
        await loadCourses();
        await loadTasks();

        console.log("Tasks and courses loaded successfully.");

    } catch (error) {
        console.error("Task loading error:", error);
        showToast(error.message || "Could not load tasks.");
    }
}

// Load dashboard information from Flask
async function loadDashboardData() {
    const token = getToken();

    if (!token) return;

    try {
        const data = await apiRequest("/api/dashboard/summary");

        // Update student information
        if (data.student) {
            const student = data.student;
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

        // Update dashboard statistics
        const summary = data.summary;

        document.getElementById("totalCoursesCount").textContent =
            String(summary.total_courses).padStart(2, "0");

        document.getElementById("pendingCount").textContent =
            String(summary.pending_tasks).padStart(2, "0");

        document.getElementById("completedCount").textContent =
            String(summary.completed_tasks).padStart(2, "0");

        // Display upcoming tasks
        const upcomingTasks = data.upcoming_tasks || [];
        const upcomingContainer = document.getElementById("upcomingTasks");

        upcomingContainer.innerHTML = upcomingTasks.map(task => {
            const dueDate = task.due_date
                ? task.due_date.substring(0, 10)
                : "";

            return `
                <div class="task-row">


                    <div class="task-info">
                        <strong>${escapeHTML(task.title)}</strong>

                        <small>
                            ${escapeHTML(task.course || "General")}
                            · ${getDueLabel(dueDate)}
                        </small>
                    </div>

                    <span class="priority ${escapeHTML(task.priority)}">
                        ${escapeHTML(task.priority)}
                    </span>

                    <span class="task-date">
                        ${formatDate(dueDate)}
                    </span>

                </div>
            `;
        }).join("");

        document.getElementById("emptyUpcoming")
            .classList.toggle("hidden", upcomingTasks.length > 0);

        if (window.lucide) {
            lucide.createIcons();
        }

        // Refresh courses, tasks and study materials
        await loadTasksAndCourses();
        await loadMaterials();
        await loadStudyProgress();

        // Restore the last page only once
        // Restore the last page the user visited
        const savedPage = localStorage.getItem("studycloud_current_page");
        const validPages = ["dashboard", "courses", "tasks", "materials"];

        openPage(validPages.includes(savedPage) ? savedPage : "dashboard");

        console.log("Dashboard data loaded successfully.");

    } catch (error) {
        console.error("Dashboard loading error:", error);
        showToast(error.message || "Could not load dashboard information.");
    }
}

// Page navigation

function openPage(pageName) {

    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.toggle(
            "active",
            link.dataset.page === pageName
        );
    });

    const selectedPage = document.getElementById(pageName + "Page");

    if (selectedPage) {
        selectedPage.classList.add("active");
    }

    const titles = {
        dashboard: "Overview",
        courses: "My Courses",
        tasks: "Tasks",
        materials: "Study Materials"
    };

    document.getElementById("pageTitle").textContent =
        titles[pageName] || "Overview";

    document.getElementById("sidebar").classList.remove("open");

    // Remember the current page
    localStorage.setItem("studycloud_current_page", pageName);
}


// Open the Add Task modal

function openModal() {
    document.getElementById("taskModalTitle").textContent = "Add a new task";
    document.getElementById("saveTaskButton").textContent = "Save task";
    document.getElementById("taskId").value = "";

    document.getElementById("taskForm").reset();

    document.getElementById("taskModal").classList.remove("hidden");
    document.getElementById("taskTitle").focus();
}

function editTask(taskId) {
    const task = tasks.find(item => item.id === taskId);

    if (!task) return;

    document.getElementById("taskId").value = task.id;
    document.getElementById("taskTitle").value = task.title;
    document.getElementById("taskCourse").value = task.courseId || "";
    document.getElementById("taskDue").value = task.dueDate;
    document.getElementById("taskPriority").value = task.priority;

    document.getElementById("taskModalTitle").textContent = "Edit task";
    document.getElementById("saveTaskButton").textContent = "Update task";

    document.getElementById("taskModal").classList.remove("hidden");
    document.getElementById("taskTitle").focus();
}

function closeModal() {
    document.getElementById("taskModal").classList.add("hidden");
    document.getElementById("taskForm").reset();
    document.getElementById("taskId").value = "";
}


// Mark a task as completed or pending
async function toggleTask(taskId) {
    const task = tasks.find(item => item.id === taskId);

    if (!task) return;

    const newStatus = !task.completed;

    try {
        await apiRequest(`/api/tasks/${taskId}`, {
            method: "PUT",
            body: JSON.stringify({
                is_completed: newStatus
            })
        });

        task.completed = newStatus;

        renderTasks();

        showToast(
            newStatus
                ? "Task completed!"
                : "Task moved back to pending."
        );

        // Refresh dashboard statistics
        const data = await apiRequest("/api/dashboard/summary");

        document.getElementById("pendingCount").textContent =
            String(data.summary.pending_tasks).padStart(2, "0");

        document.getElementById("completedCount").textContent =
            String(data.summary.completed_tasks).padStart(2, "0");

        const upcomingTasks = data.upcoming_tasks || [];
        const upcomingContainer = document.getElementById("upcomingTasks");

        upcomingContainer.innerHTML = upcomingTasks.map(item => {
            const dueDate = item.due_date
                ? item.due_date.substring(0, 10)
                : "";

            return `
                <div class="task-row">
                    <div class="task-check"></div>
                    <div class="task-info">
                        <strong>${escapeHTML(item.title)}</strong>
                        <small>
                            ${escapeHTML(item.course || "General")}
                            · ${getDueLabel(dueDate)}
                        </small>
                    </div>
                    <span class="priority ${escapeHTML(item.priority)}">
                        ${escapeHTML(item.priority)}
                    </span>
                    <span class="task-date">${formatDate(dueDate)}</span>
                </div>
            `;
        }).join("");

        document.getElementById("emptyUpcoming")
            .classList.toggle("hidden", upcomingTasks.length > 0);

    } catch (error) {
        console.error("Could not update task:", error);
        showToast(error.message || "Could not update task.");
    }
}

async function deleteTask(taskId) {
    const task = tasks.find(item => item.id === taskId);

    if (!task) return;

    const confirmed = confirm(
        `Are you sure you want to delete "${task.title}"?`
    );

    if (!confirmed) return;

    try {
        await apiRequest(`/api/tasks/${taskId}`, {
            method: "DELETE"
        });

        await loadDashboardData();

        showToast("Task deleted successfully!");

    } catch (error) {
        console.error("Could not delete task:", error);
        showToast(error.message || "Could not delete task.");
    }
}

// Navigation and task completion events

// Navigation, task completion, editing and deletion events
document.addEventListener("click", function (event) {

    const pageButton = event.target.closest("[data-page]");

    if (pageButton) {
        openPage(pageButton.dataset.page);
    }

    const openButton = event.target.closest("[data-open-page]");

    if (openButton) {
        openPage(openButton.dataset.openPage);
    }

    const taskButton = event.target.closest("[data-toggle]");

    if (taskButton) {
        toggleTask(Number(taskButton.dataset.toggle));
        return;
    }

    const editButton = event.target.closest("[data-edit]");

    if (editButton) {
        editTask(Number(editButton.dataset.edit));
        return;
    }

    const deleteButton = event.target.closest("[data-delete]");

    if (deleteButton) {
        deleteTask(Number(deleteButton.dataset.delete));
    }
});


// Add task buttons
document.getElementById("addTaskTop")
    .addEventListener("click", openModal);

document.getElementById("addTaskPage")
    .addEventListener("click", openModal);

// Close modal buttons
document.getElementById("closeModal")
    .addEventListener("click", closeModal);

document.getElementById("cancelModal")
    .addEventListener("click", closeModal);

// Close modal by clicking outside
document.getElementById("taskModal")
    .addEventListener("click", function (event) {
        if (event.target === this) {
            closeModal();
        }
    });

// Create a new task in the database

// Create or update a task in the database
document.getElementById("taskForm")
    .addEventListener("submit", async function (event) {
        event.preventDefault();

        const formData = new FormData(this);

        const taskId = formData.get("taskId");
        const title = formData.get("title").trim();
        const dueDate = formData.get("dueDate");
        const priority = formData.get("priority");
        const selectedCourse = formData.get("course");

        const taskData = {
            title: title,
            due_date: `${dueDate}T23:59:00`,
            priority: priority,
            course_id: selectedCourse ? Number(selectedCourse) : null
        };

        try {
            if (taskId) {
                await apiRequest(`/api/tasks/${taskId}`, {
                    method: "PUT",
                    body: JSON.stringify(taskData)
                });

                showToast("Task updated successfully!");

            } else {
                await apiRequest("/api/tasks/", {
                    method: "POST",
                    body: JSON.stringify(taskData)
                });

                showToast("Your task has been added!");
            }

            closeModal();

            await loadDashboardData();

        } catch (error) {
            console.error("Could not save task:", error);
            showToast(error.message || "Could not save task.");
        }
    });


// Task filtering
document.getElementById("taskFilter")
    .addEventListener("change", renderTasks);

// Mobile menu
document.getElementById("menuToggle")
    .addEventListener("click", function () {
        document.getElementById("sidebar")
            .classList.toggle("open");
    });

// COURSE EVENTS

document.getElementById("addCourseButton")
    .addEventListener("click", () => openCourseModal());

document.getElementById("courseForm")
    .addEventListener("submit", saveCourse);

document.getElementById("closeCourseModal")
    .addEventListener("click", closeCourseModal);

document.getElementById("cancelCourse")
    .addEventListener("click", closeCourseModal);


// MATERIAL EVENTS

document.getElementById("uploadMaterial")
    .addEventListener("click", openMaterialModal);

document.getElementById("materialForm")
    .addEventListener("submit", uploadMaterial);

document.getElementById("closeMaterialModal")
    .addEventListener("click", closeMaterialModal);

document.getElementById("cancelMaterial")
    .addEventListener("click", closeMaterialModal);


// COURSE AND MATERIAL BUTTONS

document.addEventListener("click", function (event) {

    const edit = event.target.closest("[data-course-edit]");

    if (edit) {

        const course = courses.find(
            item => item.id === Number(edit.dataset.courseEdit)
        );

        openCourseModal(course);
        return;
    }

    const removeCourse = event.target.closest("[data-course-delete]");

    if (removeCourse) {
        deleteCourse(Number(removeCourse.dataset.courseDelete));
        return;
    }

    const download = event.target.closest("[data-material-download]");

    if (download) {
        downloadMaterial(Number(download.dataset.materialDownload));
        return;
    }

    const removeMaterial = event.target.closest("[data-material-delete]");

    if (removeMaterial) {
        deleteMaterial(Number(removeMaterial.dataset.materialDelete));
    }
});

// STUDY SESSION MODAL

function openStudySessionModal() {

    const form = document.getElementById("studySessionForm");

    form.reset();

    const today = new Date();

    const localDate = new Date(
        today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().split("T")[0];

    document.getElementById("studyDate").value = localDate;
    document.getElementById("studyDate").max = localDate;

    document.getElementById("studySessionModal")
        .classList.remove("hidden");
}

function closeStudySessionModal() {

    document.getElementById("studySessionModal")
        .classList.add("hidden");

}


// SAVE STUDY SESSION

document.getElementById("studySessionForm")
    .addEventListener("submit", async function (event) {

        event.preventDefault();

        const studyDate =
            document.getElementById("studyDate").value;

        const hours =
            Number(document.getElementById("studyHours").value);

        const courseValue =
            document.getElementById("studyCourse").value;

        const button =
            document.getElementById("saveStudySession");

        button.disabled = true;
        button.textContent = "Saving...";

        try {

            await apiRequest("/api/study/sessions", {

                method: "POST",

                body: JSON.stringify({
                    study_date: studyDate,
                    hours: hours,
                    course_id: courseValue
                        ? Number(courseValue)
                        : null
                })

            });

            closeStudySessionModal();

            await loadStudyProgress();

            showToast("Study time saved successfully!");

        } catch (error) {

            showToast(error.message);

        } finally {

            button.disabled = false;
            button.textContent = "Save study time";

        }

    });


// STUDY SESSION BUTTONS

document.getElementById("logStudySession")
    .addEventListener("click", openStudySessionModal);

document.getElementById("closeStudySession")
    .addEventListener("click", closeStudySessionModal);

document.getElementById("cancelStudySession")
    .addEventListener("click", closeStudySessionModal);

document.getElementById("studySessionModal")
    .addEventListener("click", function (event) {

        if (event.target === this) {
            closeStudySessionModal();
        }

    });


// WEEKLY GOAL MODAL

function openWeeklyGoalModal() {

    document.getElementById("weeklyGoalForm").reset();

    document.getElementById("weeklyGoalInput").value =
        currentWeeklyGoal || 10;

    document.getElementById("weeklyGoalModal")
        .classList.remove("hidden");

}

function closeWeeklyGoalModal() {

    document.getElementById("weeklyGoalModal")
        .classList.add("hidden");

}


// SAVE WEEKLY GOAL

document.getElementById("weeklyGoalForm")
    .addEventListener("submit", async function (event) {

        event.preventDefault();

        const goal = Number(
            document.getElementById("weeklyGoalInput").value
        );

        try {

            await apiRequest("/api/study/goal", {

                method: "PUT",

                body: JSON.stringify({
                    weekly_goal: goal
                })

            });

            await loadStudyProgress();

            closeWeeklyGoalModal();

            showToast("Weekly study goal updated!");

        } catch (error) {

            showToast(error.message);

        }

    });


// WEEKLY GOAL BUTTONS

document.getElementById("editWeeklyGoal")
    .addEventListener("click", openWeeklyGoalModal);

document.getElementById("closeWeeklyGoal")
    .addEventListener("click", closeWeeklyGoalModal);

document.getElementById("cancelWeeklyGoal")
    .addEventListener("click", closeWeeklyGoalModal);

document.getElementById("weeklyGoalModal")
    .addEventListener("click", function (event) {

        if (event.target === this) {
            closeWeeklyGoalModal();
        }

    });

// Display current date
document.getElementById("todayDate").textContent =
    new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });

// Initial rendering
renderTasks();

if (window.lucide) {
    lucide.createIcons();
}
