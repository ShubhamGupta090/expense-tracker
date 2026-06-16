/**
 * Quantum Ledger Analytics Charts Controller
 * Renders and updates ApexCharts for Income/Expenses, Trends, Categories, and Budgets
 */




// Cache for chart instances to allow smooth in-place animations
let chartInstances = {
    incomeVsExpense: null,
    spendingTrend: null,
    categoryBreakdown: null,
    savingsGrowth: null,
    budgetUtilization: null
};

/**
 * Initialize charts and bind theme listeners
 */
function initChartsController() {
    // Listen for theme switch events to repaint charts with correct palette variables
    window.addEventListener('themeChanged', () => {
        destroyAllCharts();
        renderAllCharts();
    });
}

/**
 * Render all five financial charts
 */
function renderAllCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Theme variable overrides
    const textColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const tooltipTheme = isDark ? 'dark' : 'light';

    const txs = getTransactions();
    const budgets = getBudgets();

    if (txs.length === 0) return;

    // Compile time ranges (Last 6 Months)
    const monthLabels = getPast6MonthsLabels();
    const monthlyData = getPast6MonthsIncomeExpense(txs, monthLabels.dateObjects);

    // -- CHART 1: Income vs Expense (Side-by-side Columns)
    renderIncomeVsExpense(monthLabels.names, monthlyData, textColor, gridColor, tooltipTheme);

    // -- CHART 2: Monthly Spending Trend (Spline Area)
    renderSpendingTrend(monthLabels.names, monthlyData.expenses, textColor, gridColor, tooltipTheme);

    // -- CHART 3: Category Spending Breakdown (Donut)
    renderCategoryBreakdown(txs, textColor, tooltipTheme);

    // -- CHART 4: Cumulative Net Wealth Growth (Line)
    renderNetWealthGrowth(monthLabels.names, monthlyData, textColor, gridColor, tooltipTheme);

    // -- CHART 5: Budget Caps vs Actual (Horizontal Bar comparison)
    renderBudgetUtilization(txs, budgets, textColor, gridColor, tooltipTheme);
}

/**
 * Destroy active chart instances to prevent canvas memory leaks
 */
function destroyAllCharts() {
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key]) {
            chartInstances[key].destroy();
            chartInstances[key] = null;
        }
    });
}

/* 
 =================================================================
 CHARTS RENDER FUNCTIONS
 =================================================================
 */

function renderIncomeVsExpense(months, data, textColor, gridColor, tooltipTheme) {
    const options = {
        series: [
            { name: 'Income', data: data.incomes },
            { name: 'Expenses', data: data.expenses }
        ],
        chart: {
            type: 'bar',
            height: 320,
            toolbar: { show: false },
            background: 'transparent',
            foreColor: textColor
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%',
                endingShape: 'rounded',
                borderRadius: 4
            }
        },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: { categories: months },
        yaxis: {
            labels: {
                formatter: (val) => `₹ ${val.toLocaleString('en-IN')}`
            }
        },
        fill: {
            opacity: 1,
            colors: ['#10b981', '#ef4444'] // Green and Red
        },
        colors: ['#10b981', '#ef4444'],
        grid: { borderColor: gridColor },
        tooltip: {
            theme: tooltipTheme,
            y: {
                formatter: (val) => formatINR(val)
            }
        },
        legend: { labels: { colors: textColor } }
    };

    const container = document.getElementById('chart-income-vs-expense');
    if (container) {
        chartInstances.incomeVsExpense = new ApexCharts(container, options);
        chartInstances.incomeVsExpense.render();
    }
}

function renderSpendingTrend(months, expenseData, textColor, gridColor, tooltipTheme) {
    const options = {
        series: [{ name: 'Expenses', data: expenseData }],
        chart: {
            type: 'area',
            height: 320,
            toolbar: { show: false },
            background: 'transparent',
            foreColor: textColor
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 3, colors: ['#3b82f6'] },
        xaxis: { categories: months },
        yaxis: {
            labels: {
                formatter: (val) => `₹ ${val.toLocaleString('en-IN')}`
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [0, 90, 100],
                colorStops: [
                    { offset: 0, color: '#3b82f6', opacity: 0.4 },
                    { offset: 100, color: '#3b82f6', opacity: 0 }
                ]
            }
        },
        colors: ['#3b82f6'],
        grid: { borderColor: gridColor },
        tooltip: {
            theme: tooltipTheme,
            y: {
                formatter: (val) => formatINR(val)
            }
        }
    };

    const container = document.getElementById('chart-spending-trend');
    if (container) {
        chartInstances.spendingTrend = new ApexCharts(container, options);
        chartInstances.spendingTrend.render();
    }
}

function renderCategoryBreakdown(txs, textColor, tooltipTheme) {
    // Filter expenses in current month
    const now = new Date();
    const curMonthExps = txs.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const categoryTotals = {};
    curMonthExps.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + parseFloat(e.amount);
    });

    const categories = Object.keys(categoryTotals);
    const series = Object.values(categoryTotals);

    const options = {
        series: series,
        labels: categories,
        chart: {
            type: 'donut',
            height: 320,
            background: 'transparent',
            foreColor: textColor
        },
        dataLabels: { enabled: false },
        stroke: { colors: ['transparent'] },
        plotOptions: {
            pie: {
                donut: {
                    size: '70%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total Spent',
                            color: textColor,
                            formatter: (w) => {
                                const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return `₹ ${Math.round(sum).toLocaleString('en-IN')}`;
                            }
                        }
                    }
                }
            }
        },
        tooltip: {
            theme: tooltipTheme,
            y: {
                formatter: (val) => formatINR(val)
            }
        },
        legend: {
            position: 'bottom',
            labels: { colors: textColor }
        },
        colors: ['#3b82f6', '#10b981', '#ef4444', '#06b6d4', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e']
    };

    const container = document.getElementById('chart-category-breakdown');
    if (container && series.length > 0) {
        chartInstances.categoryBreakdown = new ApexCharts(container, options);
        chartInstances.categoryBreakdown.render();
    } else if (container) {
        container.innerHTML = `
            <div class="empty-state text-center py-5">
                <span class="text-xs text-muted">No expense records logged this month.</span>
            </div>
        `;
    }
}

function renderNetWealthGrowth(months, data, textColor, gridColor, tooltipTheme) {
    // Wealth growth is cumulative (Opening cash balance + Incomes - Expenses) for each month
    let runningBalance = 0;
    const cumulativeBalance = [];

    // Calculate baseline before 6 months
    const txs = getTransactions();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0,0,0,0);

    txs.forEach(t => {
        const txTime = new Date(t.date).getTime();
        if (txTime < sixMonthsAgo.getTime()) {
            if (t.type === 'income') runningBalance += t.amount;
            else if (t.type === 'expense') runningBalance -= t.amount;
        }
    });

    // Accumulate each month
    for (let i = 0; i < 6; i++) {
        runningBalance += (data.incomes[i] - data.expenses[i]);
        cumulativeBalance.push(Math.round(runningBalance));
    }

    const options = {
        series: [{ name: 'Net Assets', data: cumulativeBalance }],
        chart: {
            type: 'line',
            height: 320,
            toolbar: { show: false },
            background: 'transparent',
            foreColor: textColor
        },
        stroke: { curve: 'straight', width: 4, colors: ['#6366f1'] },
        xaxis: { categories: months },
        yaxis: {
            labels: {
                formatter: (val) => `₹ ${val.toLocaleString('en-IN')}`
            }
        },
        markers: {
            size: 6,
            colors: ['#6366f1'],
            strokeColors: '#ffffff',
            strokeWidth: 2
        },
        grid: { borderColor: gridColor },
        tooltip: {
            theme: tooltipTheme,
            y: {
                formatter: (val) => formatINR(val)
            }
        }
    };

    const container = document.getElementById('chart-savings-growth');
    if (container) {
        chartInstances.savingsGrowth = new ApexCharts(container, options);
        chartInstances.savingsGrowth.render();
    }
}

function renderBudgetUtilization(txs, budgets, textColor, gridColor, tooltipTheme) {
    const categories = budgets.map(b => b.category);
    const limitData = budgets.map(b => b.amount);
    
    // Sum current month spending
    const now = new Date();
    const curMonthExps = txs.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const spentData = budgets.map(b => {
        return curMonthExps
            .filter(e => e.category === b.category)
            .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    });

    const options = {
        series: [
            { name: 'Allocated Limit', data: limitData },
            { name: 'Actual Spent', data: spentData }
        ],
        chart: {
            type: 'bar',
            height: 340,
            toolbar: { show: false },
            background: 'transparent',
            foreColor: textColor
        },
        plotOptions: {
            bar: {
                horizontal: true,
                dataLabels: { position: 'top' },
                borderRadius: 4
            }
        },
        dataLabels: {
            enabled: false
        },
        stroke: { show: true, width: 1, colors: ['transparent'] },
        xaxis: {
            categories: categories,
            labels: {
                formatter: (val) => `₹ ${val.toLocaleString('en-IN')}`
            }
        },
        colors: ['#1e293b', '#3b82f6'],
        grid: { borderColor: gridColor },
        tooltip: {
            theme: tooltipTheme,
            y: {
                formatter: (val) => formatINR(val)
            }
        },
        legend: { labels: { colors: textColor } }
    };

    // Override dark theme background color on limits series
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    options.colors = isDark ? ['rgba(255,255,255,0.08)', '#3b82f6'] : ['#e2e8f0', '#2563eb'];

    const container = document.getElementById('chart-budget-utilization');
    if (container && categories.length > 0) {
        chartInstances.budgetUtilization = new ApexCharts(container, options);
        chartInstances.budgetUtilization.render();
    } else if (container) {
        container.innerHTML = `
            <div class="empty-state text-center py-5">
                <span class="text-xs text-muted">No category budgets defined for tracking.</span>
            </div>
        `;
    }
}

/* 
 =================================================================
 DATA COMPILES TIME UTILITIES
 =================================================================
 */

/**
 * Fetch names of past 6 months to construct chart X-axis labels
 */
function getPast6MonthsLabels() {
    const names = [];
    const dateObjects = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        names.push(d.toLocaleString('en-US', { month: 'short', year: '2-digit' }));
        dateObjects.push(d);
    }

    return { names, dateObjects };
}

/**
 * Compile aggregate totals of income vs expenses per month
 */
function getPast6MonthsIncomeExpense(txs, monthDates) {
    const incomes = Array(6).fill(0);
    const expenses = Array(6).fill(0);

    txs.forEach(t => {
        const txDate = new Date(t.date);
        const txYear = txDate.getFullYear();
        const txMonth = txDate.getMonth();

        // Check if transaction falls into our 6 month ranges
        for (let i = 0; i < 6; i++) {
            const mDate = monthDates[i];
            if (txYear === mDate.getFullYear() && txMonth === mDate.getMonth()) {
                if (t.type === 'income') {
                    incomes[i] += parseFloat(t.amount);
                } else if (t.type === 'expense') {
                    expenses[i] += parseFloat(t.amount);
                }
                break;
            }
        }
    });

    return { incomes, expenses };
}
