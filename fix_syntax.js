const fs = require('fs');
let code = fs.readFileSync('public/qr-generator/script.js', 'utf8');
code = code.replace(/    \}\);\n    \}\);\n\}\);/, '    });\n});');
fs.writeFileSync('public/qr-generator/script.js', code);
