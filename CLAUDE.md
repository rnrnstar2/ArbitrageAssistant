# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Common Operations
```bash
# Start all apps in development mode
npm run dev

# Build all apps and packages
npm run build

# Lint all code
npm run lint

# Format code
npm run format
```

### App-Specific Commands
```bash
# Admin web app (apps/admin)
cd apps/admin
npm run dev          # Next.js dev server
npm run build        # Production build
npm run check-types  # TypeScript validation

# Hedge system desktop app (apps/hedge-system)
cd apps/hedge-system
npm run dev          # Next.js dev server
npm run tauri:dev    # Tauri desktop app development
npm run tauri:build  # Build desktop app
npm run tauri:release # Build with updater artifacts
npm run check-types  # TypeScript validation
```

### Release Commands
```bash
# Create and push release tag (triggers GitHub Actions)
git tag hedge-system-v0.1.1
git push origin hedge-system-v0.1.1

# Manual version bump
cd apps/hedge-system
npm version patch  # or minor, major
```

## Architecture Overview

### Monorepo Structure
- **Turborepo-based** with npm workspaces
- **Two main apps**: `admin` (web), `hedge-system` (Tauri desktop)
- **Shared packages**: UI components, configs, and AWS Amplify backend

### AWS Amplify Backend (`packages/shared-backend`)
- **Framework**: AWS Amplify Gen2 with GraphQL
- **Authentication**: Email-based auth (`ArbitrageAssistantAuth`)
- **Data layer**: Currently has Todo model structure (commented out)
- **Authorization**: Public API key mode, 365-day expiration
- **Entry point**: `amplify/backend.ts`

### Tauri Desktop App (`apps/hedge-system`)
- **Hybrid architecture**: Next.js frontend + Rust backend
- **Development**: Next.js dev server at localhost:3000
- **Production**: Static export to `out/` directory for Tauri bundling
- **Window config**: 800x600 resizable, system theme integration
- **Build output**: Platform-specific desktop executables

### Shared Components
- **UI Library**: Radix UI + shadcn/ui patterns with Tailwind CSS
- **Configuration**: Centralized ESLint, TypeScript, and Tailwind configs
- **Package dependencies**: React 19, Next.js 15.3.2, TypeScript 5.x

## Code Quality Standards
- **Zero warnings policy**: ESLint runs with `--max-warnings 0`
- **Type safety**: TypeScript strict mode across all packages
- **Formatting**: Prettier for consistent code style
- **Build validation**: Type checking required before builds

## Key Development Notes
- **Package manager**: npm@9.8.0 (specified in package.json)
- **Node version**: >=20 required
- **Turbo caching**: Enabled for builds, disabled for dev mode
- **Theme support**: Dark mode implementation in hedge-system app

## Claude Code Action Integration
- **Trigger**: Use `@claude` in issues, PRs, or comments to activate Claude Code assistant
- **Workflow**: `.github/workflows/claude-code.yml` handles automated code assistance
- **Validation**: Automatic linting, type checking, and build validation after changes
- **Permissions**: Full repository access for code modifications and PR/issue management