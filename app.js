
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

const MAX_ACCUMULATION = 4 * 60 * 60 * 1000; // 4 Hours

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
                id: 'UID-' + Math.floor(Math.random()*9999),
                refCode: myRef,
                referredBy: refBy || null,
                referralEarnings: 0,
                totalReferrals: 0,
                plants: []
            });
            // Update the referrer count
            if(refBy) {
                db.ref('users').orderByChild('refCode').equalTo(refBy).once('value', s => {
                    if(s.exists()){
                        const rKey = Object.keys(s.val())[0];
                        db.ref(`users/${rKey}/totalReferrals`).transaction(c => (c||0)+1);
                    }
                });
            }
        }
        startApp();
    });
}

function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    db.ref('users/' + currentUser).on('value', (snapshot) => {
        userData = snapshot.val();
        updateUI();
    });
}

// --- UI ---
function updateUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(2);
    document.getElementById('display-uid').innerText = "ID: " + userData.id;
    document.getElementById('my-ref-code').innerText = userData.refCode;
    document.getElementById('total-refs').innerText = userData.totalReferrals || 0;
    document.getElementById('ref-earnings').innerText = "₱" + (userData.referralEarnings || 0).toFixed(2);

    const miningContainer = document.getElementById('active-mining-list');
    miningContainer.innerHTML = "";
    
    if (userData.plants) {
        userData.plants.forEach((plant, index) => {
            if (plant.isFinished) return;
            
            const now = Date.now();
            const elapsed = now - plant.startTime;
            const timeSinceLast = now - plant.lastClaim;
            const isPaused = timeSinceLast >= MAX_ACCUMULATION;
            
            // Calculate current earnings in card
            const rate = FLOWER_TYPES[plant.type].roi / FLOWER_TYPES[plant.type].duration;
            const currentSession = Math.min(timeSinceLast, MAX_ACCUMULATION);
            const claimable = (currentSession * rate).toFixed(4);

            miningContainer.innerHTML += `
                <div class="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border-l-4 ${isPaused ? 'border-orange-400' : 'border-green-500'}">
                    <div class="flex items-center gap-3">
                        <div class="text-2xl">${FLOWER_TYPES[plant.type].icon}</div>
                        <div>
                            <p class="font-bold text-xs uppercase">${plant.type} #${index+1}</p>
                            <p class="text-lg font-mono font-bold">₱${claimable}</p>
                            <p class="text-[9px] ${isPaused ? 'text-orange-500 font-bold' : 'text-gray-400'}">
                                ${isPaused ? '⚠️ PAUSED - CLAIM NOW' : '⛏️ Mining...'}
                            </p>
                        </div>
                    </div>
                    <button onclick="claimFlower(${index})" class="bg-slate-800 text-white text-[10px] px-4 py-2 rounded-lg font-bold">CLAIM</button>
                </div>
            `;
        });
    }
}

// --- MINING LOGIC ---
function buyFlower(type) {
    const plants = userData.plants || [];
    const activeOfType = plants.filter(p => p.type === type && !p.isFinished).length;
    
    if (activeOfType >= 10) return alert(`Max 10 ${type} flowers allowed!`);
    if (userData.balance < FLOWER_TYPES[type].cost) return alert("Insufficient balance!");

    const newPlant = {
        type: type,
        startTime: Date.now(),
        lastClaim: Date.now(),
        totalEarned: 0,
        isFinished: false
    };

    db.ref('users/' + currentUser).update({
        balance: userData.balance - FLOWER_TYPES[type].cost,
        plants: [...plants, newPlant]
    });
}

function claimFlower(index) {
    const plant = userData.plants[index];
    const now = Date.now();
    const timeSinceLast = now - plant.lastClaim;
    const rate = FLOWER_TYPES[plant.type].roi / FLOWER_TYPES[plant.type].duration;
    
    // Earned capped at 4 hours
    const earned = Math.min(timeSinceLast, MAX_ACCUMULATION) * rate;
    
    show_10555663().then(() => {
        let updatedPlants = [...userData.plants];
        const newTotalEarned = (plant.totalEarned || 0) + earned;
        
        updatedPlants[index] = {
            ...plant,
            lastClaim: now,
            totalEarned: newTotalEarned,
            isFinished: newTotalEarned >= FLOWER_TYPES[plant.type].roi
        };

        db.ref('users/' + currentUser).update({
            balance: userData.balance + earned,
            plants: updatedPlants
        });
        alert(`Claimed ₱${earned.toFixed(2)}!`);
    });
}

// --- WALLET ---
function submitDeposit() {
    const amount = parseFloat(document.getElementById('dep-amount').value);
    const ref = document.getElementById('dep-ref').value;
    if(!amount || !ref) return alert("Missing info");

    const key = db.ref('requests/deposits').push().key;
    const req = { id: key, user: currentUser, amount, ref, status: 'pending', type: 'Deposit' };
    
    db.ref('requests/deposits/' + key).set(req);
    db.ref(`users/${currentUser}/transactions/${key}`).set(req);
    alert("Request sent!");
}

function submitWithdrawal() {
    const amount = parseFloat(document.getElementById('wit-amount').value);
    const address = document.getElementById('wit-address').value;
    if(amount < 100) return alert("Min withdrawal is ₱100");
    if(amount > userData.balance) return alert("Insufficient balance");

    const key = db.ref('requests/withdrawals').push().key;
    const req = { id: key, user: currentUser, amount, address, status: 'pending', type: 'Withdraw' };
    
    db.ref('requests/withdrawals/' + key).set(req);
    db.ref(`users/${currentUser}/transactions/${key}`).set(req);
    db.ref(`users/${currentUser}/balance`).set(userData.balance - amount);
    alert("Withdrawal processing!");
}

// --- ADMIN ---
function showAdminPrompt() {
    if(prompt("Password:") === "Propetas12") switchTab('admin'), loadAdmin();
}

function loadAdmin() {
    db.ref('requests').on('value', snap => {
        const adminDiv = document.getElementById('admin-requests');
        adminDiv.innerHTML = "";
        const data = snap.val();
        if(!data) return;

        ['deposits', 'withdrawals'].forEach(cat => {
            if(data[cat]) Object.values(data[cat]).forEach(req => {
                if(req.status !== 'pending') return;
                adminDiv.innerHTML += `
                    <div class="bg-white p-4 rounded-xl shadow-sm border">
                        <p class="font-bold">${req.type} - ₱${req.amount}</p>
                        <p class="text-xs">User: ${req.user} | Detail: ${req.ref || req.address}</p>
                        <div class="mt-2 flex gap-2">
                            <button onclick="processReq('${cat}', '${req.id}', '${req.user}', ${req.amount}, true)" class="bg-green-500 text-white px-4 py-1 rounded text-xs">Approve</button>
                            <button onclick="processReq('${cat}', '${req.id}', '${req.user}', ${req.amount}, false)" class="bg-red-500 text-white px-4 py-1 rounded text-xs">Deny</button>
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
        
        // Referral Commission Logic
        db.ref(`users/${user}/referredBy`).once('value', s => {
            const refCode = s.val();
            if(refCode) {
                db.ref('users').orderByChild('refCode').equalTo(refCode).once('value', snap => {
                    if(snap.exists()){
                        const rKey = Object.keys(snap.val())[0];
                        const comm = amount * 0.05;
                        db.ref(`users/${rKey}/balance`).transaction(b => (b||0) + comm);
                        db.ref(`users/${rKey}/referralEarnings`).transaction(b => (b||0) + comm);
                    }
                });
            }
        });
    } else if(!approve && cat === 'withdrawals') {
        db.ref(`users/${user}/balance`).transaction(b => (b||0) + amount);
    }
}

function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    document.getElementById('tab-' + id).classList.add('active-tab');
}
