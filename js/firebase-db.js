// Firebase CDN SDK Initialization (v10.8.0 Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// FIREBASE CONFIGURATION
// Replace these settings with your own keys!
// ==========================================
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCgkcXDiAtly8AgZQE3R9oKabxUa2034Tk",
  authDomain: "feral-gremlin-app.firebaseapp.com",
  projectId: "feral-gremlin-app",
  storageBucket: "feral-gremlin-app.firebasestorage.app",
  messagingSenderId: "607067490505",
  appId: "1:607067490505:web:a3ca4ed073ada53bfda518"
};

// Initialize Firebase
let app;
let auth;
let db;
let isConfigured = false;

try {
    // Basic validation to see if the user replaced placeholders
    if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_API_KEY")) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isConfigured = true;
        console.log("Firebase initialized successfully!");
    } else {
        console.warn("Firebase is running in DEMO mode. Fill in firebaseConfig in js/firebase-db.js to enable cloud database sync.");
    }
} catch (e) {
    console.error("Firebase failed to initialize:", e);
}

// Global helper object attached to window
window.firebaseHelper = {
    isConfigured: isConfigured,
    currentUser: null,
    
    // Auth Operations
    async signUp(email, password, username) {
        if (!isConfigured) return this.localSignUp(username);
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Create user document with initial data
            const initialData = {
                uid: user.uid,
                email: user.email,
                username: username || "User",
                balance: 10.00,
                petName: "Buddy",
                petChoice: "puppy",
                emotionLevel: 50,
                schedules: {},
                playlist: [],
                purchasedItems: [],
                equippedItems: { Clothing: null, Toy: null, Food: null },
                createdAt: new Date().toISOString()
            };
            
            await setDoc(doc(db, "users", user.uid), initialData);
            this.writeLocalData(initialData);
            return { success: true, user };
        } catch (error) {
            console.error("Sign up error:", error);
            return { success: false, error: error.message };
        }
    },
    
    async login(email, password) {
        if (!isConfigured) return this.localLogin(email);
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await this.syncFirebaseToLocal(user.uid);
            return { success: true, user };
        } catch (error) {
            console.error("Login error:", error);
            return { success: false, error: error.message };
        }
    },
    
    async logout() {
        if (isConfigured) {
            await signOut(auth);
        }
        this.clearLocalData();
        window.location.href = "./login.html";
    },

    // Offline / Demo Fallbacks
    localSignUp(username) {
        const initialData = {
            username: username || "User",
            balance: 10.00,
            petName: "Buddy",
            petChoice: "puppy",
            emotionLevel: 50,
            schedules: {},
            playlist: [],
            purchasedItems: [],
            equippedItems: { Clothing: null, Toy: null, Food: null }
        };
        this.writeLocalData(initialData);
        localStorage.setItem("fgIsDemo", "true");
        return { success: true, user: { email: "demo@feralgremlin.com", uid: "demo-user" } };
    },

    localLogin(email) {
        localStorage.setItem("fgIsDemo", "true");
        return { success: true, user: { email: email, uid: "demo-user" } };
    },

    // Sync helpers
    async syncLocalToFirebase() {
        if (!isConfigured || !this.currentUser) return;
        
        try {
            const data = {
                username: localStorage.getItem("fgUsername") || "User",
                balance: Number(localStorage.getItem("fgBalance")) || 10,
                petName: localStorage.getItem("fgPetName") || "Buddy",
                petChoice: localStorage.getItem("fgPetChoice") || "puppy",
                emotionLevel: Number(localStorage.getItem("fgEmotionLevel")) || 50,
                schedules: JSON.parse(localStorage.getItem("fgSchedules")) || {},
                playlist: JSON.parse(localStorage.getItem("feralGremlinPlaylist")) || [],
                purchasedItems: JSON.parse(localStorage.getItem("fgPurchasedItems")) || [],
                equippedItems: JSON.parse(localStorage.getItem("fgEquippedItems")) || { Clothing: null, Toy: null, Food: null }
            };
            
            await updateDoc(doc(db, "users", this.currentUser.uid), data);
            console.log("Data synced to Firebase!");
        } catch (e) {
            console.error("Error syncing local to Firebase:", e);
        }
    },

    async syncFirebaseToLocal(uid) {
        if (!isConfigured) return;
        try {
            const docSnap = await getDoc(doc(db, "users", uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                this.writeLocalData(data);
                console.log("Data loaded from Firebase and saved to localStorage.");
            } else {
                // If doc doesn't exist yet, write current local storage
                await this.syncLocalToFirebase();
            }
        } catch (e) {
            console.error("Error syncing Firebase to Local:", e);
        }
    },

    writeLocalData(data) {
        localStorage.setItem("fgUsername", data.username || "User");
        localStorage.setItem("fgBalance", data.balance !== undefined ? data.balance : 10);
        localStorage.setItem("fgPetName", data.petName || "Buddy");
        localStorage.setItem("fgPetChoice", data.petChoice || "puppy");
        localStorage.setItem("fgEmotionLevel", data.emotionLevel !== undefined ? data.emotionLevel : 50);
        localStorage.setItem("fgSchedules", JSON.stringify(data.schedules || {}));
        localStorage.setItem("feralGremlinPlaylist", JSON.stringify(data.playlist || []));
        localStorage.setItem("fgPurchasedItems", JSON.stringify(data.purchasedItems || []));
        localStorage.setItem("fgEquippedItems", JSON.stringify(data.equippedItems || { Clothing: null, Toy: null, Food: null }));
    },

    clearLocalData() {
        localStorage.removeItem("fgUsername");
        localStorage.removeItem("fgBalance");
        localStorage.removeItem("fgPetName");
        localStorage.removeItem("fgPetChoice");
        localStorage.removeItem("fgEmotionLevel");
        localStorage.removeItem("fgSchedules");
        localStorage.removeItem("feralGremlinPlaylist");
        localStorage.removeItem("fgPurchasedItems");
        localStorage.removeItem("fgEquippedItems");
        localStorage.removeItem("fgIsDemo");
    },

    // Reactive hooks
    onAuth(callback) {
        if (!isConfigured) {
            // Demo mode auth hook
            setTimeout(() => {
                const isDemo = localStorage.getItem("fgIsDemo") === "true";
                if (isDemo) {
                    this.currentUser = { email: "demo@feralgremlin.com", uid: "demo-user" };
                    callback(this.currentUser);
                } else {
                    callback(null);
                }
            }, 100);
            return;
        }

        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;
            if (user) {
                await this.syncFirebaseToLocal(user.uid);
            }
            callback(user);
        });
    }
};
