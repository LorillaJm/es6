import { GoogleGenAI } from "@google/genai";

// You MUST provide an API key
const ai = new GoogleGenAI({ apiKey: "AIzaSyDGMw_mZgsTYW2I3Cy9NW6LnNewFKlJ6l8" });

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