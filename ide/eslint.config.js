import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'

// Layer boundaries per 01_Architecture_Baseline.md §1/§17.
// Full matrix documented in README.md. Default is DENY: any import pair not
// listed under `policies` below fails lint, including workspace→workspace and
// widget→widget (cross-feature communication goes through stores/events).
export default tseslint.config(
  // src/shared/contract is generated (gen-types.mjs) + drift-gated, not hand-authored.
  { ignores: ['dist', 'node_modules', 'src/shared/contract'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.app.json' },
      },
      'boundaries/elements': [
        { type: 'shared', pattern: 'src/shared' },
        { type: 'platform', pattern: 'src/platform' },
        { type: 'services', pattern: 'src/services' },
        { type: 'repositories', pattern: 'src/repositories' },
        { type: 'stores', pattern: 'src/stores' },
        { type: 'workspace', pattern: 'src/workspaces/*', capture: ['name'] },
        { type: 'widget', pattern: 'src/widgets/*', capture: ['id'] },
        { type: 'extension', pattern: 'src/extensions/*', capture: ['id'] },
      ],
      // App-shell root files (main.tsx, App.tsx, css) are files, not elements.
      'boundaries/files': [{ category: 'app', pattern: 'src/*' }],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message:
            'Boundary violation — this import crosses a layer/feature boundary not allowed by the matrix in ide/README.md',
          policies: [
            {
              from: { element: { types: 'platform' } },
              allow: { to: { element: { types: 'shared' } } },
            },
            {
              from: { element: { types: 'services' } },
              allow: { to: { element: { types: { anyOf: ['platform', 'shared'] } } } },
            },
            {
              from: { element: { types: 'repositories' } },
              allow: {
                to: { element: { types: { anyOf: ['platform', 'services', 'shared'] } } },
              },
            },
            {
              from: { element: { types: 'stores' } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ['platform', 'services', 'repositories', 'shared'] },
                  },
                },
              },
            },
            {
              from: { element: { types: 'workspace' } },
              allow: {
                to: {
                  element: { types: { anyOf: ['platform', 'services', 'stores', 'shared'] } },
                },
              },
            },
            {
              from: { element: { types: 'widget' } },
              allow: {
                to: {
                  element: { types: { anyOf: ['platform', 'services', 'stores', 'shared'] } },
                },
              },
            },
            {
              from: { element: { types: 'extension' } },
              allow: { to: { element: { types: { anyOf: ['platform', 'shared'] } } } },
            },
            {
              from: { file: { categories: 'app' } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: ['platform', 'services', 'stores', 'workspace', 'shared'],
                    },
                  },
                },
              },
            },
            {
              from: { file: { categories: 'app' } },
              allow: { to: { file: { categories: 'app' } } },
            },
          ],
        },
      ],
    },
  },
)
