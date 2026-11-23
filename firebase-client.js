/* Camada de dados compartilhada entre site e painel — Firebase Spark. */
import './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const cfg = globalThis.RM_FIREBASE_CONFIG;
export const configured = Boolean(cfg?.apiKey && cfg.apiKey !== 'COLE_AQUI_API_KEY_PUBLICA' && cfg?.projectId && cfg.projectId !== 'SEU_PROJETO');
export const app = configured ? initializeApp(cfg) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const persistenceReady = auth ? setPersistence(auth, browserLocalPersistence) : Promise.resolve();

// App Check é recomendado antes de publicar formulários públicos. Configure reCAPTCHA Enterprise no Console.
if (app && globalThis.RM_FIREBASE_APPCHECK_SITE_KEY) {
  try {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app-check.js');
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(globalThis.RM_FIREBASE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
  } catch (err) { console.error('App Check não iniciou:', err); }
}
