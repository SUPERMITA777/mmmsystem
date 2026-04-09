
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

async function verifyGemini() {
    console.log("--- GEMINI COMPREHENSIVE DIAGNOSTIC ---");
    
    // Load .env manually
    const envPath = path.join(__dirname, '../.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const geminiKey = envContent.match(/GEMINI_API_KEY=(.*)/)?.[1]?.trim();

    if (!geminiKey) {
        console.error("❌ GEMINI_API_KEY not found in .env");
        return;
    }

    console.log(`Using Key: ${geminiKey.substring(0, 5)}...`);
    const genAI = new GoogleGenerativeAI(geminiKey);

    const modelsToTest = [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-1.5-flash", 
        "gemini-1.5-pro",
        "gemini-pro",
        "gemini-1.0-pro"
    ];

    for (const modelId of modelsToTest) {
        try {
            console.log(`Testing [${modelId}]...`);
            const model = genAI.getGenerativeModel({ model: modelId });
            // Very short timeout for safety
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'Respond ONLY with OK.' }] }],
                generationConfig: { maxOutputTokens: 5 }
            });
            const text = result.response.text();
            console.log(`✅ [${modelId}] SUCCESS: ${text.trim()}`);
        } catch (err) {
            console.log(`❌ [${modelId}] FAILED: ${err.message}`);
            if (err.message.includes("403") || err.message.includes("API_KEY_INVALID")) {
                console.log("   (Wait, this key might be invalid or restricted)");
            }
        }
    }
}

verifyGemini();
