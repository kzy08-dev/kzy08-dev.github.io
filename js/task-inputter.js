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

// Sets up all the boxes and modals for the task inputter so the user can use it
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

// Allows the user to enter in details of a task, including name, duration, start times, and picking recurrence and music choice
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
        completed: false,
        color: "" // Default color
    };

    tasks.push(task);
    renderTaskCard(task);
    closeModal();
}

// Allows the user to color code their task if they wish
function openColorPicker(btn, taskId) {
    if (window.event) window.event.stopPropagation();

    let existing = document.getElementById("color-picker-bar");
    if (existing) {
        existing.remove();
        if (window._colorPickerCloseHandler) {
            document.removeEventListener("click", window._colorPickerCloseHandler);
            window._colorPickerCloseHandler = null;
        }
        if (existing.dataset.taskId === String(taskId)) {
            return;
        }
    }
    
    const bar = document.createElement("div");
    bar.id = "color-picker-bar";
    bar.className = "color-picker-bar";
    bar.dataset.taskId = taskId;
    
    bar.addEventListener('click', e => e.stopPropagation());
    
    const colors = ["", "#ff416c", "#00c6ff", "#00e676", "#9d4edd", "#ffd700", "#ff8a00"];
    
    colors.forEach(color => {
        const swatch = document.createElement("div");
        swatch.className = "color-swatch";
        if (color === "") {
            swatch.style.background = "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.5) 45%, rgba(255,255,255,0.5) 55%, transparent 60%)";
            swatch.title = "Default Color";
        } else {
            swatch.style.backgroundColor = color;
        }
        
        swatch.onclick = (e) => {
            e.stopPropagation();
            setTaskColor(taskId, color);
            bar.remove();
            if (window._colorPickerCloseHandler) {
                document.removeEventListener("click", window._colorPickerCloseHandler);
                window._colorPickerCloseHandler = null;
            }
        };
        bar.appendChild(swatch);
    });
    
    btn.parentNode.appendChild(bar);
    
    window._colorPickerCloseHandler = () => {
        const current = document.getElementById("color-picker-bar");
        if (current) current.remove();
        document.removeEventListener("click", window._colorPickerCloseHandler);
        window._colorPickerCloseHandler = null;
    };
    
    document.addEventListener("click", window._colorPickerCloseHandler);
}

// Sets the color of the task when it appears in the priority box
function setTaskColor(taskId, color) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.color = color;
        const card = document.querySelector(`.task-card[data-id="${taskId}"]`);
        if (card) {
            const durationEl = card.querySelector('.task-duration');
            if (color) {
                card.style.backgroundColor = color;
                card.style.borderLeftColor = "rgba(255,255,255,0.5)"; // Make left border blend in
                if (durationEl) durationEl.style.color = "rgba(255, 255, 255, 0.9)";
            } else {
                card.style.backgroundColor = "";
                card.style.borderLeftColor = "";
                if (durationEl) durationEl.style.color = "";
            }
        }
    }
}

// Renders the task card as it will appear in the priority box
function renderTaskCard(task) {
    const card = document.createElement("div");
    card.className = "task-card";
    card.draggable = true;
    card.dataset.id = task.id;
    
    if (task.color) {
        card.style.backgroundColor = task.color;
        card.style.borderLeftColor = "rgba(255,255,255,0.5)";
    }
    
    card.innerHTML = `
        <div style="flex: 1; pointer-events: none;">
            <div class="task-title">${task.name}</div>
            <div class="task-duration" ${task.color ? 'style="color: rgba(255, 255, 255, 0.9);"' : ''}>⏱ ${task.duration} min</div>
        </div>
        <div class="task-color-btn" onclick="openColorPicker(this, ${task.id})" title="Change Color">🎨</div>
    `;

    addDragEvents(card);
    document.getElementById("highTasks").appendChild(card);
}

// Allows the user to drag and drop the task cards so it sorts out into priority level, which is accounted for in scheduling
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

// Allows the card to listen for if the user is going to drag the card around
function addDragEvents(card) {
    card.addEventListener("dragstart", () => {
        card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
    });
}

// Below are some conversions for the data to be used properly with regards to dates
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

// Sets up an event listener and adds safeguards to ensure the user can't generate a schedule without missing data
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
        
        if (window.updateEmotionFromCurrentWeek) {
            window.updateEmotionFromCurrentWeek();
        }
        
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
        
function isBlockExempt(dateKey, blockStart, blockEnd, blockType) {
    const blocked = JSON.parse(localStorage.getItem("fgBlockedTime")) || [];
    
    for (let block of blocked) {
        if (block.type === "exemption" && 
            block.date === dateKey && 
            block.originalBlockStart === blockStart && 
            block.originalBlockEnd === blockEnd &&
            block.originalBlockType === blockType) {
            return true;
        }
    }
    return false;
}

/* Base schedule window: 12:00 AM (0 min) to 11:59 PM (1440 min) */
function createBaseWindow() {
    return [
        { start: 0, end: 1440 }
    ];
}

// Ensures that no tasks are scheduled in those specific time periods that are marked as unavailable
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
                // Check if date falls on the correct frequency cycle
                if (!isDateInRecurringCycle(date, block.startDate, block.frequency)) {
                    continue;
                }
                
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

// Using the information about windows for when time is open and the optional start time, generates a schedule that places all the tasks down
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

        // Ensures that tasks do not overlap with commitments or other tasks
        if (!placed) {
            warnings.push(`Task "${task.name}" at ${minutesToTimeStr(start)} conflicts with an unavailable time or another task. Moved to a flexible time.`);
            flexibleTasks.push(task); 
        }
    }

    // Tasks that don't have a start time are sorted in terms of priority, such that higher priority ones are placed first
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
