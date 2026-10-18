# Hilfe & Funktionslogik — Coach

> Diese Datei dokumentiert das **Verhalten** der App und die **Begründung**
> dahinter. Zielgruppe ist der Mensch, der Coach benutzt, nicht der
> Entwickler: Es geht darum, *was* passiert und vor allem *warum* es so ist.
>
> Für die Installation siehe [README.md](README.md), für den Aufbau des
> Trainingsplans [TRAININGSPLAN.md](TRAININGSPLAN.md).

## So liest du dieses Dokument

Jede Sektion behandelt einen Bereich der App und hat drei Teile:
**Verhalten** (was du erlebst), **Begründung** (warum es so gebaut ist) und
**Häufige Nutzerfragen** (konkrete „Warum kann ich …?"-Antworten). Die
Sektionen sind in sich abgeschlossen und einzeln lesbar.

## Inhalt

1. [Anmelden und Passwort](#1-anmelden-und-passwort)
2. [Was heute dran ist](#2-was-heute-dran-ist)
3. [Sätze eintragen im Studio](#3-sätze-eintragen-im-studio)
4. [Die Pause zwischen den Sätzen](#4-die-pause-zwischen-den-sätzen)
5. [Gepaarte Übungen (Supersets)](#5-gepaarte-übungen-supersets)
6. [Wann die Wiederholungen und wann das Gewicht steigen](#6-wann-die-wiederholungen-und-wann-das-gewicht-steigen)
7. [Training ohne Empfang](#7-training-ohne-empfang)
8. [Einheit beenden und Rückblick](#8-einheit-beenden-und-rückblick)
9. [Der Kalender](#9-der-kalender)
10. [Die Fortschrittskurve auf der Startseite](#10-die-fortschrittskurve-auf-der-startseite)
11. [Der Verlauf einer einzelnen Übung](#11-der-verlauf-einer-einzelnen-übung)
12. [Körpergewicht eintragen](#12-körpergewicht-eintragen)
13. [Einstellungen: Übungen und Allgemein](#13-einstellungen-übungen-und-allgemein)
14. [Fotos und Übungsbilder](#14-fotos-und-übungsbilder)
15. [Die App auf dem Homescreen](#15-die-app-auf-dem-homescreen)
16. [Wo deine Daten liegen](#16-wo-deine-daten-liegen)

---

## 1. Anmelden und Passwort

### Verhalten

Coach ist passwortgeschützt. Beim allerersten Aufruf im Browser legst du das
Passwort selbst fest, mindestens acht Zeichen. Danach bleibst du **30 Tage**
angemeldet — und diese 30 Tage zählen **ab der letzten Benutzung**, nicht ab
dem Anmelden. Wer regelmäßig trainiert, wird nie wieder nach dem Passwort
gefragt.

Ändern kannst du es unter **Einstellungen → Allgemein → Passwort**. Dort
werden drei Dinge verlangt: das aktuelle Passwort, das neue und das neue noch
einmal. Nach dem Wechsel bleibst du auf diesem Gerät angemeldet.

Wer nicht angemeldet ist, sieht je nach Installation die schlichte
Anmeldeseite oder eine Startseite, die Coach vorstellt und das
Anmeldeformular enthält. Die Anmeldung funktioniert auf beiden gleich.

Abmelden steht unten in der Fußzeile und braucht **zwei Tipper**: der erste
fragt „Wirklich abmelden?", der zweite meldet ab. Ein Tipp irgendwo anders
nimmt die Frage zurück.

### Begründung

**Die 30 Tage rollen mit**, weil ein festes Ablaufdatum ab dem Anmelden
bedeutet hätte, dass man nach einem Monat ausgesperrt wird, egal wie oft man
die App benutzt hat. Ausgesperrt zu sein ist im Studio besonders lästig, denn
Anmelden braucht Netz — und genau das fehlt dort oft.

**Das alte Passwort wird beim Wechsel verlangt**, obwohl du ja schon
angemeldet bist. Die Anmeldung hält 30 Tage und liegt auf einem Handy, das
man auch mal liegen lässt. Ohne die Abfrage genügte ein unbeaufsichtigtes
Gerät, um den Zugang zu übernehmen. Das Passwort wechselt man alle paar
Jahre einmal, die zwei Sekunden Tippen fallen nicht ins Gewicht.

**Abmelden braucht zwei Tipper und steht unten**, nicht oben rechts im Kopf.
Oben rechts liegt der Daumen ohnehin, wenn man das Handy hält; ein Fehlgriff
dort kostet im Studio den Zugang.

### Häufige Nutzerfragen

**Warum muss ich mich nach dem Passwortwechsel nicht neu anmelden?**
Weil du dich nicht selbst aussperren sollst. Die Sitzung auf diesem Gerät
bekommt nur eine neue Kennung und läuft weiter.

**Ich habe das Passwort auf dem Handy geändert — bin ich am Rechner jetzt
abgemeldet?**
Nein. Jedes angemeldete Gerät hat seine eigene Sitzung und bleibt bestehen,
bis sie von selbst abläuft. Wenn du ein Gerät sofort loswerden willst, melde
dich dort ab.

**Ich habe mein Passwort vergessen. Was jetzt?**
Über den Browser gibt es keinen Weg zurück — die Ersteinrichtung schaltet
sich ab, sobald ein Passwort gesetzt ist, sonst könnte sich jeder ein neues
setzen, der die Adresse kennt. Es hilft nur die Kommandozeile auf dem Server:
`php bin/init-config.php --force`. Deine Trainingsdaten bleiben dabei
unangetastet.

**Warum sehe ich bei meiner Installation keine Startseite mit Vorstellung
der App, sondern nur das Anmeldeformular?**
Die Startseite ist ein Schalter und steht ab Werk auf aus. Wer Coach selbst
installiert, soll keine Werbeseite für einen fremden Anbieter bekommen. Für
dich als Nutzer ändert sich nichts: Anmelden geht auf beiden Seiten gleich.

**Warum verlangt Coach mindestens acht Zeichen?**
Die App liegt offen im Netz, jeder mit der Adresse sieht das Anmeldeformular.
Kürzere Passwörter lassen sich durchprobieren. Nach einer Falscheingabe
wartet die App zusätzlich kurz, bevor sie antwortet, damit sich massenhaftes
Raten nicht lohnt.

---

## 2. Was heute dran ist

### Verhalten

Die Startseite sagt groß, welcher Trainingstag als Nächstes dran ist — etwa
„Heute: Unterkörper" — und darunter steht der Startknopf. Direkt daneben
kannst du **jederzeit einen anderen Tag wählen**.

Welcher Tag vorgeschlagen wird, ergibt sich aus deiner Rotation und der
zuletzt trainierten Einheit. Sobald du eine Einheit beendest, rückt der
Vorschlag weiter.

### Begründung

Der Tagesvorschlag wird **abgeleitet und nicht gespeichert**. Es gibt kein
Feld „aktueller Tag", das man pflegen müsste und das aus dem Tritt geraten
könnte. Der Vorschlag ergibt sich immer neu aus dem, was tatsächlich in
deiner Historie steht.

Die **manuelle Auswahl bleibt immer möglich**, weil das Leben nicht dem
Schema folgt: Krankheit, eine zusätzliche Einheit, ein Tag, an dem das Gerät
belegt ist. Coach zwingt dich nie ins Schema.

Der Standardplan rotiert **zweigliedrig über drei Termine** (Mo/Mi/Fr).
Dadurch verschiebt sich der Wechsel von Woche zu Woche von selbst, und jede
Hälfte kommt im Schnitt anderthalbmal pro Woche dran. Eine dreigliedrige
Rotation hätte sich jede Woche identisch wiederholt: Montag für immer
Oberkörper, Unterkörper nur einmal pro Woche.

### Häufige Nutzerfragen

**Warum schlägt mir die App heute Unterkörper vor, obwohl ich Oberkörper
machen will?**
Der Vorschlag folgt nur der Reihe. Tippe den gewünschten Tag darunter an, das
ist ausdrücklich vorgesehen und kein Umweg.

**Ich habe eine Einheit angefangen, und mitten drin sprang die Anzeige auf
den nächsten Tag um. Warum?**
Das war ein Fehler und ist behoben. Sobald du das Studio betrittst, hält
Coach den Tag fest, bis du „Einheit beenden" tippst — und findet ihn auch
nach einem Neuladen wieder. Vorher rückte die Rotation schon beim ersten
bestätigten Satz weiter, weil die laufende Einheit damit die letzte in der
Historie war.

**Ich habe eine Einheit pausiert. Warum steht sie noch oben als „Heute"?**
Weil du mittendrin bist. Solange eine Einheit von heute offen ist, bietet
Coach sie an und nicht den nächsten Tag der Rotation. Willst du trotzdem
etwas anderes machen, tippe den gewünschten Tag darunter an.

**Kann ich einen Trainingstag anlegen oder umbenennen?**
Über die Oberfläche nicht. Die drei Tage des Standardplans entstehen bei der
Einrichtung; ändern lassen sich danach die Übungen darin, nicht die Tage
selbst.

---

## 3. Sätze eintragen im Studio

### Verhalten

Nach „Los geht's" stehen die Übungen des Tages als große Kacheln
untereinander. Jede zeigt das Foto des Geräts, den Namen, die Vorgabe (etwa
„4 Sätze · 8–12 Wdh") und dein letztes Ergebnis („zuletzt 60 kg × 11").

Tippen klappt die Kachel auf. Gewicht und Wiederholungen stellst du mit
großen Plus- und Minus-Knöpfen ein, **nie über die Tastatur**. Halten lässt
die Zahl weiterlaufen und wird schneller. Beide Felder sind mit deinem
letzten Ergebnis vorbefüllt.

Ein großer Knopf bestätigt den Satz. **Die Punktreihe auf der Kachel zeigt,
bei welchem Satz du bist** — gefüllte Punkte sind erledigt, leere stehen noch
aus. Unter dem Kachelkopf stehen nur die Regler, damit die Eingabe nicht mit
jedem Satz weiter nach unten rutscht.

### Begründung

**Keine Tastatur im Studio.** Man hat verschwitzte Hände, hält das Handy in
einer Hand und will nicht zielen müssen. Große Flächen für den Daumen sind
das Einzige, was dort funktioniert.

**Vorbefüllt mit dem Tagesziel.** Im Feld steht, was heute ansteht — das
Arbeitsgewicht und die Wiederholungszahl, die der Coach nennt. Schaffst du
sie, bestätigst du nur. Schaffst du sie nicht, drückst du einmal Minus.

Früher stand dort dein letztes Ergebnis. Das führte zu einer Kachel, die sich
selbst widersprach: oben „130 kg halten", im Feld 80 kg — weil das dein
Aufwärmsatz war und das Feld den Satz an derselben Stelle wiederholte.

**Halten beschleunigt**, weil die erste Einheit sonst unbedienbar wäre: von
0 auf 80 kg in 2,5er-Schritten wären 32 Antipper.

**Jeder Satz wird einzeln gespeichert**, nicht gesammelt am Ende der Einheit.
Im Studio kann der Akku leer werden; was du bestätigt hast, liegt fest. Und
weil jeder Satz seine Position kennt, überschreibt ein Doppeltipp denselben
Satz, statt ihn ein zweites Mal anzuhängen.

### Häufige Nutzerfragen

**Warum steht im Feld eine Wiederholung mehr, als ich letztes Mal geschafft
habe?**
Weil dort das Tagesziel steht, nicht dein letztes Ergebnis. Der Coach sagt
eine Zeile darüber dasselbe: „130 kg halten, Ziel 7 Wiederholungen." Schaffst
du nur 6, drückst du einmal Minus — trag ein, was du wirklich gemacht hast,
sonst rechnet der Coach mit falschen Zahlen weiter.

**Was bedeutet „zuletzt 60 kg × 11"?**
Das ist dein letztes Ergebnis an diesem Gerät: 60 Kilogramm bei 11
Wiederholungen. Die Zahl hinter dem Mal-Zeichen sind die Wiederholungen, nicht
die Sätze.

**Warum kann ich das Gewicht nur in bestimmten Schritten ändern?**
Jede Übung hat ihre eigene Schrittweite, weil Geräte unterschiedlich fein
verstellbar sind. Zur Auswahl stehen 0,25 · 0,5 · 1 · 1,25 · 2,5 und 5 kg.
An Kurzhanteln und Maschinen mit Zusatzscheibe geht es feiner als am
Steckgewicht. Ändern kannst du das unter Einstellungen bei der Übung.

**Ich habe mich vertippt und den Satz schon bestätigt. Kann ich das
korrigieren?**
Nein. Seit die Satzliste unter dem Kachelkopf weg ist, gibt es kein „ändern"
mehr — was bestätigt ist, steht.

**Warum kann ich alte Einheiten nicht mehr korrigieren?**
Das ist eine bewusste Einschränkung, um den Schreibweg schlank zu halten.
Ein Vertipper von letzter Woche bleibt stehen.

**Muss ich die Übungen der Reihe nach abarbeiten?**
Nein. Du kannst jede Kachel jederzeit aufklappen, in jeder Reihenfolge.

**Wo finde ich, wie eine Übung überhaupt geht?**
Tippe auf das Foto des Geräts. Es geht groß auf, und darunter stehen der
Name, die Gerätenummer, die Ausführung und Verweise auf Video- und
Bildersuche. Ein Tipp irgendwo schließt es wieder.

Hat eine Übung kein Foto, steht dafür eine Zeile „Wie geht die Übung?" unter
dem Kachelkopf — dann gäbe es sonst keinen Weg dorthin.

Früher klappte der Text auf der Kachel auf und schob die Regler nach unten —
also genau das weg, wofür du die Kachel geöffnet hattest. Jetzt steht er da,
wo du ohnehin hinschaust, wenn du das Gerät suchst.

---

## 4. Die Pause zwischen den Sätzen

### Verhalten

Nach einem bestätigten Satz läuft unten ein Pausen-Panel mit großer
Countdown-Zahl, standardmäßig zwei Minuten. Es rüttelt kurz, wenn die Pause
um ist. Ein Knopf überspringt sie.

Bei null **verschwindet das Panel von selbst**. Nach dem letzten Satz einer
Einheit startet es gar nicht erst.

### Begründung

**Das Panel ist groß**, weil man aus zwei Metern Entfernung darauf schauen
soll, während man neben dem Gerät steht. Die Farbe ist ein dunkles Rot und
bewusst gedämpft: Trainiert wird morgens um sieben, ein leuchtender Block
über ein Drittel des Bildschirms blendet.

**Bei null verschwindet das Panel, es gibt keinen Zustand danach.** Früher
stand dort ein helles Grün mit „Weiter". Es sagte nur, was ohnehin zu sehen
war, und kostete einen Tipp, bevor man wieder an den Reglern war. Dass die
Pause vorbei ist, erkennt man daran, dass sie weg ist. Das Rütteln bleibt, es
erreicht einen auch dann, wenn man nicht aufs Handy schaut.

**Nach dem letzten Satz keine Pause**, weil eine Pause dem nächsten Satz
dient. Gibt es keinen, hieße Herunterzählen, jemanden vor dem Ausgang warten
zu lassen. Geprüft wird dabei der ganze Tag und nicht nur die eigene Übung —
der letzte Satz kann mitten in der Liste liegen, wenn man sie nicht der Reihe
nach abarbeitet.

### Häufige Nutzerfragen

**Warum kommt nach meinem letzten Satz keine Pause mehr?**
Weil kein Satz mehr folgt. Coach prüft alle Übungen des Tages, nicht nur die,
an der du gerade bist.

**Kann ich die Pausenlänge ändern?**
Die zwei Minuten stehen in der Konfiguration auf dem Server, nicht in der
Oberfläche. Für gepaarte Übungen gilt eine kürzere Pause (siehe
[Gepaarte Übungen](#5-gepaarte-übungen-supersets)).

**Das Panel verdeckt die Eingabe der nächsten Übung.**
Es nimmt das untere Bildschirmdrittel ein. Wenn es im Weg ist, tippe
„Überspringen" — die Pause ist eine Erinnerung, keine Sperre.

---

## 5. Gepaarte Übungen (Supersets)

### Verhalten

Manche Übungen sind zu zweit eingetragen, etwa Klimmzug und Dips. Nach einem
Satz führt Coach dich automatisch zur Partnerübung und nimmt eine **kürzere
Pause**, standardmäßig 90 statt 120 Sekunden.

### Begründung

Jeder Muskel bekommt trotzdem die volle Erholung, weil er ruht, während der
Gegenspieler arbeitet. Die Einheit wird dadurch rund ein Viertel kürzer, ohne
dass die Erholung leidet.

Der automatische Wechsel spart das Suchen: Wer im Wechsel trainiert, will
nach dem Satz nicht durch die Liste scrollen.

### Häufige Nutzerfragen

**Warum springt die App nach dem Satz zu einer anderen Übung?**
Weil diese beiden als Paar eingetragen sind. Das ist gewollt: Du machst
abwechselnd einen Satz von jeder.

**Warum ist meine Pause hier kürzer?**
Weil die Partnerübung einen anderen Muskel belastet. Deiner erholt sich
währenddessen, die volle Pause bekommt er trotzdem.

**Kann ich Paare selbst festlegen?**
Über die Oberfläche derzeit nicht. Die Paare des Standardplans stehen fest.

---

## 6. Wann die Wiederholungen und wann das Gewicht steigen

### Verhalten

Jede Übung hat eine Zahl von Sätzen und einen Bereich für die
Wiederholungen. Im Studio steht beim ersten Satz schon das Ziel im Feld.

- **Erstes Training einer Übung:** Ziel ist die Mindestzahl, das Gewicht
  wählst du selbst.
- **Alle Sätze haben das Ziel geschafft:** Beim nächsten Training gilt
  dasselbe Gewicht mit einer Wiederholung mehr.
- **Ein Satz hat das Ziel nicht geschafft:** Das Ziel bleibt, du machst es
  beim nächsten Training noch einmal.
- **Alle Sätze haben die Höchstzahl geschafft:** Das Gewicht steigt um eine
  Stufe, und das Ziel fällt zurück auf die Mindestzahl.
- **Selbst der beste Satz bleibt unter der Mindestzahl:** Das Gewicht bleibt,
  das Ziel geht auf die Mindestzahl zurück.

Beispiel, 3 Sätze, 6 bis 10 Wiederholungen, 50 kg: 6, 6, 6 → Ziel 7.
7, 7, 7 → Ziel 8. 8, 8, 6 → Ziel bleibt 8. 8, 8, 8 → Ziel 9. 9, 9, 9 →
Ziel 10. 10, 10, 10 → 55 kg, Ziel 6.

An einer Unterstützungsmaschine läuft es andersherum: Statt mehr Gewicht
gibt es weniger Hilfe, bei 0 kg Hilfe ist Zusatzgewicht dran.

### Begründung

**Geschafft heißt: alle Zielsätze durchgezogen.** Zwei Sätze auf der
Obergrenze sind kein Beleg dafür, dass drei gehen. Ohne diese Bedingung
schöbe ausgerechnet ein Abbruch das Gewicht hoch.

**Aufwärmsätze trägst du nicht ein.** Ein leichterer Satz zählt als „nicht
alle Sätze auf dem Gewicht“, und das Ziel bliebe stehen.

**Kein Sprachmodell dahinter.** Die Regel ist deterministisch und
nachrechenbar: Bei gleichen Daten sagt sie immer dasselbe.

### Häufige Nutzerfragen

**Warum steht beim ersten Training einer Übung 0 kg im Feld?**
Weil es zu dieser Übung noch keine Historie gibt. Der Standardplan liefert
absichtlich **keine Startgewichte** — die wären geraten und würden die Regel
mit falschen Zahlen füttern. Das erste Training ist die Eichung: Du stellst
das Gewicht mit dem Plus selbst ein, die Wiederholungen stehen auf der
Mindestzahl.

**Ich habe 8, 8, 6 geschafft. Warum steht beim nächsten Training wieder 8
im Feld?**
Weil das Ziel 8 war und ein Satz es nicht geschafft hat. Eine Wiederholung
mehr gibt es erst, wenn alle Sätze das Ziel erreicht haben. Bis dahin
wiederholst du das Ziel.

**Ich habe in allen Sätzen die Höchstzahl geschafft. Warum steigt das
Gewicht sofort?**
Weil die Übung damit geschafft ist. Es gibt keine Pflichtrunde, in der du
die Höchstzahl ein zweites Mal machen musst. Das Gewicht steigt um die Stufe
der Übung, und es geht wieder bei der Mindestzahl los.

**Warum ist mein Ziel niedriger als das, was ich zuletzt in einigen Sätzen
geschafft habe?**
Weil das Ziel nur steigt, wenn alle Sätze es geschafft haben. Ein Satz mit
weniger Wiederholungen oder mit leichterem Gewicht reicht, damit das Ziel
stehen bleibt. Steigerst du das Gewicht innerhalb einer Übung von Satz zu
Satz, zählt der leichtere Satz als „nicht alle auf dem Gewicht“.

**Kann ich Sätze, Wiederholungen und Gewichtsstufe ändern?**
Ja, für jede Übung einzeln unter Einstellungen → Übungen: die Anzahl der
Sätze, den Bereich der Wiederholungen und die Gewichtsstufe. Ein Startgewicht
gibt es nicht als Einstellung, das wählst du beim ersten Training.

**Ich habe die Einheit abgebrochen, obwohl die gemachten Sätze gut waren —
warum zählt sie nicht?**
Weil die Zielsatzzahl nicht erreicht wurde. Zwei starke Sätze belegen nicht,
dass vier gegangen wären. Das Ziel bleibt beim nächsten Training dasselbe.

**Bei Klimmzug und Dips zeigt Coach an, dass ich das Gewicht *senken* soll.
Ist das ein Fehler?**
Nein. Diese Geräte nehmen dir Gewicht ab. Weniger Hilfe ist die schwerere
Übung, also läuft die Regel dort andersherum. Bei 0 kg Hilfe endet die
Leiter, und Coach schlägt den Wechsel auf Zusatzgewicht vor.

---

## 7. Training ohne Empfang

### Verhalten

Im Studio ist der Empfang oft schlecht. Coach ist darauf ausgelegt:

- **Jeder bestätigte Satz landet zuerst im Speicher deines Handys**, auch bei
  bester Verbindung. Er gilt in dem Moment, in dem du bestätigt hast.
- Eine **Statusleiste** oben nennt jederzeit, wie viele Sätze noch auf die
  Übertragung warten und woran es liegt.
- Die zuletzt geladene Studio-Ansicht bleibt gespeichert, damit du auch ohne
  Netz siehst, was heute ansteht.
- Sobald die Verbindung zurück ist, gehen die Sätze automatisch raus.

Nicht offline verfügbar: die Einstellungen (der Verweis darauf verschwindet
ohne Netz), die Verlaufskurven, und das Ziel im Feld bleibt auf dem Stand
des letzten Ladens.

### Begründung

**Immer über den Puffer, nicht nur im Notfall.** Ein eigener Weg allein für
den Offline-Fall wäre ein Weg, der selten läuft und deshalb nicht auffällt,
wenn er kaputt ist. Wenn jeder Satz denselben Weg geht, ist der Weg erprobt.

**Die Statusleiste ist Teil des Versprechens, kein Schmuck.** Ein stiller
Puffer wäre schlimmer als gar keiner: Man verließe sich darauf, ohne zu
wissen, ob er noch voll ist.

**Der Zeitpunkt reist mit.** Ein Satz, der Dienstagabend im Funkloch
entstanden ist und Mittwoch übertragen wird, landet trotzdem unter Dienstag.

**Das Ziel im Feld veraltet bewusst.** Die Regel, die es ausrechnet, lebt an
genau einer Stelle, und die liegt auf dem Server. Eine zweite Fassung im Browser
könnte etwas anderes sagen.

### Häufige Nutzerfragen

**Sind meine Sätze weg, wenn ich im Studio kein Netz habe?**
Nein. Sie liegen auf dem Handy und gehen raus, sobald wieder Verbindung
besteht. Die Statusleiste zeigt dir, wie viele noch warten.

**Kann ich die App schließen, während noch Sätze warten?**
Ja, der Speicher überlebt das Schließen und auch einen Neustart des Handys.
Öffne sie aber bei nächster Gelegenheit mit Netz wieder, damit die Sätze
tatsächlich ankommen.

**Ein Satz steht in der Statusleiste „abgelehnt". Was heißt das?**
Der Server hat ihn zurückgewiesen — anders als bei einem Netzfehler hilft
Wiederholen hier nicht. Er wandert sichtbar zur Seite, statt endlos erneut
versucht zu werden.

**Warum verschwindet der Verweis auf die Einstellungen, wenn ich kein Netz
habe?**
Weil die Einstellungen ohne Server nicht funktionieren. Ein Knopf, der ins
Leere führt, ist schlimmer als keiner.

**Warum sehe ich beim Neuladen ohne Netz noch die Übungen von vorhin?**
Weil Coach die zuletzt geladene Ansicht behält. Sie kann veraltet sein, aber
Übungen und Zielvorgaben ändern sich selten — und ohne sie sähest du im
Studio gar nichts.

---

## 8. Einheit beenden und Rückblick

### Verhalten

Aus einer laufenden Einheit führen zwei Wege heraus:

- **„Pause"** oben rechts — du kommst zur Startseite zurück, die Einheit
  bleibt offen und du kannst später weitermachen.
- **„Einheit beenden"** unter der letzten Kachel — die Einheit ist fertig,
  ob durchgezogen oder nicht.

Danach findest du die Einheit auf der Startseite unter den letzten zehn
Einheiten, mit Datum, Trainingstag und Umfang.

**Eine Einheit von heute, die noch nicht durch ist, ist „offen".** Sie steht
in der Liste mit einem gelben Balken, dem Wort „offen" und einem „Weiter"
daneben. Antippen bringt dich zurück ins Studio, mitsamt den Übungen, die
noch fehlen.

Jede andere Einheit ist reine Vergangenheit. Antippen öffnet sie zum Lesen:
oben eine Zusammenfassung, darunter **dieselben Kacheln wie im Studio**, nur
ausgefüllt.

Eine Einheit ist als **vollständig** markiert, wenn jede Übung ihre
Zielsatzzahl erreicht hat. Ist sie das nicht und stammt sie nicht von heute,
heißt sie „unvollständig".

### Begründung

**Der Ausgang steht unten**, weil der letzte Satz ganz unten bestätigt wird
und man dann dort steht. Eine Meldung neun Kacheln weiter oben sieht man
nicht.

**Er tritt zurück, solange die Einheit läuft**, weil bis dahin auf „Satz
bestätigen" getippt wird und nicht auf „beenden".

**Er ist auch bei unfertiger Einheit da.** Eine Einheit wird nicht immer
fertig, und dann muss sie sich trotzdem beenden lassen, ohne dass man erst
alles abhakt.

**Dieselben Kacheln wie im Studio.** Beim Zurückblicken ist „welches Gerät war
das" dieselbe Frage wie im Studio. Eine zweite Darstellung dafür wäre eine
zweite Bildsprache für denselben Gegenstand.

**„Offen" gilt nur am selben Tag.** Danach zählt eine Einheit als beendet, so
als hättest du „Einheit beenden" gedrückt. Eine Trainingseinheit erstreckt
sich nicht über mehrere Tage, und ein halber Trainingstag von vor drei Wochen
lässt sich nicht sinnvoll fortsetzen.

**Der Knopf unten verschwindet, wenn zwei Einheiten offen sind.** Er geht
immer in den Tag, der oben auf der Startseite steht. Bei einer offenen
Einheit ist das eindeutig; bei zweien bediente er wortlos eine von beiden.
Dann entscheidest du über die Liste. Einen **frischen** Tag kannst du
weiterhin über den Knopf starten.

**„Vollständig" wird je Übung geprüft, nicht über die Gesamtzahl.** Acht Sätze
Bankdrücken und keiner Latzug ergäben dieselbe Summe wie vier und vier, wären
aber eine halbe Einheit.

### Häufige Nutzerfragen

**Ich habe „Einheit beenden" getippt und lande wieder auf der Startseite, die
mir dieselbe Einheit anbietet.**
Das war ein Fehler und ist behoben. „Einheit beenden" gibt den Tag jetzt
wieder frei, und die Startseite schlägt den nächsten vor.

**Warum ist meine alte Einheit plötzlich nicht mehr als vollständig
markiert?**
Weil „vollständig" gegen den **heutigen** Plan gerechnet wird. Hast du bei
einer Übung die Zielsatzzahl erhöht, erfüllen alte Einheiten sie
rückwirkend nicht mehr. Die Sätze selbst bleiben unverändert; nur die
Markierung wechselt.

**Ich habe pausiert und will weitermachen — wie?**
Tippe in „Letzte Einheiten" auf den Eintrag mit dem gelben Balken. Du landest
direkt im Studio, mit allen Übungen des Tages. Steht nur eine Einheit offen,
tut es auch der Knopf „Weiter trainieren" unten.

**Ich habe auf eine unvollständige Einheit getippt und sehe nur die Übungen,
die ich schon gemacht habe.**
Dann ist diese Einheit nicht von heute, sondern Vergangenheit — die Ansicht
ist zum Nachlesen. Fortsetzen lassen sich nur Einheiten von heute, und die
tragen den gelben Balken.

**Ich habe zwei Einheiten an einem Tag angefangen. Ist das erlaubt?**
Ja. Beide stehen als offen in der Liste und lassen sich einzeln fortsetzen.
Der Knopf unten verschwindet dann, weil er nicht sagen könnte, welche er
meint.

**Im Kalender führt ein Tipp auf die heutige Einheit nur zum Lesen.**
Stimmt. Eine Kalenderzelle kann nur eine Einheit zeigen, und an einem Tag
können zwei liegen — dann wäre wieder unklar, welche gemeint ist. Die
Leseansicht bietet dir aber „Weiter trainieren" an, wenn die Einheit noch
läuft.

**Warum sehe ich nur zehn Einheiten?**
Die Startseite zeigt die letzten zehn. Ältere findest du über den Kalender.

**„Zurück" bringt mich woandershin, als ich erwartet habe.**
Coach merkt sich, woher du gekommen bist: Aus einer Einheit führt „Zurück"
dorthin zurück, wo du sie aufgeschlagen hast — Startseite oder Kalendermonat.

---

## 9. Der Kalender

### Verhalten

Der Kalender zeigt ein Monatsraster über **alle** Tage, nicht nur die
trainierten. Trainierte Tage sind gefüllt und tragen das Kürzel des
Trainingstags; Antippen öffnet die Einheit. Die Woche beginnt am Montag.

Geblättert wird nur zwischen dem ältesten Monat mit Daten und dem laufenden.
Darüber hinaus sind die Knöpfe gesperrt.

### Begründung

**Alle Tage, nicht nur die trainierten.** Der Rückblick beantwortet „was habe
ich gemacht", der Kalender „wie regelmäßig war ich" — und dafür ist die Lücke
so wichtig wie der Eintrag.

**Die Woche beginnt am Montag**, weil der Plan in Montag/Mittwoch/Freitag
denkt.

**Die Knöpfe sind an den Rändern gesperrt.** Ein Knopf, der ins Leere führt,
ist schlimmer als keiner, weil man ihn zweimal drückt.

### Häufige Nutzerfragen

**Warum kann ich nicht weiter zurückblättern?**
Weil dort keine Daten mehr liegen. Der älteste Monat mit einer Einheit ist die
Grenze.

**Warum kann ich nicht in die Zukunft blättern?**
Der Kalender zeigt, was war, nicht was kommt. Coach plant keine Termine.

**Warum steht auf der Fortschrittskurve nichts, wenn ich im Kalender bin?**
Der Fortschritts-Index gehört zur Startseite. Der Kalender beantwortet eine
andere Frage.

---

## 10. Die Fortschrittskurve auf der Startseite

### Verhalten

Jede Einheit bekommt eine **Punktzahl**, und diese Punkte ergeben eine Kurve.
Die erste Einheit einer Übung ist der Bezugspunkt und steht bei 100. Steigt
deine Leistung, steigt die Kurve.

Gerechnet wird je Übung: Was hast du in dieser Einheit geschafft, verglichen
mit deiner **ersten** Einheit dieser Übung? Der Tageswert ist der
**Mittelwert** dieser Verhältnisse mal 100.

### Begründung

**Mittelwert und nicht Summe.** Aufsummierte Gewichte machen die Kurve zu
einer Anzeige der Tagesart: Ein Oberkörpertag mit neun Übungen stünde immer
über einem Unterkörpertag mit acht, und die Linie sägte zwischen beiden hin
und her, ohne etwas über Fortschritt zu sagen. Ein Mittelwert hängt nicht
davon ab, über wie viele Werte er geht.

**Nicht nur das Gewicht zählt.** Der Vergleichswert je Satz berücksichtigt
Gewicht **und** Wiederholungen. Nur das Gewicht zu nehmen wäre falsch: Die
Progression klettert erst die Wiederholungen hoch, die Kurve bliebe wochenlang
flach, während tatsächlich etwas passiert.

**Die Zahl der Sätze geht bewusst nicht ein.** Sonst wäre eine abgebrochene
Einheit ein Rückschritt, obwohl vielleicht schwerer trainiert wurde, und ein
zusätzlicher lockerer Satz zöge den Wert nach unten. Der Index misst, wie
schwer, nicht wie viel — wie viel steht im Rückblick.

### Häufige Nutzerfragen

**Meine Kurve liegt flach auf 100. Ist etwas kaputt?**
Nein, du hast noch keine Übung zweimal gemacht. Jede erste Einheit einer
Übung ist ihr eigener Bezugspunkt und ergibt 100. Interessant wird die Kurve,
sobald sich Übungen wiederholen.

**Ich habe eine neue Übung angefangen, und die Kurve ist eingebrochen.
Warum?**
Eine neu aufgenommene Übung startet bei 100 und zieht den Tagesmittelwert
einmalig nach unten. Das ist der Preis dafür, dass jeder Punkt der Kurve für
sich nachrechenbar bleibt und ein einzelner Ausreißer die Kurve nicht
dauerhaft verschiebt. Beim nächsten Mal ist der Effekt weg.

**Was ist das für eine Zahl — kann ich sie mit irgendetwas vergleichen?**
Nur mit deinen eigenen früheren Einheiten. Es ist eine Rechengröße für den
Vergleich, keine Aussage darüber, wie viel du maximal heben könntest.

**Klimmzug und Dips fehlen in meiner Auswertung.**
Für diese Übungen braucht Coach dein Körpergewicht, weil die bewegte Last
„Körpergewicht minus Hilfe" ist. Ohne eingetragenes Gewicht bleiben sie
draußen; alles andere rechnet weiter. Siehe
[Körpergewicht eintragen](#12-körpergewicht-eintragen).

---

## 11. Der Verlauf einer einzelnen Übung

### Verhalten

Tippst du in den Einstellungen oder in einer abgeschlossenen Einheit eine
Übung an, siehst du ihren Verlauf: **zwei getrennte Diagramme**, das
Arbeitsgewicht über die Zeit und das Trainingsvolumen (Gewicht mal
Wiederholungen). Einen Punkt antippen zeigt die Werte dieser Einheit.

### Begründung

**Nie eine zweite y-Achse.** Kilogramm und Volumen haben ganz andere
Größenordnungen. In ein Achsenkreuz gezwungen suggerieren sich kreuzende
Linien Zusammenhänge, die es nicht gibt.

**Die Zeitachse folgt der echten Zeit**, nicht der Reihenfolge der Einträge.
Eine Trainingspause von drei Wochen soll als Lücke sichtbar sein.

**Die Skala beginnt nicht bei null**, sonst wäre der Unterschied zwischen 80
und 85 kg nicht zu sehen. Die tatsächlichen Grenzwerte stehen an der Achse,
damit der Ausschnitt ablesbar bleibt.

**Bei einer einzigen Einheit gibt es keine Kurve**, sondern den Wert als
Zeile. Eine Linie aus einem Punkt behauptet einen Verlauf, den es nicht gibt.

### Häufige Nutzerfragen

**Warum sehe ich bei dieser Übung keine Kurve, sondern nur eine Zeile?**
Weil es erst eine Einheit gibt. Ab der zweiten entsteht eine Linie.

**Warum sieht die Kurve so dramatisch aus, obwohl sich wenig geändert hat?**
Die Skala zeigt nur den Bereich, in dem deine Werte liegen. Schau auf die
Zahlen an der Achse — dort steht, worüber die Kurve tatsächlich geht.

**Bei Klimmzug zeigt das erste Diagramm etwas anderes als bei den übrigen
Übungen.**
Richtig: Dort steht die **geringste Hilfe** statt des Arbeitsgewichts, und im
zweiten Diagramm die Wiederholungen statt des Volumens. „Gewicht mal
Wiederholungen" wäre dort die abgenommene Last und stiege, wenn du dir mehr
helfen lässt.

**Warum liegt zwischen zwei Punkten so viel Platz?**
Weil dazwischen nicht trainiert wurde. Die Lücke ist die Aussage.

---

## 12. Körpergewicht eintragen

### Verhalten

Unter **Einstellungen → Allgemein → Körpergewicht** trägst du dein Gewicht mit
Datum ein. Jeder Eintrag gilt ab seinem Datum. Trägst du für denselben Tag
zweimal ein, überschreibt der neue Wert den alten. Einträge lassen sich
löschen.

Komma und Punkt sind beide erlaubt („84,5" wie „84.5"). Erlaubt ist ein
Bereich von 30 bis 300 kg.

### Begründung

**Mit Datum und nicht als eine aktuelle Zahl.** An der Unterstützungsmaschine
ist die bewegte Last „Körpergewicht minus Hilfe". Mit nur einem aktuellen Wert
würde jeder Gang auf die Waage die gesamte Vergangenheit umrechnen, und fünf
Kilo weniger auf der Waage erschienen in alten Einheiten als Rückschritt.

**Eintragen ist freiwillig.** Ohne Wert bleiben Klimmzug und Dips aus der
Auswertung, alles andere rechnet weiter.

**Komma ist erlaubt**, weil die deutsche Tastatur eine Kommataste hat und
keine Punkttaste. Ein reines Zahlenfeld hätte das Komma als ungültig
zurückgewiesen und das Feld beim Absenden einfach geleert.

**Streng geprüft wird trotzdem.** „84,5kg" oder „84,5,3" werden abgelehnt,
statt stillschweigend als 84,5 durchzugehen — ein Vertipper käme sonst als
plausible Zahl in den Daten an und wäre später nicht mehr als solcher zu
erkennen. Die Grenzen 30 bis 300 kg fangen den Faktor-Zehn-Fehler.

### Häufige Nutzerfragen

**Muss ich mein Körpergewicht eintragen?**
Nur wenn du Klimmzug oder Dips an einer Unterstützungsmaschine machst. Für
alle anderen Übungen spielt es keine Rolle.

**Warum wird „84,5kg" abgelehnt?**
Weil nur die Zahl erwartet wird, ohne Einheit. Coach lehnt lieber ab, als eine
Eingabe zu erraten.

**Ich habe abgenommen — verändert das meine alten Einheiten?**
Nein. Jeder Gewichtseintrag gilt ab seinem Datum, alte Einheiten rechnen mit
dem Gewicht, das damals galt.

**Ich habe vergessen einzutragen und trage es später nach. Geht das?**
Ja, wähle einfach das Datum von damals. Ein Datum in der Zukunft nimmt Coach
nicht an.

---

## 13. Einstellungen: Übungen und Allgemein

### Verhalten

Die Einstellungen haben zwei Bereiche zur Auswahl, umschaltbar oben auf der
Seite:

- **Übungen** — die Bibliothek, nach Trainingstagen sortiert. Hier legst du
  Übungen an, änderst und löschst sie. Pro Übung: Name, Gerätenummer,
  Reihenfolge, Trainingstag, Muskelgruppe, Zielsätze, Wiederholungsbereich,
  Schrittweite, Gewichtsrichtung, Ausführungstext, englischer Suchbegriff und
  Foto.
- **Allgemein** — Körpergewicht und Passwort.

„Übungen" ist der Bereich, in dem du landest. Löschen einer Übung passiert in
zwei Schritten: erst „Übung löschen", dann „Wirklich löschen".

### Begründung

**Zwei Bereiche statt einer langen Seite.** Die Übungen sind das, wofür man
hierher kommt; alles andere ändert man einmal im Jahr und soll dabei nicht im
Weg stehen. Vorher trug die Seite alles untereinander, und das Passwort wäre
der vierte Block hinter 25 Übungszeilen gewesen.

**Löschen in zwei Schritten**, weil eine gelöschte Übung ihre Historie
mitnimmt und das nicht durch einen Fehlgriff passieren soll.

**Die Reihenfolge in „Allgemein" folgt der Häufigkeit**: Körpergewicht trägt
man regelmäßig ein, das Passwort fast nie.

### Häufige Nutzerfragen

**Wo sind die Übungen hin? Ich sehe nur Körpergewicht und Passwort.**
Du bist im Bereich „Allgemein". Tippe oben auf „Übungen".

**Was bedeutet die Gerätenummer?**
Die aufgeklebte Nummer am Gerät im Studio. Sie erscheint als gelbes
Nummernschild unter dem Foto und ist oft der schnellste Weg, das richtige
Gerät wiederzufinden — im Studio suchst du die Maschine, nicht den Namen.
Sie ist freiwillig. Trägst du keine ein, steht dort nur das Foto.

**Was heißt „Gewichtsrichtung"?**
Bei den meisten Geräten ist mehr Gewicht schwerer. An einer
Unterstützungsmaschine — Klimmzug- oder Dip-Maschine mit Gegengewicht — ist es
umgekehrt: weniger Gewicht ist schwerer. Coach dreht dann die Progression und
die Auswertung entsprechend um.

**Was passiert mit meinen Ergebnissen, wenn ich eine Übung lösche?**
Die Sätze bleiben in den Einheiten stehen, in denen sie entstanden sind — mit
Name und Foto, wie sie damals waren. Sie tauchen nur nicht mehr in künftigen
Trainingstagen auf.

**Kann ich die Einstellungen im Studio benutzen?**
Nur mit Netz. Ohne Verbindung verschwindet der Verweis darauf, weil die Seite
ohne Server nicht funktioniert.

---

## 14. Fotos und Übungsbilder

### Verhalten

Jede Übung des Standardplans hat ein **gezeichnetes Bild**, das zeigt, wie sie
aussieht. Zusätzlich kannst du unter Einstellungen ein **eigenes Foto vom
Gerät** hochladen und einer Übung zuordnen. Das Formular öffnet direkt die
Kamera.

Ein Bild antippen zeigt es groß.

### Begründung

**Die Zuordnung eines Fotos triffst du selbst.** Auf einem Foto sieht man das
Gerät, aber nicht, welche Übung jemand daran macht. Das kann nur ein Mensch
entscheiden, deshalb steht die Auswahl in der App und nicht im Dateinamen.

**Fotos werden nicht künstlich verschönert.** Dezentes Zuschneiden ja, mehr
nicht — sonst geht die Wiedererkennung im Studio verloren, und die ist der
ganze Zweck.

**Ist die Bildbibliothek GD auf dem Server vorhanden**, wird das Foto beim
Hochladen neu gezeichnet: auf 1600 Pixel verkleinert, nach Aufnahmerichtung
gedreht und ohne Metadaten. Das Verkleinern zählt im Studio, wo der Empfang
schlecht ist. Das Entfernen der Metadaten zählt, weil ein Handyfoto den
**Aufnahmeort** mitführt und die Bilder ohne Anmeldung im Netz liegen.

### Häufige Nutzerfragen

**Mein hochgeladenes Foto liegt auf der Seite. Warum?**
Dann fehlt auf deinem Server die Bildbibliothek GD, und Coach legt die Datei
unverändert ab — samt der Aufnahmerichtung, die dein Handy nur als Vermerk
mitschickt. Frag deinen Hoster nach `gd` und `exif`, meist ist es ein
Häkchen im Kundenmenü.

**Mein Foto ist riesig und lädt langsam.**
Gleicher Grund: ohne GD wird nicht verkleinert. Ein Handyfoto hat schnell
mehrere Megabyte.

**Enthält mein hochgeladenes Foto meinen Standort?**
Mit GD nicht — die Metadaten werden beim Neuzeichnen entfernt. Ohne GD bleiben
sie in der Datei, und die Datei liegt ohne Anmeldung im Netz. Das ist der
wichtigste Grund, GD einschalten zu lassen.

**Warum sehe ich statt eines Fotos ein gelbes Nummernschild?**
Weil diese Übung kein Foto hat, aber eine Gerätenummer. Fehlt beides, steht
dort ein Platzhalter. Hat die Übung ein Foto **und** eine Nummer, siehst du
beides: das Bild, darunter die Nummer.

**Wo sehe ich die Gerätenummer, die ich eingetragen habe?**
Auf der Übungskachel im Studio und in der Liste unter „Einstellungen", jeweils
als gelbes Schild direkt unter dem Foto. Hat die Übung kein Foto, steht die
Nummer an dessen Stelle.

**Kann ich ein hochgeladenes Foto wieder löschen?**
Ja, in der Bildauswahl, ebenfalls in zwei Schritten.

---

## 15. Die App auf dem Homescreen

### Verhalten

Coach lässt sich als App auf den Homescreen legen und öffnet dann ohne
Browserleiste, mit eigenem Icon: die gelbe Plakette mit einem C, dasselbe
Zeichen wie im Browser-Tab und links oben im Kopf der App. Ohne Netz startet sie trotzdem und zeigt den
zuletzt geladenen Stand.

Ändert sich etwas an der App, lädt sie beim nächsten Öffnen einmal neu.

### Begründung

**Mit Netz kommt nichts aus dem Zwischenspeicher.** Jede Anfrage geht an den
Server; der Zwischenspeicher ist ausschließlich der Notnagel, wenn gar keine
Verbindung besteht. Eine frühere Fassung bediente Dateien zuerst aus dem
Speicher — dadurch blieb **jede Änderung unsichtbar**. Eine App, bei der man
nie sicher weiß, ob man den aktuellen Stand sieht, ist schlimmer als eine, die
eine halbe Sekunde länger lädt.

**Trainingsdaten kommen nie aus dem Zwischenspeicher.** Ein zwischen-
gespeicherter Trainingsstand wäre schlimmer als eine Fehlermeldung, weil die
App Sätze zeigte, die längst anders gespeichert sind.

**Gemerkt wird nur der angemeldete Zustand.** Läge die Anmeldeseite im
Speicher, stündest du im Funkloch vor einem Formular, das sich nicht
abschicken lässt.

### Häufige Nutzerfragen

**Ich sehe eine alte Fassung der App.**
Schließe sie einmal ganz (aus dem App-Umschalter wischen) und öffne sie neu.
Normalerweise passiert das von selbst beim ersten Öffnen nach einer Änderung.

**HTTPS ist Pflicht?**
Ja. Ohne verschlüsselte Verbindung legt kein Browser eine App auf den
Homescreen, und offline funktioniert sie dann auch nicht.

**Auf dem iPhone: über Safari auf den Homescreen legen, nicht über Chrome.**
Coach benutzt Apples Angaben für den Vollbildmodus, und die wertet nur Safari
aus. Über Chrome installiert kann sich die Anzeige beim Drehen ins Querformat
verstellen und bleibt es auch nach dem Zurückdrehen — aufziehen mit zwei
Fingern stellt sie wieder her. In Safari tritt das nicht auf.

**Auf meinem Homescreen ist noch das alte Symbol. Warum?**
Entferne die App vom Homescreen und lege sie über Safari neu hinzu, dann
erscheint das aktuelle Symbol. Mach das nur, wenn die Statusleiste keine
wartenden Sätze mehr anzeigt: Was noch nicht übertragen ist, liegt nur auf
dem Handy.

**Warum lädt die Seite manchmal einmal von selbst neu?**
Weil eine neue Fassung der App bereitsteht und übernommen wurde. Das passiert
höchstens einmal pro Aktualisierung.

---

## 16. Wo deine Daten liegen

### Verhalten

Alles, was du trainiert hast, liegt als JSON-Dateien im Ordner `data/` auf
deinem Server — nach Monaten getrennt. Es gibt keine Datenbank und keine
Kopie irgendwo anders, weder auf dem Handy noch bei einem Dienst.

Der Ordner ist von außen gesperrt: Über den Browser kommt niemand daran.

### Begründung

**JSON-Dateien statt Datenbank**, weil das auf jedem gewöhnlichen Webspace
läuft, ohne Einrichtung und ohne laufende Kosten. Die Dateien sind lesbar und
lassen sich mit jedem Texteditor öffnen.

**Nach Monaten getrennt**, damit die Dateien klein bleiben und sich einzeln
sichern lassen.

**Keine automatische Sicherung.** Coach legt von sich aus keine Kopie an.
Verlierst du den Server, verlierst du die Historie.

### Häufige Nutzerfragen

**Wie sichere ich meine Trainingsdaten?**
Lade den Ordner `data/` ab und zu per FTP auf deinen Rechner. Er ist ein paar
Kilobyte groß, das dauert Sekunden. Dann liegen die Daten an zwei Stellen, und
genau darum geht es.

**Kann ich das automatisieren?**
Ja. Es gibt einen schlüsselgeschützten Abruf, der alle Daten auf einmal als
JSON ausgibt, damit ein Cronjob oder ein Automatisierungsdienst sie
regelmäßig abholen kann. Passwort und Schlüssel selbst sind **nicht** im
Export enthalten: Ein Backup, das regelmäßig durch fremde Protokolle läuft,
soll keine Geheimnisse tragen. Verloren geht dabei nichts, was sich nicht neu
setzen ließe — die Trainingsdaten dagegen sind unersetzlich.

**Kann jemand meine Trainingsdaten im Browser aufrufen?**
Nein. Der Datenordner ist gesperrt und antwortet mit einer Fehlerseite. Bei
der Einrichtung legt Coach zusätzlich eine zweite Sperre direkt im Ordner an,
für den Fall, dass die äußere bei einem Update verlorengeht.

**Sind meine Gerätefotos auch geschützt?**
Nein, die liegen bewusst offen, damit sie im Studio schnell laden. Sie zeigen
nur Geräte, keine Personen — und mit der Bildbibliothek GD wird der
Aufnahmeort beim Hochladen entfernt.

**Darf ich Coach selbst benutzen und verändern?**
Ja. Der Code liegt offen auf GitHub unter der MIT-Lizenz. Sie erlaubt jede
Nutzung und Veränderung, verlangt wird nur, dass der Lizenzhinweis im Code
stehen bleibt.

**Was brauche ich, um Coach selbst zu betreiben?**
Einen Webserver mit PHP 8.0 oder neuer und HTTPS. Eine Datenbank brauchst du
nicht, die Daten liegen als Dateien auf deinem Webspace.

<!-- save-help:checkpoint
last-saved: 2026-10-18T09:00:00+02:00
captured-topics:
  - Anmelden und Passwort
  - Was heute dran ist
  - Sätze eintragen im Studio
  - Die Pause zwischen den Sätzen
  - Gepaarte Übungen (Supersets)
  - Wann die Wiederholungen und wann das Gewicht steigen
  - Training ohne Empfang
  - Einheit beenden und Rückblick
  - Der Kalender
  - Die Fortschrittskurve auf der Startseite
  - Der Verlauf einer einzelnen Übung
  - Körpergewicht eintragen
  - Einstellungen: Übungen und Allgemein
  - Fotos und Übungsbilder
  - Die App auf dem Homescreen
  - Wo deine Daten liegen
boundary-hint: |
  Lauf am 18.10.2026 über die Session vom 17.10.2026: Startseite für
  Besucher hinter dem Schalter startseite, MIT-Lizenz, neue
  Progressionsregel nach Frank (Wiederholung mehr nur, wenn alle Sätze das
  Ziel schaffen; einmal Höchstzahl in allen Sätzen heißt sofort mehr
  Gewicht), Beispieltabelle auf der Startseite, Hinweis auf einstellbare
  Sätze, Wiederholungen und Stufe, Logo und Favicon (gelbe Plakette mit
  gezeichnetem C). Zuletzt verarbeitet: Logo und Favicon live.
-->
