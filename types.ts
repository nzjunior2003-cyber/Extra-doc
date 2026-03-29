
export enum DocumentType {
  MEMO = 'MEMORANDO',
  REPORT = 'RELATÓRIO',
  COST_SHEET = 'PLANILHA_CUSTOS',
}

export interface DraftMetadata {
  id: string;
  title: string;
  lastModified: number;
  type: DocumentType;
  previewInfo?: string;
}

export interface Soldier {
  matricula: string;
  nome: string;
  cpf?: string;
  posto?: string; // Rank
  ubm?: string;
}

export interface CostSheetItem {
  id: string;
  soldierName: string;
  soldierMatricula: string;
  soldierRank: string;
  soldierUbm: string;
  date: string; 
  datesList?: string[];
  serviceType: 'DIVERSOS' | 'PREVENCAO' | 'GUARDA_VIDAS' | 'CORTE_VEGETAL';
  quantity: number;
  unitValue: number;
  isCommander?: boolean;
}

// Section 2: Effective Alterations
export interface ReportEffectiveItem {
  id: string;
  soldierName: string;
  soldierRank: string;
  soldierUbm: string;
  soldierMf: string; // Matricula
  status: 'P' | 'F' | 'D' | 'P/A' | 'A';
  isCommander?: boolean;
}

// Section 3: Service Alterations (Victims)
export interface ReportServiceItem {
  id: string;
  name: string; // Victim Name
  age: string;
  sex: 'M' | 'F';
  condition: 'ILS' | 'FD' | 'FTL'; // Ilesa, Ferida, Fatal
  code: string; // 1-20
}

export interface AppState {
  currentDoc: DocumentType;
  darkMode: boolean;
  personnelDb: Soldier[];
  formData: {
    // Issuer / Commander Data
    issuerMatricula: string;
    issuerName: string;
    issuerWarName: string;
    issuerRank: string;
    issuerUbm: string;
    issuerCpf: string;
    issuerPhone: string;
    
    // Memo Specific
    recipient: string;
    recipientCargo: string;
    memoSubject: string;
    
    // Memo Structured Inputs
    memoNsNum: string;
    memoNsYear: string;
    memoBgNum: string;
    memoBgYear: string;
    memoDatesList: string[];
    
    // Derived Memo Strings
    memoNs: string;
    memoBg: string;
    memoEventDates: string;
    
    // Cost Sheet Specific
    operationName: string;
    costSheetItems: CostSheetItem[];
    
    // Report Specific (Header)
    eventName: string;
    eventDate: string;
    eventDayOfWeek: string;
    eventLocal: string;
    eventStartTime: string;
    eventEndTime: string;
    eventPublicEstimate: string;
    siscobNumber: string;
    
    // Report Counts
    reportAbsences: string;
    reportExchanges: string;
    reportDispensations: string;
    reportDelays: string;

    // Report Tables Data
    reportEffectiveItems: ReportEffectiveItem[];
    reportServiceItems: ReportServiceItem[];
    
    // Report Logistics & Vehicles Maps (Key = Item Name, Value = {used, qty, origin})
    reportLogistics: Record<string, { used: boolean, qty: string }>;
    reportVehicles: Record<string, { used: boolean, qty: string, origin: string }>;
    reportOtherLogistics: string; // "Outros (Especificar)"
    reportOtherVehicles: string;  // "Outras (Especificar)"

    // Report Considerations
    reportPositive: { has: boolean, text: string };
    reportNegative: { has: boolean, text: string };
    reportActivities: string;
    reportGuidance: string; // Serviços de preventivo/orientação
    reportDistribution: string; // Distribuição do efetivo
    reportSuggestions: string;
    reportFinalConsiderations: string;
  };
}

// Global definition for jsPDF
declare global {
  interface Window {
    jspdf: any;
  }
}