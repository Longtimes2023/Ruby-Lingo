/* RubyLingo — ESLint (CJS vì package.json dùng "type": "module") */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  ignorePatterns: [
    'dist',
    'dist-server',
    'node_modules',
    '.tsbuild',
    'coverage',
    'playwright-report',
    'test-results',
    // `_verify/` là vùng LÀM VIỆC của các phép kiểm chứng (mutation probe, script QA một lần,
    // bản sao lưu `_mut-bk/`, ảnh/PDF thô...). Nó KHÔNG phải mã sản phẩm: nhiều tệp ở đây cố
    // tình chứa lỗi hoặc là bản chụp cũ của `server/`/`shared/` cho phép `integrity`.
    // Quét nó như mã nguồn thứ hai chỉ sinh cảnh báo giả và có thể che một lỗi THẬT ở `src/`.
    // ⚠️ KHÔNG xoá `_verify/` — đó là vùng sao lưu mà phép `integrity` cần.
    '_verify',
    '*.cjs',
    '*.config.js',
  ],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-explicit-any': 'error',
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // Server + script được phép log ra console (ngoài pino)
      files: ['server/**/*.ts', 'scripts/**/*.ts'],
      rules: { 'no-console': 'off' },
    },
    {
      files: ['tests/**/*.{ts,tsx}'],
      env: { node: true },
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
  ],
};
