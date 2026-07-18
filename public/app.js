import {
  getStoredState,
  saveState,
  initializeWithRepo,
  updateFileStatus,
  clearStoredState,
  setSelectedFileForDiff,
  getSelectedFileForDiff
} from './js/state.js';

import { computeDiff } from './js/diff-engine.js';

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.toLowerCase();

  if (path.endsWith('index.html') || path === '/' || path.endsWith('/') || path.includes('index')) {
    initLandingPage();
  } else if (path.includes('explorer')) {
    initExplorerPage();
  } else if (path.includes('diff')) {
    initDiffPage();
  }
});

// ==========================================
// 1. Landing Page Controller
// ==========================================
function initLandingPage() {
  const form = document.getElementById('landing-form');
  const input = document.getElementById('repo-url-input');
  const errorMsg = document.getElementById('error-message');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const repoUrl = input.value.trim();

    // Simple GitHub validation check
    const isGitHub = /^(https?:\/\/)?(www\.)?github\.com\/[^\/]+\/[^\/]+/.test(repoUrl) || 
                     /^github\.com\/[^\/]+\/[^\/]+/.test(repoUrl);

    if (!isGitHub) {
      errorMsg.textContent = 'Please enter a valid GitHub repository URL (e.g. github.com/owner/repo)';
      errorMsg.style.display = 'block';
      return;
    }

    errorMsg.style.display = 'none';
    initializeWithRepo(repoUrl);
    window.location.href = 'explorer.html';
  });
}

// ==========================================
// 2. Explorer Page Controller
// ==========================================
function initExplorerPage() {
  const state = getStoredState();

  const repoDisplay = document.getElementById('repo-display');
  const globalEmpty = document.getElementById('global-empty-state');
  const undocumentedList = document.getElementById('undocumented-list');
  const documentedList = document.getElementById('documented-list');
  const undocumentedEmpty = document.getElementById('undocumented-empty');
  const documentedEmpty = document.getElementById('documented-empty');
  const undocumentedCount = document.getElementById('undocumented-count');
  const documentedCount = document.getElementById('documented-count');
  const generateAllBtn = document.getElementById('generate-all-btn');
  const resetBtn = document.getElementById('reset-btn');

  if (!state) {
    // Hide active components and show empty state
    document.querySelector('.explorer-header').style.display = 'none';
    document.querySelector('.split-layout').style.display = 'none';
    globalEmpty.style.display = 'block';
    if (repoDisplay) repoDisplay.textContent = 'No repository loaded';
    return;
  }

  // Update repository header
  repoDisplay.textContent = `${state.repo.owner}/${state.repo.repo} [${state.repo.defaultBranch}]`;

  // Render file listings
  renderLists();

  // Reset button
  resetBtn.addEventListener('click', () => {
    clearStoredState();
    window.location.href = 'index.html';
  });

  // Generate All button
  generateAllBtn.addEventListener('click', async () => {
    const undocumentedFiles = state.files.filter(f => f.status === 'undocumented');
    if (undocumentedFiles.length === 0) return;

    generateAllBtn.disabled = true;
    generateAllBtn.textContent = 'Generating...';

    // Stagger doc generation simulation
    for (let i = 0; i < undocumentedFiles.length; i++) {
      const file = undocumentedFiles[i];
      await simulateGeneration(file.path);
    }

    generateAllBtn.disabled = false;
    generateAllBtn.textContent = 'Generate All Docs';
  });

  /**
   * Renders Undocumented and Documented file listings from local storage state.
   */
  function renderLists() {
    const currentState = getStoredState();
    if (!currentState) return;

    undocumentedList.innerHTML = '';
    documentedList.innerHTML = '';

    const undocumentedFiles = currentState.files.filter(f => f.status === 'undocumented' || f.status === 'generating');
    const documentedFiles = currentState.files.filter(f => f.status === 'documented');

    undocumentedCount.textContent = undocumentedFiles.length;
    documentedCount.textContent = documentedFiles.length;

    // Show/hide empty list wrappers
    undocumentedEmpty.style.display = undocumentedFiles.length === 0 ? 'block' : 'none';
    documentedEmpty.style.display = documentedFiles.length === 0 ? 'block' : 'none';

    // Disable "Generate All" if nothing is undocumented
    generateAllBtn.disabled = currentState.files.filter(f => f.status === 'undocumented').length === 0;

    // Render Undocumented
    undocumentedFiles.forEach(file => {
      const li = document.createElement('li');
      li.className = 'file-row';

      const isGenerating = file.status === 'generating';

      li.innerHTML = `
        <div class="file-info">
          <span class="file-path">${file.path}</span>
          <span class="file-meta">${file.size} bytes</span>
        </div>
        ${isGenerating 
          ? `<span class="spinner"></span>` 
          : `<button class="btn btn-secondary btn-sm generate-file-btn" data-path="${file.path}">Generate</button>`
        }
      `;

      if (!isGenerating) {
        li.querySelector('.generate-file-btn').addEventListener('click', () => {
          simulateGeneration(file.path);
        });
      }

      undocumentedList.appendChild(li);
    });

    // Render Documented
    documentedFiles.forEach(file => {
      const li = document.createElement('li');
      li.className = 'file-row row-clickable';

      li.innerHTML = `
        <div class="file-info">
          <span class="file-path">${file.path}</span>
          <span class="file-meta">${file.size} bytes</span>
        </div>
        <span class="badge badge-documented">Documented</span>
      `;

      li.addEventListener('click', () => {
        setSelectedFileForDiff(file.path);
        window.location.href = 'diff.html';
      });

      documentedList.appendChild(li);
    });
  }

  /**
   * Simulates documentation generation delay and re-renders lists.
   * @param {string} path - File path to generate docs for.
   */
  function simulateGeneration(path) {
    return new Promise((resolve) => {
      updateFileStatus(path, 'generating');
      renderLists();

      setTimeout(() => {
        updateFileStatus(path, 'documented');
        renderLists();
        resolve();
      }, 1000);
    });
  }
}

// ==========================================
// 3. Diff Page Controller
// ==========================================
function initDiffPage() {
  const state = getStoredState();
  const file = getSelectedFileForDiff();

  const repoDisplay = document.getElementById('repo-display');
  const diffCard = document.getElementById('diff-card');
  const diffEmpty = document.getElementById('diff-empty-state');
  const fileTitle = document.getElementById('file-title');
  const diffViewer = document.getElementById('diff-viewer');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');

  if (!state || !file) {
    diffEmpty.style.display = 'block';
    if (repoDisplay) repoDisplay.textContent = 'No repository loaded';
    return;
  }

  // Update repository header and card title
  repoDisplay.textContent = `${state.repo.owner}/${state.repo.repo} [${state.repo.defaultBranch}]`;
  fileTitle.textContent = `${file.path} (Original vs Documented)`;
  diffCard.style.display = 'flex';

  // Compute and Render Diff
  const diffs = computeDiff(file.originalContent, file.documentedContent);
  renderDiff(diffs);

  // Copy button
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(file.documentedContent)
      .then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.style.backgroundColor = 'var(--color-success)';
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.backgroundColor = '';
        }, 1500);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  });

  // Download button
  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([file.documentedContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Extract filename from path
    const parts = file.path.split('/');
    a.download = parts[parts.length - 1];
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  /**
   * Appends diff rows to the DOM.
   * @param {import('./js/diff-engine.js').DiffLine[]} diffs 
   */
  function renderDiff(diffs) {
    diffViewer.innerHTML = '';

    diffs.forEach(line => {
      const lineEl = document.createElement('div');
      lineEl.className = 'diff-line';
      if (line.type === 'added') lineEl.classList.add('diff-added');
      if (line.type === 'removed') lineEl.classList.add('diff-removed');

      const numEl = document.createElement('span');
      numEl.className = 'diff-line-number';
      numEl.textContent = line.lineNum || '';

      const codeEl = document.createElement('span');
      codeEl.className = 'diff-line-content';
      
      // Prefix indicator
      let prefix = ' ';
      if (line.type === 'added') prefix = '+ ';
      if (line.type === 'removed') prefix = '- ';
      codeEl.textContent = prefix + line.content;

      lineEl.appendChild(numEl);
      lineEl.appendChild(codeEl);
      diffViewer.appendChild(lineEl);
    });
  }
}
