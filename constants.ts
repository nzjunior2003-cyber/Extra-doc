
export const RANKS = [
  "SD QBM",
  "CB QBM",
  "3º SGT QBM",
  "2º SGT QBM",
  "1º SGT QBM",
  "ST QBM",
  "2º TEN QOBM",
  "2º TEN QOABM",
  "1º TEN QOBM",
  "1º TEN QOABM",
  "CAP QOBM",
  "CAP QOABM",
  "MAJ QOBM",
  "MAJ QOABM",
  "TCEL QOBM",
  "TCEL QOCBM",
  "TCEL QOSBM",
  "CEL QOBM",
  "CEL QOCBM",
  "CEL QOSBM",
  "AL CFP",   // Added to support students in CSV
  "AL OF BM"  // Added to support cadets in CSV
];

export const UBMS = [
  "1º GBM", "2º GBM", "3º GBM", "4º GBM", "5º GBM", "6º GBM", "7º GBM", "8º GBM", "9º GBM", "10º GBM",
  "11º GBM", "12º GBM", "13º GBM", "14º GBM", "15º GBM", "16º GBM", "17º GBM", "18º GBM", "19º GBM", "20º GBM",
  "21º GBM", "22º GBM", "23º GBM", "24º GBM", "25º GBM", "26º GBM", "27º GBM", "28º GBM", "29º GBM", "30º GBM",
  "31º GBM", "32º GBM", "33º GBM",
  "1º GPA",
  "1º GMAF",
  "1º GBS",
  "1º GSE",
  "CFAE",
  "ABM",
  "CSMV/MOP",
  "CAT",
  "COP",
  "QCG"
];

// Value per day/service from the screenshot (R$ 217,16)
export const UNIT_VALUE_DEFAULT = 217.16;

// Link para exportar a planilha como CSV
export const EXTERNAL_DB_URL = "https://docs.google.com/spreadsheets/d/1Ja9mQVJ4KWkFtjNBjuoSONnKoj2GIT7ltUYAByLetrg/export?format=csv";

export const MEMO_LEGAL_TEXT = `De acordo com que preceitua a Lei 6.830/2006 c/c a Lei 8.604/2018 e com as normas relativas ao serviço de prevenção prevista no Decreto nº 1.052/2020 (NSAPO), remeto a V.Sª os documentos constante em anexo, a fim de que seja autorizado o pagamento de Jornada Operacional Extraordinária aos Militares envolvidos na prevenção realizada {{DATA}} - conforme NS {{NS}} – SEOP/COP, aprovada e publicada no BG nº {{BG}} que seguem em anexo.`;

export const REPORT_LOGISTICS_ITEMS = [
  "RÁDIO", "RAÇÃO FRIA", 
  "LUVA DE SALV./INCEND.", "AP. RESP. AUT. (PA)",
  "CAPA DE CHUVA", "DESENCARCERADOR",
  "EXTINTOR", "MOTOR GERADOR",
  "AFT (LGE)", "MINI RETÍFICA",
  "CAPACETE SALV.", "SERRA SABRE",
  "CORDA", "SKED",
  "LANTERNA", "PRANCHA RÍGIDA",
  "CORTA FRIO", "ESCADA",
  "MOTOSSERRA", "TRIPÉ",
  "MOTO ESMERIL", "KED",
  "MOCHILA DE APH", "TORRE DE ILUMINAÇÃO",
  "MOSQUETÃO/MOLA", "OUTROS"
];

export const REPORT_VEHICLE_ITEMS = [
  "INCÊNDIO",
  "SALVAMENTO",
  "RESGATE",
  "CAMINHÃO",
  "DRONE",
  "HELICÓPTERO",
  "MOTORESGATE",
  "MOTOINCÊNDIO",
  "VTR SUP. DIA",
  "VTR OF. ÁREA",
  "ÔNIBUS/MICRO-ÔNIBUS",
  "EMBARCAÇÃO"
];

export const OCCURRENCE_CODES = [
  { code: 1, desc: "ESCORIAÇÃO" },
  { code: 2, desc: "CRIANÇA ECONTRADA" },
  { code: 3, desc: "PESSOA FERIDA" },
  { code: 4, desc: "PESSOA ALCOOLIZADA" },
  { code: 5, desc: "MAL SÚBITO" },
  { code: 6, desc: "CURATIVOS" },
  { code: 7, desc: "CEFALÉIA" },
  { code: 8, desc: "TRANSP. DE EMERGÊNCIAS" },
  { code: 9, desc: "INSOLAÇÃO" },
  { code: 10, desc: "HEMORRAGIAS" },
  { code: 11, desc: "CARDIORESPIRATÓRIO" },
  { code: 12, desc: "ACID. COM OBJ. PERFUROCORTANTE" },
  { code: 13, desc: "FRATURA / LUXAÇÃO/ENRTORSE" },
  { code: 14, desc: "LESÃO POR ARMA BRANCA" },
  { code: 15, desc: "LESÃO POR ARMA DE FOGO" },
  { code: 16, desc: "BUSCAS" },
  { code: 17, desc: "CONTENÇÃO DE PAC. PSIQUIÁTRICO" },
  { code: 18, desc: "AFOGAMENTO (ESPECIFICAR O GRAU)" },
  { code: 19, desc: "ACIDENTE COM ANIMAIS" },
  { code: 20, desc: "OUTROS" }
];
