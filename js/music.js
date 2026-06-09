const playlistContainer = document.getElementById("playlist");
const modal = document.getElementById("songModal");
const addSongBtn = document.getElementById("addSongBtn");
const saveSongBtn = document.getElementById("saveSong");
const cancelSongBtn = document.getElementById("cancelSong");
let currentlyPlaying = null;
let currentPlayIndex = null;
let currentYouTubeIframe = null;

// Listen for Firebase sync
window.addEventListener("fg-data-synced", () => {
    renderPlaylist();
});

/* LOAD PLAYLIST */
function getPlaylist() {
    return JSON.parse(localStorage.getItem("feralGremlinPlaylist")) || [];
}

function savePlaylist(list) {
    localStorage.setItem("feralGremlinPlaylist", JSON.stringify(list));
    
    // Cloud Sync
    if (window.firebaseHelper) {
        window.firebaseHelper.syncLocalToFirebase();
    }
}

function renderPlaylist() {
    if (!playlistContainer) return;
    const songs = getPlaylist();
    playlistContainer.innerHTML = "";
    
    if (songs.length === 0) {
        playlistContainer.innerHTML = `
            <p style="text-align: center; color: var(--text-dim); padding: 20px;">No custom focus sounds added yet.</p>
        `;
        return;
    }

    songs.forEach((song, index) => {
        const isPlaying = currentlyPlaying && currentPlayIndex === index;
        const songCard = document.createElement("div");
        const isYouTubePlaying = currentYouTubeIframe && currentPlayIndex === index;
        songCard.classList.add("song-card");
        songCard.innerHTML = `
            <div class="song-info">
                <strong>${index + 1}. ${song.name}</strong>
                <span style="font-size: 0.8rem; color: var(--text-dim); margin-left: 10px;">(${song.type === 'audio' ? 'Uploaded' : 'YouTube Link'})</span>
            </div>

            <div class="song-controls">
                <button class="playMusic-btn" onclick="togglePlay(${index})">
                    ${isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>

                <button class="deleteMusic-btn" onclick="deleteSong(${index})">
                    🗑 Delete
                </button>
            </div>
        `;
        playlistContainer.appendChild(songCard);
    });
}

/* MODAL TOGGLES */
if (addSongBtn) {
    addSongBtn.addEventListener("click", () => {
        modal.classList.remove("hidden");
        document.getElementById("songName").focus();
    });
}

if (cancelSongBtn) {
    cancelSongBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        clearInputs();
    });
}

/* SAVE SONG */
if (saveSongBtn) {
    saveSongBtn.addEventListener("click", () => {
        const songName = document.getElementById("songName").value.trim();
        const youtubeLink = document.getElementById("youtubeLink").value.trim();
        const audioFile = document.getElementById("audioFile").files[0];

        if (!songName) {
            alert("Please enter a sound name.");
            return;
        }

        const playlist = getPlaylist();

        if (audioFile) {
            // Check size (keep it small for local/db sync, limit to 8MB)
            if (audioFile.size > 8 * 1024 * 1024) {
                alert("Please upload a file smaller than 8MB to ensure storage limits are respected.");
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(event) {
                playlist.push({
                    name: songName,
                    type: "audio",
                    source: event.target.result
                });

                savePlaylist(playlist);
                renderPlaylist();
                modal.classList.add("hidden");
                clearInputs();
            };

            reader.readAsDataURL(audioFile);
            return;
        }

        if (youtubeLink) {
            playlist.push({
                name: songName,
                type: "youtube",
                source: youtubeLink
            });

            savePlaylist(playlist);
            renderPlaylist();
            modal.classList.add("hidden");
            clearInputs();
            return;
        }

        alert("Please upload an audio file or enter a YouTube link.");
    });
}

/* PLAY AUDIO & YOUTUBE */
window.togglePlay = function(index) {
    const songs = getPlaylist();
    const song = songs[index];

    // NEW: Handle YouTube links
    if (song.type === "youtube") {
        // If this YouTube link is already playing, toggle pause
        if (currentYouTubeIframe && currentPlayIndex === index) {
            const isPlaying = currentYouTubeIframe.dataset.isPlaying === "true";
            if (isPlaying) {
                // Pause by stopping the iframe
                currentYouTubeIframe.src = ""; // Clear src to stop playback
                currentYouTubeIframe.dataset.isPlaying = "false";
            } else {
                // Resume by reloading the iframe
                const src = song.source.includes("?") 
                    ? song.source + "&autoplay=1&controls=0" 
                    : song.source + "?autoplay=1&controls=0";
                currentYouTubeIframe.src = src;
                currentYouTubeIframe.dataset.isPlaying = "true";
            }
            renderPlaylist();
            return;
        }

        // Stop any currently playing audio
        if (currentlyPlaying) {
            currentlyPlaying.pause();
            currentlyPlaying = null;
        }

        // Remove any previously playing YouTube iframe
        if (currentYouTubeIframe) {
            currentYouTubeIframe.remove();
        }

        // Create new hidden iframe for YouTube
        currentYouTubeIframe = document.createElement("iframe");
        currentYouTubeIframe.style.width = "0";
        currentYouTubeIframe.style.height = "0";
        currentYouTubeIframe.style.border = "none";
        
        // Check if URL already has query parameters
        const src = song.source.includes("?") 
            ? song.source + "&autoplay=1&controls=0" 
            : song.source + "?autoplay=1&controls=0";
        
        currentYouTubeIframe.src = src;
        currentYouTubeIframe.allow = "autoplay";
        currentYouTubeIframe.dataset.isPlaying = "true";
        
        document.body.appendChild(currentYouTubeIframe);
        currentPlayIndex = index;
        renderPlaylist();
        return;
    }

    // Original audio playback logic
    if (currentlyPlaying && currentPlayIndex === index) {
        // Toggle Pause
        if (currentlyPlaying.paused) {
            currentlyPlaying.play();
        } else {
            currentlyPlaying.pause();
        }
        renderPlaylist();
        return;
    }

    if (currentlyPlaying) {
        currentlyPlaying.pause();
    }

    // NEW: Remove any playing YouTube iframe when switching to audio
    if (currentYouTubeIframe) {
        currentYouTubeIframe.remove();
        currentYouTubeIframe = null;
    }

    try {
        currentlyPlaying = new Audio(song.source);
        currentPlayIndex = index;
        
        currentlyPlaying.addEventListener("ended", () => {
            currentlyPlaying = null;
            currentPlayIndex = null;
            renderPlaylist();
        });

        currentlyPlaying.play();
        renderPlaylist();
    } catch (e) {
        alert("Unable to play this audio file. Please ensure it is a valid format.");
    }
};

/* DELETE SONG */
window.deleteSong = function(index) {
    if (!confirm("Are you sure you want to delete this sound?")) return;
    
    const songs = getPlaylist();

    if (currentlyPlaying && currentPlayIndex === index) {
        currentlyPlaying.pause();
        currentlyPlaying = null;
        currentPlayIndex = null;
    } else if (currentlyPlaying && currentPlayIndex > index) {
        currentPlayIndex--;
    }

    // NEW: Clean up YouTube iframe if deleting the currently playing YouTube song
    if (currentYouTubeIframe && currentPlayIndex === index) {
        currentYouTubeIframe.remove();
        currentYouTubeIframe = null;
        currentPlayIndex = null;
    } else if (currentYouTubeIframe && currentPlayIndex > index) {
        currentPlayIndex--;
    }
    
    songs.splice(index, 1);
    savePlaylist(songs);
    renderPlaylist();
};

function clearInputs() {
    document.getElementById("songName").value = "";
    document.getElementById("youtubeLink").value = "";
    document.getElementById("audioFile").value = "";
}

// Initial render
renderPlaylist();
