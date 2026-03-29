
import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const refineText = async (
  draft: string,
  type: 'memo' | 'report'
): Promise<string> => {
  try {
    const ai = getClient();
    
    let prompt = "";
    if (type === 'memo') {
      prompt = `Reescreva o seguinte texto para o corpo de um memorando militar oficial. Mantenha-se estritamente formal, impessoal e conciso. Use o padrão da norma culta da língua portuguesa. Texto rascunho: "${draft}"`;
    } else {
      prompt = `Reescreva o seguinte texto para um relatório de ocorrência ou serviço (parte diária). Deve ser descritivo, formal, objetivo e cronológico. Texto rascunho: "${draft}"`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || draft;
  } catch (error) {
    console.error("Error calling Gemini:", error);
    throw error;
  }
};
