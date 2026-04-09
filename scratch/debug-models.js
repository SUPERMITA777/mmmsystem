
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const fs = require('fs');
const path = require('path');

async function debugModels() {
    console.log("========================================");
    console.log("   MMM SYSTEM - AI MODEL DEBUGGER (JS)");
    console.log("========================================\n");

    // Manual .env loading
    let env = {};
    try {
        const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) env[key.trim()] = value.trim();
        });
    } catch (e) {}

    const geminiKey = env.GEMINI_API_KEY;
    const groqKey = env.GROQ_API_KEY;

    // 1. Check Gemini
    console.log("--- GOOGLE GEMINI STATUS ---");
    if (!geminiKey) {
        console.log("❌ GEMINI_API_KEY missing in .env");
    } else {
        console.log(`✅ API Key found: ${geminiKey.substring(0, 5)}...`);
        const genAI = new GoogleGenerativeAI(geminiKey);
        const modelsToTest = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-pro"];
        
        for (const modelId of modelsToTest) {
            try {
                const model = genAI.getGenerativeModel({ model: modelId });
                const result = await model.generateContent("Respond ONLY with the word OK.");
                const response = await result.response;
                console.log(`✅ Model ${modelId}: OK (${response.text().trim()})`);
            } catch (err) {
                console.log(`❌ Model ${modelId}: FAILED - ${err.message || err}`);
            }
        }
    }
    console.log("");

    // 2. Check Groq
    console.log("--- GROQ CLOUD STATUS ---");
    if (!groqKey) {
        console.log("❌ GROQ_API_KEY missing in .env");
    } else {
        console.log(`✅ API Key found: ${groqKey.substring(0, 7)}...`);
        const groq = new Groq({ apiKey: groqKey });
        const groqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];

        for (const modelId of groqModels) {
            try {
                const chatCompletion = await groq.chat.completions.create({
                    messages: [{ role: "user", content: "Respond ONLY with the word OK." }],
                    model: modelId,
                });
                console.log(`✅ Model ${modelId}: OK (${chatCompletion.choices[0]?.message?.content?.trim()})`);
            } catch (err) {
                console.log(`❌ Model ${modelId}: FAILED - ${err.message || err}`);
            }
        }
    }

    console.log("\n========================================");
}

debugModels().catch(console.error);
