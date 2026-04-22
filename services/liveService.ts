import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { MOE_PROMPTS, AGENT_VOICES } from '../constants';
import { MoEType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export class LiveSession {
  private session: any = null;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private active = false;
  private onStatusChange: (status: boolean) => void;

  constructor(onStatusChange: (status: boolean) => void) {
    this.onStatusChange = onStatusChange;
  }

  async connect(activeMoE: MoEType) {
    if (this.active) return;
    
    // Setup Audio Contexts
    this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.outputNode = this.outputContext.createGain();
    this.outputNode.connect(this.outputContext.destination);

    // Get Mic Stream
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Construct System Instruction based on Persona
    const personaInstruction = MOE_PROMPTS[activeMoE] || "";
    const voiceName = AGENT_VOICES[activeMoE] || 'Kore';
    
    const systemInstruction = `You are a real-time voice interface for the Earned Affinity system. 
    ${personaInstruction}
    Keep responses concise, conversational, and aligned with your identity. 
    Do not output JSON here, just speak naturally.`;

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          console.log('Live Session Opened');
          this.active = true;
          this.onStatusChange(true);

          // Setup Input Processing
          if (!this.inputContext) return;
          const source = this.inputContext.createMediaStreamSource(stream);
          const scriptProcessor = this.inputContext.createScriptProcessor(4096, 1, 1);
          
          scriptProcessor.onaudioprocess = (e) => {
            if (!this.active) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = this.createBlob(inputData);
            
            sessionPromise.then((session) => {
               session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          
          source.connect(scriptProcessor);
          scriptProcessor.connect(this.inputContext.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
           const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
           if (audioData) {
               await this.playAudio(audioData);
           }
           
           if (msg.serverContent?.interrupted) {
               this.stopAudio();
           }
        },
        onclose: () => {
           console.log('Live Session Closed');
           this.disconnect();
        },
        onerror: (err) => {
           console.error('Live Session Error', err);
           this.disconnect();
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName }
            }
        },
        systemInstruction: systemInstruction,
      }
    });
    
    this.session = sessionPromise;
  }

  createBlob(data: Float32Array): { data: string, mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    
    // Simple btoa for raw bytes
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    
    return {
        data: btoa(binary),
        mimeType: 'audio/pcm;rate=16000'
    };
  }

  async playAudio(base64Data: string) {
      if (!this.outputContext || !this.outputNode) return;
      
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
      
      const int16Data = new Int16Array(bytes.buffer);
      const audioBuffer = this.outputContext.createBuffer(1, int16Data.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16Data.length; i++) {
          channelData[i] = int16Data[i] / 32768.0;
      }

      this.nextStartTime = Math.max(this.nextStartTime, this.outputContext.currentTime);
      const source = this.outputContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      
      this.sources.add(source);
      source.onended = () => this.sources.delete(source);
  }

  stopAudio() {
      this.sources.forEach(s => {
          try { s.stop(); } catch(e) {}
      });
      this.sources.clear();
      this.nextStartTime = 0;
  }

  async disconnect() {
    this.active = false;
    this.onStatusChange(false);
    this.stopAudio();
    if (this.session) {
        // No explicit close method on promise
    }
    if (this.inputContext) {
        try { await this.inputContext.close(); } catch(e) {}
    }
    if (this.outputContext) {
        try { await this.outputContext.close(); } catch(e) {}
    }
    this.inputContext = null;
    this.outputContext = null;
  }
}