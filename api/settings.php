<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

auth_require();

/**
 * Plan-Verwaltung: Tage, Rotation, Muskel-Schwerpunkte (SPEC.md §10, Phase 1).
 *
 * Nicht zu verwechseln mit dem in §3 vorgesehenen plan.php, das in Phase 2
 * die Studio-Ansicht liefert (heutiger Tag samt Übungen und letzten Werten).
 * Hier geht es um die Struktur des Plans, dort um den Trainingstag.
 */

switch ($_SERVER['REQUEST_METHOD'] ?? 'GET') {

    case 'GET':
        json_out(['plan' => json_read(PLAN_FILE, [])]);

    case 'POST':
        $eingabe = request_body();

        try {
            $neu = json_update(PLAN_FILE, function (array $plan) use ($eingabe): array {
                return plan_aendern($plan, $eingabe);
            });
        } catch (InvalidArgumentException $e) {
            fail($e->getMessage(), 422);
        }

        json_out(['plan' => $neu]);

    default:
        header('Allow: GET, POST');
        fail('Methode nicht erlaubt', 405);
}

/**
 * Übernimmt Schwerpunkte und Rotation aus der Eingabe.
 *
 * Unbekannte Muskelgruppen und Tage werden still übergangen statt abgelehnt:
 * die Oberfläche schickt immer den vollen Satz zurück, und ein zwischenzeitlich
 * umbenannter Tag soll nicht das ganze Speichern scheitern lassen.
 */
function plan_aendern(array $plan, array $eingabe): array
{
    $tage = array_keys((array) ($plan['days'] ?? []));

    if (isset($eingabe['muscle_priorities'])) {
        foreach ((array) $eingabe['muscle_priorities'] as $gruppe => $wert) {
            if (isset($plan['muscle_priorities'][$gruppe])) {
                $plan['muscle_priorities'][$gruppe] = $wert === 'focus' ? 'focus' : 'normal';
            }
        }
    }

    if (isset($eingabe['rotation'])) {
        $rotation = [];
        foreach ((array) $eingabe['rotation'] as $tag) {
            if (in_array($tag, $tage, true)) {
                $rotation[] = $tag;
            }
        }
        if ($rotation === []) {
            throw new InvalidArgumentException('Die Rotation braucht mindestens einen Tag.');
        }
        $plan['rotation'] = $rotation;
    }

    return $plan;
}
