const playlistContainer = document.getElementById("playlist");
const modal = document.getElementById("songModal");
const addSongBtn = document.getElementById("addSongBtn");
const saveSongBtn = document.getElementById("saveSong");
const cancelSongBtn = document.getElementById("cancelSong");
let currentlyPlaying = null;
let currentPlayIndex = null;

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

/* PLAY AUDIO */
window.togglePlay = function(index) {
    const songs = getPlaylist();
    const song = songs[index];

    if (song.type !== "audio") {
        alert("YouTube link saved! External media players integration coming soon. Use local MP3 files for instant playback.");
        return;
    }

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
