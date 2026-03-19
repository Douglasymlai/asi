# SIA — Semantic Interface for Agents

> Every production application should expose a semantic manifest that describes what it can do, how it behaves, and what is safe—understandable to both humans and agents.

SIA generates a machine-readable manifest that describes what a React app means, not just what it renders. It scans pages, actions, dynamic behavior, authored workflows, and optional reusable component semantics so future AI agents can understand how to operate the product safely.

## Positioning

SIA is for teams building React-based products that want to expose semantic intent above raw DOM interaction.

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
- root package: single `sia` CLI and compatibility entrypoints

## Architecture

### Three Layers

```
┌─────────────────────────────────────┐
│  Layer 1 — Semantic Authoring       │  ← defines meaning
│  (page purpose, workflows, actions) │
├─────────────────────────────────────┤
│  Layer 2 — JSON Manifest            │  ← structured output
│  (machine-readable app description) │
├─────────────────────────────────────┤
│  Layer 3 — Agent Consumption        │  ← reads manifest
│  (SDK, MCP adapter, reporting)      │
└─────────────────────────────────────┘
```

### Layer 1 — Semantic Authoring

Two sources of semantic data:

**Inferred (automatic via CLI scan):**

- Route structure → page type and purpose
- Component usage → available actions
- Button/link text → action intent
- Form structure → data entities
- Modal patterns → confirmation steps
- Destructive class names / variants → risk level
- Data-fetching patterns → dynamic content structure

**Authored (manual via workflow DSL):**

- Business workflows (what task is being completed)
- Step sequences and branching
- Completion criteria
- Entity relationships

The CLI does the heavy lifting. Authored workflows fill in business logic that can't be inferred from code alone.

### Layer 2 — JSON Manifest (Tree-Structured)

The manifest is a **progressive disclosure tree**. An agent reads top-down: app overview first, then page summaries, then drills into a specific page's workflows and actions only when needed. This mirrors how a human navigates — you understand the site map before you understand a specific form.

### Layer 3 — Agent Consumption

- Agent SDK for reading and navigating the manifest tree
- MCP server adapter (expose manifest as MCP tools)
- Browser-use integration helpers
- **Agent reporting protocol** (agents report workflow outcomes back)

## Manifest Schema — Progressive Disclosure

The manifest is designed to be read **top-down**. An agent starts with the app-level overview and drills deeper only when it needs to act on a specific page. This keeps context windows small and decisions focused.

Top-level sections:

- `app`
- `pages`
- `pageDetails`
- `workflowDetails`
- `metadata`

Optional:

- `components`: semantic catalog for reusable UI components such as shadcn/ui primitives

### Level 0 — App Root

The entry point. Gives the agent a map of the entire application.

```json
{
  "sia": "1.0",
  "app": {
    "name": "my-store-admin",
    "framework": "next.js",
    "domain": "e-commerce",
    "generatedAt": "2025-03-19T12:00:00Z"
  },
  "pages": [
    {
      "id": "orders-list",
      "route": "/orders",
      "type": "list",
      "purpose": "Browse and search orders",
      "entity": "order"
    },
    {
      "id": "order-detail",
      "route": "/orders/:id",
      "type": "detail",
      "purpose": "View and manage a single order",
      "entity": "order",
      "dynamic": true
    }
  ]
}
```

At this level, an agent knows: "This is an e-commerce admin. There are order pages and customer pages. The order detail page is dynamic." It doesn't yet know what actions or workflows exist — it doesn't need to until it navigates to a specific page.

### Level 1 — Page Detail

When the agent navigates to a page, it loads that page's full entry. Actions and workflow summaries are listed but workflow steps are not yet expanded.

```json
{
  "id": "order-detail",
  "route": "/orders/:id",
  "type": "detail",
  "purpose": "View and manage a single order",
  "entity": "order",
  "dynamic": true,
  "dynamicContent": {
    "dataSource": "api",
    "entityFields": ["id", "status", "total", "customer", "items", "created_at"],
    "stateDependent": true,
    "possibleStates": ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"]
  },
  "actions": [
    {
      "id": "refund_order",
      "label": "Refund",
      "intent": "refund_order",
      "risk": "high",
      "requiresConfirmation": true,
      "sideEffects": ["financial", "state_change"],
      "reversible": false,
      "availableWhen": { "status": ["confirmed", "shipped", "delivered"] }
    },
    {
      "id": "cancel_order",
      "label": "Cancel Order",
      "intent": "cancel_order",
      "risk": "high",
      "requiresConfirmation": true,
      "sideEffects": ["financial", "state_change", "notification"],
      "reversible": false,
      "availableWhen": { "status": ["pending", "confirmed"] }
    },
    {
      "id": "edit_shipping",
      "label": "Edit Shipping",
      "intent": "edit_shipping_address",
      "risk": "low",
      "requiresConfirmation": false,
      "sideEffects": ["state_change"],
      "reversible": true,
      "availableWhen": { "status": ["pending", "confirmed"] }
    }
  ],
  "workflows": [
    {
      "id": "refund_order",
      "goal": "Process a refund for an order",
      "trigger": "refund_order",
      "stepsCount": 4
    },
    {
      "id": "cancel_order",
      "goal": "Cancel an order before fulfillment",
      "trigger": "cancel_order",
      "stepsCount": 2
    }
  ]
}
```

At this level, the agent knows: "I'm on an order detail page. The order has a status. I can refund (only if confirmed/shipped/delivered), cancel (only if pending/confirmed), or edit shipping. Refund is a 4-step workflow. Cancel is a 2-step workflow." It can now decide which workflow to execute.

### Level 2 — Workflow Detail

When the agent decides to execute a workflow, it loads the full step sequence.

```json
{
  "id": "refund_order",
  "goal": "Process a refund for an order",
  "trigger": "refund_order",
  "steps": [
    {
      "id": "open_refund_modal",
      "action": "click",
      "target": "refund_order",
      "description": "Open the refund dialog",
      "next": "select_refund_amount"
    },
    {
      "id": "select_refund_amount",
      "action": "input",
      "target": "refund_amount_field",
      "description": "Enter the refund amount",
      "inputType": "currency",
      "next": "confirm_refund",
      "optional_next": ["add_refund_note"]
    },
    {
      "id": "add_refund_note",
      "action": "input",
      "target": "refund_note_field",
      "description": "Add an optional note for the refund reason",
      "inputType": "text",
      "required": false,
      "next": "confirm_refund"
    },
    {
      "id": "confirm_refund",
      "action": "click",
      "target": "confirm_refund_button",
      "description": "Submit the refund",
      "next": null
    }
  ],
  "completion": {
    "signal": "toast_success",
    "message_contains": "refund",
    "redirects_to": "/orders/:id",
    "expectedStateChange": { "status": "refunded" }
  },
  "reporting": {
    "on_success": {
      "workflow": "refund_order",
      "status": "completed",
      "entity": "order",
      "stateTransition": "→ refunded"
    },
    "on_failure": {
      "workflow": "refund_order",
      "status": "failed",
      "failedAtStep": "<step_id>",
      "reason": "<agent_description>"
    }
  }
}
```

## Install

From this repo:

```bash
npm install
npm test
```

When published:

```bash
npm install -D sia
```

## Quick Start

Initialize SIA in a project:

```bash
npx sia init
```

You can force the scaffolded adapter:

```bash
npx sia init --framework next
npx sia init --framework react
```

Then scan and validate:

```bash
npx sia scan
npx sia validate
```

Add authored workflows in `workflows/*.sia.md`, then merge them:

```bash
npx sia compile
```

Serve the manifest for local agent development:

```bash
npx sia serve --port 4380
```

## Config

SIA supports adapter-aware configuration:

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

The first component benchmark focuses on shadcn/ui-style primitives. SIA can add an optional `components` section that captures:

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

`sia diff` compares two manifests and reports changes across pages, workflows, and components:

```bash
npx sia diff --left old-manifest.json --right new-manifest.json
```

Use `--ci` mode in pipelines to fail on breaking changes:

```bash
npx sia diff --left old.json --right new.json --ci --max-changes 10
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

## Roadmap

### Agent Benchmarking & Live Testing

- [ ] Run SIA-guided agents against existing web-automation benchmarks (WebArena, Mind2Web) and measure task completion lift vs. unguided baseline
- [ ] Browser-use integration — pair SIA manifests with browser-use capable agents, run end-to-end workflows against real apps, and measure success rate / wrong-action rate / risky-error rate
- [ ] Ablation harness improvements — automate per-layer ablation (pages only → pages + workflows → full manifest + components) to quantify each layer's contribution
- [ ] Golden-run recording — capture successful agent runs as replayable fixtures for regression testing

### Manifest CMS Dashboard

- [ ] Web-based manifest content management system — visual editor for reviewing, editing, and approving scanned manifests before they go live
- [ ] Side-by-side diff viewer for manifest versions with breaking-change highlights
- [ ] Workflow step editor with drag-and-drop reordering and branch visualization
- [ ] Component catalog browser with live variant/state previews
- [ ] Role-based access — separate views for developers (edit manifest), product managers (review workflows), and agents (read-only consumption)
- [ ] Audit log — track who changed what and when across manifest versions

### Framework & Surface Expansion

- [ ] Vue and Svelte framework adapters
- [ ] React Native / mobile surface support
- [ ] Electron desktop surface support
- [ ] Server-side action discovery (API route scanning for Next.js server actions, tRPC, etc.)

### Agent SDK & Consumption

- [ ] TypeScript SDK for reading and navigating the manifest tree programmatically
- [ ] MCP server adapter — expose manifest pages and workflows as MCP tools for Claude and other LLM agents
- [ ] Agent reporting dashboard — aggregate and visualize workflow success/failure rates across agent runs
- [ ] Manifest versioning and compatibility checks between agent SDK versions and manifest schema versions

### Scanning & Analysis

- [ ] Multi-page workflow discovery — infer cross-page workflows from navigation patterns
- [ ] Form validation rule extraction — capture required fields, formats, and constraints
- [ ] Accessibility semantics — map ARIA roles and labels into the manifest for more precise agent targeting
- [ ] Design system auto-detection beyond shadcn (Radix, MUI, Chakra, Ant Design)

## License

[MIT](./LICENSE)
