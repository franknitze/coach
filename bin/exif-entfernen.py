#!/usr/bin/env python3
"""
Entfernt die APPn-Segmente aus JPEG-Dateien, darunter das EXIF-Segment
mit den GPS-Koordinaten.

Nötig, weil auf diesem Mac weder exiftool noch ImageMagick liegen und
sips die Metadaten beim Verkleinern mitnimmt. Die Studiofotos tragen
sonst den Standort des Studios mit ins Repo und auf den Server.

    python3 bin/exif-entfernen.py assets/img/exercises/*.jpg
"""

import sys

# APP0 bis APP15 plus das Kommentarsegment.
ZU_ENTFERNEN = set(range(0xE0, 0xF0)) | {0xFE}


def saeubern(daten: bytes) -> bytes:
    if daten[:2] != b'\xff\xd8':
        raise ValueError('kein JPEG')

    raus = bytearray(b'\xff\xd8')
    i = 2

    while i < len(daten):
        if daten[i] != 0xFF:
            raise ValueError(f'kein Marker an Position {i}')

        marker = daten[i + 1]

        # Ab dem Bilddatenstrom wird nur noch kopiert.
        if marker == 0xDA:
            raus += daten[i:]
            break

        laenge = int.from_bytes(daten[i + 2:i + 4], 'big')
        if marker not in ZU_ENTFERNEN:
            raus += daten[i:i + 2 + laenge]
        i += 2 + laenge

    return bytes(raus)


for pfad in sys.argv[1:]:
    with open(pfad, 'rb') as f:
        vorher = f.read()
    nachher = saeubern(vorher)
    with open(pfad, 'wb') as f:
        f.write(nachher)
    print(f'  {pfad}: {len(vorher) - len(nachher)} Byte Metadaten entfernt')
