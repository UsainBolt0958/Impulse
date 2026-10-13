@echo off
:: Simple obfuscation workflow for JEE 2021 app.js
:: Requires: Node.js installed from https://nodejs.org

echo Installing javascript-obfuscator (one-time setup)...
npm install -g javascript-obfuscator

echo.
echo Obfuscating app.js to app.obf.js...
javascript-obfuscator assets/js/app.js --output assets/js/app.obf.js --compact true --control-flow-flattening false --dead-code-injection false --debug-protection false --identifier-names-generator hexadecimal --rename-globals false --rotate-string-array true --self-defending true --string-array true --string-array-encoding base64 --string-array-threshold 0.75 --unicode-escape-sequence false

echo.
echo Done! File created: assets/js/app.obf.js
pause
