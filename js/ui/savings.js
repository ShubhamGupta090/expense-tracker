/**
 * Quantum Ledger Savings Goals Planner UI
 * Goal milestones, contributions injection, and deadlines countdown
 */





/**
 * Initialize Savings Goals view listeners
 */
function initSavingsListeners() {
    const btnCreateGoal = document.getElementById('btn-create-savings-goal');
    const modalSavings = document.getElementById('modal-savings');
    const btnCloseModal = document.getElementById('btn-close-savings-modal');
    const btnCancelModal = document.getElementById('btn-cancel-savings');
    const btnSubmitModal = document.getElementById('btn-submit-savings');

    const modalContrib = document.getElementById('modal-goal-contribution');
    const btnCloseContrib = document.getElementById('btn-close-contrib-modal');
    const btnCancelContrib = document.getElementById('btn-cancel-contrib');
    const btnSubmitContrib = document.getElementById('btn-submit-contrib');

    // Open Create Goal Modal
    if (btnCreateGoal) {
        btnCreateGoal.addEventListener('click', () => {
            resetSavingsModal();
            document.getElementById('savings-modal-title').textContent = 'Configure Saving Goal';
            
            // Default deadline: 6 months from now
            const defaultDate = new Date();
            defaultDate.setMonth(defaultDate.getMonth() + 6);
            document.getElementById('savings-deadline').value = defaultDate.toISOString().split('T')[0];

            modalSavings.classList.add('active');
        });
    }

    const closeGoalModal = () => {
        modalSavings.classList.remove('active');
    };

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeGoalModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeGoalModal);

    modalSavings.addEventListener('click', (e) => {
        if (e.target === modalSavings) closeGoalModal();
    });

    // Submit Goal form
    if (btnSubmitModal) {
        btnSubmitModal.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const form = document.getElementById('form-savings');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const id = document.getElementById('savings-goal-id').value;
            const title = document.getElementById('savings-title').value;
            const target = parseFloat(document.getElementById('savings-target').value);
            const current = parseFloat(document.getElementById('savings-current').value || 0);
            const deadline = document.getElementById('savings-deadline').value;

            if (target <= 0) {
                showToast('Target amount must be greater than zero.', 'warning');
                return;
            }
            if (current < 0) {
                showToast('Initially saved amount cannot be negative.', 'warning');
                return;
            }

            const payload = { title, target, current, deadline };

            if (id) {
                // Edit
                const confirmed = await showConfirm(
                    'Update Goal Milestones',
                    `Are you sure you want to adjust goals settings for "${title}"?`
                );
                if (confirmed) {
                    editSavingsGoal(id, payload);
                    showToast('Saving goal settings updated.', 'success');
                    closeGoalModal();
                    renderSavingsView();
                }
            } else {
                // Add
                const confirmed = await showConfirm(
                    'Configure Goal Target',
                    `Create new savings milestone: "${title}" targeting ${formatINR(target)}?`
                );
                if (confirmed) {
                    addSavingsGoal(payload);
                    showToast('Savings milestone configured successfully.', 'success');
                    closeGoalModal();
                    renderSavingsView();
                }
            }
        });
    }

    // Goal Capital contribution listeners
    const closeContribModal = () => {
        modalContrib.classList.remove('active');
    };

    if (btnCloseContrib) btnCloseContrib.addEventListener('click', closeContribModal);
    if (btnCancelContrib) btnCancelContrib.addEventListener('click', closeContribModal);

    modalContrib.addEventListener('click', (e) => {
        if (e.target === modalContrib) closeContribModal();
    });

    if (btnSubmitContrib) {
        btnSubmitContrib.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const form = document.getElementById('form-contribution');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const id = document.getElementById('contrib-goal-id').value;
            const amount = parseFloat(document.getElementById('contrib-amount').value);
            const goalTitle = document.getElementById('contrib-goal-title').textContent;

            if (isNaN(amount) || amount <= 0) {
                showToast('Contribution amount must be positive.', 'warning');
                return;
            }

            const confirmed = await showConfirm(
                'Goal Capital Injection',
                `Allocate ${formatINR(amount)} from active balances towards "${goalTitle}"? This will log a corresponding Investment transaction.`
            );

            if (confirmed) {
                contributeToGoal(id, amount);
                showToast(`Injected capital: ${formatINR(amount)} added to ${goalTitle}.`, 'success');
                closeContribModal();
                renderSavingsView();
            }
        });
    }
}

function resetSavingsModal() {
    document.getElementById('savings-goal-id').value = '';
    document.getElementById('savings-title').value = '';
    document.getElementById('savings-target').value = '';
    document.getElementById('savings-current').value = '0';
    document.getElementById('savings-deadline').value = '';
}

/**
 * Re-render savings page elements
 */
function renderSavingsView() {
    const totalSavingsEl = document.getElementById('val-total-savings-box');
    const grid = document.getElementById('savings-goals-grid');

    if (!grid) return;

    const goals = getSavingsGoals();
    
    // Sum accumulated totals
    const sumSavings = goals.reduce((sum, g) => sum + parseFloat(g.current || 0), 0);
    if (totalSavingsEl) {
        totalSavingsEl.textContent = formatINR(sumSavings);
    }

    if (goals.length === 0) {
        grid.innerHTML = `
            <div class="empty-state text-center grid-span-all py-5">
                <div class="empty-icon"><i data-lucide="gem"></i></div>
                <h5>No savings milestones active</h5>
                <p>Configure long-term goals and direct excess cash towards mutual funds or emergency funds.</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    grid.innerHTML = goals.map(g => {
        const percent = Math.min(100, Math.round((g.current / g.target) * 100));
        const remaining = Math.max(0, g.target - g.current);
        const daysLeft = calculateDaysRemaining(g.deadline);

        // Circular progress length calculations (2 * PI * r) = 2 * 3.14 * 25 = 157
        const strokeOffset = 157 - (157 * percent) / 100;

        return `
            <div class="glass-card savings-card">
                <div class="savings-card-header">
                    <div class="savings-card-title">
                        <h4>${g.title}</h4>
                        <span class="text-xs text-muted">Deadline: ${formatDate(g.deadline)} (${daysLeft} days left)</span>
                    </div>
                    <div class="budget-card-actions">
                        <button class="btn-table-action btn-edit-goal" data-id="${g.id}" title="Edit goal parameters">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="btn-table-action btn-delete-goal action-delete" data-id="${g.id}" title="Delete savings goal">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>

                <div class="savings-radial-stat">
                    <div class="radial-meta">
                        <span class="target-lbl">Saved Capital</span>
                        <h3 class="target-val">${formatINR(g.current)}</h3>
                        <span class="target-lbl">Target: ${formatINR(g.target)}</span>
                    </div>
                    
                    <div class="health-gauge-container" style="width: 70px; height: 70px;">
                        <svg class="health-gauge" viewBox="0 0 60 60">
                            <circle class="gauge-bg" cx="30" cy="30" r="25" stroke-width="5"></circle>
                            <circle class="gauge-progress" cx="30" cy="30" r="25" stroke-width="5" 
                                style="stroke-dasharray: 157; stroke-dashoffset: ${strokeOffset}; stroke: var(--info);"></circle>
                        </svg>
                        <div class="gauge-center">
                            <span class="radial-percentage" style="font-size: 0.95rem;">${percent}%</span>
                        </div>
                    </div>
                </div>

                <div class="savings-details-list">
                    <div class="savings-details-item">
                        <span>Allocated Target</span>
                        <span class="font-semibold text-primary">${formatINR(g.target)}</span>
                    </div>
                    <div class="savings-details-item">
                        <span>Remaining Capital</span>
                        <span class="font-semibold">${formatINR(remaining)}</span>
                    </div>
                    <div class="savings-details-item">
                        <span>Est. Monthly SIP Required</span>
                        <span class="font-semibold text-success">${formatINR(calculateMonthlySipRequired(remaining, daysLeft))}</span>
                    </div>
                </div>

                <div class="savings-card-footer">
                    <button class="btn btn-primary btn-contrib-goal" data-id="${g.id}" data-title="${g.title}" ${percent >= 100 ? 'disabled' : ''}>
                        <i data-lucide="wallet"></i>
                        <span>Inject Capital</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Attach actions click listeners
    attachSavingsActionListeners();
}

function attachSavingsActionListeners() {
    const editBtns = document.querySelectorAll('.btn-edit-goal');
    const deleteBtns = document.querySelectorAll('.btn-delete-goal');
    const contribBtns = document.querySelectorAll('.btn-contrib-goal');

    const modalSavings = document.getElementById('modal-savings');
    const modalContrib = document.getElementById('modal-goal-contribution');

    editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const goal = getSavingsGoals().find(g => g.id === id);
            
            if (goal) {
                document.getElementById('savings-modal-title').textContent = 'Modify Saving Goal';
                document.getElementById('savings-goal-id').value = goal.id;
                document.getElementById('savings-title').value = goal.title;
                document.getElementById('savings-target').value = goal.target;
                document.getElementById('savings-current').value = goal.current;
                document.getElementById('savings-deadline').value = goal.deadline;
                
                modalSavings.classList.add('active');
            }
        });
    });

    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const goal = getSavingsGoals().find(g => g.id === id);
            
            if (goal) {
                const confirmed = await showConfirm(
                    'Delete Savings Goal',
                    `Are you sure you want to delete "${goal.title}" milestone? Current saved capital ${formatINR(goal.current)} will remain in transactions histories but goals track will be erased.`
                );

                if (confirmed) {
                    const deleted = deleteSavingsGoal(id);
                    if (deleted) {
                        showToast(`Savings milestone "${goal.title}" removed.`, 'success');
                        renderSavingsView();
                    } else {
                        showToast('Failed to delete savings goal.', 'error');
                    }
                }
            }
        });
    });

    contribBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const title = btn.getAttribute('data-title');
            
            document.getElementById('contrib-goal-id').value = id;
            document.getElementById('contrib-goal-title').textContent = title;
            document.getElementById('contrib-amount').value = '';
            
            modalContrib.classList.add('active');
        });
    });
}

// Helper calculations
function calculateDaysRemaining(deadlineStr) {
    const deadline = new Date(deadlineStr);
    const today = new Date();
    const diffTime = deadline.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

function calculateMonthlySipRequired(remaining, daysLeft) {
    if (remaining <= 0 || daysLeft <= 0) return 0;
    const months = daysLeft / 30.4; // Average days per month
    if (months <= 0.5) return remaining; // Target very near
    return Math.round(remaining / months);
}
