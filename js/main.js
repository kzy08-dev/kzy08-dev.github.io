/*
====================================
MAIN APPLICATION FILE
Shared functionality used by all pages
====================================
*/

document.addEventListener("DOMContentLoaded", async () => {
    // Resolve relative path based on workspace location
    const passwordInput = document.getElementById("authPassword");
    const togglePassword = document.getElementById("togglePassword");
}

togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.textContent = isHidden ? "🙈" : "👁️";
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
    
    updateSidebarPet();
}

window.updateSidebarPet = function() {
    const petImg = document.getElementById("sidebar-pet-img");
    if (petImg) {
        const petChoice = localStorage.getItem("fgPetChoice") || "puppy";
        let emotionLevel = Number(localStorage.getItem("fgEmotionLevel"));
        if (isNaN(emotionLevel)) emotionLevel = 50;
        
        let suffix = "";
        if (emotionLevel < 40) {
            suffix = "_sad";
        } else if (emotionLevel <= 60) {
            suffix = "_neutral";
        }
        
        petImg.src = `assets/images/${petChoice}${suffix}.png`;
        petImg.alt = petChoice;
    }
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
            updateSidebarPet();
            
            checkOverdueTasks();
            
            // Dispatch a global event indicating that user data is loaded and ready
            window.dispatchEvent(new CustomEvent("fg-data-synced", { detail: user }));
        }
    });
}

function checkOverdueTasks() {
    if (window.updateEmotionFromCurrentWeek) {
        window.updateEmotionFromCurrentWeek();
    }
}

window.updateEmotionFromCurrentWeek = function() {
    const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
    let baseEmotion = 50;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentDayStr = String(now.getDate()).padStart(2, '0');
    const currentDateKey = `${currentYear}-${currentMonth}-${currentDayStr}`;

    const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
    const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon=0, Sun=6
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    for (let dateKey in schedules) {
        const parts = dateKey.split('-');
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
        
        if (dateObj >= startOfWeek && dateObj <= endOfWeek) {
            let tasks = schedules[dateKey].tasks || [];
            for (let task of tasks) {
                if (task.completed) {
                    let boost = 8;
                    if (task.priority === "high") boost = 15;
                    else if (task.priority === "low") boost = 4;
                    baseEmotion += boost;
                } else if (dateKey < currentDateKey) {
                    let penalty = 2; 
                    if (task.priority === "high") penalty = 5;
                    else if (task.priority === "low") penalty = 1;
                    baseEmotion -= penalty;
                }
            }
        }
    }

    const finalEmotion = Math.max(0, Math.min(100, baseEmotion));
    
    // Only update and sync if it changed, though it's harmless to always write
    const oldEmotion = Number(localStorage.getItem("fgEmotionLevel"));
    if (oldEmotion !== finalEmotion || isNaN(oldEmotion)) {
        localStorage.setItem("fgEmotionLevel", finalEmotion);
        if (window.updateSidebarPet) window.updateSidebarPet();
        
        // Sync implicitly happens after checkOverdueTasks via firebaseHelper if initialized,
        // but if called from elsewhere, we can sync manually
    }
    
    return finalEmotion;
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
