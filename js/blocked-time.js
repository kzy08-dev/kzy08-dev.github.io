/*
=====================================
BLOCKED TIME MANAGER
Handles marking time as unavailable
=====================================
*/

document.addEventListener("DOMContentLoaded", () => {
    setupBlockedTimeModal();
});

function setupBlockedTimeModal() {
    const blockTimeBtn = document.getElementById("blockTime");
    const modalBackdrop = document.querySelector(".modalSchedule-backdrop");
    const form = document.getElementById("unavailabilitySchedule-Form");
    const typeRadios = document.querySelectorAll('input[name="unavailabilitySchedule-Type"]');

    if (blockTimeBtn) {
        blockTimeBtn.addEventListener("click", () => {
            modalBackdrop.style.display = "flex";
            resetBlockedTimeForm();
        });
    }

    // Toggle visibility of specific date vs recurring sections
    typeRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            const specificSection = document.getElementById("specificDateSchedule-Section");
            const recurringSection = document.getElementById("recurringSchedule-Section");

            if (e.target.value === "specific") {
                specificSection.style.display = "block";
                recurringSection.style.display = "none";
            } else {
                specificSection.style.display = "none";
                recurringSection.style.display = "block";
            }
        });
    });

    // Form submission
    if (form) {
        form.addEventListener("submit", handleBlockedTimeSubmit);
    }

    // Close modal when clicking outside
    modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) {
            modalBackdrop.style.display = "none";
        }
    });
}

function resetBlockedTimeForm() {
    const form = document.getElementById("unavailabilitySchedule-Form");
    const specificSection = document.getElementById("specificDateSchedule-Section");
    const recurringSection = document.getElementById("recurringSchedule-Section");
    
    form.reset();
    
    // Reset to "specific" type
    document.querySelector('input[name="unavailabilitySchedule-Type"][value="specific"]').checked = true;
    specificSection.style.display = "block";
    recurringSection.style.display = "none";
}

async function handleBlockedTimeSubmit(e) {
    e.preventDefault();

    const type = document.querySelector('input[name="unavailabilitySchedule-Type"]:checked').value;
    const startTime = document.getElementById("startTimeSchedule-Input").value;
    const endTime = document.getElementById("endTimeSchedule-Input").value;

    // Validate time fields
    if (!startTime || !endTime) {
        alert("Please enter both start and end times.");
        return;
    }

    // Convert time to minutes for storage
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes >= endMinutes) {
        alert("End time must be after start time.");
        return;
    }

    let blockRecord = {
        type,
        start: startMinutes,
        end: endMinutes,
        createdAt: new Date().toISOString()
    };

    if (type === "specific") {
        const date = document.getElementById("specificDateSchedule-Input").value;
        if (!date) {
            alert("Please select a date.");
            return;
        }
        blockRecord.date = date;
    } else if (type === "recurring") {
        const startDate = document.getElementById("recurringStartDateSchedule-Input").value;
        if (!startDate) {
            alert("Please select a start date.");
            return;
        }

        const frequency = document.getElementById("frequencySchedule-Select").value;
        const dayCheckboxes = document.querySelectorAll(".weekdaySchedule-picker input[type='checkbox']:checked");
        
        if (dayCheckboxes.length === 0) {
            alert("Please select at least one day.");
            return;
        }

        const days = Array.from(dayCheckboxes).map(cb => cb.value);
        blockRecord.frequency = frequency;
        blockRecord.days = days;
        blockRecord.startDate = startDate;
    }

    // Save to localStorage
    let blocked = JSON.parse(localStorage.getItem("fgBlockedTime")) || [];
    blocked.push(blockRecord);
    localStorage.setItem("fgBlockedTime", JSON.stringify(blocked));

    // Sync to Firebase
    if (window.firebaseHelper) {
        await window.firebaseHelper.syncLocalToFirebase();
    }

    alert("Time blocked successfully!");
    document.querySelector(".modalSchedule-backdrop").style.display = "none";
    
    // Refresh calendar to show updates
    if (window.renderCalendar) {
        window.renderCalendar();
    }
}

// Utility function: Convert minutes to time string (HH:MM)
function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// Utility function: Convert time string to minutes
function timeToMinutes(timeStr) {
    const [hours, mins] = timeStr.split(":").map(Number);
    return hours * 60 + mins;
}

// Get day name from full date string (e.g., "2026-06-08" -> "mon")
function getDayNameFromDate(dateStr) {
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return dayNames[date.getDay()];
}

// Check if time slot is blocked for a specific date
function isTimeBlockedForDate(date, startMinutes, endMinutes) {
    const blocked = JSON.parse(localStorage.getItem("fgBlockedTime")) || [];
    
    for (let block of blocked) {
        // Specific date block
        if (block.type === "specific" && block.date === date) {
            // Check for overlap
            if (!(endMinutes <= block.start || startMinutes >= block.end)) {
                return true;
            }
        }

        // Recurring block
        if (block.type === "recurring") {
            const dayName = getDayNameFromDate(date);
            const shortDayMap = {
                "sun": "SU",
                "mon": "M",
                "tue": "T",
                "wed": "W",
                "thu": "TH",
                "fri": "F",
                "sat": "SA"
            };
            const dayCode = shortDayMap[dayName];
            
            if (block.days.includes(dayCode)) {
                // Check if date falls on the correct frequency cycle
                if (isDateInRecurringCycle(date, block.startDate, block.frequency)) {
                    // Check for time overlap
                    if (!(endMinutes <= block.start || startMinutes >= block.end)) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

// Check if a date/time is exempt from a recurring block
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
