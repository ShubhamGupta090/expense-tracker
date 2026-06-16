/**
 * Quantum Ledger Exporter Utilities
 * Generates Bank-grade PDFs, multi-tab Excel workbooks, and raw CSV files
 */



/**
 * Filter transactions between two timestamps
 * @param {Array} transactions - Array of transactions
 * @param {string} fromIso - Starting date-time ISO string
 * @param {string} toIso - Ending date-time ISO string
 * @returns {Array} Filtered list
 */
function getFilteredTransactions(transactions, fromIso, toIso) {
    const fromTime = new Date(fromIso).getTime();
    const toTime = new Date(toIso).getTime();

    return transactions.filter(t => {
        const txTime = new Date(t.date).getTime();
        return txTime >= fromTime && txTime <= toTime;
    });
}

/**
 * Compute opening and closing balances for a selected date range
 * Opening Balance = Cumulative balance of all transactions BEFORE the start date.
 * Closing Balance = Opening Balance + Income in range - Expenses in range.
 * @param {Array} transactions - All transactions
 * @param {string} fromIso - Starting date-time ISO string
 * @param {string} toIso - Ending date-time ISO string
 * @returns {object} { openingBalance, closingBalance, incomeSum, expenseSum, savingsSum }
 */
function calculatePeriodBalances(transactions, budgets, goals, fromIso, toIso) {
    const fromTime = new Date(fromIso).getTime();
    const toTime = new Date(toIso).getTime();

    let openingBalance = 0;

    // Calculate opening balance from transactions before this period
    transactions.forEach(t => {
        const txTime = new Date(t.date).getTime();
        if (txTime < fromTime) {
            if (t.type === 'income') {
                openingBalance += parseFloat(t.amount);
            } else if (t.type === 'expense') {
                openingBalance -= parseFloat(t.amount);
            }
        }
    });

    // Calculate changes in range
    let incomeSum = 0;
    let expenseSum = 0;
    
    transactions.forEach(t => {
        const txTime = new Date(t.date).getTime();
        if (txTime >= fromTime && txTime <= toTime) {
            if (t.type === 'income') {
                incomeSum += parseFloat(t.amount);
            } else if (t.type === 'expense') {
                expenseSum += parseFloat(t.amount);
            }
        }
    });

    const closingBalance = openingBalance + incomeSum - expenseSum;
    const netCashFlow = incomeSum - expenseSum;

    // Calculate budgets summary
    let budgetAllocated = budgets.reduce((sum, b) => sum + parseFloat(b.amount), 0);
    // Find expenses in budgets category
    const rangeExpenses = transactions.filter(t => t.type === 'expense' && txInPeriod(t.date, fromTime, toTime));
    let budgetUsed = rangeExpenses.reduce((sum, e) => {
        // If expense category has budget
        if (budgets.some(b => b.category === e.category)) {
            return sum + parseFloat(e.amount);
        }
        return sum;
    }, 0);
    
    // Goals summary
    let totalSaved = goals.reduce((sum, g) => sum + parseFloat(g.current || 0), 0);

    return {
        openingBalance,
        closingBalance,
        incomeSum,
        expenseSum,
        netCashFlow,
        budgetAllocated,
        budgetUsed,
        budgetRemaining: Math.max(0, budgetAllocated - budgetUsed),
        totalSaved
    };
}

function txInPeriod(dateStr, fromTime, toTime) {
    const t = new Date(dateStr).getTime();
    return t >= fromTime && t <= toTime;
}

/**
 * Generate CSV Statement
 */
function exportToCSV(state, fromIso, toIso) {
    const periodTxs = getFilteredTransactions(state.transactions, fromIso, toIso);
    const summary = calculatePeriodBalances(state.transactions, state.budgets, state.goals, fromIso, toIso);
    
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel formatting
    
    // 1. Header
    csvContent += 'QUANTUM LEDGER - ACCOUNT STATEMENT\r\n';
    csvContent += `Generated At,${formatDateTime(new Date())}\r\n`;
    csvContent += `Statement Period,From ${formatDateTime(fromIso)} To ${formatDateTime(toIso)}\r\n\r\n`;
    
    // 2. Summary Card
    csvContent += 'ACCOUNT SUMMARY\r\n';
    csvContent += `Opening Balance,INR ${summary.openingBalance.toFixed(2)}\r\n`;
    csvContent += `Total Income,INR ${summary.incomeSum.toFixed(2)}\r\n`;
    csvContent += `Total Expenses,INR ${summary.expenseSum.toFixed(2)}\r\n`;
    csvContent += `Net Cash Flow,INR ${summary.netCashFlow.toFixed(2)}\r\n`;
    csvContent += `Closing Balance,INR ${summary.closingBalance.toFixed(2)}\r\n\r\n`;
    
    // 3. Transactions Listing
    csvContent += 'TRANSACTIONS LEDGER\r\n';
    csvContent += 'Date,Time,Type,Category/Source,Description,Payment Mode,Amount (INR),Notes\r\n';
    
    periodTxs.forEach(t => {
        const txDate = formatDate(t.date);
        const txTime = formatTime(t.date, false);
        const amt = t.type === 'income' ? `+${t.amount}` : `-${t.amount}`;
        const desc = t.description.replace(/"/g, '""');
        const notes = (t.notes || '').replace(/"/g, '""');
        csvContent += `"${txDate}","${txTime}","${t.type.toUpperCase()}","${t.category}","${desc}","${t.paymentMethod}",${amt},"${notes}"\r\n`;
    });
    
    csvContent += '\r\n';
    csvContent += '"This statement was automatically generated by the Expense Tracker System and reflects the financial data available at the time of generation."\r\n';
    
    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `QuantumLedger_Statement_${formatDate(fromIso).replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return periodTxs.length;
}

/**
 * Generate Multi-Tab Excel Document using SheetJS
 */
function exportToExcel(state, fromIso, toIso) {
    const periodTxs = getFilteredTransactions(state.transactions, fromIso, toIso);
    const summary = calculatePeriodBalances(state.transactions, state.budgets, state.goals, fromIso, toIso);
    
    const wb = XLSX.utils.book_new();

    // -- Tab 1: Account Summary & Analytics
    const summaryRows = [
        ['QUANTUM LEDGER - FINANCIAL STATEMENT', ''],
        ['Generated At', formatDateTime(new Date())],
        ['Statement Period', `From ${formatDateTime(fromIso)} To ${formatDateTime(toIso)}`],
        ['', ''],
        ['ACCOUNT SUMMARY', ''],
        ['Opening Balance', summary.openingBalance],
        ['Total Income', summary.incomeSum],
        ['Total Expenses', summary.expenseSum],
        ['Net Cash Flow', summary.netCashFlow],
        ['Closing Balance', summary.closingBalance],
        ['', ''],
        ['BUDGET OVERVIEW', ''],
        ['Allocated Budget', summary.budgetAllocated],
        ['Used Budget', summary.budgetUsed],
        ['Remaining Budget', summary.budgetRemaining],
        ['', ''],
        ['SAVINGS PROGRESS', ''],
        ['Accumulated Goals Value', summary.totalSaved],
        ['', ''],
        ['DISCLAIMER', 'This statement was automatically generated by the Expense Tracker System and reflects the financial data available at the time of generation.']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Account Summary');

    // -- Tab 2: Incomes Ledger
    const incomeTxs = periodTxs.filter(t => t.type === 'income');
    const incomeRows = [
        ['Date', 'Time', 'Income Source', 'Description', 'Payment Method', 'Amount (INR)', 'Notes']
    ];
    incomeTxs.forEach(t => {
        incomeRows.push([
            formatDate(t.date),
            formatTime(t.date, false),
            t.category,
            t.description,
            t.paymentMethod,
            t.amount,
            t.notes || ''
        ]);
    });
    const wsIncome = XLSX.utils.aoa_to_sheet(incomeRows);
    XLSX.utils.book_append_sheet(wb, wsIncome, 'Income Statement');

    // -- Tab 3: Expenses Ledger
    const expenseTxs = periodTxs.filter(t => t.type === 'expense');
    const expenseRows = [
        ['Date', 'Time', 'Category', 'Description', 'Payment Method', 'Amount (INR)', 'Notes']
    ];
    expenseTxs.forEach(t => {
        expenseRows.push([
            formatDate(t.date),
            formatTime(t.date, false),
            t.category,
            t.description,
            t.paymentMethod,
            t.amount,
            t.notes || ''
        ]);
    });
    const wsExpense = XLSX.utils.aoa_to_sheet(expenseRows);
    XLSX.utils.book_append_sheet(wb, wsExpense, 'Expense Statement');

    // Write file
    const safeStart = formatDate(fromIso).replace(/\//g, '-');
    XLSX.writeFile(wb, `QuantumLedger_Statement_${safeStart}.xlsx`);
    return periodTxs.length;
}

/**
 * Generate Banking-standard PDF Statement
 */
function exportToPDF(state, fromIso, toIso) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const periodTxs = getFilteredTransactions(state.transactions, fromIso, toIso);
    const summary = calculatePeriodBalances(state.transactions, state.budgets, state.goals, fromIso, toIso);
    
    // Styling constants (Fintech Navy Palette)
    const primaryColor = [14, 19, 32];
    const secondaryColor = [37, 99, 235];
    const textColor = [71, 85, 105];
    const lightBg = [248, 250, 252];
    const borderDark = [226, 232, 240];

    // Page margin configuration
    const margin = 14;
    let y = 20;

    // -- HEADER SECTION
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('QUANTUM LEDGER', margin, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175);
    doc.text('ENTERPRISE FINANCE MANAGEMENT & LEDGER STATEMENT', margin, 24);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`Generated: ${formatDateTime(new Date())}`, 210 - margin, 16, { align: 'right' });
    doc.text(`Period: ${formatDate(fromIso)} to ${formatDate(toIso)}`, 210 - margin, 22, { align: 'right' });
    doc.text('Timezone: Indian Standard Time (IST)', 210 - margin, 28, { align: 'right' });

    y = 48;

    // -- ACCOUNT HOLDER SUMMARY METADATA
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ACCOUNT HOLDER DETAILS', margin, y);
    doc.setDrawColor(...borderDark);
    doc.line(margin, y + 2, 210 - margin, y + 2);

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text('Customer Name: Shubham Gupta', margin, y);
    doc.text('Currency: Indian Rupee (INR)', margin + 70, y);
    doc.text('Designation: Senior Principal Developer', margin + 130, y);

    y += 5;
    doc.text('Registered Email: shubhamgupta090903@gmail.com', margin, y);
    doc.text('Status: Active Verified Premium', margin + 70, y);
    doc.text('Reporting System: LocalStorage V1', margin + 130, y);

    y += 12;

    // -- FINANCIAL LEDGER ACCOUNT SUMMARY TABLE
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ACCOUNT SUMMARY DETAILS', margin, y);
    doc.line(margin, y + 2, 210 - margin, y + 2);
    
    y += 5;

    // Summary cards drawn as small table
    const summaryHead = [['Opening Balance', 'Total Income (+)', 'Total Expenses (-)', 'Savings Goals Saved', 'Net Cash Flow', 'Closing Balance']];
    const summaryBody = [[
        formatINR(summary.openingBalance),
        formatINR(summary.incomeSum),
        formatINR(summary.expenseSum),
        formatINR(summary.totalSaved),
        formatINR(summary.netCashFlow),
        formatINR(summary.closingBalance)
    ]];

    doc.autoTable({
        startY: y,
        head: summaryHead,
        body: summaryBody,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], halign: 'center', fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fillColor: lightBg, textColor: primaryColor, halign: 'center', fontSize: 9, fontStyle: 'bold' },
        columnStyles: {
            5: { fillColor: [219, 234, 254] } // Highlight Closing Balance
        },
        margin: { left: margin, right: margin }
    });

    y = doc.lastAutoTable.finalY + 12;

    // -- INCOME TRANSACTIONS STATEMENT
    const incomeData = periodTxs.filter(t => t.type === 'income');
    if (incomeData.length > 0) {
        doc.setTextColor(...primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('INCOME CREDITS', margin, y);
        doc.line(margin, y + 2, 210 - margin, y + 2);
        
        y += 5;

        const incHead = [['Date & Time', 'Source', 'Description', 'Method', 'Amount (INR)']];
        const incBody = incomeData.map(t => [
            formatDateTime(t.date),
            t.category,
            t.description,
            t.paymentMethod,
            `+${formatINR(t.amount)}`
        ]);

        doc.autoTable({
            startY: y,
            head: incHead,
            body: incBody,
            theme: 'striped',
            headStyles: { fillColor: [4, 120, 87], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { textColor: primaryColor, fontSize: 8 },
            columnStyles: {
                4: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] }
            },
            margin: { left: margin, right: margin }
        });

        y = doc.lastAutoTable.finalY + 12;
    }

    // -- EXPENSE DEBITS STATEMENT
    const expenseData = periodTxs.filter(t => t.type === 'expense');
    if (expenseData.length > 0) {
        // If Y is too low, add page to prevent split tables
        if (y > 230) {
            doc.addPage();
            y = 20;
        }

        doc.setTextColor(...primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('EXPENSE DEBITS', margin, y);
        doc.line(margin, y + 2, 210 - margin, y + 2);
        
        y += 5;

        const expHead = [['Date & Time', 'Category', 'Description', 'Method', 'Amount (INR)']];
        const expBody = expenseData.map(t => [
            formatDateTime(t.date),
            t.category,
            t.description,
            t.paymentMethod,
            `-${formatINR(t.amount)}`
        ]);

        doc.autoTable({
            startY: y,
            head: expHead,
            body: expBody,
            theme: 'striped',
            headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { textColor: primaryColor, fontSize: 8 },
            columnStyles: {
                4: { halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin }
        });

        y = doc.lastAutoTable.finalY + 12;
    }

    // -- BUDGET SUMMARY & SAVINGS GOALS
    if (y > 220) {
        doc.addPage();
        y = 20;
    }

    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('BUDGETS & INVESTMENT GOALS STATUS', margin, y);
    doc.line(margin, y + 2, 210 - margin, y + 2);
    
    y += 5;

    // Write budgets summary side-by-side with goals progress
    const budgetAllocStr = formatINR(summary.budgetAllocated);
    const budgetUsedStr = formatINR(summary.budgetUsed);
    const budgetRemStr = formatINR(summary.budgetRemaining);
    
    // We fetch top categories spent in period
    const categoryTotals = {};
    expenseData.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + parseFloat(e.amount);
    });
    let topCategory = 'N/A';
    let maxSpent = 0;
    Object.entries(categoryTotals).forEach(([cat, val]) => {
        if (val > maxSpent) {
            maxSpent = val;
            topCategory = cat;
        }
    });

    const goalsSummaryStrings = state.goals.map(g => `${g.title}: ${formatINR(g.current)} / ${formatINR(g.target)} (${Math.round((g.current/g.target)*100)}%)`).join(', ');

    const extraHead = [['Summary Metric', 'Report Details']];
    const extraBody = [
        ['Overall Budget Utilization', `${budgetUsedStr} used out of ${budgetAllocStr} allocated (${Math.round((summary.budgetUsed/summary.budgetAllocated)*100) || 0}% utilization). Remaining: ${budgetRemStr}`],
        ['Investment Goals Milestones', goalsSummaryStrings || 'No active savings goals tracked.'],
        ['Top Spending Category (Period)', `${topCategory} (${formatINR(maxSpent)})`],
        ['Calculated Financial Health Score', `${state.transactions.length > 0 ? calculateScoreSummaryText(state) : 'N/A'}`]
    ];

    doc.autoTable({
        startY: y,
        head: extraHead,
        body: extraBody,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { textColor: primaryColor, fontSize: 8 },
        columnStyles: {
            0: { width: 50, fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
    });

    y = doc.lastAutoTable.finalY + 15;

    // -- LEGAL AND AUDIT DISCLAIMER FOOTER
    if (y > 255) {
        doc.addPage();
        y = 20;
    }

    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('CUSTOMER COMPLIANCE & LEGAL NOTICE', margin, y);
    
    y += 3;
    const disclaimer = 'This statement was automatically generated by the Quantum Ledger Personal Finance Management System and reflects the financial data available in local storage at the time of generation. This report serves as an estimate of personal income and expenses and is not an official tax invoice or bank auditing record. Standard Indian numbering formats and IST timezones apply to all columns. Please review transactions independently if filing formal returns.';
    const splitText = doc.splitTextToSize(disclaimer, 210 - (margin * 2));
    doc.text(splitText, margin, y);

    // Page Numbering Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount}`, 210 - margin, 290, { align: 'right' });
        doc.text('QUANTUM LEDGER CORP STATEMENT SYSTEM', margin, 290);
    }

    // Save document
    const safeStart = formatDate(fromIso).replace(/\//g, '-');
    doc.save(`QuantumLedger_Statement_${safeStart}.pdf`);
    return periodTxs.length;
}

// Helper to compile a textual summary of health score for PDF report
function calculateScoreSummaryText(state) {
    // We imported calculateHealthScore in state, but since we are executing in exporter we calculate directly or fetch score
    let score = 50;
    const income = state.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expenses = state.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    if (income > 0) {
        const rate = ((income - expenses) / income) * 100;
        if (rate >= 30) score += 30;
        else if (rate >= 10) score += 10;
        
        const util = (expenses / income) * 100;
        if (util <= 70) score += 20;
    }
    
    let rating = 'CRITICAL';
    if (score >= 80) rating = 'EXCELLENT';
    else if (score >= 65) rating = 'STABLE';
    else if (score >= 50) rating = 'MODERATE';
    
    return `Score: ${score}/100 [Rating: ${rating}]. Evaluated based on savings buffers and investment ratios.`;
}
