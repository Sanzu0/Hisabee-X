const db = {
    state: { pin: null, txs: [], recurring: [], settings: { rate: 120, usd: false } },
    load: () => { const d = localStorage.getItem('hisabee_xpro_db'); if(d) db.state = JSON.parse(d); if(!db.state.settings) db.state.settings = {rate:120, usd:false}; if(!db.state.recurring) db.state.recurring = []; },
    save: () => localStorage.setItem('hisabee_xpro_db', JSON.stringify(db.state))
};

const auth = {
    buffer: [],
    pinStep: 0,
    init: () => { if(!db.state.pin) document.getElementById('auth-msg').innerText = "Create New PIN"; },
    type: (n) => { if(auth.buffer.length < 4) { auth.buffer.push(n); auth.render(); if(auth.buffer.length === 4) setTimeout(auth.validate, 200); } },
    backspace: () => { auth.buffer.pop(); auth.render(); },
    render: () => { const dots = document.querySelectorAll('.pin-dots span'); dots.forEach((d, i) => { d.className = i < auth.buffer.length ? 'filled' : ''; }); },
    validate: () => {
        const pin = auth.buffer.join('');
        if(!db.state.pin) { db.state.pin = pin; db.save(); ui.toast('Welcome to Hisabee X'); auth.unlock(); }
        else {
            if(pin === db.state.pin) auth.unlock();
            else { navigator.vibrate?.(300); document.querySelectorAll('.pin-dots span').forEach(d => d.classList.add('error')); setTimeout(() => { auth.buffer = []; auth.render(); }, 500); }
        }
    },
    biometric: () => ui.toast('Biometric feature coming soon'),
    unlock: () => { document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app-screen').classList.remove('hidden'); core.init(); },
    initPinChange: () => { auth.pinStep = 1; document.getElementById('pin-title').innerText = "Enter Old PIN"; document.getElementById('pin-desc').innerText = "Verify it's you"; document.getElementById('new-pin-inp').value = ""; document.getElementById('pin-dialog').classList.remove('hidden'); },
    processPinChange: () => {
        const inp = document.getElementById('new-pin-inp').value;
        if(inp.length !== 4) return alert("Enter 4 digits");
        if(auth.pinStep === 1) {
            if(inp === db.state.pin) { auth.pinStep = 2; document.getElementById('pin-title').innerText = "Enter New PIN"; document.getElementById('pin-desc').innerText = "Set a secure passcode"; document.getElementById('new-pin-inp').value = ""; } 
            else { ui.toast("Incorrect Old PIN", "error"); document.getElementById('new-pin-inp').value = ""; }
        } else if (auth.pinStep === 2) { db.state.pin = inp; db.save(); ui.toast("PIN Updated Successfully"); document.getElementById('pin-dialog').classList.add('hidden'); auth.pinStep = 0; }
    },
    updatePin: () => {}
};

const core = {
    currentDate: new Date(),
    listFilterType: 'all',
    init: () => {
        const hr = new Date().getHours();
        const greet = hr < 12 ? 'Good Morning' : hr < 18 ? 'Good Afternoon' : 'Good Evening';
        document.getElementById('greeting-time').innerText = greet;
        document.getElementById('set-usd').checked = db.state.settings.usd;
        document.getElementById('set-rate').value = db.state.settings.rate;
        document.getElementById('check-date').value = new Date().toISOString().split('T')[0];
        
        core.processRecurring(); // Check for auto-adds
        core.renderDashboard(); core.calculateSpecificProfit(); core.toggleTimeInput();
    },
    
    // --- RECURRING LOGIC ---
    processRecurring: () => {
        const today = new Date();
        const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
        let added = false;

        db.state.recurring.forEach(rule => {
            if (rule.lastProcessed < currentMonth) {
                // Time to add
                const day = new Date(rule.startDate).getDate();
                const newDate = `${currentMonth}-${String(day).padStart(2, '0')}`;
                
                // Only add if today >= expected date
                if(new Date().getDate() >= day) {
                    const tx = { ...rule.template, id: Date.now() + Math.random(), date: newDate };
                    db.state.txs.push(tx);
                    rule.lastProcessed = currentMonth;
                    added = true;
                }
            }
        });

        if(added) {
            db.save();
            ui.toast("Recurring transactions added!");
        }
    },

    getLifetimeBalance: () => {
        let inc = 0, exp = 0; const rate = parseFloat(db.state.settings.rate);
        db.state.txs.forEach(t => { if(t.status === 'Cancelled') return; let val = parseFloat(t.amount); let bdt = t.currency === 'BDT' ? val : val * rate; if(t.type === 'order') inc += bdt; else exp += bdt; });
        return inc - exp;
    },
    getTodayStats: () => {
        let inc = 0, exp = 0; const rate = parseFloat(db.state.settings.rate);
        const today = new Date().toISOString().split('T')[0];
        db.state.txs.forEach(t => { if(t.status === 'Cancelled' || t.date !== today) return; let val = parseFloat(t.amount); let bdt = t.currency === 'BDT' ? val : val * rate; if(t.type === 'order') inc += bdt; else exp += bdt; });
        return { inc, exp };
    },
    renderDashboard: () => {
        const balance = core.getLifetimeBalance(); const rate = parseFloat(db.state.settings.rate);
        document.getElementById('disp-balance').innerText = core.fmt(balance, 'BDT');
        const el = document.getElementById('disp-sub');
        if(db.state.settings.usd) { const usdBal = balance / rate; el.innerText = `≈ ${core.fmt(usdBal, 'USD')}`; el.style.color = '#fff'; }
        else { el.innerText = 'Tap for USD'; el.style.color = 'var(--primary)'; }
        const today = core.getTodayStats();
        document.getElementById('stat-inc').innerText = core.fmt(today.inc, 'BDT');
        document.getElementById('stat-exp').innerText = core.fmt(today.exp, 'BDT');
        const sorted = [...db.state.txs].sort((a,b) => new Date(b.date) - new Date(a.date));
        core.renderList(sorted.slice(0, 10), 'home-list');
    },
    calculateSpecificProfit: () => {
        const dateVal = document.getElementById('check-date').value; if(!dateVal) return;
        let inc = 0, exp = 0; const rate = parseFloat(db.state.settings.rate);
        db.state.txs.forEach(t => { if(t.status === 'Cancelled' || t.date !== dateVal) return; let val = parseFloat(t.amount); let bdt = t.currency === 'BDT' ? val : val * rate; if(t.type === 'order') inc += bdt; else exp += bdt; });
        document.getElementById('pc-profit').innerText = core.fmt(inc - exp, 'BDT');
        document.getElementById('pc-inc').innerText = core.fmt(inc, 'BDT');
        document.getElementById('pc-exp').innerText = core.fmt(exp, 'BDT');
    },
    changeMonth: (dir) => { core.currentDate.setDate(1); core.currentDate.setMonth(core.currentDate.getMonth() + dir); core.renderCalendar(); },
    renderCalendar: () => {
        const dt = core.currentDate; const year = dt.getFullYear(); const month = dt.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
        document.getElementById('cal-month-year').innerText = dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const grid = document.getElementById('cal-grid'); grid.innerHTML = '';
        for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="cal-day empty"></div>`;
        const todayStr = new Date().toISOString().split('T')[0];
        for(let i=1; i<=daysInMonth; i++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            const hasData = db.state.txs.some(t => t.date === dateStr);
            const div = document.createElement('div'); div.className = `cal-day ${dateStr === todayStr ? 'today' : ''}`;
            div.onclick = () => core.selectDate(dateStr, div);
            div.innerHTML = `${i} ${hasData ? '<span class="dot"></span>' : ''}`;
            grid.appendChild(div);
        }
        document.getElementById('cal-summary').classList.add('hidden');
    },
    selectDate: (dateStr, el) => {
        document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('active')); el.classList.add('active');
        document.getElementById('cal-summary').classList.remove('hidden');
        document.getElementById('csc-date').innerText = new Date(dateStr).toDateString();
        let inc = 0, exp = 0; const rate = parseFloat(db.state.settings.rate);
        db.state.txs.filter(t => t.date === dateStr).forEach(t => { if(t.status === 'Cancelled') return; let val = parseFloat(t.amount); let bdt = t.currency === 'BDT' ? val : val * rate; if(t.type === 'order') inc += bdt; else exp += bdt; });
        document.getElementById('csc-profit').innerText = core.fmt(inc - exp, 'BDT');
        document.getElementById('csc-inc').innerText = core.fmt(inc, 'BDT');
        document.getElementById('csc-exp').innerText = core.fmt(exp, 'BDT');
    },
    toggleTimeInput: () => {
        const mode = document.getElementById('list-time-select').value;
        const container = document.getElementById('time-input-container');
        container.classList.remove('hidden'); container.innerHTML = '';
        if(mode === 'all') { container.classList.add('hidden'); core.renderFilteredList(); }
        else if (mode === 'date') container.innerHTML = `<input type="date" id="filter-val" onchange="core.renderFilteredList()">`;
        else if (mode === 'month') container.innerHTML = `<input type="month" id="filter-val" onchange="core.renderFilteredList()">`;
        else if (mode === 'year') container.innerHTML = `<input type="number" placeholder="YYYY" id="filter-val" oninput="core.renderFilteredList()">`;
    },
    filterType: (type, btn) => { document.querySelectorAll('.f-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); core.listFilterType = type; core.renderFilteredList(); },
    renderFilteredList: () => {
        const timeMode = document.getElementById('list-time-select').value;
        let list = [...db.state.txs].sort((a,b)=>new Date(b.date)-new Date(a.date));
        if(core.listFilterType !== 'all') list = list.filter(t => t.type === core.listFilterType);
        if(timeMode !== 'all') { const val = document.getElementById('filter-val')?.value; if(val) list = list.filter(t => t.date.startsWith(val)); }
        core.renderList(list, 'full-list');
    },
    renderList: (list, containerId) => {
        const con = document.getElementById(containerId); con.innerHTML = '';
        if(!list.length) { con.innerHTML = `<div style="text-align:center; padding:20px; opacity:0.5;">No transactions</div>`; return; }
        list.forEach(t => {
            const isInc = t.type === 'order'; const rate = parseFloat(db.state.settings.rate);
            let icon = isInc ? 'fa-arrow-down' : 'fa-arrow-up';
            if(t.source.includes('Facebook')) icon = 'fa-facebook'; else if(t.source.includes('Food')) icon = 'fa-utensils';
            let mainAmt = t.currency === 'BDT' ? `৳${parseFloat(t.amount).toLocaleString()}` : `$${parseFloat(t.amount).toLocaleString()}`;
            let subAmt = isInc ? `${t.payment || 'Cash'} • ${t.date}` : `${t.subSource || t.type} • ${t.date}`;
            if(db.state.settings.usd) { if(t.currency === 'BDT') subAmt = `$${(t.amount/rate).toFixed(2)}`; else subAmt = `৳${(t.amount*rate).toFixed(0)}`; }
            const html = `<div class="tx-item" onclick="ui.editTx(${t.id})"><div class="tx-left"><div class="cat-icon ${isInc?'inc':'exp'}"><i class="fa-solid ${icon} fa-brands"></i></div><div class="tx-info"><h4>${t.source}</h4><p>${subAmt}</p></div></div><div><span class="tx-amt ${isInc?'inc':'exp'}">${isInc?'+':'-'}${mainAmt}</span></div></div>`;
            con.innerHTML += html;
        });
    },
    saveTx: (e) => {
        e.preventDefault(); const type = document.getElementById('tx-type').value; const id = document.getElementById('edit-id').value;
        const tx = { id: id ? parseInt(id) : Date.now(), type, amount: document.getElementById('inp-amount').value, currency: document.getElementById('inp-currency').value, date: document.getElementById('inp-date').value, source: document.getElementById('inp-source').value };
        if(type === 'order') { tx.status = document.getElementById('inp-status').value; tx.payment = document.getElementById('inp-payment').value; }
        else { if(tx.source === 'Marketing') tx.subSource = document.getElementById('inp-sub').value; }
        
        // Handle Recurring
        const isRecurring = document.getElementById('inp-recurring').checked;
        if(isRecurring && !id) { // Only new entries can set recurrence to avoid dupes
            db.state.recurring.push({
                id: Date.now(),
                startDate: tx.date,
                template: tx,
                lastProcessed: tx.date.slice(0, 7) // Mark current month as processed
            });
            ui.toast("Recurring rule saved!");
        }

        if(id) { const idx = db.state.txs.findIndex(t => t.id == id); db.state.txs[idx] = tx; ui.toast('Updated'); } else { db.state.txs.push(tx); ui.toast('Saved'); }
        db.save(); ui.closeModal(); core.renderDashboard(); core.calculateSpecificProfit();
    },
    deleteTx: () => { if(confirm('Delete?')) { const id = document.getElementById('edit-id').value; db.state.txs = db.state.txs.filter(t => t.id != id); db.save(); ui.closeModal(); core.renderDashboard(); core.calculateSpecificProfit(); ui.toast('Deleted', 'error'); } },
    fmt: (n, c) => n.toLocaleString('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }),
    toggleCurrency: () => { db.state.settings.usd = !db.state.settings.usd; core.saveSettings(); },
    saveSettings: () => { db.state.settings.usd = document.getElementById('set-usd').checked; db.state.settings.rate = document.getElementById('set-rate').value; db.save(); core.renderDashboard(); },
    search: (val) => { val = val.toLowerCase(); const filtered = db.state.txs.filter(t => t.source.toLowerCase().includes(val) || t.amount.includes(val)); core.renderList(filtered, 'home-list'); if(!val) core.renderDashboard(); },
    filterList: (type, btn) => { document.querySelectorAll('.f-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); core.listFilterType = type; core.renderFilteredList(); }
};

const ui = {
    toggleSearch: () => { document.getElementById('search-layer').classList.toggle('hidden'); document.getElementById('search-inp').focus(); },
    navigate: (target) => { document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden')); document.getElementById(`view-${target}`).classList.remove('hidden'); document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('active')); document.querySelector(`.dock-btn[data-target="${target}"]`)?.classList.add('active'); if(target === 'list') core.renderFilteredList(); if(target === 'calendar') core.renderCalendar(); },
    openModal: (type) => { document.getElementById('edit-id').value = ''; document.getElementById('tx-form').reset(); document.getElementById('inp-date').value = new Date().toISOString().split('T')[0]; document.getElementById('btn-delete').classList.add('hidden'); document.getElementById('sheet-title').innerText = "New Transaction"; ui.setType(type); document.getElementById('sheet-overlay').classList.remove('hidden'); },
    closeModal: () => document.getElementById('sheet-overlay').classList.add('hidden'),
    setType: (t) => {
        document.getElementById('tx-type').value = t; document.querySelectorAll('.pill').forEach(p => p.classList.remove('active')); document.getElementById(`pill-${t}`).classList.add('active');
        const sel = document.getElementById('inp-source'); sel.innerHTML = ''; const opts = t === 'order' ? ['Facebook', 'Instagram', 'YouTube', 'Website', 'WhatsApp', 'Other'] : ['Marketing', 'Tools', 'Salary', 'Rent', 'Food', 'Logistics', 'Other'];
        opts.forEach(o => sel.innerHTML += `<option value="${o}">${o}</option>`);
        if(t === 'order') { document.getElementById('order-fields').classList.remove('hidden'); document.getElementById('extra-fields').classList.add('hidden'); } else { document.getElementById('order-fields').classList.add('hidden'); ui.checkMarketing(); }
        sel.onchange = () => ui.checkMarketing();
    },
    checkMarketing: () => { if(document.getElementById('tx-type').value === 'expense' && document.getElementById('inp-source').value === 'Marketing') document.getElementById('extra-fields').classList.remove('hidden'); else document.getElementById('extra-fields').classList.add('hidden'); },
    editTx: (id) => {
        const t = db.state.txs.find(x => x.id == id); if(!t) return;
        document.getElementById('edit-id').value = id; document.getElementById('sheet-title').innerText = "Edit Transaction";
        ui.setType(t.type); // Set UI first to populate dropdowns
        document.getElementById('inp-amount').value = t.amount; document.getElementById('inp-currency').value = t.currency; document.getElementById('inp-date').value = t.date; document.getElementById('inp-source').value = t.source;
        if(t.type === 'order') { document.getElementById('inp-status').value = t.status; document.getElementById('inp-payment').value = t.payment || 'Cash'; }
        else { ui.checkMarketing(); if(t.subSource) document.getElementById('inp-sub').value = t.subSource; }
        document.getElementById('btn-delete').classList.remove('hidden'); document.getElementById('sheet-overlay').classList.remove('hidden');
    },
    toast: (msg, type='success') => { const box = document.getElementById('toast-box'); const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = type === 'success' ? `<i class="fa-solid fa-check"></i> ${msg}` : `<i class="fa-solid fa-trash"></i> ${msg}`; if(type==='error') d.style.borderColor = 'var(--danger)'; box.appendChild(d); setTimeout(() => d.remove(), 2500); },
    showPinModal: () => document.getElementById('pin-dialog').classList.remove('hidden')
};

const pwa = {
    prompt: null,
    init: () => {
        window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pwa.prompt = e; document.getElementById('install-banner').classList.remove('hidden'); });
    },
    install: () => {
        if(pwa.prompt) { pwa.prompt.prompt(); pwa.prompt.userChoice.then((choice) => { if(choice.outcome === 'accepted') document.getElementById('install-banner').classList.add('hidden'); pwa.prompt = null; }); }
    }
};

const data = {
    reset: () => { document.getElementById('reset-dialog').classList.remove('hidden'); },
    confirmReset: () => { localStorage.clear(); location.reload(); },
    export: () => { const blob = new Blob([JSON.stringify(db.state)], {type: 'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `HisabeeX_${new Date().toISOString().slice(0,10)}.json`; a.click(); },
    import: (el) => { const reader = new FileReader(); reader.onload = (e) => { try { db.state = JSON.parse(e.target.result); db.save(); location.reload(); } catch(err) { alert('Invalid File'); } }; reader.readAsText(el.files[0]); }
};

window.onload = () => { db.load(); auth.init(); pwa.init(); };