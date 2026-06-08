/*
=====================================
FERAL GREMLIN - TASK INPUTTER + SCHEDULER
=====================================
*/

let taskCounter = 0;
let tasks = [];
let selectedDate = null;

document.addEventListener("DOMContentLoaded", () => {
    waitForTaskPage();
});

function waitForTaskPage() {
    const interval = setInterval(() => {
        const dateInput = document.getElementById("taskDate");
        if (dateInput) {
            clearInterval(interval);
            initializeTaskInputter();
        }
    }, 50);
}

function initializeTaskInputter() {
    setupModal();
    setupDragDrop();
    setupGenerateButton();
    selectedDate = document.getElementById("taskDate");
    
    // Default today's date in input
    const today = new Date().toISOString().split('T')[0];
    selectedDate.value = today;
}

function setupModal() {
    const addTaskBtn = document.getElementById("openTaskModal");
    const finishTaskBtn = document.getElementById("finishTask");
    const cancelTaskBtn = document.getElementById("cancelTask");
    
    addTaskBtn.addEventListener("click", openModal);
    finishTaskBtn.addEventListener("click", createTask);
    cancelTaskBtn.addEventListener("click", closeModal);
}

function openModal() {
    document.getElementById("taskModal").classList.remove("hidden");
    document.getElementById("taskName").focus();
}

function closeModal() {
    document.getElementById("taskModal").classList.add("hidden");
    document.getElementById("taskName").value = "";
    document.getElementById("taskDuration").value = "";

    const defaultMusic = document.querySelector('input[name="music"][value="default"]');
    if (defaultMusic) {
        defaultMusic.checked = true;
    }
}

function createTask() {
    const name = document.getElementById("taskName").value.trim();
    const duration = parseInt(document.getElementById("taskDuration").value);
    const music = document.querySelector('input[name="music"]:checked').value;

    if (!name || !duration) {
        alert("Please enter a task name and duration.");
        return;
    }

    if (duration < 5) {
        alert("Task duration must be at least 5 minutes.");
        return;
    }

    const task = {
        id: taskCounter++,
        name,
        duration,
        priority: "high", // Defaults to high zone, can be dragged to medium/low
        musicType: music,
        completed: false
    };

    tasks.push(task);
    renderTaskCard(task);
    closeModal();
}

function renderTaskCard(task) {
    const card = document.createElement("div");
    card.className = "task-card";
    card.draggable = true;
    card.dataset.id = task.id;
    card.innerHTML = `
        <div class="task-title">${task.name}</div>
        <div class="task-duration">⏱ ${task.duration} min</div>
    `;

    addDragEvents(card);
    document.getElementById("highTasks").appendChild(card);
}

function setupDragDrop() {
    document.querySelectorAll(".task-dropzone").forEach(zone => {
        zone.addEventListener("dragover", e => {
            e.preventDefault();
            zone.classList.add("dragover");
        });

        zone.addEventListener("dragleave", () => {
            zone.classList.remove("dragover");
        });

        zone.addEventListener("drop", () => {
            zone.classList.remove("dragover");

            const dragging = document.querySelector(".dragging");
            if (!dragging) return;

            const taskId = parseInt(dragging.dataset.id);
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            // Update priority based on drop zone
            const priority = zone.parentNode.dataset.priority;
            task.priority = priority;

            zone.appendChild(dragging);
        });
    });
}

function addDragEvents(card) {
    card.addEventListener("dragstart", () => {
        card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
    });
}

function setupGenerateButton() {
    document.getElementById("generateSchedule").addEventListener("click", async () => {
        const date = document.getElementById("taskDate").value;

        if (!date) {
            alert("Please select a calendar date first.");
            return;
        }

        if (tasks.length === 0) {
            alert("Please add at least one task before generating a schedule.");
            return;
        }

        selectedDate = date;
        const schedule = generateSchedule(tasks, selectedDate);

        saveSchedule(date, schedule);
        
        // Save to Firebase Cloud
        if (window.firebaseHelper) {
            await window.firebaseHelper.syncLocalToFirebase();
        }

        alert("✨ Day schedule generated successfully! Heading over to your Calendar.");
        resetInputter();
        window.location.href = "./index.html";
    });
}

function toMinutes(h, m = 0) {
    return h * 60 + m;
}

function getDayName(dateStr) {
    // Correct timezone drift for date input string
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
}

/* Base schedule window: 7 AM (420 min) to 11 PM (1380 min) */
function createBaseWindow() {
    return [
        { start: 420, end: 1380 }
    ];
}

function applyBlockedTime(windows, date) {
    const blocked = JSON.parse(localStorage.getItem("fgBlockedTime")) || [];
    let result = [...windows];

    for (let block of blocked) {
        // SINGLE DATE BLOCK
        if (block.type === "single" && block.date === date) {
            result = cutWindow(result, block.start, block.end);
        }

        // RECURRING BLOCK
        if (block.type === "recurring") {
            const day = getDayName(date);
            if (block.days.includes(day)) {
                result = cutWindow(result, block.start, block.end);
            }
        }
    }

    return result;
}

function cutWindow(windows, start, end) {
    let updated = [];

    for (let w of windows) {
        // no overlap
        if (end <= w.start || start >= w.end) {
            updated.push(w);
            continue;
        }

        // LEFT SPLIT
        if (start > w.start) {
            updated.push({
                start: w.start,
                end: start
            });
        }

        // RIGHT SPLIT
        if (end < w.end) {
            updated.push({
                start: end,
                end: w.end
            });
        }
    }

    return updated.sort((a, b) => a.start - b.start);
}

function generateSchedule(taskList, date) {
    const sorted = [...taskList].sort((a, b) => {
        const order = {
            high: 1,
            medium: 2,
            low: 3
        };
        return order[a.priority] - order[b.priority];
    });

    let windows = createBaseWindow();
    windows = applyBlockedTime(windows, date);

    const scheduled = [];
    const unscheduled = [];

    for (let task of sorted) {
        // Add 5 minutes buffer between tasks for transition
        const needed = task.duration + 5;
        let placed = false;

        for (let w of windows) {
            const available = w.end - w.start;
            if (available >= needed) {
                const start = w.start;
                const end = start + task.duration;

                scheduled.push({
                    ...task,
                    start,
                    end
                });

                // consume time and update window bounds
                w.start = end + 5;
                placed = true;
                break;
            }
        }

        if (!placed) {
            unscheduled.push(task);
        }
    }

    if (unscheduled.length > 0) {
        console.warn("Some tasks could not be scheduled within the 7 AM - 11 PM window:", unscheduled);
    }

    return {
        date,
        tasks: scheduled,
        unscheduled
    };
}

/* SAVE GENERATED SCHEDULE */
function saveSchedule(date, schedule) {
    let all = JSON.parse(localStorage.getItem("fgSchedules")) || {};
    
    // If a schedule already exists on that date, append or overwrite
    // We overwrite/update the active schedule for that date
    all[date] = schedule;

    localStorage.setItem("fgSchedules", JSON.stringify(all));
}

/* RESET UI */
function resetInputter() {
    tasks = [];
    document.getElementById("highTasks").innerHTML = "";
    document.getElementById("mediumTasks").innerHTML = "";
    document.getElementById("lowTasks").innerHTML = "";
}
