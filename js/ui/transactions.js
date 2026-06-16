/**
 * Quantum Ledger Transactions Manager UI
 * Multi-filters, sorting, searching, pagination, slide-over forms, and CRUD operations
 */





// Table pagination config
const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let filteredTxsList = [];

/**
 * Initialize transaction listeners (Form triggers, filter toggles)
 */
function initTransactionsListeners() {
    const searchInput = document.getElementById('tx-search-input');
    const filterType = document.getElementById('filter-type');
    const filterCat = document.getElementById('filter-category');
    const filterMethod = document.getElementById('filter-method');
    const filterFrom = document.getElementById('filter-date-from');
    const filterTo = document.getElementById('filter-date-to');
    const filterSort = document.getElementById('filter-sort');
    
    const btnToggleFilters = document.getElementById('btn-toggle-filters');
    const filterDrawer = document.getElementById('tx-filter-drawer');
    const btnClearFilters = document.getElementById('btn-clear-filters');
    const btnApplyFilters = document.getElementById('btn-apply-filters');

    const btnAddTx = document.getElementById('btn-add-transaction');
    const btnQuickAdd = document.getElementById('btn-quick-add-transaction');
    const modalTx = document.getElementById('modal-transaction');
    const btnCloseModal = document.getElementById('btn-close-transaction-modal');
    const btnCancelModal = document.getElementById('btn-cancel-transaction');
    const btnSubmitModal = document.getElementById('btn-submit-transaction');

    const radioExpense = document.getElementById('tx-type-expense');
    const radioIncome = document.getElementById('tx-type-income');
    const groupCategory = document.getElementById('tx-category-group');
    const groupSource = document.getElementById('tx-source-group');

    // Toggle Filters panel
    if (btnToggleFilters && filterDrawer) {
        btnToggleFilters.addEventListener('click', () => {
            filterDrawer.classList.toggle('hidden');
        });
    }

    // Apply Filters click
    if (btnApplyFilters) {
        btnApplyFilters.addEventListener('click', () => {
            currentPage = 1;
            renderTransactionsLedger();
        });
    }

    // Reset Filters click
    if (btnClearFilters) {
        btnClearFilters.addEventListener('click', () => {
            searchInput.value = '';
            filterType.value = 'all';
            filterCat.value = 'all';
            filterMethod.value = 'all';
            filterFrom.value = '';
            filterTo.value = '';
            filterSort.value = 'date-desc';
            
            currentPage = 1;
            renderTransactionsLedger();
            showToast('Active filters reset successfully.', 'info');
        });
    }

    // Instant search/filter trigger on select dropdowns
    const triggerInstantFilter = () => {
        currentPage = 1;
        renderTransactionsLedger();
    };
    
    [filterType, filterCat, filterMethod, filterSort].forEach(el => {
        if (el) el.addEventListener('change', triggerInstantFilter);
    });

    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            currentPage = 1;
            renderTransactionsLedger();
        }, 300));
    }

    // Add Transaction modals triggers
    const openAddModal = (defaultType = 'expense') => {
        resetTransactionForm();
        document.getElementById('transaction-modal-title').textContent = 'Log New Transaction';
        
        // Populate inputs with current timestamp (IST local)
        const inputs = parseIsoToDateTimeInputs(new Date().toISOString());
        document.getElementById('tx-date').value = inputs.date;
        document.getElementById('tx-time').value = inputs.time;

        if (defaultType === 'income') {
            radioIncome.checked = true;
            toggleTypeFormFields('income');
        } else {
            radioExpense.checked = true;
            toggleTypeFormFields('expense');
        }

        modalTx.classList.add('active');
    };

    if (btnAddTx) btnAddTx.addEventListener('click', () => openAddModal('expense'));
    if (btnQuickAdd) btnQuickAdd.addEventListener('click', () => openAddModal('expense'));

    // Slide-over modal cancel/close actions
    const closeModal = () => {
        modalTx.classList.remove('active');
    };

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    modalTx.addEventListener('click', (e) => {
        if (e.target === modalTx) closeModal();
    });

    // Form type switching (Expense vs Income fields)
    if (radioExpense) radioExpense.addEventListener('change', () => toggleTypeFormFields('expense'));
    if (radioIncome) radioIncome.addEventListener('change', () => toggleTypeFormFields('income'));

    function toggleTypeFormFields(type) {
        if (type === 'income') {
            groupCategory.style.display = 'none';
            groupSource.style.display = 'block';
            document.getElementById('tx-category').required = false;
            document.getElementById('tx-source').required = true;
            document.getElementById('tx-method-group').style.display = 'none'; // Bank transfer / Cash default
        } else {
            groupCategory.style.display = 'block';
            groupSource.style.display = 'none';
            document.getElementById('tx-category').required = true;
            document.getElementById('tx-source').required = false;
            document.getElementById('tx-method-group').style.display = 'block';
        }
    }

    // Submit transaction
    if (btnSubmitModal) {
        btnSubmitModal.addEventListener('click', handleFormSubmit);
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const form = document.getElementById('form-transaction');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const id = document.getElementById('tx-id').value;
        const type = radioExpense.checked ? 'expense' : 'income';
        const amount = parseFloat(document.getElementById('tx-amount').value);
        const category = type === 'expense' 
            ? document.getElementById('tx-category').value 
            : document.getElementById('tx-source').value;
        const dateInput = document.getElementById('tx-date').value;
        const timeInput = document.getElementById('tx-time').value;
        const paymentMethod = type === 'expense' 
            ? document.getElementById('tx-method').value 
            : 'Net Banking'; // Incomes standard credit
        const description = document.getElementById('tx-description').value;
        const notes = document.getElementById('tx-notes').value;

        // Construct standard ISO string from date & time input
        const txIsoDate = new Date(`${dateInput}T${timeInput}`).toISOString();

        const txPayload = {
            type,
            category,
            amount,
            date: txIsoDate,
            paymentMethod,
            description,
            notes
        };

        if (id) {
            // Edit flow
            const confirmed = await showConfirm('Modify Transaction', 'Are you sure you want to update this transaction? Financial scores and budgets will recalculate.');
            if (confirmed) {
                const updated = editTransaction(id, txPayload);
                if (updated) {
                    showToast('Transaction updated successfully.', 'success');
                    closeModal();
                } else {
                    showToast('Failed to modify transaction record.', 'error');
                }
            }
        } else {
            // Add flow
            const confirmed = await showConfirm('Add Transaction', `Add new entry: ${description} for ${formatINR(amount)}?`);
            if (confirmed) {
                const added = addTransaction(txPayload);
                if (added) {
                    showToast('Transaction logged successfully.', 'success');
                    closeModal();
                } else {
                    showToast('Failed to save transaction record.', 'error');
                }
            }
        }
    }

    // Pagination Click Listeners
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTransactionsLedger();
            }
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const maxPage = Math.ceil(filteredTxsList.length / ITEMS_PER_PAGE);
            if (currentPage < maxPage) {
                currentPage++;
                renderTransactionsLedger();
            }
        });
    }
}

/**
 * Render standard paginated and filtered table listing
 */
function renderTransactionsLedger() {
    const tableBody = document.getElementById('transactions-table-body');
    const emptyState = document.getElementById('table-empty-state');
    const tableElement = document.getElementById('transactions-table');
    const filterCatSelect = document.getElementById('filter-category');

    if (!tableBody) return;

    const allTxs = getTransactions();

    // 1. Populate category filter options once
    if (filterCatSelect && filterCatSelect.children.length <= 1) {
        const categories = [...new Set(allTxs.filter(t => t.type === 'expense').map(t => t.category))].sort();
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            filterCatSelect.appendChild(opt);
        });
    }

    // 2. Fetch filters values
    const query = document.getElementById('tx-search-input').value.toLowerCase().trim();
    const type = document.getElementById('filter-type').value;
    const category = document.getElementById('filter-category').value;
    const method = document.getElementById('filter-method').value;
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    const sort = document.getElementById('filter-sort').value;

    // 3. Perform filtering
    filteredTxsList = allTxs.filter(t => {
        // Query search
        const matchQuery = !query || 
            t.description.toLowerCase().includes(query) ||
            t.category.toLowerCase().includes(query) ||
            (t.notes && t.notes.toLowerCase().includes(query)) ||
            t.paymentMethod.toLowerCase().includes(query);

        // Type match
        const matchType = type === 'all' || t.type === type;

        // Category match
        const matchCat = category === 'all' || t.category === category;

        // Method match
        const matchMethod = method === 'all' || t.paymentMethod === method;

        // Date match (IST relative)
        let matchDate = true;
        const txTime = new Date(t.date).getTime();
        
        if (dateFrom) {
            const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
            if (txTime < fromTime) matchDate = false;
        }
        if (dateTo) {
            const toTime = new Date(`${dateTo}T23:59:59`).getTime();
            if (txTime > toTime) matchDate = false;
        }

        return matchQuery && matchType && matchCat && matchMethod && matchDate;
    });

    // 4. Perform Sorting
    filteredTxsList.sort((a, b) => {
        if (sort === 'date-desc') {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        } else if (sort === 'date-asc') {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        } else if (sort === 'amount-desc') {
            return b.amount - a.amount;
        } else if (sort === 'amount-asc') {
            return a.amount - b.amount;
        }
        return 0;
    });

    // 5. Handle empty state
    if (filteredTxsList.length === 0) {
        tableBody.innerHTML = '';
        tableElement.style.display = 'none';
        emptyState.classList.remove('hidden');
        updatePaginationText(0, 0, 0);
        return;
    }

    tableElement.style.display = 'table';
    emptyState.classList.add('hidden');

    // 6. Pagination Slice
    const totalEntries = filteredTxsList.length;
    const maxPage = Math.ceil(totalEntries / ITEMS_PER_PAGE);
    if (currentPage > maxPage) currentPage = maxPage;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, totalEntries);
    const paginatedTxs = filteredTxsList.slice(startIdx, endIdx);

    // 7. Render rows
    tableBody.innerHTML = paginatedTxs.map(t => {
        const dateFormatted = formatDateTime(t.date);
        
        // Category styling icon
        const isInc = t.type === 'income';
        const amtStr = isInc ? `+ ₹ ${t.amount.toLocaleString('en-IN')}` : `₹ ${t.amount.toLocaleString('en-IN')}`;
        const amtClass = isInc ? 'tx-amt-income' : 'tx-amt-expense';
        
        const payMethodClass = getPaymentMethodBadgeClass(t.paymentMethod);
        
        return `
            <tr>
                <td class="font-normal text-muted text-xs">${dateFormatted}</td>
                <td>
                    <span class="badge ${isInc ? 'badge-pulse' : 'badge-warn'}">${t.type}</span>
                </td>
                <td>
                    <div class="category-tag">
                        <i data-lucide="${getCategoryIcon(t.category)}"></i>
                        <span>${t.category}</span>
                    </div>
                </td>
                <td>
                    <span class="font-semibold block">${t.description}</span>
                    ${t.notes ? `<span class="text-xs text-muted font-normal">${t.notes}</span>` : ''}
                </td>
                <td>
                    <span class="payment-badge ${payMethodClass}">${t.paymentMethod}</span>
                </td>
                <td class="text-right ${amtClass}">${amtStr}</td>
                <td class="text-center">
                    <div class="table-actions">
                        <button class="btn-table-action btn-edit-tx" data-id="${t.id}" title="Edit transaction details">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="btn-table-action btn-delete-tx action-delete" data-id="${t.id}" title="Delete transaction">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Reinitialize Lucide vector SVGs
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Attach row action event handlers dynamically
    attachRowActionListeners();

    // 8. Update bottom pagination pagination controls
    updatePaginationText(startIdx + 1, endIdx, totalEntries);
    renderPaginationButtons(maxPage);
}

/**
 * Bind actions for edit and delete buttons on table rows
 */
function attachRowActionListeners() {
    const editBtns = document.querySelectorAll('.btn-edit-tx');
    const deleteBtns = document.querySelectorAll('.btn-delete-tx');

    editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const tx = getTransactions().find(t => t.id === id);
            if (tx) {
                openEditModal(tx);
            }
        });
    });

    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const tx = getTransactions().find(t => t.id === id);
            if (tx) {
                const confirmed = await showConfirm(
                    'Delete Transaction', 
                    `Are you absolutely sure you want to delete "${tx.description}" of ${formatINR(tx.amount)}? This action will reset budgets and statement values.`
                );
                if (confirmed) {
                    const deleted = deleteTransaction(id);
                    if (deleted) {
                        showToast('Transaction deleted successfully.', 'success');
                    } else {
                        showToast('Failed to delete transaction.', 'error');
                    }
                }
            }
        });
    });
}

function openEditModal(tx) {
    const modal = document.getElementById('modal-transaction');
    document.getElementById('transaction-modal-title').textContent = 'Modify Transaction';
    
    // Populate form
    document.getElementById('tx-id').value = tx.id;
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-description').value = tx.description;
    document.getElementById('tx-notes').value = tx.notes || '';

    const inputs = parseIsoToDateTimeInputs(tx.date);
    document.getElementById('tx-date').value = inputs.date;
    document.getElementById('tx-time').value = inputs.time;

    const radioExpense = document.getElementById('tx-type-expense');
    const radioIncome = document.getElementById('tx-type-income');
    const groupCategory = document.getElementById('tx-category-group');
    const groupSource = document.getElementById('tx-source-group');

    if (tx.type === 'income') {
        radioIncome.checked = true;
        groupCategory.style.display = 'none';
        groupSource.style.display = 'block';
        document.getElementById('tx-source').value = tx.category;
        document.getElementById('tx-category').required = false;
        document.getElementById('tx-source').required = true;
        document.getElementById('tx-method-group').style.display = 'none';
    } else {
        radioExpense.checked = true;
        groupCategory.style.display = 'block';
        groupSource.style.display = 'none';
        document.getElementById('tx-category').value = tx.category;
        document.getElementById('tx-category').required = true;
        document.getElementById('tx-source').required = false;
        document.getElementById('tx-method-group').style.display = 'block';
        document.getElementById('tx-method').value = tx.paymentMethod;
    }

    modal.classList.add('active');
}

function resetTransactionForm() {
    document.getElementById('tx-id').value = '';
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-category').value = '';
    document.getElementById('tx-source').value = '';
    document.getElementById('tx-description').value = '';
    document.getElementById('tx-notes').value = '';
    document.getElementById('tx-method').value = 'UPI';
}

function updatePaginationText(start, end, total) {
    const txt = document.getElementById('pagination-text');
    if (!txt) return;
    if (total === 0) {
        txt.textContent = 'Showing 0 entries';
    } else {
        txt.textContent = `Showing ${start}-${end} of ${total} entries`;
    }
}

function renderPaginationButtons(maxPage) {
    const container = document.getElementById('pagination-pages');
    if (!container) return;

    container.innerHTML = '';
    
    // Draw page buttons
    for (let i = 1; i <= maxPage; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => {
            currentPage = i;
            renderTransactionsLedger();
        });
        container.appendChild(btn);
    }

    // Toggle disables on prev/next arrows
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    
    if (btnPrev) btnPrev.disabled = currentPage === 1;
    if (btnNext) btnNext.disabled = currentPage === maxPage || maxPage === 0;
}

// Utility maps for categories vector icons
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
        'Salary': 'dollar-sign',
        'Others': 'hash'
    };
    return map[cat] || 'hash';
}

// Utility map to determine payment badges colors
function getPaymentMethodBadgeClass(method) {
    const map = {
        'UPI': 'pay-upi',
        'Credit Card': 'pay-cc',
        'Debit Card': 'pay-dc',
        'Net Banking': 'pay-nb',
        'Cash': 'pay-cash'
    };
    return map[method] || '';
}

// Standard debounce utility for search query throttling
function debounce(func, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}
