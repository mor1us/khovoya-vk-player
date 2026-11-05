import js from '@eslint/js'
import ts from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

/**
 * Правила нарочно скромные: ловим мёртвый код, опечатки и ошибки хуков React,
 * а не спорим о стиле (стиль в проекте и так единый).
 * `npm run lint` должен проходить без ошибок; предупреждения — к сведению, не к немедленной правке.
 */
export default ts.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'Build/**', 'dev/fixtures/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // ВК и SoundCloud отдают произвольный JSON — any на границе допустим
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      // `code === 0 ? resolve() : reject(...)` — принятый в проекте способ записи
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // в именах файлов мы нарочно вырезаем управляющие символы
      'no-control-regex': 'off',
      'prefer-const': 'error',
      'no-useless-assignment': 'error',
      eqeqeq: ['error', 'smart'],
      'no-constant-binary-expression': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      // Ошибки, которые надо чинить сразу
      'react-hooks/rules-of-hooks': 'error',
      // Советы на будущее: в коде это сделано осознанно (лишний рендер дешевле усложнения)
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
)
