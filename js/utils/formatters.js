/**
 * Indian Number Formatting and Date/Time Utilities
 */

/**
 * Format a number to Indian Rupee (INR) currency representation
 * Examples: 1000 -> ₹ 1,000, 100000 -> ₹ 1,00,000
 * @param {number} amount - The numerical amount to format
 * @param {boolean} includeDecimals - Whether to force two decimal places (.00)
 * @returns {string} The formatted currency string
 */
function formatINR(amount, includeDecimals = false) {
    if (amount === undefined || amount === null || isNaN(amount)) {
        amount = 0;
    }
    
    // We parse to float to avoid calculation strings
    const floatAmount = parseFloat(amount);

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: includeDecimals ? 2 : 0,
        maximumFractionDigits: includeDecimals ? 2 : 2
    }).format(floatAmount);
}

/**
 * Format a Date object or string into DD/MM/YYYY format
 * @param {Date|string} dateInput - The date input
 * @returns {string} The formatted date
 */
function formatDate(dateInput) {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

/**
 * Format a Date object or string into 24-hour HH:MM time with IST indicator
 * @param {Date|string} dateInput - The date/time input
 * @param {boolean} includeZone - Whether to append the IST timezone tag
 * @returns {string} The formatted time
 */
function formatTime(dateInput, includeZone = true) {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}${includeZone ? ' IST' : ''}`;
}

/**
 * Format Date into full DD/MM/YYYY HH:MM IST format
 * @param {Date|string} dateInput - The date/time input
 * @returns {string} The formatted datetime
 */
function formatDateTime(dateInput) {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    return `${formatDate(date)} ${formatTime(date, true)}`;
}

/**
 * Convert an HTML date input string (YYYY-MM-DD) to DD/MM/YYYY format
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} DD/MM/YYYY
 */
function htmlDateToDDMMYYYY(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Convert a DD/MM/YYYY string to YYYY-MM-DD for HTML input binding
 * @param {string} dateStr - DD/MM/YYYY
 * @returns {string} YYYY-MM-DD
 */
function ddmmyyyyToHtmlDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/**
 * Parse standard ISO timestamps into separate HTML date (YYYY-MM-DD) and time (HH:MM) strings
 * @param {string} isoString - ISO date string
 * @returns {object} { date: 'YYYY-MM-DD', time: 'HH:MM' }
 */
function parseIsoToDateTimeInputs(isoString) {
    if (!isoString) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
    }
    const d = new Date(isoString);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}
