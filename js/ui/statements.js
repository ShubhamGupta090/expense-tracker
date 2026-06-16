/**
 * Quantum Ledger Statement Generator Center UI
 * Timestamps selection, period presets, export calls, and downloads log history
 */






/**
 * Initialize Statement Center event listeners
 */
function initStatementsListeners() {
    const btnCSV = document.getElementById('btn-export-csv');
    const btnExcel = document.getElementById('btn-export-excel');
    const btnPDF = document.getElementById('btn-export-pdf');

    const presetMonth = document.getElementById('preset-this-month');
    const preset30 = document.getElementById('preset-last-30');
    const presetFY = document.getElementById('preset-current-fy');

    // Default dates initialization on load (Current Month)
    initializeDefaultDates();

    // Preset click handlers
    if (presetMonth) {
        presetMonth.addEventListener('click', () => {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            
            document.getElementById('statement-date-from').value = `${yyyy}-${mm}-01`;
            document.getElementById('statement-time-from').value = '00:00';
            
            // Set end to current date
            const dd = String(now.getDate()).padStart(2, '0');
            document.getElementById('statement-date-to').value = `${yyyy}-${mm}-${dd}`;
            document.getElementById('statement-time-to').value = '23:59';
            
            showToast('Dates reset: This Month selected.', 'info');
        });
    }

    if (preset30) {
        preset30.addEventListener('click', () => {
            const today = new Date();
            const past30 = new Date();
            past30.setDate(today.getDate() - 30);
            
            document.getElementById('statement-date-from').value = past30.toISOString().split('T')[0];
            document.getElementById('statement-time-from').value = '00:00';
            
            document.getElementById('statement-date-to').value = today.toISOString().split('T')[0];
            document.getElementById('statement-time-to').value = '23:59';
            
            showToast('Dates reset: Last 30 Days selected.', 'info');
        });
    }

    if (presetFY) {
        presetFY.addEventListener('click', () => {
            const today = new Date();
            const year = today.getFullYear();
            let startYear = year;
            
            // Indian Financial Year: April 1st to March 31st
            if (today.getMonth() < 3) {
                // If today is Jan-Mar, the FY started April last year
                startYear = year - 1;
            }
            
            document.getElementById('statement-date-from').value = `${startYear}-04-01`;
            document.getElementById('statement-time-from').value = '00:00';
            
            document.getElementById('statement-date-to').value = today.toISOString().split('T')[0];
            document.getElementById('statement-time-to').value = '23:59';
            
            showToast('Dates reset: Financial Year (FY) selected.', 'info');
        });
    }

    // Export Trigger actions
    const triggerExport = (format) => {
        const dateFrom = document.getElementById('statement-date-from').value;
        const timeFrom = document.getElementById('statement-time-from').value;
        const dateTo = document.getElementById('statement-date-to').value;
        const timeTo = document.getElementById('statement-time-to').value;

        if (!dateFrom || !dateTo) {
            showToast('Please select valid From and To dates.', 'warning');
            return;
        }

        const startIso = new Date(`${dateFrom}T${timeFrom}`).toISOString();
        const endIso = new Date(`${dateTo}T${timeTo}`).toISOString();

        if (new Date(startIso).getTime() > new Date(endIso).getTime()) {
            showToast('Start timestamp cannot exceed End timestamp.', 'warning');
            return;
        }

        // Create unified state snapshot object
        const activeState = {
            transactions: getTransactions(),
            budgets: getBudgets(),
            goals: getSavingsGoals()
        };

        let count = 0;
        if (format === 'csv') {
            count = exportToCSV(activeState, startIso, endIso);
        } else if (format === 'excel') {
            count = exportToExcel(activeState, startIso, endIso);
        } else if (format === 'pdf') {
            count = exportToPDF(activeState, startIso, endIso);
        }

        if (count >= 0) {
            // Log export in local database
            logStatementGeneration(startIso, endIso, count);
            showToast(`Generated Statement containing ${count} transactions.`, 'success');
            renderStatementsView();
        }
    };

    if (btnCSV) btnCSV.addEventListener('click', () => triggerExport('csv'));
    if (btnExcel) btnExcel.addEventListener('click', () => triggerExport('excel'));
    if (btnPDF) btnPDF.addEventListener('click', () => triggerExport('pdf'));
}

function initializeDefaultDates() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const fromDateEl = document.getElementById('statement-date-from');
    const toDateEl = document.getElementById('statement-date-to');

    if (fromDateEl && !fromDateEl.value) {
        // Set to 1st of current month
        fromDateEl.value = `${yyyy}-${mm}-01`;
    }
    if (toDateEl && !toDateEl.value) {
        toDateEl.value = `${yyyy}-${mm}-${dd}`;
    }
}

/**
 * Render statements tab components (Logs list, empty states)
 */
function renderStatementsView() {
    const tableBody = document.getElementById('statement-log-table-body');
    const emptyState = document.getElementById('statement-log-empty-state');

    if (!tableBody) return;

    const logs = getStatementLogs();

    if (logs.length === 0) {
        tableBody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    tableBody.innerHTML = logs.map(l => {
        const genAtStr = formatDateTime(l.generatedAt);
        const periodStr = `${formatDate(l.periodStart)} - ${formatDate(l.periodEnd)}`;
        
        return `
            <tr>
                <td class="font-normal text-muted text-xs">${genAtStr}</td>
                <td class="font-semibold">${periodStr}</td>
                <td class="font-normal">${l.recordCount} records</td>
                <td class="text-right">
                    <button class="btn btn-outline btn-xs btn-redownload-stmt" 
                        data-start="${l.periodStart}" 
                        data-end="${l.periodEnd}" 
                        title="Redownload statement for this period">
                        <i data-lucide="download"></i>
                        <span>Download Again</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Attach actions on logs table
    attachLogActionListeners();
}

function attachLogActionListeners() {
    const btns = document.querySelectorAll('.btn-redownload-stmt');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const start = btn.getAttribute('data-start');
            const end = btn.getAttribute('data-end');

            const activeState = {
                transactions: getTransactions(),
                budgets: getBudgets(),
                goals: getSavingsGoals()
            };

            // Redownload defaults to PDF as it is standard report card
            const count = exportToPDF(activeState, start, end);
            showToast(`Redownloaded Statement containing ${count} records.`, 'success');
        });
    });
}
