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

// Function to highlight Chinese stock info boxes
function highlightChineseStockInfo() {
  // Find all HeadBottom-symbolInfo elements
  const infoElements = document.querySelectorAll('.HeadBottom-symbolInfo');

  infoElements.forEach(element => {
    const text = element.textContent || '';

    // Check if this is a Chinese stock (CN or HK between first and second pipe)
    if (text.includes('| CN |') || text.includes('| HK |')) {
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

    const price = parseNumber(priceText);
    const volume = parseNumber(volumeText);
    const floatValue = parseNumber(floatText);
    const relVolDaily = parseNumber(relVolDailyText);
    const relVol5min = parseNumber(relVol5minText);

    // Get full row text to check for Chinese stock indicators
    const rowText = row.textContent || '';

    // Check if this is a Chinese stock (CN or HK between first and second pipe)
    const isChinese = rowText.includes('| CN |') || rowText.includes('| HK |');

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
    // Price between $1.01 and $20
    // Volume > 50K (50,000)
    // Float < 20M (20,000,000)
    // Relative Volume 5 min > 5

    const meetsLaxCriteria = price >= 1.01 && price <= 20 &&
        volume > 50000 &&
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
        if (initialLoadComplete) {
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
        if (initialLoadComplete) {
          playLowPitchBeep();
        }
        beepedRows.add(rowKey);
      }
    }
  });
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
