'use strict';

/* ─────────────────────────────────────────────
   STORAGE
───────────────────────────────────────────── */
const STORE = {
  get(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

/* Load data */
let baseBalance  = STORE.get('et_base', 0);       // manually set balance
let transactions = STORE.get('et_txns', []);       // array of {id, type, reason, amount, date}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatMoney(n) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ─────────────────────────────────────────────
   COMPUTED BALANCE
   balance = baseBalance + all income - all expenses
───────────────────────────────────────────── */
function calcBalance() {
  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { balance: baseBalance + income - expense, income, expense };
}

/* ─────────────────────────────────────────────
   RENDER UI
───────────────────────────────────────────── */
function render() {
  const { balance, income, expense } = calcBalance();

  /* Balance display */
  const balEl = document.getElementById('balanceDisplay');
  balEl.textContent = formatMoney(balance);
  balEl.className = 'balance-amount ' + (balance < 0 ? 'negative' : 'positive');

  /* Trigger bump animation */
  balEl.classList.remove('bump');
  void balEl.offsetWidth;          // reflow trick
  balEl.classList.add('bump');

  /* Pills */
  document.getElementById('totalIncome').textContent  = formatMoney(income);
  document.getElementById('totalExpense').textContent = formatMoney(expense);

  /* Transaction list */
  const list  = document.getElementById('txnList');
  const empty = document.getElementById('emptyState');
  list.innerHTML = '';

  if (transactions.length === 0) {
    list.appendChild(empty);
    return;
  }

  /* Newest first */
  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(txn => {
    const item = document.createElement('div');
    item.className = 'txn-item';

    const sign  = txn.type === 'income' ? '+' : '−';
    const emoji = txn.type === 'income' ? '↑' : '↓';

    item.innerHTML = `
      <div class="txn-icon ${txn.type}">${emoji}</div>
      <div class="txn-info">
        <div class="txn-reason">${escHtml(txn.reason)}</div>
        <div class="txn-time">${formatDateTime(txn.date)}</div>
      </div>
      <div class="txn-right">
        <div class="txn-amount ${txn.type}">${sign}${formatMoney(txn.amount)}</div>
      </div>
      <button class="txn-delete" data-id="${txn.id}" title="Delete">✕</button>
    `;

    item.querySelector('.txn-delete').addEventListener('click', () => {
      deleteTxn(txn.id);
    });

    list.appendChild(item);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─────────────────────────────────────────────
   DELETE TRANSACTION
───────────────────────────────────────────── */
function deleteTxn(id) {
  transactions = transactions.filter(t => t.id !== id);
  STORE.set('et_txns', transactions);
  render();
  showToast('Transaction deleted');
}

/* ─────────────────────────────────────────────
   MODALS – helpers
───────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open');    }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* Close when clicking the dark backdrop */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

/* ─────────────────────────────────────────────
   SET BALANCE MODAL
───────────────────────────────────────────── */
document.getElementById('btnSetBalance').addEventListener('click', () => {
  document.getElementById('balanceInput').value = baseBalance || '';
  openModal('balanceModal');
  setTimeout(() => document.getElementById('balanceInput').focus(), 100);
});

document.getElementById('cancelBalance').addEventListener('click', () => closeModal('balanceModal'));

document.getElementById('confirmBalance').addEventListener('click', () => {
  const val = parseFloat(document.getElementById('balanceInput').value);
  if (isNaN(val) || val < 0) { showToast('❌ Enter a valid balance'); return; }
  baseBalance = val;
  STORE.set('et_base', baseBalance);
  closeModal('balanceModal');
  render();
  showToast('✅ Balance updated to ' + formatMoney(val));
});

/* Allow Enter key */
document.getElementById('balanceInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('confirmBalance').click();
});

/* ─────────────────────────────────────────────
   ADD INCOME MODAL
───────────────────────────────────────────── */
document.getElementById('btnAddIncome').addEventListener('click', () => {
  document.getElementById('incomeReason').value = '';
  document.getElementById('incomeAmount').value = '';
  openModal('incomeModal');
  setTimeout(() => document.getElementById('incomeReason').focus(), 100);
});

document.getElementById('cancelIncome').addEventListener('click', () => closeModal('incomeModal'));

document.getElementById('confirmIncome').addEventListener('click', () => {
  const reason = document.getElementById('incomeReason').value.trim();
  const amount = parseFloat(document.getElementById('incomeAmount').value);

  if (!reason)               { showToast('❌ Please enter a reason'); return; }
  if (!amount || amount <= 0){ showToast('❌ Please enter a valid amount'); return; }

  transactions.push({ id: uid(), type: 'income', reason, amount, date: new Date().toISOString() });
  STORE.set('et_txns', transactions);
  closeModal('incomeModal');
  render();
  showToast('✅ Income of ' + formatMoney(amount) + ' added!');
});

/* Enter on amount field triggers confirm */
document.getElementById('incomeAmount').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('confirmIncome').click();
});

/* ─────────────────────────────────────────────
   ADD EXPENSE MODAL
───────────────────────────────────────────── */
document.getElementById('btnAddExpense').addEventListener('click', () => {
  document.getElementById('expenseReason').value = '';
  document.getElementById('expenseAmount').value = '';
  openModal('expenseModal');
  setTimeout(() => document.getElementById('expenseReason').focus(), 100);
});

document.getElementById('cancelExpense').addEventListener('click', () => closeModal('expenseModal'));

document.getElementById('confirmExpense').addEventListener('click', () => {
  const reason = document.getElementById('expenseReason').value.trim();
  const amount = parseFloat(document.getElementById('expenseAmount').value);

  if (!reason)               { showToast('❌ Please enter a reason'); return; }
  if (!amount || amount <= 0){ showToast('❌ Please enter a valid amount'); return; }

  transactions.push({ id: uid(), type: 'expense', reason, amount, date: new Date().toISOString() });
  STORE.set('et_txns', transactions);
  closeModal('expenseModal');
  render();
  showToast('✅ Expense of ' + formatMoney(amount) + ' added!');
});

document.getElementById('expenseAmount').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('confirmExpense').click();
});

/* ─────────────────────────────────────────────
   CLEAR ALL
───────────────────────────────────────────── */
document.getElementById('btnClearAll').addEventListener('click', () => {
  if (transactions.length === 0) { showToast('Nothing to clear'); return; }
  if (!window.confirm('Delete all transactions? Your set balance will stay.')) return;
  transactions = [];
  STORE.set('et_txns', transactions);
  render();
  showToast('🗑 All transactions cleared');
});

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
render();
