// Build script to create config.js from environment variables
const fs = require('fs');

const apiKey = process.env.OPENAI_API_KEY || '';

const configContent = `// Auto-generated config file for production
window.CONFIG = {
    OPENAI_API_KEY: '${apiKey}'
};`;

fs.writeFileSync('config.js', configContent);
console.log('Config file generated successfully');
console.log('API key configured:', apiKey.length > 0 ? 'YES' : 'NO');