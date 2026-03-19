# Agent Semantic Interface (ASI)

> Semantic layer tooling for React-built webapps, with Next.js and generic React adapters.

ASI generates a machine-readable manifest that describes what a React app means, not just what it renders. It scans pages, actions, dynamic behavior, authored workflows, and optional reusable component semantics so future AI agents can understand how to operate the product safely.

## Positioning

ASI is for teams building React-based products that want to expose semantic intent above raw DOM interaction.

Current first-class support:

- React webapps
- shadcn/ui-style component systems
- Next.js App Router projects
- generic React web projects with explicit or React Router-based page discovery

Designed for later extension:

- Electron-style desktop React apps
- React Native and other mobile React surfaces

## Repository Layout

The repo is now split as an npm-workspaces monorepo:

- `packages/core`: manifest schema, validation, workflow DSL, diffing, reporting, shared scanners, benchmarks
- `packages/framework-next`: Next.js App Router page discovery
- `packages/framework-react`: generic React web page discovery and router-aware scanning
- root package: single `asi` CLI and compatibility entrypoints

## Manifest Model

ASI remains app/page/workflow-first:

- `app`
- `pages`
- `pageDetails`
- `workflowDetails`
- `metadata`

Optional:

- `components`: semantic catalog for reusable UI components such as shadcn/ui primitives

## Install

From this repo:

```bash
npm install
npm test
```

When published:

```bash
npm install -D agent-semantic-interface
```

## Quick Start

Initialize ASI in a project:

```bash
npx asi init
```

You can force the scaffolded adapter:

```bash
npx asi init --framework next
npx asi init --framework react
```

Then scan and validate:

```bash
npx asi scan
npx asi validate
```

Add authored workflows in `workflows/*.asi.md`, then merge them:

```bash
npx asi compile
```

Serve the manifest for local agent development:

```bash
npx asi serve --port 4380
```

## Config

ASI now supports adapter-aware configuration:

```json
{
  "framework": "react",
  "surface": "web",
  "router": "react-router",
  "srcDir": "src",
  "routesDir": "src/pages",
  "routerConfigFile": "src/App.tsx",
  "workflowsDir": "workflows",
  "componentDirs": ["src/components/ui"]
}
```

Key fields:

- `framework`: `next` or `react`
- `surface`: currently validated for `web`
- `router`: `next-app`, `react-router`, or `manual`
- `componentDirs`: optional directories used to build the `components` catalog

## shadcn/ui Component Catalog

The first component benchmark focuses on shadcn/ui-style primitives. ASI can add an optional `components` section that captures:

- semantic role
- variants and states
- important props
- confirmation and risk hints when meaningful

Current high-signal component coverage in the fixture and tests includes:

- `Button`
- `AlertDialog`
- `Dialog`
- `DropdownMenu`
- `Sheet`
- `Tabs`
- `Input`
- `Select`
- `Checkbox`
- `Table`

## Manifest Diffing

`asi diff` compares two manifests and reports changes across pages, workflows, and components:

```bash
npx asi diff --left old-manifest.json --right new-manifest.json
```

Use `--ci` mode in pipelines to fail on breaking changes:

```bash
npx asi diff --left old.json --right new.json --ci --max-changes 10
```

## Verification

The test suite covers:

- Next.js page/workflow scanning
- generic React route scanning (JSX `<Route>`, `createBrowserRouter`, `Component` shorthand, lazy routes)
- shadcn-style component catalog generation
- manifest diffing (pages, workflows, and components)
- workflow merge and validation
- CLI smoke flows for both Next and React
- package tarball install smoke checks

## License

[MIT](./LICENSE)
