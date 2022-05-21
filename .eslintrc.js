module.exports = {
  root: true,
  env: { node: true, browser: true, es6: true },
  extends: ["plugin:prettier/recommended", 'eslint-config-prettier'],
  plugins: ['prettier'],
  parser: 'babel-eslint'
};
