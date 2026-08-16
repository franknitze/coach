#!/bin/bash
#
# Bereitet die Studiofotos für das Web auf.
#
#   bin/fotos.sh
#
# Nimmt jedes Original aus fotos/ und images/ und legt eine Webfassung
# in assets/img/exercises/ ab: auf 1200 Pixel verkleinert, als JPEG,
# ohne Metadaten.
# Läuft beliebig oft, überspringt was schon aktuell ist.
#
# WARUM ÜBERHAUPT: ein Original ist rund 2,7 MB. Neun Kacheln auf einem
# Studio-Bildschirm wären 25 MB, die das Handy bei schlechtem Empfang
# jedes Mal zieht, um daraus ein 76 Pixel großes Vorschaubild zu machen.
# Die Webfassung liegt bei 150 KB. Nebenbei fallen die GPS-Koordinaten
# weg, denn die Bilder liegen auf dem Server ohne Anmeldung.
#
# NEUE BILDER: nach fotos/ (fotografiert) oder images/ (generiert) legen
# und dieses Skript laufen lassen.
# bin/deploy.sh ruft es ohnehin selbst auf. Zuordnen tust du sie danach
# in der App unter "Mein Plan", dort gibt es eine Bildauswahl.

set -euo pipefail
cd "$(dirname "$0")/.."

# Zwei Quellen, beide per .gitignore aus dem Repo heraus:
#   fotos/   die iPhone-Aufnahmen aus dem Studio
#   images/  die generierten Übungsbilder, ein PNG je Übung
# Beide sind Originale in voller Größe und werden nur hier gelesen.
QUELLEN=(fotos images)
ZIEL="assets/img/exercises"
# 1200 Pixel, weil das Handy im Großformat 390 Punkte mal dreifache
# Pixeldichte zeigt, also 1170 echte Pixel. Dieselbe Zahl bewacht
# tests/fotos.js als Obergrenze.
KANTE=1200

mkdir -p "$ZIEL"

neu=0
aktuell=0

shopt -s nullglob nocaseglob
quelldateien=()
for q in "${QUELLEN[@]}"; do
    quelldateien+=("$q"/*.jpg "$q"/*.jpeg "$q"/*.png)
done
for original in "${quelldateien[@]}"; do
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
