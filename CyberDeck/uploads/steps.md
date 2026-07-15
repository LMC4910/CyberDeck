Below is the prompt I would give Fable 5. It is intentionally written like a product design specification instead of a UI prompt. The goal is to keep the visual appearance almost identical while evolving the prototype into something that looks like a production IDE internally.

---

# CyberDeck IDE Phase 5 — Platform Architecture Evolution

You are **NOT redesigning the UI.**

The current CyberDeck IDE (Phase 4) already has a polished interface with workspaces, docking, panels, widgets, inspector, project explorer, variables, flows, command palette, assets, runtime, preview, and multiple IDE surfaces. 

Your job is to transform this prototype into a **realistic production application architecture** similar to how VS Code, IntelliJ IDEA, Figma, Chrome DevTools, or Notion are internally structured.

The UI should still look like the same application.

Instead, redesign **how the application behaves**, **how data flows**, and **how developers understand the architecture**.

---

# PRIMARY GOAL

Convert the application from

```
Beautiful Prototype
```

into

```
Production Platform
```

without changing the visual language.

Everything should appear as though a real backend, plugin system, configuration engine, service container, repositories, caching layer and extension architecture already exist—even though everything is still mocked.

The design should communicate architecture, not implementation.

---

# IMPORTANT

Do NOT create fake backend screens.

Do NOT clutter the UI.

Do NOT expose technical implementation details to normal users.

Instead, subtly indicate that the application is driven by an internal platform.

Every place where architecture exists should include **developer comments/annotations** that Claude can later use to build the actual implementation.

Every annotation must answer:

```
WHAT exists?

HOW does it work?

WHY does it exist?
```

These comments are for developers—not end users.

Think of them as embedded architecture documentation.

---

# OVERALL DESIGN PRINCIPLE

Everything should be driven through configuration.

Nothing should feel hardcoded.

The UI should behave like it is merely rendering configuration provided by a platform.

The application should feel like

```
Configuration

↓

Platform

↓

Services

↓

Repositories

↓

Mock APIs

↓

State

↓

Widgets

↓

UI
```

instead of

```
React Components

↓

Hardcoded Objects

↓

UI
```

---

# 1. APPLICATION BOOTSTRAP

Redesign the startup flow.

The application should no longer appear to initialize everything immediately.

Instead create a realistic boot lifecycle.

Visualize or annotate the existence of:

```
Boot Manager

↓

Configuration Loader

↓

Authentication

↓

Workspace Restore

↓

Theme Engine

↓

Service Container

↓

Command Registry

↓

Extension Host

↓

Widget Registry

↓

Background Services
```

Developer Comment Example

```
WHAT

Boot Manager initializes the application.

HOW

Loads only critical configuration required to render the shell.

WHY

Allows the application to become interactive within milliseconds while everything else loads lazily.
```

---

# 2. CONFIGURATION DRIVEN PLATFORM

The application should appear to be driven entirely from configuration.

Create architectural annotations showing configuration boundaries.

Examples

```
Application Config

Workspace Config

User Config

Layout Config

Navigation Config

Widget Config

Command Config

Feature Flags

Permissions

Extension Config

Theme Config

Session Config

Runtime Config
```

Each configuration area should explain

```
Editable by user?

Editable by extension?

Runtime only?

Persisted?

System managed?
```

---

# 3. SERVICE CONTAINER

Introduce a platform layer.

Visually indicate the existence of services.

Examples

```
Theme Service

Workspace Service

Project Service

Widget Service

Command Service

Configuration Service

Notification Service

Extension Service

Authentication Service

Telemetry Service

Repository Registry

Cache Manager

Mock API Gateway
```

Every service should have a developer annotation explaining

```
What responsibility it owns

How it communicates

Why it exists instead of direct imports
```

---

# 4. REPOSITORY + MOCK API

The UI should never appear to access JSON directly.

Instead show the architecture

```
Widget

↓

Repository

↓

Service

↓

Mock REST API

↓

Mock Database

↓

Configuration
```

Every mock request should appear capable of

```
Latency

Retries

Failures

Pagination

Sorting

Filtering

Caching

Optimistic Updates

Cancellation

Authentication
```

Include subtle loading indicators that imply realistic network behavior.

---

# 5. WIDGET PLATFORM

Every widget should look like a self-contained module.

Do NOT simply display widgets.

Instead indicate that every widget owns

```
Manifest

Metadata

Schema

Configuration

Permissions

Dependencies

Actions

Commands

State

Data Provider

Caching

Refresh Policy

Events

Lifecycle

Lazy Loader
```

Developer annotation

```
WHAT

Widget Manifest

HOW

Registers the widget dynamically during startup.

WHY

Allows new widgets to be added without changing core code.
```

---

# 6. WIDGET REGISTRY

The application should imply

```
Widget Registry

↓

Dynamic Registration

↓

Widget Discovery

↓

Dependency Resolution

↓

Initialization

↓

Rendering
```

Never imply widgets are manually imported.

---

# 7. EVENT BUS

Introduce an application-wide event architecture.

Widgets should appear completely decoupled.

Examples

```
ProjectOpened

FileOpened

WidgetLoaded

WidgetClosed

ThemeChanged

WorkspaceChanged

VariableChanged

FlowExecuted

AIStarted

AICompleted

NotificationReceived

ExtensionInstalled

SettingsChanged
```

Developer annotations should explain

```
WHAT event is emitted

HOW subscribers receive it

WHY widgets never communicate directly
```

---

# 8. COMMAND SYSTEM

The application should resemble VS Code.

Everything should execute commands.

Examples

```
Command Palette

Toolbar

Keyboard Shortcut

Context Menu

Quick Actions

Buttons
```

↓

```
Command Registry
```

↓

```
Command Handler
```

↓

```
Services
```

Each command should expose

```
ID

Context

Permissions

Undo Support

Arguments

Telemetry

Shortcut

Visibility

Category
```

---

# 9. STATE MANAGEMENT

Instead of one large application state, indicate domain-specific stores.

Examples

```
UI Store

Workspace Store

Project Store

Widget Store

Editor Store

AI Store

Notification Store

Authentication Store

Preferences Store

Repository Cache

Runtime Store
```

Each store annotation should explain

```
Persisted

Temporary

Derived

Cached

Server-backed
```

---

# 10. DATA LOADING STRATEGY

Show that different parts of the application load differently.

Annotate

### Startup

```
Theme

Configuration

Workspace

Preferences

Authentication

Layout
```

---

### Lazy

```
Widgets

Logs

AI

Terminal

Marketplace

Documentation

Diagnostics

Analytics

Search Index

Git History
```

---

### Background

```
Telemetry

Health Checks

Project Index

File Watchers

Plugin Updates

Cache Refresh

Extension Discovery
```

Explain WHY every category uses that strategy.

---

# 11. EXTENSION PLATFORM

Show a true extension architecture.

Extensions should contribute

```
Widgets

Commands

Menus

Toolbar Buttons

Settings

Routes

Themes

Services

Keyboard Shortcuts

Context Menus

Automation Nodes

Data Providers
```

Developer comments should explain

```
WHAT extensions register

HOW registration occurs

WHY the core remains unchanged
```

---

# 12. PERSISTENCE

Indicate what survives application restart.

Examples

```
Workspace

Open Tabs

Window Layout

Widget State

Recent Projects

AI Conversations

Command History

Preferences

Editor State

Dock Layout

Pinned Widgets
```

Each should include

```
Persistence Location

Restore Timing

Migration Strategy
```

---

# 13. PERFORMANCE

The application should visibly suggest production optimization.

Examples

```
Code Splitting

Dynamic Imports

Virtual Lists

Background Workers

Memoization

Incremental Rendering

Cache Manager

Resource Cleanup

Lazy Components

Asset Streaming
```

Developer comments should explain why each optimization exists.

---

# 14. ERROR HANDLING

Show that failures are isolated.

Examples

```
Global Error Boundary

Widget Error Boundary

API Retry

Offline State

Fallback UI

Crash Recovery

Session Recovery

Telemetry

Logging
```

Explain

```
What fails

How recovery works

Why the application continues functioning
```

---

# 15. FEATURE FLAGS

Introduce feature flags.

Examples

```
Experimental Widgets

Developer Tools

AI Providers

Marketplace

Cloud Sync

Automation Engine

Plugin Sandbox
```

Show that features can be enabled through configuration.

---

# 16. PERMISSIONS

Introduce permissions.

Widgets should declare

```
Filesystem

Clipboard

Network

Notifications

Git

Devices

Plugins

Automation

Environment Variables
```

Explain why permissions exist.

---

# 17. DEVELOPER COMMENTS

This is the MOST IMPORTANT PART.

Across the design, add developer-only architectural annotations.

These annotations are NOT visible in production.

They are documentation embedded into the design for future implementation.

Every annotation must follow this exact format:

```
──────────────────────────────

Platform Note

WHAT

Explain the component.

HOW

Explain the architecture.

WHY

Explain the design decision.

Future Implementation

Describe how Claude should implement this later.

──────────────────────────────
```

These comments should exist beside

* Boot Manager
* Widget Registry
* Event Bus
* Service Container
* Repository Layer
* Mock API
* Extension Host
* Configuration Loader
* Command Registry
* State Stores
* Cache Manager
* Theme Engine
* Dock Manager
* Layout Manager
* Workspace Manager
* AI Platform
* Notification Service
* Plugin Host
* Background Jobs
* Telemetry
* Diagnostics

---

# 18. FINAL OBJECTIVE

When another developer opens this design they should immediately understand:

* how the application starts
* how widgets register
* how commands execute
* how services communicate
* how repositories fetch data
* how events propagate
* how configuration controls behavior
* how plugins extend the application
* how state is persisted
* how caching works
* how lazy loading works
* how the application scales to hundreds of widgets and extensions

The final design should still look like **CyberDeck IDE Phase 4**, but it should now feel like the blueprint of a real, enterprise-grade IDE platform rather than a static mockup. Every architectural decision should be discoverable through thoughtfully placed developer annotations that explain **what exists, how it works, why it was designed that way, and how it should eventually be implemented**.
