/*
 * Service Worker.
 *
 * REGEL: Solange Netz da ist, kommt NICHTS aus dem Cache. Jede Anfrage
 * geht an den Server, und die Antwort von dort wird ausgeliefert. Der
 * Cache ist ausschließlich der Notnagel für den Fall, dass gar keine
 * Verbindung besteht.
 *
 * Das ist die Vorgabe von Frank, und sie hat einen konkreten Anlass: die
 * frühere Fassung bediente statische Dateien zuerst aus dem Cache und
 * erneuerte sie nur im Hintergrund. Zusammen mit einem unversionierten
 * Eintrag führte das dazu, dass Änderungen beim Laden unsichtbar blieben.
 * Eine App, bei der man nie sicher weiß, ob man den aktuellen Stand sieht,
 * ist schlimmer als eine, die eine halbe Sekunde länger lädt.
 *
 * Der Cache bleibt trotzdem befüllt, weil im Studio schlechter Empfang
 * herrscht und die App dort auch ohne Verbindung starten muss.
 *
 * Was NIE in den Cache geht: alles unter api/. Ein zwischengespeicherter
 * Trainingsstand wäre schlimmer als eine Fehlermeldung.
 */

const CACHE = 'coach-v4';

// Nur der Notvorrat für den Start ohne Netz. CSS und JS stehen bewusst
// nicht drin: die tragen die Dateizeit in der URL und landen beim ersten
// echten Abruf unter genau dieser URL im Cache.
const SCHALE = [
    './',
    'manifest.json',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then((c) => c.addAll(SCHALE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((namen) => Promise.all(
                namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const anfrage = e.request;

    if (anfrage.method !== 'GET') {
        return;
    }

    const url = new URL(anfrage.url);
    if (url.origin !== location.origin) {
        return;
    }

    // Die API immer frisch, ohne Cache und ohne Notnagel.
    if (url.pathname.includes('/api/')) {
        return;
    }

    const istSeite = anfrage.mode === 'navigate';

    e.respondWith(
        fetch(anfrage)
            .then((antwort) => {
                // Vom Netz gekommen, also ausliefern. Eine Kopie in den
                // Cache legen, damit es ohne Verbindung noch etwas gibt.
                if (antwort.ok) {
                    // Bei Seiten nur die angemeldete Hülle merken, sonst
                    // stünde man im Funkloch vor dem Anmeldeformular.
                    const merken = !istSeite || antwort.headers.get('X-Angemeldet') === '1';
                    if (merken) {
                        const kopie = antwort.clone();
                        caches.open(CACHE).then((c) => c.put(istSeite ? './' : anfrage, kopie));
                    }
                }
                return antwort;
            })
            .catch(() => {
                // Kein Netz. Jetzt und nur jetzt der Cache.
                return istSeite
                    ? caches.match('./', { ignoreSearch: true })
                    : caches.match(anfrage);
            })
    );
});
