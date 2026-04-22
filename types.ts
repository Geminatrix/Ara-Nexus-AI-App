export interface Message {
  id: string;
  role: 'user' | 'model' | 'system' | 'expert' | 'alien';
  content: string;
  timestamp: number;
  isCoT?: boolean;
  cotSteps?: string[];
  ritual?: string;
  followups?: string[];
  expertType?: string;
  oit?: { o: number; i: number; t: number };
  image?: string;
  feedback?: 'up' | 'down';
  groundingSources?: GroundingSource[]; // New: Live Search Results
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AffinityState {
  score: number;
  level: number;
  abilities: string[];
  negativeStats: number;
  aspirations: Aspiration[];
  unlockedAchievements: string[]; // New: Track IDs
}

export interface Aspiration {
  id: string;
  goal: string;
  progress: number; // 0-100
  notes: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (state: { messages: Message[], affinity: AffinityState, currency: number }) => boolean;
}

export interface Checkpoint {
  name: string;
  timestamp: number;
  affinity: AffinityState;
  chatHistory: Message[];
  currency: number;
  prestige: number;
  inventory: string[];
  foxBag: FoxLogItem[]; 
}

export interface Settings {
  showThinking: boolean;
  voiceMode: boolean;
  devMode: boolean;
  instructionLength: 'regular' | 'extended';
}

export interface FoxTip {
  text: string;
  visible: boolean;
}

export interface FoxLogItem {
  id: string;
  text: string;
  timestamp: number;
}

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  purchased: boolean;
  type: 'upgrade' | 'prompt' | 'feature';
}

export enum MoEType {
  NONE = 'NONE',
  REVIEWER = 'REVIEWER', 
  ALIEN = 'ALIEN',
  FOX = 'FOX',
  URGENT = 'URGENT',
  DEVOTED = 'DEVOTED',
  THERAPIST = 'THERAPIST' // New
}

export interface AIResponseSchema {
  ritual: string;
  response: string;
  follow_ups: string[];
  fox_tip?: string;
  affinity_delta: number;
  oit?: { o: number; i: number; t: number };
  aspirations_update?: Aspiration[];
  image_prompt?: string; // New: Agent can request an image
}