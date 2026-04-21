// Student interface
export interface Student {
  id?: string;
  name: string;
  class: string;
  rfid_card: string;
  registered_date: string;
  parent_id: string;
}

// Item catalog - maps NFC tag ID to item details
export interface Item {
  name: string;
  type: 'book' | 'essential' | 'other';
  subject?: string;
  weight_grams: number;
  icon: string;
  registered_date: string;
}

export interface ItemCatalog {
  [tagId: string]: Item;
}

// Timetable for a child
export interface DaySchedule {
  period1: string;
  period2: string;
  period3: string;
  period4: string;
  period5: string;
  essentials: string[];
  last_updated: string;
}

export interface Timetable {
  [day: string]: DaySchedule;
}

// Current session (real-time)
export interface ScannedItem {
  tag: string;
  name: string;
  timestamp: string;
  icon: string;
}

export interface MissingItem {
  name: string;
  required: boolean;
  icon: string;
}

export interface CurrentSession {
  active: boolean;
  student_id: string;
  student_name: string;
  day: string;
  start_time: string;
  scanned_items: ScannedItem[];
  missing_items: MissingItem[];
  total_weight: number;
  expected_weight: number;
  status: 'waiting' | 'scanning' | 'complete' | 'incomplete';
}

// Alert interface
export interface Alert {
  active: boolean;
  type: 'missing_items' | 'heavy_bag' | 'complete';
  message: string;
  timestamp: string;
  sent_to_parent: boolean;
}

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  RegisterChild: undefined;
  Timetable: { childId?: string };
  RegisterItems: undefined;
  RegisterNfc: undefined;  // ← ADD THIS LINE
  Monitor: undefined;
  Instructions: undefined;  // ← Make sure this exists

};

// Form data types
export interface ChildFormData {
  name: string;
  class: string;
  rfid_card: string;
}

export interface TimetableFormData {
  period1: string;
  period2: string;
  period3: string;
  period4: string;
  period5: string;
  essentials: string[];
  extraItems: string[];
}