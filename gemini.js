import { GoogleGenAI } from "@google/genai";

// You MUST provide an API key
const ai = new GoogleGenAI({ apiKey: "AIzaSyAQzQBT79ssZt0Q4aJmNoGpzegi3tK3rwY" });

async function main() {
  try {
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