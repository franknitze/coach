#!/bin/bash
#
# Überträgt Gerätefotos zum Server. NUR HINZUFÜGEND.
#
#   bin/fotos-hochladen.sh
#
# Kein --delete, unter keinen Umständen. Im Zielordner liegen auch die
# Fotos, die Frank selbst über die App hochgeladen hat; die gibt es hier
# nicht, und rsync hat sie mit --delete schon einmal alle gelöscht.
#
# Das ist der einzige Weg, auf dem Bilder nach oben gehen: bin/deploy.sh
# lässt den Ordner bewusst aus.

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

SSH="ssh -o IdentityAgent=none -o IdentitiesOnly=yes"
ORDNER="$FERNPFAD/assets/img/exercises"
ZIEL="$SSH_HOST:$ORDNER/"

zaehlen() {
    ssh -o IdentityAgent=none -o IdentitiesOnly=yes -o BatchMode=yes "$SSH_HOST" \
        "ls -1 $ORDNER/*.jpg 2>/dev/null | wc -l" | tr -d ' '
}

vorher=$(zaehlen)

rsync -az --ignore-existing -e "$SSH" assets/img/exercises/ "$ZIEL"

nachher=$(zaehlen)

echo "$vorher Fotos auf dem Server, jetzt $nachher. Nichts gelöscht."
