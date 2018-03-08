module.exports = {
  parserOptions: {
        ecmaVersion: 5,
        sourceType: 'module',
    },
    extends: 'eslint:recommended',
    rules: {
        'indent':          ['error', 2],
        'linebreak-style': ['error', 'unix'],
        'quotes':          ['error', 'single'],
        'semi':            ['error', 'never'],
    }
}