export type LeadData = {
  name: string;
  jobTitle: string;
  company: string;
  location: string;
  emails: string[];
  rawBio: string;
};

export type LeadItem = {
  url: string;
  data: LeadData[];
};

export type LeadList = {
  id: string;
  name: string;
  date: string;
  leads: LeadItem[];
  // Session metadata — saved live during / after execution
  prompt?: string;
  costSpent?: number;
  allTimeCostAtEnd?: number;
  scanned?: number;
  rejected?: number;
  targetCount?: number;
  status?: 'running' | 'done' | 'stopped';
};

export type LogEntry = {
  time: string;
  message: string;
  type?: 'error' | 'success' | 'info';
};
