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
    let details;
    try {
      details = await fetchRepoDetails(owner, repo, githubToken);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(403).json({
          error: 'GitHub API rate limit reached, try again later or add a personal access token (githubToken)'
        });
      }
      if (error instanceof GitHubAPIError) {
        if (error.status === 404) {
          return res.status(404).json({ error: `Repository not found: ${owner}/${repo}` });
        }
        return res.status(error.status).json({ error: error.message });
      }
      throw error;
    }

    const { defaultBranch } = details;

    // 3. Fetch file tree
    const tree = await fetchFileTree(owner, repo, defaultBranch, githubToken);

    // 4. Filter tree to allowed code files
    const filteredFiles = tree.filter(item => 
      item.type === 'blob' && isAllowedCodeFile(item.path, item.size || 0)
    );

    // TODO: support pagination or fetch limits in the future if repo has too many files
    // 5. Fetch content of each filtered file
    const files = await Promise.all(
      filteredFiles.map(async (file) => {
        try {
          const content = await fetchFileContent(owner, repo, defaultBranch, file.path, githubToken);
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
      defaultBranch,
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
