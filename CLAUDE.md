# Personal Website

This is a personal website built with Next.js, TypeScript, and Tailwind CSS.

## Package Manager

This project uses **Bun** as the package manager. Always use `bun` commands instead of npm, yarn, or pnpm.

## Setup

```bash
# Install dependencies
bun install

# Run development server
bun dev

# Build for production
bun run build

# Start production server
bun start

# Run linter
bun run lint
```

The development server runs at [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**:
  - FontAwesome icons
  - TypeIt React (typing animations)
- **Package Manager**: Bun

## Project Structure

```
/app
  /components         # Reusable React components
  /vibes             # Playground for vibe coding experiments
    /whiteboard      # Example vibe project
    page.tsx         # Vibes index page
  page.tsx           # Homepage
  layout.tsx         # Root layout
  globals.css        # Global styles
/public              # Static assets
```

## Vibes Section

The `/vibes` section is a playground for vibe coding and random experimental projects. It's a space for quick, creative coding experiments without overthinking.