
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

const MAX_ACCUMULATION = 4 * 60 * 60 * 1000; // 4h pause limit

// --- SYSTEM CLOCK ---
setInterval(() => {
    document.getElementById('footer-time').innerText = new Date().toLocaleString();
    if (userData.dragonEngineerUntil && userData.dragonEngineerUntil > Date.now()) {
        autoHarvestLogic();
    }
}, 1000);

// --- AUTH ---
function login() {
    const user = document.getElementById('username').value.trim().toLowerCase();
    const refBy = document.getElementById('ref-input').value.trim().toUpperCase();
    if (!user) return alert("Enter a username");

    currentUser = user.replace(/[^a-z0-9]/g, "");
    db.ref('users/' + currentUser).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            const myRef = Math.random().toString(36).substring(2, 8).toUpperCase();
            db.ref('users/' + currentUser).set({
                balance: 0,
                id: 'FARM-' + Math.floor(1000 + Math.random()*8999),
                refCode: myRef,
                referredBy: refBy || null,
                referralEarnings: 0,
                totalReferrals: 0,
                plants: [],
                dragonEngineerUntil: 0
            });
        }
        startApp();
    });
}

function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    db.ref('users').on('value', snap => document.getElementById('total-users').innerText = snap.numChildren());
    db.ref('users/' + currentUser).on('value', (snap) => {
        userData = snap.val();
        updateUI();
    });
}

// --- UI LOGIC ---
function updateUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(2);
    document.getElementById('display-uid').innerText = userData.id;
    document.getElementById('my-ref-code').innerText = userData.refCode;
    document.getElementById('total-refs').innerText = userData.totalReferrals || 0;
    document.getElementById('ref-earnings').innerText = "₱" + (userData.referralEarnings || 0).toFixed(2);

    // Market Limit UI
    const plants = userData.plants || [];
    ['sampaguita', 'rose'].forEach(t => {
        const count = plants.filter(p => p.type === t && !p.isFinished).length;
        document.getElementById(`btn-buy-${t}`).innerText = `BUY (${count}/10)`;
    });

    // Dragon Engineer UI
    const dragonDisplay = document.getElementById('dragon-timer-display');
    if (userData.dragonEngineerUntil > Date.now()) {
        dragonDisplay.classList.remove('hidden');
        const diff = userData.dragonEngineerUntil - Date.now();
        document.getElementById('dragon-time-left').innerText = formatMs(diff);
    } else {
        dragonDisplay.classList.add('hidden');
    }

    // Garden Rendering
    const gardenList = document.getElementById('garden-list');
    gardenList.innerHTML = "";
    
    if (userData.plants) {
        userData.plants.forEach((plant, idx) => {
            if (plant.isFinished) return;
            const now = Date.now();
            const expiry = plant.startTime + FLOWER_TYPES[plant.type].duration;
            const timeLeft = expiry - now;

            if (timeLeft <= 0) {
                db.ref(`users/${currentUser}/plants/${idx}/isFinished`).set(true);
                return;
            }

            const timeSinceLast = now - plant.lastClaim;
            const isPaused = timeSinceLast >= MAX_ACCUMULATION && userData.dragonEngineerUntil < now;
            const rate = FLOWER_TYPES[plant.type].roi / FLOWER_TYPES[plant.type].duration;
            const claimable = (Math.min(timeSinceLast, MAX_ACCUMULATION) * rate).toFixed(4);

            gardenList.innerHTML += `
                <div class="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
                    <div class="flex justify-between mb-4">
                        <div class="flex gap-3">
                            <span class="text-3xl">${FLOWER_TYPES[plant.type].icon}</span>
                            <div>
                                <h4 class="font-black text-slate-800 uppercase text-xs">${plant.type}</h4>
                                <p class="text-[9px] text-slate-400">Ends in: ${formatMs(timeLeft)}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-black text-green-600">₱${claimable}</p>
                            <p class="text-[8px] font-bold text-slate-400 uppercase">Current Profit</p>
                        </div>
                    </div>
                    <div class="bg-slate-100 h-1.5 w-full rounded-full overflow-hidden mb-4">
                        <div class="progress-fill h-full ${isPaused ? 'bg-orange-500' : 'bg-green-500'}" 
                             style="width: ${(Math.min(timeSinceLast, MAX_ACCUMULATION)/MAX_ACCUMULATION)*100}%"></div>
                    </div>
                    <button onclick="claimFlower(${idx})" class="w-full py-3 rounded-2xl font-black text-[10px] tracking-widest transition-all 
                        ${isPaused ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}">
                        ${isPaused ? 'MINING PAUSED - CLAIM NOW' : 'CLAIM MANUALLY'}
                    </button>
                </div>`;
        });
    }

    // Withdrawal History
    const historyDiv = document.getElementById('withdraw-history');
    historyDiv.innerHTML = "";
    if (userData.transactions) {
        Object.values(userData.transactions).filter(t => t.type === 'Withdraw').reverse().forEach(tx => {
            historyDiv.innerHTML += `
                <div class="bg-white p-4 rounded-2xl flex justify-between items-center text-xs border border-slate-100">
                    <div><p class="font-black text-slate-800">₱${tx.amount}</p><p class="text-[9px] text-slate-400">${tx.method}</p></div>
                    <span class="px-3 py-1 rounded-full text-[8px] font-black uppercase ${tx.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}">${tx.status}</span>
                </div>`;
        });
    }
}

// --- DRAGON ENGINEER AUTO-HARVEST ---
function autoHarvestLogic() {
    let totalToClaim = 0;
    const now = Date.now();
    let updatedPlants = [...(userData.plants || [])];
    let changed = false;

    updatedPlants.forEach((plant, idx) => {
        if (plant.isFinished) return;
        const timeSinceLast = now - plant.lastClaim;
        // Harvest if more than 1 minute passed to reduce db writes
        if (timeSinceLast > 60000) { 
            const rate = FLOWER_TYPES[plant.type].roi / FLOWER_TYPES[plant.type].duration;
            const earned = timeSinceLast * rate;
            totalToClaim += earned;
            updatedPlants[idx].lastClaim = now;
            updatedPlants[idx].totalEarned = (updatedPlants[idx].totalEarned || 0) + earned;
            changed = true;
        }
    });

    if (changed) {
        db.ref('users/' + currentUser).update({
            balance: userData.balance + totalToClaim,
            plants: updatedPlants
        });
    }
}

function buyDragonEngineer() {
    const activeFarms = (userData.plants || []).filter(p => !p.isFinished).length;
    const cost = activeFarms * 0.50;
    
    if (activeFarms === 0) return alert("You need at least 1 flower to hire an engineer!");
    if (userData.balance < cost) return alert(`Need ₱${cost.toFixed(2)} to activate.`);

    const newUntil = Math.max(userData.dragonEngineerUntil || 0, Date.now()) + (24 * 60 * 60 * 1000);
    
    db.ref('users/' + currentUser).update({
        balance: userData.balance - cost,
        dragonEngineerUntil: newUntil
    });
    alert("Dragon Engineer Hired for 24 hours!");
}

// --- GENERAL ACTIONS ---
function buyFlower(type) {
    const count = (userData.plants || []).filter(p => p.type === type && !p.isFinished).length;
    if (count >= 10) return alert("Max 10 per type");
    if (userData.balance < FLOWER_TYPES[type].cost) return alert("Insufficient balance");

    const plant = { type, startTime: Date.now(), lastClaim: Date.now(), totalEarned: 0, isFinished: false };
    db.ref('users/' + currentUser).update({
        balance: userData.balance - FLOWER_TYPES[type].cost,
        plants: [...(userData.plants || []), plant]
    });
}

function claimFlower(idx) {
    const plant = userData.plants[idx];
    const now = Date.now();
    const elapsed = Math.min(now - plant.lastClaim, MAX_ACCUMULATION);
    const earned = elapsed * (FLOWER_TYPES[plant.type].roi / FLOWER_TYPES[plant.type].duration);

    show_10555663().then(() => {
        let plants = [...userData.plants];
        plants[idx].lastClaim = now;
        plants[idx].totalEarned = (plants[idx].totalEarned || 0) + earned;
        db.ref('users/' + currentUser).update({ balance: userData.balance + earned, plants: plants });
    });
}

function submitWithdrawal() {
    const amount = parseFloat(document.getElementById('wit-amount').value);
    const address = document.getElementById('wit-address').value;
    if (amount < 100) return alert("Min ₱100");
    if (amount > userData.balance) return alert("Low balance");
    const key = db.ref('requests/withdrawals').push().key;
    const req = { id: key, user: currentUser, amount, address, method: document.getElementById('wit-method').value, status: 'pending', type: 'Withdraw' };
    db.ref(`requests/withdrawals/${key}`).set(req);
    db.ref(`users/${currentUser}/transactions/${key}`).set(req);
    db.ref(`users/${currentUser}/balance`).set(userData.balance - amount);
}

function submitDeposit() {
    const amount = parseFloat(document.getElementById('dep-amount').value);
    const ref = document.getElementById('dep-ref').value;
    if(!amount || !ref) return alert("Fill all fields");
    const key = db.ref('requests/deposits').push().key;
    const req = { id: key, user: currentUser, amount, ref, method: document.getElementById('dep-method').value, status: 'pending', type: 'Deposit' };
    db.ref(`requests/deposits/${key}`).set(req);
    db.ref(`users/${currentUser}/transactions/${key}`).set(req);
    alert("Request Sent!");
}

// --- ADMIN ---
function showAdminPrompt() {
    if(prompt("Admin Password:") === "Propetas12") { switchTab('admin'); loadAdmin(); }
}

function loadAdmin() {
    db.ref('requests').on('value', snap => {
        const div = document.getElementById('admin-requests');
        div.innerHTML = "";
        const data = snap.val();
        if(!data) return;
        ['deposits', 'withdrawals'].forEach(cat => {
            if(data[cat]) Object.values(data[cat]).forEach(req => {
                if(req.status !== 'pending') return;
                div.innerHTML += `
                    <div class="bg-white p-4 rounded-2xl shadow-sm border">
                        <p class="font-black text-xs uppercase">${req.type} - ₱${req.amount}</p>
                        <p class="text-[10px] text-slate-400">User: ${req.user} | Detail: ${req.ref || req.address}</p>
                        <div class="mt-3 flex gap-2">
                            <button onclick="processReq('${cat}','${req.id}','${req.user}',${req.amount},true)" class="flex-1 bg-green-500 text-white py-2 rounded-xl text-[10px] font-black">APPROVE</button>
                            <button onclick="processReq('${cat}','${req.id}','${req.user}',${req.amount},false)" class="flex-1 bg-rose-500 text-white py-2 rounded-xl text-[10px] font-black">DENY</button>
                        </div>
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
            if(rCode) {
                db.ref('users').orderByChild('refCode').equalTo(rCode).once('value', snap => {
                    if(snap.exists()){
                        const rKey = Object.keys(snap.val())[0];
                        db.ref(`users/${rKey}/balance`).transaction(b => (b||0) + (amount * 0.05));
                        db.ref(`users/${rKey}/referralEarnings`).transaction(b => (b||0) + (amount * 0.05));
                    }
                });
            }
        });
    } else if(!approve && cat === 'withdrawals') {
        db.ref(`users/${user}/balance`).transaction(b => (b||0) + amount);
    }
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
}
