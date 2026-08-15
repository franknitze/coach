#!/bin/bash
#
# Deployment nach All-Inkl.
#
#   bin/deploy.sh            prüft und lädt hoch
#   bin/deploy.sh --trocken  zeigt nur, was sich ändern würde
#
# Warum ein Skript und kein rsync von Hand: die Ausschlussliste ist der
# heikle Teil. Fehlt --exclude 'data/**', überschreibt ein Deployment die
# Trainingsdaten auf dem Server. Fehlt --exclude 'images/', wandern 134 MB
# Originalfotos mit hoch. Beides ist mir beim Tippen schon passiert.
#
# Vor dem Hochladen läuft die Fotoprüfung. Anlass: zwei ausgetauschte
# Fotos gingen als iPhone-Originale mit GPS-Koordinaten auf den
# öffentlichen Server, und niemandem fiel es auf.

set -euo pipefail

cd "$(dirname "$0")/.."

ZIEL="allinkl:www/htdocs/KENNUNG/DOMAIN/"
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

TROCKEN=""
if [ "${1:-}" = "--trocken" ]; then
    TROCKEN="--dry-run"
    echo "── Probelauf, es wird nichts übertragen ──"
else
    echo "── Hochladen ──"
fi

# data/ bleibt draußen, nur die Zugriffssperre darin reist mit.
rsync -az --delete $TROCKEN -e "$SSH" \
    --include='data/' --include='data/.htaccess' --exclude='data/**' \
    --exclude 'tests/' --exclude 'images/' --exclude '.git/' \
    --exclude '.DS_Store' --exclude 'bin/icons.js' --exclude 'bin/deploy.sh' \
    --exclude '*.md' --exclude '.gitignore' \
    --itemize-changes \
    ./ "$ZIEL" | sed 's/^/  /'

if [ -n "$TROCKEN" ]; then
    exit 0
fi

echo
echo "── Live-Prüfung ──"
pruefe() {
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://DOMAIN/$1")
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
