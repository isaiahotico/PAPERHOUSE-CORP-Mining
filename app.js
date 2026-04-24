
// --- DATABASE CONFIGURATION ---
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
const MINING_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const TOTAL_RETURN = 55;
const COST = 50;

// --- AUTH LOGIC ---
function login() {
    const user = document.getElementById('username').value.trim();
    if (!user) return alert("Enter username");
    currentUser = user.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    db.ref('users/' + currentUser).on('value', (snapshot) => {
        if (!snapshot.exists()) {
            // New User Template
            db.ref('users/' + currentUser).set({
                balance: 0,
                id: 'SAMP-' + Math.floor(Math.random() * 1000000),
                plants: []
            });
        } else {
            userData = snapshot.val();
            updateUI();
        }
    });
    document.getElementById('auth-screen').classList.add('hidden');
}

// --- UI UPDATES ---
function updateUI() {
    document.getElementById('display-uid').innerText = userData.id;
    document.getElementById('balance').innerText = userData.balance.toFixed(2);
    const activePlants = (userData.plants || []).filter(p => (Date.now() - p.startTime) < MINING_DURATION);
    document.getElementById('active-plants').innerText = `${activePlants.length} / 10`;
    
    // Update history
    const historyDiv = document.getElementById('transaction-history');
    historyDiv.innerHTML = '';
    if(userData.transactions) {
        Object.values(userData.transactions).reverse().forEach(tx => {
            historyDiv.innerHTML += `
                <div class="flex justify-between border-b pb-1">
                    <span>${tx.type} (${tx.status})</span>
                    <span class="${tx.status === 'approved' ? 'text-green-500' : 'text-orange-500'}">₱${tx.amount}</span>
                </div>`;
        });
    }
}

// --- MINING ENGINE ---
setInterval(() => {
    if (!userData.plants) return;
    
    let totalClaimable = 0;
    const now = Date.now();
    
    userData.plants.forEach(plant => {
        const elapsed = now - plant.startTime;
        const lastClaim = plant.lastClaim || plant.startTime;
        
        if (elapsed < MINING_DURATION) {
            // Calculate earnings since last claim
            const sessionElapsed = now - lastClaim;
            const ratePerMs = TOTAL_RETURN / MINING_DURATION;
            totalClaimable += sessionElapsed * ratePerMs;
        } else {
            // Handle plant completion if not fully claimed
            const totalRemaining = TOTAL_RETURN - (plant.claimedSoFar || 0);
            if (totalRemaining > 0) totalClaimable += totalRemaining;
        }
    });
    
    document.getElementById('claimable-amount').innerText = Math.max(0, totalClaimable).toFixed(4);
}, 1000);

// --- CORE ACTIONS ---
function buySampaguita() {
    const plants = userData.plants || [];
    if (plants.length >= 10) return alert("Max 10 plants reached");
    if (userData.balance < COST) return alert("Insufficient balance");

    db.ref('users/' + currentUser).update({
        balance: userData.balance - COST,
        plants: [...plants, { startTime: Date.now(), lastClaim: Date.now(), claimedSoFar: 0 }]
    });
    alert("Sampaguita Purchased!");
}

function handleClaim() {
    const amount = parseFloat(document.getElementById('claimable-amount').innerText);
    if (amount <= 0) return alert("Nothing to claim yet");

    // Trigger Ad SDK
    show_10555663().then(() => {
        // Prevent double credit by resetting plant timers first
        const updatedPlants = userData.plants.map(plant => {
            const now = Date.now();
            const ratePerMs = TOTAL_RETURN / MINING_DURATION;
            const earned = (now - (plant.lastClaim || plant.startTime)) * ratePerMs;
            
            return {
                ...plant,
                lastClaim: now,
                claimedSoFar: (plant.claimedSoFar || 0) + earned
            };
        });

        db.ref('users/' + currentUser).update({
            balance: userData.balance + amount,
            plants: updatedPlants
        });
        
        alert(`Successfully claimed ₱${amount.toFixed(2)}`);
    }).catch(err => {
        alert("Ad failed to load. Please try again.");
    });
}

// --- WALLET ACTIONS ---
function submitDeposit() {
    const amount = parseFloat(document.getElementById('dep-amount').value);
    const ref = document.getElementById('dep-ref').value;
    const method = document.getElementById('dep-method').value;
    
    if(!amount || !ref) return alert("Fill all fields");

    const txKey = db.ref('requests/deposits').push().key;
    const txData = { id: txKey, user: currentUser, amount, ref, method, type: 'Deposit', status: 'pending' };
    
    db.ref('requests/deposits/' + txKey).set(txData);
    db.ref(`users/${currentUser}/transactions/${txKey}`).set(txData);
    alert("Deposit request submitted!");
}

function submitWithdrawal() {
    const amount = parseFloat(document.getElementById('wit-amount').value);
    const address = document.getElementById('wit-address').value;
    const method = document.getElementById('wit-method').value;
    
    if(amount > userData.balance) return alert("Insufficient balance");
    if(!amount || !address) return alert("Fill all fields");

    const txKey = db.ref('requests/withdrawals').push().key;
    const txData = { id: txKey, user: currentUser, amount, address, method, type: 'Withdraw', status: 'pending' };
    
    db.ref('requests/withdrawals/' + txKey).set(txData);
    db.ref(`users/${currentUser}/transactions/${txKey}`).set(txData);
    
    // Deduct balance immediately for withdrawal
    db.ref('users/' + currentUser + '/balance').set(userData.balance - amount);
    alert("Withdrawal request submitted!");
}

// --- ADMIN LOGIC ---
function showAdminPrompt() {
    const pass = prompt("Enter Admin Password:");
    if (pass === "Propetas12") {
        switchTab('admin');
        loadAdminRequests();
    } else {
        alert("Wrong password");
    }
}

function loadAdminRequests() {
    const adminList = document.getElementById('admin-list');
    db.ref('requests').on('value', (snap) => {
        adminList.innerHTML = "";
        const data = snap.val();
        if(!data) return adminList.innerHTML = "No pending requests";

        ['deposits', 'withdrawals'].forEach(type => {
            if(data[type]) {
                Object.values(data[type]).forEach(req => {
                    if(req.status === 'pending') {
                        adminList.innerHTML += `
                            <div class="bg-white p-4 rounded-lg shadow border-l-4 ${type === 'deposits' ? 'border-blue-500' : 'border-red-500'}">
                                <p><strong>${req.type}</strong> from ${req.user}</p>
                                <p>Amount: ₱${req.amount} | Method: ${req.method}</p>
                                <p class="text-xs text-gray-500">Ref/Address: ${req.ref || req.address}</p>
                                <div class="mt-2 flex gap-2">
                                    <button onclick="approveReq('${type}', '${req.id}', '${req.user}', ${req.amount})" class="bg-green-500 text-white px-3 py-1 rounded text-xs">Approve</button>
                                    <button onclick="denyReq('${type}', '${req.id}', '${req.user}', ${req.amount})" class="bg-red-500 text-white px-3 py-1 rounded text-xs">Deny</button>
                                </div>
                            </div>
                        `;
                    }
                });
            }
        });
    });
}

function approveReq(type, id, user, amount) {
    db.ref(`requests/${type}/${id}`).update({ status: 'approved' });
    db.ref(`users/${user}/transactions/${id}`).update({ status: 'approved' });
    
    if(type === 'deposits') {
        db.ref(`users/${user}/balance`).transaction(bal => (bal || 0) + amount);
    }
}

function denyReq(type, id, user, amount) {
    db.ref(`requests/${type}/${id}`).update({ status: 'denied' });
    db.ref(`users/${user}/transactions/${id}`).update({ status: 'denied' });
    
    if(type === 'withdrawals') {
        db.ref(`users/${user}/balance`).transaction(bal => (bal || 0) + amount);
    }
}

// --- NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');
}
