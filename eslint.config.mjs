import tseslint from 'typescript-eslint'

// Raw numeric Tailwind spacing class → semantic token replacement
const TOKEN_MAP = {
  'gap-1': 'gap-stack',
  'gap-2': 'gap-inline',
  'gap-3': 'gap-group',
  'gap-4': 'gap-card-gap',
  'gap-5': 'gap-form',
  'gap-6': 'gap-page',
  'gap-8': 'gap-section',
  'p-1': 'p-stack',
  'p-2': 'p-inline',
  'p-3': 'p-group',
  'p-4': 'p-sidebar',
  'p-6': 'p-card',
  'p-16': 'p-empty',
  'px-1': 'px-stack',
  'px-2': 'px-inline',
  'px-3': 'px-group',
  'px-4': 'px-sidebar',
  'py-1': 'py-stack',
  'py-1.5': 'py-tight',
  'py-2': 'py-inline',
  'mb-1': 'mb-stack',
  'mt-1': 'mt-stack',
  'my-1': 'my-stack',
  'space-y-1': 'space-y-stack',
  'space-y-1.5': 'space-y-tight',
}

// Regex: match whole class tokens that are in the map (word boundaries within a class string).
// Classes are space-separated, so split and look up each one.
function checkClassString(value, report) {
  const classes = value.split(/\s+/)
  for (const cls of classes) {
    // Strip Tailwind modifiers like `sm:`, `lg:`, `hover:`, `dark:`, etc.
    const base = cls.replace(/^[a-z-]+:/, '')
    const semantic = TOKEN_MAP[base]
    if (semantic) {
      const suggestion = cls.replace(base, semantic)
      report(`Use semantic token \`${suggestion}\` instead of raw \`${cls}\`.`)
    }
  }
}

/** ESLint rule: flag raw numeric spacing utilities where a semantic token exists. */
const noRawSpacingRule = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Enforce semantic spacing tokens over raw Tailwind numeric values.' },
    schema: [],
    messages: {
      useToken: '{{ message }}',
    },
  },
  create(context) {
    function checkNode(node) {
      let value = null
      if (node.type === 'Literal' && typeof node.value === 'string') {
        value = node.value
      } else if (node.type === 'TemplateLiteral') {
        // Only check the static string parts (quasis)
        for (const quasi of node.quasis) {
          checkClassString(quasi.value.cooked ?? '', (message) => {
            context.report({ node: quasi, messageId: 'useToken', data: { message } })
          })
        }
        return
      }
      if (value) {
        checkClassString(value, (message) => {
          context.report({ node, messageId: 'useToken', data: { message } })
        })
      }
    }

    function walkCnCall(callNode) {
      for (const arg of callNode.arguments) {
        if (arg.type === 'Literal' || arg.type === 'TemplateLiteral') {
          checkNode(arg)
        }
        // cn('a', condition && 'b') — handle nested cn() calls too
        if (arg.type === 'CallExpression') {
          const callee = arg.callee
          if (callee.type === 'Identifier' && callee.name === 'cn') {
            walkCnCall(arg)
          }
        }
      }
    }

    return {
      // className="..."  or  className={`...`}
      JSXAttribute(node) {
        if (node.name.name !== 'className') return
        const val = node.value
        if (!val) return

        if (val.type === 'Literal') {
          checkNode(val)
          return
        }

        if (val.type === 'JSXExpressionContainer') {
          const expr = val.expression
          if (expr.type === 'Literal' || expr.type === 'TemplateLiteral') {
            checkNode(expr)
          }
          // className={cn('a', 'b')}
          if (expr.type === 'CallExpression') {
            const callee = expr.callee
            if (callee.type === 'Identifier' && callee.name === 'cn') {
              walkCnCall(expr)
            }
          }
        }
      },
    }
  },
}

export default tseslint.config(
  // Global linter options — don't error on disable-directives for rules we don't configure
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  // Files to ignore globally
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.output/**',
      '**/.vinxi/**',
      // Shadcn primitive atoms — component-internal design, exempt from semantic tokens
      'packages/ui/src/components/ui/**',
    ],
  },
  // Only lint TSX files — the design-system rule is JSX-only, no need to touch .ts files
  {
    files: ['**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'design-system': {
        rules: { 'no-raw-spacing': noRawSpacingRule },
      },
    },
    rules: {
      'design-system/no-raw-spacing': 'warn',
    },
  },
)
