export type MemoryType = "short" | "mid" | "long";

export interface MemoryRecord {
  id?: string;
  contact_id: string;
  memory_type: MemoryType;
  data: any;
  updated_at?: string;
}

export interface LoadedMemory {
  short: MemoryRecord[];
  mid: MemoryRecord[];
  long: MemoryRecord[];
}