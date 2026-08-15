/*
 * Service Worker: App-Shell im Cache, damit die App sofort startet und
 * nach dem Ablegen auf dem Homescreen wie eine App wirkt (SPEC.md §10,
 * Phase 5).
 *
 * WAS DAS NICHT LEISTET: Training ohne Netz. Die Sätze gehen weiterhin
 * sofort an api/session.php. Ohne Verbindung startet zwar die Hülle, aber
 * es lassen sich weder Übungen laden noch Sätze speichern. Wenn im Studio
 * kein Empfang ist, wäre das eine eigene Ausbaustufe (Sätze lokal in
 * IndexedDB puffern und später nachreichen), keine Sache des Cachings.
 *
 * Drei Regeln, und die Reihenfolge ist wichtig:
 *
 * 1. api/ wird NIE aus dem Cache bedient. Ein zwischengespeicherter
 *    Trainingsstand wäre schlimmer als eine Fehlermeldung: die App zeigte
 *    Sätze an, die längst anders auf der Platte liegen.
 * 2. Seitenaufrufe zuerst aus dem Netz, der Cache ist nur der Notnagel.
 *    index.php entscheidet über das Session-Gate, und diese Entscheidung
 *    darf nicht altern.
 * 3. Statische Dateien zuerst aus dem Cache und im Hintergrund erneuern.
 */

const CACHE = 'coach-v1';

// Bei Änderungen an dieser Liste oder am Cache-Namen die Version hochzählen,
// sonst behalten bereits installierte Geräte den alten Stand.
const SCHALE = [
    './',
    'assets/app.css',
    'assets/app.js',
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

    // 1. Die API immer frisch, ohne Ausnahme.
    if (url.pathname.includes('/api/')) {
        return;
    }

    // 2. Seitenaufrufe: Netz zuerst, Cache nur wenn nichts geht.
    if (anfrage.mode === 'navigate') {
        e.respondWith(
            fetch(anfrage)
                .then((antwort) => {
                    // Nur die angemeldete Hülle merken. Läge die
                    // Anmeldeseite im Cache, stünde man ohne Netz vor
                    // einem Formular, das sich nicht abschicken lässt.
                    if (antwort.ok && antwort.headers.get('X-Angemeldet') === '1') {
                        const kopie = antwort.clone();
                        caches.open(CACHE).then((c) => c.put('./', kopie));
                    }
                    return antwort;
                })
                .catch(() => caches.match('./', { ignoreSearch: true }))
        );
        return;
    }

    // 3. Statisches: Cache zuerst, im Hintergrund erneuern.
    //    ignoreSearch, weil index.php an CSS und JS eine Version aus der
    //    Dateizeit hängt und die URL sich bei jedem Deployment ändert.
    e.respondWith(
        caches.match(anfrage, { ignoreSearch: true }).then((treffer) => {
            const ausDemNetz = fetch(anfrage).then((antwort) => {
                if (antwort.ok) {
                    const kopie = antwort.clone();
                    caches.open(CACHE).then((c) => c.put(anfrage, kopie));
                }
                return antwort;
            }).catch(() => treffer);

            return treffer || ausDemNetz;
        })
    );
});
