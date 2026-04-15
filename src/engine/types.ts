/** Core types shared across the game engine */

export interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  hp: number;
  maxHp: number;
  tp: number;
  maxTp: number;
  attack: number;
  defense: number;
  speed: number;
  luck: number;
  techniques: string[];
  equipment: Equipment;
  portrait: string;
}

export interface Equipment {
  weapon: string | null;
  armor: string | null;
  shield: string | null;
  accessory: string | null;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'consumable' | 'weapon' | 'armor' | 'shield' | 'accessory' | 'key';
  effect?: ItemEffect;
  stats?: Partial<CharacterStats>;
  price: number;
}

export interface ItemEffect {
  type: 'heal_hp' | 'heal_tp' | 'cure_status' | 'damage' | 'buff';
  value: number;
  target: 'single' | 'party' | 'enemy' | 'all_enemies';
}

export interface CharacterStats {
  attack: number;
  defense: number;
  speed: number;
  luck: number;
}

export interface Enemy {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  exp: number;
  meseta: number;
  techniques: string[];
  weaknesses: string[];
  sprite: string;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  portrait?: string;
  emotion?: string;
}

export interface DialogueNode {
  id: string;
  lines: DialogueLine[];
  choices?: DialogueChoice[];
  next?: string;
}

export interface DialogueChoice {
  text: string;
  next: string;
  condition?: string;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: 'main' | 'side';
  objectives: QuestObjective[];
  rewards: QuestReward[];
}

export interface QuestObjective {
  id: string;
  description: string;
  type: 'talk' | 'defeat' | 'collect' | 'reach' | 'escort';
  target: string;
  count?: number;
  completed: boolean;
}

export interface QuestReward {
  type: 'exp' | 'meseta' | 'item';
  id?: string;
  amount: number;
}

export interface SaveData {
  party: Character[];
  inventory: InventorySlot[];
  quests: QuestState[];
  currentLocation: string;
  playTime: number;
  timestamp: number;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export interface QuestState {
  questId: string;
  status: 'inactive' | 'active' | 'completed' | 'failed';
  objectiveProgress: Record<string, number>;
}
