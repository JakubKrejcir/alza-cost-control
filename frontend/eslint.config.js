import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        ...globals.browser,
        ...globals.es2021
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // ESLint doporučená pravidla
      ...js.configs.recommended.rules,
      
      // React Hooks pravidla
      ...reactHooks.configs.recommended.rules,
      
      // React Refresh
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      
      // === PRAVIDLA PROTI ASI BUGŮM ===
      // Vyžadovat středníky
      'semi': ['error', 'always'],
      
      // Varovat při nebezpečných zápisech bez středníku
      'no-unexpected-multiline': 'error',
      
      // === KVALITA KÓDU ===
      // Nepoužívané proměnné (warning, ne error - kvůli vývoji)
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      
      // Konzistentní uvozovky
      'quotes': ['warn', 'single', { avoidEscape: true }],
      
      // Konzistentní odsazení
      'indent': ['warn', 2, { SwitchCase: 1 }],
      
      // Žádné console.log v produkci (warning)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      
      // Preferovat const před let
      'prefer-const': 'warn',
      
      // Žádné duplicitní klíče v objektech
      'no-dupe-keys': 'error',
      
      // Žádné duplicitní case v switch
      'no-duplicate-case': 'error',
      
      // === REACT SPECIFICKÉ ===
      // Povolit JSX v .jsx souborech
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
]
