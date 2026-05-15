
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
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let userData = null;

// Config
const PLANS = {
    sampaguita: { cost: 50, income: 55, days: 7, name: "Sampaguita" },
    rose: { cost: 100, income: 110, days: 7, name: "Rose Flower" }
};

// --- AUTH LOGIC ---
function handleAuth(type) {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    if(!email || !pass) return alert("Fill fields");

    if(type === 'register') {
        auth.createUserWithEmailAndPassword(email, pass).then(res => {
            const refCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            db.ref('users/' + res.user.uid).set({
                balance: 0,
                referralCode: refCode,
                referredBy: "",
                totalRefEarn: 0,
                totalRefCount: 0,
                activeMines: [],
                history: []
            });
            incrementUserCount();
        }).catch(err => alert(err.message));
    } else {
        auth.signInWithEmailAndPassword(email, pass).catch(err => alert(err.message));
    }
}

auth.onAuthStateChanged(user => {
    if(user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('u-id').innerText = user.uid;
        listenToUserData();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

function listenToUserData() {
    db.ref('users/' + currentUser.uid).on('value', snap => {
        userData = snap.val();
        updateUI();
    });
    db.ref('stats/totalUsers').on('value', snap => {
        document.getElementById('total-users').innerText = snap.val() || 0;
    });
}

function incrementUserCount() {
    db.ref('stats/totalUsers').transaction(curr => (curr || 0) + 1);
}

// --- UI LOGIC ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.querySelectorAll('footer button').forEach(btn => btn.classList.replace('text-green-600', 'text-gray-400'));
    event.currentTarget.classList.replace('text-gray-400', 'text-green-600');
}

function updateUI() {
    if(!userData) return;
    document.getElementById('u-balance').innerText = userData.balance.toFixed(2);
    document.getElementById('my-refer-code').innerText = userData.referralCode;
    document.getElementById('total-ref-count').innerText = userData.totalRefCount || 0;
    document.getElementById('total-ref-earn').innerText = (userData.totalRefEarn || 0).toFixed(2);
    
    renderMining();
    renderHistory();
}

// --- MINING ENGINE ---
function buyPlant(type) {
    const plan = PLANS[type];
    const count = (userData.activeMines || []).filter(m => m.type === type && !m.expired).length;
    
    if(count >= 10) return alert("Maximum 10 of this plant reached!");
    if(userData.balance < plan.cost) return alert("Insufficient balance!");

    const newMine = {
        type: type,
        startTime: Date.now(),
        lastClaim: Date.now(),
        expiry: Date.now() + (plan.days * 24 * 60 * 60 * 1000),
        claimedTotal: 0,
        expired: false
    };

    db.ref('users/' + currentUser.uid).update({
        balance: userData.balance - plan.cost,
        activeMines: [...(userData.activeMines || []), newMine]
    });
}

function renderMining() {
    const list = document.getElementById('active-mines-list');
    list.innerHTML = "";
    if(!userData.activeMines) return list.innerHTML = "No active mines.";

    userData.activeMines.forEach((mine, index) => {
        if(mine.expired) return;

        const plan = PLANS[mine.type];
        const now = Date.now();
        
        // Expiry check
        if(now > mine.expiry) {
            db.ref(`users/${currentUser.uid}/activeMines/${index}`).update({ expired: true });
            return;
        }

        // Calculate pending (Max 4 hours)
        const fourHours = 4 * 60 * 60 * 1000;
        const timeDiff = Math.min(now - mine.lastClaim, fourHours);
        const incomePerMs = plan.income / (plan.days * 24 * 60 * 60 * 1000);
        const pending = (timeDiff * incomePerMs).toFixed(4);
        
        const progress = ((now - mine.startTime) / (mine.expiry - mine.startTime) * 100).toFixed(2);

        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500";
        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="font-bold text-sm">${plan.name} #${index + 1}</span>
                <span class="text-[10px] text-gray-400">Expires: ${new Date(mine.expiry).toLocaleDateString()}</span>
            </div>
            <div class="w-full bg-gray-100 h-2 rounded-full mb-2 overflow-hidden">
                <div class="bg-green-500 h-full" style="width: ${progress}%"></div>
            </div>
            <div class="flex justify-between items-center">
                <div>
                    <p class="text-[10px] text-gray-400">Pending</p>
                    <p class="font-bold text-green-600">₱${pending}</p>
                </div>
                <button onclick="claimMining(${index}, ${pending})" class="bg-black text-white px-4 py-1 rounded-lg text-sm active:scale-90 transition">Claim</button>
            </div>
            ${timeDiff >= fourHours ? '<p class="text-[9px] text-red-500 mt-1 italic">Mining paused (4h limit reached). Claim to resume.</p>' : ''}
        `;
        list.appendChild(card);
    });
}

async function claimMining(index, amount) {
    if(amount <= 0) return;
    
    // Show Ad SDK
    try {
        await show_10555663();
        
        // Prevent double credit by re-fetching data logic or Atomic Updates
        const ref = db.ref(`users/${currentUser.uid}`);
        ref.get().then(snap => {
            const data = snap.val();
            const currentMine = data.activeMines[index];
            
            // Double check 4 hour logic server side for security usually, but here client side:
            const updatedMines = [...data.activeMines];
            updatedMines[index].lastClaim = Date.now();
            updatedMines[index].claimedTotal += parseFloat(amount);

            ref.update({
                balance: data.balance + parseFloat(amount),
                activeMines: updatedMines
            });
        });
    } catch (e) {
        alert("Ad not finished.");
    }
}

// --- WALLET LOGIC ---
function toggleWalletView(view) {
    document.getElementById('wallet-deposit').classList.toggle('hidden', view !== 'deposit');
    document.getElementById('wallet-withdraw').classList.toggle('hidden', view !== 'withdraw');
}

function submitDeposit() {
    const amount = parseFloat(document.getElementById('dep-amount').value);
    const ref = document.getElementById('dep-ref').value;
    const name = document.getElementById('dep-name').value;
    const method = document.getElementById('dep-method').value;

    if(!amount || !ref) return alert("Complete details");

    const depObj = {
        uid: currentUser.uid,
        email: currentUser.email,
        amount, ref, name, method,
        status: 'pending',
        timestamp: Date.now()
    };

    db.ref('deposits').push(depObj);
    addHistory(`Deposit Pending: ₱${amount}`);
    alert("Deposit request submitted!");
}

function submitWithdraw() {
    const amount = parseFloat(document.getElementById('wit-amount').value);
    const details = document.getElementById('wit-details').value;
    const method = document.getElementById('wit-method').value;

    if(amount < 100) return alert("Min withdrawal ₱100");
    if(userData.balance < amount) return alert("Insufficient balance");

    const witObj = {
        uid: currentUser.uid,
        email: currentUser.email,
        amount, details, method,
        status: 'pending',
        timestamp: Date.now()
    };

    db.ref('withdrawals').push(witObj);
    db.ref('users/' + currentUser.uid).update({ balance: userData.balance - amount });
    addHistory(`Withdrawal Pending: ₱${amount}`);
    alert("Withdrawal request submitted!");
}

function addHistory(msg) {
    const history = userData.history || [];
    history.unshift({ msg, time: Date.now() });
    db.ref('users/' + currentUser.uid + '/history').set(history);
}

function renderHistory() {
    const div = document.getElementById('transaction-history');
    div.innerHTML = (userData.history || []).map(h => `
        <div class="flex justify-between border-b py-1">
            <span>${h.msg}</span>
            <span class="text-gray-400">${new Date(h.time).toLocaleDateString()}</span>
        </div>
    `).join('');
}

// --- REFERRAL LOGIC ---
function applyReferral() {
    const code = document.getElementById('input-ref-code').value.trim();
    if(code === userData.referralCode) return alert("Cannot use own code");
    if(userData.referredBy) return alert("Already referred");

    db.ref('users').orderByChild('referralCode').equalTo(code).once('value', snap => {
        if(snap.exists()) {
            const parentUid = Object.keys(snap.val())[0];
            db.ref('users/' + currentUser.uid).update({ referredBy: parentUid });
            db.ref('users/' + parentUid).child('totalRefCount').transaction(c => (c || 0) + 1);
            alert("Referral applied!");
        } else {
            alert("Invalid Code");
        }
    });
}

// --- ADMIN LOGIC ---
function checkAdmin() {
    const pass = prompt("Enter Admin Password:");
    if(pass === "Propetas12") {
        switchTab('admin');
        loadAdminData();
    } else {
        alert("Wrong password");
    }
}

function loadAdminData() {
    db.ref('deposits').on('value', snap => {
        const data = snap.val();
        let html = "";
        for(let id in data) {
            if(data[id].status === 'pending') {
                html += `<div class="p-2 border rounded">
                    ${data[id].email} - ₱${data[id].amount}<br>Ref: ${data[id].ref}<br>
                    <button onclick="approveDep('${id}')" class="text-green-600 mr-2">[Approve]</button>
                    <button onclick="denyDep('${id}')" class="text-red-600">[Deny]</button>
                </div>`;
            }
        }
        document.getElementById('admin-deposits').innerHTML = html || "No pending deposits";
    });

    db.ref('withdrawals').on('value', snap => {
        const data = snap.val();
        let html = "";
        for(let id in data) {
            if(data[id].status === 'pending') {
                html += `<div class="p-2 border rounded">
                    ${data[id].email} - ₱${data[id].amount}<br>To: ${data[id].details}<br>
                    <button onclick="approveWit('${id}')" class="text-green-600 mr-2">[Approve]</button>
                    <button onclick="denyWit('${id}')" class="text-red-600">[Deny]</button>
                </div>`;
            }
        }
        document.getElementById('admin-withdrawals').innerHTML = html || "No pending withdrawals";
    });
}

function approveDep(id) {
    db.ref('deposits/' + id).once('value', snap => {
        const dep = snap.val();
        // Credit User
        db.ref('users/' + dep.uid).transaction(user => {
            if(user) {
                user.balance += dep.amount;
                // Referral Commission (5%)
                if(user.referredBy) {
                    const comm = dep.amount * 0.05;
                    db.ref('users/' + user.referredBy).transaction(parent => {
                        if(parent) {
                            parent.balance += comm;
                            parent.totalRefEarn = (parent.totalRefEarn || 0) + comm;
                        }
                        return parent;
                    });
                }
            }
            return user;
        });
        db.ref('deposits/' + id).update({ status: 'approved' });
    });
}

function denyDep(id) { db.ref('deposits/' + id).update({ status: 'denied' }); }
function approveWit(id) { db.ref('withdrawals/' + id).update({ status: 'approved' }); }
function denyWit(id) { 
    db.ref('withdrawals/' + id).once('value', snap => {
        const wit = snap.val();
        db.ref('users/' + wit.uid + '/balance').transaction(b => b + wit.amount);
        db.ref('withdrawals/' + id).update({ status: 'denied' });
    });
}

// Time Footer
setInterval(() => {
    document.getElementById('footer-time').innerText = new Date().toLocaleString();
}, 1000);

// Auto Refresh Mining Display
setInterval(() => {
    if(userData) renderMining();
}, 10000);
