# Documentation

## Pull Request Documentation

The `pull-requests/` directory contains automatically generated documentation for each pull request. These documents are created and updated by Claude Code using GitHub Actions.

### Workflow Types

1. **PR Documentation Generator** (`pr-documentation.yml`)
   - Triggers when a PR is merged
   - Creates comprehensive documentation for the merged PR
   - Uses only MCP GitHub tools (no repository write permissions needed)

2. **Commit Documentation Generator** (`commit-documentation.yml`)
   - Triggers on every commit to main/develop/feature branches
   - Updates existing PR documentation with latest changes
   - Tracks ongoing development progress

### Documentation Structure

Each PR document (`PR-{number}.md`) includes:
- PR metadata (title, number, author, dates)
- Summary of changes
- List of modified files
- Code change analysis
- Breaking changes and migration notes
- Commit history

### Key Feature

These workflows use `allowed_tools: "mcp__github"` to restrict Claude Code to only use MCP GitHub tools. This clever technique allows the action to work without direct repository write permissions, as all file operations go through the GitHub API.