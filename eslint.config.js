const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

const maxLineLength = [
  'error',
  {
    code: 80,
    ignoreComments: true,
    ignoreStrings: true,
    ignoreTemplateLiterals: true,
    ignoreUrls: true,
  },
];

const templateMaxLineLength = [
  'error',
  {
    code: 80,
    ignoreComments: true,
    ignorePattern: '\\b(?:class|\\[class\\])\\s*=',
    ignoreStrings: true,
    ignoreTemplateLiterals: true,
    ignoreUrls: true,
  },
];

module.exports = tseslint.config(
  {
    ignores: ['.angular/**', 'coverage/**', 'dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      'max-len': maxLineLength,
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      'max-len': templateMaxLineLength,
    },
  },
);
