// Listen for clicks on ticker links
document.addEventListener('click', function(event) {
  // Check if clicked element matches the ticker link pattern
  const target = event.target;

  if (target.tagName === 'A' &&
      target.classList.contains('MuiLink-root') &&
      target.classList.contains('MuiLink-underlineAlways')) {

    // Get the ticker text and remove $ if present
    const tickerText = target.textContent.trim().replace(/^\$/, '');

    if (tradingViewTabEnabled) {
      // Open TradingView chart in a background tab via the extension background script
      const tradingViewUrl = `https://www.tradingview.com/chart/X9RKeGml/?symbol=${tickerText}`;
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          // Request background to open the tab inactive (active: false)
          chrome.runtime.sendMessage({ action: 'openTab', url: tradingViewUrl, active: false }, (response) => {
            // If background failed, fallback to window.open (will focus)
            if (!response || response.success === false) {
              try { window.open(tradingViewUrl, '_blank'); } catch (e) { /* ignore */ }
            }
          });
        } else {
          // Fallback if chrome runtime not available
          window.open(tradingViewUrl, '_blank');
        }

        // Also copy the ticker to clipboard (preserve original extension behavior)
        try {
          navigator.clipboard.writeText(tickerText);
        } catch (e) {
          // Clipboard may be unavailable in some contexts; ignore silently
        }
      } catch (err) {
        console.error('Failed to request background to open TradingView tab:', err);
        try { window.open(tradingViewUrl, '_blank'); } catch (e) { /* ignore */ }
      }
      // Allow the original click to proceed so the page's own handler runs
    } else {
      // Copy to clipboard
      navigator.clipboard.writeText(tickerText);
    }
  }
}, true); // Use capture phase to catch event before other handlers

// Track the last right-clicked ticker
let lastRightClickedTicker = null;

// Listen for right-clicks on ticker links to track which ticker was clicked
document.addEventListener('contextmenu', function(event) {
  let target = event.target;
  let tickerLink = null;

  // Check if the clicked element is the ticker link
  if (target.tagName === 'A' &&
      target.classList.contains('MuiLink-root') &&
      target.classList.contains('MuiLink-underlineAlways')) {
    tickerLink = target;
  } else {
    // If not, search for the ticker link in the clicked element's children
    tickerLink = target.querySelector('a.MuiLink-root.MuiLink-underlineAlways');

    // If still not found, search up the parent tree (in case they clicked on the td cell)
    if (!tickerLink) {
      let parent = target.parentElement;
      let maxLevels = 5; // Limit how far up we search

      while (parent && maxLevels > 0) {
        tickerLink = parent.querySelector('a.MuiLink-root.MuiLink-underlineAlways');
        if (tickerLink) break;
        parent = parent.parentElement;
        maxLevels--;
      }
    }
  }

  if (tickerLink) {
    lastRightClickedTicker = tickerLink.textContent.trim().replace(/^\$/, '');

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

  // Capture the ticker at injection time to avoid closure issues
  const ticker = lastRightClickedTicker;
  const isMuted = mutedTickers.has(ticker);

  // Check if we already injected our option
  const existingOption = menu.querySelector('#mute-ticker-option');
  if (existingOption) {
    // Remove old option so we can recreate it with the correct ticker
    existingOption.remove();
  }

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

    // Close the menu by clicking the MUI backdrop
    const backdrop = document.querySelector('.MuiBackdrop-root, [role="presentation"]');
    if (backdrop) {
      backdrop.click();
    } else {
      // Fallback: press Escape key to close menu
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27 }));
    }
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

// Track if TradingView new tab is enabled (default: true)
let tradingViewTabEnabled = true;

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
    // Volume > 100K (100,000)
    // Float < 10M (10,000,000)
    // Relative Volume 5 min > 5

    const meetsStrictCriteria = price >= 2 && price <= 10 &&
        volume > 100000 &&
        floatValue < 10000000 &&
        relVol5min > 5;

    // Check if LAX criteria are met:
    // Price between $1.50 and $20
    // Volume > 25K (25,000)
    // Float < 20M (20,000,000)
    // Relative Volume 5 min > 5

    const meetsLaxCriteria = price >= 1.50 && price <= 20 &&
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

  // Create chat scanner button
  const chatScannerButton = document.createElement('button');
  chatScannerButton.id = 'chat-scanner-btn';
  chatScannerButton.className = 'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-19jvqnw';
  chatScannerButton.setAttribute('tabindex', '0');
  chatScannerButton.setAttribute('type', 'button');
  chatScannerButton.setAttribute('title', 'Chat Scanner');

  // Create the inner structure
  const chatSpan = document.createElement('span');
  const chatIconDiv = document.createElement('div');
  chatIconDiv.className = 'css-e6dtyq';
  chatIconDiv.setAttribute('aria-label', '');
  chatIconDiv.style.marginTop = '0.25rem';

  // Create SVG icon for chat scanner
  const chatSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chatSvg.setAttribute('class', 'icon AresIcon-svg');
  chatSvg.setAttribute('width', '1.25rem');
  chatSvg.setAttribute('height', '1.25rem');
  chatSvg.setAttribute('viewBox', '0 0 24 24');
  chatSvg.style.cssText = 'width: 1.25rem; height: 1.25rem; fill: var(--menu-button-enable);';

  // Chat bubble icon
  const chatPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chatPath.setAttribute('d', 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z');
  chatPath.setAttribute('fill', 'currentColor');

  // Search/scan icon overlay
  const scanCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  scanCircle.setAttribute('cx', '12');
  scanCircle.setAttribute('cy', '10');
  scanCircle.setAttribute('r', '3');
  scanCircle.setAttribute('fill', 'none');
  scanCircle.setAttribute('stroke', 'white');
  scanCircle.setAttribute('stroke-width', '1.5');

  chatSvg.appendChild(chatPath);
  chatSvg.appendChild(scanCircle);

  chatIconDiv.appendChild(chatSvg);
  chatSpan.appendChild(chatIconDiv);
  chatScannerButton.appendChild(chatSpan);

  // Add ripple effect span (to match MUI buttons)
  const chatRipple = document.createElement('span');
  chatRipple.className = 'MuiTouchRipple-root css-w0pj6f';
  chatScannerButton.appendChild(chatRipple);

  // Click handler to open modal
  chatScannerButton.addEventListener('click', toggleChatScannerModal);

  // Insert after muted settings button
  sidebarContainer.appendChild(chatScannerButton);

  // Create TradingView new tab toggle button
  const tradingViewButton = document.createElement('button');
  tradingViewButton.id = 'tradingview-toggle-btn';
  tradingViewButton.className = 'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-19jvqnw';
  tradingViewButton.setAttribute('tabindex', '0');
  tradingViewButton.setAttribute('type', 'button');
  tradingViewButton.setAttribute('title', 'Toggle TradingView: Open tickers in new tab vs Copy to clipboard');

  // Create the inner structure
  const tvSpan = document.createElement('span');
  const tvIconDiv = document.createElement('div');
  tvIconDiv.className = 'css-e6dtyq';
  tvIconDiv.setAttribute('aria-label', '');
  tvIconDiv.style.marginTop = '0.25rem';

  // Create SVG icon for TradingView
  const tvSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tvSvg.setAttribute('class', 'icon AresIcon-svg');
  tvSvg.setAttribute('width', '1.25rem');
  tvSvg.setAttribute('height', '1.25rem');
  tvSvg.setAttribute('viewBox', '0 0 24 24');
  tvSvg.style.cssText = 'width: 1.25rem; height: 1.25rem; fill: var(--menu-button-enable);';

  // Chart/window icon (represents opening in new tab)
  const chartPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chartPath.setAttribute('d', 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-2.73-3.54-1.48 1.93L12 17l4.22-5.15-1.26-1.81z');
  chartPath.setAttribute('fill', 'currentColor');

  tvSvg.appendChild(chartPath);

  // Red slash indicator (hidden when enabled, shown when disabled) — matches audio icon behavior
  const tvSlash = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  tvSlash.setAttribute('x1', '3');
  tvSlash.setAttribute('y1', '21');
  tvSlash.setAttribute('x2', '21');
  tvSlash.setAttribute('y2', '3');
  tvSlash.setAttribute('stroke', '#f44336');
  tvSlash.setAttribute('stroke-width', '2');
  tvSlash.setAttribute('stroke-linecap', 'round');
  tvSlash.style.display = tradingViewTabEnabled ? 'none' : '';
  tvSvg.appendChild(tvSlash);
  tvIconDiv.appendChild(tvSvg);
  tvSpan.appendChild(tvIconDiv);
  tradingViewButton.appendChild(tvSpan);

  // Set initial visual state for the toggle
  if (tradingViewTabEnabled) {
    tvSvg.style.fill = 'var(--menu-button-enable)';
    tradingViewButton.setAttribute('aria-pressed', 'true');
    tradingViewButton.classList.add('active');
    tvSlash.style.display = 'none';
  } else {
    tvSvg.style.fill = '#FF9800';
    tradingViewButton.setAttribute('aria-pressed', 'false');
    tradingViewButton.classList.remove('active');
    tvSlash.style.display = '';
  }

  // Add ripple effect span (to match MUI buttons)
  const tvRipple = document.createElement('span');
  tvRipple.className = 'MuiTouchRipple-root css-w0pj6f';
  tradingViewButton.appendChild(tvRipple);

  // Toggle functionality
  tradingViewButton.addEventListener('click', () => {
    tradingViewTabEnabled = !tradingViewTabEnabled;

    if (tradingViewTabEnabled) {
      tvSvg.style.fill = 'var(--menu-button-enable)';
      tvSlash.style.display = 'none';
      tradingViewButton.setAttribute('aria-pressed', 'true');
      tradingViewButton.classList.add('active');
      console.log('📈 TradingView new tab enabled - clicking tickers opens chart');
    } else {
      tvSvg.style.fill = '#FF9800';
      tvSlash.style.display = '';
      tradingViewButton.setAttribute('aria-pressed', 'false');
      tradingViewButton.classList.remove('active');
      console.log('📋 Copy to clipboard enabled - clicking tickers copies symbol');
    }
  });

  // Insert after chat scanner button
  sidebarContainer.appendChild(tradingViewButton);
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

// Chat scanner state and settings
let chatScannerSettings = {
  username: '',
  messageSelector: '.MessageContainer-messageRow', // Warrior Trading chat format
  usernameSelector: '.MessageContainer-username',
  timestampSelector: '.MessageContainer-timestamp',
  contentSelector: '.message-text',
  chatFontSize: '14px' // Default chat font size
};

// Load chat scanner settings from localStorage
function loadChatScannerSettings() {
  try {
    const stored = localStorage.getItem('chatScannerSettings');
    if (stored) {
      chatScannerSettings = { ...chatScannerSettings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading chat scanner settings:', error);
  }
}

// Save chat scanner settings to localStorage
function saveChatScannerSettings() {
  try {
    localStorage.setItem('chatScannerSettings', JSON.stringify(chatScannerSettings));
  } catch (error) {
    console.error('Error saving chat scanner settings:', error);
  }
}

// Load settings on initialization
loadChatScannerSettings();

// Function to parse timestamp from various formats
function parseTimestamp(timestampText) {
  if (!timestampText) return null;

  const text = timestampText.trim();

  // Try parsing ISO format (2025-12-16T10:30:00)
  let date = new Date(text);
  if (!isNaN(date.getTime())) return date;

  // Try parsing time only formats (10:30 AM, 10:30:45, etc.)
  const timeMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
    const meridiem = timeMatch[4]?.toUpperCase();

    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const now = new Date();
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
    return date;
  }

  // Try parsing relative timestamps (5m ago, 2h ago)
  const relativeMatch = text.match(/(\d+)\s*(m|min|minute|h|hour|s|sec|second)s?\s*ago/i);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const now = new Date();

    if (unit.startsWith('m')) {
      return new Date(now.getTime() - value * 60 * 1000);
    } else if (unit.startsWith('h')) {
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    } else if (unit.startsWith('s')) {
      return new Date(now.getTime() - value * 1000);
    }
  }

  return null;
}

// Function to scan chat messages
function scanChatMessages() {
  const messages = [];
  const messageElements = document.querySelectorAll(chatScannerSettings.messageSelector);

  messageElements.forEach(elem => {
    try {
      let username = '';
      let timestamp = null;
      let content = '';

      // Extract username
      const usernameElem = elem.querySelector(chatScannerSettings.usernameSelector);
      if (usernameElem) {
        username = usernameElem.textContent.trim();
      } else {
        // Fallback: try to find username in the element text
        username = elem.textContent.split(':')[0]?.trim() || '';
      }

      // Extract timestamp
      const timestampElem = elem.querySelector(chatScannerSettings.timestampSelector);
      if (timestampElem) {
        timestamp = parseTimestamp(timestampElem.textContent);
      } else {
        // Fallback: use data-timestamp attribute or current time
        const dataTimestamp = elem.getAttribute('data-timestamp');
        if (dataTimestamp) {
          timestamp = new Date(dataTimestamp);
        }
      }

      // Extract content
      const contentElem = elem.querySelector(chatScannerSettings.contentSelector);
      if (contentElem) {
        content = contentElem.textContent.trim();
      } else {
        // Fallback: use full element text
        content = elem.textContent.trim();
      }

      // Only add messages with valid data
      if (username && content) {
        messages.push({
          username,
          timestamp: timestamp || new Date(),
          content,
          element: elem
        });
      }
    } catch (error) {
      console.error('Error parsing chat message:', error, elem);
    }
  });

  return messages;
}

// Function to filter messages by username
function filterMessagesByUser(messages, targetUsername) {
  if (!targetUsername) return messages;

  const normalizedTarget = targetUsername.toLowerCase().trim();
  return messages.filter(msg =>
    msg.username.toLowerCase().trim().includes(normalizedTarget)
  );
}

// Function to group messages by 15-minute intervals
function groupMessagesByTimeInterval(messages, intervalMinutes = 15) {
  const groups = {};

  messages.forEach(msg => {
    const time = msg.timestamp;

    // Round down to nearest interval
    const roundedMinutes = Math.floor(time.getMinutes() / intervalMinutes) * intervalMinutes;
    const intervalStart = new Date(time);
    intervalStart.setMinutes(roundedMinutes, 0, 0);

    const intervalEnd = new Date(intervalStart);
    intervalEnd.setMinutes(intervalStart.getMinutes() + intervalMinutes);

    const key = intervalStart.toISOString();

    if (!groups[key]) {
      groups[key] = {
        start: intervalStart,
        end: intervalEnd,
        messages: []
      };
    }

    groups[key].messages.push(msg);
  });

  // Sort groups by time
  const sortedGroups = Object.entries(groups).sort((a, b) =>
    a[1].start.getTime() - b[1].start.getTime()
  );

  return sortedGroups.map(([key, group]) => group);
}

// Function to format time for display
function formatTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

// Function to format grouped messages for copying
function formatGroupForCopy(group) {
  const startTime = formatTime(group.start);
  const endTime = formatTime(group.end);

  let text = `=== ${startTime} - ${endTime} ===\n\n`;

  group.messages.forEach(msg => {
    const msgTime = formatTime(msg.timestamp);
    text += `[${msgTime}] ${msg.username}: ${msg.content}\n`;
  });

  return text;
}

// Function to toggle chat scanner modal
function toggleChatScannerModal() {
  let modal = document.getElementById('chat-scanner-modal');

  if (modal) {
    // Toggle visibility
    if (modal.style.display === 'none') {
      modal.style.display = 'flex';
      refreshChatScan();
    } else {
      modal.style.display = 'none';
    }
    return;
  }

  // Create modal
  modal = document.createElement('div');
  modal.id = 'chat-scanner-modal';
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
    min-width: 700px;
    max-width: 900px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 20px; color: #333;">💬 Chat Scanner</h2>
      <button id="close-scanner-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
    </div>

    <div style="margin-bottom: 20px; padding: 16px; background: #f5f5f5; border-radius: 6px;">
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 12px; font-weight: 500; color: #666; margin-bottom: 6px;">USERNAME TO FILTER</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="username-input" placeholder="Enter username..."
            value="${chatScannerSettings.username}"
            style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <button id="scan-btn" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 14px;">Scan</button>
        </div>
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 12px; font-weight: 500; color: #666; margin-bottom: 6px;">CHAT FONT SIZE</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="range" id="font-size-slider" min="10" max="24" step="1" value="${parseInt(chatScannerSettings.chatFontSize)}"
            style="flex: 1;">
          <input type="number" id="font-size-input" min="10" max="24" value="${parseInt(chatScannerSettings.chatFontSize)}"
            style="width: 60px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; text-align: center;">
          <span style="font-size: 12px; color: #666; width: 20px;">px</span>
          <button id="apply-font-btn" style="padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 12px;">Apply</button>
        </div>
      </div>

      <details style="margin-top: 12px;">
        <summary style="cursor: pointer; font-size: 12px; font-weight: 500; color: #666; user-select: none;">⚙️ Advanced Settings (CSS Selectors)</summary>
        <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="display: block; font-size: 11px; color: #666; margin-bottom: 4px;">Message Container</label>
            <input type="text" id="message-selector" value="${chatScannerSettings.messageSelector}"
              style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace;">
          </div>
          <div>
            <label style="display: block; font-size: 11px; color: #666; margin-bottom: 4px;">Username Element</label>
            <input type="text" id="username-selector" value="${chatScannerSettings.usernameSelector}"
              style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace;">
          </div>
          <div>
            <label style="display: block; font-size: 11px; color: #666; margin-bottom: 4px;">Timestamp Element</label>
            <input type="text" id="timestamp-selector" value="${chatScannerSettings.timestampSelector}"
              style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace;">
          </div>
          <div>
            <label style="display: block; font-size: 11px; color: #666; margin-bottom: 4px;">Message Content</label>
            <input type="text" id="content-selector" value="${chatScannerSettings.contentSelector}"
              style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; font-family: monospace;">
          </div>
        </div>
      </details>
    </div>

    <div id="scan-results"></div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close handlers
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  modalContent.querySelector('#close-scanner-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Font size slider/input sync
  const fontSizeSlider = modalContent.querySelector('#font-size-slider');
  const fontSizeInput = modalContent.querySelector('#font-size-input');
  
  fontSizeSlider.addEventListener('input', () => {
    fontSizeInput.value = fontSizeSlider.value;
  });
  
  fontSizeInput.addEventListener('input', () => {
    fontSizeSlider.value = fontSizeInput.value;
  });

  // Apply font size button handler
  modalContent.querySelector('#apply-font-btn').addEventListener('click', () => {
    const newSize = fontSizeInput.value + 'px';
    chatScannerSettings.chatFontSize = newSize;
    saveChatScannerSettings();
    injectChatFontSize(newSize);
    
    // Visual feedback
    const btn = modalContent.querySelector('#apply-font-btn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Applied!';
    btn.style.background = '#66BB6A';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '#4CAF50';
    }, 1500);
  });

  // Scan button handler
  modalContent.querySelector('#scan-btn').addEventListener('click', () => {
    // Update settings
    chatScannerSettings.username = modalContent.querySelector('#username-input').value;
    chatScannerSettings.messageSelector = modalContent.querySelector('#message-selector').value;
    chatScannerSettings.usernameSelector = modalContent.querySelector('#username-selector').value;
    chatScannerSettings.timestampSelector = modalContent.querySelector('#timestamp-selector').value;
    chatScannerSettings.contentSelector = modalContent.querySelector('#content-selector').value;

    saveChatScannerSettings();
    refreshChatScan();
  });

  // Allow Enter key to trigger scan
  modalContent.querySelector('#username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      modalContent.querySelector('#scan-btn').click();
    }
  });

  // Initial scan
  refreshChatScan();
}

// Function to refresh the chat scan results
function refreshChatScan() {
  const resultsDiv = document.getElementById('scan-results');
  if (!resultsDiv) return;

  try {
    // Scan all messages
    const allMessages = scanChatMessages();

    if (allMessages.length === 0) {
      resultsDiv.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
          <div style="font-size: 14px;">No chat messages found</div>
          <div style="font-size: 12px; margin-top: 8px;">Check your CSS selectors in Advanced Settings</div>
        </div>
      `;
      return;
    }

    // Filter by username if specified
    const filteredMessages = filterMessagesByUser(allMessages, chatScannerSettings.username);

    if (filteredMessages.length === 0) {
      resultsDiv.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 16px;">👤</div>
          <div style="font-size: 14px;">No messages found for "${chatScannerSettings.username}"</div>
          <div style="font-size: 12px; margin-top: 8px; color: #666;">Found ${allMessages.length} total messages from other users</div>
        </div>
      `;
      return;
    }

    // Group by 15-minute intervals
    const groups = groupMessagesByTimeInterval(filteredMessages, 15);

    // Render results
    let html = `
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <div style="color: #666; font-size: 14px;">
          Found <strong>${filteredMessages.length}</strong> messages from <strong>${chatScannerSettings.username || 'all users'}</strong>
          in <strong>${groups.length}</strong> time intervals
        </div>
        <button id="copy-all-btn" style="padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
          Copy All
        </button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    groups.forEach((group, index) => {
      const startTime = formatTime(group.start);
      const endTime = formatTime(group.end);
      const groupText = formatGroupForCopy(group);

      html += `
        <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8f9fa;">
            <div style="font-weight: 600; color: #333;">
              ${startTime} - ${endTime}
              <span style="margin-left: 8px; font-size: 12px; color: #666; font-weight: 400;">(${group.messages.length} messages)</span>
            </div>
            <button class="copy-group-btn" data-group-index="${index}" style="padding: 4px 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
              Copy
            </button>
          </div>
          <div style="padding: 12px; max-height: 200px; overflow-y: auto; background: white;">
      `;

      group.messages.forEach(msg => {
        const msgTime = formatTime(msg.timestamp);
        html += `
          <div style="margin-bottom: 8px; font-size: 13px; line-height: 1.5;">
            <span style="color: #999; font-size: 11px;">[${msgTime}]</span>
            <span style="color: #2196F3; font-weight: 500;">${msg.username}:</span>
            <span style="color: #333;">${msg.content}</span>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += '</div>';
    resultsDiv.innerHTML = html;

    // Add copy handlers
    resultsDiv.querySelectorAll('.copy-group-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-group-index'));
        const group = groups[index];
        const text = formatGroupForCopy(group);

        navigator.clipboard.writeText(text).then(() => {
          const originalText = btn.textContent;
          btn.textContent = '✓ Copied!';
          btn.style.background = '#4CAF50';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '#2196F3';
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy:', err);
          alert('Failed to copy to clipboard');
        });
      });
    });

    // Add copy all handler
    const copyAllBtn = resultsDiv.querySelector('#copy-all-btn');
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', () => {
        let allText = `Chat Messages from ${chatScannerSettings.username || 'All Users'}\n`;
        allText += `Total: ${filteredMessages.length} messages\n`;
        allText += `Date: ${new Date().toLocaleDateString()}\n\n`;

        groups.forEach(group => {
          allText += formatGroupForCopy(group) + '\n';
        });

        navigator.clipboard.writeText(allText).then(() => {
          const originalText = copyAllBtn.textContent;
          copyAllBtn.textContent = '✓ All Copied!';
          copyAllBtn.style.background = '#4CAF50';
          setTimeout(() => {
            copyAllBtn.textContent = originalText;
            copyAllBtn.style.background = '#4CAF50';
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy:', err);
          alert('Failed to copy to clipboard');
        });
      });
    }

  } catch (error) {
    console.error('Error scanning chat:', error);
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #f44336;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-size: 14px;">Error scanning chat</div>
        <div style="font-size: 12px; margin-top: 8px; font-family: monospace;">${error.message}</div>
      </div>
    `;
  }
}

// Function to inject custom chat font size
function injectChatFontSize(fontSize = '16px') {
  // Check if style already exists
  let styleElement = document.getElementById('custom-chat-font-style');
  
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'custom-chat-font-style';
    document.head.appendChild(styleElement);
  }
  
  // Update the style
  styleElement.textContent = `
    .message-text.chat-text {
      font-size: ${fontSize} !important;
    }
    .message-text.chat-text span {
      font-size: ${fontSize} !important;
    }
    .MessageContainer-username {
      font-size: ${fontSize} !important;
    }
  `;
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

// Inject custom chat font size from settings
injectChatFontSize(chatScannerSettings.chatFontSize);

// Create the alerts toggle button
createAlertsToggle();
