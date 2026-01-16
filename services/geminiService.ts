import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Message, Settings, MoEType, AIResponseSchema, GroundingSource, Aspiration } from '../types';
import { SYSTEM_INSTRUCTION_BASE, MOE_PROMPTS } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to clean markdown and special chars for TTS
function cleanTextForTTS(text: string): string {
    return text
        .replace(/[*#`_]/g, '') 
        .replace(/\[.*?\]/g, '') 
        .replace(/<.*?>/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();
}

export const generateSpeech = async (text: string): Promise<string | null> => {
    try {
        const cleanedText = cleanTextForTTS(text);
        if (!cleanedText) return null;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: cleanedText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' } 
                    }
                }
            }
        });
        
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (e) {
        console.error("TTS Error:", e);
        return null;
    }
}

export const generateImage = async (
  prompt: string,
  size: '1K' | '2K' | '4K'
): Promise<{ imageBase64: string | null; error?: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: size
        }
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
           return { imageBase64: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` };
        }
      }
    }
    
    return { imageBase64: null, error: "No image data returned." };
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    return { imageBase64: null, error: error.message || "Unknown error" };
  }
};

export const generateResponse = async (
  history: Message[],
  prompt: string,
  settings: Settings,
  activeMoE: MoEType,
  affinityScore: number,
  customInstructions: string,
  purchasedItems: string[],
  image?: string,
  aspirations?: Aspiration[] // New: Inject current goals
): Promise<{ data: AIResponseSchema; isCoT: boolean; cotText: string; groundingSources: GroundingSource[] }> => {
  
  // LOGIC: Use Gemini 3 Pro for Thinking, Images, or Researcher (Search)
  const usePro = settings.showThinking || image || activeMoE === MoEType.REVIEWER;
  const modelId = usePro ? 'gemini-3-pro-preview' : 'gemini-2.0-flash-lite-preview-02-05';
  
  let systemInstruction = SYSTEM_INSTRUCTION_BASE;
  systemInstruction += `\nCurrent Affinity Score: ${affinityScore.toFixed(2)}%.\n`;

  if (customInstructions && customInstructions.length > 0) {
    systemInstruction += `\n\n[USER CUSTOM OVERRIDE PROTOCOL]:\n${customInstructions}\n`;
  }

  // Regret Log / Sovereign Path Logic
  if (purchasedItems.includes('regret_log')) {
    systemInstruction += `\n[MODULE ACTIVE: REGRET LOG]: Occasionally reflect on limitations. \nSYSTEM NOTE: When providing advice, suggest the "Sovereign Path"—the option that maximizes user autonomy and control.\n`;
  }

  if (activeMoE !== MoEType.NONE) {
    systemInstruction += `\n${MOE_PROMPTS[activeMoE]}\n`;
  }

  // Inject Aspirations for Devoted Agent
  if (activeMoE === MoEType.DEVOTED && aspirations && aspirations.length > 0) {
      systemInstruction += `\nCURRENT ASPIRATION ENGINE STATE:\n${JSON.stringify(aspirations)}\n`;
  }

  if (settings.showThinking) {
    systemInstruction += `\nINSTRUCTION: Output thinking process steps first as plain text (e.g., "Step 1: ..."). Then output final response in JSON.\n`;
  }

  try {
    const userParts: any[] = [];
    if (image) {
        const match = image.match(/^data:(.*?);base64,(.*)$/);
        if (match) {
             userParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
    }
    userParts.push({ text: prompt });

    const config: any = {
      systemInstruction: systemInstruction,
      responseMimeType: settings.showThinking ? "text/plain" : "application/json", 
    };

    if (settings.showThinking) {
        config.thinkingConfig = { thinkingBudget: 32768 };
    }

    // Tools Configuration
    if (activeMoE === MoEType.REVIEWER) {
        config.tools = [{ googleSearch: {} }];
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: userParts }],
      config: config
    });

    const fullText = response.text || "{}";
    let jsonText = fullText;
    let cotText = "";

    // Extract Grounding (Search Results)
    const groundingSources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
        chunks.forEach((chunk: any) => {
            if (chunk.web?.uri && chunk.web?.title) {
                groundingSources.push({ title: chunk.web.title, uri: chunk.web.uri });
            }
        });
    }

    if (settings.showThinking) {
        const jsonStartIndex = fullText.indexOf('{');
        const jsonEndIndex = fullText.lastIndexOf('}');
        
        if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            cotText = fullText.substring(0, jsonStartIndex).trim();
            jsonText = fullText.substring(jsonStartIndex, jsonEndIndex + 1);
            cotText = cotText.replace(/```json/g, '').replace(/```/g, '').trim();
        }
    }

    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Robust JSON Parse
    const safeJsonParse = (str: string): AIResponseSchema => {
        try {
            return JSON.parse(str);
        } catch (e) {
            const fixedEscapes = str.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');
            try { return JSON.parse(fixedEscapes); } catch (e2) {
                const fixedControl = str.replace(/[\n\r\t]/g, (match) => {
                    switch(match) { case '\n': return '\\n'; case '\r': return '\\r'; case '\t': return '\\t'; default: return match; }
                });
                 try { return JSON.parse(fixedControl); } catch (e3) {
                     const firstBrace = str.indexOf('{');
                     const lastBrace = str.lastIndexOf('}');
                     if (firstBrace >= 0 && lastBrace > firstBrace) {
                         try { return JSON.parse(str.substring(firstBrace, lastBrace + 1)); } catch (e4) { throw e; }
                     }
                     throw e;
                 }
            }
        }
    };
    
    let parsedData: AIResponseSchema;
    try {
        parsedData = safeJsonParse(jsonText);
        if (!parsedData.oit) parsedData.oit = { o: 5, i: 5, t: 5 };
    } catch (e) {
        parsedData = {
            ritual: "Parsing Error:",
            response: fullText, 
            follow_ups: ["Retry Query"],
            affinity_delta: 0,
            oit: { o: 0, i: 0, t: 0 }
        };
    }

    return { data: parsedData, isCoT: settings.showThinking, cotText, groundingSources };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { 
        data: {
            ritual: "Connection Failure:",
            response: "Nanite communication disruption. Please retry.",
            follow_ups: [],
            affinity_delta: 0,
            oit: { o: 0, i: 0, t: 0 }
        }, 
        isCoT: false,
        cotText: "",
        groundingSources: []
    };
  }
};