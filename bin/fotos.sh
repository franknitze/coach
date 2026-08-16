#!/bin/bash
#
# Bereitet die Studiofotos für das Web auf.
#
#   bin/fotos.sh
#
# Nimmt jedes Original aus fotos/ und legt eine Webfassung in
# assets/img/exercises/ ab: auf 900 Pixel verkleinert, ohne Metadaten.
# Läuft beliebig oft, überspringt was schon aktuell ist.
#
# WARUM ÜBERHAUPT: ein Original ist rund 2,7 MB. Neun Kacheln auf einem
# Studio-Bildschirm wären 25 MB, die das Handy bei schlechtem Empfang
# jedes Mal zieht, um daraus ein 76 Pixel großes Vorschaubild zu machen.
# Die Webfassung liegt bei 150 KB. Nebenbei fallen die GPS-Koordinaten
# weg, denn die Bilder liegen auf dem Server ohne Anmeldung.
#
# NEUE FOTOS: einfach nach fotos/ legen und dieses Skript laufen lassen.
# bin/deploy.sh ruft es ohnehin selbst auf. Zuordnen tust du sie danach
# in der App unter "Mein Plan", dort gibt es eine Bildauswahl.

set -euo pipefail
cd "$(dirname "$0")/.."

# fotos/ sind die iPhone-Originale und per .gitignore ausgeschlossen.
# Nicht images/, dort liegen die generierten Übungsbilder.
QUELLE="fotos"
ZIEL="assets/img/exercises"
KANTE=900

mkdir -p "$ZIEL"

neu=0
aktuell=0

shopt -s nullglob nocaseglob
for original in "$QUELLE"/*.jpg "$QUELLE"/*.jpeg; do
    name=$(basename "${original%.*}")
    web="$ZIEL/$name.jpg"

    # Nur anfassen, was fehlt oder älter ist als das Original.
    if [ -f "$web" ] && [ "$web" -nt "$original" ]; then
        aktuell=$((aktuell + 1))
        continue
    fi

    sips -Z "$KANTE" -s format jpeg -s formatOptions 70 \
         "$original" --out "$web" > /dev/null
    neu=$((neu + 1))
done
shopt -u nullglob nocaseglob

# sips nimmt die Metadaten beim Verkleinern mit, deshalb hinterher.
# Auf diesem Mac liegen weder exiftool noch ImageMagick.
if [ "$neu" -gt 0 ]; then
    python3 bin/exif-entfernen.py "$ZIEL"/*.jpg > /dev/null
fi

gesamt=$(ls -1 "$ZIEL"/*.jpg 2>/dev/null | wc -l | tr -d ' ')
groesse=$(du -sh "$ZIEL" | cut -f1)

echo "  $neu neu aufbereitet, $aktuell schon aktuell"
echo "  $gesamt Webfassungen, zusammen $groesse"
