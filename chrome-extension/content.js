// Listen for clicks on ticker links
document.addEventListener('click', function(event) {
  // Check if clicked element matches the ticker link pattern
  const target = event.target;

  if (target.tagName === 'A' &&
      target.classList.contains('MuiLink-root') &&
      target.classList.contains('MuiLink-underlineAlways')) {

    // Get the ticker text
    const tickerText = target.textContent.trim();

    // Copy to clipboard
    navigator.clipboard.writeText(tickerText);

    // Allow the default link behavior to proceed
  }
}, true); // Use capture phase to catch event before other handlers

// Track the last right-clicked ticker
let lastRightClickedTicker = null;

// Listen for right-clicks on ticker links to track which ticker was clicked
document.addEventListener('contextmenu', function(event) {
  const target = event.target;

  if (target.tagName === 'A' &&
      target.classList.contains('MuiLink-root') &&
      target.classList.contains('MuiLink-underlineAlways')) {

    lastRightClickedTicker = target.textContent.trim();

    // Wait for the MUI menu to appear and inject our option
    setTimeout(() => {
      injectMuteOptionIntoMenu();
    }, 50);
  }
}, true);

// Function to inject mute option into the existing MUI menu
function injectMuteOptionIntoMenu() {
  // Find the MUI menu (it's dynamically created)
  const menus = document.querySelectorAll('ul.MuiMenu-list, ul[role="menu"]');

  if (menus.length === 0 || !lastRightClickedTicker) {
    return;
  }

  // Use the most recently created menu (last one)
  const menu = menus[menus.length - 1];

  // Check if we already injected our option
  if (menu.querySelector('#mute-ticker-option')) {
    return;
  }

  const ticker = lastRightClickedTicker;
  const isMuted = mutedTickers.has(ticker);

  // Create our menu item matching MUI style
  const muteOption = document.createElement('li');
  muteOption.id = 'mute-ticker-option';
  muteOption.className = 'MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters css-5t1j1u';
  muteOption.setAttribute('tabindex', '0');
  muteOption.setAttribute('role', 'menuitem');
  muteOption.style.cursor = 'pointer';

  muteOption.innerHTML = `
    ${isMuted ? '🔔 Unmute' : '🔕 Mute'} ${ticker} for today
    <span class="MuiTouchRipple-root css-w0pj6f"></span>
  `;

  // Add click handler
  muteOption.addEventListener('click', () => {
    if (isMuted) {
      mutedTickers.delete(ticker);
      console.log(`🔔 Unmuted: ${ticker}`);
    } else {
      mutedTickers.set(ticker, getTodayDateString());
      console.log(`🔕 Muted: ${ticker} until tomorrow`);
    }
    saveMutedTickers();
    updateMuteIndicator();

    // Close the menu by clicking outside
    document.body.click();
  });

  // Insert at the top of the menu
  menu.insertBefore(muteOption, menu.firstChild);
}

// Function to parse number values from table cells
function parseNumber(text) {
  if (!text) return 0;

  // Remove commas and handle K (thousands) and M (millions) suffixes
  text = text.trim().replace(/,/g, '');

  if (text.endsWith('K')) {
    return parseFloat(text) * 1000;
  } else if (text.endsWith('M')) {
    return parseFloat(text) * 1000000;
  }

  return parseFloat(text) || 0;
}

// Function to play a beep sound
function playBeep(frequency, duration = 200) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch (error) {
    console.error('Error playing beep:', error);
  }
}

// Function to play high pitch beep for strict criteria
function playHighPitchBeep() {
  playBeep(800, 200); // 800 Hz, 200ms duration
}

// Function to play low pitch beep for lax criteria
function playLowPitchBeep() {
  playBeep(400, 200); // 400 Hz, 200ms duration
}

// Track which rows have already been logged to avoid duplicate console messages
const loggedRows = new Set();

// Track which rows have already beeped to avoid duplicate beeps
const beepedRows = new Set();

// Track if we've completed the initial page load
let initialLoadComplete = false;

// Track if alerts are enabled (default: true)
let alertsEnabled = true;

// Track muted tickers with date stamps (Map: ticker -> dateString)
const mutedTickers = new Map();

// Function to get today's date string (YYYY-MM-DD)
function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Function to load muted tickers from localStorage and clean expired ones
function loadMutedTickers() {
  try {
    const stored = localStorage.getItem('mutedTickers');
    if (stored) {
      const data = JSON.parse(stored);
      const today = getTodayDateString();

      // Load only non-expired mutes
      Object.entries(data).forEach(([ticker, dateString]) => {
        if (dateString === today) {
          mutedTickers.set(ticker, dateString);
        }
      });

      // Save cleaned data back
      saveMutedTickers();
    }
  } catch (error) {
    console.error('Error loading muted tickers:', error);
  }
}

// Function to save muted tickers to localStorage
function saveMutedTickers() {
  try {
    const data = Object.fromEntries(mutedTickers);
    localStorage.setItem('mutedTickers', JSON.stringify(data));
  } catch (error) {
    console.error('Error saving muted tickers:', error);
  }
}

// Load muted tickers on initialization
loadMutedTickers();

// Function to highlight Chinese stock info boxes
function highlightChineseStockInfo() {
  // Find all HeadBottom-symbolInfo elements
  const infoElements = document.querySelectorAll('.HeadBottom-symbolInfo');

  infoElements.forEach(element => {
    const text = element.textContent || '';

    // Check if this is a Chinese stock (CN, HK, SG between first and second pipe)
    if (text.includes('| CN |') || text.includes('| HK |') || text.includes('| SG |')) {
      element.style.setProperty('background-color', '#FF6B6B', 'important');
      element.style.setProperty('color', 'white', 'important');
      element.style.setProperty('padding', '4px 8px', 'important');
      element.style.setProperty('border-radius', '4px', 'important');
    } else {
      // Remove highlighting if it's not a Chinese stock
      element.style.removeProperty('background-color');
      element.style.removeProperty('color');
      element.style.removeProperty('padding');
      element.style.removeProperty('border-radius');
    }
  });
}

// Function to check and highlight rows based on criteria
function highlightRows() {
  // Find ALL tr elements
  const allRows = document.querySelectorAll('tr');
  let dataTableRows = [];

  allRows.forEach((row, idx) => {
    // Count direct td children only
    const directTdChildren = Array.from(row.children).filter(child => child.tagName === 'TD');

    if (directTdChildren.length >= 7) {
      dataTableRows.push(row);
    }
  });

  if (dataTableRows.length === 0) {
    // No data rows found yet
    return;
  }


  dataTableRows.forEach((row, index) => {
    const cells = Array.from(row.children).filter(child => child.tagName === 'TD');

    // Skip if not enough cells (though we already filtered for this)
    if (cells.length < 7) {
      return;
    }

    // Extract values based on column positions from the provided HTML example:
    // Column 0: Time (11:59:10 am)
    // Column 1: Symbol (MCTA link)
    // Column 2: Price (21.79)
    // Column 3: Volume (417.40K)
    // Column 4: Float (16.94M)
    // Column 5: Relative Volume Daily (1.58)
    // Column 6: Relative Volume 5 min (112.40)

    const timeText = cells[0]?.textContent.trim();
    const symbolCell = cells[1];
    const priceText = cells[2]?.textContent.trim();
    const volumeText = cells[3]?.textContent.trim();
    const floatText = cells[4]?.textContent.trim();
    const relVolDailyText = cells[5]?.textContent.trim();
    const relVol5minText = cells[6]?.textContent.trim();

    // Extract ticker symbol from the link in the Symbol cell
    const tickerLink = symbolCell?.querySelector('a.MuiLink-root');
    const ticker = tickerLink?.textContent.trim() || '';

    if (!ticker) {
      // Skip rows without a ticker
      return;
    }

    // Skip highlighting and beeping for muted tickers (but still show the row)
    if (mutedTickers.has(ticker)) {
      return;
    }

    const price = parseNumber(priceText);
    const volume = parseNumber(volumeText);
    const floatValue = parseNumber(floatText);
    const relVolDaily = parseNumber(relVolDailyText);
    const relVol5min = parseNumber(relVol5minText);

    // Get full row text to check for Chinese stock indicators
    const rowText = row.textContent || '';

    // Check if this is a Chinese stock (CN, HK, SG between first and second pipe)
    const isChinese = rowText.includes('| CN |') || rowText.includes('| HK |') || rowText.includes('| SG |');

    // Highlight Chinese stocks in red
    if (isChinese) {
      const firstCell = cells[0];
      if (firstCell) {
        firstCell.style.setProperty('background-color', '#FF6B6B', 'important'); // Softer red
        firstCell.style.setProperty('color', 'white', 'important'); // Make text white for better contrast
      }

      // Create a unique key for this row to avoid duplicate logs
      const rowKey = `${ticker}-${timeText}`;

      // Log to console if we haven't logged this row before
      if (!loggedRows.has(rowKey)) {
        console.log(`⚠ CHINESE STOCK: ${ticker} at ${timeText}`);
        loggedRows.add(rowKey);
      }
      return; // Skip further processing for Chinese stocks
    }

    // Check if STRICT criteria are met:
    // Price between $2 and $10
    // Volume > 50K (50,000)
    // Float < 10M (10,000,000)
    // Relative Volume 5 min > 5

    const meetsStrictCriteria = price >= 2 && price <= 10 &&
        volume > 50000 &&
        floatValue < 10000000 &&
        relVol5min > 5;

    // Check if LAX criteria are met:
    // Price between $1.01 and $20
    // Volume > 25K (25,000)
    // Float < 20M (20,000,000)
    // Relative Volume 5 min > 5

    const meetsLaxCriteria = price >= 1.01 && price <= 20 &&
        volume > 25000 &&
        floatValue < 20000000 &&
        relVol5min > 5;

    // Create a unique key for this row
    const rowKey = `${ticker}-${timeText}`;

    if (meetsStrictCriteria) {
      // Highlight the first column (Time column) with soft red background
      const firstCell = cells[0];
      if (firstCell) {
        firstCell.style.setProperty('background-color', '#FF6B6B', 'important'); // Softer red
        firstCell.style.setProperty('color', 'white', 'important'); // Make text white for better contrast
      }

      // Log to console if we haven't logged this row before
      if (!loggedRows.has(rowKey)) {
        console.log(`✓ STRICT CRITERIA: ${ticker} at ${timeText} | Price: $${price.toFixed(2)} | Vol: ${volumeText} | Float: ${floatText}`);
        loggedRows.add(rowKey);
      }

      // Play high pitch beep if we haven't beeped for this row before
      if (!beepedRows.has(rowKey)) {
        if (initialLoadComplete && alertsEnabled) {
          playHighPitchBeep();
        }
        beepedRows.add(rowKey);
      }
    } else if (meetsLaxCriteria) {
      // Lax criteria met but not strict - highlight with light orange and play low pitch beep

      // Highlight the first column (Time column) with light orange background
      const firstCell = cells[0];
      if (firstCell) {
        firstCell.style.setProperty('background-color', '#FFB366', 'important'); // Light orange
        firstCell.style.setProperty('color', 'white', 'important'); // Make text white for better contrast
      }

      // Log to console if we haven't logged this row before
      if (!loggedRows.has(rowKey)) {
        console.log(`⚬ LAX CRITERIA: ${ticker} at ${timeText} | Price: $${price.toFixed(2)} | Vol: ${volumeText} | Float: ${floatText}`);
        loggedRows.add(rowKey);
      }

      // Play low pitch beep if we haven't beeped for this row before
      if (!beepedRows.has(rowKey)) {
        if (initialLoadComplete && alertsEnabled) {
          playLowPitchBeep();
        }
        beepedRows.add(rowKey);
      }
    }
  });
}

// Function to create and inject the alerts toggle button
function createAlertsToggle() {
  // Find the sidebar container with the buttons
  const sidebarContainer = document.querySelector('.css-k1xozo');

  if (!sidebarContainer) {
    // If sidebar not found, retry after a short delay
    setTimeout(createAlertsToggle, 500);
    return;
  }

  // Check if toggle already exists
  if (document.getElementById('alerts-toggle-btn')) {
    return;
  }

  // Create toggle button container to match sidebar button style
  const toggleButton = document.createElement('button');
  toggleButton.id = 'alerts-toggle-btn';
  toggleButton.className = 'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-19jvqnw';
  toggleButton.setAttribute('tabindex', '0');
  toggleButton.setAttribute('type', 'button');

  // Create the inner structure
  const span = document.createElement('span');
  const iconDiv = document.createElement('div');
  iconDiv.className = 'css-e6dtyq';
  iconDiv.setAttribute('aria-label', '');
  iconDiv.style.marginTop = '0.25rem';

  // Create SVG speaker icon
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon AresIcon-svg');
  svg.setAttribute('width', '1.25rem');
  svg.setAttribute('height', '1.25rem');
  svg.style.cssText = 'width: 1.25rem; height: 1.25rem; fill: var(--menu-button-enable);';

  // Speaker icon path (unmuted state)
  const speakerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  speakerPath.setAttribute('d', 'M11 5L6 9H2v6h4l5 4V5z');

  // Sound wave 1
  const wave1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  wave1.setAttribute('d', 'M15.54 8.46a5 5 0 010 7.07');
  wave1.setAttribute('stroke', 'currentColor');
  wave1.setAttribute('stroke-width', '2');
  wave1.setAttribute('fill', 'none');
  wave1.setAttribute('stroke-linecap', 'round');

  // Sound wave 2
  const wave2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  wave2.setAttribute('d', 'M19 6a9 9 0 010 12');
  wave2.setAttribute('stroke', 'currentColor');
  wave2.setAttribute('stroke-width', '2');
  wave2.setAttribute('fill', 'none');
  wave2.setAttribute('stroke-linecap', 'round');

  // Mute line (hidden by default)
  const muteLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  muteLine.setAttribute('x1', '1');
  muteLine.setAttribute('y1', '1');
  muteLine.setAttribute('x2', '23');
  muteLine.setAttribute('y2', '23');
  muteLine.setAttribute('stroke', '#f44336');
  muteLine.setAttribute('stroke-width', '2');
  muteLine.setAttribute('stroke-linecap', 'round');
  muteLine.style.display = 'none';

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.appendChild(speakerPath);
  svg.appendChild(wave1);
  svg.appendChild(wave2);
  svg.appendChild(muteLine);

  iconDiv.appendChild(svg);
  span.appendChild(iconDiv);
  toggleButton.appendChild(span);

  // Add ripple effect span (to match MUI buttons)
  const ripple = document.createElement('span');
  ripple.className = 'MuiTouchRipple-root css-w0pj6f';
  toggleButton.appendChild(ripple);

  // Toggle functionality
  toggleButton.addEventListener('click', () => {
    alertsEnabled = !alertsEnabled;

    if (alertsEnabled) {
      wave1.style.display = '';
      wave2.style.display = '';
      muteLine.style.display = 'none';
      svg.style.fill = 'var(--menu-button-enable)';
      console.log('✓ Alerts enabled');
    } else {
      wave1.style.display = 'none';
      wave2.style.display = 'none';
      muteLine.style.display = '';
      svg.style.fill = '#f44336';
      console.log('✗ Alerts disabled');
    }
  });

  // Insert the button after the settings button (last button in the container)
  sidebarContainer.appendChild(toggleButton);

  // Create muted tickers settings button
  const mutedSettingsButton = document.createElement('button');
  mutedSettingsButton.id = 'muted-settings-btn';
  mutedSettingsButton.className = 'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-19jvqnw';
  mutedSettingsButton.setAttribute('tabindex', '0');
  mutedSettingsButton.setAttribute('type', 'button');
  mutedSettingsButton.setAttribute('title', 'Muted Tickers Settings');

  // Create the inner structure
  const mutedSpan = document.createElement('span');
  const mutedIconDiv = document.createElement('div');
  mutedIconDiv.className = 'css-e6dtyq';
  mutedIconDiv.setAttribute('aria-label', '');
  mutedIconDiv.style.marginTop = '0.25rem';

  // Create SVG icon for muted settings
  const mutedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mutedSvg.setAttribute('class', 'icon AresIcon-svg');
  mutedSvg.setAttribute('width', '1.25rem');
  mutedSvg.setAttribute('height', '1.25rem');
  mutedSvg.setAttribute('viewBox', '0 0 24 24');
  mutedSvg.style.cssText = 'width: 1.25rem; height: 1.25rem; fill: var(--menu-button-enable);';

  // Settings/list icon with mute symbol
  const settingsPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  settingsPath.setAttribute('d', 'M3 6h18M3 12h18M3 18h18');
  settingsPath.setAttribute('stroke', 'currentColor');
  settingsPath.setAttribute('stroke-width', '2');
  settingsPath.setAttribute('stroke-linecap', 'round');
  settingsPath.setAttribute('fill', 'none');

  // Small mute indicator
  const muteCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  muteCircle.setAttribute('cx', '20');
  muteCircle.setAttribute('cy', '4');
  muteCircle.setAttribute('r', '3');
  muteCircle.setAttribute('fill', '#f44336');
  muteCircle.id = 'mute-indicator';
  muteCircle.style.display = mutedTickers.size > 0 ? '' : 'none';

  mutedSvg.appendChild(settingsPath);
  mutedSvg.appendChild(muteCircle);

  mutedIconDiv.appendChild(mutedSvg);
  mutedSpan.appendChild(mutedIconDiv);
  mutedSettingsButton.appendChild(mutedSpan);

  // Add ripple effect span (to match MUI buttons)
  const mutedRipple = document.createElement('span');
  mutedRipple.className = 'MuiTouchRipple-root css-w0pj6f';
  mutedSettingsButton.appendChild(mutedRipple);

  // Click handler to open modal
  mutedSettingsButton.addEventListener('click', toggleMutedTickersModal);

  // Insert after alerts toggle
  sidebarContainer.appendChild(mutedSettingsButton);
}

// Function to update the mute indicator badge
function updateMuteIndicator() {
  const indicator = document.getElementById('mute-indicator');
  if (indicator) {
    indicator.style.display = mutedTickers.size > 0 ? '' : 'none';
  }
}

// Function to show/hide muted tickers settings modal
function toggleMutedTickersModal() {
  let modal = document.getElementById('muted-tickers-modal');

  if (modal) {
    // Toggle visibility
    if (modal.style.display === 'none') {
      updateMutedTickersModalContent();
      modal.style.display = 'flex';
    } else {
      modal.style.display = 'none';
    }
    return;
  }

  // Create modal
  modal = document.createElement('div');
  modal.id = 'muted-tickers-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 24px;
    min-width: 400px;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 20px; color: #333;">🔕 Muted Tickers</h2>
      <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
    </div>
    <div id="muted-tickers-content"></div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close handlers
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  modalContent.querySelector('#close-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  updateMutedTickersModalContent();
}

// Function to update the modal content
function updateMutedTickersModalContent() {
  const contentDiv = document.getElementById('muted-tickers-content');
  if (!contentDiv) return;

  if (mutedTickers.size === 0) {
    contentDiv.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #999;">
        <div style="font-size: 48px; margin-bottom: 16px;">🔔</div>
        <div style="font-size: 14px;">No muted tickers</div>
        <div style="font-size: 12px; margin-top: 8px;">Right-click any ticker to mute it</div>
      </div>
    `;
    return;
  }

  let html = `
    <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <div style="color: #666; font-size: 14px;">${mutedTickers.size} ticker${mutedTickers.size > 1 ? 's' : ''} muted until tomorrow</div>
      <button id="clear-all-modal" style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">Clear All</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
  `;

  mutedTickers.forEach((date, ticker) => {
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f5f5f5; border-radius: 6px;">
        <div style="font-size: 14px; font-weight: 500; color: #333;">${ticker}</div>
        <button class="unmute-btn" data-ticker="${ticker}" style="padding: 4px 12px; background: white; color: #f44336; border: 1px solid #f44336; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">Unmute</button>
      </div>
    `;
  });

  html += '</div>';
  contentDiv.innerHTML = html;

  // Add unmute handlers
  contentDiv.querySelectorAll('.unmute-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ticker = btn.getAttribute('data-ticker');
      mutedTickers.delete(ticker);
      saveMutedTickers();
      console.log(`🔔 Unmuted: ${ticker}`);
      updateMuteIndicator();
      updateMutedTickersModalContent();
    });
  });

  // Add clear all handler
  const clearAllBtn = contentDiv.querySelector('#clear-all-modal');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm(`Clear all ${mutedTickers.size} muted tickers?`)) {
        mutedTickers.clear();
        saveMutedTickers();
        console.log('🔔 All tickers unmuted');
        updateMuteIndicator();
        updateMutedTickersModalContent();
      }
    });
  }
}

// Setup function to initialize highlighting and observer
function setupHighlighting() {
  // Run highlighting immediately
  highlightRows();
  highlightChineseStockInfo();

  // Set up a global observer that watches for ANY changes in the document
  const globalObserver = new MutationObserver(() => {
    highlightRows();
    highlightChineseStockInfo();
  });

  // Watch the entire body for any changes
  globalObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false
  });

  // Also try periodic checks for the first 10 seconds
  let checkCount = 0;
  const intervalId = setInterval(() => {
    checkCount++;
    highlightRows();
    highlightChineseStockInfo();

    if (checkCount >= 20) {
      clearInterval(intervalId);
    }
  }, 500); // Every 500ms

  // After 30 seconds, mark initial load as complete and enable beeps for new rows
  setTimeout(() => {
    initialLoadComplete = true;
    console.log('Initial load complete - beep alerts now enabled for new rows');
  }, 30000);
}

// Try to run immediately
setupHighlighting();

// Create the alerts toggle button
createAlertsToggle();
