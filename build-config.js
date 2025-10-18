// Build script - inject environment variable directly (no file generation)
const fs = require('fs');

// Read the HTML file
let htmlContent = fs.readFileSync('index.html', 'utf8');

// Get the API key from environment (only exists during build)
const apiKey = process.env.OPENAI_API_KEY || '';

// Create inline script (no separate file = no secrets in files)
const configScript = `<script>
window.CONFIG = {
    OPENAI_API_KEY: '${apiKey}'
};
</script>`;

// Replace config.js reference with inline script
htmlContent = htmlContent.replace('<script src="config.js"></script>', configScript);

// Write modified HTML (API key is now inline, no separate config file)
fs.writeFileSync('index.html', htmlContent);

console.log('Environment variable injected inline - no config file created');
console.log('API key configured:', apiKey.length > 0 ? 'YES' : 'NO');