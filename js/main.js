/*
====================================
MAIN APPLICATION FILE
Shared functionality used by all pages
====================================
*/

document.addEventListener("DOMContentLoaded", async () => {
    // Resolve relative path based on workspace location
    await loadComponent("sidebar-container", "components/sidebar.html");
    await loadComponent("header-container", "components/header.html");

    initializeSidebar();
    initializeActiveNav();
    waitForFirebaseAndCheckAuth();
});

/* LOAD HTML */
async function loadComponent(containerId, filePath) {
    try {
        const response = await fetch(filePath);
        const html = await response.text();
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = html;
        }
    } catch (e) {
        console.error("Error loading component:", filePath, e);
    }
}

/* SIDEBAR */
function initializeSidebar() {
    const hamburger = document.getElementById("hamburger");
    const sidebar = document.getElementById("sidebar");
    if (!hamburger || !sidebar) return;
    
    // Check local storage for sidebar state to persist preference
    if (localStorage.getItem("fgSidebarCollapsed") === "true") {
        sidebar.classList.add("collapsed");
    }

    hamburger.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        localStorage.setItem("fgSidebarCollapsed", sidebar.classList.contains("collapsed"));
    });
}

/* USER AUTHENTICATION & ROUTING BRIDGE */
function waitForFirebaseAndCheckAuth() {
    const interval = setInterval(() => {
        if (window.firebaseHelper) {
            clearInterval(interval);
            setupAuthListener();
        }
    }, 50);
}

function setupAuthListener() {
    const pathParts = window.location.pathname.split("/");
    const currentPage = pathParts[pathParts.length - 1] || "index.html";
    const isLoginPage = currentPage === "login.html";

    window.firebaseHelper.onAuth((user) => {
        if (!user) {
            if (!isLoginPage) {
                window.location.href = "./login.html";
            }
        } else {
            if (isLoginPage) {
                window.location.href = "./index.html";
            }
            
            // Initialize header elements since they are now injected
            initializeUsername(user);
            initializeLogout();
            
            // Dispatch a global event indicating that user data is loaded and ready
            window.dispatchEvent(new CustomEvent("fg-data-synced", { detail: user }));
        }
    });
}

/* USERNAME */
function initializeUsername(user) {
    const username = document.getElementById("username");
    if (!username) return;

    username.textContent = localStorage.getItem("fgUsername") || "User";

    username.addEventListener("blur", async () => {
        const newName = username.textContent.trim() || "User";
        localStorage.setItem("fgUsername", newName);
        username.textContent = newName;
        
        // Auto-save name to cloud
        if (window.firebaseHelper) {
            await window.firebaseHelper.syncLocalToFirebase();
        }
    });
}

/* LOGOUT */
function initializeLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (!logoutBtn) return;
    
    logoutBtn.addEventListener("click", async () => {
        if (window.firebaseHelper) {
            await window.firebaseHelper.logout();
        }
    });
}

/* SIDEBAR ACTIVE STATE */
function initializeActiveNav() {
    const pathParts = window.location.pathname.split("/");
    const currentPage = pathParts[pathParts.length - 1] || "index.html";
    const links = document.querySelectorAll(".nav-link");

    links.forEach(link => {
        link.classList.remove("active");
        const href = link.getAttribute("href");

        if (href === currentPage || (currentPage === "index.html" && href === "")) {
            link.classList.add("active");
        }
    });
}
