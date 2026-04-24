
// --- CONFIGURATION ---
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

const MAX_ACCUMULATION = 4 * 60 * 60 * 1000; // 4 Hours Mining Limit

// --- REAL-TIME FOOTER TIME ---
setInterval(() => {
    const now = new Date();
    document.getElementById('footer-time').innerText = now.toLocaleString();
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
                id: 'USER-' + Math.floor(1000 + Math.random()*8999),
                refCode: myRef,
                referredBy: refBy || null,
                referralEarnings: 0,
                totalReferrals: 0,
                plants: []
            });
        }
        startApp();
    });
}

function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    
    // Global User Counter
    db.ref('users').on('value', snap => {
        document.getElementById('total-users').innerText = snap.numChildren();
    });

    // User Data Sync
    db.ref('users/' + currentUser).on('value', (snapshot) => {
        userData = snapshot.val();
        updateUI();
    });
}

// --- CORE UI UPDATES ---
function updateUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(2);
    document.getElementById('display-uid').innerText = userData.id;
    document.getElementById('my-ref-code').innerText = userData.refCode;
    document.getElementById('total-refs').innerText = userData.totalReferrals || 0;
    document.getElementById('ref-earnings').innerText = "₱" + (userData.referralEarnings || 0).toFixed(2);

    // Update Market Buttons
    const plants = userData.plants || [];
    ['sampaguita', 'rose'].forEach(type => {
        const count = plants.filter(p => p.type === type && !p.isFinished).length;
        document.getElementById(`btn-buy-${type}`).innerText = `BUY (${count}/10)`;
    });

    // Garden Rendering
    const gardenList = document.getElementById('garden-list');
    gardenList.innerHTML = "";
    
    if (userData.plants) {
        userData.plants.forEach((plant, index) => {
            if (plant.isFinished) return;
            
            const now = Date.now();
            const contractEndTime = plant.startTime + FLOWER_TYPES[plant.type].duration;
            const timeLeft = contractEndTime - now;
            
            if (timeLeft <= 0) {
                // Auto-Finish if contract expired
                db.ref(`users/${currentUser}/plants/${index}/isFinished`).set(true);
                return;
            }

            const timeSinceLast = now - plant.lastClaim;
            const accumProgress = Math.min((timeSinceLast / MAX_ACCUMULATION) * 100, 100);
            const isPaused = timeSinceLast >= MAX_ACCUMULATION;
            
            const rate = FLOWER_TYPES[plant.type].roi / FLOWER_TYPES[plant.type].duration;
            const claimable = (Math.min(timeSinceLast, MAX_ACCUMULATION) * rate).toFixed(4);

            gardenList.innerHTML += `
                <div class="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-3">
                            <div class="text-3xl">${FLOWER_TYPES[plant.type].icon}</div>
                            <div>
                                <h4 class="font-bold text-slate-800 uppercase text-xs">${plant.type}</h4>
                                <p class="text-[10px] text-slate-400">Expires: ${formatTime(timeLeft)}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-black text-green-600">₱${claimable}</p>
                            <p class="text-[8px] text-slate-400 font-bold uppercase">Ready to claim</p>
                        </div>
                    </div>
                    
                    <div class="bg-slate-100 h-2 w-full rounded-full overflow-hidden mb-4">
                        <div class="progress-bar h-full ${isPaused ? 'bg-orange-500' : 'bg-green-500'}" style="width: ${accumProgress}%"></div>
                    </div>

                    <button onclick="claimFlower(${index})" class="w-full py-3 rounded-2xl font-bold text-xs transition-all ${isPaused ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-slate-100 text-slate-600'}">
                        ${isPaused ? 'MINING PAUSED - CLAIM NOW' : 'CLAIM EARNINGS'}
                    </button>
                </div>
            `;
        });
    }

    // Withdrawal History
    const historyDiv = document.getElementById('withdraw-history');
    historyDiv.innerHTML = "";
    if (userData.transactions) {
        Object.values(userData.transactions).filter(t => t.type === 'Withdraw').reverse().forEach(tx => {
            historyDiv.innerHTML += `
                <div class="bg-white px-4 py-3 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                        <p class="font-bold text-slate-800">₱${tx.amount} via ${tx.method}</p>
                        <p class="text-[10px] text-slate-400">${tx.address}</p>
                    </div>
                    <span class="px-2 py-1 rounded-lg font-bold uppercase text-[9px] ${tx.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}">
                        ${tx.status}
                    </span>
                </div>
            `;
        });
    }
}

// --- UTILS ---
function formatTime(ms) {
    const days = Math.floor(ms / (24*60*60*1000));
    const hours = Math.floor((ms % (24*60*60*1000)) / (60*60*1000));
    const mins = Math.floor((ms % (60*60*1000)) / (60*1000));
    return `${days}d ${hours}h ${mins}m`;
}

// --- ACTION LOGIC ---
function buyFlower(type) {
    const activeCount = (userData.plants || []).filter(p => p.type === type && !p.isFinished).length;
    if (activeCount >= 10) return alert("Maximum 10 of this type allowed.");
    if (userData.balance < FLOWER_TYPES[type].cost) return alert("Insufficient balance.");

    const newPlant = {
        type,
        startTime: Date.now(),
        lastClaim: Date.now(),
        totalEarned: 0,
        isFinished: false
    };

    db.ref('users/' + currentUser).update({
        balance: userData.balance - FLOWER_TYPES[type].cost,
        plants: [...(userData.plants || []), newPlant]
    });
}

function claimFlower(index) {
    const plant = userData.plants[index];
    const now = Date.now();
    const timeSinceLast = now - plant.lastClaim;
    const rate = FLOWER_TYPES[plant.type].roi / FLOWER_TYPES[plant.type].duration;
    const earned = Math.min(timeSinceLast, MAX_ACCUMULATION) * rate;

    show_10555663().then(() => {
        let updatedPlants = [...userData.plants];
        updatedPlants[index].lastClaim = now;
        updatedPlants[index].totalEarned = (updatedPlants[index].totalEarned || 0) + earned;

        db.ref('users/' + currentUser).update({
            balance: userData.balance + earned,
            plants: updatedPlants
        });
    });
}

// --- TRANSACTIONS ---
function submitDeposit() {
    const amount = parseFloat(document.getElementById('dep-amount').value);
    const ref = document.getElementById('dep-ref').value;
    const method = document.getElementById('dep-method').value;
    if(!amount || !ref) return alert("Fill all details");

    const key = db.ref('requests/deposits').push().key;
    const req = { id: key, user: currentUser, amount, ref, method, status: 'pending', type: 'Deposit' };
    db.ref('requests/deposits/' + key).set(req);
    db.ref(`users/${currentUser}/transactions/${key}`).set(req);
    alert("Deposit sent for approval!");
}

function submitWithdrawal() {
    const amount = parseFloat(document.getElementById('wit-amount').value);
    const address = document.getElementById('wit-address').value;
    const method = document.getElementById('wit-method').value;
    if(amount < 100) return alert("Minimum withdrawal ₱100");
    if(amount > userData.balance) return alert("Insufficient balance");

    const key = db.ref('requests/withdrawals').push().key;
    const req = { id: key, user: currentUser, amount, address, method, status: 'pending', type: 'Withdraw' };
    db.ref('requests/withdrawals/' + key).set(req);
    db.ref(`users/${currentUser}/transactions/${key}`).set(req);
    db.ref(`users/${currentUser}/balance`).set(userData.balance - amount);
    alert("Withdrawal request submitted!");
}

// --- ADMIN ---
function showAdminPrompt() {
    if(prompt("Admin Password:") === "Propetas12") {
        switchTab('admin');
        loadAdmin();
    }
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
                    <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <p class="font-bold text-sm text-slate-800">${req.type} - ₱${req.amount}</p>
                        <p class="text-[10px] text-slate-500">User: ${req.user} | Method: ${req.method}</p>
                        <p class="text-[10px] text-slate-500">Ref/Address: ${req.ref || req.address}</p>
                        <div class="mt-3 flex gap-2">
                            <button onclick="processReq('${cat}', '${req.id}', '${req.user}', ${req.amount}, true)" class="flex-1 bg-green-500 text-white py-2 rounded-xl text-[10px] font-bold">APPROVE</button>
                            <button onclick="processReq('${cat}', '${req.id}', '${req.user}', ${req.amount}, false)" class="flex-1 bg-rose-500 text-white py-2 rounded-xl text-[10px] font-bold">DENY</button>
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
        // Referral Commission
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

function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
}
