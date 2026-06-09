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
    
    // Default today's date in input - Fix timezone drift
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    selectedDate.value = `${year}-${month}-${day}`;
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
    document.getElementById("taskStartTime").value = "";

    const defaultMusic = document.querySelector('input[name="music"][value="default"]');
    if (defaultMusic) {
        defaultMusic.checked = true;
    }
}

function createTask() {
    const name = document.getElementById("taskName").value.trim();
    const duration = parseInt(document.getElementById("taskDuration").value);
    const music = document.querySelector('input[name="music"]:checked').value;
    const recurrence = document.querySelector('input[name="recurrence"]:checked')?.value || "none";
    
    const startTimeInput = document.getElementById("taskStartTime").value;
    let startTime = null;
    if (startTimeInput) {
        const [h, m] = startTimeInput.split(':').map(Number);
        startTime = h * 60 + m;
    }

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
        recurrence,
        startTime,
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

function parseDateStr(dateStr) {
    const parts = dateStr.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
    const d = parseDateStr(dateStr);
    d.setDate(d.getDate() + days);
    return formatDateStr(d);
}

function addMonths(dateStr, months) {
    const d = parseDateStr(dateStr);
    d.setMonth(d.getMonth() + months);
    return formatDateStr(d);
}

function getTaskDates(task, startDate) {
    const dates = [];
    if (task.recurrence === 'daily') {
        for (let i = 0; i < 30; i++) dates.push(addDays(startDate, i));
    } else if (task.recurrence === 'weekly') {
        for (let i = 0; i < 12; i++) dates.push(addDays(startDate, i * 7));
    } else if (task.recurrence === 'monthly') {
        for (let i = 0; i < 12; i++) dates.push(addMonths(startDate, i));
    } else if (task.recurrence === 'quarterly') {
        for (let i = 0; i < 4; i++) dates.push(addMonths(startDate, i * 3));
    } else {
        dates.push(startDate); // none/one-time
    }
    return dates;
}

function minutesToTimeStr(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = hours < 12 ? "AM" : "PM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(mins).padStart(2, "0")} ${ampm}`;
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

        // Collect all dates that need to be generated
        const datesMap = {};

        for (let task of tasks) {
            const taskDates = getTaskDates(task, selectedDate);
            const groupId = Date.now().toString(36) + Math.random().toString(36).substring(2);
            for (let d of taskDates) {
                if (!datesMap[d]) datesMap[d] = [];
                // Create unique ID for each instance to prevent completion crossover
                let uniqueId = Date.now() + Math.floor(Math.random() * 100000);
                datesMap[d].push({...task, id: uniqueId, groupId});
            }
        }

        let allSchedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
        let globalWarnings = [];

        // Generate schedule for each date
        for (let d in datesMap) {
            let existingTasks = allSchedules[d]?.tasks || [];
            
            // Strip start/end times from existing tasks to allow re-scheduling
            let existingUnscheduled = existingTasks.map(t => {
                const {start, end, ...rest} = t;
                return rest;
            });

            let combinedTasks = [...existingUnscheduled, ...datesMap[d]];
            const scheduleResult = generateSchedule(combinedTasks, d);
            allSchedules[d] = scheduleResult;
            
            if (scheduleResult.warnings && scheduleResult.warnings.length > 0) {
                scheduleResult.warnings.forEach(w => globalWarnings.push(`[${d}] ${w}`));
            }
        }

        localStorage.setItem("fgSchedules", JSON.stringify(allSchedules));
        
        // Save to Firebase Cloud
        if (window.firebaseHelper) {
            await window.firebaseHelper.syncLocalToFirebase();
        }

        if (globalWarnings.length > 0) {
            alert("Schedule generated with warnings:\n\n" + globalWarnings.join("\n"));
        } else {
            alert("✨ Day schedule(s) generated successfully! Heading over to your Calendar.");
        }
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
    const dayIndex = date.getDay();
    const dayNames = ["SU", "M", "T", "W", "TH", "F", "SA"];
    return dayNames[dayIndex];
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
        // Skip exemptions and only process actual blocks
        if (block.type === "exemption") continue;

        // SINGLE DATE BLOCK
        if (block.type === "specific" && block.date === date) {
            // Check if this specific block is exempted for today
            if (isBlockExempt(date, block.start, block.end, "specific")) {
                continue;
            }
            result = cutWindow(result, block.start, block.end);
        }

        // RECURRING BLOCK
        if (block.type === "recurring") {
            const day = getDayName(date);
            if (block.days.includes(day)) {
                // Check if this recurring block is exempted for this date
                if (isBlockExempt(date, block.start, block.end, "recurring")) {
                    continue;
                }
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
    const warnings = [];
    const scheduled = [];
    const unscheduled = [];
    
    const fixedTasks = taskList.filter(t => t.startTime !== null && t.startTime !== undefined);
    const flexibleTasks = taskList.filter(t => t.startTime === null || t.startTime === undefined);

    let windows = createBaseWindow();
    windows = applyBlockedTime(windows, date);

    fixedTasks.sort((a, b) => a.startTime - b.startTime);

    for (let task of fixedTasks) {
        const start = task.startTime;
        const end = start + task.duration;
        let placed = false;

        for (let w of windows) {
            if (start >= w.start && end <= w.end) {
                scheduled.push({
                    ...task,
                    start,
                    end
                });
                windows = cutWindow(windows, start, end + 5); 
                placed = true;
                break;
            }
        }

        if (!placed) {
            warnings.push(`Task "${task.name}" at ${minutesToTimeStr(start)} conflicts with an unavailable time or another task. Moved to a flexible time.`);
            flexibleTasks.push(task); 
        }
    }

    const sortedFlexible = [...flexibleTasks].sort((a, b) => {
        const order = { high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
    });

    for (let task of sortedFlexible) {
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

                w.start = end + 5;
                placed = true;
                break;
            }
        }

        if (!placed) {
            unscheduled.push(task);
            warnings.push(`Task "${task.name}" could not fit in the schedule.`);
        }
    }

    return {
        date,
        tasks: scheduled,
        unscheduled,
        warnings
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

// Close Mark Time Unavailable modal
const scheduleBackdrop = document.querySelector(".modalSchedule-backdrop");
const scheduleForm = document.getElementById("unavailabilitySchedule-Form");
const scheduleCancelBtn = document.querySelector(".btnSchedule-cancel");

if (scheduleCancelBtn) {
    scheduleCancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        scheduleBackdrop.style.display = "none";
    });
}

// Close when clicking on backdrop
if (scheduleBackdrop) {
    scheduleBackdrop.addEventListener("click", (e) => {
        if (e.target === scheduleBackdrop) {
            scheduleBackdrop.style.display = "none";
        }
    });
}
