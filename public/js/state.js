// Client-Side State Manager for DocDrift AI

const STATE_STORAGE_KEY = 'docdrift_state';

const MOCK_FILES = [
  {
    path: 'api/generate.js',
    size: 250,
    status: 'undocumented',
    originalContent: `export default function handler(req, res) {
  res.status(200).json({ status: 'not implemented' });
}`,
    documentedContent: `/**
 * API handler to trigger documentation generation.
 * Accepts POST requests with target repository details.
 * 
 * @param {import('@vercel/node').VercelRequest} req - The Vercel request object.
 * @param {import('@vercel/node').VercelResponse} res - The Vercel response object.
 */
export default function handler(req, res) {
  res.status(200).json({ status: 'not implemented' });
}`
  },
  {
    path: 'lib/github.js',
    size: 1450,
    status: 'undocumented',
    originalContent: `export function parseGitHubUrl(url) {
  return url.split('/');
}`,
    documentedContent: `/**
 * Parses a GitHub URL to extract the owner and repository name.
 * 
 * @param {string} url - The raw repository URL from the client.
 * @returns {string[]} Splitted URL path components.
 */
export function parseGitHubUrl(url) {
  return url.split('/');
}`
  },
  {
    path: 'public/app.js',
    size: 450,
    status: 'undocumented',
    originalContent: `console.log('DocDrift AI initialized');`,
    documentedContent: `/**
 * Main application client script.
 * Bootstraps client-side logic, routing, and event handling.
 */
console.log('DocDrift AI initialized');`
  },
  {
    path: 'api/drift-check.js',
    size: 980,
    status: 'documented',
    originalContent: `/**
 * Handles documentation drift checking.
 */
export default function handler(req, res) {
  res.status(200).json({ drift: false });
}`,
    documentedContent: `/**
 * Handles documentation drift checking.
 * Compares current AST representation with cached docstrings.
 * 
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default function handler(req, res) {
  res.status(200).json({ drift: false });
}`
  }
];

export function getStoredState() {
  const data = sessionStorage.getItem(STATE_STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Error parsing state from storage', e);
    return null;
  }
}

export function saveState(state) {
  sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
}

export function initializeWithRepo(repoUrl) {
  let owner = 'owner';
  let repo = 'repo';
  try {
    const parts = repoUrl.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').split('/');
    if (parts.length >= 2) {
      owner = parts[0];
      repo = parts[1];
    }
  } catch (e) {
    // Fallback
  }

  const newState = {
    repo: {
      owner,
      repo,
      defaultBranch: 'main',
      fileCount: MOCK_FILES.length
    },
    files: JSON.parse(JSON.stringify(MOCK_FILES)) // Deep copy
  };
  saveState(newState);
  return newState;
}

export function updateFileStatus(path, status, documentedContent = null) {
  const state = getStoredState();
  if (!state) return;

  const file = state.files.find(f => f.path === path);
  if (file) {
    file.status = status;
    if (documentedContent !== null) {
      file.documentedContent = documentedContent;
    }
    saveState(state);
  }
}

export function clearStoredState() {
  sessionStorage.removeItem(STATE_STORAGE_KEY);
}

export function getSelectedFileForDiff() {
  const path = sessionStorage.getItem('selected_diff_file');
  if (!path) return null;
  const state = getStoredState();
  if (!state) return null;
  return state.files.find(f => f.path === path) || null;
}

export function setSelectedFileForDiff(path) {
  sessionStorage.setItem('selected_diff_file', path);
}
