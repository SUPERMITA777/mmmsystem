const fs = require('fs');
const path = require('path');

try {
    const configFilePath = path.join(__dirname, '..', 'lib', 'landing_config.json');
    console.log('Path to file:', configFilePath);
    console.log('Exists:', fs.existsSync(configFilePath));
    
    const content = fs.readFileSync(configFilePath, 'utf8');
    const parsed = JSON.parse(content);
    console.log('Successfully read existing config:', parsed.title);
    
    parsed.title = parsed.title; // keep same
    fs.writeFileSync(configFilePath, JSON.stringify(parsed, null, 2), 'utf8');
    console.log('Successfully wrote config file!');
} catch (e) {
    console.error('Error during write:', e);
}
