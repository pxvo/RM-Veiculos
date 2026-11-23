/* CONFIGURAÇÃO PÚBLICA do aplicativo Web, obtida em Firebase > Configurações do projeto.
   A apiKey do Firebase Web NÃO é uma senha. Segurança depende de Auth + Rules + App Check.
   Nunca coloque service accounts, chaves privadas ou senhas neste arquivo. */
globalThis.RM_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCJPUPx1WvZOOY4obs7bi1yaY0oAehRrqw', // Chave publica copiada do print; confira no console.
  authDomain: 'rm-veiculos.firebaseapp.com',
  projectId: 'rm-veiculos',
  messagingSenderId: '193720436769',
  appId: '1:193720436769:web:6db205036e01c835457b60'
};
// Opcional: App Check/reCAPTCHA Enterprise. Ver README antes de habilitar proteção em produção.
globalThis.RM_FIREBASE_APPCHECK_SITE_KEY = '';
