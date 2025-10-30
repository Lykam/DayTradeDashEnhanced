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
