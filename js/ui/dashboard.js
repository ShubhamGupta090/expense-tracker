/**
 * Quantum Ledger Dashboard UI Renderer
 * Handles animated counters, SVG gauges, and Calendar Heatmaps
 */




// Cache for animated values to prevent redundant loops
let prevStats = { balance: 0, income: 0, expenses: 0, savings: 0 };

/**
 * Main render function for Dashboard
 * @param {object} state - Global financial state
 */
function renderDashboard(state) {
    const curBalance = getNetBalance();
    const curIncome = getTotalIncome();
    const curExpenses = getTotalExpenses();
    const curSavings = getTotalSavings();
    const savingsRate = getSavingsRate();

    // 1. Animate numerical KPI counters
    animateCounter('val-balance', prevStats.balance, curBalance, true);
    animateCounter('val-income', prevStats.income, curIncome, true);
    animateCounter('val-expenses', prevStats.expenses, curExpenses, true);
    animateCounter('val-savings', prevStats.savings, curSavings, true);

    // Save previous values
    prevStats = { balance: curBalance, income: curIncome, expenses: curExpenses, savings: curSavings };

    // Set KPI helper text
    const netflowText = document.getElementById('val-netflow');
    if (netflowText) {
        netflowText.textContent = `Net Cash Flow: ${formatINR(curIncome - curExpenses)}`;
        netflowText.className = (curIncome - curExpenses) >= 0 ? 'kpi-subtext text-success' : 'kpi-subtext text-danger';
    }

    const expenseSub = document.getElementById('val-expenses-sub');
    if (expenseSub) {
        const util = curIncome > 0 ? ((curExpenses / curIncome) * 100).toFixed(0) : 0;
        expenseSub.textContent = `Monthly utilization: ${util}%`;
    }

    const savingsSub = document.getElementById('val-savings-rate');
    if (savingsSub) {
        savingsSub.textContent = `Savings Rate: ${savingsRate}%`;
    }

    // 2. Render Financial Health Gauge & Score Card
    renderHealthGauge();

    // 3. Render Daily Spending Heatmap
    renderSpendingHeatmap();

    // 4. Render Sidebar Goal and Budget Widgets Snapshots
    renderWidgetSnapshots();
}

/**
 * Animate numbers from start to target values smoothly
 */
function animateCounter(elementId, start, end, isCurrency = true) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (start === end) {
        el.textContent = isCurrency ? formatINR(end) : end;
        return;
    }

    const duration = 800; // Total animation ms
    const steps = 25;     // Number of subdivisions
    const stepDuration = duration / steps;
    const diff = end - start;
    let step = 0;

    const timer = setInterval(() => {
        step++;
        const currentVal = start + (diff * (step / steps));
        el.textContent = isCurrency ? formatINR(currentVal) : Math.round(currentVal);

        if (step >= steps) {
            clearInterval(timer);
            el.textContent = isCurrency ? formatINR(end) : end;
        }
    }, stepDuration);
}

/**
 * Render Financial Health SVG Gauge circle and recommendations
 */
function renderHealthGauge() {
    const scoreValEl = document.getElementById('val-health-score');
    const scoreCircle = document.querySelector('.gauge-progress');
    const badge = document.getElementById('health-badge');
    const summaryText = document.getElementById('health-score-summary');
    const bulletsList = document.getElementById('health-bullets-list');
    const insightsContainer = document.getElementById('widget-insights-container');

    if (!scoreValEl || !scoreCircle) return;

    const score = calculateHealthScore();
    scoreValEl.textContent = score;

    // Stroke Dash offset animation: length = 2 * PI * r = 2 * 3.14 * 50 = 314
    const offset = 314 - (314 * score) / 100;
    scoreCircle.style.strokeDashoffset = offset;

    // Colors styling based on score thresholds
    let statusClass = 'badge-pulse'; // green
    let strokeColor = '#10b981';
    let label = 'Perfect';
    let desc = 'Outstanding financial discipline! You are managing savings and budgets optimally.';

    const income = getTotalIncome();
    const expenses = getTotalExpenses();

    if (income === 0 && expenses === 0) {
        statusClass = 'badge-pulse';
        strokeColor = 'rgba(255, 255, 255, 0.15)';
        label = 'Blank Slate';
        desc = 'Log your monthly income and transactions to compute your dynamic financial health score.';
    } else if (score >= 80) {
        statusClass = 'badge-pulse';
        strokeColor = '#10b981';
        label = 'Stable & Secure';
    } else if (score >= 65) {
        statusClass = 'badge-warn';
        strokeColor = '#06b6d4';
        label = 'Balanced';
        desc = 'Your cash flow is stable, but there is room to accelerate debt payoff or mutual fund SIPs.';
    } else if (score >= 50) {
        statusClass = 'badge-warn';
        strokeColor = '#f59e0b';
        label = 'Vulnerable';
        desc = 'Discretionary expenses are high relative to income. Tighten category budget caps immediately.';
    } else {
        statusClass = 'badge-danger';
        strokeColor = '#ef4444';
        label = 'Critical Alert';
        desc = 'Deficit cash flow or heavy debt EMI burden detected. Liquidate non-essential outflows.';
    }

    scoreCircle.style.stroke = strokeColor;
    if (badge) {
        badge.className = `badge ${statusClass}`;
        badge.textContent = label;
    }
    if (summaryText) {
        summaryText.textContent = desc;
    }

    // Generate dynamic bullet insights
    const bullets = [];
    const rate = getSavingsRate();
    const txs = getTransactions();

    if (income === 0 && expenses === 0) {
        bullets.push({ text: 'Log your primary monthly salary or cash flow inflow in the ledger to begin.', type: 'info' });
        bullets.push({ text: 'Set category or global budget limits to monitor utilization limits.', type: 'info' });
        bullets.push({ text: 'Configure custom savings milestones to track emergency fund targets.', type: 'info' });
    } else {
        // Insight 1: Savings Rate Check
        if (rate < 15) {
            bullets.push({ text: `Savings rate is only ${rate}%. Target a minimum of 20% by cutting food/shopping.`, type: 'warning' });
        } else {
            bullets.push({ text: `Solid savings rate of ${rate}% is helping accrue emergency capital quickly.`, type: 'success' });
        }

        // Insight 2: EMI Check
        const emiSum = txs.filter(t => t.type === 'expense' && t.category === 'EMI').reduce((sum, t) => sum + t.amount, 0);
        const emiRate = income > 0 ? (emiSum / income) * 100 : 0;
        if (emiRate > 30) {
            bullets.push({ text: `Debt EMIs consume ${emiRate.toFixed(0)}% of your monthly cash flow. Restructure loans.`, type: 'danger' });
        } else if (emiSum > 0) {
            bullets.push({ text: `Debt burden under control (${emiRate.toFixed(0)}% of income). Keep it below 20%.`, type: 'success' });
        }

        // Insight 3: Budget Utilization Check
        const currentMonthExpenses = txs.filter(t => t.type === 'expense' && isCurrentMonth(t.date)).reduce((sum, t) => sum + t.amount, 0);
        const budgetsList = getBudgets();
        const allocatedBudget = budgetsList.reduce((sum, b) => sum + b.amount, 0);
        if (allocatedBudget > 0) {
            const util = (currentMonthExpenses / allocatedBudget) * 100;
            if (util > 90) {
                bullets.push({ text: `Exhausted ${util.toFixed(0)}% of category budgets. Freeze discretionary purchases.`, type: 'danger' });
            } else if (util > 75) {
                bullets.push({ text: `Budget limits at ${util.toFixed(0)}%. Limit entertainment/shopping for the week.`, type: 'warning' });
            }
        }

        // Fallback if no issues found
        if (bullets.length < 2) {
            bullets.push({ text: 'No major risk vectors detected. Allocate surplus to short-term savings goals.', type: 'info' });
        }
    }

    // Render bullets lists
    if (bulletsList) {
        bulletsList.innerHTML = bullets.map(b => `<li>${b.text}</li>`).join('');
    }

    // Render main widgets page insights
    if (insightsContainer) {
        insightsContainer.innerHTML = bullets.map(b => `
            <div class="insight-alert-item">
                <div class="insight-icon-container insight-${b.type}-icon">
                    <i data-lucide="${b.type === 'danger' ? 'alert-octagon' : b.type === 'warning' ? 'alert-triangle' : b.type === 'success' ? 'check' : 'info'}"></i>
                </div>
                <div>
                    <span class="font-semibold block ${b.type === 'danger' ? 'text-danger' : b.type === 'warning' ? 'text-warning' : ''}">${b.type.toUpperCase()}:</span>
                    <span class="text-xs text-secondary">${b.text}</span>
                </div>
            </div>
        `).join('');
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

function isCurrentMonth(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

/**
 * Render the interactive GitHub contribution style spending heatmap
 */
function renderSpendingHeatmap() {
    const grid = document.getElementById('spending-heatmap-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Step 1: Calculate Start Date (18 weeks ago aligned to Sunday)
    const endDate = new Date(); // Current time
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 125); // 18 weeks * 7 = 126 days
    
    // Shift back to nearest Sunday to align grid rows perfectly
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);

    // Step 2: Sum up expenses by date
    const txs = getTransactions();
    const expenseMap = {};
    txs.forEach(t => {
        if (t.type === 'expense') {
            const dateStr = new Date(t.date).toDateString();
            expenseMap[dateStr] = (expenseMap[dateStr] || 0) + parseFloat(t.amount);
        }
    });

    // Step 3: Draw 126 boxes
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 126; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        const dateKey = currentDate.toDateString();
        const amt = expenseMap[dateKey] || 0;

        // Map colors intensity
        let scale = 'scale-0';
        if (amt > 0 && amt <= 500) scale = 'scale-1';
        else if (amt > 500 && amt <= 2000) scale = 'scale-2';
        else if (amt > 2000 && amt <= 5000) scale = 'scale-3';
        else if (amt > 5000) scale = 'scale-4';

        const box = document.createElement('div');
        box.className = `heatmap-box ${scale}`;
        
        // Tooltip text
        const tooltipText = `${formatDate(currentDate)}: ${amt > 0 ? formatINR(amt) : '₹ 0 (No Expenses)'}`;
        box.setAttribute('data-tooltip', tooltipText);

        box.addEventListener('mouseenter', handleTooltipEnter);
        box.addEventListener('mouseleave', handleTooltipLeave);

        frag.appendChild(box);
    }
    grid.appendChild(frag);
}

// Tooltip positioning variables
let activeTooltip = null;

function handleTooltipEnter(e) {
    const text = e.target.getAttribute('data-tooltip');
    
    // Create tooltip
    activeTooltip = document.createElement('div');
    activeTooltip.className = 'heatmap-tooltip';
    activeTooltip.textContent = text;
    document.body.appendChild(activeTooltip);

    const rect = e.target.getBoundingClientRect();
    activeTooltip.style.left = `${rect.left + window.scrollX - (activeTooltip.offsetWidth / 2) + 4}px`;
    activeTooltip.style.top = `${rect.top + window.scrollY - activeTooltip.offsetHeight - 8}px`;
    
    activeTooltip.style.opacity = '1';
    activeTooltip.style.transform = 'translateY(0)';
}

function handleTooltipLeave() {
    if (activeTooltip) {
        const temp = activeTooltip;
        temp.style.opacity = '0';
        temp.style.transform = 'translateY(4px)';
        setTimeout(() => {
            if (temp.parentNode) {
                document.body.removeChild(temp);
            }
        }, 150);
        activeTooltip = null;
    }
}

/**
 * Render Snapshots widgets lists (Goals & Budget progress bars) on Dashboard page
 */
function renderWidgetSnapshots() {
    const goalsList = document.getElementById('widget-savings-list');
    const budgetList = document.getElementById('widget-budget-list');

    // Goals Snapshot
    if (goalsList) {
        const goals = getSavingsGoals().slice(0, 3); // Top 3 goals
        if (goals.length === 0) {
            goalsList.innerHTML = '<span class="text-xs text-muted">No saving goals created yet.</span>';
        } else {
            goalsList.innerHTML = goals.map(g => {
                const percent = Math.min(100, Math.round((g.current / g.target) * 100));
                return `
                    <div class="widget-goal-item">
                        <div class="goal-item-header">
                            <span>${g.title}</span>
                            <span>${percent}%</span>
                        </div>
                        <div class="goal-item-progress-track">
                            <div class="goal-item-progress-fill" style="width: ${percent}%"></div>
                        </div>
                        <div class="goal-item-footer">
                            <span>Saved: ${formatINR(g.current)}</span>
                            <span>Target: ${formatINR(g.target)}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Budgets Snapshot
    if (budgetList) {
        const budgets = getBudgets().slice(0, 3); // Top 3 budget categories
        const txs = getTransactions();
        
        // Sum up current month expenses by categories
        const currentMonthExps = txs.filter(t => t.type === 'expense' && isCurrentMonth(t.date));
        
        if (budgets.length === 0) {
            budgetList.innerHTML = '<span class="text-xs text-muted">No category budgets created yet.</span>';
        } else {
            budgetList.innerHTML = budgets.map(b => {
                const actual = currentMonthExps
                    .filter(e => e.category === b.category)
                    .reduce((sum, e) => sum + e.amount, 0);

                const percent = Math.round((actual / b.amount) * 100);
                
                let fillClass = '';
                if (percent >= 100) fillClass = 'danger-fill';
                else if (percent >= 80) fillClass = 'warning-fill';

                return `
                    <div class="widget-budget-item">
                        <div class="budget-item-header">
                            <span>${b.category}</span>
                            <span class="${percent >= 100 ? 'text-danger' : percent >= 80 ? 'text-warning' : ''}">${percent}%</span>
                        </div>
                        <div class="budget-item-progress-track">
                            <div class="budget-item-progress-fill ${fillClass}" style="width: ${Math.min(100, percent)}%"></div>
                        </div>
                        <div class="budget-item-footer">
                            <span>Spent: ${formatINR(actual)}</span>
                            <span>Limit: ${formatINR(b.amount)}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}
