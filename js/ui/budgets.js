/**
 * Quantum Ledger Budgets Planner UI
 * Category allocations, utilization gauges, and budget alarms
 */





/**
 * Initialize budget forms and sliders event listeners
 */
function initBudgetsListeners() {
    const btnSaveGlobal = document.getElementById('btn-save-global-budget');
    const inputGlobal = document.getElementById('input-global-budget');
    
    const btnCreateCat = document.getElementById('btn-create-category-budget');
    const modalBudget = document.getElementById('modal-budget');
    const btnCloseModal = document.getElementById('btn-close-budget-modal');
    const btnCancelModal = document.getElementById('btn-cancel-budget');
    const btnSubmitModal = document.getElementById('btn-submit-budget');

    // Save Global Budget limit
    if (btnSaveGlobal && inputGlobal) {
        btnSaveGlobal.addEventListener('click', async () => {
            const val = parseFloat(inputGlobal.value);
            if (isNaN(val) || val < 0) {
                showToast('Please enter a valid global budget amount.', 'warning');
                return;
            }
            
            const confirmed = await showConfirm(
                'Update Global Limit', 
                `Are you sure you want to adjust the monthly global spending limit to ${formatINR(val)}?`
            );
            if (confirmed) {
                updateGlobalBudget(val);
                showToast('Global budget limit updated successfully.', 'success');
                renderBudgetsView();
            }
        });
    }

    // Open Category Budget Modal
    if (btnCreateCat) {
        btnCreateCat.addEventListener('click', () => {
            resetBudgetModal();
            document.getElementById('budget-modal-title').textContent = 'Configure Category Limit';
            
            // Populate category select options dynamically excluding categories that already have budgets
            populateCategorySelect();
            modalBudget.classList.add('active');
        });
    }

    const closeModal = () => {
        modalBudget.classList.remove('active');
    };

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    modalBudget.addEventListener('click', (e) => {
        if (e.target === modalBudget) closeModal();
    });

    // Save/Update category budget
    if (btnSubmitModal) {
        btnSubmitModal.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const form = document.getElementById('form-budget');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const category = document.getElementById('budget-category').value;
            const amount = parseFloat(document.getElementById('budget-amount').value);

            if (isNaN(amount) || amount <= 0) {
                showToast('Allocated limit must be greater than zero.', 'warning');
                return;
            }

            const isUpdate = getBudgets().some(b => b.category === category);

            const confirmed = await showConfirm(
                isUpdate ? 'Update Category Limit' : 'Create Category Limit',
                `Are you sure you want to set the monthly limit for "${category}" to ${formatINR(amount)}?`
            );

            if (confirmed) {
                saveCategoryBudget(category, amount);
                showToast(`Budget for ${category} saved successfully.`, 'success');
                closeModal();
                renderBudgetsView();
            }
        });
    }
}

/**
 * Populate category dropdown menu inside Modal
 * @param {string} preselected - Category to select default (used for edits)
 */
function populateCategorySelect(preselected = '') {
    const select = document.getElementById('budget-category');
    if (!select) return;

    // Reset list
    select.innerHTML = '<option value="" disabled selected>Select category...</option>';

    const allCategories = [
        'Food', 'Travel', 'Fuel', 'Shopping', 'Bills', 'Electricity', 
        'Rent', 'Entertainment', 'Health', 'Education', 'Investments', 
        'EMI', 'Insurance', 'Others'
    ];

    const currentBudgets = getBudgets();

    allCategories.forEach(cat => {
        // Exclude if it already has budget, unless we are editing it
        const hasBudget = currentBudgets.some(b => b.category === cat);
        if (!hasBudget || cat === preselected) {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (cat === preselected) {
                opt.selected = true;
            }
            select.appendChild(opt);
        }
    });
}

function resetBudgetModal() {
    document.getElementById('budget-category').value = '';
    document.getElementById('budget-amount').value = '';
}

/**
 * Re-render global and category budgets layouts
 */
function renderBudgetsView() {
    const globalBudgetVal = document.getElementById('val-global-budget');
    const inputGlobal = document.getElementById('input-global-budget');
    const grid = document.getElementById('category-budgets-grid');

    if (!grid) return;

    // Set Global values
    const globalLimit = getGlobalBudget();
    if (globalBudgetVal) {
        globalBudgetVal.textContent = formatINR(globalLimit);
    }
    if (inputGlobal) {
        inputGlobal.value = globalLimit || '';
    }

    const budgets = getBudgets();
    const txs = getTransactions();

    // Sum current month expenses
    const now = new Date();
    const curMonthTxs = txs.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    if (budgets.length === 0) {
        grid.innerHTML = `
            <div class="empty-state text-center grid-span-all py-5">
                <div class="empty-icon"><i data-lucide="pie-chart"></i></div>
                <h5>No category budgets configured</h5>
                <p>Create targeted budgets to monitor spending velocities across custom categories.</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    grid.innerHTML = budgets.map(b => {
        // Calculate category actual spent
        const spent = curMonthTxs
            .filter(e => e.category === b.category)
            .reduce((sum, e) => sum + parseFloat(e.amount), 0);

        const remaining = Math.max(0, b.amount - spent);
        const percent = Math.round((spent / b.amount) * 100);

        let fillClass = '';
        let warningText = '';
        if (percent >= 100) {
            fillClass = 'danger';
            warningText = `<span class="badge badge-danger">Exceeded</span>`;
        } else if (percent >= 80) {
            fillClass = 'warning';
            warningText = `<span class="badge badge-warn">Utilized >80%</span>`;
        }

        return `
            <div class="glass-card budget-card">
                <div class="budget-card-header">
                    <div class="budget-card-title">
                        <i data-lucide="${getCategoryIcon(b.category)}"></i>
                        <h4 class="font-bold">${b.category}</h4>
                    </div>
                    <div class="budget-card-actions">
                        <button class="btn-table-action btn-edit-budget" data-category="${b.category}" data-amount="${b.amount}" title="Adjust budget limit">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="btn-table-action btn-delete-budget action-delete" data-category="${b.category}" title="Delete budget limit">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>

                <div class="budget-amt-row">
                    <span class="budget-used-hint">Monthly limit: ${formatINR(b.amount)}</span>
                    <h3 class="budget-nums">${formatINR(spent)} <span class="text-xs font-normal text-muted">spent</span></h3>
                </div>

                <div class="budget-progress-block">
                    <div class="budget-track">
                        <div class="budget-fill ${fillClass}" style="width: ${Math.min(100, percent)}%"></div>
                    </div>
                    <div class="budget-metrics">
                        <span>Remaining: ${formatINR(remaining)}</span>
                        <span>${percent}%</span>
                    </div>
                </div>
                
                ${warningText ? `<div class="text-right mt-1">${warningText}</div>` : ''}
            </div>
        `;
    }).join('');

    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Attach card actions click listeners
    attachBudgetActionListeners();
}

function attachBudgetActionListeners() {
    const editBtns = document.querySelectorAll('.btn-edit-budget');
    const deleteBtns = document.querySelectorAll('.btn-delete-budget');
    const modalBudget = document.getElementById('modal-budget');

    editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-category');
            const amount = btn.getAttribute('data-amount');
            
            document.getElementById('budget-modal-title').textContent = 'Modify Category Limit';
            populateCategorySelect(category);
            document.getElementById('budget-amount').value = amount;
            
            modalBudget.classList.add('active');
        });
    });

    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const category = btn.getAttribute('data-category');
            
            const confirmed = await showConfirm(
                'Delete Budget Limit',
                `Are you sure you want to remove the budget cap for "${category}"? You will lose progress warnings.`
            );

            if (confirmed) {
                const deleted = deleteCategoryBudget(category);
                if (deleted) {
                    showToast(`Budget limit for ${category} removed.`, 'success');
                    renderBudgetsView();
                } else {
                    showToast('Failed to delete budget limit.', 'error');
                }
            }
        });
    });
}

// Helper to match icons
function getCategoryIcon(cat) {
    const map = {
        'Food': 'utensils',
        'Travel': 'plane',
        'Fuel': 'fuel',
        'Shopping': 'shopping-bag',
        'Bills': 'receipt',
        'Electricity': 'zap',
        'Rent': 'home',
        'Entertainment': 'tv',
        'Health': 'heart-pulse',
        'Education': 'book-open',
        'Investments': 'trending-up',
        'EMI': 'credit-card',
        'Insurance': 'shield-check',
        'Others': 'hash'
    };
    return map[cat] || 'hash';
}
