<?php
/*
 * Startseite für Besucher, die nicht angemeldet sind.
 *
 * Nur aktiv, wenn in data/config.json "startseite": true steht. Ohne den
 * Schalter zeigt index.php die schlichte Anmeldung: Wer Coach aus dem Repo
 * installiert, bekommt keine Werbeseite für Cato Services.
 *
 * Das Anmeldeformular trägt dieselben Kennungen wie die schlichte
 * Anmeldung (#anmeldung, #passwort, #anmelden, #fehler), deshalb bedient
 * assets/app.js beide ohne Unterschied.
 *
 * Die Symbole stammen aus Phosphor Icons (MIT-Lizenz) und stehen als
 * Sprite in der Seite, damit nichts von fremden Servern geladen wird.
 */
?>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <symbol id="ph-barbell" viewBox="0 0 256 256"><path d="M248,120h-8V88a16,16,0,0,0-16-16H208V64a16,16,0,0,0-16-16H168a16,16,0,0,0-16,16v56H104V64A16,16,0,0,0,88,48H64A16,16,0,0,0,48,64v8H32A16,16,0,0,0,16,88v32H8a8,8,0,0,0,0,16h8v32a16,16,0,0,0,16,16H48v8a16,16,0,0,0,16,16H88a16,16,0,0,0,16-16V136h48v56a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16v-8h16a16,16,0,0,0,16-16V136h8a8,8,0,0,0,0-16ZM32,168V88H48v80Zm56,24H64V64H88V192Zm104,0H168V64h24V175.82c0,.06,0,.12,0,.18s0,.12,0,.18V192Zm32-24H208V88h16Z"/></symbol>
    <symbol id="ph-calendar-blank" viewBox="0 0 256 256"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z"/></symbol>
    <symbol id="ph-calendar-check" viewBox="0 0 256 256"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-38.34-85.66a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L116,164.69l42.34-42.35A8,8,0,0,1,169.66,122.34Z"/></symbol>
    <symbol id="ph-camera" viewBox="0 0 256 256"><path d="M208,56H180.28L166.65,35.56A8,8,0,0,0,160,32H96a8,8,0,0,0-6.65,3.56L75.71,56H48A24,24,0,0,0,24,80V192a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a8,8,0,0,0,6.66-3.56L100.28,48h55.43l13.63,20.44A8,8,0,0,0,176,72h32a8,8,0,0,1,8,8ZM128,88a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,88Zm0,72a28,28,0,1,1,28-28A28,28,0,0,1,128,160Z"/></symbol>
    <symbol id="ph-chart-line-up" viewBox="0 0 256 256"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0V156.69l50.34-50.35a8,8,0,0,1,11.32,0L128,132.69,180.69,80H160a8,8,0,0,1,0-16h40a8,8,0,0,1,8,8v40a8,8,0,0,1-16,0V91.31l-58.34,58.35a8,8,0,0,1-11.32,0L96,123.31l-56,56V200H224A8,8,0,0,1,232,208Z"/></symbol>
    <symbol id="ph-check-circle" viewBox="0 0 256 256"><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></symbol>
    <symbol id="ph-github-logo" viewBox="0 0 256 256"><path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z"/></symbol>
    <symbol id="ph-hand-tap" viewBox="0 0 256 256"><path d="M56,76a60,60,0,0,1,120,0,8,8,0,0,1-16,0,44,44,0,0,0-88,0,8,8,0,1,1-16,0Zm140,44a27.9,27.9,0,0,0-13.36,3.39A28,28,0,0,0,144,106.7V76a28,28,0,0,0-56,0v80l-3.82-6.13a28,28,0,0,0-48.41,28.17l29.32,50A8,8,0,1,0,78.89,220L49.6,170a12,12,0,1,1,20.78-12l.14.23,18.68,30A8,8,0,0,0,104,184V76a12,12,0,0,1,24,0v68a8,8,0,1,0,16,0V132a12,12,0,0,1,24,0v20a8,8,0,0,0,16,0v-4a12,12,0,0,1,24,0v36c0,21.61-7.1,36.3-7.16,36.42a8,8,0,0,0,3.58,10.73A7.9,7.9,0,0,0,208,232a8,8,0,0,0,7.16-4.42c.37-.73,8.85-18,8.85-43.58V148A28,28,0,0,0,196,120Z"/></symbol>
    <symbol id="ph-hard-drives" viewBox="0 0 256 256"><path d="M208,136H48a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,64H48V152H208v48Zm0-160H48A16,16,0,0,0,32,56v48a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V56A16,16,0,0,0,208,40Zm0,64H48V56H208v48ZM192,80a12,12,0,1,1-12-12A12,12,0,0,1,192,80Zm0,96a12,12,0,1,1-12-12A12,12,0,0,1,192,176Z"/></symbol>
    <symbol id="ph-timer" viewBox="0 0 256 256"><path d="M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM173.66,90.34a8,8,0,0,1,0,11.32l-40,40a8,8,0,0,1-11.32-11.32l40-40A8,8,0,0,1,173.66,90.34ZM96,16a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,16Z"/></symbol>
    <symbol id="ph-wifi-slash" viewBox="0 0 256 256"><path d="M213.92,210.62a8,8,0,1,1-11.84,10.76l-52-57.15a60,60,0,0,0-57.41,7.24,8,8,0,1,1-9.42-12.93A75.43,75.43,0,0,1,128,144c1.28,0,2.55,0,3.82.1L104.9,114.49A108,108,0,0,0,61,135.31,8,8,0,0,1,49.73,134,8,8,0,0,1,51,122.77a124.27,124.27,0,0,1,41.71-21.66L69.37,75.4a155.43,155.43,0,0,0-40.29,24A8,8,0,0,1,18.92,87,171.87,171.87,0,0,1,58,62.86L42.08,45.38A8,8,0,1,1,53.92,34.62ZM128,192a12,12,0,1,0,12,12A12,12,0,0,0,128,192ZM237.08,87A172.3,172.3,0,0,0,106,49.4a8,8,0,1,0,2,15.87A158.33,158.33,0,0,1,128,64a156.25,156.25,0,0,1,98.92,35.37A8,8,0,0,0,237.08,87ZM195,135.31a8,8,0,0,0,11.24-1.3,8,8,0,0,0-1.3-11.24,124.25,124.25,0,0,0-51.73-24.2A8,8,0,1,0,150,114.24,108.12,108.12,0,0,1,195,135.31Z"/></symbol>
    <symbol id="ph-x-circle" viewBox="0 0 256 256"><path d="M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></symbol>
</svg>

<header class="kopf">
  <div class="innen">
    <a class="marke" href="#"><img src="assets/icons/logo.svg" alt="" width="30" height="30">COACH</a>
    <nav>
      <a class="knopf" href="https://github.com/franknitze/coach"><svg class="sym" aria-hidden="true"><use href="#ph-github-logo"/></svg><span>GitHub</span></a>
      <a class="knopf knopf--gelb" href="https://tidycal.com/cato-services/erstgespraech"><svg class="sym" aria-hidden="true"><use href="#ph-calendar-check"/></svg><span>Erstgespräch buchen</span></a>
    </nav>
  </div>
</header>

<main>
  <section class="einstieg">
    <div class="innen">
      <p class="teaser">Kostenlos, einfach selbst installieren.</p>
      <h1>Die Trainings-App, die auch offline weiterarbeitet</h1>
      <p class="unter">Coach führt dich durch jede Einheit im Studio, speichert jeden Satz sofort und sagt dir, wann das Gewicht hochgeht.</p>
      <p class="voraussetzung"><svg class="sym" aria-hidden="true"><use href="#ph-hard-drives"/></svg>Einzige Systemvoraussetzung: ein Webserver mit ≥ PHP 8.0 und HTTPS</p>
      <div class="aktionen aktionen--oben">
        <a class="knopf knopf--gelb" href="https://tidycal.com/cato-services/erstgespraech"><svg class="sym" aria-hidden="true"><use href="#ph-calendar-check"/></svg>Erstgespräch buchen</a>
        <a class="knopf" href="https://github.com/franknitze/coach"><svg class="sym" aria-hidden="true"><use href="#ph-github-logo"/></svg>Code auf GitHub</a>
      </div>
      <form class="anmeldung" id="anmeldung" novalidate>
        <h2>Anmelden</h2>
        <p>Danach 30 Tage angemeldet.</p>
        <label for="passwort">PASSWORT</label>
        <div class="zeile">
          <input id="passwort" type="password" name="password" autocomplete="current-password" required>
          <button class="knopf knopf--gelb" type="submit" id="anmelden">Anmelden</button>
        </div>
        <p class="fehler" id="fehler" role="alert"></p>
      </form>
    </div>
  </section>

  <section class="leiste" aria-label="Alle Bildschirme der App">
    <div class="leiste__spur">
      <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/start.jpg" alt="Startseite mit dem heutigen Trainingstag, Fortschrittskurve und den letzten Einheiten" loading="eager"></div><figcaption><b>Startseite</b>Heute dran ist der nächste Tag im Wechsel.</figcaption></figure>
      <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/studio.jpg" alt="Studio-Ansicht mit Reglern für Gewicht und Wiederholungen" loading="lazy"></div><figcaption><b>Studio</b>Die Regler stehen schon auf deinem Ziel.</figcaption></figure>
      <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/pause.jpg" alt="Pausen-Anzeige mit ablaufender Zeit" loading="lazy"></div><figcaption><b>Pause</b>Läuft nach jedem Satz von selbst ab.</figcaption></figure>
      <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/lupe.jpg" alt="Großansicht eines Geräts mit Gerätenummer und Ausführung" loading="lazy"></div><figcaption><b>Gerät und Ausführung</b>Foto, Nummer am Gerät und wie die Übung geht.</figcaption></figure>
      <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/einheit.jpg" alt="Abgeschlossene Einheit mit allen Sätzen" loading="lazy"></div><figcaption><b>Einheit</b>Jeder Satz jeder Übung, nachlesbar.</figcaption></figure>
      <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/kalender.jpg" alt="Monatskalender mit Trainingstagen" loading="lazy"></div><figcaption><b>Kalender</b>Wie regelmäßig du trainierst.</figcaption></figure>
      <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/verlauf.jpg" alt="Verlauf einer Übung mit Diagrammen für Gewicht und Volumen" loading="lazy"></div><figcaption><b>Verlauf</b>Schwerstes Gewicht und Volumen je Übung.</figcaption></figure>
      <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/verlauf-unten.jpg" alt="Formular zum Anpassen einer Übung" loading="lazy"></div><figcaption><b>Übung anpassen</b>Gerätenummer, Tag, Sätze, Wiederholungen.</figcaption></figure>
      <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/einstellungen.jpg" alt="Liste aller Übungen in den Einstellungen" loading="lazy"></div><figcaption><b>Übungen</b>25 Übungen für Muskelaufbau, schon angelegt.</figcaption></figure>
      <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/allgemein.jpg" alt="Einstellungen für Körpergewicht und Passwort" loading="lazy"></div><figcaption><b>Allgemein</b>Körpergewicht mit Datum, Passwort.</figcaption></figure>
    </div>
  </section>

  <section class="abschnitt">
    <div class="innen">
      <div class="paar">
        <div>
          <h2 class="gross">Gebaut für das Studio, nicht für das Sofa.</h2>
          <p class="text">Im Studio hast du schlechten Empfang, verschwitzte Finger und zwei Minuten Pause. Darauf ist jede Ansicht ausgelegt.</p>
          <ul class="punkte">
            <li><svg class="sym" aria-hidden="true"><use href="#ph-hand-tap"/></svg><div><b>Einfache Bedienung mit dem Daumen</b><span>Große Plus- und Minusknöpfe. Eine Tastatur brauchst du nie.</span></div></li>
            <li><svg class="sym" aria-hidden="true"><use href="#ph-timer"/></svg><div><b>2 Minuten Pause nach jedem Satz</b><span>Nach jedem Satz zählt die Pause herunter, damit deine Muskeln die nötige Pause bekommen.</span></div></li>
            <li><svg class="sym" aria-hidden="true"><use href="#ph-wifi-slash"/></svg><div><b>Läuft ohne Netz</b><span>Jeder Satz liegt zuerst auf dem Handy und geht zum Server, sobald wieder Empfang da ist.</span></div></li>
          </ul>
        </div>
        <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/pause.jpg" alt="Pause nach einem bestätigten Satz" loading="lazy"></div></figure>
      </div>
      <div class="paar paar--links">
        <figure class="handy"><div class="handy__rahmen"><img src="assets/img/startseite/studio.jpg" alt="Regler mit dem Ziel für den nächsten Satz" loading="lazy"></div></figure>
        <div>
          <h2 class="gross">Du siehst nur noch, was du heute schaffen sollst.</h2>
          <p class="text">Coach rechnet nach doppelter Progression: erst die Wiederholungen bis zur Obergrenze, dann mehr Gewicht. Das Ziel steht schon im Feld. Schaffst du es, tippst du nur auf „Satz bestätigen“.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="abschnitt" id="beispiel">
    <div class="innen">
      <h2 class="gross">Beispielübung</h2>
      <p class="text">3 Sätze, Bereich 6 bis 10 Wiederholungen, Startgewicht 50 kg.</p>
      <p class="text">Die Anzahl der Sätze, der Bereich der Wiederholungen und die Gewichtsstufe sind für jede Übung individuell einstellbar. Das Startgewicht wählst du beim ersten Training selbst.</p>
      <div class="tabelle-rahmen">
        <table class="tabelle">
          <thead><tr><th>Training</th><th>Gewicht</th><th>Ziel</th><th>Geschafft</th><th>Ergebnis</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>50 kg</td><td>6</td><td>6, 6, 6</td><td>Übung geschafft</td></tr>
            <tr><td>2</td><td>50 kg</td><td>7</td><td>7, 7, 7</td><td>Übung geschafft</td></tr>
            <tr class="ist-verfehlt"><td>3</td><td>50 kg</td><td>8</td><td>8, 8, 6</td><td>Übung nicht geschafft</td></tr>
            <tr><td>4</td><td>50 kg</td><td>8</td><td>8, 8, 8</td><td>Übung geschafft</td></tr>
            <tr><td>5</td><td>50 kg</td><td>9</td><td>9, 9, 9</td><td>Übung geschafft</td></tr>
            <tr><td>6</td><td>50 kg</td><td>10</td><td>10, 10, 10</td><td>Übung geschafft</td></tr>
            <tr class="ist-hoch"><td>7</td><td>55 kg</td><td>6</td><td>6, 6, 6</td><td>Übung geschafft, neues Gewicht</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="abschnitt">
    <div class="innen">
      <h2 class="gross">Alles, was ein Trainingsprotokoll braucht. Mehr nicht.</h2>
      <div class="raster">
        <div class="feld feld--breit">
          <div><svg class="sym" aria-hidden="true"><use href="#ph-chart-line-up"/></svg><h3>Fortschritt in einer Zahl</h3><p>Jede Einheit bekommt einen Wert, verglichen mit deinem Start. Abgebrochene Einheiten drücken ihn nicht.</p></div>
          <img src="assets/img/startseite/start.jpg" alt="Fortschrittskurve auf der Startseite" loading="lazy">
        </div>
        <div class="feld"><svg class="sym" aria-hidden="true"><use href="#ph-barbell"/></svg><h3>Fertiger Plan für Muskelaufbau</h3><p>Nach der Installation ist ein Plan angelegt, der gezielt auf Muskelaufbau ausgerichtet ist: drei Trainingstage im Wechsel.</p><p>Oberkörper, Ganzkörper, Unterkörper</p><p>25 Übungen mit Bild. Du kannst sofort loslegen.</p></div>
        <div class="feld"><svg class="sym" aria-hidden="true"><use href="#ph-camera"/></svg><h3>Finde das nächste Gym-Gerät für deine Übung</h3><p>Füge einfach ein Foto des Geräts oder seine Nummer hinzu.</p></div>
        <div class="feld"><svg class="sym" aria-hidden="true"><use href="#ph-calendar-blank"/></svg><h3>Kalender</h3><p>Du siehst deine Trainingseinheiten im Monat auf einen Blick, auch die Lücken.</p></div>
        <div class="feld"><svg class="sym" aria-hidden="true"><use href="#ph-hard-drives"/></svg><h3>Deine Daten bleiben bei dir</h3><p>Coach läuft auf deinem eigenen Webspace. Kein Konto bei einem Anbieter, keine Werbung.</p></div>
      </div>
    </div>
  </section>

  <section class="abschnitt">
    <div class="innen">
      <h2 class="gross">Seit August im echten Einsatz.</h2>
      <p class="text">Coach entstand für ein eigenes Training und ist seitdem im Studio dabei. Die Zahlen stammen aus diesem Einsatz.</p>
      <div class="zahlen">
        <div class="zahl"><strong>22</strong><p>Einheiten seit dem 19. August</p></div>
        <div class="zahl"><strong>120,9</strong><p>Höchster Fortschrittswert, gestartet bei 100</p></div>
        <div class="zahl"><strong>25</strong><p>Übungen, jede mit Bild</p></div>
      </div>
      <p class="fuss-notiz">Stand 17.10.2026, aus der laufenden Installation.</p>
    </div>
  </section>

  <section class="abschnitt">
    <div class="innen">
      <h2 class="gross">In drei Schritten auf deinem Handy.</h2>
      <ol class="schritte">
        <li><h3>Code laden</h3><p>Den Inhalt des Repos von GitHub herunterladen.</p></li>
        <li><h3>Hochladen</h3><p>Auf einen Webspace mit PHP 8 und HTTPS. Eine Datenbank brauchst du nicht.</p></li>
        <li><h3>Passwort setzen</h3><p>Adresse öffnen, Passwort festlegen, über Safari auf den Homescreen legen.</p></li>
      </ol>
    </div>
  </section>

  <section class="abschnitt">
    <div class="innen">
      <h2 class="gross">Passt Coach zu dir?</h2>
      <div class="wen">
        <div class="ja"><h3><svg class="sym" aria-hidden="true"><use href="#ph-check-circle"/></svg>Für dich, wenn du</h3><ul><li>regelmäßig an Geräten und Hanteln trainierst</li><li>Muskeln aufbauen willst</li><li>wissen willst, wann du steigern kannst</li><li>deine Daten nicht bei einem Anbieter lassen willst</li></ul></div>
        <div><h3><svg class="sym" aria-hidden="true"><use href="#ph-x-circle"/></svg>Nicht für dich, wenn du</h3><ul><li>Läufe, Kurse oder Ernährung erfassen willst</li><li>einen Trainer in einer App suchst, der mit dir spricht</li><li>mehrere Personen in einer Installation verwalten willst</li></ul></div>
      </div>
    </div>
  </section>

  <section class="abschnitt">
    <div class="innen">
      <h2 class="gross">Häufige Fragen</h2>
      <div class="fragen">
        <details><summary>Kostet Coach etwas?</summary><p>Nein. Der Code liegt offen auf GitHub. Du brauchst nur einen Webspace mit PHP und HTTPS.</p></details>
        <details><summary>Brauche ich eine Datenbank?</summary><p>Nein. Coach speichert alles in JSON-Dateien auf deinem Webspace. Hochladen genügt.</p></details>
        <details><summary>Läuft Coach auf dem iPhone?</summary><p>Ja. Leg die Seite über Safari auf den Homescreen. Dann öffnet sie sich wie eine App, auch ohne Netz.</p></details>
        <details><summary>Was passiert, wenn im Studio kein Empfang ist?</summary><p>Du trainierst weiter wie immer. Jeder bestätigte Satz liegt zuerst auf dem Handy und geht zum Server, sobald wieder Netz da ist.</p></details>
        <details><summary>Kann ich den Plan ändern?</summary><p>Ja. Übungen anlegen, ändern und löschen geht in den Einstellungen, mit Sätzen, Wiederholungsbereich, Schrittweite und Gerätenummer.</p></details>
        <details><summary>Wer hilft mir beim Einrichten?</summary><p>Buch ein Erstgespräch. Dort klären wir, ob Coach zu dir passt und wie es auf deinen Server kommt.</p></details>
      </div>
    </div>
  </section>

  <section class="schluss">
    <div class="innen">
      <h2 class="gross">Du willst Coach bei dir einrichten?</h2>
      <p class="text">Oder du hast eine eigene Idee für eine Anwendung, die genau so zu deinem Alltag passen soll. Lass uns darüber sprechen.</p>
      <div class="aktionen">
        <a class="knopf knopf--gelb" href="https://tidycal.com/cato-services/erstgespraech"><svg class="sym" aria-hidden="true"><use href="#ph-calendar-check"/></svg>Erstgespräch buchen</a>
        <a class="knopf" href="https://github.com/franknitze/coach"><svg class="sym" aria-hidden="true"><use href="#ph-github-logo"/></svg>Code auf GitHub</a>
      </div>
    </div>
  </section>
</main>

<footer class="fuss">
  <div class="innen">
    <span>Coach, eine Anwendung von Cato Services</span>
    <nav><a href="https://cato-services.de/impressum.html">Impressum</a><a href="https://cato-services.de/datenschutz.html">Datenschutz</a><a href="https://github.com/franknitze/coach">GitHub</a></nav>
  </div>
</footer>
