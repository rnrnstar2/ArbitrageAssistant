#!/usr/bin/env node

/**
 * Claude OAuth Token Extractor for Claude Max users
 * 
 * This script helps extract OAuth tokens from Claude Code for use with GitHub Actions.
 * These tokens allow you to use your Claude Max subscription in GitHub Actions.
 * 
 * Prerequisites:
 * 1. Install Claude Code CLI: npm install -g @anthropic-ai/claude-code
 * 2. Log in to Claude Code: claude login
 * 3. Run this script: node extract-claude-oauth-tokens.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Claude Code stores credentials in ~/.claude/credentials.json
const credentialsPath = path.join(os.homedir(), '.claude', 'credentials.json');

try {
  // Check if credentials file exists
  if (!fs.existsSync(credentialsPath)) {
    console.error('❌ Claude credentials not found!');
    console.error('\nPlease ensure you have:');
    console.error('1. Installed Claude Code: npm install -g @anthropic-ai/claude-code');
    console.error('2. Logged in: claude login');
    process.exit(1);
  }

  // Read and parse credentials
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  if (!credentials.access_token || !credentials.refresh_token || !credentials.expires_at) {
    console.error('❌ Invalid credentials format!');
    console.error('Please try logging in again: claude login');
    process.exit(1);
  }

  console.log('✅ Claude OAuth tokens extracted successfully!\n');
  console.log('Add these secrets to your GitHub repository:');
  console.log('(Settings → Secrets and variables → Actions → New repository secret)\n');
  
  console.log('CLAUDE_ACCESS_TOKEN:');
  console.log(credentials.access_token);
  console.log('\nCLAUDE_REFRESH_TOKEN:');
  console.log(credentials.refresh_token);
  console.log('\nCLAUDE_EXPIRES_AT:');
  console.log(credentials.expires_at);
  
  console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
  console.log('1. These tokens are tied to your Claude Max account');
  console.log('2. Keep them secure and never commit them to your repository');
  console.log('3. Only use them in private repositories you own');
  console.log('4. This is not officially supported by Anthropic - use responsibly');
  console.log('5. Tokens will expire and need to be refreshed periodically');

} catch (error) {
  console.error('❌ Error reading credentials:', error.message);
  process.exit(1);
}