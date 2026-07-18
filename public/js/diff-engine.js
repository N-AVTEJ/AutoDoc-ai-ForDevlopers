/**
 * Line-by-line Diff Engine using the Longest Common Subsequence (LCS) algorithm.
 */

/**
 * Represents a line in a diff view.
 * @typedef {Object} DiffLine
 * @property {'added'|'removed'|'unchanged'} type - The type of change for this line.
 * @property {number} lineNum - The line number in the active document view.
 * @property {string} content - The text content of the line.
 */

/**
 * Computes the line-by-line differences between two code snippets.
 * 
 * @param {string} original - The original undocumented code.
 * @param {string} documented - The new generated documented code.
 * @returns {DiffLine[]} Array of diff line descriptors.
 */
export function computeDiff(original, documented) {
  const originalLines = original.split('\n');
  const documentedLines = documented.split('\n');

  const M = originalLines.length;
  const N = documentedLines.length;

  // Initialize the LCS DP table
  const dp = Array.from({ length: M + 1 }, () => Array(N + 1).fill(0));

  // Build the LCS matrix
  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      if (originalLines[i - 1] === documentedLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the operations
  const result = [];
  let i = M;
  let j = N;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === documentedLines[j - 1]) {
      // Line is unchanged
      result.unshift({
        type: 'unchanged',
        lineNum: j, // Align line numbers with the new documented file view
        content: originalLines[i - 1]
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Line was added in documented version
      result.unshift({
        type: 'added',
        lineNum: j,
        content: documentedLines[j - 1]
      });
      j--;
    } else {
      // Line was removed from original version
      result.unshift({
        type: 'removed',
        lineNum: i,
        content: originalLines[i - 1]
      });
      i--;
    }
  }

  return result;
}
