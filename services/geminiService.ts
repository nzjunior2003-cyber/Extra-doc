
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
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    return response.text || draft;
  } catch (error) {
    console.error("Error calling Gemini:", error);
    throw error;
  }
};

export interface ExtractedScheduleSoldier {
  nome: string;
  situacao: 'P' | 'F' | 'D' | 'P/A' | 'A';
}

export interface ExtractedSchedule {
  eventName?: string;
  eventDate?: string; // yyyy-mm-dd
  eventDayOfWeek?: string;
  eventLocal?: string;
  eventStartTime?: string; // HH:MM
  eventEndTime?: string; // HH:MM
  militares: ExtractedScheduleSoldier[];
}

const SCHEDULE_PROMPT = `Você é um assistente que extrai dados de escalas de serviço de bombeiros militares a partir de imagens ou PDFs. As escalas variam bastante de layout entre unidades (podem ser tabelas impressas, listas manuscritas, planilhas, etc.), então interprete a estrutura da forma que fizer mais sentido para o documento apresentado.

Extraia e devolva SOMENTE um objeto JSON válido (sem markdown, sem texto antes ou depois), no seguinte formato exato:

{
  "eventName": "nome do evento/operação, se houver",
  "eventDate": "yyyy-mm-dd (data do serviço/evento, se houver)",
  "eventDayOfWeek": "DOMINGO|SEGUNDA|TERÇA|QUARTA|QUINTA|SEXTA|SÁBADO (se identificável)",
  "eventLocal": "local do evento, se houver",
  "eventStartTime": "HH:MM (hora de início do serviço, se houver)",
  "eventEndTime": "HH:MM (hora de término do serviço, se houver)",
  "militares": [
    { "nome": "NOME COMPLETO DO MILITAR EM CAIXA ALTA", "situacao": "P" }
  ]
}

Para o campo "situacao" de cada militar, use exatamente um destes códigos:
- "P" para presente/normal/escalado (use este como padrão se não houver indicação contrária)
- "F" para falta
- "D" para dispensa
- "P/A" para permuta ou autorização
- "A" para atraso

Se algum campo do evento (nome, data, dia da semana, local, horários) não estiver visível ou não existir no documento, omita a chave correspondente do JSON. Liste TODOS os militares que conseguir identificar no documento, mesmo que a situação de todos seja apenas "P". Não invente nomes nem dados que não estejam no documento.`;

export const extractScheduleFromImage = async (
  base64Data: string,
  mimeType: string
): Promise<ExtractedSchedule> => {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: SCHEDULE_PROMPT },
          { inlineData: { mimeType, data: base64Data } },
        ],
      },
    ],
  });

  const rawText = (response.text || '').trim();
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("Falha ao interpretar JSON retornado pelo Gemini:", cleaned);
    throw new Error("Não foi possível interpretar a escala. Tente novamente com uma imagem mais nítida.");
  }

  const militares: ExtractedScheduleSoldier[] = Array.isArray(parsed.militares)
    ? parsed.militares
        .filter((m: any) => m && typeof m.nome === 'string' && m.nome.trim() !== '')
        .map((m: any) => ({
          nome: String(m.nome).trim(),
          situacao: ['P', 'F', 'D', 'P/A', 'A'].includes(m.situacao) ? m.situacao : 'P',
        }))
    : [];

  return {
    eventName: parsed.eventName || undefined,
    eventDate: parsed.eventDate || undefined,
    eventDayOfWeek: parsed.eventDayOfWeek || undefined,
    eventLocal: parsed.eventLocal || undefined,
    eventStartTime: parsed.eventStartTime || undefined,
    eventEndTime: parsed.eventEndTime || undefined,
    militares,
  };
};
