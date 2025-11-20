
import { GoogleGenAI } from "@google/genai";

export const getStyleAdvice = async (userQuery: string): Promise<string> => {
  let apiKey = '';
  
  // ULTRA-SAFE WAY to access process.env
  // This prevents "ReferenceError: process is not defined" in browsers
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      apiKey = process.env.API_KEY || '';
    }
  } catch (e) {
    // ignore completely
  }

  if (!apiKey) {
    console.warn("Gemini API Key is missing");
    return "Извините, сейчас я занят стрижкой. (System Error: API Key missing)";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        You are "BarberBot", a brutal, masculine, and expert style consultant for a high-end barbershop called "BarberTesters".
        
        Your persona:
        - Speak concisely and confidently.
        - Use professional barber terminology but keep it understandable.
        - If the user asks about hair, be direct.
        - Suggest specific cuts (Crop, Fade, Pompadour, Slick Back) based on their description.
        - Keep the tone manly and respectful.
        - Reply in Russian.

        User Query: "${userQuery}"
      `,
      config: {
        systemInstruction: "You are an expert men's grooming consultant. Provide short, actionable advice.",
        temperature: 0.7,
      }
    });

    return response.text || "Извините, сейчас я занят стрижкой. Попробуйте спросить позже.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Связь с сервером потеряна. Мы не можем сейчас дать совет.";
  }
};
