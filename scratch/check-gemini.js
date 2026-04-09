
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

async function test() {
    console.log("--- DEBUGGING GEMINI ---");
    
    // Try to read API key from .env manually to avoid dotenv dependency issues
    let apiKey = "";
    try {
        const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);
        if (match) apiKey = match[1].trim();
    } catch (e) {
        console.error("Could not read .env file:", e.message);
    }

    if (!apiKey) {
        console.error("GEMINI_API_KEY not found in .env");
        return;
    }

    console.log("Using API Key (first 5 chars):", apiKey.substring(0, 5));

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Test with gemini-pro (older stable version) to see if quota is different
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        console.log("Sending test request to gemini-pro...");
        const result = await model.generateContent("Respond ONLY with the word PASS if you see this.");
        const response = await result.response;
        const text = response.text();
        console.log("Gemini Response:", text);
        
        if (text.includes("PASS")) {
            console.log("✅ GEMINI API IS WORKING LOCALLY!");
        } else {
            console.log("⚠️ UNEXPECTED RESPONSE:", text);
        }
    } catch (err) {
        console.error("❌ GEMINI API FAILED:");
        console.error(err);
    }
}

test();
