// DocDrift AI Frontend Application Initialization
console.log('DocDrift AI initialized');

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = 'DocDrift AI initialized (Scaffold Mode).';
  }
});
