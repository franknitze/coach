#!/bin/bash
#
# Deployment nach All-Inkl.
#
#   bin/deploy.sh            prüft und lädt hoch
#   bin/deploy.sh --trocken  zeigt nur, was sich ändern würde
#
# Warum ein Skript und kein rsync von Hand: die Ausschlussliste ist der
# heikle Teil. Fehlt --exclude 'data/**', überschreibt ein Deployment die
# Trainingsdaten auf dem Server. Fehlt der Quellordner in der Liste,
# wandern 310 MB Originale mit hoch, darunter 49 iPhone-Aufnahmen mit den
# GPS-Koordinaten des Studios. Beides ist schon passiert.
#
# Eine Ausschlussliste ist aber nur so gut wie ihr letzter Eintrag. Ein
# neuer Ordner wird vergessen, und niemand merkt es. Deshalb steht unten
# zusätzlich eine Obergrenze: nichts über 400 KB geht hoch. Größer ist
# hier ausschließlich ein unaufbereitetes Original.
#
# Vor dem Hochladen läuft die Fotoprüfung. Anlass: zwei ausgetauschte
# Fotos gingen als iPhone-Originale mit GPS-Koordinaten auf den
# öffentlichen Server, und niemandem fiel es auf.

set -euo pipefail

# Server, Zielpfad und Domain stehen in einer gitignorierten Datei und
# nicht hier: Hostname, Paketkennung und Pfad sagen einem Fremden genau,
# wo die Kiste steht. Vorlage: bin/ziel.conf.beispiel
KONF="$(dirname "$0")/ziel.conf"
if [ ! -f "$KONF" ]; then
    echo "Es fehlt bin/ziel.conf. Anlegen mit:"
    echo "  cp bin/ziel.conf.beispiel bin/ziel.conf   und die Werte eintragen"
    exit 1
fi
# shellcheck source=/dev/null
. "$KONF"

cd "$(dirname "$0")/.."

ZIEL="$SSH_HOST:$FERNPFAD/"
SSH="ssh -o IdentityAgent=none -o IdentitiesOnly=yes"
# IdentityAgent=none umgeht Franks 1Password-SSH-Agenten, der über die
# Host-*-Regel in ~/.ssh/config alles abfängt ("Too many authentication
# failures").

echo "── Fotos prüfen ──"
if ! node tests/lauf.js fotos; then
    echo
    echo "Abbruch. Erst die Fotos aufbereiten:"
    echo "  sips -Z 900 -s format jpeg -s formatOptions 70 <datei> --out <datei>"
    echo "  python3 bin/exif-entfernen.py <datei>"
    exit 1
fi

echo "── PHP-Syntax ──"
for f in lib/*.php api/*.php bin/*.php index.php; do
    php -l "$f" > /dev/null || { echo "Syntaxfehler in $f"; exit 1; }
done
node --check assets/app.js
node --check service-worker.js
echo "  in Ordnung"
echo

# Obergrenze als zweite Sicherung, unabhängig von der Ausschlussliste.
# Dieselbe Zahl bewacht tests/fotos.js für die Webfassungen: was darüber
# liegt, ist kein aufbereitetes Bild, sondern ein Original.
echo "── Nichts Übergroßes dabei? ──"
GRENZE=409600
zuviel=$(find . -type f -size +${GRENZE}c \
    ! -path './.git/*' ! -path './fotos/*' ! -path './images/*' \
    ! -path './data/*' ! -path './tests/*' ! -name '*.md' 2>/dev/null)
if [ -n "$zuviel" ]; then
    echo "  Abbruch. Diese Dateien sind über 400 KB und gehören nicht auf den Server:"
    echo "$zuviel" | sed 's/^/    /'
    echo "  Original nach fotos/ oder images/ legen, dann bin/fotos.sh."
    exit 1
fi
echo "  in Ordnung"
echo

TROCKEN=""
if [ "${1:-}" = "--trocken" ]; then
    TROCKEN="--dry-run"
    echo "── Probelauf, es wird nichts übertragen ──"
else
    echo "── Hochladen ──"
fi

# data/ bleibt draußen, nur die Zugriffssperre darin reist mit.
#
# assets/img/exercises/ bleibt ebenfalls draußen, und das ist der wichtige
# Teil: dort liegen die selbst hochgeladenen Fotos, die es lokal gar nicht
# gibt. Mit --delete hat rsync sie einmal komplett gelöscht. Fotos wandern
# ausschließlich über bin/fotos-hochladen.sh nach oben, und das nur
# hinzufügend.
rsync -az --delete $TROCKEN -e "$SSH" \
    --include='data/' --include='data/.htaccess' --exclude='data/**' \
    --exclude 'assets/img/exercises/' \
    --exclude 'tests/' --exclude 'images/' --exclude 'fotos/' --exclude '.git/' \
    --exclude '.DS_Store' --exclude 'bin/icons.js' --exclude 'bin/deploy.sh' \
    --exclude 'bin/ziel.conf*' \
    --exclude '*.md' --exclude '.gitignore' \
    --itemize-changes \
    ./ "$ZIEL" | sed 's/^/  /'

if [ -n "$TROCKEN" ]; then
    exit 0
fi

echo
echo "── Fotos abgleichen (nur hinzufügend) ──"
bash "$(dirname "$0")/fotos-hochladen.sh" | sed 's/^/  /'
echo
echo "── Live-Prüfung ──"
pruefe() {
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOMAIN/$1")
    if [ "$code" = "$2" ]; then
        printf "  ok   /%-22s %s\n" "$1" "$code"
    else
        printf "  FEHL /%-22s %s (erwartet %s)\n" "$1" "$code" "$2"
    fi
}
pruefe ""                  200
pruefe "manifest.json"     200
pruefe "assets/app.css"    200
pruefe "api/exercises.php" 401
pruefe "data/config.json"  403
pruefe "lib/config.php"    404
# bin/ liegt auf dem Server, plan-anlegen.php wird dort gebraucht. Aus dem
# Browser darf davon nichts erreichbar sein.
pruefe "bin/plan-anlegen.php" 404
