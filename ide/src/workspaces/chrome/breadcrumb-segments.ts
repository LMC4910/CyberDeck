// Per-workspace breadcrumb segment registry (CD-205). Maps each workspace to its
// crumb segments (design mapping: Project › Workspace › Selection). Segments swap
// per active workspace; a segment with a `navigate` target is clickable.

export interface CrumbSegment {
  label: string
  /** Workspace id to route to when clicked; omit for a non-navigating label. */
  navigate?: string
}

export interface CrumbContext {
  projectName?: string
  /** A workspace-specific leaf label (selection / flow / scope / device). */
  leaf?: string
}

type SegmentBuilder = (ctx: CrumbContext) => CrumbSegment[]

const project = (ctx: CrumbContext): CrumbSegment => ({
  label: ctx.projectName ?? 'Untitled',
  navigate: 'projects',
})

export const BREADCRUMB_SEGMENTS: Record<string, SegmentBuilder> = {
  home: (ctx) => [project(ctx), { label: 'Home', navigate: 'home' }],
  'deck-designer': (ctx) => [
    project(ctx),
    { label: 'Deck Designer', navigate: 'deck-designer' },
    ...(ctx.leaf ? [{ label: ctx.leaf }] : []),
  ],
  flows: (ctx) => [
    project(ctx),
    { label: 'Flows', navigate: 'flows' },
    ...(ctx.leaf ? [{ label: ctx.leaf }] : []),
  ],
  variables: (ctx) => [
    project(ctx),
    { label: 'Variables', navigate: 'variables' },
    ...(ctx.leaf ? [{ label: ctx.leaf }] : []),
  ],
  library: (ctx) => [project(ctx), { label: 'Library', navigate: 'library' }],
  devices: (ctx) => [
    project(ctx),
    { label: 'Devices', navigate: 'devices' },
    ...(ctx.leaf ? [{ label: ctx.leaf }] : []),
  ],
  projects: () => [{ label: 'Projects', navigate: 'projects' }],
}

/** Build the crumb segments for a workspace (falls back to a single label). */
export function crumbFor(workspaceId: string | null, ctx: CrumbContext): CrumbSegment[] {
  if (!workspaceId) return []
  const builder = BREADCRUMB_SEGMENTS[workspaceId]
  return builder ? builder(ctx) : [{ label: workspaceId, navigate: workspaceId }]
}
