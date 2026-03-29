
// Add missing React and hook imports
import React, { useState, useEffect, useRef } from 'react';
// Add missing Lucide icon imports
import { 
  Flame, Sun, Moon, FileText, DollarSign, ClipboardList, 
  Share2, Upload, Wifi, WifiOff, Database, CheckCircle2, 
  User, Search, Plus, X, Star, Trash2, Check, Download 
} from 'lucide-react';
import { AppState, DocumentType, Soldier, CostSheetItem, ReportEffectiveItem, ReportServiceItem } from './types';
import { RANKS, UBMS, UNIT_VALUE_DEFAULT, EXTERNAL_DB_URL, REPORT_LOGISTICS_ITEMS, REPORT_VEHICLE_ITEMS, OCCURRENCE_CODES } from './constants';
import { refineText } from './services/geminiService';
import { generatePDF } from './utils/pdfGenerator';
import { RAW_SOLDIER_CSV } from './data/initialSoldiers';

// Chave única para o LocalStorage (Simples, sem lista de rascunhos)
const STORAGE_KEY = 'extra-docs-state';

const DEFAULT_FORM_DATA = {
  // Issuer
  issuerMatricula: '',
  issuerName: '',
  issuerWarName: '',
  issuerRank: RANKS[0], 
  issuerUbm: UBMS[0],
  issuerCpf: '',
  issuerPhone: '',
  
  // Memo
  recipient: '',
  recipientCargo: '',
  memoSubject: 'Solicitação de Pagamento de Jornada Op. Extraordinária',
  
  // Memo Aux
  memoNsNum: '',
  memoNsYear: '2025',
  memoBgNum: '',
  memoBgYear: '2025',
  memoDatesList: [],
  
  // Memo Final
  memoNs: '',
  memoBg: '',
  memoEventDates: '',
  
  // Cost Sheet
  operationName: '',
  costSheetItems: [],
  
  // Report Header
  eventName: '',
  eventDate: new Date().toISOString().split('T')[0],
  eventDayOfWeek: 'DOMINGO',
  eventLocal: '',
  eventStartTime: '08:00',
  eventEndTime: '17:00',
  eventPublicEstimate: '0',
  siscobNumber: '',
  
  // Report Section 1 Counts
  reportAbsences: '',
  reportExchanges: '',
  reportDispensations: '',
  reportDelays: '',

  // Report Tables
  reportEffectiveItems: [],
  reportServiceItems: [],
  
  // Report Logistics & Vehicles
  reportLogistics: {},
  reportVehicles: {},
  reportOtherLogistics: '',
  reportOtherVehicles: '',

  // Report Considerations
  reportPositive: { has: true, text: '' },
  reportNegative: { has: false, text: '' },
  reportActivities: '',
  reportGuidance: 'HOUVE',
  reportDistribution: 'CONFORME NECESSIDADE',
  reportSuggestions: 'NADA A DECLARAR',
  reportFinalConsiderations: 'NADA A DECLARAR'
};

const App: React.FC = () => {
  // --- STATE ---
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  
  // Referência para o input de arquivo (Importação)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<AppState>({
    currentDoc: DocumentType.MEMO,
    darkMode: false,
    personnelDb: [],
    formData: JSON.parse(JSON.stringify(DEFAULT_FORM_DATA))
  });

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState("Conectando...");
  const [isOnline, setIsOnline] = useState(true);

  // Search State
  const [issuerSearchTerm, setIssuerSearchTerm] = useState('');
  const [showIssuerSuggestions, setShowIssuerSuggestions] = useState(false);
  const [issuerSuggestions, setIssuerSuggestions] = useState<Soldier[]>([]);

  const [recipientSearchTerm, setRecipientSearchTerm] = useState('');
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);
  const [recipientSuggestions, setRecipientSuggestions] = useState<Soldier[]>([]);

  const [costSearchTerm, setCostSearchTerm] = useState('');
  const [showCostSuggestions, setShowCostSuggestions] = useState(false);
  const [costSuggestions, setCostSuggestions] = useState<Soldier[]>([]);

  // Report Effective Search
  const [effSearchTerm, setEffSearchTerm] = useState('');
  const [showEffSuggestions, setShowEffSuggestions] = useState(false);
  const [effSuggestions, setEffSuggestions] = useState<Soldier[]>([]);
  const [newEffItem, setNewEffItem] = useState<{ soldier: Soldier | null, status: string, ubm: string }>({ soldier: null, status: 'F', ubm: UBMS[0] });

  // Report Service Item
  const [newSvcItem, setNewSvcItem] = useState<Partial<ReportServiceItem>>({ sex: 'M', condition: 'ILS', code: '1' });

  // Date Picker State
  const [tempDateInput, setTempDateInput] = useState('');
  const [tempMonthInput, setTempMonthInput] = useState('');

  // Commander Selection Modal State
  const [showWarNameModal, setShowWarNameModal] = useState(false);
  const [tempCommanderId, setTempCommanderId] = useState('');
  const [tempWarName, setTempWarName] = useState('');
  const [commanderSelectionContext, setCommanderSelectionContext] = useState<'COST' | 'REPORT'>('COST');

  // Cost Sheet Date Picker State
  const [costDateInput, setCostDateInput] = useState('');
  const [costMonthInput, setCostMonthInput] = useState('');
  const [newCostDatesList, setNewCostDatesList] = useState<string[]>([]);

  // New Cost Item Temporary State
  const [newCostItem, setNewCostItem] = useState<{
    selectedSoldier: Soldier | null;
    serviceType: string;
    qty: number;
    ubm: string;
  }>({
    selectedSoldier: null,
    serviceType: 'DIVERSOS',
    qty: 1,
    ubm: UBMS[0]
  });

  // --- LOGICA DE ESTADO ÚNICO & AUTO-SAVE ---

  // 1. Carregar Dados ao Iniciar
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Garante que não sobrescrevemos o personnelDb se ele estiver vazio no save
        setState(prev => ({ 
          ...prev, 
          ...parsed, 
          personnelDb: prev.personnelDb 
        }));
        
        // Restaura termos de busca para melhor UX
        if (parsed.formData?.issuerName) setIssuerSearchTerm(parsed.formData.issuerName);

      } catch (e) {
        console.error("Erro ao carregar dados salvos", e);
      }
    }
  }, []);

  // 2. Auto-Save
  useEffect(() => {
    const saveData = setTimeout(() => {
      // Não salvamos o banco de dados no localStorage para economizar espaço
      const stateToSave = { ...state, personnelDb: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      setLastSavedTime(new Date());
    }, 1000); // Debounce de 1 segundo

    return () => clearTimeout(saveData);
  }, [state]);

  // --- IMPORTAR / EXPORTAR ---

  const handleExport = () => {
    const stateToExport = { ...state, personnelDb: [] };
    // Nome do arquivo baseado no tipo de documento ou data
    const docName = state.currentDoc === DocumentType.MEMO ? 'memorando' : 
                    state.currentDoc === DocumentType.COST_SHEET ? 'planilha_custos' : 'relatorio';
    const fileName = `extradocs_${docName}_${new Date().toISOString().split('T')[0]}.json`;
    
    const blob = new Blob([JSON.stringify(stateToExport)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedState = JSON.parse(content);
        
        if (!parsedState.formData) throw new Error("Arquivo inválido");

        if (confirm("Importar este arquivo substituirá os dados atuais. Deseja continuar?")) {
            // Merge do estado importado com o DB atual
            setState(prev => ({
              ...prev,
              ...parsedState,
              personnelDb: prev.personnelDb
            }));

            if (parsedState.formData.issuerName) setIssuerSearchTerm(parsedState.formData.issuerName);
            
            alert("Dados importados com sucesso!");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo. Verifique se é um backup válido.");
      }
    };
    reader.readAsText(file);
    // Reset input para permitir selecionar o mesmo arquivo novamente se necessário
    event.target.value = '';
  };

  // --- LÓGICA DE GERAÇÃO DE MÊS INTEIRO ---

  const formatAnyDate = (dateStr: string) => {
    if (!dateStr) return "";
    if (dateStr.length === 7) {
      const [y, m] = dateStr.split('-');
      const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      return `${months[parseInt(m) - 1]}/${y}`;
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const addMemoMonth = () => {
    if (!tempMonthInput) return;
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        memoDatesList: [...new Set([...prev.formData.memoDatesList, tempMonthInput])]
      }
    }));
    setTempMonthInput('');
  };

  const addCostMonth = () => {
    if (!costMonthInput) return;
    setNewCostDatesList(prev => [...new Set([...prev, costMonthInput])]);
    setCostMonthInput('');
  };

  // --- LÓGICA EXISTENTE ---

  const normalizeRank = (csvRank: string): string => {
    const r = csvRank.toUpperCase();
    if (r.includes("TENENTE CORONEL")) {
      if (r.includes("QOCBM")) return "TCEL QOCBM";
      if (r.includes("QOSBM")) return "TCEL QOSBM";
      return "TCEL QOBM";
    }
    if (r.includes("CORONEL")) {
      if (r.includes("QOCBM")) return "CEL QOCBM";
      if (r.includes("QOSBM")) return "CEL QOSBM";
      return "CEL QOBM";
    }
    if (r.includes("MAJOR")) {
      if (r.includes("QOABM")) return "MAJ QOABM";
      return "MAJ QOBM";
    }
    if (r.includes("CAPITAO")) {
      if (r.includes("QOABM")) return "CAP QOABM";
      return "CAP QOBM";
    }
    if (r.includes("1 TENENTE") || r.includes("1º TENENTE")) {
      if (r.includes("QOABM")) return "1º TEN QOABM";
      return "1º TEN QOBM";
    }
    if (r.includes("2 TENENTE") || r.includes("2º TENENTE")) {
      if (r.includes("QOABM")) return "2º TEN QOABM";
      return "2º TEN QOBM";
    }
    if (r.includes("ALUNO CURSO") || r.includes("FORMACAO DE SOLDADO")) return "AL CFP";
    if (r.includes("ALUNO OFICIAL")) return "AL OF BM";
    if (r.includes("ASPIRANTE")) return "ASP OF BM";
    if (r.includes("CADETE")) return "AL OF BM";
    if (r.includes("SUB") && r.includes("TENENTE")) return "ST QBM";
    if (r.includes("1 SARGENTO") || r.includes("1º SARGENTO")) return "1º SGT QBM";
    if (r.includes("2 SARGENTO") || r.includes("2º SARGENTO")) return "2º SGT QBM";
    if (r.includes("3 SARGENTO") || r.includes("3º SARGENTO")) return "3º SGT QBM";
    if (r.includes("CABO")) return "CB QBM";
    if (r.includes("SOLDADO")) return "SD QBM";
    return "SD QBM";
  };

  const parseCSV = (csvText: string): Soldier[] => {
    const rawLines = csvText.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
    const startIdx = rawLines[0].toLowerCase().includes('matricula') ? 1 : 0;
    const dataLines = rawLines.slice(startIdx);
    
    return dataLines.map((line): Soldier | null => {
      const cols = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3) return null;
      const matriculaIdx = cols.findIndex(c => /^\d{5,}/.test(c));
      const nomeIdx = matriculaIdx > 0 ? matriculaIdx - 1 : 0;
      const cargoIdx = matriculaIdx + 1;
      const finalMat = matriculaIdx !== -1 ? cols[matriculaIdx] : cols[2];
      const finalNome = matriculaIdx !== -1 ? cols[nomeIdx] : cols[1];
      const finalCargo = cols[cargoIdx] || cols[3] || '';
      if (!finalNome || !finalMat) return null;
      return {
        matricula: finalMat,
        nome: finalNome,
        posto: normalizeRank(finalCargo),
        ubm: "QCG", 
        cpf: ''
      };
    }).filter((p): p is Soldier => p !== null);
  };

  useEffect(() => {
    const loadDatabase = async () => {
      try {
        setDbStatus("Buscando planilha online...");
        const response = await fetch(EXTERNAL_DB_URL);
        if (response.ok) {
          const text = await response.text();
          const soldiers = parseCSV(text);
          if (soldiers.length > 0) {
            setState(prev => ({ ...prev, personnelDb: soldiers }));
            setDbStatus(`${soldiers.length} militares (Online)`);
            setIsOnline(true);
            return;
          }
        }
        throw new Error("Falha ao obter dados online ou lista vazia");
      } catch (e) {
        console.warn("Modo Online falhou, usando base interna.", e);
        try {
          const soldiers = parseCSV(RAW_SOLDIER_CSV);
          setState(prev => ({ ...prev, personnelDb: soldiers }));
          setDbStatus(`${soldiers.length} militares (Offline)`);
          setIsOnline(false);
        } catch (innerE) {
          setDbStatus("Erro ao carregar base de dados.");
        }
      }
    };
    loadDatabase();
  }, []);

  useEffect(() => {
    const { memoNsNum, memoNsYear, memoBgNum, memoBgYear } = state.formData;
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        memoNs: memoNsNum ? `${memoNsNum}/${memoNsYear}` : '',
        memoBg: memoBgNum ? `${memoBgNum}/${memoBgYear}` : ''
      }
    }));
  }, [state.formData.memoNsNum, state.formData.memoNsYear, state.formData.memoBgNum, state.formData.memoBgYear]);

  useEffect(() => {
    const dates = state.formData.memoDatesList;
    if (dates.length === 0) {
      setState(prev => ({ ...prev, formData: { ...prev.formData, memoEventDates: '' } }));
      return;
    }
    const sortedDates = [...dates].sort();
    
    const format = (d: string) => {
      if (d.length === 7) {
        const [y, m] = d.split('-');
        const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        return `${months[parseInt(m)-1]}/${y}`;
      }
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    };

    const isMonth = (d: string) => d.length === 7;
    
    let text = "";
    if (sortedDates.length === 1) {
      const d = sortedDates[0];
      text = isMonth(d) ? `no mês de ${format(d)}` : `no dia ${format(d)}`;
    } else {
      const allMonths = sortedDates.every(isMonth);
      const allDays = sortedDates.every(d => !isMonth(d));
      
      const formatted = sortedDates.map(format);
      const last = formatted.pop();
      const listStr = `${formatted.join(', ')} e ${last}`;
      
      if (allMonths) text = `nos meses de ${listStr}`;
      else if (allDays) text = `nos dias ${listStr}`;
      else text = `no período de ${listStr}`;
    }
    
    setState(prev => ({ ...prev, formData: { ...prev.formData, memoEventDates: text } }));
  }, [state.formData.memoDatesList]);

  useEffect(() => {
    if (newCostDatesList.length > 0) {
      const totalDays = newCostDatesList.reduce((acc, d) => {
        if (d.length === 7) {
          const [y, m] = d.split('-').map(Number);
          return acc + new Date(y, m, 0).getDate();
        }
        return acc + 1;
      }, 0);
      setNewCostItem(prev => ({ ...prev, qty: totalDays }));
    } else {
      setNewCostItem(prev => ({ ...prev, qty: 1 }));
    }
  }, [newCostDatesList]);

  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.darkMode]);

  const handleInputChange = (field: keyof AppState['formData'], value: any) => {
    const finalValue = field === 'issuerRank' ? String(value).toUpperCase() : value;
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, [field]: finalValue }
    }));
  };

  const filterSoldiers = (term: string) => {
    if (!term || term.length < 2) return [];
    const t = term.toUpperCase();
    return state.personnelDb.filter(p => 
      p.nome.includes(t) || p.matricula.includes(t)
    ).slice(0, 10);
  };

  const handleIssuerSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setIssuerSearchTerm(val);
    handleInputChange('issuerName', val);
    if (val.length >= 2) {
      setIssuerSuggestions(filterSoldiers(val));
      setShowIssuerSuggestions(true);
    } else {
      setShowIssuerSuggestions(false);
    }
  };

  const selectIssuer = (s: Soldier) => {
    setIssuerSearchTerm(s.nome);
    setShowIssuerSuggestions(false);
    handleInputChange('issuerName', s.nome);
    handleInputChange('issuerMatricula', s.matricula);
    if (s.posto) handleInputChange('issuerRank', s.posto.toUpperCase());
    if (s.ubm) handleInputChange('issuerUbm', s.ubm);
    if (s.cpf) handleInputChange('issuerCpf', s.cpf);
  };

  const handleRecipientSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRecipientSearchTerm(val);
    handleInputChange('recipient', val);
    if (val.length >= 2) {
      setRecipientSuggestions(filterSoldiers(val));
      setShowRecipientSuggestions(true);
    } else {
      setShowRecipientSuggestions(false);
    }
  };

  const selectRecipient = (s: Soldier) => {
    const memoRank = s.posto ? s.posto.toUpperCase() : '';
    const formattedRecipient = `${s.nome} - ${memoRank}`;
    setRecipientSearchTerm(formattedRecipient);
    setShowRecipientSuggestions(false);
    handleInputChange('recipient', formattedRecipient);
  };

  const handleCostSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCostSearchTerm(val);
    if (val.length >= 2) {
      setCostSuggestions(filterSoldiers(val));
      setShowCostSuggestions(true);
    } else {
      setShowCostSuggestions(false);
    }
  };

  const selectCostSoldier = (s: Soldier) => {
    setCostSearchTerm(`${s.matricula} - ${s.nome}`);
    setShowCostSuggestions(false);
    // Atualiza também a UBM do novo item com a UBM do militar selecionado
    setNewCostItem(prev => ({ ...prev, selectedSoldier: s, ubm: s.ubm || UBMS[0] }));
  };

  const addMemoDate = () => {
    if (!tempDateInput) return;
    if (state.formData.memoDatesList.includes(tempDateInput)) {
      setTempDateInput('');
      return;
    }
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, memoDatesList: [...prev.formData.memoDatesList, tempDateInput] }
    }));
    setTempDateInput('');
  };

  const removeMemoDate = (dateToRemove: string) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, memoDatesList: prev.formData.memoDatesList.filter(d => d !== dateToRemove) }
    }));
  };

  const addCostDate = () => {
    if (!costDateInput) return;
    if (newCostDatesList.includes(costDateInput)) {
      setCostDateInput('');
      return;
    }
    setNewCostDatesList(prev => [...prev, costDateInput]);
    setCostDateInput('');
  };

  const removeCostItem = (id: string) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, costSheetItems: prev.formData.costSheetItems.filter(i => i.id !== id) }
    }));
  };

  const updateCostItem = (id: string, field: 'serviceType' | 'quantity', value: any) => {
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        costSheetItems: prev.formData.costSheetItems.map(item => 
          item.id === id ? { ...item, [field]: value } : item
        )
      }
    }));
  };

  const removeCostDate = (dateToRemove: string) => {
    setNewCostDatesList(prev => prev.filter(d => d !== dateToRemove));
  };

  const addSoldierToRoster = () => {
    const { selectedSoldier, serviceType, qty, ubm } = newCostItem;
    const soldierName = selectedSoldier?.nome || "Militar Manual";
    const soldierRank = selectedSoldier?.posto ? selectedSoldier.posto.toUpperCase() : "SD QBM";
    // Usa a UBM selecionada manualmente ou a do militar
    const soldierUbm = ubm || selectedSoldier?.ubm || "UBM";
    const soldierMatricula = selectedSoldier?.matricula || costSearchTerm;

    if (!soldierMatricula) {
      alert("Selecione um militar ou digite uma matrícula.");
      return;
    }

    const newItem: CostSheetItem = {
      id: Date.now().toString(),
      soldierName,
      soldierMatricula,
      soldierRank,
      soldierUbm,
      date: newCostDatesList.length > 0 ? newCostDatesList.join(', ') : '',
      datesList: newCostDatesList,
      serviceType: serviceType as any,
      quantity: qty,
      unitValue: UNIT_VALUE_DEFAULT,
      isCommander: false
    };

    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, costSheetItems: [...prev.formData.costSheetItems, newItem] }
    }));

    setNewCostItem(prev => ({ ...prev, qty: 1 }));
    setNewCostDatesList([]);
    setCostDateInput('');
  };

  const initiateCommanderSelection = (id: string, context: 'COST' | 'REPORT') => {
    setCommanderSelectionContext(context);
    setTempCommanderId(id);
    setTempWarName(''); 
    setShowWarNameModal(true);
  };

  const confirmCommander = () => {
    setState(prev => {
      let newFormData = { ...prev.formData };

      if (commanderSelectionContext === 'COST') {
        const updatedItems = prev.formData.costSheetItems.map(item => ({
          ...item,
          isCommander: item.id === tempCommanderId
        }));
        newFormData.costSheetItems = updatedItems;
        const commander = updatedItems.find(i => i.id === tempCommanderId);
        
        if (commander) {
          newFormData.issuerName = commander.soldierName;
          newFormData.issuerMatricula = commander.soldierMatricula;
          newFormData.issuerRank = commander.soldierRank;
          newFormData.issuerUbm = commander.soldierUbm;
          newFormData.issuerWarName = tempWarName;
        }
      } else {
        // REPORT CONTEXT
        const updatedItems = prev.formData.reportEffectiveItems.map(item => ({
          ...item,
          isCommander: item.id === tempCommanderId
        }));
        newFormData.reportEffectiveItems = updatedItems;
        const commander = updatedItems.find(i => i.id === tempCommanderId);
        
        if (commander) {
           newFormData.issuerName = commander.soldierName;
           newFormData.issuerMatricula = commander.soldierMf; // In report item it's called soldierMf
           newFormData.issuerRank = commander.soldierRank;
           newFormData.issuerUbm = commander.soldierUbm;
           newFormData.issuerWarName = tempWarName;
        }
      }

      return { ...prev, formData: newFormData };
    });
    setShowWarNameModal(false);
  };

  // --- Report Specific Handlers ---

  const handleEffSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEffSearchTerm(val);
    if (val.length >= 2) {
      setEffSuggestions(filterSoldiers(val));
      setShowEffSuggestions(true);
    } else {
      setShowEffSuggestions(false);
    }
  };

  const selectEffSoldier = (s: Soldier) => {
    setEffSearchTerm(s.nome);
    setShowEffSuggestions(false);
    setNewEffItem(prev => ({ ...prev, soldier: s, ubm: s.ubm || UBMS[0] }));
  };

  const addEffectiveItem = () => {
    if (!newEffItem.soldier) return;
    const newItem: ReportEffectiveItem = {
      id: Date.now().toString(),
      soldierName: newEffItem.soldier.nome,
      soldierRank: newEffItem.soldier.posto || '',
      soldierUbm: newEffItem.ubm, // Use updated ubm
      soldierMf: newEffItem.soldier.matricula,
      status: newEffItem.status as any,
      isCommander: false
    };
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, reportEffectiveItems: [...prev.formData.reportEffectiveItems, newItem] }
    }));
    setEffSearchTerm('');
    setNewEffItem({ soldier: null, status: 'F', ubm: UBMS[0] });
  };

  const removeEffectiveItem = (id: string) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, reportEffectiveItems: prev.formData.reportEffectiveItems.filter(i => i.id !== id) }
    }));
  };

  const addServiceItem = () => {
    if (!newSvcItem.name) return;
    const newItem: ReportServiceItem = {
      id: Date.now().toString(),
      name: newSvcItem.name,
      age: newSvcItem.age || '',
      sex: newSvcItem.sex as any,
      condition: newSvcItem.condition as any,
      code: newSvcItem.code || '1'
    };
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, reportServiceItems: [...prev.formData.reportServiceItems, newItem] }
    }));
    setNewSvcItem({ sex: 'M', condition: 'ILS', code: '1', name: '', age: '' });
  };

  const removeServiceItem = (id: string) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, reportServiceItems: prev.formData.reportServiceItems.filter(i => i.id !== id) }
    }));
  };

  const toggleLogisticsItem = (item: string) => {
    setState(prev => {
      const current = prev.formData.reportLogistics[item] || { used: false, qty: '' };
      return {
        ...prev,
        formData: {
          ...prev.formData,
          reportLogistics: {
            ...prev.formData.reportLogistics,
            [item]: { ...current, used: !current.used }
          }
        }
      };
    });
  };

  const updateLogisticsQty = (item: string, qty: string) => {
    setState(prev => {
      const current = prev.formData.reportLogistics[item] || { used: false, qty: '' };
      return {
        ...prev,
        formData: {
          ...prev.formData,
          reportLogistics: {
            ...prev.formData.reportLogistics,
            [item]: { ...current, qty }
          }
        }
      };
    });
  };

  const toggleVehicleItem = (item: string) => {
    setState(prev => {
      const current = prev.formData.reportVehicles[item] || { used: false, qty: '', origin: '' };
      return {
        ...prev,
        formData: {
          ...prev.formData,
          reportVehicles: {
            ...prev.formData.reportVehicles,
            [item]: { ...current, used: !current.used }
          }
        }
      };
    });
  };

  const updateVehicleQty = (item: string, field: 'qty' | 'origin', val: string) => {
    setState(prev => {
      const current = prev.formData.reportVehicles[item] || { used: false, qty: '', origin: '' };
      return {
        ...prev,
        formData: {
          ...prev.formData,
          reportVehicles: {
            ...prev.formData.reportVehicles,
            [item]: { ...current, [field]: val }
          }
        }
      };
    });
  };

  const handleAiRefine = async (field: keyof AppState['formData'], isNested = false, nestedKey?: string) => {
    setIsAiLoading(true);
    try {
      let textToRefine = "";
      if (isNested && nestedKey === 'positive') textToRefine = state.formData.reportPositive.text;
      else if (isNested && nestedKey === 'negative') textToRefine = state.formData.reportNegative.text;
      else textToRefine = String(state.formData[field]);

      if (!textToRefine) return;

      const refined = await refineText(textToRefine, state.currentDoc === DocumentType.MEMO ? 'memo' : 'report');
      
      if (isNested) {
        if (nestedKey === 'positive') setState(prev => ({ ...prev, formData: { ...prev.formData, reportPositive: { ...prev.formData.reportPositive, text: refined } } }));
        if (nestedKey === 'negative') setState(prev => ({ ...prev, formData: { ...prev.formData, reportNegative: { ...prev.formData.reportNegative, text: refined } } }));
      } else {
        handleInputChange(field, refined);
      }
    } catch (error) {
      alert("Erro ao refinar texto com IA.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleClearForm = () => {
    if (confirm("Tem certeza que deseja limpar todo o formulário? Todos os dados não salvos serão perdidos.")) {
      setState(prev => ({
        ...prev,
        formData: JSON.parse(JSON.stringify(DEFAULT_FORM_DATA))
      }));
      
      // Reset search terms and temporary states
      setIssuerSearchTerm('');
      setRecipientSearchTerm('');
      setCostSearchTerm('');
      setEffSearchTerm('');
      setNewCostDatesList([]);
      setNewCostItem(prev => ({ ...prev, qty: 1, selectedSoldier: null }));
      setNewEffItem({ soldier: null, status: 'F', ubm: UBMS[0] });
      setNewSvcItem({ sex: 'M', condition: 'ILS', code: '1', name: '', age: '' });
      setTempDateInput('');
      setTempMonthInput('');
      setCostDateInput('');
      setCostMonthInput('');
      
      alert("Formulário limpo com sucesso!");
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-cbmpa-900 text-white flex-shrink-0 flex flex-col shadow-lg z-10">
        <div className="p-6 border-b border-cbmpa-800 flex justify-between items-center bg-cbmpa-950">
          <div className="flex items-center space-x-2">
            <Flame size={24} className="text-yellow-500" />
            <h1 className="font-bold text-xl tracking-wider">EXTRA DOCS</h1>
          </div>
          <button onClick={() => setState(prev => ({ ...prev, darkMode: !prev.darkMode }))} className="p-2 rounded-full hover:bg-cbmpa-800 text-yellow-500">
            {state.darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => setState(prev => ({ ...prev, currentDoc: DocumentType.MEMO }))}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${state.currentDoc === DocumentType.MEMO ? 'bg-yellow-500 text-cbmpa-900 font-bold shadow-md' : 'hover:bg-cbmpa-800 text-white'}`}
          >
            <FileText size={20} />
            <span>Memorando</span>
          </button>
          <button 
            onClick={() => setState(prev => ({ ...prev, currentDoc: DocumentType.COST_SHEET }))}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${state.currentDoc === DocumentType.COST_SHEET ? 'bg-yellow-500 text-cbmpa-900 font-bold shadow-md' : 'hover:bg-cbmpa-800 text-white'}`}
          >
            <DollarSign size={20} />
            <span>Planilha Custos</span>
          </button>
          <button 
            onClick={() => setState(prev => ({ ...prev, currentDoc: DocumentType.REPORT }))}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${state.currentDoc === DocumentType.REPORT ? 'bg-yellow-500 text-cbmpa-900 font-bold shadow-md' : 'hover:bg-cbmpa-800 text-white'}`}
          >
            <ClipboardList size={20} />
            <span>Relatório</span>
          </button>

          {/* BACKUP SECTION */}
          <div className="pt-6 mt-6 border-t border-cbmpa-800">
             <h3 className="text-xs uppercase text-cbmpa-300 font-bold mb-3 px-2">Transferência</h3>
             
             <button 
               onClick={handleExport}
               className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-cbmpa-800 text-white transition-all text-sm mb-1"
             >
                <Share2 size={18} />
                <span>Exportar Dados</span>
             </button>

             <button 
               onClick={() => fileInputRef.current?.click()}
               className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-cbmpa-800 text-white transition-all text-sm"
             >
                <Upload size={18} />
                <span>Importar Dados</span>
             </button>
             <input 
                type="file" 
                accept=".json" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleImport}
             />

             <button 
               onClick={handleClearForm}
               className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-red-900/50 text-red-200 transition-all text-sm mt-4 border border-red-900/30 group"
             >
                <Trash2 size={18} className="group-hover:text-red-100" />
                <span className="group-hover:text-red-100">Limpar Tudo</span>
             </button>
          </div>

        </nav>

        <div className="p-4 border-t border-cbmpa-800 bg-cbmpa-950 space-y-3">
          <div className={`flex items-center justify-between text-xs p-3 rounded ${isOnline ? 'bg-green-900/30 text-green-300' : 'bg-orange-900/30 text-orange-300'}`}>
             <div className="flex items-center space-x-2">
               {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
               <span className="font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
             </div>
             <div className="flex items-center space-x-1">
               <Database size={12} />
               <span>{state.personnelDb.length}</span>
             </div>
          </div>
          <p className="text-[10px] text-gray-400 text-center">{dbStatus}</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen relative">
        
        {/* MODAL FOR COMMANDER SELECTION */}
        {showWarNameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-96 border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-bold mb-4 text-cbmpa-900 dark:text-white">Definir Comandante</h3>
              <p className="text-sm text-gray-500 mb-4">
                Este militar será definido como Comandante da Prevenção e assinará o documento.
              </p>
              <label className="label">Informe o Nome de Guerra (Para Negrito)</label>
              <input 
                type="text" 
                value={tempWarName} 
                onChange={(e) => setTempWarName(e.target.value)} 
                className="input mb-6"
                placeholder="Ex: SILVA"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button 
                  onClick={() => setShowWarNameModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmCommander}
                  className="px-4 py-2 text-sm bg-cbmpa-600 text-white rounded hover:bg-cbmpa-700 font-medium"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-20">
          
          {/* HEADER COMMON */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
             <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-cbmpa-900 dark:text-white flex items-center gap-2">
                     {state.currentDoc === DocumentType.MEMO && <FileText size={24}/>}
                     {state.currentDoc === DocumentType.COST_SHEET && <DollarSign size={24}/>}
                     {state.currentDoc === DocumentType.REPORT && <ClipboardList size={24}/>}
                     {state.currentDoc === DocumentType.MEMO && "MEMORANDO"}
                     {state.currentDoc === DocumentType.COST_SHEET && "PLANILHA DE CUSTOS"}
                     {state.currentDoc === DocumentType.REPORT && "RELATÓRIO DE PREVENÇÃO"}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Preencha os dados conforme modelo padrão</p>
                </div>
                {lastSavedTime && (
                   <div className="text-xs text-gray-400 flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-green-500" />
                      Salvo às {lastSavedTime.toLocaleTimeString()}
                   </div>
                )}
             </div>
          </div>

          <div className="p-6 space-y-8">
            {/* --- MEMORANDUM FORM --- */}
            {state.currentDoc === DocumentType.MEMO && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-blue-50 dark:bg-gray-800/50 rounded-lg p-6 border border-blue-100 dark:border-gray-700">
                   <h3 className="text-sm font-bold text-cbmpa-900 dark:text-white mb-4 flex items-center gap-2">
                      <User size={16} /> NOME DO COMANDANTE DA PREVENÇÃO
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 relative">
                         <label className="label">NOME DO COMANDANTE (BUSCA OU DIGITE)</label>
                         <div className="relative">
                            <input 
                              type="text" 
                              className="input pl-9" 
                              placeholder="Digite nome ou matrícula..." 
                              value={issuerSearchTerm}
                              onChange={handleIssuerSearchChange}
                            />
                            <Search className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                         </div>
                         {showIssuerSuggestions && (
                           <ul className="absolute z-50 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-auto mt-1">
                             {issuerSuggestions.map(s => (
                               <li key={s.matricula} onClick={() => selectIssuer(s)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm border-b border-gray-100 dark:border-gray-600 last:border-0">
                                 <div className="font-bold">{s.posto} {s.nome}</div>
                                 <div className="text-xs text-gray-500 dark:text-gray-400">Mat: {s.matricula}</div>
                               </li>
                             ))}
                           </ul>
                         )}
                      </div>
                      
                      {/* Campos ocultos visualmente mas mantidos no estado para o PDF */}
                      <div className="hidden">
                         <input type="text" value={state.formData.issuerName} readOnly />
                         <input type="text" value={state.formData.issuerMatricula} readOnly />
                         <input type="text" value={state.formData.issuerUbm} readOnly />
                      </div>

                      <div>
                         <label className="label">NOME DE GUERRA</label>
                         <input type="text" className="input" placeholder="Ex: SILVA" value={state.formData.issuerWarName} onChange={(e) => handleInputChange('issuerWarName', e.target.value)} />
                      </div>
                      <div>
                         <label className="label">POSTO/GRADUAÇÃO</label>
                         <select className="input" value={state.formData.issuerRank} onChange={(e) => handleInputChange('issuerRank', e.target.value)}>
                            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                         </select>
                      </div>
                   </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-0">
                   <div className="relative">
                     <label className="label">NOME DO DESTINATÁRIO (BUSCA OU DIGITE)</label>
                     <div className="relative">
                        <input type="text" className="input pl-9" placeholder="Ex: Cel Fulano de Tal" value={recipientSearchTerm} onChange={handleRecipientSearchChange} />
                        <Search className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                     </div>
                     {showRecipientSuggestions && (
                       <ul className="absolute z-50 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-auto mt-1">
                         {recipientSuggestions.map(s => (
                           <li key={s.matricula} onClick={() => selectRecipient(s)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm">
                             {s.posto} {s.nome}
                           </li>
                         ))}
                       </ul>
                     )}
                   </div>
                </div>

                <div className="bg-yellow-50 dark:bg-gray-900/30 rounded-lg p-4 border border-yellow-100 dark:border-gray-700">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid grid-cols-3 gap-2">
                         <div className="col-span-2">
                           <label className="label">NS (NOTA DE SERVIÇO)</label>
                           <input type="text" className="input" placeholder="Nº" value={state.formData.memoNsNum} onChange={(e) => handleInputChange('memoNsNum', e.target.value)} />
                         </div>
                         <div>
                           <label className="label">&nbsp;</label>
                           <input type="text" className="input" placeholder="2025" value={state.formData.memoNsYear} onChange={(e) => handleInputChange('memoNsYear', e.target.value)} />
                         </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                         <div className="col-span-2">
                           <label className="label">BG (BOLETIM GERAL)</label>
                           <input type="text" className="input" placeholder="Nº" value={state.formData.memoBgNum} onChange={(e) => handleInputChange('memoBgNum', e.target.value)} />
                         </div>
                         <div>
                           <label className="label">&nbsp;</label>
                           <input type="text" className="input" placeholder="2025" value={state.formData.memoBgYear} onChange={(e) => handleInputChange('memoBgYear', e.target.value)} />
                         </div>
                      </div>
                   </div>
                   
                   <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">ADICIONAR DATA INDIVIDUAL</label>
                        <div className="flex gap-2">
                          <input type="date" className="input" value={tempDateInput} onChange={(e) => setTempDateInput(e.target.value)} />
                          <button onClick={addMemoDate} className="bg-cbmpa-600 hover:bg-cbmpa-700 text-white px-4 rounded font-bold flex items-center gap-2 text-sm whitespace-nowrap">
                              <Plus size={18}/> Adicionar
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="label">ADICIONAR MÊS INTEIRO</label>
                        <div className="flex gap-2">
                          <input type="month" className="input" value={tempMonthInput} onChange={(e) => setTempMonthInput(e.target.value)} />
                          <button onClick={addMemoMonth} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded font-bold flex items-center gap-2 text-sm whitespace-nowrap">
                              <Plus size={18}/> Adicionar Mês
                          </button>
                        </div>
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-2 mt-4">
                      {state.formData.memoDatesList.map(date => (
                         <span key={date} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1 rounded text-sm font-medium flex items-center gap-2">
                            {formatAnyDate(date)}
                            <button onClick={() => removeMemoDate(date)} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                         </span>
                      ))}
                    </div>
                </div>
              </div>
            )}

            {/* --- COST SHEET FORM --- */}
            {state.currentDoc === DocumentType.COST_SHEET && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                         <label className="label">NOME DA OPERAÇÃO / EVENTO</label>
                         <input 
                            type="text" 
                            className="input" 
                            placeholder="Ex: OPERAÇÃO CÍRIO 2025" 
                            value={state.formData.operationName} 
                            onChange={(e) => handleInputChange('operationName', e.target.value)} 
                         />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                         <div className="col-span-2">
                            <label className="label">REFERÊNCIA NS</label>
                            <input type="text" className="input" placeholder="Nº" value={state.formData.memoNsNum} onChange={(e) => handleInputChange('memoNsNum', e.target.value)} />
                         </div>
                         <div>
                            <label className="label">&nbsp;</label>
                            <input type="text" className="input" placeholder="2025" value={state.formData.memoNsYear} onChange={(e) => handleInputChange('memoNsYear', e.target.value)} />
                         </div>
                      </div>
                   </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm border-l-4 border-l-cbmpa-500">
                   <h3 className="section-title text-gray-600 uppercase">ADICIONAR MILITAR À PLANILHA (INCLUINDO COMANDANTE)</h3>
                   
                   <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-9 relative">
                            <label className="label">1. BUSCAR MILITAR (NOME OU MATRÍCULA)</label>
                            <div className="relative">
                                <input 
                                type="text" 
                                className="input pl-9" 
                                placeholder="Digite..." 
                                value={costSearchTerm}
                                onChange={handleCostSearchChange}
                                />
                                <Search className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
                            </div>
                            {showCostSuggestions && (
                            <ul className="absolute z-50 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-auto mt-1">
                                {costSuggestions.map(s => (
                                <li key={s.matricula} onClick={() => selectCostSoldier(s)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm border-b border-gray-100 dark:border-gray-600">
                                    <div className="font-bold">{s.posto} {s.nome}</div>
                                </li>
                                ))}
                            </ul>
                            )}
                        </div>
                        <div className="md:col-span-3">
                             <label className="label">UBM</label>
                             <select className="input" value={newCostItem.ubm} onChange={(e) => setNewCostItem({...newCostItem, ubm: e.target.value})}>
                                {UBMS.map(u => <option key={u} value={u}>{u}</option>)}
                             </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">2. ADICIONAR DATA INDIVIDUAL</label>
                            <div className="flex gap-2">
                                <input type="date" className="input" value={costDateInput} onChange={(e) => setCostDateInput(e.target.value)} />
                                <button onClick={addCostDate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded font-bold flex items-center gap-2 text-sm whitespace-nowrap">
                                  <Plus size={18}/> Adicionar Dia
                                </button>
                            </div>
                          </div>
                          <div>
                            <label className="label">3. ADICIONAR MÊS INTEIRO</label>
                            <div className="flex gap-2">
                                <input type="month" className="input" value={costMonthInput} onChange={(e) => setCostMonthInput(e.target.value)} />
                                <button onClick={addCostMonth} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded font-bold flex items-center gap-2 text-sm whitespace-nowrap">
                                  <Plus size={18}/> Adicionar Mês
                                </button>
                            </div>
                          </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-900/30 p-2 rounded border border-gray-100 dark:border-gray-700">
                         <label className="label">DIAS SELECIONADOS (TOTAL: {newCostItem.qty})</label>
                         <div className="flex flex-wrap gap-2 mt-2">
                            {newCostDatesList.map(d => (
                               <span key={d} className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                                  {formatAnyDate(d)}
                                  <button onClick={() => removeCostDate(d)}><X size={12}/></button>
                               </span>
                            ))}
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                          <div>
                             <label className="label">4. ESCOLHA O TIPO DE SERVIÇO</label>
                             <select className="input" value={newCostItem.serviceType} onChange={(e) => setNewCostItem({...newCostItem, serviceType: e.target.value})}>
                                <option value="DIVERSOS">Serviços Diversos</option>
                                <option value="PREVENCAO">Prevenção Desportiva</option>
                                <option value="GUARDA_VIDAS">Guarda Vidas</option>
                                <option value="CORTE_VEGETAL">Corte de Vegetal</option>
                             </select>
                          </div>
                          <div>
                            <button 
                                onClick={addSoldierToRoster}
                                disabled={!newCostItem.selectedSoldier && costSearchTerm.length < 5}
                                className="bg-cbmpa-600 hover:bg-cbmpa-700 text-white px-6 py-2.5 rounded font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed h-[42px] w-full"
                            >
                                <Plus size={18} /> Adicionar à Planilha
                            </button>
                          </div>
                      </div>
                   </div>
                </div>

                {state.formData.costSheetItems.length > 0 && (
                   <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                           <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase text-xs font-bold">
                              <tr>
                                 <th className="p-3 text-center">CMT</th>
                                 <th className="p-3">MATRÍCULA</th>
                                 <th className="p-3">NOME</th>
                                 <th className="p-3">UBM</th>
                                 <th className="p-3">SV.</th>
                                 <th className="p-3 text-center">QTD</th>
                                 <th className="p-3 text-right">VALOR</th>
                                 <th className="p-3 text-center">AÇÃO</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {state.formData.costSheetItems.map(item => (
                                 <tr key={item.id} className={item.isCommander ? "bg-yellow-50 dark:bg-yellow-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}>
                                    <td className="p-3 text-center">
                                       <button 
                                          onClick={() => initiateCommanderSelection(item.id, 'COST')} 
                                          title="Definir como Comandante"
                                          className={`p-1.5 rounded hover:bg-yellow-100 ${item.isCommander ? 'text-yellow-500' : 'text-gray-300'}`}
                                       >
                                          <Star size={18} fill={item.isCommander ? "currentColor" : "none"} />
                                       </button>
                                    </td>
                                    <td className="p-3 text-gray-500">{item.soldierMatricula}</td>
                                    <td className="p-3 font-medium">
                                       {item.soldierRank} {item.soldierName}
                                    </td>
                                    <td className="p-3 text-xs text-gray-500">{item.soldierUbm}</td>
                                    <td className="p-3 text-xs">
                                       {item.serviceType === 'DIVERSOS' && 'DIV'}
                                       {item.serviceType === 'PREVENCAO' && 'PREV'}
                                       {item.serviceType === 'GUARDA_VIDAS' && 'GV'}
                                       {item.serviceType === 'CORTE_VEGETAL' && 'CORTE'}
                                    </td>
                                    <td className="p-3 text-center font-bold">
                                       {item.quantity}
                                    </td>
                                    <td className="p-3 text-right font-bold text-green-600">
                                       {(item.quantity * item.unitValue).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                                    </td>
                                    <td className="p-3 flex justify-center gap-2">
                                       <button onClick={() => removeCostItem(item.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                                          <Trash2 size={16} />
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                           <tfoot className="bg-gray-50 dark:bg-gray-900 font-bold border-t border-gray-200 dark:border-gray-700">
                              <tr>
                                 <td colSpan={5} className="p-3 text-right">TOTAL GERAL:</td>
                                 <td className="p-3 text-center">{state.formData.costSheetItems.reduce((acc, i) => acc + i.quantity, 0)}</td>
                                 <td className="p-3 text-right text-green-700">
                                    {state.formData.costSheetItems.reduce((acc, i) => acc + (i.quantity * i.unitValue), 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                                 </td>
                                 <td></td>
                              </tr>
                           </tfoot>
                        </table>
                      </div>
                   </div>
                )}
              </div>
            )}

            {/* --- REPORT FORM --- */}
            {state.currentDoc === DocumentType.REPORT && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 
                 {/* 1. HEADER */}
                 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="section-title text-cbmpa-800">1. Dados Iniciais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                          <label className="label">NOME DO EVENTO</label>
                          <input type="text" className="input" value={state.formData.eventName} onChange={(e) => handleInputChange('eventName', e.target.value)} />
                       </div>
                       
                       <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/50">
                          <label className="label text-gray-500">COMANDANTE (SELECIONAR NA SEÇÃO 2)</label>
                          <div className="text-sm font-bold text-red-600 dark:text-red-400 mt-2">
                             Selecione o Cmt na tabela abaixo
                          </div>
                       </div>

                       <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                             <label className="label">DATA</label>
                             <input type="date" className="input" value={state.formData.eventDate} onChange={(e) => handleInputChange('eventDate', e.target.value)} />
                          </div>
                          <div>
                             <label className="label">DIA DA SEMANA</label>
                             <select className="input" value={state.formData.eventDayOfWeek} onChange={(e) => handleInputChange('eventDayOfWeek', e.target.value)}>
                                <option value="DOMINGO">DOMINGO</option>
                                <option value="SEGUNDA">SEGUNDA</option>
                                <option value="TERÇA">TERÇA</option>
                                <option value="QUARTA">QUARTA</option>
                                <option value="QUINTA">QUINTA</option>
                                <option value="SEXTA">SEXTA</option>
                                <option value="SÁBADO">SÁBADO</option>
                             </select>
                          </div>
                       </div>
                       
                       <div>
                          <label className="label">LOCAL</label>
                          <input type="text" className="input" value={state.formData.eventLocal} onChange={(e) => handleInputChange('eventLocal', e.target.value)} />
                       </div>

                       <div className="grid grid-cols-2 gap-2">
                          <div><label className="label">HORA INÍCIO</label><input type="time" className="input" value={state.formData.eventStartTime} onChange={(e) => handleInputChange('eventStartTime', e.target.value)} /></div>
                          <div><label className="label">HORA FIM</label><input type="time" className="input" value={state.formData.eventEndTime} onChange={(e) => handleInputChange('eventEndTime', e.target.value)} /></div>
                       </div>

                       <div className="grid grid-cols-2 gap-2">
                          <div><label className="label">Nº SISCOB</label><input type="text" className="input" value={state.formData.siscobNumber} onChange={(e) => handleInputChange('siscobNumber', e.target.value)} /></div>
                          <div><label className="label">ESTIMATIVA PÚBLICO</label><input type="text" className="input" value={state.formData.eventPublicEstimate} onChange={(e) => handleInputChange('eventPublicEstimate', e.target.value)} /></div>
                       </div>

                       <div>
                          <div className="grid grid-cols-3 gap-2">
                             <div className="col-span-2">
                               <label className="label">REF. (NS)</label>
                               <input type="text" className="input" placeholder="Nº" value={state.formData.memoNsNum} onChange={(e) => handleInputChange('memoNsNum', e.target.value)} />
                             </div>
                             <div>
                               <label className="label">&nbsp;</label>
                               <input type="text" className="input" placeholder="2025" value={state.formData.memoNsYear} onChange={(e) => handleInputChange('memoNsYear', e.target.value)} />
                             </div>
                          </div>
                       </div>

                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                       <div className="bg-gray-100 p-2 rounded text-center">
                          <label className="label">FALTAS</label>
                          <div className="font-bold text-gray-600">
                             {state.formData.reportEffectiveItems.filter(i => i.status === 'F').length}
                          </div>
                       </div>
                       <div className="bg-gray-100 p-2 rounded text-center">
                          <label className="label">PERMUTAS</label>
                          <div className="font-bold text-gray-600">
                             {state.formData.reportEffectiveItems.filter(i => i.status === 'P/A').length}
                          </div>
                       </div>
                       <div className="bg-gray-100 p-2 rounded text-center">
                          <label className="label">DISPENSAS</label>
                          <div className="font-bold text-gray-600">
                             {state.formData.reportEffectiveItems.filter(i => i.status === 'D').length}
                          </div>
                       </div>
                       <div className="bg-gray-100 p-2 rounded text-center">
                          <label className="label">ATRASOS</label>
                          <div className="font-bold text-gray-600">
                             {state.formData.reportEffectiveItems.filter(i => i.status === 'A').length}
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* 2. EFFECTIVE TABLE */}
                 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="section-title text-cbmpa-800">2. Alterações no Efetivo (Selecione o Cmt aqui)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded items-end">
                       <div className="md:col-span-6 relative">
                          <label className="label">BUSCAR MILITAR</label>
                          <input type="text" className="input" placeholder="Nome/Matrícula..." value={effSearchTerm} onChange={handleEffSearchChange} />
                          {showEffSuggestions && (
                            <ul className="absolute z-50 w-full bg-white dark:bg-gray-700 border shadow-lg max-h-40 overflow-auto mt-1 rounded">
                              {effSuggestions.map(s => <li key={s.matricula} onClick={() => selectEffSoldier(s)} className="p-2 hover:bg-gray-100 cursor-pointer text-sm">{s.nome}</li>)}
                            </ul>
                          )}
                       </div>
                       <div className="md:col-span-2">
                          <label className="label">UBM</label>
                          <select className="input" value={newEffItem.ubm} onChange={(e) => setNewEffItem({...newEffItem, ubm: e.target.value})}>
                             {UBMS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                       </div>
                       <div className="md:col-span-2">
                          <label className="label">SITUAÇÃO</label>
                          <select className="input" value={newEffItem.status} onChange={(e) => setNewEffItem({...newEffItem, status: e.target.value})}>
                             <option value="P">PRESENTE</option>
                             <option value="F">FALTA</option>
                             <option value="D">DISPENSA</option>
                             <option value="P/A">PERMUTA</option>
                             <option value="A">ATRASO</option>
                          </select>
                       </div>
                       <div className="md:col-span-2">
                          <button onClick={addEffectiveItem} disabled={!newEffItem.soldier} className="bg-cbmpa-600 text-white w-full h-[42px] rounded font-bold disabled:opacity-50 text-xs uppercase flex items-center justify-center gap-1">
                             <Plus size={14} /> Adicionar Militar
                          </button>
                       </div>
                    </div>
                    {state.formData.reportEffectiveItems.length > 0 && (
                      <div className="overflow-x-auto">
                         <table className="w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-900 text-xs font-bold uppercase text-gray-600">
                               <tr>
                                  <th className="p-2 text-center">Cmt</th>
                                  <th className="p-2 text-left">Posto/Grad</th>
                                  <th className="p-2 text-left">Nome</th>
                                  <th className="p-2 text-center">UBM</th>
                                  <th className="p-2 text-center">Situação</th>
                                  <th className="p-2 text-center">Ação</th>
                               </tr>
                            </thead>
                            <tbody>
                               {state.formData.reportEffectiveItems.map(item => (
                                  <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700">
                                     <td className="p-2 text-center">
                                        <button onClick={() => initiateCommanderSelection(item.id, 'REPORT')} className={`p-1 rounded hover:bg-yellow-100 ${item.isCommander ? 'text-yellow-500' : 'text-gray-300'}`}>
                                           <Star size={16} fill={item.isCommander ? "currentColor" : "none"}/>
                                        </button>
                                     </td>
                                     <td className="p-2">{item.soldierRank}</td>
                                     <td className="p-2 font-medium">{item.soldierName}</td>
                                     <td className="p-2 text-center text-xs text-gray-500">{item.soldierUbm}</td>
                                     <td className="p-2 text-center font-bold">
                                        {item.status === 'P' && 'PRESENTE'}
                                        {item.status === 'F' && 'FALTA'}
                                        {item.status === 'D' && 'DISPENSA'}
                                        {item.status === 'P/A' && 'PERMUTA'}
                                        {item.status === 'A' && 'ATRASO'}
                                     </td>
                                     <td className="p-2 text-center">
                                          <button onClick={() => removeEffectiveItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                                     </td>
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                    )}
                 </div>

                 {/* 3. SERVICE / VICTIMS */}
                 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="section-title text-cbmpa-800">3. Alterações no Serviço (Vítimas/Ocorrências)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded items-end">
                       <div className="md:col-span-5">
                          <label className="label">NOME VÍTIMA</label>
                          <input type="text" className="input" value={newSvcItem.name || ''} onChange={(e) => setNewSvcItem({...newSvcItem, name: e.target.value})} />
                       </div>
                       <div className="md:col-span-2">
                          <label className="label">IDADE</label>
                          <input type="text" className="input" placeholder="Ex: 25" value={newSvcItem.age || ''} onChange={(e) => setNewSvcItem({...newSvcItem, age: e.target.value})} />
                       </div>
                       <div className="md:col-span-2">
                          <label className="label">SEXO</label>
                          <select className="input" value={newSvcItem.sex} onChange={(e) => setNewSvcItem({...newSvcItem, sex: e.target.value as any})}>
                             <option value="M">M</option>
                             <option value="F">F</option>
                          </select>
                       </div>
                       <div className="md:col-span-3">
                          <label className="label">ESTADO</label>
                          <select className="input" value={newSvcItem.condition} onChange={(e) => setNewSvcItem({...newSvcItem, condition: e.target.value as any})}>
                             <option value="ILS">ILESA</option>
                             <option value="FD">FERIDA</option>
                             <option value="FTL">FATAL</option>
                          </select>
                       </div>
                       <div className="md:col-span-12 flex gap-2">
                          <div className="flex-1">
                             <label className="label">CÓD</label>
                             <select className="input" value={newSvcItem.code} onChange={(e) => setNewSvcItem({...newSvcItem, code: e.target.value})}>
                                {OCCURRENCE_CODES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.desc}</option>)}
                             </select>
                          </div>
                          <button onClick={addServiceItem} className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded font-bold h-[42px] mt-5 flex items-center gap-2">
                             <Plus size={16}/> Adicionar Ocorrência
                          </button>
                       </div>
                    </div>
                    {state.formData.reportServiceItems.length > 0 && (
                       <table className="w-full text-sm">
                          <thead className="bg-gray-100 dark:bg-gray-900 text-xs font-bold uppercase text-gray-600">
                             <tr>
                                <th className="p-2 text-left">Nome</th>
                                <th className="p-2 text-center">Id/Sx</th>
                                <th className="p-2 text-center">Est</th>
                                <th className="p-2 text-center">Cód</th>
                                <th className="p-2 text-center">Ação</th>
                             </tr>
                          </thead>
                          <tbody>
                             {state.formData.reportServiceItems.map(item => (
                                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700">
                                   <td className="p-2">{item.name}</td>
                                   <td className="p-2 text-center">{item.age} / {item.sex}</td>
                                   <td className="p-2 text-center">{item.condition}</td>
                                   <td className="p-2 text-center font-bold">{item.code}</td>
                                   <td className="p-2 text-center"><button onClick={() => removeServiceItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button></td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    )}
                    
                    <div className="mt-4 text-[10px] text-gray-500 grid grid-cols-3 gap-1 bg-gray-50 p-2 rounded border border-gray-100">
                       {OCCURRENCE_CODES.map(c => <span key={c.code}>{c.code}-{c.desc}</span>)}
                    </div>
                 </div>

                 {/* 4. LOGISTICS */}
                 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                     <h3 className="section-title text-cbmpa-800">4. Apoio Logístico</h3>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {REPORT_LOGISTICS_ITEMS.filter(i => i !== 'OUTROS').map(item => (
                           <div key={item} 
                                onClick={() => toggleLogisticsItem(item)}
                                className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${state.formData.reportLogistics[item]?.used ? 'bg-cbmpa-50 border-cbmpa-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                           >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${state.formData.reportLogistics[item]?.used ? 'bg-cbmpa-600 border-cbmpa-600' : 'bg-white border-gray-400'}`}>
                                 {state.formData.reportLogistics[item]?.used && <Check size={12} className="text-white" />}
                              </div>
                              <span className="text-xs font-medium flex-1">{item}</span>
                              {state.formData.reportLogistics[item]?.used && (
                                 <input 
                                   type="text" 
                                   className="w-10 h-6 text-xs text-center border rounded"
                                   placeholder="Qtd"
                                   onClick={(e) => e.stopPropagation()}
                                   value={state.formData.reportLogistics[item]?.qty}
                                   onChange={(e) => updateLogisticsQty(item, e.target.value)}
                                 />
                              )}
                           </div>
                        ))}
                     </div>
                     <div className="mt-4">
                        <label className="label">OUTROS (ESPECIFICAR)</label>
                        <input type="text" className="input" value={state.formData.reportOtherLogistics} onChange={(e) => handleInputChange('reportOtherLogistics', e.target.value)} />
                     </div>
                 </div>

                 {/* 5. VEHICLES */}
                 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                     <h3 className="section-title text-cbmpa-800">5. Viaturas e Embarcações</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {REPORT_VEHICLE_ITEMS.map(item => (
                           <div key={item} 
                                className={`flex flex-col p-2 rounded border transition-all ${state.formData.reportVehicles[item]?.used ? 'bg-cbmpa-50 border-cbmpa-200' : 'bg-white border-gray-200'}`}
                           >
                              <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleVehicleItem(item)}>
                                 <div className={`w-4 h-4 rounded border flex items-center justify-center ${state.formData.reportVehicles[item]?.used ? 'bg-cbmpa-600 border-cbmpa-600' : 'bg-white border-gray-400'}`}>
                                    {state.formData.reportVehicles[item]?.used && <Check size={12} className="text-white" />}
                                 </div>
                                 <span className="text-xs font-bold">{item}</span>
                              </div>
                              
                              {state.formData.reportVehicles[item]?.used && (
                                 <div className="flex gap-2 mt-2 pl-6">
                                    <input 
                                       type="text" 
                                       className="w-16 h-7 text-xs border rounded px-2"
                                       placeholder="Qtd"
                                       value={state.formData.reportVehicles[item]?.qty}
                                       onChange={(e) => updateVehicleQty(item, 'qty', e.target.value)}
                                    />
                                    <input 
                                       type="text" 
                                       className="flex-1 h-7 text-xs border rounded px-2"
                                       placeholder="Origem (Ex: 1º GBM)"
                                       value={state.formData.reportVehicles[item]?.origin}
                                       onChange={(e) => updateVehicleQty(item, 'origin', e.target.value)}
                                    />
                                 </div>
                              )}
                           </div>
                        ))}
                     </div>
                     <div className="mt-4">
                        <label className="label">OUTRAS (ESPECIFICAR)</label>
                        <input type="text" className="input" value={state.formData.reportOtherVehicles} onChange={(e) => handleInputChange('reportOtherVehicles', e.target.value)} />
                     </div>
                 </div>

                 {/* 6. CONSIDERATIONS */}
                 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="section-title text-cbmpa-800">6. Considerações do Serviço</h3>
                    
                    <div className="space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                             <div className="flex items-center justify-between mb-2">
                                <label className="label">PONTOS POSITIVOS:</label>
                                <div className="flex gap-1">
                                   <button 
                                      onClick={() => setState(prev => ({...prev, formData: {...prev.formData, reportPositive: {...prev.formData.reportPositive, has: true}}}))}
                                      className={`px-3 py-1 text-xs font-bold rounded ${state.formData.reportPositive.has ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                                   >SIM</button>
                                   <button 
                                      onClick={() => setState(prev => ({...prev, formData: {...prev.formData, reportPositive: {...prev.formData.reportPositive, has: false}}}))}
                                      className={`px-3 py-1 text-xs font-bold rounded ${!state.formData.reportPositive.has ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}
                                   >NÃO</button>
                                </div>
                             </div>
                             <input 
                                type="text" 
                                className="input" 
                                placeholder="Quais?"
                                disabled={!state.formData.reportPositive.has}
                                value={state.formData.reportPositive.text}
                                onChange={(e) => setState(prev => ({...prev, formData: {...prev.formData, reportPositive: {...prev.formData.reportPositive, text: e.target.value}}}))}
                             />
                          </div>
                          
                          <div>
                             <div className="flex items-center justify-between mb-2">
                                <label className="label">PONTOS NEGATIVOS:</label>
                                <div className="flex gap-1">
                                   <button 
                                      onClick={() => setState(prev => ({...prev, formData: {...prev.formData, reportNegative: {...prev.formData.reportNegative, has: true}}}))}
                                      className={`px-3 py-1 text-xs font-bold rounded ${state.formData.reportNegative.has ? 'bg-gray-600 text-white' : 'bg-gray-200'}`} // Negative logic usually red, but screenshot implies simple toggle
                                   >SIM</button>
                                   <button 
                                      onClick={() => setState(prev => ({...prev, formData: {...prev.formData, reportNegative: {...prev.formData.reportNegative, has: false}}}))}
                                      className={`px-3 py-1 text-xs font-bold rounded ${!state.formData.reportNegative.has ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
                                   >NÃO</button>
                                </div>
                             </div>
                             <input 
                                type="text" 
                                className="input" 
                                placeholder="Quais?"
                                disabled={!state.formData.reportNegative.has}
                                value={state.formData.reportNegative.text}
                                onChange={(e) => setState(prev => ({...prev, formData: {...prev.formData, reportNegative: {...prev.formData.reportNegative, text: e.target.value}}}))}
                             />
                          </div>
                       </div>
                       
                       <div>
                          <label className="label">QUADRO DE ATIVIDADES SERVIÇO</label>
                          <textarea className="input h-20" value={state.formData.reportActivities} onChange={(e) => handleInputChange('reportActivities', e.target.value)} />
                       </div>
                       
                       <div>
                          <label className="label">SERVIÇOS DE PREVENTIVO DE ORIENTAÇÃO E ADVERTÊNCIA</label>
                          <input type="text" className="input" value={state.formData.reportGuidance} onChange={(e) => handleInputChange('reportGuidance', e.target.value)} />
                       </div>
                       
                       <div>
                          <label className="label">DISTRIBUIÇÃO DO EFETIVO</label>
                          <input type="text" className="input" value={state.formData.reportDistribution} onChange={(e) => handleInputChange('reportDistribution', e.target.value)} />
                       </div>

                       <div>
                          <label className="label">SUGESTÕES</label>
                          <input type="text" className="input" value={state.formData.reportSuggestions} onChange={(e) => handleInputChange('reportSuggestions', e.target.value)} />
                       </div>
                    </div>
                 </div>

                 {/* 7. FINAL CONSIDERATIONS */}
                 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="section-title text-cbmpa-800">7. Considerações Finais</h3>
                    <div>
                       <textarea 
                          className="input h-24" 
                          placeholder="Considerações finais do relatório..."
                          value={state.formData.reportFinalConsiderations} 
                          onChange={(e) => handleInputChange('reportFinalConsiderations', e.target.value)} 
                       />
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Actions */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-3">
           <button 
             onClick={() => generatePDF(state)}
             className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 group z-50"
             title="Gerar PDF"
           >
             <Download size={24} />
             <span className="absolute right-full mr-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                Baixar PDF
             </span>
           </button>
        </div>

      </main>
    </div>
  );
};
export default App;
