(function () {
    const CATEGORIES = {
        income: ['Salary', 'Freelance', 'Investments', 'Gift', 'Other'],
        expense: ['Food', 'Home', 'Transport', 'Leisure', 'Health', 'Shopping', 'Education', 'Other']
    };
    const CAT_COLORS = ['#DC2626', '#D97706', '#16A34A', '#4F46E5', '#0891B2', '#7C3AED', '#DB2777', '#57534E'];
    const catColor = cat => { const i = CATEGORIES.expense.indexOf(cat); return CAT_COLORS[i >= 0 ? i % CAT_COLORS.length : 0]; };
    const money = v => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(v || 0);

    async function api(path, options = {}) {
        const res = await fetch('/api' + path, {
            method: options.method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        let data = null;
        try { data = await res.json(); } catch { }
        if (!res.ok) throw new Error((data && data.error) || 'Request error.');
        return data;
    }

    let currentUser = null;
    let transactions = [], budgets = [], goals = [];
    let currentMonth = new Date().toISOString().slice(0, 7);

    const loginScreen = document.getElementById('loginScreen');
    const appEl = document.getElementById('app');
    const tabSignIn = document.getElementById('tabSignIn');
    const tabSignUp = document.getElementById('tabSignUp');
    const authForm = document.getElementById('authForm');
    const authMsg = document.getElementById('authMsg');
    const authSubmit = document.getElementById('authSubmit');
    let authMode = 'signin';

    function setAuthMode(mode) {
        authMode = mode;
        tabSignIn.classList.toggle('active', mode === 'signin');
        tabSignUp.classList.toggle('active', mode === 'signup');
        authSubmit.textContent = mode === 'signin' ? 'Login' : 'Register';

        document.getElementById('authPassword').autocomplete =
            mode === 'signin' ? 'current-password' : 'new-password';

        authMsg.textContent = '';
        authMsg.className = 'login-msg';
    }
    tabSignIn.addEventListener('click', () => setAuthMode('signin'));
    tabSignUp.addEventListener('click', () => setAuthMode('signup'));

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        if (!email || !password || password.length < 6) { authMsg.textContent = 'Provide an email and a password.'; authMsg.className = 'login-msg error'; return; }
        authSubmit.disabled = true;
        try {
            const user = await api(authMode === 'signin' ? '/auth/login' : '/auth/register', { method: 'POST', body: { email, password } });
            currentUser = user;
            await enterApp();
        } catch (err) {
            authMsg.textContent = err.message;
            authMsg.className = 'login-msg error';
        } finally {
            authSubmit.disabled = false;
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await api('/auth/logout', { method: 'POST' });
        } finally {
            currentUser = null;
            appEl.hidden = true;
            loginScreen.hidden = false;
        }
    });

    async function enterApp() {
        loginScreen.hidden = true;
        appEl.hidden = false;
        document.getElementById('userEmail').textContent = currentUser.email;
        await loadAllData();
    }

    async function tryResumeSession() {
        try {
            currentUser = await api('/auth/me');
            await enterApp();
        } catch {
            const params = new URLSearchParams(window.location.search);
            if (params.get('mode') === 'register') setAuthMode('signup');
            loginScreen.hidden = false;
        }
    }

    async function loadAllData() {
        const [tx, bud, gl] = await Promise.all([api('/transactions'), api('/budgets'), api('/goals')]);
        transactions = tx; budgets = bud; goals = gl;
        renderAll();
    }

    const monthLabelEl = document.getElementById('monthLabel');
    const monthFormatter = new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric' });
    function renderMonthLabel() { monthLabelEl.textContent = monthFormatter.format(new Date(currentMonth + '-02')); }
    document.getElementById('prevMonth').addEventListener('click', () => { const d = new Date(currentMonth + '-02'); d.setMonth(d.getMonth() - 1); currentMonth = d.toISOString().slice(0, 7); renderAll(); });
    document.getElementById('nextMonth').addEventListener('click', () => { const d = new Date(currentMonth + '-02'); d.setMonth(d.getMonth() + 1); currentMonth = d.toISOString().slice(0, 7); renderAll(); });

    const entryForm = document.getElementById('entryForm');
    const fCategory = document.getElementById('fCategory');
    const fDate = document.getElementById('fDate');
    let currentType = 'expense';
    function populateCategorySelect(sel, type) { sel.innerHTML = CATEGORIES[type].map(c => `<option value="${c}">${c}</option>`).join(''); }
    populateCategorySelect(fCategory, currentType);
    document.querySelectorAll('.type-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); currentType = btn.dataset.type; populateCategorySelect(fCategory, currentType);
    }));
    document.getElementById('toggleForm').addEventListener('click', () => {
        entryForm.classList.toggle('open');
        if (entryForm.classList.contains('open')) fDate.value = new Date().toISOString().slice(0, 10);
    });
    document.getElementById('cancelForm').addEventListener('click', () => entryForm.classList.remove('open'));

    entryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const desc = document.getElementById('fDesc').value.trim();
        const amount = parseFloat(document.getElementById('fAmount').value);
        const date = fDate.value;
        const errEl = document.getElementById('formError');
        if (!desc || !amount || amount <= 0 || !date) { errEl.classList.add('show'); return; }
        errEl.classList.remove('show');
        try {
            const tx = await api('/transactions', { method: 'POST', body: { date, type: currentType, category: fCategory.value, description: desc, amount: Math.round(amount * 100) / 100 } });
            transactions.unshift(tx);
            document.getElementById('fDesc').value = ''; document.getElementById('fAmount').value = '';
            entryForm.classList.remove('open'); currentMonth = date.slice(0, 7);
            renderAll();
        } catch (err) { errEl.textContent = err.message; errEl.classList.add('show'); }
    });
    async function deleteTransaction(id) { await api('/transactions/' + id, { method: 'DELETE' }); transactions = transactions.filter(t => t.id !== id); renderAll(); }

    const bCategory = document.getElementById('bCategory');
    populateCategorySelect(bCategory, 'expense');
    document.getElementById('budgetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const limit = parseFloat(document.getElementById('bLimit').value);
        if (!limit || limit <= 0) return;
        const category = bCategory.value;
        const b = await api('/budgets', { method: 'POST', body: { category, limit_amount: Math.round(limit * 100) / 100 } });
        budgets = budgets.filter(x => x.category !== category); budgets.push(b);
        document.getElementById('bLimit').value = ''; renderAll();
    });
    async function deleteBudget(id) { await api('/budgets/' + id, { method: 'DELETE' }); budgets = budgets.filter(b => b.id !== id); renderAll(); }

    const goalForm = document.getElementById('goalForm');
    document.getElementById('toggleGoalForm').addEventListener('click', () => goalForm.classList.toggle('open'));
    document.getElementById('cancelGoalForm').addEventListener('click', () => goalForm.classList.remove('open'));
    goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('gName').value.trim();
        const target = parseFloat(document.getElementById('gTarget').value);
        const current = parseFloat(document.getElementById('gCurrent').value) || 0;
        const errEl = document.getElementById('goalError');
        if (!name || !target || target <= 0) { errEl.classList.add('show'); return; }
        errEl.classList.remove('show');
        try {
            const g = await api('/goals', { method: 'POST', body: { name, target: Math.round(target * 100) / 100, current: Math.round(current * 100) / 100 } });
            goals.push(g);
            document.getElementById('gName').value = ''; document.getElementById('gTarget').value = ''; document.getElementById('gCurrent').value = '0';
            goalForm.classList.remove('open'); renderAll();
        } catch (err) { errEl.textContent = err.message; errEl.classList.add('show'); }
    });
    async function contributeGoal(id, amount) {
        if (!amount || amount <= 0) return;
        const g = await api('/goals/' + id + '/contribute', { method: 'PATCH', body: { amount } });
        goals = goals.map(x => x.id === id ? g : x); renderAll();
    }
    async function deleteGoal(id) { await api('/goals/' + id, { method: 'DELETE' }); goals = goals.filter(g => g.id !== id); renderAll(); }

    function exportRows() {
        return transactions.slice().sort((a, b) => a.date.localeCompare(b.date)).map(t => ({
            Date: t.date, Type: t.type === 'income' ? 'Income' : 'Expense', Category: t.category,
            Description: t.description, 'Amount (€)': Number(t.amount).toFixed(2)
        }));
    }
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
    document.getElementById('exportCsv').addEventListener('click', () => {
        const rows = exportRows(); if (rows.length === 0) return;
        const headers = Object.keys(rows[0]); const esc = v => `"${String(v).replace(/"/g, '""')}"`;
        const lines = [headers.join(';'), ...rows.map(r => headers.map(h => esc(r[h])).join(';'))];
        downloadBlob(new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), 'montra.csv');
    });
    document.getElementById('exportXlsx').addEventListener('click', () => {
        const rows = exportRows(); if (rows.length === 0) return;
        const ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 32 }, { wch: 12 }];
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Entries'); XLSX.writeFile(wb, 'montra.xlsx');
    });

    function monthTransactions() { return transactions.filter(t => t.date.slice(0, 7) === currentMonth); }

    function renderSummary() {
        const txs = monthTransactions();
        const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const balance = income - expense;
        document.getElementById('totalIncome').textContent = money(income);
        document.getElementById('totalExpense').textContent = money(expense);
        const balEl = document.getElementById('totalBalance');
        balEl.textContent = money(balance); balEl.className = 'val num ' + (balance >= 0 ? 'positive' : 'negative');
    }

    function renderLedger() {
        const list = document.getElementById('ledgerList');
        const txs = monthTransactions().slice().sort((a, b) => b.date.localeCompare(a.date));
        const hasAny = transactions.length > 0;
        document.getElementById('exportCsv').disabled = !hasAny;
        document.getElementById('exportXlsx').disabled = !hasAny;
        if (txs.length === 0) { list.innerHTML = `<div class="empty">No entries yet this month.<br>Register the first one with the button above.</div>`; return; }
        const groups = {}; txs.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
        const dateFmt = new Intl.DateTimeFormat('en-IE', { day: '2-digit', month: 'short' });
        let html = '';
        Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(date => {
            html += `<div class="list-date">${dateFmt.format(new Date(date + 'T00:00:00'))}</div>`;
            groups[date].forEach(t => {
                const color = t.type === 'income' ? '#16A34A' : catColor(t.category);
                html += `<div class="tx-row">
          <span class="cat-dot" style="background:${color}"></span>
          <div class="body"><div class="desc">${escapeHtml(t.description)}</div><div class="cat">${escapeHtml(t.category)}</div></div>
          <span class="amt ${t.type}">${t.type === 'income' ? '+' : '−'} ${money(t.amount)}</span>
          <button class="del-btn" aria-label="Delete entry" data-del-tx="${t.id}">×</button>
        </div>`;
            });
        });
        list.innerHTML = html;
        list.querySelectorAll('[data-del-tx]').forEach(btn => btn.addEventListener('click', () => deleteTransaction(btn.dataset.delTx)));
    }

    function renderCategoryBreakdown() {
        const el = document.getElementById('categoryBreakdown');
        document.getElementById('expenseMonthHint').textContent = monthLabelEl.textContent;
        const txs = monthTransactions().filter(t => t.type === 'expense');
        if (txs.length === 0) { el.innerHTML = `<div class="empty">No expenses registered this month.</div>`; return; }
        const totals = {}; txs.forEach(t => { totals[t.category] = (totals[t.category] || 0) + Number(t.amount); });
        const max = Math.max(...Object.values(totals));
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        el.innerHTML = sorted.map(([cat, val]) => {
            const color = catColor(cat); const pct = max > 0 ? Math.round((val / max) * 100) : 0;
            return `<div class="bar-row"><div class="bar-top"><span class="name"><span class="sw" style="background:${color}"></span>${escapeHtml(cat)}</span><span class="val">${money(val)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${color}"></div></div></div>`;
        }).join('');
    }

    function renderBudgets() {
        const el = document.getElementById('budgetList');
        if (budgets.length === 0) { el.innerHTML = `<div class="empty">No budgets defined. Set a monthly limit per category below.</div>`; return; }
        const spentBy = {}; monthTransactions().filter(t => t.type === 'expense').forEach(t => { spentBy[t.category] = (spentBy[t.category] || 0) + Number(t.amount); });
        el.innerHTML = budgets.map(b => {
            const spent = spentBy[b.category] || 0; const limit = Number(b.limit_amount);
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            let cls = ''; if (spent > limit) cls = 'over'; else if (pct >= 80) cls = 'warn';
            return `<div class="budget-row"><div class="budget-top"><span class="cat">${escapeHtml(b.category)}</span><span class="figs">${money(spent)} / ${money(limit)}</span></div>
      <div class="budget-track"><div class="budget-fill ${cls}" style="width:${pct}%"></div></div>
      <button class="budget-del" data-del-budget="${b.id}">Delete budget</button></div>`;
        }).join('');
        el.querySelectorAll('[data-del-budget]').forEach(btn => btn.addEventListener('click', () => deleteBudget(btn.dataset.delBudget)));
    }

    function ringSvg(pct) {
        const r = 22, c = 2 * Math.PI * r, offset = c - (Math.min(pct, 100) / 100) * c;
        return `<svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r="${r}" fill="none" stroke="#E4E4E7" stroke-width="5"/>
      <circle cx="26" cy="26" r="${r}" fill="none" stroke="${pct >= 100 ? '#16A34A' : '#4F46E5'}" stroke-width="5" stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
    </svg>`;
    }

    function renderGoals() {
        const el = document.getElementById('goalList');
        if (goals.length === 0) { el.innerHTML = `<div class="empty">No savings goals yet. Create one to start saving.</div>`; return; }
        el.innerHTML = goals.map(g => {
            const pct = g.target > 0 ? Math.round((Number(g.current) / Number(g.target)) * 100) : 0;
            return `<div class="goal-card"><div class="ring-wrap">${ringSvg(pct)}<div class="ring-pct">${pct}%</div></div>
      <div class="goal-info"><div class="name">${escapeHtml(g.name)}</div><div class="figs">${money(g.current)} of ${money(g.target)}</div>
      <div class="goal-add"><input type="number" min="1" step="1" placeholder="€" data-goal-input="${g.id}"><button data-goal-add="${g.id}">Add</button></div></div>
      <button class="goal-del" aria-label="Delete goal" data-del-goal="${g.id}">×</button></div>`;
        }).join('');
        el.querySelectorAll('[data-goal-add]').forEach(btn => btn.addEventListener('click', () => {
            const id = btn.dataset.goalAdd; const input = el.querySelector(`[data-goal-input="${id}"]`);
            const val = parseFloat(input.value);
            if (val > 0) { contributeGoal(id, val); } else { input.style.borderColor = '#DC2626'; }
        }));
        el.querySelectorAll('[data-del-goal]').forEach(btn => btn.addEventListener('click', () => deleteGoal(btn.dataset.delGoal)));
    }

    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function renderAll() { renderMonthLabel(); renderSummary(); renderLedger(); renderCategoryBreakdown(); renderBudgets(); renderGoals(); }

    tryResumeSession();
})();