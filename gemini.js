import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

// Uses GEMINI_API_KEY from your .env file
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.log("ERROR: GEMINI_API_KEY not found in .env file");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function main() {
  try {
    console.log("Testing Gemini API connection...");
    console.log("API Key:", apiKey.substring(0, 12) + "...");
    
    const response = await ai.models.generateContent({
      model: "models/gemini-flash-latest",
      contents: "Say hello in one sentence",
    });
    
    console.log("SUCCESS:", response.text);
  } catch (error) {
    console.log("ERROR:", error.message?.substring(0, 300));
  }
}

await main();
