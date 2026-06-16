/**
 * Quantum Ledger Main Entry Point
 * Routing, Event Coordination, Canvas Background animations, and IST Clocks
 */












// Global variables
let activeView = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize DB State
    initializeState();

    // 2. Start Core UI Controllers
    initThemeController();
    initTransactionsListeners();
    initBudgetsListeners();
    initSavingsListeners();
    initStatementsListeners();
    initChartsController();

    // 3. Setup Command Palette callbacks mapping
    setupPaletteCallbacks();

    // 4. Start IST Clock Tracker
    startIstClock();

    // 5. Boot Animated Finance Canvas Background
    startCanvasBackground();

    // 6. Bind Navigation Router actions
    setupRouter();

    // 7. Bind Data Synchronization Listeners (The heart of real-time updates)
    setupStateChangedListener();

    // 8. Bind Settings Backups & resets
    setupSettingsHandlers();

    // 9. Render Initial View (Dashboard)
    renderActiveView();

    // Initial Lucide Icons compilation
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

/* 
 =================================================================
 ROUTING & VIEW SWITCHER SYSTEM
 =================================================================
 */

function setupRouter() {
    const navItems = document.querySelectorAll('.nav-item');
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    
    // Sidebar navigation click handler
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            switchView(tab);

            // Close sidebar drawer on mobile after navigation
            if (sidebar && sidebar.classList.contains('mobile-open')) {
                sidebar.classList.remove('mobile-open');
            }
        });
    });

    // Mobile Sidebar Drawer Toggle
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }

    // Dashboard widgets quick redirection links
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-tab-link]');
        if (link) {
            e.preventDefault();
            const target = link.getAttribute('data-tab-link');
            switchView(target);
        }
    });

    // Handle initial URL hash routing on page bookmark loads
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['dashboard', 'transactions', 'budgets', 'savings', 'analytics', 'statements', 'settings'];
    if (hash && validTabs.includes(hash)) {
        switchView(hash);
    }
}

/**
 * Route application view panels
 * @param {string} tabName - Target view ID
 */
function switchView(tabName) {
    if (activeView === tabName) return;

    activeView = tabName;
    
    // Update Sidebar Navigation classes
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update Topbar page title text
    const titleText = document.getElementById('page-title-text');
    if (titleText) {
        const titles = {
            dashboard: 'Financial Overview',
            transactions: 'Ledger Registry',
            budgets: 'Budgets Allocation Planner',
            savings: 'Savings Target Milestones',
            analytics: 'Advanced Financial Analytics',
            statements: 'Report Statements Center',
            settings: 'System Configuration'
        };
        titleText.textContent = titles[tabName] || 'Quantum Ledger';
    }

    // Update browser URL hash
    window.location.hash = tabName;

    // Trigger target renderers
    renderActiveView();
}

/**
 * Render the currently selected panel
 */
function renderActiveView() {
    const panels = document.querySelectorAll('.view-panel');
    panels.forEach(panel => {
        if (panel.id === `view-${activeView}`) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });

    // Compile state snapshot variables
    const activeState = {
        transactions: getTransactions(),
        budgets: getBudgets(),
        goals: getSavingsGoals()
    };

    // Render corresponding UI cards
    if (activeView === 'dashboard') {
        renderDashboard(activeState);
    } else if (activeView === 'transactions') {
        renderTransactionsLedger();
    } else if (activeView === 'budgets') {
        renderBudgetsView();
    } else if (activeView === 'savings') {
        renderSavingsView();
    } else if (activeView === 'analytics') {
        destroyAllCharts();
        renderAllCharts();
    } else if (activeView === 'statements') {
        renderStatementsView();
    }
}

/* 
 =================================================================
 STATE CHANGE SYNC LISTENER (Heart of Real-Time updates)
 =================================================================
 */

function setupStateChangedListener() {
    // Listens for custom 'financeStateChanged' event fired from state.js operations
    document.addEventListener('financeStateChanged', (e) => {
        const { action } = e.detail;
        console.log(`Database transaction detected: [${action}]. Syncing widgets.`);
        
        // Repaint the active view immediately
        renderActiveView();
        
        // If theme toggled, we repaint specific containers
        if (action === 'theme-change') {
            const currentTheme = getTransactions(); // Trigger refresh
        }
    });
}

/* 
 =================================================================
 PALETTE COMMAND CALLBACK MAPS
 =================================================================
 */

function setupPaletteCallbacks() {
    const callbacks = {
        'add-expense': () => {
            const triggerBtn = document.getElementById('btn-quick-add-transaction');
            if (triggerBtn) {
                // We click it to open modal
                triggerBtn.click();
            }
        },
        'add-income': () => {
            // Find and check radio income inside transaction modal
            const modalTx = document.getElementById('modal-transaction');
            if (modalTx) {
                document.getElementById('transaction-modal-title').textContent = 'Log New Transaction';
                document.getElementById('tx-type-income').checked = true;
                
                // Toggle display blocks
                document.getElementById('tx-category-group').style.display = 'none';
                document.getElementById('tx-source-group').style.display = 'block';
                document.getElementById('tx-method-group').style.display = 'none';

                // Setup default date-time
                const now = new Date();
                document.getElementById('tx-date').value = now.toISOString().split('T')[0];
                document.getElementById('tx-time').value = String(now.getHours()).padStart(2, '0') + ':00';
                
                modalTx.classList.add('active');
            }
        },
        'go-dashboard': () => switchView('dashboard'),
        'go-transactions': () => switchView('transactions'),
        'go-budgets': () => switchView('budgets'),
        'go-savings': () => switchView('savings'),
        'go-analytics': () => switchView('analytics'),
        'go-statements': () => switchView('statements'),
        'toggle-theme': () => {
            const toggle = document.getElementById('theme-toggle');
            if (toggle) toggle.click();
        },
        'backup-data': () => {
            const backupBtn = document.getElementById('settings-btn-export-json');
            if (backupBtn) backupBtn.click();
        },
        'reset-data': () => {
            const resetBtn = document.getElementById('settings-btn-reset');
            if (resetBtn) resetBtn.click();
        }
    };

    setupCommandPalette(callbacks);
}

/* 
 =================================================================
 SETTINGS HANDLERS (BACKUPS, IMPORTS, RESETS)
 =================================================================
 */

function setupSettingsHandlers() {
    const importFile = document.getElementById('settings-import-file');
    const btnExportJson = document.getElementById('settings-btn-export-json');
    const btnReset = document.getElementById('settings-btn-reset');

    // Overwrite database from JSON file import
    if (importFile) {
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                const text = evt.target.result;
                const confirmed = await showConfirm(
                    'Import Data Override',
                    'Warning: This operation will overwrite all active transactions, savings milestones, and budget caps with data from the backup file.'
                );
                
                if (confirmed) {
                    const success = importBackupJson(text);
                    if (success) {
                        showToast('Database backup successfully imported.', 'success');
                        switchView('dashboard');
                    } else {
                        showToast('Import failed: Invalid file structure.', 'error');
                    }
                }
                // Clear input
                importFile.value = '';
            };
            reader.readAsText(file);
        });
    }

    // Export current database to JSON backup file
    if (btnExportJson) {
        btnExportJson.addEventListener('click', () => {
            const activeState = {
                transactions: getTransactions(),
                budgets: getBudgets(),
                globalBudget: getGlobalBudget(),
                goals: getSavingsGoals(),
                settings: { theme: document.documentElement.getAttribute('data-theme') }
            };

            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeState, null, 2));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute('href', dataStr);
            dlAnchor.setAttribute('download', `QuantumLedger_Backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            document.body.removeChild(dlAnchor);
            
            showToast('JSON Database backup compiled and downloaded.', 'success');
        });
    }

    // Factory Reset Data
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            const approved = await showConfirm(
                'Erase All Data',
                'DANGER: This operation will delete all ledger records, budget caps, statement logs, and savings progress permanently. This change cannot be undone.'
            );

            if (approved) {
                factoryReset();
                showToast('All data erased. Database reset to blank.', 'warning');
                switchView('dashboard');
            }
        });
    }
}

/* 
 =================================================================
 REAL-TIME CLOCK TIMER (IST TIMEZONE)
 =================================================================
 */

function startIstClock() {
    const clockEl = document.getElementById('current-ist-time');
    if (!clockEl) return;

    const updateClock = () => {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        // Formatted String: DD/MM/YYYY, HH:MM:SS -> clean comma
        clockEl.textContent = formatter.format(now).replace(',', '') + ' IST';
    };

    updateClock();
    setInterval(updateClock, 1000);
}

/* 
 =================================================================
 ANIMATED HTML5 CANVAS BACKGROUND (FINANCIAL SPINES)
 =================================================================
 */

function startCanvasBackground() {
    const canvas = document.getElementById('finance-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Track page resize
    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    // Particle nodes configuration
    const particleCount = 20;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 2 + 1,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25
        });
    }

    let time = 0;

    function animate() {
        ctx.clearRect(0, 0, width, height);

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        // Grid mesh overlays
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(15, 23, 42, 0.015)';
        ctx.lineWidth = 1;
        const gridSpacing = 60;
        for (let x = 0; x < width; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw Math Financial Splines waves (Sine/Cosine composite wave)
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(37, 99, 235, 0.06)';
        
        for (let x = 0; x < width; x += 5) {
            // Composite sine wave representing market trends
            const yOffset = 
                Math.sin(x * 0.002 + time * 0.0005) * 80 + 
                Math.cos(x * 0.005 - time * 0.001) * 30 + 
                height / 2;
            
            if (x === 0) {
                ctx.moveTo(x, yOffset);
            } else {
                ctx.lineTo(x, yOffset);
            }
        }
        ctx.stroke();

        // Draw overlapping secondary wave
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isDark ? 'rgba(99, 102, 241, 0.05)' : 'rgba(79, 70, 229, 0.04)';
        
        for (let x = 0; x < width; x += 5) {
            const yOffset = 
                Math.sin(x * 0.003 - time * 0.0008) * 60 + 
                Math.sin(x * 0.001 + time * 0.0003) * 40 + 
                height / 2 + 100;
            
            if (x === 0) {
                ctx.moveTo(x, yOffset);
            } else {
                ctx.lineTo(x, yOffset);
            }
        }
        ctx.stroke();

        // Draw particles nodes
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.1)';
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // Translate
            p.x += p.vx;
            p.y += p.vy;

            // Boundary wrap arounds
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;
        });

        time += 2;
        requestAnimationFrame(animate);
    }

    animate();
}
