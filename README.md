# Agent Semantic Interface (ASI)

> Open-source semantic layer that makes web apps understandable and operable by AI agents.

## What is ASI?

ASI is a semantic interface for web applications.

It helps teams expose the meaning of their product UI in a structured way so AI agents do not have to guess from raw DOM, screenshots, or brittle selectors.

Instead of relying only on visible HTML output, ASI adds a machine-readable layer that describes:

- what a page is for
- what actions are available
- what fields mean
- what workflow is being completed
- what operations are risky or require confirmation

Think of it as:

> **OpenAPI for user interfaces**  
> **Prettier-style tooling for agent-readable apps**

## Why this matters

Most web apps already contain rich product meaning, but that meaning is usually hidden inside:

- component abstractions
- route names
- internal business logic
- design systems
- developer conventions

Agents only see the rendered surface.

That creates problems:

- buttons look similar but do very different things
- workflows are implicit
- business objects are not obvious
- dangerous actions are hard to distinguish
- design system intent is lost in HTML output

ASI solves this by turning application intent into a standard semantic layer.

## Positioning

ASI is not a browser agent.

ASI is not just component instrumentation.

ASI sits between the application and the agent.

A useful mental model is:

```text
Design System → ASI → Component Execution Layer → Agent