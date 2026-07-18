// AutoDoc AI SPA Client Orchestrator

// In-Memory Custom API Keys (retains security by not saving to localStorage)
const customApiKeys = {
  gemini: '',
  openai: '',
  anthropic: ''
};

// Global SPA State
let currentFilename = 'before.py';
let freeDocsRemaining = 3;

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const githubInput = document.getElementById('github-url-input');
  const fetchBtn = document.getElementById('fetch-btn');
  const beforeTextarea = document.getElementById('before-textarea');
  const charCounter = document.getElementById('char-counter');
  
  const languageSelect = document.getElementById('language-select');
  const formatSelect = document.getElementById('format-select');
  const modelSelect = document.getElementById('model-select');
  const generateBtn = document.getElementById('generate-btn');
  
  const leftFilename = document.getElementById('left-filename');
  const rightFilename = document.getElementById('right-filename');
  
  const afterEmpty = document.getElementById('after-empty');
  const afterCode = document.getElementById('after-code');
  const documentedBadge = document.getElementById('documented-badge');
  const copyBtn = document.getElementById('copy-btn');
  
  const historyToggleBtn = document.getElementById('history-toggle-btn');
  const historyBadge = document.getElementById('history-badge');
  const historyDropdown = document.getElementById('history-dropdown');
  const historyList = document.getElementById('history-list');
  
  const keyIndicatorBtn = document.getElementById('key-indicator-btn');
  const keyStatusText = document.getElementById('key-status-text');
  const keyModal = document.getElementById('key-modal');
  const modalProviderSelect = document.getElementById('modal-provider-select');
  const modalKeyInput = document.getElementById('modal-key-input');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalSaveBtn = document.getElementById('modal-save-btn');
  
  const statusMessage = document.getElementById('status-message');

  // Initialize UI
  updateCharCounter();
  renderHistory();
  updateFreeCounter(freeDocsRemaining);

  // ==========================================
  // 1. Live Character Count
  // ==========================================
  beforeTextarea.addEventListener('input', updateCharCounter);

  function updateCharCounter() {
    const len = beforeTextarea.value.length;
    charCounter.textContent = `${len.toLocaleString()} / 50,000 characters`;
  }

  // ==========================================
  // 2. Fetch Single File from GitHub
  // ==========================================
  fetchBtn.addEventListener('click', async () => {
    const url = githubInput.value.trim();
    if (!url) {
      alert('Please enter a GitHub file URL first.');
      return;
    }

    fetchBtn.disabled = true;
    const originalText = fetchBtn.innerHTML;
    fetchBtn.textContent = 'Fetching...';

    try {
      const response = await fetch('/api/github-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch file content');
      }

      if (data.isSingleFile) {
        beforeTextarea.value = data.content;
        updateCharCounter();
        
        // Extract filename and determine language
        const parts = data.path.split('/');
        const name = parts[parts.length - 1];
        currentFilename = name;
        
        leftFilename.textContent = name;
        rightFilename.textContent = `documented_${name}`;
        
        // Auto-select language from file extension
        const ext = name.split('.').pop().toLowerCase();
        const extensionMap = {
          'py': 'Python',
          'js': 'JavaScript',
          'jsx': 'JavaScript',
          'ts': 'TypeScript',
          'tsx': 'TypeScript',
          'go': 'Go',
          'java': 'Java',
          'cpp': 'C++',
          'h': 'C++',
          'html': 'HTML/CSS',
          'css': 'HTML/CSS'
        };
        if (extensionMap[ext]) {
          languageSelect.value = extensionMap[ext];
        }
      } else {
        alert(`Fetched repo tree successfully, but please supply a single file blob URL (containing /blob/) to pull its code contents.`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = originalText;
    }
  });

  // ==========================================
  // 3. Generate Docs & Analyze
  // ==========================================
  generateBtn.addEventListener('click', async () => {
    const code = beforeTextarea.value.trim();
    if (!code) {
      alert('Please paste some code or fetch a file from GitHub first.');
      return;
    }

    const language = languageSelect.value;
    const outputFormat = formatSelect.value;
    const model = modelSelect.value;

    // Get matching custom key from memory
    const provider = getProviderFromModel(model);
    const customApiKey = customApiKeys[provider];

    generateBtn.disabled = true;
    const originalText = generateBtn.innerHTML;
    generateBtn.textContent = 'Generating...';

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          outputFormat,
          model,
          customApiKey
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Documentation generation failed');
      }

      // Populate output panel
      afterEmpty.style.display = 'none';
      afterCode.textContent = data.documentedCode;
      afterCode.style.display = 'block';
      documentedBadge.style.display = 'inline-block';
      copyBtn.style.display = 'inline-block';

      // Update free limit status
      if (data.remainingFree !== undefined && data.remainingFree !== null) {
        freeDocsRemaining = data.remainingFree;
        updateFreeCounter(freeDocsRemaining);
      }

      // Add to Session History
      saveToHistory({
        filename: currentFilename,
        language,
        format: outputFormat,
        model,
        originalContent: code,
        documentedContent: data.documentedCode
      });

    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = originalText;
    }
  });

  function getProviderFromModel(model) {
    if (model.includes('openai') || model.includes('gpt')) return 'openai';
    if (model.includes('anthropic') || model.includes('claude')) return 'anthropic';
    return 'gemini';
  }

  function updateFreeCounter(count) {
    if (keyStatusText.textContent.includes('Set ✓')) {
      statusMessage.innerHTML = `<span class="pulse-indicator"></span> Custom API Key Active — Unlimited requests available`;
      return;
    }
    statusMessage.innerHTML = `<span class="pulse-indicator"></span> ${count} free docs available today — no key needed`;
    if (count <= 0) {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Free Tier Limit Reached';
    }
  }

  // ==========================================
  // 4. Clipboard Copy
  // ==========================================
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(afterCode.textContent)
      .then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      })
      .catch(err => {
        console.error('Copy failed: ', err);
      });
  });

  // ==========================================
  // 5. API Key Modal Controls
  // ==========================================
  keyIndicatorBtn.addEventListener('click', () => {
    // Populate modal inputs from memory
    const provider = modalProviderSelect.value;
    modalKeyInput.value = customApiKeys[provider] || '';
    keyModal.style.display = 'flex';
  });

  modalProviderSelect.addEventListener('change', () => {
    const provider = modalProviderSelect.value;
    modalKeyInput.value = customApiKeys[provider] || '';
  });

  modalCancelBtn.addEventListener('click', () => {
    keyModal.style.display = 'none';
  });

  modalSaveBtn.addEventListener('click', () => {
    const provider = modalProviderSelect.value;
    const key = modalKeyInput.value.trim();
    
    customApiKeys[provider] = key;
    keyModal.style.display = 'none';

    // Verify if any key is set
    const anyKeySet = Object.values(customApiKeys).some(k => k.length > 0);
    if (anyKeySet) {
      keyStatusText.textContent = 'API Key: Set ✓';
      keyIndicatorBtn.style.borderColor = 'var(--color-success)';
      keyIndicatorBtn.style.color = 'var(--color-success)';
    } else {
      keyStatusText.textContent = 'API Key: No key set';
      keyIndicatorBtn.style.borderColor = '';
      keyIndicatorBtn.style.color = '';
    }
    updateFreeCounter(freeDocsRemaining);
  });

  // ==========================================
  // 6. History Logs
  // ==========================================
  historyToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    historyDropdown.style.display = historyDropdown.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', () => {
    historyDropdown.style.display = 'none';
  });

  historyDropdown.addEventListener('click', (e) => {
    e.stopPropagation(); // Avoid closing dropdown when clicking inside it
  });

  function saveToHistory(item) {
    let list = [];
    try {
      list = JSON.parse(sessionStorage.getItem('autodoc_history') || '[]');
    } catch (e) {
      // Empty fallback
    }

    // Keep unique filenames on top
    list = list.filter(x => x.filename !== item.filename);
    list.unshift(item);

    // Caps history items at 5 logs
    if (list.length > 5) list.pop();

    sessionStorage.setItem('autodoc_history', JSON.stringify(list));
    renderHistory();
  }

  function renderHistory() {
    let list = [];
    try {
      list = JSON.parse(sessionStorage.getItem('autodoc_history') || '[]');
    } catch (e) {
      // Empty fallback
    }

    historyBadge.textContent = list.length;

    if (list.length === 0) {
      historyList.innerHTML = `<li class="dropdown-empty">No history items yet</li>`;
      return;
    }

    historyList.innerHTML = '';
    list.forEach((item, index) => {
      const li = document.createElement('li');
      li.textContent = item.filename;
      li.addEventListener('click', () => {
        // Load history item details
        currentFilename = item.filename;
        leftFilename.textContent = item.filename;
        rightFilename.textContent = `documented_${item.filename}`;
        
        languageSelect.value = item.language;
        formatSelect.value = item.format;
        modelSelect.value = item.model;
        
        beforeTextarea.value = item.originalContent;
        updateCharCounter();
        
        afterEmpty.style.display = 'none';
        afterCode.textContent = item.documentedContent;
        afterCode.style.display = 'block';
        documentedBadge.style.display = 'inline-block';
        copyBtn.style.display = 'inline-block';
        
        statusMessage.textContent = `Loaded from history: ${item.filename}`;
        historyDropdown.style.display = 'none';
      });
      historyList.appendChild(li);
    });
  }
});
