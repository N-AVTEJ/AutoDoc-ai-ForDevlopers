# 🚀 AutoDoc AI

**AutoDoc AI** (formerly DocDrift AI) is an elite, web-based tool designed for developers to instantly generate high-quality inline code documentation, detect code smells, and locate bugs using advanced Large Language Models (LLMs). Whether you paste your code directly or fetch it from a GitHub repository, AutoDoc AI analyzes your file structure and returns clean, documented, production-ready code.

---

## ✨ Features

- **📂 GitHub Integration:** Direct fetching of file contents from any public GitHub repository URL (supports blob views, automatic branch detection, and fallbacks).
- **📝 Intelligent Code Documentation:** Automatically generates comments and documentation blocks (e.g., JSDoc/TSDoc for JS/TS, Docstrings for Python, Javadoc for Java).
- **🔍 Bug & Code Smell Analysis:** Performs a fast security and code-quality review. Any obvious bugs, syntax flaws, or smells are added to a clean summary comment block at the very top of your file.
- **🤖 Multi-Provider LLM Support:** Flexible integration with major AI providers:
  - **Google Gemini** (default / `gemini-3.5-flash`)
  - **OpenAI** (`gpt-4o-mini`)
  - **Anthropic** (`claude-3-5-sonnet`)
- **🔑 Client-Side Custom Keys:** Save money and preserve API quotas by supplying your own custom API keys in-memory. Keys are kept safe in the browser state and never stored on local storage or servers.
- **⏳ KV-Backed Free Tier:** Leverages **Vercel KV (Redis)** for robust, IP-based daily rate-limiting (up to 3 free requests per day).

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Premium dark-mode, glassmorphism UI, responsive design), Vanilla ES6 JavaScript SPA.
- **Backend:** Vercel Serverless Functions (`api/` endpoints).
- **Database/Storage:** Vercel KV (Redis) for rate limiting.
- **Hosting:** Optimised for instant deployment on [Vercel](https://vercel.com/).

---

## 📁 Repository Structure

```text
├── api/                   # Serverless endpoint handlers
│   ├── drift-check.js     # Scaffold for checking document-to-code sync
│   ├── generate.js        # Principal AI documentation generator
│   ├── github-fetch.js    # Secure proxy to query the GitHub API
│   └── usage.js           # Endpoint to fetch client IP-based free tier usages
│
├── lib/                   # Internal helper modules
│   ├── github.js          # Octokit-style GitHub REST client
│   ├── kv.js              # Redis rate-limiting helper using @vercel/kv
│   ├── prompts.js         # Standardized AI prompt templates
│   └── providers.js       # Client adaptors for Gemini, OpenAI, & Anthropic APIs
│
├── public/                # Static SPA files
│   ├── app.js             # Client-side UI & state orchestrator
│   ├── index.html         # Main SPA view
│   ├── styles.css         # Main styles (animations, custom variables, layouts)
│   └── diff.html          # Diff viewer interface
│
├── package.json           # Scripts and dependencies
└── vercel.json            # Vercel deployment routes and config
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) (v18+ recommended) installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/AutoDoc-ai-ForDevlopers.git
   cd AutoDoc-ai-ForDevlopers
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   Copy `.env.example` to `.env` (or `.env.local` for local execution):
   ```bash
   cp .env.example .env.local
   ```
   Provide valid API keys for the desired LLM providers or fill in the Vercel KV configuration if you wish to run/test local rate-limiting.

### Running Locally

To run the frontend client along with Vercel Serverless Functions locally:
```bash
npm run vercel-dev
```
This launches Vercel CLI's local server (typically available at `http://localhost:3000`).

---

## 📄 License

This project is licensed under the MIT License. See [package.json](file:///c:/Users/navtej/OneDrive/Documents/PROJECTS/AutoDoc-ai-ForDevlopers/package.json) for details.

