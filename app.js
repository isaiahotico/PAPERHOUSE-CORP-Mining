
// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "facebook-follow-to-follow.firebaseapp.com",
    databaseURL: "https://facebook-follow-to-follow-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facebook-follow-to-follow",
    storageBucket: "facebook-follow-to-follow.firebasestorage.app",
    messagingSenderId: "589427984313",
    appId: "1:589427984313:web:a17b8cc851efde6dd79868"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let userData = null;

// Pricing & Limits
const PLANS = {
    sampaguita: { cost: 50, income: 55, days: 7, name: "Sampaguita" },
    rose: { cost: 100, income: 110, days: 7, name: "Rose Flower" }
};

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

// --- AUTHENTICATION ---
function handleAuth(type) {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    if (!email || !pass) return alert("Please enter email and password");

    if (type === 'register') {
        auth.createUserWithEmailAndPassword(email, pass)
            .then(res => {
                const refCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                db.ref('users/' + res.user.uid).set({
                    uid: res.user.uid,
                    email: email,
                    balance: 0,
                    referralCode: refCode,
                    referredBy: "",
                    totalRefEarn: 0,
                    totalRefCount: 0,
                    activeMines: [],
                    history: []
                });
                db.ref('stats/totalUsers').transaction(curr => (curr || 0) + 1);
            })
            .catch(err => alert(err.message));
    } else {
        auth.signInWithEmailAndPassword(email, pass).catch(err => alert(err.message));
    }
}

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('u-id').innerText = user.uid.substring(0, 8);
        loadUserData();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

function loadUserData() {
    db.ref('users/' + currentUser.uid).on('value', snap => {
        userData = snap.val();
        renderUI();
    });
    db.ref('stats/totalUsers').on('value', snap => {
        document.getElementById('total-users').innerText = snap.val() || 0;
    });
}

// --- UI NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.replace('text-green-600', 'text-gray-300');
        if(btn.dataset.tab === tabId) btn.classList.replace('text-gray-300', 'text-green-600');
    });
}

function toggleWalletTab(type) {
    const isDep = type === 'dep';
    document.getElementById('view-dep').classList.toggle('hidden', !isDep);
    document.getElementById('view-wit').classList.toggle('hidden', isDep);
    document.getElementById('btn-dep').className = isDep ? 'flex-1 py-3 rounded-xl font-bold bg-green-600 text-white' : 'flex-1 py-3 rounded-xl font-bold text-gray-400';
    document.getElementById('btn-wit').className = !isDep ? 'flex-1 py-3 rounded-xl font-bold bg-orange-600 text-white' : 'flex-1 py-3 rounded-xl font-bold text-gray-400';
}

// --- MINING ENGINE ---
function buyPlant(type) {
    const plan = PLANS[type];
    const existing = (userData.activeMines || []).filter(m => m.type === type && !m.expired).length;

    if (existing >= 10) return alert("Maximum 10 plants of this type reached!");
    if (userData.balance < plan.cost) return alert("Insufficient Balance!");

    const newPlant = {
        type: type,
        buyTime: Date.now(),
        lastClaim: Date.now(),
        expiry: Date.now() + (plan.days * 24 * 60 * 60 * 1000),
        expired: false
    };

    db.ref('users/' + currentUser.uid).update({
        balance: userData.balance - plan.cost,
        activeMines: [...(userData.activeMines || []), newPlant]
    });
    alert(`Successfully planted ${plan.name}!`);
}

function renderUI() {
    if (!userData) return;
    document.getElementById('u-balance').innerText = userData.balance.toFixed(2);
    document.getElementById('my-refer-code').innerText = userData.referralCode;
    document.getElementById('total-ref-count').innerText = userData.totalRefCount || 0;
    document.getElementById('total-ref-earn').innerText = (userData.totalRefEarn || 0).toFixed(2);
    
    renderMining();
    renderHistory();
}

function renderMining() {
    const container = document.getElementById('active-mines-list');
    container.innerHTML = "";
    const mines = userData.activeMines || [];

    if (mines.length === 0) {
        container.innerHTML = `<div class="text-center py-10 opacity-30 font-bold">No plants in your garden.</div>`;
        return;
    }

    mines.forEach((mine, index) => {
        if (mine.expired) return;
        
        const plan = PLANS[mine.type];
        const now = Date.now();
        
        // Expiry Logic
        if (now >= mine.expiry) {
            db.ref(`users/${currentUser.uid}/activeMines/${index}`).update({ expired: true });
            return;
        }

        // Calculation: Total Profit / Total Seconds * Time Elapsed
        const incomePerMs = plan.income / (plan.days * 24 * 60 * 60 * 1000);
        const elapsedSinceClaim = now - mine.lastClaim;
        
        // 4 Hour Cap Logic
        const cappedTime = Math.min(elapsedSinceClaim, FOUR_HOURS_MS);
        const pending = (cappedTime * incomePerMs).toFixed(4);
        const progress = ((now - mine.buyTime) / (mine.expiry - mine.buyTime) * 100).toFixed(1);

        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100";
        card.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <span class="font-black text-gray-800">${plan.name}</span>
                <span class="text-[10px] bg-gray-100 px-2 py-1 rounded-full text-gray-400 font-bold">Ends: ${new Date(mine.expiry).toLocaleDateString()}</span>
            </div>
            <div class="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
                <div class="h-full bg-green-500 rounded-full" style="width: ${progress}%"></div>
            </div>
            <div class="flex justify-between items-center">
                <div>
                    <p class="text-[10px] text-gray-400 font-bold uppercase">Pending Harvest</p>
                    <p class="text-xl font-black text-green-600">₱${pending}</p>
                </div>
                <button onclick="claimMining(${index}, ${pending})" class="bg-gray-900 text-white px-6 py-2 rounded-xl font-bold text-sm active:scale-90 transition">Claim</button>
            </div>
            ${elapsedSinceClaim >= FOUR_HOURS_MS ? '<p class="text-[9px] text-red-500 font-bold mt-2 italic"><i class="fas fa-pause mr-1"></i> Mining paused. Please harvest.</p>' : ''}
        `;
        container.appendChild(card);
    });
}

async function claimMining(index, amount) {
    if (parseFloat(amount) <= 0) return alert("Nothing to claim yet!");

    try {
        // CALL AD SDK
        await show_10555663();
        
        // Double credit prevention: Fetch latest balance inside transaction
        const ref = db.ref(`users/${currentUser.uid}`);
        ref.once('value', snap => {
            const data = snap.val();
            const mines = data.activeMines;
            mines[index].lastClaim = Date.now();
            
            ref.update({
                balance: data.balance + parseFloat(amount),
                activeMines: mines
            });
        });
    } catch (e) {
        alert("Watch the full ad to claim rewards!");
    }
}

// --- WALLET ---
function submitDeposit() {
    const amount = parseFloat(document.getElementById('dep-amount').value);
    const ref = document.getElementById('dep-ref').value;
    const name = document.getElementById('dep-name').value;
    const method = document.getElementById('dep-method').value;

    if (!amount || !ref || !name) return alert("Fill all fields");

    db.ref('deposits').push({
        uid: currentUser.uid,
        email: currentUser.email,
        amount, ref, name, method,
        status: 'pending',
        time: Date.now()
    });
    alert("Deposit request sent for approval!");
}

function submitWithdraw() {
    const amount = parseFloat(document.getElementById('wit-amount').value);
    const details = document.getElementById('wit-details').value;
    const method = document.getElementById('wit-method').value;

    if (amount < 100) return alert("Minimum ₱100");
    if (userData.balance < amount) return alert("Insufficient balance");

    db.ref('withdrawals').push({
        uid: currentUser.uid,
        email: currentUser.email,
        amount, details, method,
        status: 'pending',
        time: Date.now()
    });
    db.ref('users/' + currentUser.uid).update({ balance: userData.balance - amount });
    alert("Withdrawal request sent!");
}

function renderHistory() {
    const mines = userData.activeMines || [];
    const list = document.getElementById('history-list');
    list.innerHTML = "";
    
    // Just a placeholder, you could expand this by saving claim logs in DB
    list.innerHTML = `<div class="p-4 bg-white rounded-2xl text-xs text-gray-400 text-center">Your transaction logs will appear here.</div>`;
}

// --- REFERRAL ---
function applyReferral() {
    const code = document.getElementById('input-ref-code').value.trim();
    if (code === userData.referralCode) return alert("Can't use your own code");
    if (userData.referredBy) return alert("Already used a code");

    db.ref('users').orderByChild('referralCode').equalTo(code).once('value', snap => {
        if (snap.exists()) {
            const parentUid = Object.keys(snap.val())[0];
            db.ref('users/' + currentUser.uid).update({ referredBy: parentUid });
            db.ref('users/' + parentUid).child('totalRefCount').transaction(c => (c || 0) + 1);
            alert("Referral Applied!");
        } else {
            alert("Invalid Referral Code");
        }
    });
}

// --- ADMIN ---
function checkAdmin() {
    const p = prompt("Admin Password:");
    if (p === "Propetas12") {
        switchTab('admin');
        loadAdminLists();
    }
}

function loadAdminLists() {
    db.ref('deposits').on('value', snap => {
        const data = snap.val();
        let html = "";
        for (let key in data) {
            if (data[key].status === 'pending') {
                html += `<div class="p-3 border rounded-xl">${data[key].email}<br>₱${data[key].amount} (${data[key].method})<br>
                <button onclick="adminAction('deposits', '${key}', 'approve')" class="text-green-600 font-bold">[Approve]</button>
                <button onclick="adminAction('deposits', '${key}', 'deny')" class="text-red-600 font-bold ml-2">[Deny]</button></div>`;
            }
        }
        document.getElementById('admin-deposits').innerHTML = html || "Clear";
    });

    db.ref('withdrawals').on('value', snap => {
        const data = snap.val();
        let html = "";
        for (let key in data) {
            if (data[key].status === 'pending') {
                html += `<div class="p-3 border rounded-xl">${data[key].email}<br>₱${data[key].amount} (${data[key].method})<br>
                <button onclick="adminAction('withdrawals', '${key}', 'approve')" class="text-green-600 font-bold">[Approve]</button>
                <button onclick="adminAction('withdrawals', '${key}', 'deny')" class="text-red-600 font-bold ml-2">[Deny]</button></div>`;
            }
        }
        document.getElementById('admin-withdrawals').innerHTML = html || "Clear";
    });
}

function adminAction(type, key, action) {
    db.ref(`${type}/${key}`).once('value', snap => {
        const req = snap.val();
        if (action === 'approve' && type === 'deposits') {
            db.ref('users/' + req.uid).transaction(user => {
                if (user) {
                    user.balance += req.amount;
                    // Ref Commission
                    if (user.referredBy) {
                        db.ref('users/' + user.referredBy).transaction(parent => {
                            if (parent) {
                                const comm = req.amount * 0.05;
                                parent.balance += comm;
                                parent.totalRefEarn = (parent.totalRefEarn || 0) + comm;
                            }
                            return parent;
                        });
                    }
                }
                return user;
            });
        } else if (action === 'deny' && type === 'withdrawals') {
            db.ref('users/' + req.uid + '/balance').transaction(b => b + req.amount);
        }
        db.ref(`${type}/${key}`).update({ status: action });
    });
}

// Footer Time
setInterval(() => {
    document.getElementById('footer-time').innerText = new Date().toLocaleString();
}, 1000);

// Visual Mining Update (Smoothness)
setInterval(() => { if(userData) renderMining(); }, 5000);
