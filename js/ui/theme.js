/**
 * Quantum Ledger Theme Controller
 * Hot-swapping and local storage persistence of Dark / Light modes
 */



/**
 * Initialize theme system and toggle buttons
 */
function initThemeController() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    // 1. Check current theme settings on bootstrap
    const settings = getSettings();
    const activeTheme = settings.theme || 'dark'; // Dark theme default
    
    applyTheme(activeTheme);

    // 2. Click toggle event hook
    toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        applyTheme(targetTheme);
        updateTheme(targetTheme);
    });
}

/**
 * Update HTML root attributes and swap icons
 * @param {string} theme - 'dark' | 'light'
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Dispatch a window event to let other systems (like ApexCharts) re-initialize
    const event = new CustomEvent('themeChanged', { detail: { theme } });
    window.dispatchEvent(event);
}
