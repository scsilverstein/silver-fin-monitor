const { validationResult } = require('express-validator');
console.log('validationResult exists:', typeof validationResult === 'function');
EOF && node test-express-validator.js && rm test-express-validator.js < /dev/null