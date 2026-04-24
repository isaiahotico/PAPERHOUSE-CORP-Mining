
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "facebook-follow-to-follow.firebaseapp.com",
    databaseURL: "https://facebook-follow-to-follow-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facebook-follow-to-follow",
    storageBucket: "facebook-follow-to-follow.firebasestorage.app",
    messagingSenderId: "589427984313",
    appId: "1:589427984313:web:a17b8cc851efde6dd79868"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentUser = null;
let userData = {};

const FLOWER_TYPES = {
    sampaguita: { cost: 50, roi: 55, duration: 7 * 24 * 60 * 60 * 1000, icon: '🌸' },
    rose: { cost: 100, roi: 110, duration: 7 * 24 * 60 * 60 * 1000, icon: '🌹' }
};

const MAX_ACCUMULATION = 3 * 60 * 60 * 1000; // 3 hours pause limit

// --- UI TOGGLE ---
function toggleMenu() {
    const menu = document.getElementById('sidebar-menu');
    const overlay = document.getElementById('menu-overlay');
    const mainNav = document.getElementById('main-nav');
    
    menu.classList.toggle('open');
    overlay.classList.toggle('opacity-50');
    overlay.classList.toggle('pointer-events-auto');
    mainNav.classList.toggle('hidden');
}

// --- SYSTEM CLOCK & AUTO HARVEST ---
setInterval(() => {
    document.getElementById('footer-time').innerText = new Date().toLocaleString();
    if (userData.guardEngineerUntil > Date.now()) {
        autoHarvestLogic();
    }
}, 1000);

// --- AUTH ---
function login() {
    const user = document.getElementById('username').value.trim().toLowerCase();
    const refBy = document.getElementById('ref-input').value.trim().toUpperCase();
    if (!user) return alert("Enter username");

    currentUser = user.replace(/[^a-z0-9]/g, "");
    db.ref('users/' + currentUser).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            const myRef = Math.random().toString(36).substring(2, 8).toUpperCase();
            db.ref('users/' + currentUser).set({
                balance: 0,
                id: 'ID-' + Math.floor(1000+Math.random()*8999),
                refCode: myRef,
                referredBy: refBy || null,
                referralEarnings: 0,
                totalReferrals: 0,
                plants: [],
                guardEngineerUntil: 0
            });
        }
        startApp();
    });
}

function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    db.ref('users').on('value', snap => document.getElementById('total-users').innerText = snap.numChildren());
    db.ref('users/' + currentUser).on('value', (snapshot) => {
        userData = snapshot.val();
        updateUI();
    });
}

// --- UI ENGINE ---
function updateUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(2);
    document.getElementById('display-uid').innerText = "ID: " + userData.id;
    document.getElementById('my-ref-code').innerText = userData.refCode;
    document.getElementById('total-refs').innerText = userData.totalReferrals || 0;
    document.getElementById('ref-earnings').innerText = "₱" + (userData.referralEarnings || 0).toFixed(2);

    // Market Limits
    const rawPlants = userData.plants || [];
    const plantsArray = Array.isArray(rawPlants) ? rawPlants : Object.values(rawPlants);
    
    ['sampaguita', 'rose'].forEach(type => {
        const count = plantsArray.filter(p => p.type === type && !p.isFinished).length;
        document.getElementById(`btn-buy-${type}`).innerText = `BUY (${count}/10)`;
    });

    // Guard Engineer UI
    const guardBox = document.getElementById('guard-timer');
    if (userData.guardEngineerUntil > Date.now()) {
        guardBox.classList.remove('hidden');
        document.getElementById('guard-time-left').innerText = formatMs(userData.guardEngineerUntil - Date.now());
    } else { guardBox.classList.add('hidden'); }

    // Garden Rendering
    const gardenList = document.getElementById('garden-list');
    gardenList.innerHTML = "";
    
    plantsArray.forEach((plant, index) => {
        if (plant.isFinished) return;
        
        const now = Date.now();
        const expiry = plant.startTime + FLOWER_TYPES[plant.type].duration;
        const timeLeft = expiry - now;

        if (timeLeft <= 0) {
            // If plant expired, mark as finished and skip rendering
            db.ref(`users/${currentUser}/plants/${index}/isFinished`).set(true);
            return;
        }

        const timeSinceLast = now - plant.lastClaim;
        const isPaused = timeSinceLast >= MAX_ACCUMULATION && userData.guardEngineerUntil < now;
        const rate = FLOWER_TYPES[plant.type].roi / FLOWER_TYPES[plant.type].duration;
        const claimable = (Math.min(timeSinceLast, MAX_ACCUMULATION) * rate).toFixed(4);

        gardenList.innerHTML += `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${FLOWER_TYPES[plant.type].icon}</span>
                    <div>
                        <p class="text-[10px] font-black uppercase text-slate-400">${plant.type}</p>
                        <p class="text-xs font-bold text-slate-800">₱${claimable}</p>
                        <p class="text-[8px] text-slate-400">Ends in: ${formatMs(timeLeft)}</p>
                    </div>
                </div>
                <button onclick="claimFlower(${index})" class="px-4 py-2 rounded-xl text-[10px] font-bold ${isPaused ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}">
                    ${isPaused ? 'RESUME' : 'CLAIM'}
                </button>
            </div>`;
    });

    // History
    const historyDiv = document.getElementById('withdraw-history');
    historyDiv.innerHTML = "";
    if (userData.transactions) {
        Object.values(userData.transactions).filter(t => t.type === 'Withdraw').reverse().forEach(tx => {
            historyDiv.innerHTML += `
                <div class="bg-white p-3 rounded-xl flex justify-between items-center text-[10px] border border-slate-50">
                    <p class="font-bold">₱${tx.amount} (${tx.method})</p>
                    <span class="uppercase font-black ${tx.status === 'approved' ? 'text-green-500' : 'text-orange-500'}">${tx.status}</span>
                </div>`;
        });
    }
}

// --- LOGIC ---
function buyFlower(type) {
    const rawPlants = userData.plants || [];
    const plantsArray = Array.isArray(rawPlants) ? rawPlants : Object.values(rawPlants);
    const count = plantsArray.filter(p => p.type === type && !p.isFinished).length;
    
    if (count >= 10) return alert("Max 10 reached");
    if (userData.balance < FLOWER_TYPES[type].cost) return alert("Insufficient balance");

    const newPlant = { type, startTime: Date.now(), lastClaim: Date.now(), totalEarned: 0, isFinished: false };
    db.ref('users/' + currentUser + '/plants').push(newPlant);
    db.ref('users/' + currentUser + '/balance').set(userData.balance - FLOWER_TYPES[type].cost);
}

function claimFlower(index) {
    const rawPlants = userData.plants || [];
    const plantsArray = Array.isArray(rawPlants) ? rawPlants : Object.values(rawPlants);
    const plant = plantsArray[index];
    const plantKey = Object.keys(rawPlants)[index]; // Get the actual key for direct update

    const now = Date.now();
    const timeSinceLast = now - plant.lastClaim;
    const rate = FLOWER_TYPES[plant.type].roi / FLOWER_TYPES[plant.type].duration;
    const earned = Math.min(timeSinceLast, MAX_ACCUMULATION) * rate;

    show_10555663().then(() => {
        db.ref(`users/${currentUser}/plants/${plantKey}`).update({
            lastClaim: now,
            totalEarned: (plant.totalEarned || 0) + earned
        });
        db.ref(`users/${currentUser}/balance`).transaction(b => (b || 0) + earned);
    });
}

function buyGuardEngineer() {
    const rawPlants = userData.plants || [];
    const plantsArray = Array.isArray(rawPlants) ? rawPlants : Object.values(rawPlants);
    const activeFarms = plantsArray.filter(p => !p.isFinished).length;
    const cost = activeFarms * 0.20;

    if (activeFarms === 0) return alert("Buy a plant first!");
    if (userData.balance < cost) return alert("Insufficient balance");

    // Extend current duration or start new if expired
    const until = Math.max(userData.guardEngineerUntil || 0, Date.now()) + (7 * 24 * 60 * 60 * 1000); // Extend up to 7 days
    db.ref('users/' + currentUser).update({
        balance: userData.balance - cost,
        guardEngineerUntil: until
    });
    alert("Guard Engineer activated for 7 days!");
}

function autoHarvestLogic() {
    const rawPlants = userData.plants || [];
    let totalToClaim = 0;
    const now = Date.now();

    Object.keys(rawPlants).forEach(key => {
        const plant = rawPlants[key];
        if (plant.isFinished) return;
        const timeSinceLast = now - plant.lastClaim;
        if (timeSinceLast > 30000) { // Harvest every 30s
            const rate = FLOWER_TYPES[plant.type].roi / FLOWER_TYPES[plant.type].duration;
            const earned = timeSinceLast * rate;
            totalToClaim += earned;
            db.ref(`users/${currentUser}/plants/${key}`).update({ lastClaim: now, totalEarned: (plant.totalEarned || 0) + earned });
        }
    });

    if (totalToClaim > 0) db.ref(`users/${currentUser}/balance`).transaction(b => (b || 0) + totalToClaim);
}

// --- TRANSACTIONS ---
function submitWithdrawal() {
    const amount = parseFloat(document.getElementById('wit-amount').value);
    const address = document.getElementById('wit-address').value;
    if (amount < 100 || amount > userData.balance) return alert("Invalid amount");
    const key = db.ref('requests/withdrawals').push().key;
    const req = { id: key, user: currentUser, amount, address, method: document.getElementById('wit-method').value, status: 'pending', type: 'Withdraw' };
    db.ref(`requests/withdrawals/${key}`).set(req);
    db.ref(`users/${currentUser}/transactions/${key}`).set(req);
    db.ref(`users/${currentUser}/balance`).set(userData.balance - amount);
}

function submitDeposit() {
    const amount = parseFloat(document.getElementById('dep-amount').value);
    const ref = document.getElementById('dep-ref').value;
    if(!amount || !ref) return alert("Missing info");
    const key = db.ref('requests/deposits').push().key;
    const req = { id: key, user: currentUser, amount, ref, method: 'Deposit', status: 'pending', type: 'Deposit' }; // Method filled by admin later
    db.ref(`requests/deposits/${key}`).set(req);
    db.ref(`users/${currentUser}/transactions/${key}`).set(req);
    alert("Sent!");
}

// --- ADMIN ---
function showAdminPrompt() { if(prompt("Password:") === "Propetas12") switchTab('admin'), loadAdmin(); }

function loadAdmin() {
    db.ref('requests').on('value', snap => {
        const div = document.getElementById('admin-requests');
        div.innerHTML = "";
        const data = snap.val();
        if(!data) return;
        ['deposits', 'withdrawals'].forEach(cat => {
            if(data[cat]) Object.values(data[cat]).forEach(req => {
                if(req.status !== 'pending') return;
                div.innerHTML += `<div class="bg-white p-3 rounded-xl border text-[10px]">
                    <p><b>${req.type}</b>: ₱${req.amount} | User: ${req.user}</p>
                    <p>${req.ref || req.address}</p>
                    <button onclick="processReq('${cat}','${req.id}','${req.user}',${req.amount},true)" class="text-green-500 font-bold mr-4">APPROVE</button>
                    <button onclick="processReq('${cat}','${req.id}','${req.user}',${req.amount},false)" class="text-red-500 font-bold">DENY</button>
                </div>`;
            });
        });
    });
}

function processReq(cat, id, user, amount, approve) {
    const status = approve ? 'approved' : 'denied';
    db.ref(`requests/${cat}/${id}/status`).set(status);
    db.ref(`users/${user}/transactions/${id}/status`).set(status);
    if(approve && cat === 'deposits') {
        db.ref(`users/${user}/balance`).transaction(b => (b||0) + amount);
        db.ref(`users/${user}/referredBy`).once('value', s => {
            const rCode = s.val();
            if(rCode) db.ref('users').orderByChild('refCode').equalTo(rCode).once('value', snap => {
                if(snap.exists()){
                    const rKey = Object.keys(snap.val())[0];
                    db.ref(`users/${rKey}/balance`).transaction(b => (b||0) + (amount * 0.05));
                    db.ref(`users/${rKey}/referralEarnings`).transaction(b => (b||0) + (amount * 0.05));
                }
            });
        });
    } else if(!approve && cat === 'withdrawals') db.ref(`users/${user}/balance`).transaction(b => (b||0) + amount);
}

// --- HELPERS ---
function formatMs(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    toggleMenu(); // Close menu after switching tab
}
