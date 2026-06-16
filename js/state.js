/**
 * Quantum Ledger Centralized State Management
 * Event-Driven architecture with LocalStorage integration
 */

// Local Storage Keys
const KEYS = {
    TRANSACTIONS: 'ql_v2_transactions',
    BUDGETS: 'ql_v2_budgets',
    GLOBAL_BUDGET: 'ql_v2_global_budget',
    GOALS: 'ql_v2_savings_goals',
    LOGS: 'ql_v2_statement_logs',
    SETTINGS: 'ql_v2_settings'
};

// Memory storage fallback cache for restricted filesystem environments (e.g. file:// CORS blocks)
let memoryStorage = {};

const safeStorage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn(`Storage read blocked for key "${key}", using memory backup.`, e);
            return memoryStorage[key] || null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn(`Storage write blocked for key "${key}", using memory backup.`, e);
            memoryStorage[key] = value;
        }
    },
    clear() {
        try {
            localStorage.clear();
        } catch (e) {
            console.warn('Storage clear blocked, using memory backup.', e);
        }
        memoryStorage = {};
    }
};

// Initial data starts completely empty (0/blank) on clean slate
const DEFAULT_BLANK_DATA = {
    transactions: [],
    budgets: [],
    globalBudget: 0,
    goals: [],
    settings: {
        theme: 'dark'
    },
    logs: []
};

// Application State Cache
let state = {
    transactions: [],
    budgets: [],
    globalBudget: 0,
    goals: [],
    statementLogs: [],
    settings: { theme: 'dark' }
};

/**
 * Initialize State from LocalStorage or Load Default Blank Slate
 */
function initializeState() {
    try {
        state.transactions = JSON.parse(safeStorage.getItem(KEYS.TRANSACTIONS));
        state.budgets = JSON.parse(safeStorage.getItem(KEYS.BUDGETS));
        state.globalBudget = parseFloat(safeStorage.getItem(KEYS.GLOBAL_BUDGET));
        state.goals = JSON.parse(safeStorage.getItem(KEYS.GOALS));
        state.statementLogs = JSON.parse(safeStorage.getItem(KEYS.LOGS)) || [];
        state.settings = JSON.parse(safeStorage.getItem(KEYS.SETTINGS)) || { theme: 'dark' };

        // If no transactions exist, load blank slate
        if (!state.transactions || state.transactions.length === 0) {
            loadBlankSlate();
        }
    } catch (e) {
        console.error('Failed to parse financial database from safeStorage, resetting cache.', e);
        loadBlankSlate();
    }
}

/**
 * Load default blank slate into active cache and save
 */
function loadBlankSlate() {
    state.transactions = [...DEFAULT_BLANK_DATA.transactions];
    state.budgets = [...DEFAULT_BLANK_DATA.budgets];
    state.globalBudget = DEFAULT_BLANK_DATA.globalBudget;
    state.goals = [...DEFAULT_BLANK_DATA.goals];
    state.statementLogs = [...DEFAULT_BLANK_DATA.logs];
    state.settings = { ...DEFAULT_BLANK_DATA.settings };
    saveAllState();
}

/**
 * Save all cache items back to LocalStorage
 */
function saveAllState() {
    safeStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
    safeStorage.setItem(KEYS.BUDGETS, JSON.stringify(state.budgets));
    safeStorage.setItem(KEYS.GLOBAL_BUDGET, state.globalBudget.toString());
    safeStorage.setItem(KEYS.GOALS, JSON.stringify(state.goals));
    safeStorage.setItem(KEYS.LOGS, JSON.stringify(state.statementLogs));
    safeStorage.setItem(KEYS.SETTINGS, JSON.stringify(state.settings));
    notifyStateChanged('reset', null);
}

/**
 * Notify DOM listeners of database alterations to update widgets instantly
 */
function notifyStateChanged(action, payload) {
    document.dispatchEvent(new CustomEvent('financeStateChanged', {
        detail: { action, payload }
    }));
}

/* 
 =================================================================
 FINANCIAL CALCULATION ENGINES
 =================================================================
*/

/**
 * Get Net cash balance (Total Income - Total Expenses)
 */
function getNetBalance() {
    return getTotalIncome() - getTotalExpenses();
}

/**
 * Sum all active incomes
 */
function getTotalIncome() {
    return state.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
}

/**
 * Sum all expenses
 */
function getTotalExpenses() {
    return state.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
}

/**
 * Sum all saved capital inside savings targets
 */
function getTotalSavings() {
    return state.goals.reduce((sum, g) => sum + parseFloat(g.current || 0), 0);
}

/**
 * Calculate active savings rate percentage
 * Formula: ((Income - Expenses) / Income) * 100
 */
function getSavingsRate() {
    const income = getTotalIncome();
    if (income === 0) return 0;
    const rate = ((income - getTotalExpenses()) / income) * 100;
    return Math.max(0, parseFloat(rate.toFixed(1)));
}

/**
 * Compute Financial Health Score (0 - 100)
 * Evaluated on: Savings Rate, Budget Discipline, Spending Habits, Income Consistency
 */
function calculateHealthScore() {
    let score = 50; // Neutral starting score

    const income = getTotalIncome();
    const expenses = getTotalExpenses();
    
    if (income === 0) return 0;

    // 1. Savings Rate Metric (Max 35 points)
    const rate = getSavingsRate();
    if (rate >= 40) score += 35;
    else if (rate >= 25) score += 25;
    else if (rate >= 10) score += 12;
    else if (rate > 0) score += 5;
    else score -= 15; // Deficit spending penalty

    // 2. Budget Discipline (Max 35 points)
    // Compare actual expenses vs category/global budgets
    const globalBudget = getGlobalBudget();
    const currentMonthExpenses = state.transactions
        .filter(t => t.type === 'expense' && isCurrentMonth(t.date))
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    if (globalBudget > 0) {
        const util = (currentMonthExpenses / globalBudget) * 100;
        if (util <= 80) score += 35;
        else if (util <= 100) score += 20;
        else if (util <= 120) score -= 10;
        else score -= 25;
    } else {
        // Fallback: if no budget defined, check if spending is under 70% of income
        const util = (expenses / income) * 100;
        if (util <= 70) score += 30;
        else if (util <= 90) score += 15;
        else score -= 15;
    }

    // 3. Investment Focus (Max 20 points)
    // Detect SIPs or Investment allocations
    const investmentExpenses = state.transactions
        .filter(t => t.type === 'expense' && (t.category === 'Investments' || t.category === 'Insurance'))
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const investmentRate = (investmentExpenses / income) * 100;
    if (investmentRate >= 15) score += 20;
    else if (investmentRate >= 8) score += 12;
    else if (investmentRate > 0) score += 5;

    // 4. Overdraft / Debt EMIs Risk (Max 10 points)
    // EMI payments should ideally stay under 30% of income
    const emiExpenses = state.transactions
        .filter(t => t.type === 'expense' && t.category === 'EMI')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
    const emiRate = (emiExpenses / income) * 100;
    if (emiRate === 0) score += 10;
    else if (emiRate <= 20) score += 5;
    else if (emiRate > 40) score -= 15; // High debt burden penalty

    // Bounds constraint
    return Math.min(100, Math.max(0, score));
}

// Utility check to identify current month transactions
function isCurrentMonth(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

/* 
 =================================================================
 TRANSACTIONS DATABASE CRUD OPERATIONS
 =================================================================
*/

function getTransactions() {
    return state.transactions;
}

function addTransaction(txData) {
    const newTx = {
        id: 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        date: txData.date || new Date().toISOString(),
        type: txData.type,
        category: txData.category,
        description: txData.description,
        amount: parseFloat(txData.amount),
        paymentMethod: txData.paymentMethod || 'UPI',
        notes: txData.notes || ''
    };
    
    state.transactions.unshift(newTx);
    safeStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
    notifyStateChanged('add-transaction', newTx);
    return newTx;
}

function editTransaction(id, updatedData) {
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;
    
    state.transactions[idx] = {
        ...state.transactions[idx],
        date: updatedData.date,
        type: updatedData.type,
        category: updatedData.category,
        description: updatedData.description,
        amount: parseFloat(updatedData.amount),
        paymentMethod: updatedData.paymentMethod,
        notes: updatedData.notes || ''
    };
    
    safeStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
    notifyStateChanged('edit-transaction', state.transactions[idx]);
    return state.transactions[idx];
}

function deleteTransaction(id) {
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx === -1) return false;
    
    const deletedTx = state.transactions.splice(idx, 1)[0];
    safeStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
    notifyStateChanged('delete-transaction', deletedTx);
    return true;
}

/* 
 =================================================================
 BUDGET PLANS CONFIGURATION
 =================================================================
*/

function getBudgets() {
    return state.budgets;
}

function getGlobalBudget() {
    return state.globalBudget || 0;
}

function updateGlobalBudget(amount) {
    state.globalBudget = parseFloat(amount);
    safeStorage.setItem(KEYS.GLOBAL_BUDGET, state.globalBudget.toString());
    notifyStateChanged('update-global-budget', state.globalBudget);
}

function saveCategoryBudget(category, amount) {
    const idx = state.budgets.findIndex(b => b.category === category);
    const parsedAmount = parseFloat(amount);
    
    if (idx > -1) {
        state.budgets[idx].amount = parsedAmount;
    } else {
        state.budgets.push({ category, amount: parsedAmount });
    }
    
    safeStorage.setItem(KEYS.BUDGETS, JSON.stringify(state.budgets));
    notifyStateChanged('save-category-budget', { category, amount: parsedAmount });
}

function deleteCategoryBudget(category) {
    const idx = state.budgets.findIndex(b => b.category === category);
    if (idx === -1) return false;
    
    const deleted = state.budgets.splice(idx, 1)[0];
    safeStorage.setItem(KEYS.BUDGETS, JSON.stringify(state.budgets));
    notifyStateChanged('delete-category-budget', deleted);
    return true;
}

/* 
 =================================================================
 SAVINGS TARGET MILESTONES CRUD
 =================================================================
*/

function getSavingsGoals() {
    return state.goals;
}

function addSavingsGoal(goalData) {
    const newGoal = {
        id: 'g-' + Date.now(),
        title: goalData.title,
        target: parseFloat(goalData.target),
        current: parseFloat(goalData.current || 0),
        deadline: goalData.deadline
    };
    state.goals.push(newGoal);
    safeStorage.setItem(KEYS.GOALS, JSON.stringify(state.goals));
    notifyStateChanged('add-goal', newGoal);
    return newGoal;
}

function editSavingsGoal(id, updatedData) {
    const idx = state.goals.findIndex(g => g.id === id);
    if (idx === -1) return null;
    
    state.goals[idx] = {
        ...state.goals[idx],
        title: updatedData.title,
        target: parseFloat(updatedData.target),
        current: parseFloat(updatedData.current),
        deadline: updatedData.deadline
    };
    
    safeStorage.setItem(KEYS.GOALS, JSON.stringify(state.goals));
    notifyStateChanged('edit-goal', state.goals[idx]);
    return state.goals[idx];
}

function contributeToGoal(id, amount) {
    const idx = state.goals.findIndex(g => g.id === id);
    if (idx === -1) return null;
    
    state.goals[idx].current = parseFloat(state.goals[idx].current || 0) + parseFloat(amount);
    
    // Log this contribution as an expense in the main ledger to keep track of flows
    // Note: Investments is treated as a category that represents capital deployment
    addTransaction({
        date: new Date().toISOString(),
        type: 'expense',
        category: 'Investments',
        description: `Goal Contribution: ${state.goals[idx].title}`,
        amount: parseFloat(amount),
        paymentMethod: 'UPI',
        notes: `Allocated savings to goal ${state.goals[idx].title}`
    });

    safeStorage.setItem(KEYS.GOALS, JSON.stringify(state.goals));
    notifyStateChanged('contribute-goal', state.goals[idx]);
    return state.goals[idx];
}

function deleteSavingsGoal(id) {
    const idx = state.goals.findIndex(g => g.id === id);
    if (idx === -1) return false;
    
    const deleted = state.goals.splice(idx, 1)[0];
    safeStorage.setItem(KEYS.GOALS, JSON.stringify(state.goals));
    notifyStateChanged('delete-goal', deleted);
    return true;
}

/* 
 =================================================================
 BANKING STATEMENT EXPORT LOGGING
 =================================================================
*/

function getStatementLogs() {
    return state.statementLogs || [];
}

function logStatementGeneration(periodStart, periodEnd, count) {
    const newLog = {
        id: 'stmt-' + Date.now(),
        generatedAt: new Date().toISOString(),
        periodStart,
        periodEnd,
        recordCount: count
    };
    
    state.statementLogs.unshift(newLog);
    // Keep only last 10 logs
    if (state.statementLogs.length > 10) {
        state.statementLogs.pop();
    }
    safeStorage.setItem(KEYS.LOGS, JSON.stringify(state.statementLogs));
    notifyStateChanged('log-statement', newLog);
    return newLog;
}

/* 
 =================================================================
 GLOBAL CONFIGURATION SETTINGS & RESET DATA
 =================================================================
*/

function getSettings() {
    return state.settings;
}

function updateTheme(theme) {
    state.settings.theme = theme;
    safeStorage.setItem(KEYS.SETTINGS, JSON.stringify(state.settings));
    notifyStateChanged('theme-change', theme);
}

function factoryReset() {
    safeStorage.clear();
    loadBlankSlate();
    notifyStateChanged('reset', null);
}

function importBackupJson(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        // Validation checks
        if (data.transactions && Array.isArray(data.transactions)) {
            state.transactions = data.transactions;
        }
        if (data.budgets && Array.isArray(data.budgets)) {
            state.budgets = data.budgets;
        }
        if (typeof data.globalBudget === 'number') {
            state.globalBudget = data.globalBudget;
        }
        if (data.goals && Array.isArray(data.goals)) {
            state.goals = data.goals;
        }
        if (data.settings) {
            state.settings = data.settings;
        }
        
        saveAllState();
        return true;
    } catch (e) {
        console.error('Imported file structure is invalid or corrupt', e);
        return false;
    }
}
