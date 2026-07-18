import {
  parseGitHubUrl,
  fetchRepoDetails,
  fetchFileTree,
  isAllowedCodeFile,
  fetchFileContent,
  RateLimitError,
  GitHubAPIError
} from '../lib/github.js';

/**
 * Serverless function to fetch code or repositories from GitHub.
 * Accepts POST requests with `{ repoUrl: string, githubToken?: string }`.
 * 
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { repoUrl, githubToken } = req.body || {};

  if (!repoUrl) {
    return res.status(400).json({ error: 'Missing required field: repoUrl' });
  }

  try {
    // 1. Parse GitHub URL
    const { owner, repo } = parseGitHubUrl(repoUrl);

    // 2. Fetch repository metadata (specifically default branch)
    let defaultBranch = 'main';
    try {
      const details = await fetchRepoDetails(owner, repo, githubToken);
      defaultBranch = details.defaultBranch || 'main';
    } catch (error) {
      console.warn('Could not dynamically fetch repository details, using "main" as initial default branch:', error.message);
      // If rate limited or private repo check fails here, pass error unless it is a generic failure
      if (error instanceof RateLimitError) {
        return res.status(403).json({
          error: 'GitHub API rate limit reached, try again later or add a personal access token (githubToken)'
        });
      }
      if (error instanceof GitHubAPIError && error.status === 404) {
        return res.status(404).json({ error: `Repository not found: ${owner}/${repo}` });
      }
    }

    // 3. Fetch file tree with fallback support
    let tree;
    let activeBranch = defaultBranch;
    try {
      tree = await fetchFileTree(owner, repo, activeBranch, githubToken);
    } catch (error) {
      // If we tried detected default branch (or main) and got 404, try master as fallback
      if (error instanceof GitHubAPIError && error.status === 404 && activeBranch !== 'master') {
        activeBranch = 'master';
        try {
          tree = await fetchFileTree(owner, repo, activeBranch, githubToken);
        } catch (fallbackError) {
          if (fallbackError instanceof GitHubAPIError && fallbackError.status === 404) {
            return res.status(404).json({ error: `Repository branch not found: verified default branch and "master" both returned 404` });
          }
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }

    // 4. Filter tree to allowed code files
    const filteredFiles = tree.filter(item => 
      item.type === 'blob' && isAllowedCodeFile(item.path, item.size || 0)
    );

    // TODO: support pagination or fetch limits in the future if repo has too many files
    // 5. Fetch content of each filtered file
    const files = await Promise.all(
      filteredFiles.map(async (file) => {
        try {
          const content = await fetchFileContent(owner, repo, activeBranch, file.path, githubToken);
          return {
            path: file.path,
            size: file.size,
            content
          };
        } catch (err) {
          console.error(`Failed to fetch content for ${file.path}:`, err);
          return {
            path: file.path,
            size: file.size,
            content: `// Error loading file: ${err.message}`
          };
        }
      })
    );

    // 6. Return response payload
    return res.status(200).json({
      owner,
      repo,
      defaultBranch: activeBranch,
      files,
      fileCount: files.length
    });

  } catch (error) {
    console.error('Error handling github-fetch request:', error);
    
    if (error instanceof RateLimitError) {
      return res.status(403).json({
        error: 'GitHub API rate limit reached, try again later or add a personal access token (githubToken)'
      });
    }

    if (error instanceof GitHubAPIError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'An unexpected error occurred while fetching the repository details',
      details: error.message
    });
  }
}
