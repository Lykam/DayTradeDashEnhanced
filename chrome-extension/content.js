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

// Track which rows have already been logged to avoid duplicate console messages
const loggedRows = new Set();

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

    // Check if all conditions are met:
    // Price between $2 and $20
    // Volume > 100K (100,000)
    // Float < 20M (20,000,000)
    // Relative Volume Daily > 5
    // Relative Volume 5 min > 5

    if (price >= 2 && price <= 20 &&
        volume > 100000 &&
        floatValue < 20000000 &&
        relVolDaily > 5 &&
        relVol5min > 5) {

      // Highlight the first column (Time column) with soft red background
      const firstCell = cells[0];
      if (firstCell) {
        firstCell.style.setProperty('background-color', '#FF6B6B', 'important'); // Softer red
        firstCell.style.setProperty('color', 'white', 'important'); // Make text white for better contrast
      }

      // Create a unique key for this row to avoid duplicate logs
      const rowKey = `${ticker}-${timeText}`;

      // Log to console if we haven't logged this row before
      if (!loggedRows.has(rowKey)) {
        console.log(`✓ HIGHLIGHTED: ${ticker} at ${timeText}`);
        loggedRows.add(rowKey);
      }
    }
  });
}

// Setup function to initialize highlighting and observer
function setupHighlighting() {
  // Run highlighting immediately
  highlightRows();

  // Set up a global observer that watches for ANY changes in the document
  const globalObserver = new MutationObserver(() => {
    highlightRows();
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

    if (checkCount >= 20) {
      clearInterval(intervalId);
    }
  }, 500); // Every 500ms
}

// Try to run immediately
setupHighlighting();
