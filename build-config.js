// Build script to create config.js from environment variables
const fs = require('fs');

const configContent = `// Auto-generated config file
window.CONFIG = {
    OPENAI_API_KEY: '${process.env.OPENAI_API_KEY || ''}'
};`;

fs.writeFileSync('config.js', configContent);
console.log('Config file generated successfully');