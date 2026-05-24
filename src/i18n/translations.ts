export type Language = 'it' | 'en' | 'es' | 'fr' | 'de';

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

export type Strings = {
  // Tabs
  tabGenerate: string;
  tabModules: string;
  tabSettings: string;

  // Generate screen
  heroLine1: string;
  heroLine2: string;
  heroSub: string;
  placeholder: string;
  charCount: (n: number) => string;
  errorEmpty: string;
  btnGenerate: string;
  btnGenerating: string;
  successTitle: string;
  successHint: string;
  examples: string[];

  // Modules screen
  modulesTitle: string;
  emptyTitle: string;
  emptyText: (accentLabel: string) => string;
  openModule: string;
  deleteModuleTitle: string;
  deleteConfirmMsg: (name: string) => string;
  cancel: string;
  deleteConfirm: string;
  dateLocale: string;

  // Settings screen
  settingsTitle: string;
  sectionMode: string;
  mockLabel: string;
  mockHint: string;
  sectionProvider: string;
  providerOllamaHint: string;
  providerOpenAiHint: string;
  providerClaudeHint: string;
  sectionOllama: string;
  ollamaUrlLabel: string;
  ollamaUrlPlaceholder: string;
  ollamaUrlHint: string;
  ollamaModelLabel: string;
  ollamaModelHint: string;
  sectionOpenAi: string;
  openAiUrlLabel: string;
  sectionClaude: string;
  claudeUrlLabel: string;
  claudeUrlHint: string;
  claudeKeyLabel: string;
  claudeModelLabel: string;
  providerLocalHint: string;
  sectionLocalModel: string;
  localModelManage: string;
  localModelNone: string;
  localModelAndroidOnly: string;
  sectionInfo: string;
  appVersionLabel: string;
  securityNotice: string;
  sectionLanguage: string;
  langAuto: string;

  // Module screen
  moduleNotFound: string;
  moduleNotFoundSub: string;
  backToModules: string;

  // Permission gate
  permTitle: string;
  permBody: (perms: string) => string;
  permNotice: string;
  permRequesting: string;
  permAllow: string;
  permDeny: string;

  // Generating modal
  genModalBuilding: string;
  genModalDone: string;
  genStep1: string;
  genStep2: string;
  genStep3: string;
  genHint: string;
  genStepPending: string;
  genStepActive: string;
  genStepDone: string;

  // Human-readable error messages (function receives raw error string)
  humanizeError: (raw: string) => string;

  // Style editor
  styleEditorTitle: string;
  styleEditorColors: string;
  styleEditorTexts: string;
  styleEditorSave: string;
  styleEditorApply: string;
  styleEditorNoEditable: string;

  // Regenerate sheet
  regenBtn: string;
  regenSheetTitle: string;
  regenOriginalLabel: string;
  regenTweakLabel: string;
  regenTweakPlaceholder: string;
  regenSuccess: string;

  // Renderer
  rendererError: string;
  rendererRootError: string;
  back: string;
};

const it: Strings = {
  tabGenerate: 'Genera',
  tabModules: 'Moduli',
  tabSettings: 'Impostazioni',

  heroLine1: 'Crea il tuo',
  heroLine2: 'modulo',
  heroSub: 'Descrivi in linguaggio naturale. Il resto lo fa l\'intelligenza artificiale.',
  placeholder: 'Es: una calcolatrice con storico delle operazioni…',
  charCount: (n) => `${n} car.`,
  errorEmpty: 'Descrivi il modulo che vuoi generare.',
  btnGenerate: 'Genera modulo',
  btnGenerating: 'Generazione in corso…',
  successTitle: 'Modulo generato!',
  successHint: 'Aprilo dalla tab Moduli.',
  examples: [
    'Crea un app che scatta una foto e la mostra sullo schermo',
    'Crea un gioco come Flappy, con un personaggio che salta quando tocco lo schermo, ostacoli e punteggio',
    'Crea un app per sopralluoghi: scatta una foto, salva GPS, aggiungi note e mostra un riepilogo',
  ],

  modulesTitle: 'I tuoi moduli',
  emptyTitle: 'Nessun modulo ancora',
  emptyText: (accent) => `Vai nella tab ${accent} per creare il tuo primo modulo con l'AI.`,
  openModule: 'Apri modulo',
  deleteModuleTitle: 'Elimina modulo',
  deleteConfirmMsg: (name) => `Vuoi eliminare "${name}"? L'operazione è irreversibile.`,
  cancel: 'Annulla',
  deleteConfirm: 'Elimina',
  dateLocale: 'it-IT',

  settingsTitle: 'Impostazioni',
  sectionMode: 'Modalità',
  mockLabel: 'Mock offline',
  mockHint: 'Genera moduli di esempio senza un server AI',
  sectionProvider: 'Provider AI',
  providerOllamaHint: 'Server AI locale sul tuo PC',
  providerOpenAiHint: 'Compatibile con API OpenAI-standard',
  providerClaudeHint: 'Anthropic Messages API',
  sectionOllama: 'Configurazione Ollama',
  ollamaUrlLabel: 'URL base',
  ollamaUrlPlaceholder: 'http://localhost:11434',
  ollamaUrlHint: 'Telefono reale: usa l\'IP del Mac/PC, es. http://192.168.1.x:11434 · Emulatore Android: http://10.0.2.2:11434',
  ollamaModelLabel: 'Modello',
  ollamaModelHint: 'Deve corrispondere a un modello in `ollama list`',
  sectionOpenAi: 'Configurazione OpenAI API',
  openAiUrlLabel: 'URL Chat completions',
  sectionClaude: 'Configurazione Claude API',
  claudeUrlLabel: 'Base URL',
  claudeUrlHint: 'Verrà usato l\'endpoint /messages',
  claudeKeyLabel: 'API key',
  claudeModelLabel: 'Modello',
  providerLocalHint: 'LLM direttamente sul dispositivo Android (LiteRT-LM)',
  sectionLocalModel: 'Modello locale',
  localModelManage: 'Gestisci modelli →',
  localModelNone: 'Nessun modello caricato',
  localModelAndroidOnly: 'Disponibile solo su Android',
  sectionInfo: 'Informazioni',
  appVersionLabel: 'Versione app',
  securityNotice: 'Il codice dei moduli è validato e gira in ambiente controllato. Nessun accesso diretto a rete, storage o hardware senza il tuo consenso esplicito.',
  sectionLanguage: 'Lingua',
  langAuto: 'Automatica',

  moduleNotFound: 'Modulo non trovato.',
  moduleNotFoundSub: 'Potrebbe essere stato eliminato.',
  backToModules: 'Moduli',

  permTitle: 'Permessi richiesti',
  permBody: (perms) => `Questo modulo richiede accesso a: ${perms}.`,
  permNotice: 'L\'accesso avviene tramite le API controllate di AppFromAI. Nessun permesso diretto al sistema senza il tuo consenso.',
  permRequesting: 'Richiesta permessi al sistema…',
  permAllow: 'Consenti e apri',
  permDeny: 'Nega accesso',

  genModalBuilding: 'Stiamo costruendo la tua app…',
  genModalDone: 'App creata!',
  genStep1: 'Invio al modello',
  genStep2: 'Elaborazione',
  genStep3: 'Creazione',
  genHint: 'Questo può richiedere 10–60 secondi a seconda del modello',
  genStepPending: 'in attesa',
  genStepActive: 'in corso…',
  genStepDone: 'fatto',
  humanizeError: (raw) => {
    if (/kv.?cache|kv cache/i.test(raw))
      return 'Il modello è sovraccarico: la richiesta è troppo lunga. Prova a descrivere l\'app in modo più breve.';
    if (/HTTP 401|invalid.{0,20}api.{0,10}key|api.{0,10}key.{0,10}invalid|authentication/i.test(raw))
      return 'API key non valida. Controlla la chiave nelle Impostazioni → provider.';
    if (/HTTP 429|rate.?limit|quota/i.test(raw))
      return 'Troppe richieste in poco tempo. Aspetta qualche secondo e riprova.';
    if (/HTTP 5\d\d|internal server|bad gateway/i.test(raw))
      return 'Il server AI ha avuto un problema temporaneo. Riprova tra qualche secondo.';
    if (/ECONNREFUSED|ERR_NETWORK|Network Error|impossibile contattare|connection refused/i.test(raw))
      return 'Impossibile raggiungere il server AI. Controlla la connessione e l\'URL nelle Impostazioni.';
    if (/timeout|timed out/i.test(raw))
      return 'Il modello ha impiegato troppo tempo. Prova con una richiesta più semplice o riprova tra poco.';
    if (/modulo non valido|validazione schema/i.test(raw))
      return 'Il modello non ha generato un\'app valida. Riprova riformulando la richiesta.';
    if (/json|JSON/i.test(raw))
      return 'Il modello ha risposto in modo non leggibile. Riprova — di solito funziona al secondo tentativo.';
    if (/compilazione|JavaScript.*non valido|compile/i.test(raw))
      return 'Il codice generato non è valido. Prova con una descrizione più semplice.';
    if (/vuota|vuoto|empty/i.test(raw))
      return 'Il modello ha risposto con un messaggio vuoto. Riprova.';
    if (/URL.*non valido|url.{0,10}invalid/i.test(raw))
      return 'L\'URL del server non è valido. Controlla le Impostazioni.';
    if (/inserisci.*api.*key|api key.*mancante/i.test(raw))
      return 'Manca la API key. Aggiungila nelle Impostazioni.';
    const trimmed = raw.replace(/\s*\(prime \d+ char\).*$/s, '').trim();
    return trimmed.length > 180 ? trimmed.slice(0, 177) + '…' : trimmed;
  },

  styleEditorTitle: 'Modifica stile',
  styleEditorColors: 'COLORI',
  styleEditorTexts: 'TESTI',
  styleEditorSave: 'Salva modifiche',
  styleEditorApply: 'Applica',
  styleEditorNoEditable: 'Nessun elemento modificabile trovato in questo modulo.',

  regenBtn: 'Rigenera',
  regenSheetTitle: 'Rigenera modulo',
  regenOriginalLabel: 'Prompt originale',
  regenTweakLabel: 'Accorgimenti (opzionale)',
  regenTweakPlaceholder: 'Es: aggiungi un timer, cambia i colori, aumenta la velocità…',
  regenSuccess: 'Modulo aggiornato!',

  rendererError: 'Modulo non caricabile',
  rendererRootError: 'La radice UI deve essere screen o navigator.',
  back: 'Indietro',
};

const en: Strings = {
  tabGenerate: 'Generate',
  tabModules: 'Modules',
  tabSettings: 'Settings',

  heroLine1: 'Create your',
  heroLine2: 'module',
  heroSub: 'Describe it in plain language. AI does the rest.',
  placeholder: 'E.g.: a calculator with operation history…',
  charCount: (n) => `${n} chr.`,
  errorEmpty: 'Describe the module you want to generate.',
  btnGenerate: 'Generate module',
  btnGenerating: 'Generating…',
  successTitle: 'Module generated!',
  successHint: 'Open it from the Modules tab.',
  examples: [
    'Create an app that takes a photo and shows it on screen',
    'Create a Flappy-like game where the character jumps on tap, with obstacles and score',
    'Create a site survey app: take a photo, save GPS, add notes and show a summary',
  ],

  modulesTitle: 'Your modules',
  emptyTitle: 'No modules yet',
  emptyText: (accent) => `Go to the ${accent} tab to create your first AI module.`,
  openModule: 'Open module',
  deleteModuleTitle: 'Delete module',
  deleteConfirmMsg: (name) => `Delete "${name}"? This action cannot be undone.`,
  cancel: 'Cancel',
  deleteConfirm: 'Delete',
  dateLocale: 'en-GB',

  settingsTitle: 'Settings',
  sectionMode: 'Mode',
  mockLabel: 'Offline mock',
  mockHint: 'Generate sample modules without an AI server',
  sectionProvider: 'AI Provider',
  providerOllamaHint: 'Local AI server on your PC',
  providerOpenAiHint: 'Compatible with OpenAI-standard API',
  providerClaudeHint: 'Anthropic Messages API',
  sectionOllama: 'Ollama Configuration',
  ollamaUrlLabel: 'Base URL',
  ollamaUrlPlaceholder: 'http://localhost:11434',
  ollamaUrlHint: 'Real device: use your Mac/PC IP, e.g. http://192.168.1.x:11434 · Android emulator: http://10.0.2.2:11434',
  ollamaModelLabel: 'Model',
  ollamaModelHint: 'Must match a model shown in `ollama list`',
  sectionOpenAi: 'OpenAI API Configuration',
  openAiUrlLabel: 'Chat completions URL',
  sectionClaude: 'Claude API Configuration',
  claudeUrlLabel: 'Base URL',
  claudeUrlHint: 'The /messages endpoint will be used',
  claudeKeyLabel: 'API key',
  claudeModelLabel: 'Model',
  providerLocalHint: 'LLM directly on-device, Android (LiteRT-LM)',
  sectionLocalModel: 'Local model',
  localModelManage: 'Manage models →',
  localModelNone: 'No model loaded',
  localModelAndroidOnly: 'Available on Android only',
  sectionInfo: 'Information',
  appVersionLabel: 'App version',
  securityNotice: 'Module code is validated and runs in a controlled environment. No direct access to network, storage or hardware without your explicit consent.',
  sectionLanguage: 'Language',
  langAuto: 'Automatic',

  moduleNotFound: 'Module not found.',
  moduleNotFoundSub: 'It may have been deleted.',
  backToModules: 'Modules',

  permTitle: 'Permissions required',
  permBody: (perms) => `This module requires access to: ${perms}.`,
  permNotice: 'Access is handled through the controlled APIs of AppFromAI. No direct system permission without your consent.',
  permRequesting: 'Requesting system permissions…',
  permAllow: 'Allow and open',
  permDeny: 'Deny access',

  genModalBuilding: 'Building your app…',
  genModalDone: 'App created!',
  genStep1: 'Sending to model',
  genStep2: 'Processing',
  genStep3: 'Creating',
  genHint: 'This may take 10–60 seconds depending on the model',
  genStepPending: 'waiting',
  genStepActive: 'in progress…',
  genStepDone: 'done',
  humanizeError: (raw) => {
    if (/kv.?cache|kv cache/i.test(raw))
      return 'The model is overloaded: the request is too long. Try describing the app more briefly.';
    if (/HTTP 401|invalid.{0,20}api.{0,10}key|api.{0,10}key.{0,10}invalid|authentication/i.test(raw))
      return 'Invalid API key. Check the key in Settings → provider.';
    if (/HTTP 429|rate.?limit|quota/i.test(raw))
      return 'Too many requests. Wait a few seconds and try again.';
    if (/HTTP 5\d\d|internal server|bad gateway/i.test(raw))
      return 'The AI server had a temporary issue. Try again in a few seconds.';
    if (/ECONNREFUSED|ERR_NETWORK|Network Error|connection refused/i.test(raw))
      return 'Cannot reach the AI server. Check your connection and the URL in Settings.';
    if (/timeout|timed out/i.test(raw))
      return 'The model took too long. Try a simpler request or retry shortly.';
    if (/modulo non valido|validazione schema/i.test(raw))
      return 'The model did not generate a valid app. Try rephrasing the request.';
    if (/json|JSON/i.test(raw))
      return 'The model responded in an unreadable format. Retry — it usually works on the second try.';
    if (/compilazione|JavaScript.*non valido|compile/i.test(raw))
      return 'The generated code is not valid. Try a simpler description.';
    if (/empty/i.test(raw))
      return 'The model returned an empty response. Please retry.';
    if (/URL.*non valido|url.{0,10}invalid/i.test(raw))
      return 'The server URL is invalid. Check Settings.';
    if (/inserisci.*api.*key|api key.*mancante/i.test(raw))
      return 'API key is missing. Add it in Settings.';
    const trimmed = raw.replace(/\s*\(prime \d+ char\).*$/s, '').trim();
    return trimmed.length > 180 ? trimmed.slice(0, 177) + '…' : trimmed;
  },

  styleEditorTitle: 'Edit style',
  styleEditorColors: 'COLOURS',
  styleEditorTexts: 'TEXTS',
  styleEditorSave: 'Save changes',
  styleEditorApply: 'Apply',
  styleEditorNoEditable: 'No editable elements found in this module.',

  regenBtn: 'Regenerate',
  regenSheetTitle: 'Regenerate module',
  regenOriginalLabel: 'Original prompt',
  regenTweakLabel: 'Tweaks (optional)',
  regenTweakPlaceholder: 'E.g.: add a timer, change colours, increase speed…',
  regenSuccess: 'Module updated!',

  rendererError: 'Module could not load',
  rendererRootError: 'UI root must be screen or navigator.',
  back: 'Back',
};

const es: Strings = {
  tabGenerate: 'Generar',
  tabModules: 'Módulos',
  tabSettings: 'Ajustes',

  heroLine1: 'Crea tu',
  heroLine2: 'módulo',
  heroSub: 'Descríbelo en lenguaje natural. La IA hace el resto.',
  placeholder: 'Ej: una calculadora con historial de operaciones…',
  charCount: (n) => `${n} car.`,
  errorEmpty: 'Describe el módulo que quieres generar.',
  btnGenerate: 'Generar módulo',
  btnGenerating: 'Generando…',
  successTitle: '¡Módulo generado!',
  successHint: 'Ábrelo desde la pestaña Módulos.',
  examples: [
    'Crea una app que tome una foto y la muestre en pantalla',
    'Crea un juego tipo Flappy, el personaje salta al tocar, con obstáculos y puntuación',
    'Crea una app de inspección: toma foto, guarda GPS, añade notas y muestra resumen',
  ],

  modulesTitle: 'Tus módulos',
  emptyTitle: 'Sin módulos todavía',
  emptyText: (accent) => `Ve a la pestaña ${accent} para crear tu primer módulo con IA.`,
  openModule: 'Abrir módulo',
  deleteModuleTitle: 'Eliminar módulo',
  deleteConfirmMsg: (name) => `¿Eliminar "${name}"? Esta acción no se puede deshacer.`,
  cancel: 'Cancelar',
  deleteConfirm: 'Eliminar',
  dateLocale: 'es-ES',

  settingsTitle: 'Ajustes',
  sectionMode: 'Modo',
  mockLabel: 'Mock sin conexión',
  mockHint: 'Genera módulos de ejemplo sin servidor de IA',
  sectionProvider: 'Proveedor IA',
  providerOllamaHint: 'Servidor de IA local en tu PC',
  providerOpenAiHint: 'Compatible con API estándar de OpenAI',
  providerClaudeHint: 'API Mensajes de Anthropic',
  sectionOllama: 'Configuración Ollama',
  ollamaUrlLabel: 'URL base',
  ollamaUrlPlaceholder: 'http://localhost:11434',
  ollamaUrlHint: 'Dispositivo real: usa la IP de tu Mac/PC, ej. http://192.168.1.x:11434 · Emulador Android: http://10.0.2.2:11434',
  ollamaModelLabel: 'Modelo',
  ollamaModelHint: 'Debe coincidir con un modelo en `ollama list`',
  sectionOpenAi: 'Configuración API OpenAI',
  openAiUrlLabel: 'URL Chat completions',
  sectionClaude: 'Configuración API Claude',
  claudeUrlLabel: 'URL base',
  claudeUrlHint: 'Se usará el endpoint /messages',
  claudeKeyLabel: 'Clave API',
  claudeModelLabel: 'Modelo',
  providerLocalHint: 'LLM directamente en el dispositivo Android (LiteRT-LM)',
  sectionLocalModel: 'Modelo local',
  localModelManage: 'Gestionar modelos →',
  localModelNone: 'Ningún modelo cargado',
  localModelAndroidOnly: 'Disponible solo en Android',
  sectionInfo: 'Información',
  appVersionLabel: 'Versión de la app',
  securityNotice: 'El código de los módulos es validado y se ejecuta en entorno controlado. Sin acceso directo a red, almacenamiento o hardware sin tu consentimiento.',
  sectionLanguage: 'Idioma',
  langAuto: 'Automático',

  moduleNotFound: 'Módulo no encontrado.',
  moduleNotFoundSub: 'Es posible que haya sido eliminado.',
  backToModules: 'Módulos',

  permTitle: 'Permisos requeridos',
  permBody: (perms) => `Este módulo requiere acceso a: ${perms}.`,
  permNotice: 'El acceso se gestiona a través de las APIs controladas de AppFromAI. Ningún permiso directo al sistema sin tu consentimiento.',
  permRequesting: 'Solicitando permisos al sistema…',
  permAllow: 'Permitir y abrir',
  permDeny: 'Denegar acceso',

  genModalBuilding: 'Construyendo tu app…',
  genModalDone: '¡App creada!',
  genStep1: 'Enviando al modelo',
  genStep2: 'Procesamiento',
  genStep3: 'Creación',
  genHint: 'Esto puede tardar 10–60 segundos según el modelo',
  genStepPending: 'en espera',
  genStepActive: 'en curso…',
  genStepDone: 'hecho',
  humanizeError: (raw) => {
    if (/kv.?cache|kv cache/i.test(raw))
      return 'El modelo está sobrecargado: la solicitud es demasiado larga. Intenta describir la app más brevemente.';
    if (/HTTP 401|invalid.{0,20}api.{0,10}key|api.{0,10}key.{0,10}invalid|authentication/i.test(raw))
      return 'Clave API no válida. Revísala en Ajustes → proveedor.';
    if (/HTTP 429|rate.?limit|quota/i.test(raw))
      return 'Demasiadas solicitudes. Espera unos segundos y vuelve a intentarlo.';
    if (/HTTP 5\d\d|internal server|bad gateway/i.test(raw))
      return 'El servidor de IA tuvo un problema temporal. Inténtalo de nuevo en unos segundos.';
    if (/ECONNREFUSED|ERR_NETWORK|Network Error|connection refused/i.test(raw))
      return 'No se puede conectar con el servidor de IA. Revisa la conexión y la URL en Ajustes.';
    if (/timeout|timed out/i.test(raw))
      return 'El modelo tardó demasiado. Prueba con una solicitud más simple o inténtalo de nuevo.';
    if (/modulo non valido|validazione schema/i.test(raw))
      return 'El modelo no generó una app válida. Reformula la solicitud.';
    if (/json|JSON/i.test(raw))
      return 'El modelo respondió en un formato ilegible. Reintenta — normalmente funciona al segundo intento.';
    if (/compilazione|JavaScript.*non valido|compile/i.test(raw))
      return 'El código generado no es válido. Prueba con una descripción más simple.';
    if (/empty/i.test(raw))
      return 'El modelo respondió con un mensaje vacío. Inténtalo de nuevo.';
    if (/URL.*non valido|url.{0,10}invalid/i.test(raw))
      return 'La URL del servidor no es válida. Revisa los Ajustes.';
    if (/inserisci.*api.*key|api key.*mancante/i.test(raw))
      return 'Falta la clave API. Añádela en Ajustes.';
    const trimmed = raw.replace(/\s*\(prime \d+ char\).*$/s, '').trim();
    return trimmed.length > 180 ? trimmed.slice(0, 177) + '…' : trimmed;
  },

  styleEditorTitle: 'Editar estilo',
  styleEditorColors: 'COLORES',
  styleEditorTexts: 'TEXTOS',
  styleEditorSave: 'Guardar cambios',
  styleEditorApply: 'Aplicar',
  styleEditorNoEditable: 'No se encontraron elementos editables en este módulo.',

  regenBtn: 'Regenerar',
  regenSheetTitle: 'Regenerar módulo',
  regenOriginalLabel: 'Prompt original',
  regenTweakLabel: 'Ajustes (opcional)',
  regenTweakPlaceholder: 'Ej: añade un temporizador, cambia los colores, aumenta la velocidad…',
  regenSuccess: '¡Módulo actualizado!',

  rendererError: 'El módulo no pudo cargarse',
  rendererRootError: 'La raíz de la UI debe ser screen o navigator.',
  back: 'Atrás',
};

const fr: Strings = {
  tabGenerate: 'Générer',
  tabModules: 'Modules',
  tabSettings: 'Réglages',

  heroLine1: 'Crée ton',
  heroLine2: 'module',
  heroSub: 'Décris-le en langage naturel. L\'IA fait le reste.',
  placeholder: 'Ex : une calculatrice avec historique des opérations…',
  charCount: (n) => `${n} car.`,
  errorEmpty: 'Décris le module que tu veux générer.',
  btnGenerate: 'Générer le module',
  btnGenerating: 'Génération en cours…',
  successTitle: 'Module généré !',
  successHint: 'Ouvre-le depuis l\'onglet Modules.',
  examples: [
    'Crée une app qui prend une photo et l\'affiche à l\'écran',
    'Crée un jeu type Flappy, le personnage saute au toucher, avec obstacles et score',
    'Crée une app d\'inspection : photo, GPS, notes et résumé',
  ],

  modulesTitle: 'Tes modules',
  emptyTitle: 'Aucun module encore',
  emptyText: (accent) => `Va dans l'onglet ${accent} pour créer ton premier module avec l'IA.`,
  openModule: 'Ouvrir le module',
  deleteModuleTitle: 'Supprimer le module',
  deleteConfirmMsg: (name) => `Supprimer "${name}" ? Cette action est irréversible.`,
  cancel: 'Annuler',
  deleteConfirm: 'Supprimer',
  dateLocale: 'fr-FR',

  settingsTitle: 'Réglages',
  sectionMode: 'Mode',
  mockLabel: 'Mock hors ligne',
  mockHint: 'Génère des modules exemples sans serveur IA',
  sectionProvider: 'Fournisseur IA',
  providerOllamaHint: 'Serveur IA local sur ton PC',
  providerOpenAiHint: 'Compatible avec l\'API standard OpenAI',
  providerClaudeHint: 'API Messages d\'Anthropic',
  sectionOllama: 'Configuration Ollama',
  ollamaUrlLabel: 'URL de base',
  ollamaUrlPlaceholder: 'http://localhost:11434',
  ollamaUrlHint: 'Appareil réel : utilise l\'IP du Mac/PC, ex. http://192.168.1.x:11434 · Émulateur Android : http://10.0.2.2:11434',
  ollamaModelLabel: 'Modèle',
  ollamaModelHint: 'Doit correspondre à un modèle dans `ollama list`',
  sectionOpenAi: 'Configuration API OpenAI',
  openAiUrlLabel: 'URL Chat completions',
  sectionClaude: 'Configuration API Claude',
  claudeUrlLabel: 'URL de base',
  claudeUrlHint: 'L\'endpoint /messages sera utilisé',
  claudeKeyLabel: 'Clé API',
  claudeModelLabel: 'Modèle',
  providerLocalHint: 'LLM directement sur l\'appareil Android (LiteRT-LM)',
  sectionLocalModel: 'Modèle local',
  localModelManage: 'Gérer les modèles →',
  localModelNone: 'Aucun modèle chargé',
  localModelAndroidOnly: 'Disponible sur Android uniquement',
  sectionInfo: 'Informations',
  appVersionLabel: 'Version de l\'app',
  securityNotice: 'Le code des modules est validé et s\'exécute dans un environnement contrôlé. Aucun accès direct au réseau, stockage ou matériel sans ton consentement explicite.',
  sectionLanguage: 'Langue',
  langAuto: 'Automatique',

  moduleNotFound: 'Module introuvable.',
  moduleNotFoundSub: 'Il a peut-être été supprimé.',
  backToModules: 'Modules',

  permTitle: 'Permissions requises',
  permBody: (perms) => `Ce module nécessite l'accès à : ${perms}.`,
  permNotice: 'L\'accès se fait via les API contrôlées d\'AppFromAI. Aucune permission système directe sans ton consentement.',
  permRequesting: 'Demande des permissions système…',
  permAllow: 'Autoriser et ouvrir',
  permDeny: 'Refuser l\'accès',

  genModalBuilding: 'Construction de ton app…',
  genModalDone: 'App créée !',
  genStep1: 'Envoi au modèle',
  genStep2: 'Traitement',
  genStep3: 'Création',
  genHint: 'Cela peut prendre 10–60 secondes selon le modèle',
  genStepPending: 'en attente',
  genStepActive: 'en cours…',
  genStepDone: 'fait',
  humanizeError: (raw) => {
    if (/kv.?cache|kv cache/i.test(raw))
      return 'Le modèle est surchargé : la requête est trop longue. Essaie de décrire l\'app plus brièvement.';
    if (/HTTP 401|invalid.{0,20}api.{0,10}key|api.{0,10}key.{0,10}invalid|authentication/i.test(raw))
      return 'Clé API invalide. Vérifie-la dans Réglages → fournisseur.';
    if (/HTTP 429|rate.?limit|quota/i.test(raw))
      return 'Trop de requêtes. Attends quelques secondes et réessaie.';
    if (/HTTP 5\d\d|internal server|bad gateway/i.test(raw))
      return 'Le serveur IA a eu un problème temporaire. Réessaie dans quelques secondes.';
    if (/ECONNREFUSED|ERR_NETWORK|Network Error|connection refused/i.test(raw))
      return 'Impossible de joindre le serveur IA. Vérifie la connexion et l\'URL dans les Réglages.';
    if (/timeout|timed out/i.test(raw))
      return 'Le modèle a mis trop de temps. Essaie avec une requête plus simple ou réessaie.';
    if (/modulo non valido|validazione schema/i.test(raw))
      return 'Le modèle n\'a pas généré une app valide. Reformule la demande.';
    if (/json|JSON/i.test(raw))
      return 'Le modèle a répondu dans un format illisible. Réessaie — ça marche généralement au deuxième essai.';
    if (/compilazione|JavaScript.*non valido|compile/i.test(raw))
      return 'Le code généré n\'est pas valide. Essaie une description plus simple.';
    if (/empty/i.test(raw))
      return 'Le modèle a renvoyé une réponse vide. Réessaie.';
    if (/URL.*non valido|url.{0,10}invalid/i.test(raw))
      return 'L\'URL du serveur n\'est pas valide. Vérifie les Réglages.';
    if (/inserisci.*api.*key|api key.*mancante/i.test(raw))
      return 'La clé API est manquante. Ajoute-la dans les Réglages.';
    const trimmed = raw.replace(/\s*\(prime \d+ char\).*$/s, '').trim();
    return trimmed.length > 180 ? trimmed.slice(0, 177) + '…' : trimmed;
  },

  styleEditorTitle: 'Modifier le style',
  styleEditorColors: 'COULEURS',
  styleEditorTexts: 'TEXTES',
  styleEditorSave: 'Enregistrer',
  styleEditorApply: 'Appliquer',
  styleEditorNoEditable: 'Aucun élément modifiable trouvé dans ce module.',

  regenBtn: 'Regénérer',
  regenSheetTitle: 'Regénérer le module',
  regenOriginalLabel: 'Prompt original',
  regenTweakLabel: 'Ajustements (optionnel)',
  regenTweakPlaceholder: 'Ex : ajoute un minuteur, change les couleurs, augmente la vitesse…',
  regenSuccess: 'Module mis à jour !',

  rendererError: 'Impossible de charger le module',
  rendererRootError: 'La racine UI doit être screen ou navigator.',
  back: 'Retour',
};

const de: Strings = {
  tabGenerate: 'Erstellen',
  tabModules: 'Module',
  tabSettings: 'Einstellungen',

  heroLine1: 'Erstelle dein',
  heroLine2: 'Modul',
  heroSub: 'Beschreibe es in natürlicher Sprache. Die KI erledigt den Rest.',
  placeholder: 'Z.B.: ein Taschenrechner mit Verlauf…',
  charCount: (n) => `${n} Z.`,
  errorEmpty: 'Beschreibe das Modul, das du erstellen möchtest.',
  btnGenerate: 'Modul erstellen',
  btnGenerating: 'Wird erstellt…',
  successTitle: 'Modul erstellt!',
  successHint: 'Öffne es im Tab Module.',
  examples: [
    'Erstelle eine App, die ein Foto aufnimmt und es anzeigt',
    'Erstelle ein Flappy-ähnliches Spiel: Charakter springt beim Tippen, mit Hindernissen und Punktestand',
    'Erstelle eine Inspektions-App: Foto, GPS, Notizen und Zusammenfassung',
  ],

  modulesTitle: 'Deine Module',
  emptyTitle: 'Noch keine Module',
  emptyText: (accent) => `Gehe zum Tab ${accent}, um dein erstes KI-Modul zu erstellen.`,
  openModule: 'Modul öffnen',
  deleteModuleTitle: 'Modul löschen',
  deleteConfirmMsg: (name) => `„${name}" löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
  cancel: 'Abbrechen',
  deleteConfirm: 'Löschen',
  dateLocale: 'de-DE',

  settingsTitle: 'Einstellungen',
  sectionMode: 'Modus',
  mockLabel: 'Offline-Mock',
  mockHint: 'Beispielmodule ohne KI-Server erstellen',
  sectionProvider: 'KI-Anbieter',
  providerOllamaHint: 'Lokaler KI-Server auf deinem PC',
  providerOpenAiHint: 'Kompatibel mit OpenAI-Standard-API',
  providerClaudeHint: 'Anthropic Messages API',
  sectionOllama: 'Ollama-Konfiguration',
  ollamaUrlLabel: 'Basis-URL',
  ollamaUrlPlaceholder: 'http://localhost:11434',
  ollamaUrlHint: 'Echtes Gerät: Nutze die IP deines Mac/PCs, z.B. http://192.168.1.x:11434 · Android-Emulator: http://10.0.2.2:11434',
  ollamaModelLabel: 'Modell',
  ollamaModelHint: 'Muss einem Modell in `ollama list` entsprechen',
  sectionOpenAi: 'OpenAI-API-Konfiguration',
  openAiUrlLabel: 'Chat-Completions-URL',
  sectionClaude: 'Claude-API-Konfiguration',
  claudeUrlLabel: 'Basis-URL',
  claudeUrlHint: 'Der /messages-Endpunkt wird verwendet',
  claudeKeyLabel: 'API-Schlüssel',
  claudeModelLabel: 'Modell',
  providerLocalHint: 'LLM direkt auf dem Android-Gerät (LiteRT-LM)',
  sectionLocalModel: 'Lokales Modell',
  localModelManage: 'Modelle verwalten →',
  localModelNone: 'Kein Modell geladen',
  localModelAndroidOnly: 'Nur auf Android verfügbar',
  sectionInfo: 'Informationen',
  appVersionLabel: 'App-Version',
  securityNotice: 'Der Modulcode wird validiert und in einer kontrollierten Umgebung ausgeführt. Kein direkter Zugriff auf Netzwerk, Speicher oder Hardware ohne deine ausdrückliche Zustimmung.',
  sectionLanguage: 'Sprache',
  langAuto: 'Automatisch',

  moduleNotFound: 'Modul nicht gefunden.',
  moduleNotFoundSub: 'Es wurde möglicherweise gelöscht.',
  backToModules: 'Module',

  permTitle: 'Berechtigungen erforderlich',
  permBody: (perms) => `Dieses Modul benötigt Zugriff auf: ${perms}.`,
  permNotice: 'Der Zugriff erfolgt über die kontrollierten APIs von AppFromAI. Keine direkte Systemberechtigung ohne deine Zustimmung.',
  permRequesting: 'Systemberechtigungen werden angefordert…',
  permAllow: 'Erlauben und öffnen',
  permDeny: 'Zugriff verweigern',

  genModalBuilding: 'Deine App wird erstellt…',
  genModalDone: 'App erstellt!',
  genStep1: 'Senden an Modell',
  genStep2: 'Verarbeitung',
  genStep3: 'Erstellung',
  genHint: 'Dies kann je nach Modell 10–60 Sekunden dauern',
  genStepPending: 'wartend',
  genStepActive: 'läuft…',
  genStepDone: 'fertig',
  humanizeError: (raw) => {
    if (/kv.?cache|kv cache/i.test(raw))
      return 'Das Modell ist überlastet: die Anfrage ist zu lang. Versuche die App kürzer zu beschreiben.';
    if (/HTTP 401|invalid.{0,20}api.{0,10}key|api.{0,10}key.{0,10}invalid|authentication/i.test(raw))
      return 'Ungültiger API-Schlüssel. Überprüfe ihn in Einstellungen → Anbieter.';
    if (/HTTP 429|rate.?limit|quota/i.test(raw))
      return 'Zu viele Anfragen. Warte einige Sekunden und versuche es erneut.';
    if (/HTTP 5\d\d|internal server|bad gateway/i.test(raw))
      return 'Der KI-Server hatte ein vorübergehendes Problem. Versuche es in einigen Sekunden erneut.';
    if (/ECONNREFUSED|ERR_NETWORK|Network Error|connection refused/i.test(raw))
      return 'Der KI-Server ist nicht erreichbar. Überprüfe die Verbindung und die URL in den Einstellungen.';
    if (/timeout|timed out/i.test(raw))
      return 'Das Modell hat zu lange gebraucht. Versuche eine einfachere Anfrage oder probiere es erneut.';
    if (/modulo non valido|validazione schema/i.test(raw))
      return 'Das Modell hat keine gültige App generiert. Formuliere die Anfrage neu.';
    if (/json|JSON/i.test(raw))
      return 'Das Modell hat in einem unlesbaren Format geantwortet. Versuche es erneut — beim zweiten Versuch klappt es meist.';
    if (/compilazione|JavaScript.*non valido|compile/i.test(raw))
      return 'Der generierte Code ist ungültig. Versuche eine einfachere Beschreibung.';
    if (/empty/i.test(raw))
      return 'Das Modell hat eine leere Antwort gesendet. Bitte erneut versuchen.';
    if (/URL.*non valido|url.{0,10}invalid/i.test(raw))
      return 'Die Server-URL ist ungültig. Überprüfe die Einstellungen.';
    if (/inserisci.*api.*key|api key.*mancante/i.test(raw))
      return 'API-Schlüssel fehlt. Füge ihn in den Einstellungen hinzu.';
    const trimmed = raw.replace(/\s*\(prime \d+ char\).*$/s, '').trim();
    return trimmed.length > 180 ? trimmed.slice(0, 177) + '…' : trimmed;
  },

  styleEditorTitle: 'Stil bearbeiten',
  styleEditorColors: 'FARBEN',
  styleEditorTexts: 'TEXTE',
  styleEditorSave: 'Änderungen speichern',
  styleEditorApply: 'Anwenden',
  styleEditorNoEditable: 'Keine bearbeitbaren Elemente in diesem Modul gefunden.',

  regenBtn: 'Neu generieren',
  regenSheetTitle: 'Modul neu generieren',
  regenOriginalLabel: 'Originaler Prompt',
  regenTweakLabel: 'Anpassungen (optional)',
  regenTweakPlaceholder: 'Z.B.: Timer hinzufügen, Farben ändern, Geschwindigkeit erhöhen…',
  regenSuccess: 'Modul aktualisiert!',

  rendererError: 'Modul konnte nicht geladen werden',
  rendererRootError: 'UI-Wurzel muss screen oder navigator sein.',
  back: 'Zurück',
};

export const translations: Record<Language, Strings> = { it, en, es, fr, de };

/** Detects the best matching language from system locale */
export function detectLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const tag = locale.split('-')[0].toLowerCase();
    if (tag === 'it') return 'it';
    if (tag === 'en') return 'en';
    if (tag === 'es') return 'es';
    if (tag === 'fr') return 'fr';
    if (tag === 'de') return 'de';
  } catch {
    // ignore
  }
  return 'en';
}
