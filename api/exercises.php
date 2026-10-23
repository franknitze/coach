<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../lib/uebungen.php';
require_once __DIR__ . '/../lib/training.php';

auth_require();

$plan = (array) json_read(PLAN_FILE, []);

switch ($_SERVER['REQUEST_METHOD'] ?? 'GET') {

    case 'GET':
        // ?usage=ID: in wie vielen Einheiten die Übung Sätze hat, für die
        // zweite Frage vor dem vollständigen Löschen.
        if (isset($_GET['usage'])) {
            json_out(['sessions' => training_einheiten_mit(trim((string) $_GET['usage']))]);
        }
        json_out(['exercises' => alsObjekt((array) json_read(EXERCISES_FILE, []))]);
        // kein break nötig, json_out beendet

    case 'POST':
        /*
         * ?id=ID&hidden=1 blendet aus, hidden=0 aktiviert wieder (Frank,
         * 23.10.2026). Nur das Feld ändert sich, alles andere bleibt, damit
         * die Übung beim Zurückholen mit Tag, Stelle und Verlauf dasteht.
         */
        if (isset($_GET['hidden'])) {
            $id = trim((string) ($_GET['id'] ?? ''));
            $ausblenden = $_GET['hidden'] === '1';
            $gefunden = false;
            $alle = json_update(EXERCISES_FILE, function (array $alle) use ($id, $ausblenden, &$gefunden): array {
                if (!isset($alle[$id])) {
                    return $alle;
                }
                $gefunden = true;
                $alle[$id]['hidden'] = $ausblenden;

                // Zurück an die alte Stelle. Hat inzwischen eine andere Übung
                // des Tages dieselbe Stelle, rücken sie und alle dahinter um
                // eins nach: die zurückgeholte steht davor.
                if (!$ausblenden) {
                    $tag = $alle[$id]['day'] ?? '';
                    $stelle = (int) ($alle[$id]['order'] ?? 0);
                    $belegt = false;
                    foreach ($alle as $andereId => $u) {
                        if ($andereId !== $id && ($u['day'] ?? '') === $tag && empty($u['hidden'])
                            && (int) ($u['order'] ?? 0) === $stelle) {
                            $belegt = true;
                        }
                    }
                    if ($belegt) {
                        foreach ($alle as $andereId => $u) {
                            if ($andereId !== $id && ($u['day'] ?? '') === $tag && empty($u['hidden'])
                                && (int) ($u['order'] ?? 0) >= $stelle) {
                                $alle[$andereId]['order'] = (int) $u['order'] + 1;
                            }
                        }
                    }
                }
                return $alle;
            });
            if (!$gefunden) {
                fail('Diese Übung gibt es nicht.', 404);
            }
            json_out(['exercises' => alsObjekt($alle)]);
        }

        try {
            $uebung = uebung_pruefen(request_body(), $plan);
        } catch (InvalidArgumentException $e) {
            fail($e->getMessage(), 422);
        }

        $alle = json_update(EXERCISES_FILE, function (array $alle) use (&$uebung): array {
            // Das Formular kennt das Feld nicht. Wer eine ausgeblendete Übung
            // aus dem Rückblick heraus bearbeitet, soll sie damit nicht
            // nebenbei wieder einblenden.
            $uebung['hidden'] = !empty($alle[$uebung['id']]['hidden']);
            $alle[$uebung['id']] = $uebung;
            return $alle;
        });

        json_out(['exercise' => $uebung, 'exercises' => alsObjekt($alle)]);

    case 'DELETE':
        $id = trim((string) ($_GET['id'] ?? ''));
        if ($id === '') {
            fail('Ohne ID lässt sich nichts löschen.');
        }

        if (!isset(((array) json_read(EXERCISES_FILE, []))[$id])) {
            fail('Diese Übung gibt es nicht.', 404);
        }

        /*
         * Vollständig löschen (Frank, 23.10.2026): die Übung UND alle ihre
         * Sätze. Wer die Daten behalten will, blendet aus. Vorher eine Kopie
         * jeder betroffenen Datei nach data/sicherung/.
         */
        $stempel = (new DateTimeImmutable('now'))->format('Ymd-His') . '-vor-loeschen';
        daten_sichern(EXERCISES_FILE, $stempel);
        $einheiten = training_uebung_loeschen($id, $stempel);

        $alle = json_update(EXERCISES_FILE, function (array $alle) use ($id): array {
            unset($alle[$id]);
            return $alle;
        });

        json_out(['exercises' => alsObjekt($alle), 'sessions' => $einheiten]);

    default:
        header('Allow: GET, POST, DELETE');
        fail('Methode nicht erlaubt', 405);
}

/**
 * Sorgt dafür, dass eine leere Bibliothek im JSON als {} und nicht als []
 * ankommt. Das Frontend erwartet ein Objekt mit der Übungs-ID als Schlüssel.
 */
function alsObjekt(array $daten)
{
    return $daten === [] ? new stdClass() : $daten;
}
