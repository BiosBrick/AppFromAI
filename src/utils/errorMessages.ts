export function toUserMessage(error: unknown, scope: string): string {
  const msg = error instanceof Error ? error.message : String(error ?? '');

  if (scope.startsWith('aiClient.ollama')) {
    if (msg.includes('ECONNREFUSED') || msg.includes('Network Error') || msg.includes('ETIMEDOUT'))
      return 'Impossibile connettersi a Ollama, controlla URL e rete.';
    if (msg.includes('timeout')) return 'Timeout della richiesta a Ollama.';
    if (msg.includes('401') || msg.includes('403')) return 'Autenticazione Ollama fallita.';
    return 'Ollama ha risposto con un errore.';
  }
  if (scope.startsWith('aiClient.claude')) {
    if (msg.includes('Network Error') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT'))
      return 'Impossibile connettersi a Claude API, controlla connessione e URL.';
    if (msg.includes('401') || msg.includes('403')) return 'API key Claude non valida o scaduta.';
    if (msg.includes('429')) return 'Limite di richieste Claude raggiunto, riprova tra poco.';
    return 'Claude ha risposto con un errore.';
  }
  if (scope.startsWith('aiClient.openai')) {
    if (msg.includes('Network Error') || msg.includes('ECONNREFUSED'))
      return 'Impossibile connettersi al provider AI.';
    if (msg.includes('401') || msg.includes('403')) return 'API key non valida.';
    return 'Il provider AI ha risposto con un errore.';
  }
  if (scope === 'validator.zod') return 'Il modulo generato ha una struttura non valida.';
  if (scope === 'validator.codeScan') return 'Il codice contiene istruzioni non permesse.';
  if (scope === 'validator.compile') return 'Il codice del modulo non è eseguibile.';
  if (scope === 'renderer.action') return 'Azione non riuscita, riprova.';
  if (scope === 'renderer.onFocus') return 'Errore durante il caricamento della schermata.';

  return 'Si è verificato un errore, riprova.';
}
