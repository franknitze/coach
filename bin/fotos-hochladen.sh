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
cd "$(dirname "$0")/.."

SSH="ssh -o IdentityAgent=none -o IdentitiesOnly=yes"
ZIEL="allinkl:www/htdocs/KENNUNG/DOMAIN/assets/img/exercises/"

vorher=$(ssh -o IdentityAgent=none -o IdentitiesOnly=yes -o BatchMode=yes allinkl \
    'ls -1 www/htdocs/KENNUNG/DOMAIN/assets/img/exercises/*.jpg 2>/dev/null | wc -l' | tr -d ' ')

rsync -az --ignore-existing -e "$SSH" assets/img/exercises/ "$ZIEL"

nachher=$(ssh -o IdentityAgent=none -o IdentitiesOnly=yes -o BatchMode=yes allinkl \
    'ls -1 www/htdocs/KENNUNG/DOMAIN/assets/img/exercises/*.jpg 2>/dev/null | wc -l' | tr -d ' ')

echo "$vorher Fotos auf dem Server, jetzt $nachher. Nichts gelöscht."
