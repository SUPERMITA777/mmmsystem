
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

async function listModels() {
    console.log("--- LISTING MODELS ---");
    let apiKey = "";
    try {
        const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);
        if (match) apiKey = match[1].trim();
    } catch (e) { console.error(e); }

    if (!apiKey) return;

    try {
        // We'll use a direct fetch to the list endpoint to be sure
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.models) {
            console.log("Available models:");
            data.models.forEach(m => console.log(` - ${m.name}`));
        } else {
            console.log("No models returned:", data);
        }
    } catch (err) {
        console.error("Failed to list models:", err);
    }
}

listModels();
