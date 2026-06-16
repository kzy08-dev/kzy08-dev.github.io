/* Calendar Page */
let currentDate = new Date();
let balance = Number(localStorage.getItem("fgBalance")) || 10;
let emotionLevel = Number(localStorage.getItem("fgEmotionLevel")) || 50;

let currentAudio = null;
let currentPlayingId = null;
let currentYouTubeIframe = null;
let currentYouTubePlayingId = null;

let autoPlayCheckInterval = null;
let autoPlayingTaskIds = new Set();

const rewardMessages = [
    "Yay, you did it! You earned",
    "Great work! You earned",
    "Your pet is proud! You earned",
    "Happiness meter upgraded! You earned",
    "Spectacular job! You earned"
];

const audioFiles = [
    "../assets/audio/AudioCoffee Band - Upbeat Life.mp3",
    "../assets/audio/Heavenless - Uplifting Summer Pop.mp3",
    "../assets/audio/Ketsa - Vibrant Life.mp3"
];

document.addEventListener("DOMContentLoaded", () => {
    waitForComponents();
    
    // Listen for Firestore sync events
    window.addEventListener("fg-data-synced", () => {
        balance = Number(localStorage.getItem("fgBalance")) || 10;
        emotionLevel = Number(localStorage.getItem("fgEmotionLevel")) || 50;
        updateStatsDisplay();
        renderCalendar();
    });
});

// Task Deletion Modal Logic
let taskToDelete = null;

// Creates messages and buttons for user to be able to see if they wish to delete a task
window.handleTaskDelete = function(btn, id) {
    try {
        const activeDateKey = document.getElementById("scheduleModal").dataset.dateKey;
        const targetTask = getTaskById(activeDateKey, id);
        
        if (!targetTask) {
            alert("Error: Target task not found in schedule data! ID: " + id);
            return;
        }
        
        taskToDelete = { dateKey: activeDateKey, id };
        
        const isRecurring = targetTask.recurrence && targetTask.recurrence !== "none";
        const modal = document.getElementById("deletePromptModal");
        
        if (!modal) {
            alert("Error: deletePromptModal not found in DOM!");
            return;
        }
        
        const recurringOpts = document.getElementById("deleteRecurringOptions");
        const singleOpts = document.getElementById("deleteSingleOption");
        
        if (isRecurring) {
            recurringOpts.style.display = "flex";
            singleOpts.style.display = "none";
        } else {
            recurringOpts.style.display = "none";
            singleOpts.style.display = "flex";
        }
        
        modal.style.display = "flex";
        modal.querySelector(".modalNotes-container").style.display = "flex";
        closeModal()
    } catch (err) {
        alert("Error in delete button click: " + err.message);
    }
};

// Sets up listeners for the buttons used in the delete task modal
document.getElementById("deleteBtnCancel")?.addEventListener("click", () => {
    document.getElementById("deletePromptModal").style.display = "none";
    taskToDelete = null;
});

document.getElementById("deleteBtnSingle")?.addEventListener("click", () => {
    if (taskToDelete) executeTaskDelete(taskToDelete.dateKey, taskToDelete.id, false);
});

document.getElementById("deleteBtnOne")?.addEventListener("click", () => {
    if (taskToDelete) executeTaskDelete(taskToDelete.dateKey, taskToDelete.id, false);
});

document.getElementById("deleteBtnAll")?.addEventListener("click", () => {
    if (taskToDelete) executeTaskDelete(taskToDelete.dateKey, taskToDelete.id, true);
});

// Based on the date and id, gets the task saved in the database with schedules
function getTaskById(dateKey, id) {
    const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
    const tasks = schedules[dateKey]?.tasks || [];
    return tasks.find(t => t.id === id);
}

// Based on what the user selects, the app will either delete that specific task, cancel the request, or delete all recurring tasks
function executeTaskDelete(dateKey, id, deleteAll) {
    document.getElementById("deletePromptModal").style.display = "none";
    const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
    const targetTask = getTaskById(dateKey, id);
    if (!targetTask) return;

    if (deleteAll) {
        if (targetTask.groupId) {
             for (let d in schedules) {
                 schedules[d].tasks = schedules[d].tasks.filter(t => t.groupId !== targetTask.groupId);
             }
        } else {
             for (let d in schedules) {
                 schedules[d].tasks = schedules[d].tasks.filter(t => 
                     !(t.name === targetTask.name && t.recurrence === targetTask.recurrence && t.duration === targetTask.duration)
                 );
             }
        }
    } else {
        if (schedules[dateKey]) {
            schedules[dateKey].tasks = schedules[dateKey].tasks.filter(t => t.id !== id);
        }
    }
    
    localStorage.setItem("fgSchedules", JSON.stringify(schedules));
    
    if (window.updateEmotionFromCurrentWeek) {
        window.updateEmotionFromCurrentWeek();
    }
    
    if (window.firebaseHelper) {
        window.firebaseHelper.syncLocalToFirebase();
    }
    
    updateStatsDisplay();
    buildScheduleTable(schedules[dateKey]?.tasks || []);
    renderCalendar();
    taskToDelete = null;
}

/* WAIT FOR HEADER AND SIDEBAR TO LOAD */
function waitForComponents() {
    const interval = setInterval(() => {
        const grid = document.getElementById("calendarGrid");
        if (grid) {
            clearInterval(interval);
            initializeCalendar();
        }
    }, 50);
}

// Renders calendar display (all the cells for dates) and initializes event listeners for the buttons to switch between months
function initializeCalendar() {
    renderCalendar();
    updateStatsDisplay();
    document.getElementById("prevMonth").addEventListener("click", previousMonth);
    document.getElementById("nextMonth").addEventListener("click", nextMonth);
    document.getElementById("closeModal").addEventListener("click", closeModal);
    initializeAutoPlayMonitoring();
}

/* CHANGING MONTHS */
function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

/* RENDER CALENDAR GRID WITH TASK PREVIEWS */
function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    const monthYear = document.getElementById("monthYear");
    if (!grid || !monthYear) return;
    
    grid.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthYear.textContent = currentDate.toLocaleString("default", {
        month: "long",
        year: "numeric"
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    // Blank cells for first week alignment
    for (let i = 0; i < firstDay; i++) {
        const blank = document.createElement("div");
        grid.appendChild(blank);
    }

    // Populate day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement("div");
        cell.className = "day";
        if (isCurrentMonth && today.getDate() === day) {
            cell.classList.add("today");
        }

        // Create Day heading
        let html = `<div class="day-number">${day}</div>`;
        
        // Fetch tasks preview for this specific day
        const dateKey = getSelectedDateKey(day);
        const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
        const daySchedule = schedules[dateKey]?.tasks || [];
        
        if (daySchedule.length > 0) {
            html += `<div class="day-tasks-preview">`;
            // Limit preview to 3 items to avoid overflows
            daySchedule.slice(0, 3).forEach(task => {
                const completedClass = task.completed ? "completed" : "";
                const dotStyle = task.color ? `style="border-left-color: ${task.color}; color: ${task.color};"` : "";
                html += `<div class="task-dot ${completedClass}" ${dotStyle}>${task.name}</div>`;
            });
            if (daySchedule.length > 3) {
                html += `<div style="padding-left: 5px; opacity: 0.6;">+${daySchedule.length - 3} more</div>`;
            }
            html += `</div>`;
        }

        cell.innerHTML = html;
        cell.addEventListener("click", () => openDaySchedule(day));
        grid.appendChild(cell);
    }
}

/* OPEN MODAL DAY SCHEDULE */
function openDaySchedule(day) {
    const dateKey = getSelectedDateKey(day);
    const parts = dateKey.split('-');
    const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const formattedDate = localDate.toLocaleDateString("en-US");

    document.getElementById("scheduleModal").classList.remove("hidden");
    document.getElementById("scheduleModal").dataset.dateKey = dateKey;
    document.getElementById("selectedDateHeading").textContent = formattedDate;

    const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
    const daySchedule = schedules[dateKey]?.tasks || [];

    buildScheduleTable(daySchedule);
}

function getSelectedDateKey(day) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
}

/* BUILD SCHEDULE GRID */
/* BUILD SCHEDULE GRID WITH BLOCKED TIME DISPLAY */
function buildScheduleTable(tasks) {
    const body = document.getElementById("scheduleBody");
    if (!body) return;
    body.innerHTML = "";

    // Get the current viewing date key from the modal dataset
    const dateKey = document.getElementById("scheduleModal").dataset.dateKey;

    if (tasks.length === 0 && !hasBlockedTimeOnDate(dateKey)) {
        body.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-dim);">No tasks scheduled for this day. Click 'Edit Schedule' to add some!</td></tr>`;
        return;
    }

    const blockedTimeSlots = getBlockedSlotsForDate(dateKey);

    let events = [];

    // Add tasks
    tasks.forEach(task => {
        events.push({
            start: task.start,
            type: 'task',
            data: task
        });
    });

    // Add blocked slots
    blockedTimeSlots.forEach(block => {
        // Find if this specific block is exempted
        const blocked = JSON.parse(localStorage.getItem("fgBlockedTime")) || [];
        const isExempt = blocked.some(b => 
            b.type === "exemption" &&
            b.date === dateKey &&
            b.originalBlockStart === block.start &&
            b.originalBlockEnd === block.end
        );

        if (!isExempt) {
            events.push({
                start: block.start,
                type: 'blocked',
                data: block
            });
        }
    });

    // Group events that occur at the exact same start minute
    const groupedEvents = {};
    events.forEach(event => {
        if (!groupedEvents[event.start]) {
            groupedEvents[event.start] = { tasks: [], blocked: null };
        }
        if (event.type === 'task') {
            groupedEvents[event.start].tasks.push(event.data);
        } else if (event.type === 'blocked') {
            groupedEvents[event.start].blocked = event.data;
        }
    });

    const sortedTimes = Object.keys(groupedEvents).map(Number).sort((a, b) => a - b);

    // Render each group
    sortedTimes.forEach(timeIndex => {
        const group = groupedEvents[timeIndex];
        
        const row = document.createElement("tr");
        const timeCell = document.createElement("td");
        const taskCell = document.createElement("td");

        const hour = Math.floor(timeIndex / 60);
        const min = timeIndex % 60;
        timeCell.textContent = formatTime(hour, min);
        timeCell.style.width = "90px";
        timeCell.style.fontWeight = "600";
        timeCell.style.color = "var(--primary-main)";

        let contentHtml = "";

        if (group.blocked) {
            row.classList.add("blocked-time-row");
            contentHtml += `
                <div class="blocked-time-slot">
                    <button class="remove-block-btn" data-date="${dateKey}" data-block-start="${group.blocked.start}" data-block-end="${group.blocked.end}" data-block-type="${group.blocked.type}">
                        Remove For Today
                    </button>
                </div>
            `;
        }

        if (group.tasks.length > 0) {
            contentHtml += group.tasks.map(renderTaskBlock).join("");
        }

        taskCell.innerHTML = contentHtml;
        row.append(timeCell, taskCell);
        body.appendChild(row);
    });

    attachTaskButtons();
    attachBlockRemovalButtons();
}

/* BLOCKED TIME HELPER FUNCTIONS */
function parseDateHeadingToKey(dateHeading) {
    // Convert "6/8/2026" or "June 8, 2026" format to "2026-06-08"
    const date = new Date(dateHeading);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Checks to see the blocked time slots for a given day 
function hasBlockedTimeOnDate(dateKey) {
    const blocked = JSON.parse(localStorage.getItem("fgBlockedTime")) || [];
    for (let block of blocked) {
        if (block.type === "specific" && block.date === dateKey) {
            return true;
        }
        if (block.type === "recurring") {
            const dayName = getDayNameFromDateKey(dateKey);
            if (block.days.includes(dayName)) {
                return true;
            }
        }
    }
    return false;
}

// Does some conversions to get the weekday
function getDayNameFromDateKey(dateKey) {
    // Convert "2026-06-08" to day abbreviation (M, T, W, TH, F, SA, SU)
    const parts = dateKey.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayIndex = date.getDay();
    const dayNames = ["SU", "M", "T", "W", "TH", "F", "SA"];
    return dayNames[dayIndex];
}

// Used for the blocked time modal, in order to check recurring blocked time properly
function isDateInRecurringCycle(checkDate, startDate, frequency) {
    const start = new Date(startDate);
    const check = new Date(checkDate);
    
    start.setHours(0, 0, 0, 0);
    check.setHours(0, 0, 0, 0);
    
    const diffMs = check - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return false;
    
    let frequencyDays;
    if (frequency === "weekly") {
        frequencyDays = 7;
    } else if (frequency === "bi-weekly") {
        frequencyDays = 14;
    } else if (frequency === "tri-weekly") {
        frequencyDays = 21;
    } else {
        frequencyDays = 7;
    }
    
    return diffDays % frequencyDays === 0;
}

function getBlockedSlotsForDate(dateKey) {
    // Returns array of all blocked time blocks for this specific date
    const blocked = JSON.parse(localStorage.getItem("fgBlockedTime")) || [];
    const applicableBlocks = [];

    for (let block of blocked) {
        // Specific date match
        if (block.type === "specific" && block.date === dateKey) {
            applicableBlocks.push(block);
        }
        // Recurring date match
        else if (block.type === "recurring") {
            const dayName = getDayNameFromDateKey(dateKey);
            if (block.days.includes(dayName)) {
                // Check if this date falls on the correct frequency cycle
                if (isDateInRecurringCycle(dateKey, block.startDate, block.frequency)) {
                    // Also check if this specific date/time is exempted
                    const isExempt = blocked.some(b =>
                        b.type === "exemption" &&
                        b.date === dateKey &&
                        b.originalBlockStart === block.start &&
                        b.originalBlockEnd === block.end
                    );
                    
                    if (!isExempt) {
                        applicableBlocks.push(block);
                    }
                }
            }
        }
    }

    return applicableBlocks;
}

function isTimeSlotBlocked(timeIndex, blockedSlots) {
    // Check if a 30-minute slot is covered by any blocked time
    const slotStart = timeIndex;
    const slotEnd = timeIndex + 30;
    const dateKey = document.getElementById("scheduleModal").dataset.dateKey;

    for (let block of blockedSlots) {
        // Check for overlap
        if (!(slotEnd <= block.start || slotStart >= block.end)) {
            // Check if this specific time is exempted
            const blocked = JSON.parse(localStorage.getItem("fgBlockedTime")) || [];
            const isExempt = blocked.some(b =>
                b.type === "exemption" &&
                b.date === dateKey &&
                b.originalBlockStart === block.start &&
                b.originalBlockEnd === block.end
            );
            
            if (!isExempt) {
                return true;
            }
        }
    }
    
    return false;
}

function renderBlockedTimeSlot(timeIndex, dateKey, blockedSlots) {
    // Find which block covers this time slot
    const slotStart = timeIndex;
    const slotEnd = timeIndex + 30;
    
    let coveringBlock = null;
    for (let block of blockedSlots) {
        if (!(slotEnd <= block.start || slotStart >= block.end)) {
            // Check if this is a recurring block that has an exemption for today
            if (block.type === "recurring") {
                const blocked = JSON.parse(localStorage.getItem("fgBlockedTime")) || [];
                const hasExemption = blocked.some(b => 
                    b.type === "exemption" &&
                    b.date === dateKey &&
                    b.originalBlockStart === block.start &&
                    b.originalBlockEnd === block.end
                );
                
                if (hasExemption) {
                    continue; // Skip this block, it's exempted for today
                }
            }
            
            coveringBlock = block;
            break;
        }
    }

    if (!coveringBlock) {
        return ``;
    }

    // Creates the remove for today, which allows the user to get rid of blocked time slots if their schedule frees up
    return `
        <div class="blocked-time-slot">
            <button class="remove-block-btn" data-date="${dateKey}" data-block-start="${coveringBlock.start}" data-block-end="${coveringBlock.end}" data-block-type="${coveringBlock.type}">
                Remove For Today
            </button>
        </div>
    `;
}

// Conversion into a nice readable format
function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = hours < 12 ? "AM" : "PM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(mins).padStart(2, "0")} ${ampm}`;
}

// Adds event listener for the remove for today button
function attachBlockRemovalButtons() {
    document.querySelectorAll(".remove-block-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            
            const dateKey = btn.dataset.date;
            const blockStart = parseInt(btn.dataset.blockStart);
            const blockEnd = parseInt(btn.dataset.blockEnd);
            const blockType = btn.dataset.blockType;

            // Remove the specific block or add an exemption
            let blocked = JSON.parse(localStorage.getItem("fgBlockedTime")) || [];
            
            if (blockType === "specific") {
                // For specific blocks, remove only this exact block entry
                blocked = blocked.filter(block => !(
                    block.type === "specific" &&
                    block.date === dateKey &&
                    block.start === blockStart &&
                    block.end === blockEnd
                ));
            } else if (blockType === "recurring") {
                // For recurring blocks, create an exemption for this specific time slot on this date
                const exemptionRecord = {
                    type: "exemption",
                    date: dateKey,
                    originalBlockStart: blockStart,
                    originalBlockEnd: blockEnd,
                    originalBlockType: blockType,
                    createdAt: new Date().toISOString()
                };
                blocked.push(exemptionRecord);
            }

            localStorage.setItem("fgBlockedTime", JSON.stringify(blocked));

            // Sync to Firebase
            if (window.firebaseHelper) {
                await window.firebaseHelper.syncLocalToFirebase();
            }

            // Refresh both the schedule table and calendar
            const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
            buildScheduleTable(schedules[dateKey]?.tasks || []);
            renderCalendar();
        });
    });
}

// Logic for ensuring tasks are able to be filled in properly and don't overlap with each other
function generateSlotMap(tasks) {
    const map = {};
    for (let task of tasks) {
        const start = task.start;
        const end = task.end;
        for (let t = start; t < end; t += 30) {
            const slot = Math.floor(t / 30) * 30;
            if (!map[slot]) {
                map[slot] = [];
            }
            // Avoid duplicates in slots
            if (!map[slot].some(t => t.id === task.id)) {
                map[slot].push(task);
            }
        }
    }
    return map;
}

// Generates the task card seen when you open up the schedule modal - complete with name, x, check, and play buttons
function renderTaskBlock(task) {
    let baseStyles = '';
    if (task.color) {
        baseStyles = `background-color: ${task.color} !important; border-color: rgba(255,255,255,0.4) !important;`;
    }
    
    const completedStyle = task.completed ? `style="opacity: 0.4;"` : '';
    const buttonState = task.completed ? 'disabled' : '';
    
    // Check if task.startTime exists and is a valid number
    const hasStartTime = task.startTime !== undefined && task.startTime !== null && !isNaN(task.startTime);
    const timeDisplay = hasStartTime ? ` - ${minutesToTime(task.startTime)}` : '';

    return `
        <div class="task-entry" ${completedStyle}>
            <span class="task-name" style="${task.completed ? 'text-decoration: line-through; color: var(--text-dim);' : ''}">
                ${task.name} <span style="font-size: 0.8rem; color: var(--text-dim);">(${task.duration} min)${timeDisplay}</span>
            </span>
            <div class="task-controls">
                <button class="delete-btn" onclick="window.handleTaskDelete(this, ${task.id})" title="Delete task">✖</button>
                <button class="play-btn" data-id="${task.id}" title="Play music" ${buttonState}>▶</button>
                <button class="complete-btn" data-id="${task.id}" title="Complete task" ${buttonState}>✓</button>
            </div>
        </div>
    `;
}

// Formatting time using hours and minutes
function formatTime(hour, min) {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    return `${h}:${String(min).padStart(2, "0")} ${ampm}`;
}

// Used to convert the Youtube embed link to a usable format for iframes
function buildYouTubeUrl(source) {
    // Check if URL already has query parameters
    if (source.includes("?")) {
        return source + "&autoplay=1&controls=0";
    } else {
        return source + "?autoplay=1&controls=0";
    }
}

// Play from custom playlist based on the task id given
function playFromCustomPlaylist(taskId) {
    const playlist = getPlaylistFromStorage();
    
    if (!playlist || playlist.length === 0) {
        alert("No songs in your custom playlist. Add some in the Music page first!");
        return;
    }
    
    // Select a song from playlist using variety (not always the same song)
    const songIndex = taskId % playlist.length;
    const selectedSong = playlist[songIndex];
    
    // 1. If clicking the SAME button that is already active -> Toggle Play/Pause
    if (currentPlayingId === taskId) {
        if (selectedSong.type === "youtube") {
            if (currentYouTubeIframe && currentYouTubePlayingId === taskId) {
                const isPlaying = currentYouTubeIframe.dataset.isPlaying === "true";
                if (isPlaying) {
                    currentYouTubeIframe.src = "";
                    currentYouTubeIframe.dataset.isPlaying = "false";
                } else {
                    const src = buildYouTubeUrl(selectedSong.source);
                    currentYouTubeIframe.src = src;
                    currentYouTubeIframe.dataset.isPlaying = "true";
                }
                return;
            }
        } else if (currentAudio) {
            if (currentAudio.paused) {
                currentAudio.play();
            } else {
                currentAudio.pause();
            }
            return;
        }
    }
    
    // 2. Stop any currently playing audio/video
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (currentYouTubeIframe) {
        currentYouTubeIframe.remove();
        currentYouTubeIframe = null;
    }
    
    // 3. Play the selected song
    if (selectedSong.type === "youtube") {
        // Create hidden iframe for YouTube playback
        currentYouTubeIframe = document.createElement("iframe");
        currentYouTubeIframe.style.width = "0";
        currentYouTubeIframe.style.height = "0";
        currentYouTubeIframe.style.border = "none";
            
        const src = buildYouTubeUrl(selectedSong.source);
        currentYouTubeIframe.src = src;
        currentYouTubeIframe.allow = "autoplay";
        currentYouTubeIframe.dataset.isPlaying = "true";
            
        document.body.appendChild(currentYouTubeIframe);
        currentPlayingId = taskId;
        currentYouTubePlayingId = taskId;
    } else if (selectedSong.type === "audio") {
        // Play audio file
        try {
            currentAudio = new Audio(selectedSong.source);
            currentPlayingId = taskId;
    
            currentAudio.addEventListener("ended", () => {
                currentAudio = null;
                currentPlayingId = null;
            });
    
            currentAudio.play();
        } catch (e) {
            alert("Unable to play this audio file. Please ensure it is a valid format.");
        }
    }
}
    
// HELPER FUNCTION: Get playlist from localStorage
function getPlaylistFromStorage() {
    return JSON.parse(localStorage.getItem("feralGremlinPlaylist")) || [];
}

/* INTERACTIVE BUTTON HANDLERS */
function attachTaskButtons() {
    document.querySelectorAll(".complete-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = parseInt(btn.dataset.id);
            const taskPriority = getTaskPriority(id);
            
            // Mark task complete locally
            markTaskComplete(id);
    
            // Audio reinforcement
            playSuccessChime();
    
            // Spawn visual rewards at click coordinates
            spawnFloatingCoin(e);
            spawnConfetti(e.clientX, e.clientY);
    
            // Reward metrics updates - ensure this completes before refreshing
            await showRewardMessage(taskPriority);
            await increaseEmotionMeter(taskPriority);
            
            // Refresh table and main calendar cell previews
            const activeDateKey = document.getElementById("scheduleModal").dataset.dateKey;
            const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
            buildScheduleTable(schedules[activeDateKey]?.tasks || []);
            renderCalendar();
        });
    });

    document.querySelectorAll(".play-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id);
            
            // If this task is currently auto-playing, just pause it
            if (autoPlayingTaskIds.has(id) && currentPlayingId === id) {
                if (currentAudio) {
                    currentAudio.pause();
                } else if (currentYouTubeIframe) {
                    currentYouTubeIframe.src = "";
                }
                autoPlayingTaskIds.delete(id);
                currentPlayingId = null;
                return;
            }
            
            // Otherwise, handle normal play button logic (existing code)
            const musicType = getTaskMusicType(id);
    
            if (musicType !== "default") {
                playFromCustomPlaylist(id);
                return;
            }
    
            const trackIndex = id % audioFiles.length;
            const selectedTrackSrc = audioFiles[trackIndex];
    
            if (currentPlayingId === id && currentAudio) {
                if (currentAudio.paused) {
                    currentAudio.play();
                } else {
                    currentAudio.pause();
                }
                return;
            }
    
            if (currentAudio) {
                currentAudio.pause();
            }
    
            if (currentYouTubeIframe) {
                currentYouTubeIframe.remove();
                currentYouTubeIframe = null;
                currentYouTubePlayingId = null;
            }
    
            currentAudio = new Audio(selectedTrackSrc);
            currentPlayingId = id;
            currentAudio.play();
    
            currentAudio.addEventListener("ended", () => {
                currentAudio = null;
                currentPlayingId = null;
            });
        });
    });
}

/* STATE MUTATORS */
// Marks task as complete and saves this in local storage, so it can later be synced to Firebase
function markTaskComplete(id) {
    const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
    for (let date in schedules) {
        let tasks = schedules[date].tasks;
        for (let t of tasks) {
            if (t.id === id) {
                t.completed = true;
            }
        }
    }
    localStorage.setItem("fgSchedules", JSON.stringify(schedules));
}

// Determines the priority of a task given its idea by pulling it from local storage
function getTaskPriority(id) {
    const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
    for (let date in schedules) {
        let tasks = schedules[date].tasks;
        for (let t of tasks) {
            if (t.id === id) {
                return t.priority || "medium";
            }
        }
    }
    return "medium";
}

// Determines whether the user chose the default or playlist option for their music for a task
function getTaskMusicType(id) {
    const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
    for (let date in schedules) {
        let tasks = schedules[date].tasks;
        for (let t of tasks) {
            if (t.id === id) {
                // Return the configured music type or fallback to "default"
                return t.musicType || "default";
            }
        }
    }
    return "default";
}

/* COINS & REWARDS */
function getRewardByPriority(priority) {
    const rewardMap = {
        "high": 5,
        "medium": 2,
        "low": 0.5
    };
    return rewardMap[priority.toLowerCase()] || 2;
}

// Shows the reward message when the user completes a task, complete with the appropriate increase in balance based on priority of task
async function showRewardMessage(priority) {
    const amount = getRewardByPriority(priority);
    const toast = document.getElementById("rewardToast");
    if (!toast) {
        console.warn("rewardToast element not found");
        return;
    }

    const message = rewardMessages[Math.floor(Math.random() * rewardMessages.length)];
    toast.innerHTML = `${message} +${amount} <img src="assets/images/gremlin_coin.png" class="coin-icon" alt="coin">!`;
    
    // Ensure any previous "show" class is removed before adding it again
    toast.classList.remove("show");
    
    // Force a reflow to ensure the class removal takes effect
    void toast.offsetWidth;
    
    // Now add the show class
    toast.classList.add("show");

    // Add money and update display
    balance += amount;
    localStorage.setItem("fgBalance", balance);
    updateStatsDisplay();

    // Firestore Sync
    if (window.firebaseHelper) {
        await window.firebaseHelper.syncLocalToFirebase();
    }

    // Wait before removing the show class
    await new Promise(resolve => setTimeout(resolve, 3500));
    toast.classList.remove("show");
}

// Updates the virtual balance and the emotion meter to reflect pet's happiness (goes up as more tasks are completed)
function updateStatsDisplay() {
    const balanceDisplay = document.getElementById("balanceDisplay");
    if (balanceDisplay) {
        balanceDisplay.innerHTML = `<img src="assets/images/gremlin_coin.png" class="coin-icon" alt="coin"> ${Math.floor(balance)}`;
    }
    
    // Always fetch fresh emotion level
    emotionLevel = Number(localStorage.getItem("fgEmotionLevel"));
    if (isNaN(emotionLevel)) emotionLevel = 50;

    const emotionFill = document.getElementById("emotionFill");
    if (emotionFill) {
        emotionFill.style.width = `${emotionLevel}%`;
        
        // Dynamic colors based on mood level
        if (emotionLevel > 70) {
            emotionFill.style.background = "linear-gradient(to right, #00c6ff, #00e676)"; // Emerald glow
        } else if (emotionLevel < 35) {
            emotionFill.style.background = "linear-gradient(to right, #ff416c, #ff4b2b)"; // Warning red
        } else {
            emotionFill.style.background = "linear-gradient(to right, var(--emotion-sad), var(--emotion-happy))";
        }
    }
}

/* PET HAPPINESS LEVEL */
async function increaseEmotionMeter(priority) {
    if (window.updateEmotionFromCurrentWeek) {
        window.updateEmotionFromCurrentWeek();
    }
    updateStatsDisplay();
    
    if (window.firebaseHelper) {
        await window.firebaseHelper.syncLocalToFirebase();
    }
}

/* REWARD SOUND & VISUAL PARTICLES */
function playSuccessChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create nodes
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        // Golden chime frequency combination (C6 to E6)
        osc.type = "sine";
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime); // C6
        osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.08); // E6
        
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
        // Fallback for browsers blocking AudioContext prior to interaction
    }
}

function spawnFloatingCoin(e) {
    const coin = document.createElement("div");
    coin.className = "coin-animation-element";
    coin.innerHTML = "<img src='assets/images/gremlin_coin.png' class='coin-icon' alt='coin' style='width: 30px; height: 30px;'>";
    coin.style.left = `${e.clientX - 10}px`;
    coin.style.top = `${e.clientY - 20}px`;
    document.body.appendChild(coin);
    
    setTimeout(() => {
        coin.remove();
    }, 1000);
}

function spawnConfetti(x, y) {
    const container = document.body;
    const colors = ["#00f2fe", "#4facfe", "#9d4edd", "#00e676", "#ffe56b", "#f43f5e"];
    
    for (let i = 0; i < 24; i++) {
        const p = document.createElement("div");
        p.style.position = "fixed";
        p.style.width = `${4 + Math.random() * 6}px`;
        p.style.height = `${4 + Math.random() * 6}px`;
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        p.style.borderRadius = Math.random() > 0.4 ? "50%" : "2px";
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.pointerEvents = "none";
        p.style.zIndex = "4100";
        p.style.boxShadow = "0 0 5px rgba(255,255,255,0.3)";
        
        // Random velocity vectors
        const angle = Math.random() * Math.PI * 2;
        const velocity = 3 + Math.random() * 5;
        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity - 2; // Upward burst bias
        
        container.appendChild(p);
        
        let curX = x;
        let curY = y;
        let opacity = 1;
        
        const anim = setInterval(() => {
            curX += dx;
            curY += dy + 0.22; // simulated gravity drift
            opacity -= 0.025;
            
            p.style.left = `${curX}px`;
            p.style.top = `${curY}px`;
            p.style.opacity = opacity;
            
            if (opacity <= 0) {
                clearInterval(anim);
                p.remove();
            }
        }, 16);
    }
}

function closeModal() {
    document.getElementById("scheduleModal").classList.add("hidden");
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

// Initialize auto-play monitoring when calendar loads
function initializeAutoPlayMonitoring() {
    // Run check immediately
    checkAndAutoPlayTasks();
    
    // Check every 30 seconds for time changes
    autoPlayCheckInterval = setInterval(checkAndAutoPlayTasks, 30000);
}

// Check current time and auto-play tasks that match
function checkAndAutoPlayTasks() {
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
    
    const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
    
    // Get today's date key
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayKey = `${year}-${month}-${day}`;
    
    const todayTasks = schedules[todayKey]?.tasks || [];
    
    todayTasks.forEach(task => {
        // Check if task should be playing now
        const taskStartTime = task.start; // in minutes (e.g., 510 = 8:30 AM)
        const taskEndTime = task.end;
        const isTaskTimeWindow = currentTimeInMinutes >= taskStartTime && currentTimeInMinutes < taskEndTime;
        
        // If current time matches task time and task isn't already auto-playing
        if (isTaskTimeWindow && !autoPlayingTaskIds.has(task.id)) {
            triggerAutoPlay(task);
        }
        
        // Stop auto-play if we've moved past the task time window
        if (!isTaskTimeWindow && autoPlayingTaskIds.has(task.id)) {
            stopAutoPlay(task.id);
        }
    });
}

// Trigger auto-play for a specific task
function triggerAutoPlay(task) {
    const musicType = task.musicType || "default";
    
    // Stop any currently playing audio first
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (currentYouTubeIframe) {
        currentYouTubeIframe.remove();
        currentYouTubeIframe = null;
    }
    
    // Scenario A: Custom playlist
    if (musicType !== "default") {
        const playlist = JSON.parse(localStorage.getItem("feralGremlinPlaylist")) || [];
        if (playlist.length === 0) return;
        
        const songIndex = task.id % playlist.length;
        const selectedSong = playlist[songIndex];
        
        if (selectedSong.type === "youtube") {
            currentYouTubeIframe = document.createElement("iframe");
            currentYouTubeIframe.style.width = "0";
            currentYouTubeIframe.style.height = "0";
            currentYouTubeIframe.style.border = "none";
            
            const src = buildYouTubeUrl(selectedSong.source);
            currentYouTubeIframe.src = src;
            currentYouTubeIframe.allow = "autoplay";
            currentYouTubeIframe.dataset.isPlaying = "true";
            currentYouTubeIframe.dataset.autoPlayTaskId = task.id;
            
            document.body.appendChild(currentYouTubeIframe);
        } else if (selectedSong.type === "audio") {
            currentAudio = new Audio(selectedSong.source);
            currentAudio.dataset.autoPlayTaskId = task.id;
            currentAudio.play().catch(e => console.warn("Auto-play prevented:", e));
            
            currentAudio.addEventListener("ended", () => {
                if (autoPlayingTaskIds.has(task.id)) {
                    autoPlayingTaskIds.delete(task.id);
                }
                currentAudio = null;
            });
        }
    } 
    // Scenario B: Default track selection
    else {
        const trackIndex = task.id % audioFiles.length;
        const selectedTrackSrc = audioFiles[trackIndex];
        
        currentAudio = new Audio(selectedTrackSrc);
        currentAudio.dataset.autoPlayTaskId = task.id;
        currentAudio.play().catch(e => console.warn("Auto-play prevented:", e));
        
        currentAudio.addEventListener("ended", () => {
            if (autoPlayingTaskIds.has(task.id)) {
                autoPlayingTaskIds.delete(task.id);
            }
            currentAudio = null;
        });
    }
    
    currentPlayingId = task.id;
    autoPlayingTaskIds.add(task.id);
}

// Stop auto-play for a task
function stopAutoPlay(taskId) {
    if (currentAudio && currentAudio.dataset?.autoPlayTaskId == taskId) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (currentYouTubeIframe && currentYouTubeIframe.dataset?.autoPlayTaskId == taskId) {
        currentYouTubeIframe.remove();
        currentYouTubeIframe = null;
    }
    if (currentPlayingId === taskId) {
        currentPlayingId = null;
    }
    autoPlayingTaskIds.delete(taskId);
}
