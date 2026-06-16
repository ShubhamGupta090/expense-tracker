/**
 * Quantum Ledger Global Components
 * Toasts, Promise-driven Custom Confirmation Modals, and Command Palette
 */

/* 
 =================================================================
 TOAST SYSTEM
 =================================================================
 */

/**
 * Display a floating notification at the top-right of the viewport
 * @param {string} message - Notification text
 * @param {string} type - 'success', 'error', 'info', 'warning'
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Map icons
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'error') iconName = 'alert-octagon';
    if (type === 'warning') iconName = 'alert-triangle';

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${iconName}"></i>
        </div>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);
    
    // Initialize Lucide icons for the new toast
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Auto remove after animation completes (3500ms display + 400ms transition)
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        toast.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 400);
    }, 3500);
}

/* 
 =================================================================
 PROMISE-BASED CONFIRMATION SYSTEM
 =================================================================
 */

/**
 * Trigger custom confirmation modal instead of browser alert/confirm.
 * Usage: const approved = await showConfirm('Reset Data', 'All local records will be deleted.');
 * @param {string} title - Heading of the confirmation box
 * @param {string} message - Descriptive text detailing implications of the change
 * @returns {Promise<boolean>} Resolves to true if approved, false if cancelled
 */
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirm');
        const titleEl = document.getElementById('confirm-modal-title');
        const msgEl = document.getElementById('confirm-modal-message');
        const btnCancel = document.getElementById('btn-confirm-cancel');
        const btnConfirm = document.getElementById('btn-confirm-proceed');
        const iconContainer = document.getElementById('confirm-modal-icon');

        if (!modal) {
            console.error('Confirmation Modal DOM node not found.');
            resolve(false);
            return;
        }

        // Setup text
        titleEl.textContent = title;
        msgEl.textContent = message;

        // Customise icon colors based on critical operations
        if (title.toLowerCase().includes('delete') || title.toLowerCase().includes('reset')) {
            iconContainer.className = 'confirm-icon text-danger';
            iconContainer.innerHTML = '<i data-lucide="trash-2"></i>';
            btnConfirm.className = 'btn btn-danger';
        } else {
            iconContainer.className = 'confirm-icon text-warning';
            iconContainer.innerHTML = '<i data-lucide="alert-triangle"></i>';
            btnConfirm.className = 'btn btn-primary';
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Show Modal
        modal.classList.add('active');

        // Clean up utility to avoid event stacking leaks
        function cleanup() {
            modal.classList.remove('active');
            btnCancel.removeEventListener('click', onCancel);
            btnConfirm.removeEventListener('click', onConfirm);
            document.removeEventListener('keydown', onKeyDown);
        }

        function onCancel() {
            cleanup();
            resolve(false);
        }

        function onConfirm() {
            cleanup();
            resolve(true);
        }

        function onKeyDown(e) {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') onConfirm();
        }

        // Event hooks
        btnCancel.addEventListener('click', onCancel);
        btnConfirm.addEventListener('click', onConfirm);
        document.addEventListener('keydown', onKeyDown);
    });
}

/* 
 =================================================================
 COMMAND PALETTE MANAGER (CTRL+K)
 =================================================================
 */

// Command Registry containing actions
const COMMANDS = [
    { id: 'add-expense', name: 'Log Expense Debit', keyword: '/add-expense', shortcut: 'E', icon: 'arrow-down-left' },
    { id: 'add-income', name: 'Log Income Credit', keyword: '/add-income', shortcut: 'I', icon: 'arrow-up-right' },
    { id: 'go-dashboard', name: 'Navigate: Dashboard Overview', keyword: '/dashboard', shortcut: 'G + D', icon: 'layout-dashboard' },
    { id: 'go-transactions', name: 'Navigate: Transaction Ledger', keyword: '/transactions', shortcut: 'G + T', icon: 'arrow-left-right' },
    { id: 'go-budgets', name: 'Navigate: Budget Allocation caps', keyword: '/budgets', shortcut: 'G + B', icon: 'pie-chart' },
    { id: 'go-savings', name: 'Navigate: Savings Goals milestones', keyword: '/savings', shortcut: 'G + S', icon: 'gem' },
    { id: 'go-analytics', name: 'Navigate: Analytical Charts', keyword: '/analytics', shortcut: 'G + A', icon: 'trending-up' },
    { id: 'go-statements', name: 'Navigate: Statement Generator Center', keyword: '/statements', shortcut: 'G + M', icon: 'file-text' },
    { id: 'toggle-theme', name: 'Switch theme: Light/Dark Mode toggle', keyword: '/theme', shortcut: 'T', icon: 'sun' },
    { id: 'backup-data', name: 'Download JSON Ledger backup', keyword: '/backup', shortcut: 'Ctrl + B', icon: 'download-cloud' },
    { id: 'reset-data', name: 'Purge local finance database', keyword: '/reset', shortcut: 'Ctrl + Alt + R', icon: 'trash-2' }
];

let selectedIndex = 0;
let filteredCommands = [];

/**
 * Bind keyboard events and click listeners for the command palette
 * @param {object} routerCallbacks - Callbacks mapping command IDs to routing actions
 */
function setupCommandPalette(routerCallbacks) {
    const palette = document.getElementById('modal-palette');
    const input = document.getElementById('palette-search-input');
    const resultsContainer = document.getElementById('palette-results-list');
    const btnClose = document.getElementById('btn-close-palette');
    const hintBtn = document.getElementById('palette-hint');

    if (!palette) return;

    // Toggle Palette Trigger (Ctrl + K)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            togglePalette();
        }
    });

    if (hintBtn) {
        hintBtn.addEventListener('click', togglePalette);
    }

    if (btnClose) {
        btnClose.addEventListener('click', closePalette);
    }

    palette.addEventListener('click', (e) => {
        if (e.target === palette) {
            closePalette();
        }
    });

    // Filtering inputs
    input.addEventListener('input', () => {
        renderCommands(input.value);
    });

    // Arrow Key Navigation + Selection hooks
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            changeSelection(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            changeSelection(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            triggerSelectedCommand();
        } else if (e.key === 'Escape') {
            closePalette();
        }
    });

    function togglePalette() {
        if (palette.classList.contains('active')) {
            closePalette();
        } else {
            palette.classList.add('active');
            input.value = '';
            selectedIndex = 0;
            renderCommands('');
            // Focus with slight deferral to avoid double keys
            setTimeout(() => input.focus(), 50);
        }
    }

    function closePalette() {
        palette.classList.remove('active');
        input.blur();
    }

    function renderCommands(query) {
        resultsContainer.innerHTML = '';
        const lowerQuery = query.toLowerCase();
        
        filteredCommands = COMMANDS.filter(cmd => 
            cmd.name.toLowerCase().includes(lowerQuery) || 
            cmd.keyword.toLowerCase().includes(lowerQuery)
        );

        if (filteredCommands.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state text-center py-3">
                    <span class="text-muted text-sm">No command matches "${query}"</span>
                </div>
            `;
            return;
        }

        // Clamp selection index bounds
        if (selectedIndex >= filteredCommands.length) {
            selectedIndex = filteredCommands.length - 1;
        }
        if (selectedIndex < 0) {
            selectedIndex = 0;
        }

        filteredCommands.forEach((cmd, idx) => {
            const item = document.createElement('div');
            item.className = `palette-item ${idx === selectedIndex ? 'selected' : ''}`;
            item.innerHTML = `
                <div class="palette-item-left">
                    <i data-lucide="${cmd.icon}"></i>
                    <span class="palette-item-name">${cmd.name} <span class="text-xs text-muted font-normal">(${cmd.keyword})</span></span>
                </div>
                <span class="palette-item-shortcut">${cmd.shortcut}</span>
            `;
            
            // Mouse select hook
            item.addEventListener('click', () => {
                selectedIndex = idx;
                triggerSelectedCommand();
            });

            resultsContainer.appendChild(item);
        });

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    function changeSelection(direction) {
        if (filteredCommands.length === 0) return;
        selectedIndex += direction;
        
        // Wrap around bounds
        if (selectedIndex < 0) {
            selectedIndex = filteredCommands.length - 1;
        } else if (selectedIndex >= filteredCommands.length) {
            selectedIndex = 0;
        }

        renderCommands(input.value);
        
        // Auto-scroll selected element into focus view
        const selectedEl = resultsContainer.children[selectedIndex];
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest' });
        }
    }

    function triggerSelectedCommand() {
        if (filteredCommands.length === 0 || selectedIndex >= filteredCommands.length) return;
        const cmd = filteredCommands[selectedIndex];
        closePalette();
        
        // Delegate action back to app coordinator callback router
        if (routerCallbacks && typeof routerCallbacks[cmd.id] === 'function') {
            routerCallbacks[cmd.id]();
        } else {
            showToast(`Command ${cmd.keyword} triggered but no callback wired.`, 'info');
        }
    }
}
