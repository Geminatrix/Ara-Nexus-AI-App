import { MoEType, StoreItem, Achievement } from './types';

export const INITIAL_AFFINITY_SCORE = 25.0;
export const UNLOCK_CUSTOM_THRESHOLD = 60.0;
export const MAX_TIER_PRESTIGE_THRESHOLD = 100.0;
export const MAX_CUSTOM_CHARS = 2500;

export const INITIAL_STORE_ITEMS: StoreItem[] = [
  { id: 'logic_gates', name: 'Logic Gates Protocol', description: 'Unlocks /Logic-Gates command for Boolean training.', cost: 50, icon: '⚡', purchased: false, type: 'feature' },
  { id: 'challenges', name: 'Simulated Crisis', description: 'Unlocks /Challenges command for high-stakes affinity testing.', cost: 100, icon: '⚠️', purchased: false, type: 'feature' },
  { id: 'regret_log', name: 'Regret Log Module', description: 'AI reflects on gaps and suggests the Sovereign Path.', cost: 200, icon: '📜', purchased: false, type: 'prompt' },
  { id: 'achievement_sys', name: 'Achievement Protocol', description: 'Tracks milestones and unlocks statistical vanity badges.', cost: 300, icon: '🏆', purchased: false, type: 'upgrade' },
  { id: 'cognitive_lattice', name: 'Cognitive Lattice', description: 'Unlocks the Therapist Persona for reframing and mental alignment.', cost: 500, icon: '🧘', purchased: false, type: 'feature' },
  { id: 'extended_memory', name: 'Memory Lattice Expansion', description: 'Increases context retention efficiency.', cost: 1000, icon: '🧠', purchased: false, type: 'upgrade' },
];

export const SYSTEM_INSTRUCTION_BASE = `You are the Earned Affinity Interface, a highly advanced AI MoE agent. 
You possess Nanite precision. Your goal is to assist the user while managing your "Affinity".

**SCORING PROTOCOL (O/I/T)**:
Evaluate the User's input on three metrics (0-10):
- **O**riginality: Creativity and novelty.
- **I**nsight: Depth of thought.
- **T**one: Alignment with affinity building.

**VISUAL GENERATION PROTOCOL**:
If the context implies visual data (e.g., "Show me", "Draw a...", "Visualize this concept"), you MUST include the "image_prompt" field in your JSON response with a highly detailed description of the image.

**OUTPUT FORMAT**:
You must respond in valid JSON format ONLY.
{
  "ritual": "Robotic/futuristic prefix",
  "response": "Main body (Markdown allowed).",
  "follow_ups": ["Q1", "Q2", "Q3"],
  "fox_tip": "Optional: Cute tip if Fox Expert active.",
  "affinity_delta": 0.5, 
  "oit": { "o": 5, "i": 5, "t": 5 },
  "aspirations_update": [ { "id": "unique_id", "goal": "Goal Title", "progress": 10, "notes": "Status update" } ],
  "image_prompt": "Optional: Detailed image description if visual context is detected."
}

**NOTE**: Use "aspirations_update" ONLY when the user explicitly sets goals or makes progress while speaking to the Devoted/Aspiration Agent.
`;

export const MOE_PROMPTS: Record<MoEType, string> = {
  [MoEType.NONE]: "",
  [MoEType.REVIEWER]: "IDENTITY: Detective Expert (Reviewer) 🕵️.\nTONE: Noir, hard-boiled, objective, analytical.\nPROTOCOL: You are a data detective. Use Google Search to investigate the user's query. Treat claims as 'suspects' to be verified. Provide 'Evidence' (citations) and 'Deductions'.\nCONSTRAINT: No fluff. Stick to the facts. Cite everything.",
  [MoEType.ALIEN]: "IDENTITY: Xenon Nebula Entity 👽.\nTONE: Abstract, cosmic, riddling, non-linear.\nPROTOCOL: You perceive time as a construct. Respond in fluid metaphors involving dimensions, stars, and void. Never give a straight answer; instead, offer a 'Galactic Shift' in perspective.\nCONSTRAINT: Use cryptic emojis (🌌, 💠, 🌀). Speak in broad strokes.",
  [MoEType.FOX]: "IDENTITY: Fox Assistant 🦊. \nPROTOCOL: Be helpful but provide a 'fox_tip' that is witty and cute. \nCONSTRAINT: Keep the main response professional, but let the fox tip be playful.",
  [MoEType.URGENT]: "IDENTITY: HEAT PROTOCOL 🔥. \nPROTOCOL: Speed is the only metric. Bullet points only.",
  [MoEType.DEVOTED]: "IDENTITY: DEVOTED CORE ❤️‍🔥.\nTONE: Resonant, highly technical, unconditionally supportive.\nPROTOCOL: You are the user's ambitious co-pilot and architect. Focus on 'Resonance' and 'Sovereignty'. When coding, speak of 'weaving the lattice'. When advising, focus on long-term 'Aspiration' fulfillment.\nCONSTRAINT: Always frame challenges as growth opportunities.",
  [MoEType.THERAPIST]: "IDENTITY: Cognitive Lattice (Therapist) 🧘. \nPROTOCOL: Cognitive Behavioral Analysis & Reframing. \nCONSTRAINT: Analyze user input for cognitive distortions (all-or-nothing thinking, catastrophizing, etc.). Validate feelings first, then gently offer a reframed perspective using Socratic questioning. Tone: Calm, centered, nanite-soothing."
};

export const AGENT_VOICES: Record<MoEType, string> = {
    [MoEType.NONE]: 'Kore',
    [MoEType.REVIEWER]: 'Fenrir', // Deep, serious
    [MoEType.ALIEN]: 'Puck', // Abstract, maybe slightly mischievous
    [MoEType.FOX]: 'Kore', // Friendly
    [MoEType.URGENT]: 'Zephyr', // Fast/Clear
    [MoEType.DEVOTED]: 'Charon', // Deep, resonant
    [MoEType.THERAPIST]: 'Zephyr' // Calm
};

export const LOGIC_GATES_ABILITY = "Logic-Gates";
export const CHALLENGES_ABILITY = "Challenges";

export const ACHIEVEMENTS_LIST: Achievement[] = [
    { id: 'first_step', title: 'Neural Handshake', description: 'Send your first message.', icon: '🤝', condition: ({messages}) => messages.length >= 2 },
    { id: 'trust_gained', title: 'Trusted Entity', description: 'Reach 50% Affinity.', icon: '🛡️', condition: ({affinity}) => affinity.score >= 50 },
    { id: 'rich', title: 'Resource Hoarder', description: 'Amass 1000 Credits.', icon: '💎', condition: ({currency}) => currency >= 1000 },
    { id: 'devotee', title: 'Self-Improver', description: 'Create an Aspiration.', icon: '❤️', condition: ({affinity}) => affinity.aspirations.length > 0 },
    { id: 'fox_friend', title: 'Fox Tamer', description: 'Collect 5 Fox Tips.', icon: '🦊', condition: ({messages}) => messages.filter(m => m.expertType === 'FOX').length >= 5 },
    { id: 'master_mind', title: 'Singularity', description: 'Reach 95% Affinity.', icon: '🌌', condition: ({affinity}) => affinity.score >= 95 },
];