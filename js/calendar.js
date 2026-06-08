/* Calendar Page */

let currentDate = new Date();
let balance = Number(localStorage.getItem("fgBalance")) || 10;
let emotionLevel = Number(localStorage.getItem("fgEmotionLevel")) || 50;

let currentAudio = null;
let currentPlayingId = null;

const rewardMessages = [
    "Yay, you did it! You earned",
    "Woof! Great work! You earned",
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

function initializeCalendar() {
    renderCalendar();
    updateStatsDisplay();
    document.getElementById("prevMonth").addEventListener("click", previousMonth);
    document.getElementById("nextMonth").addEventListener("click", nextMonth);
    document.getElementById("closeModal").addEventListener("click", closeModal);
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
                html += `<div class="task-dot ${completedClass}">${task.name}</div>`;
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
    const formattedDate = new Date(dateKey).toLocaleDateString("en-US");

    document.getElementById("scheduleModal").classList.remove("hidden");
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

    // Get the current viewing date from the modal heading
    const dateHeading = document.getElementById("selectedDateHeading").textContent;
    const dateKey = parseDateHeadingToKey(dateHeading);

    if (tasks.length === 0 && !hasBlockedTimeOnDate(dateKey)) {
        body.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-dim);">No tasks scheduled for this day. Click 'Edit Schedule' to add some!</td></tr>`;
        return;
    }

    const slotMap = generateSlotMap(tasks);
    const blockedTimeSlots = getBlockedSlotsForDate(dateKey);

    for (let hour = 7; hour < 23; hour++) { // Show hours from 7 AM to 11 PM
        for (let min = 0; min < 60; min += 30) {
            const timeIndex = hour * 60 + min;
            const slotTasks = slotMap[timeIndex] || [];
            const isBlocked = isTimeSlotBlocked(timeIndex, blockedTimeSlots);

            // Display row if there are tasks OR if time is blocked
            if (slotTasks.length > 0 || isBlocked) {
                const row = document.createElement("tr");
                const timeCell = document.createElement("td");
                const taskCell = document.createElement("td");

                timeCell.textContent = formatTime(hour, min);
                timeCell.style.width = "90px";
                timeCell.style.fontWeight = "600";
                timeCell.style.color = "var(--primary-main)";

                if (isBlocked && slotTasks.length === 0) {
                    // Display blocked time slot
                    row.classList.add("blocked-time-row");
                    taskCell.innerHTML = renderBlockedTimeSlot(timeIndex, dateKey, blockedTimeSlots);
                } else if (isBlocked && slotTasks.length > 0) {
                    // Tasks during blocked time (shouldn't happen but handle it)
                    taskCell.innerHTML = slotTasks.map(renderTaskBlock).join("");
                } else {
                    // Normal task display
                    taskCell.innerHTML = slotTasks.map(renderTaskBlock).join("");
                }

                row.append(timeCell, taskCell);
                body.appendChild(row);
            }
        }
    }

    attachTaskButtons();
    attachBlockRemovalButtons();
}

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

function renderTaskBlock(task) {
    const completedStyle = task.completed ? 'style="opacity: 0.4;"' : '';
    const buttonState = task.completed ? 'disabled' : '';
    return `
        <div class="task-entry" ${completedStyle}>
            <span class="task-name" style="${task.completed ? 'text-decoration: line-through; color: var(--text-dim);' : ''}">
                ${task.name} <span style="font-size: 0.8rem; color: var(--text-dim);">(${task.duration} min)</span>
            </span>
            <div class="task-controls">
                <button class="play-btn" data-id="${task.id}" title="Play music" ${buttonState}>▶</button>
                <button class="complete-btn" data-id="${task.id}" title="Complete task" ${buttonState}>✓</button>
            </div>
        </div>
    `;
}

function formatTime(hour, min) {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    return `${h}:${String(min).padStart(2, "0")} ${ampm}`;
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

            // Reward metrics updates
            showRewardMessage(taskPriority);
            increaseEmotionMeter(taskPriority);
            
            // Refresh table and main calendar cell previews
            const activeDate = document.getElementById("selectedDateHeading").textContent;
            const schedules = JSON.parse(localStorage.getItem("fgSchedules")) || {};
            buildScheduleTable(schedules[activeDate]?.tasks || []);
            renderCalendar();
        });
    });

    document.querySelectorAll(".play-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id);
            const musicType = getTaskMusicType(id);
    
            // Scenario A: Custom playlist (Not implemented yet)
            if (musicType !== "default") {
                alert("Playing from your playlist. To be implemented later.");
                return; 
            }
    
            // Scenario B: Default track selection
            // Determine which track to play based on the task's ID index
            const trackIndex = id % audioFiles.length;
            const selectedTrackSrc = audioFiles[trackIndex];
    
            // 1. If clicking the SAME button that is already active -> Toggle Play/Pause
            if (currentPlayingId === id && currentAudio) {
                if (currentAudio.paused) {
                    currentAudio.play();
                } else {
                    currentAudio.pause();
                }
                return;
            }
    
            // 2. If a DIFFERENT button was clicked while audio was playing -> Stop old audio
            if (currentAudio) {
                currentAudio.pause();
                // Reset previous button's text to "Play" if needed
                const prevBtn = document.querySelector(`.play-btn[data-id="${currentPlayingId}"]`);
            }
    
            // 3. Setup and play the new audio track
            currentAudio = new Audio(selectedTrackSrc);
            currentPlayingId = id;
            currentAudio.play();
    
            // Reset button UI automatically when the track finishes playing naturally
            currentAudio.addEventListener("ended", () => {
                currentAudio = null;
                currentPlayingId = null;
            });
        });
    });
}

/* STATE MUTATORS */
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

async function showRewardMessage(priority) {
    const amount = getRewardByPriority(priority);
    const toast = document.getElementById("rewardToast");
    if (!toast) return;

    const message = rewardMessages[Math.floor(Math.random() * rewardMessages.length)];
    toast.textContent = `${message} +$${amount.toFixed(2)}!`;
    toast.classList.add("show");

    // Add money and update display
    balance += amount;
    localStorage.setItem("fgBalance", balance);
    updateStatsDisplay();

    // Firestore Sync
    if (window.firebaseHelper) {
        await window.firebaseHelper.syncLocalToFirebase();
    }

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

function updateStatsDisplay() {
    const balanceDisplay = document.getElementById("balanceDisplay");
    if (balanceDisplay) {
        balanceDisplay.textContent = `$${balance.toFixed(2)}`;
    }
    
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
    const boosts = { "high": 15, "medium": 8, "low": 4 };
    const amount = boosts[priority.toLowerCase()] || 8;
    emotionLevel = Math.min(100, emotionLevel + amount);
    localStorage.setItem("fgEmotionLevel", emotionLevel);
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
    coin.textContent = "🪙";
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

document.addEventListener('DOMContentLoaded', () => {
  // 1. Select the necessary DOM elements
  const noteTakingBtn = document.getElementById('notetaking');
  const modalOverlay = document.querySelector('.modalNotes-overlay');
  const modalContainer = document.querySelector('.modalNotes-container');
  const textarea = document.querySelector('.modalNotes-input');
  const cancelBtn = document.querySelector('.modalNotes-cancel');
  const finishBtn = document.querySelector('.modalNotes-finish');

  // Key used to store and retrieve data from localStorage
  const STORAGE_KEY = 'taskNotesData';

  // 2. Renamed function to open the notes modal
  function openNotesModal() {
    // Load existing notes from localStorage if they exist
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        textarea.value = parsedData.notes || '';
      } catch (e) {
        console.error("Error parsing JSON from localStorage", e);
      }
    } else {
      textarea.value = ''; // Clear if no saved data exists
    }

    // Display the modal using flex layout
    modalOverlay.style.display = 'flex';
    modalContainer.style.display = 'flex';
  }

  // 3. Renamed function to close the notes modal without saving
  function closeNotesModal() {
    modalOverlay.style.display = 'none';
    modalContainer.style.display = 'none';
  }

  // 4. Renamed function to save notes text to JSON and close
  function saveAndCloseNotesModal() {
    const notesPayload = {
      notes: textarea.value,
      updatedAt: new Date().toISOString()
    };

    // Save the object as a JSON string
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesPayload));
    
    // Close the modal using the newly renamed function
    closeNotesModal();
  }

  // 5. Event Listeners utilizing the new function names
  if (noteTakingBtn) {
    noteTakingBtn.addEventListener('click', openNotesModal);
  } else {
    console.warn("Element with ID 'notetaking' was not found on the page.");
  }

  cancelBtn.addEventListener('click', closeNotesModal);
  finishBtn.addEventListener('click', saveAndCloseNotesModal);

  // Close modal if user clicks on the background overlay itself
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeNotesModal();
    }
  });
});
