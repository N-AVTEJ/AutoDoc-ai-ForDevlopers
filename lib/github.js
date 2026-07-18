/**
 * Helper library for interacting with the GitHub REST API.
 */

// Max file size allowed (100KB)
const MAX_FILE_SIZE_BYTES = 100 * 1024;

// Allowlist of code file extensions
const ALLOWED_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rb',
  '.php', '.c', '.cpp', '.cs', '.html', '.css'
]);

// Directories or files to exclude
const EXCLUDED_PATHS = [
  'node_modules/',
  'dist/',
  'build/',
  '.git/',
  'package-lock.json',
  'yarn.lock'
];

/**
 * Custom Error class to identify GitHub API rate limits.
 */
export class RateLimitError extends Error {
  constructor(message = 'GitHub API rate limit reached') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Custom Error class to identify GitHub API HTTP errors.
 */
export class GitHubAPIError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);
    this.name = 'GitHubAPIError';
    this.status = status;
  }
}

/**
 * Parses a GitHub repository URL into owner and repository name.
 * Handles both "https://github.com/owner/repo" and "github.com/owner/repo" formats,
 * including trailing slashes and .git extensions.
 * 
 * @param {string} url - The GitHub repository URL.
 * @returns {{ owner: string, repo: string }}
 * @throws {Error} if the URL format is invalid.
 */
export function parseGitHubUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Repository URL must be a non-empty string');
  }

  // Remove potential surrounding whitespaces
  const cleanUrl = url.trim();

  // Regex to extract owner and repo
  const regex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+?)(?:\.git|\/)?$/;
  const match = cleanUrl.match(regex);

  if (!match) {
    throw new Error('Invalid GitHub repository URL format');
  }

  return {
    owner: match[1],
    repo: match[2]
  };
}

/**
 * Performs a fetch request to the GitHub API, handling rate limits and authorization.
 * 
 * @param {string} url - The URL to fetch.
 * @param {string} [token] - Optional personal access token.
 * @returns {Promise<Response>}
 */
async function githubFetch(url, token) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'DocDrift-AI-Scaffold'
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    if (rateLimitRemaining === '0') {
      throw new RateLimitError();
    }
  }

  if (!response.ok) {
    throw new GitHubAPIError(
      `GitHub API responded with status ${response.status}: ${response.statusText}`,
      response.status
    );
  }

  return response;
}

/**
 * Retrieves repository metadata (including default branch) from GitHub.
 * 
 * @param {string} owner
 * @param {string} repo
 * @param {string} [token]
 * @returns {Promise<{ defaultBranch: string }>}
 */
export async function fetchRepoDetails(owner, repo, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const response = await githubFetch(url, token);
  const data = await response.json();

  return {
    defaultBranch: data.default_branch || 'main'
  };
}

/**
 * Fetches the recursive file tree for a branch of a repository.
 * 
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @param {string} [token]
 * @returns {Promise<Array<{ path: string, type: string, size?: number }>>}
 */
export async function fetchFileTree(owner, repo, branch, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const response = await githubFetch(url, token);
  const data = await response.json();

  if (!data.tree || !Array.isArray(data.tree)) {
    throw new Error('Invalid file tree returned by GitHub API');
  }

  return data.tree;
}

/**
 * Checks if a file path meets the requirements:
 * 1. Has an extension in the allowlist.
 * 2. Is not in the excludelist.
 * 3. Is under the size limit.
 * 
 * @param {string} path - File path.
 * @param {number} size - File size in bytes.
 * @returns {boolean}
 */
export function isAllowedCodeFile(path, size) {
  if (size > MAX_FILE_SIZE_BYTES) {
    return false;
  }

  // Check exclusions
  for (const exclusion of EXCLUDED_PATHS) {
    if (path.includes(exclusion)) {
      return false;
    }
  }

  // Check extensions
  const lastDotIdx = path.lastIndexOf('.');
  if (lastDotIdx === -1) {
    return false;
  }

  const ext = path.substring(lastDotIdx).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

/**
 * Fetches the raw content of a specific file.
 * 
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @param {string} path
 * @param {string} [token]
 * @returns {Promise<string>}
 */
export async function fetchFileContent(owner, repo, branch, path, token) {
  // Use raw.githubusercontent.com for lighter and direct download.
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const headers = {};
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch file content for ${path}: ${response.statusText}`);
  }

  return response.text();
}
