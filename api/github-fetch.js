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
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { repoUrl, githubToken } = req.body || {};

  if (!repoUrl) {
    return res.status(400).json({ error: 'Missing required field: repoUrl' });
  }

  try {
    // 1. Detect and handle single file blob URLs
    // Example: https://github.com/owner/repo/blob/main/subdir/file.js
    const blobRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/;
    const blobMatch = repoUrl.trim().match(blobRegex);

    if (blobMatch) {
      const [_, owner, repo, branch, path] = blobMatch;
      try {
        const content = await fetchFileContent(owner, repo, branch, path, githubToken);
        return res.status(200).json({
          isSingleFile: true,
          owner,
          repo,
          branch,
          path,
          size: content.length,
          content
        });
      } catch (error) {
        return res.status(404).json({
          error: `Failed to fetch file content for ${path} on branch ${branch} from ${owner}/${repo}`
        });
      }
    }

    // 2. Otherwise parse as standard repository URL
    const { owner, repo } = parseGitHubUrl(repoUrl);

    let defaultBranch = 'main';
    try {
      const details = await fetchRepoDetails(owner, repo, githubToken);
      defaultBranch = details.defaultBranch || 'main';
    } catch (error) {
      console.warn('Could not dynamically fetch repository details, using "main" as initial default branch:', error.message);
      if (error instanceof RateLimitError) {
        return res.status(403).json({
          error: 'GitHub API rate limit reached, try again later or add a personal access token (githubToken)'
        });
      }
      if (error instanceof GitHubAPIError && error.status === 404) {
        return res.status(404).json({ error: `Repository not found: ${owner}/${repo}` });
      }
    }

    let tree;
    let activeBranch = defaultBranch;
    try {
      tree = await fetchFileTree(owner, repo, activeBranch, githubToken);
    } catch (error) {
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

    const filteredFiles = tree.filter(item => 
      item.type === 'blob' && isAllowedCodeFile(item.path, item.size || 0)
    );

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

    return res.status(200).json({
      isSingleFile: false,
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
