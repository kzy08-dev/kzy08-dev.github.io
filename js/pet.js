// store database with emojis and pricing
const storeItems = [
    // CLOTHES
    { name: "Blue Cap", category: "Clothing", price: 4.00, emoji: "🧢", description: "Cool blue sports cap" },
    { name: "Warm Scarf", category: "Clothing", price: 6.00, emoji: "🧣", description: "Cozy red knitted scarf" },
    { name: "Tiny Crown", category: "Clothing", price: 15.00, emoji: "👑", description: "For the royal gremlin" },
    { name: "Cool Shades", category: "Clothing", price: 20.00, emoji: "🕶️", description: "Vibrant neon sunglasses" },
    
    // TOYS
    { name: "Tennis Ball", category: "Toy", price: 3.00, emoji: "🎾", description: "A bouncing yellow ball" },
    { name: "Rope Toy", category: "Toy", price: 5.00, emoji: "🪢", description: "Sturdy braided rope for tugging" },
    { name: "Squeaky Duck", category: "Toy", price: 8.50, emoji: "🦆", description: "Makes a loud squeak!" },
    { name: "Neon Frisbee", category: "Toy", price: 12.00, emoji: "🥏", description: "Flies far in the yard" },

    // FOOD
    { name: "Yummy Kibble", category: "Food", price: 2.00, emoji: "🍪", description: "Tasty baked treats" },
    { name: "Juicy Bone", category: "Food", price: 5.50, emoji: "🍖", description: "Delicious bone to chew on" },
    { name: "Chicken Drumstick", category: "Food", price: 9.00, emoji: "🍗", description: "Crispy chicken snack" },
    { name: "Gourmet Steak", category: "Food", price: 18.00, emoji: "🥩", description: "High-grade premium steak" }
];

let balance = Number(localStorage.getItem("fgBalance")) || 10.00;
let emotionLevel = Number(localStorage.getItem("fgEmotionLevel")) || 50;
let petChoice = localStorage.getItem("fgPetChoice") || "puppy";
let purchasedItems = JSON.parse(localStorage.getItem("fgPurchasedItems")) || [];
let equippedItems = JSON.parse(localStorage.getItem("fgEquippedItems")) || { Clothing: null, Toy: null, Food: null };

document.addEventListener("DOMContentLoaded", () => {
    initializePetPage();

    // Listen for Firestore sync events
    window.addEventListener("fg-data-synced", () => {
        balance = Number(localStorage.getItem("fgBalance")) || 10.00;
        emotionLevel = Number(localStorage.getItem("fgEmotionLevel")) || 50;
        petChoice = localStorage.getItem("fgPetChoice") || "puppy";
        purchasedItems = JSON.parse(localStorage.getItem("fgPurchasedItems")) || [];
        equippedItems = JSON.parse(localStorage.getItem("fgEquippedItems")) || { Clothing: null, Toy: null, Food: null };
        
        initializePetName();
        updateStatsDisplay();
        updatePetSelectorUI();
        updatePetAppearance();
        renderStore();
    });
});

function initializePetPage() {
    initializePetName();
    updateStatsDisplay();
    updatePetSelectorUI();
    updatePetAppearance();
    renderStore();
    setupPetSelectors();
    setupEquipmentToggles();
}

/* SET SELECTOR HIGHLIGHTS & BEHAVIOR */
function setupPetSelectors() {
    const buttons = document.querySelectorAll(".pet-opt-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", async () => {
            const selectedPet = btn.dataset.pet;
            petChoice = selectedPet;
            localStorage.setItem("fgPetChoice", selectedPet);
            
            updatePetSelectorUI();
            updatePetAppearance();
            playEquipChime(600); // feedback beep
            
            // Sync choices to Firebase
            if (window.firebaseHelper) {
                await window.firebaseHelper.syncLocalToFirebase();
            }
        });
    });
}

function updatePetSelectorUI() {
    const buttons = document.querySelectorAll(".pet-opt-btn");
    buttons.forEach(btn => {
        if (btn.dataset.pet === petChoice) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

/* UPDATE PET IMAGE AND EMOJI OVERLAYS */
function updatePetAppearance() {
    const petImage = document.getElementById("petImage");
    if (!petImage) return;

    // Load active image
    petImage.src = `assets/images/${petChoice}.png`;
    petImage.alt = petChoice;

    // Render Equipped Emojis
    const clothingOverlay = document.getElementById("clothingOverlay");
    const toyOverlay = document.getElementById("toyOverlay");
    const foodOverlay = document.getElementById("foodOverlay");

    if (clothingOverlay) {
        const item = storeItems.find(i => i.name === equippedItems.Clothing);
        clothingOverlay.textContent = item ? item.emoji : "";
    }
    if (toyOverlay) {
        const item = storeItems.find(i => i.name === equippedItems.Toy);
        toyOverlay.textContent = item ? item.emoji : "";
    }
    if (foodOverlay) {
        const item = storeItems.find(i => i.name === equippedItems.Food);
        foodOverlay.textContent = item ? item.emoji : "";
    }

    // Refresh quick toggles active state
    updateEquipmentToggleButtons();
}

/* QUICK TOGGLES FOR ACCESSORIES */
function setupEquipmentToggles() {
    document.getElementById("clothingEquipBtn").addEventListener("click", () => toggleCategory("Clothing"));
    document.getElementById("toyEquipBtn").addEventListener("click", () => toggleCategory("Toy"));
    document.getElementById("foodEquipBtn").addEventListener("click", () => toggleCategory("Food"));
}

function toggleCategory(category) {
    // Find purchased items in this category
    const owned = storeItems.filter(item => item.category === category && purchasedItems.includes(item.name));
    
    if (owned.length === 0) {
        alert(`🛒 You don't own any items in the '${category}' category yet! Buy some from the shop.`);
        return;
    }

    const currentEquipped = equippedItems[category];
    
    if (currentEquipped) {
        // Unequip
        equippedItems[category] = null;
        playEquipChime(350);
    } else {
        // Equip the first owned item
        equippedItems[category] = owned[0].name;
        playEquipChime(800);
    }

    saveAndSyncEquipment();
}

function updateEquipmentToggleButtons() {
    const clothingBtn = document.getElementById("clothingEquipBtn");
    const toyBtn = document.getElementById("toyEquipBtn");
    const foodBtn = document.getElementById("foodEquipBtn");

    if (clothingBtn) {
        clothingBtn.classList.toggle("equipped", !!equippedItems.Clothing);
        clothingBtn.textContent = equippedItems.Clothing ? "👕 Take Off Clothes" : "👕 Wear Clothing";
    }
    if (toyBtn) {
        toyBtn.classList.toggle("equipped", !!equippedItems.Toy);
        toyBtn.textContent = equippedItems.Toy ? "🧸 Hide Toy" : "🧸 Play with Toy";
    }
    if (foodBtn) {
        foodBtn.classList.toggle("equipped", !!equippedItems.Food);
        foodBtn.textContent = equippedItems.Food ? "🍖 Take Away Food" : "🍖 Eat Food";
    }
}

async function saveAndSyncEquipment() {
    localStorage.setItem("fgEquippedItems", JSON.stringify(equippedItems));
    updatePetAppearance();

    if (window.firebaseHelper) {
        await window.firebaseHelper.syncLocalToFirebase();
    }
}

/* RENDER STORE ITEMS */
function renderStore() {
    const storeContainer = document.getElementById("storeContainer");
    if (!storeContainer) return;
    storeContainer.innerHTML = "";

    storeItems.forEach(item => {
        const isOwned = purchasedItems.includes(item.name);
        const isEquipped = equippedItems[item.category] === item.name;

        const card = document.createElement("div");
        card.className = "store-item";

        let buttonHTML = "";
        if (!isOwned) {
            buttonHTML = `<button class="buy-btn" onclick="buyItem('${item.name}')">Buy</button>`;
        } else {
            buttonHTML = `<button class="buy-btn ${isEquipped ? 'purchased' : ''}" onclick="toggleEquip('${item.name}')">
                ${isEquipped ? 'Unequip' : 'Equip'}
            </button>`;
        }

        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="font-size: 2.2rem; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 10px; width: 55px; text-align: center;">${item.emoji}</div>
                <div class="store-info">
                    <strong>${item.name}</strong>
                    <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 3px;">${item.description}</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="store-price">$${item.price.toFixed(2)}</div>
                ${buttonHTML}
            </div>
        `;
        storeContainer.appendChild(card);
    });
}

/* ACTION HANDLERS EXPOSED TO WINDOW */
window.buyItem = async function(itemName) {
    const item = storeItems.find(i => i.name === itemName);
    if (!item) return;

    if (balance < item.price) {
        alert("❌ Not enough balance! Complete tasks on your calendar to earn money.");
        return;
    }

    balance -= item.price;
    purchasedItems.push(item.name);
    
    // Play happy audio chime
    playBuyChime();

    // Auto-equip bought item
    equippedItems[item.category] = item.name;

    localStorage.setItem("fgBalance", balance);
    localStorage.setItem("fgPurchasedItems", JSON.stringify(purchasedItems));
    localStorage.setItem("fgEquippedItems", JSON.stringify(equippedItems));
    
    updateStatsDisplay();
    updatePetAppearance();
    renderStore();

    if (window.firebaseHelper) {
        await window.firebaseHelper.syncLocalToFirebase();
    }

    alert(`🎉 Success! You bought and equipped the ${item.name}.`);
};

window.toggleEquip = async function(itemName) {
    const item = storeItems.find(i => i.name === itemName);
    if (!item) return;

    const isEquipped = equippedItems[item.category] === item.name;
    if (isEquipped) {
        equippedItems[item.category] = null;
        playEquipChime(350);
    } else {
        equippedItems[item.category] = item.name;
        playEquipChime(800);
    }

    await saveAndSyncEquipment();
    renderStore();
};

/* DISPLAY REFRESH */
function updateStatsDisplay() {
    const balanceDisplay = document.getElementById("balanceDisplay");
    if (balanceDisplay) {
        balanceDisplay.textContent = `$${balance.toFixed(2)}`;
    }

    const emotionFill = document.getElementById("emotionFill");
    const emotionNumber = document.getElementById("emotionNumber");
    if (emotionNumber) {
        emotionNumber.textContent = emotionLevel;
    }
    if (emotionFill) {
        emotionFill.style.width = `${emotionLevel}%`;
    }
}

/* PETNAME EDITABLE FIELD */
function initializePetName() {
    const petNameInput = document.getElementById("petName");
    if (!petNameInput) return;

    petNameInput.value = localStorage.getItem("fgPetName") || "Buddy";

    // Auto-resize input to text length
    petNameInput.style.width = ((petNameInput.value.length + 1) * 15) + "px";

    petNameInput.addEventListener("input", () => {
        petNameInput.style.width = ((petNameInput.value.length + 1) * 15) + "px";
    });

    petNameInput.addEventListener("blur", async () => {
        const newName = petNameInput.value.trim() || "Buddy";
        petNameInput.value = newName;
        localStorage.setItem("fgPetName", newName);

        if (window.firebaseHelper) {
            await window.firebaseHelper.syncLocalToFirebase();
        }
    });
}

/* AUDIO SYNTHESIZERS */
function playBuyChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc1.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        osc1.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6

        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(261.63, audioCtx.currentTime); // C4
        osc2.frequency.setValueAtTime(329.63, audioCtx.currentTime + 0.1); // E4
        osc2.frequency.setValueAtTime(392.00, audioCtx.currentTime + 0.2); // G4
        osc2.frequency.setValueAtTime(523.25, audioCtx.currentTime + 0.3); // C5

        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 0.6);
        osc2.stop(audioCtx.currentTime + 0.6);
    } catch (e) {}
}

function playEquipChime(freq) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
}
