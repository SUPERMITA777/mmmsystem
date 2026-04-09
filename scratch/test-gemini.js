
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const path = require("path");

// Load env
dotenv.config({ path: path.join(__dirname, "../.env") });

async function testGemini() {
    console.log("--- TESTING GEMINI CONNECTION ---");
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("API Key length:", apiKey ? apiKey.length : 0);
    
    if (!apiKey) {
        console.error("No GEMINI_API_KEY found in .env");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        console.log("Sending test message to Gemini...");
        const result = await model.generateContent("Hola, esto es una prueba técnica. Respondé 'OK' si recibís esto.");
        const response = await result.response;
        console.log("Gemini Response:", response.text());
        console.log("✅ GEMINI IS WORKING!");
    } catch (err) {
        console.error("❌ GEMINI FAILED:");
        console.error(err);
    }
}

testGemini();
