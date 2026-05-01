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
