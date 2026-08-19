<?php
declare(strict_types=1);

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/config.php';

/**
 * Das Körpergewicht, als Liste mit Datum.
 *
 * Mit Datum und nicht als eine einzelne aktuelle Zahl, weil der
 * Fortschritts-Index rückwärts rechnet: An der Unterstützungsmaschine ist
 * die bewegte Last "Körpergewicht minus Hilfe". Mit nur einem aktuellen
 * Wert würde jede Änderung auf der Waage die gesamte Vergangenheit
 * umschreiben — wer fünf Kilo abnimmt, sähe in alten Einheiten plötzlich
 * fünf Kilo weniger Last und damit einen Rückschritt, den es nie gab.
 *
 * Eintragen ist freiwillig. Ohne Eintrag bleiben die unterstützten Übungen
 * aus dem Index heraus, alles andere rechnet weiter.
 */

/** Alle Einträge, ältester zuerst. */
function gewicht_liste(): array
{
    $liste = array_values((array) json_read(GEWICHT_FILE, []));

    usort($liste, static function (array $a, array $b): int {
        return strcmp((string) ($a['date'] ?? ''), (string) ($b['date'] ?? ''));
    });

    return $liste;
}

/**
 * Das Körpergewicht, das an diesem Tag galt.
 *
 * Der jüngste Eintrag, der nicht nach $tag liegt. Gibt es nur spätere,
 * gilt der früheste davon: Ein nachträglich eingetragener Wert ist immer
 * noch die bessere Auskunft als gar keine, und die Alternative wäre, die
 * ersten Einheiten für immer aus dem Index zu lassen.
 */
function gewicht_am(string $tag): ?float
{
    $liste = gewicht_liste();
    if ($liste === []) {
        return null;
    }

    $treffer = null;
    foreach ($liste as $eintrag) {
        if (strcmp((string) ($eintrag['date'] ?? ''), $tag) <= 0) {
            $treffer = $eintrag;
        }
    }

    $gewaehlt = $treffer ?? $liste[0];
    $kg = (float) ($gewaehlt['kg'] ?? 0);

    return $kg > 0 ? $kg : null;
}

/**
 * Eine getippte Zahl in eine Kommazahl verwandeln, streng.
 *
 * Streng, weil PHPs Umwandlung nachsichtig ist: (float) "84,5kg" ergibt
 * 84,5 und (float) "84,5,3" ebenfalls, beides ohne einen Mucks. Ein
 * Vertipper käme dann als plausible Zahl in der Datei an und wäre später
 * nicht mehr als Vertipper zu erkennen.
 *
 * Komma und Punkt sind beide erlaubt: Die App schreibt Zahlen überall mit
 * Komma, und auf der deutschen Tastatur ist das die Dezimaltaste.
 */
function gewicht_zahl(string $roh): float
{
    $text = str_replace(',', '.', trim($roh));

    if (!preg_match('/^\d{1,3}(\.\d{1,2})?$/', $text)) {
        throw new InvalidArgumentException(
            'Das Körpergewicht muss eine Zahl sein, etwa 84,5.'
        );
    }

    return (float) $text;
}

/**
 * Einen Eintrag setzen oder überschreiben. Ein Datum trägt genau einen
 * Wert; zweimal am selben Tag gewogen heißt, der zweite gilt.
 */
function gewicht_setzen(string $tag, float $kg): array
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tag)) {
        throw new InvalidArgumentException('Das Datum muss YYYY-MM-TT sein.');
    }

    // Grenzen aus dem gesunden Menschenverstand, nicht aus der Medizin:
    // Sie sollen einen Tippfehler abfangen (8,5 statt 85), nicht jemanden
    // bevormunden.
    if ($kg < 30 || $kg > 300) {
        throw new InvalidArgumentException('Das Körpergewicht muss zwischen 30 und 300 kg liegen.');
    }

    return json_update(GEWICHT_FILE, static function (array $liste) use ($tag, $kg): array {
        $liste = array_values($liste);
        $neu = [];
        $ersetzt = false;

        foreach ($liste as $eintrag) {
            if (($eintrag['date'] ?? '') === $tag) {
                $neu[] = ['date' => $tag, 'kg' => $kg];
                $ersetzt = true;
            } else {
                $neu[] = $eintrag;
            }
        }

        if (!$ersetzt) {
            $neu[] = ['date' => $tag, 'kg' => $kg];
        }

        usort($neu, static function (array $a, array $b): int {
            return strcmp((string) ($a['date'] ?? ''), (string) ($b['date'] ?? ''));
        });

        return $neu;
    }, []);
}

/** Einen Eintrag entfernen. */
function gewicht_entfernen(string $tag): array
{
    return json_update(GEWICHT_FILE, static function (array $liste) use ($tag): array {
        return array_values(array_filter($liste, static function (array $e) use ($tag): bool {
            return ($e['date'] ?? '') !== $tag;
        }));
    }, []);
}
