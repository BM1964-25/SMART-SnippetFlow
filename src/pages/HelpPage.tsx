import type { ComponentType, ReactNode } from "react";
import type { AppView } from "@/types";
import { CircleHelp, Copy, Loader2, Sparkles, Save, Undo2, Bold, List, ListOrdered, Type, WandSparkles, Database, FolderOpen, KeyRound, ArrowRight, PanelLeft, LibraryBig, PencilLine, Eye, FilePlus2, Star, Trash2, RotateCcw } from "lucide-react";

const helpCards = [
  {
    title: "Texteditor",
    text: (
      <>
        Im Texteditor helfen kleine Schaltflächen für <strong>Rückgängig</strong>, <strong>Fett</strong>, <strong>Aufzählung</strong>, <strong>Nummerierung</strong>, <strong>Textgröße</strong> und <strong>Kopieren</strong>. <strong>Fett</strong> arbeitet als Markdown-Formatierung, die Erklärungen erscheinen beim Überfahren der Symbole mit der Maus.
      </>
    ),
    icon: Copy,
  },
  {
    title: "Lokale Speicherung",
    text: (
      <>
        <strong>Speichern</strong> hält den aktuellen Stand in der lokalen Bibliothek des Browsers fest. Die Daten bleiben auf diesem Gerät und in diesem Browser erhalten, solange die Website-Daten nicht gelöscht werden. Für Austausch und Backup nutzt du zusätzlich <strong>Projektdatei speichern</strong>.
      </>
    ),
    icon: Save,
  },
  {
    title: "Dateien und Export",
    text: (
      <>
        Die <strong>Projektdatei</strong> speicherst du als <strong>JSON-Datei</strong> für <strong>Backup</strong> oder <strong>Austausch</strong>. Der Export wird im Browser normalerweise im <strong>Downloads-Ordner</strong> vorgeschlagen. Die Hinweise dazu findest du im Bereich <strong>Einstellungen</strong> unter <strong>Datenmanagement</strong>.
      </>
    ),
    icon: FolderOpen,
  },
  {
    title: "API-Key und KI",
    text: (
      <>
        Der <strong>Anthropic API-Key</strong> wird in den <strong>Einstellungen</strong> lokal gespeichert und nur verwendet, wenn du aktiv eine <strong>KI-Aktion</strong> startest. Ohne API-Key können keine KI-Vorschläge erzeugt werden. Für andere Nutzer muss der Schlüssel auf deren Gerät ebenfalls eingerichtet werden.
      </>
    ),
    icon: KeyRound,
  },
] as const satisfies Array<{ title: string; text: ReactNode; icon: ComponentType<{ className?: string }> }>;

const iconLegend = [
  { icon: Undo2, label: "Rückgängig", hint: "letzte Inhaltsänderung zurücknehmen" },
  { icon: Bold, label: "Fett", hint: "markierten Text als Markdown fett markieren" },
  { icon: List, label: "Aufzählung", hint: "eine einfache Liste erzeugen" },
  { icon: ListOrdered, label: "Nummeriert", hint: "eine nummerierte Liste erzeugen" },
  { icon: Type, label: "Textgröße", hint: "größere oder normale Editor-Schrift" },
  { icon: Copy, label: "Kopieren", hint: "Inhalt in die Zwischenablage kopieren" },
];

const processSteps = [
  "In der Bibliothek einen Typ auswählen, zum Beispiel Prompts, Code, Workflows oder Notizen, und danach auf den Button NEU klicken.",
  "Den Inhalt passend zum gewählten Typ im Editor eingeben.",
  "Metadaten wie Titel, Beschreibung, Kategorie und Tags festlegen oder bei aktiver API-Verbindung per KI ergänzen lassen.",
  "Speichern, duplizieren, als Favorit markieren oder löschen.",
];

const actionGuide = {
  title: "Eintragsaktionen",
  items: [
    { label: "Speichern", text: "übernimmt den aktuellen Stand in die lokale Bibliothek.", icon: Save },
    { label: "Änderungen verwerfen", text: "setzt nicht gespeicherte Änderungen zurück.", icon: RotateCcw },
    { label: "Kopieren", text: "legt den Inhalt in die Zwischenablage.", icon: Copy },
    { label: "Duplizieren", text: "erstellt eine neue Kopie des Eintrags.", icon: FilePlus2 },
    { label: "Favorit", text: "markiert wichtige Inhalte.", icon: Star },
    { label: "Löschen", text: "entfernt den Eintrag nach Bestätigung.", icon: Trash2 },
  ],
} as const;

const aiByTypeCards = [
  {
    title: "Prompt",
    text: (
      <>
        <strong>Titel & Metadaten ausfüllen</strong> ergänzt Metadaten und kann Varianten vorbereiten. Zusätzlich steht <strong>KI-Variante</strong> zur Verfügung, um neue Fassungen zu erzeugen.
      </>
    ),
  },
  {
    title: "Code",
    text: (
      <>
        <strong>Titel & Metadaten ausfüllen</strong> hilft beim Einordnen des Snippets, etwa mit Titel, Beschreibung, Kategorie und Tags. <strong>KI-Variante</strong> wird hier nicht verwendet.
      </>
    ),
  },
  {
    title: "Workflow",
    text: (
      <>
        Die KI kann Workflows strukturieren, knappe Beschreibungen schreiben und die Metadaten vervollständigen. Varianten gibt es für diesen Typ nicht.
      </>
    ),
  },
  {
    title: "Notiz",
    text: (
      <>
        Notizen lassen sich von der KI zusammenfassen, strukturieren und mit passenden Metadaten versehen. Auch hier bleibt die Variantenlogik Prompts vorbehalten.
      </>
    ),
  },
] as const satisfies Array<{ title: string; text: ReactNode }>;

const screenAreas = [
  {
    title: "Sidebar",
    text: "Ganz links liegt die Sidebar mit Navigation und Bereichen. Hier wechselst du zwischen Bibliothek, Einstellungen und Hilfe.",
    tone: "border-sky-200 border-l-sky-500 bg-sky-50/70 text-sky-950",
    icon: PanelLeft,
  },
  {
    title: "Bibliothek",
    text: "In der Mitte siehst du deine Einträge, Filter und die Suche. Hier wählst du aus, was du bearbeiten möchtest.",
    tone: "border-emerald-200 border-l-emerald-500 bg-emerald-50/70 text-emerald-950",
    icon: LibraryBig,
  },
  {
    title: "Rechter Bereich",
    text: "Rechts bearbeitest du zuerst Titel, Beschreibung, Kategorie und Tags. Danach folgt der Prompt oder Ausgangstext, ergänzt um KI-Funktionen und Varianten.",
    tone: "border-amber-200 border-l-amber-500 bg-amber-50/70 text-amber-950",
    icon: PencilLine,
  },
  {
    title: "Vorschau (rechts unten)",
    text: "Unten rechts erscheint bei passenden Typen die Vorschau. Sie ist bewusst vom Bearbeitungsbereich getrennt, damit du das Ergebnis direkt prüfen kannst.",
    tone: "border-violet-200 border-l-violet-500 bg-violet-50/70 text-violet-950 ring-1 ring-violet-100/80",
    icon: Eye,
  },
] as const satisfies Array<{ title: string; text: ReactNode; tone: string; icon: ComponentType<{ className?: string }> }>;

const navigationLinks = [
  { label: "Zur Bibliothek", view: "all" as AppView, hint: "Einträge anlegen, auswählen und bearbeiten" },
  { label: "Zu den Einstellungen", view: "settings" as AppView, hint: "API-Key und KI-Verhalten verwalten" },
];

export function HelpPage({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  return (
    <div className="h-screen overflow-y-auto bg-background px-8 py-8">
      <div className="max-w-5xl">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-500 text-white shadow-sm">
            <CircleHelp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Hilfe</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              <strong>SMART SnippetFlow</strong> bündelt deine Inhalte in einer zentralen Bibliothek für <strong>Prompts</strong>, <strong>Code</strong>, <strong>Workflows</strong> und <strong>Notizen</strong>. Du kannst Einträge anlegen, Varianten erzeugen, Texte im Editor bearbeiten, per Klick speichern oder duplizieren und bei Bedarf mit KI Vorschläge erzeugen. Diese Hilfe fasst die wichtigsten Abläufe kompakt zusammen und erklärt die KI-Hilfen je Typ.
            </p>
          </div>
        </div>

        <section className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Schnellzugriff auf Menüseiten</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Die wichtigsten Bereiche erreichst du direkt über die folgenden Seiten.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {navigationLinks.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.view)}
                className="group w-full rounded-md border border-border bg-background px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
                <span className="block text-xs leading-5 text-muted-foreground">{item.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
              <FolderOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Bildschirmbereiche</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Drei klar getrennte Bereiche helfen bei der Orientierung. Die Farben sind bewusst dezent gehalten.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {screenAreas.map((area) => (
              <article key={area.title} className={`flex min-h-36 flex-col rounded-xl border p-4 shadow-sm ${area.tone}`}>
                <div className="flex items-center gap-2">
                  <area.icon className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">{area.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 opacity-90">{area.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
              <Save className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold">{actionGuide.title}</h2>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {actionGuide.items.map((item) => (
              <article key={item.label} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background px-3 py-3 text-sm leading-6 text-muted-foreground shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">KI je Eintragstyp</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Die KI reagiert je nach Inhaltstyp unterschiedlich. Nur Prompts bekommen zusätzlich Varianten.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {aiByTypeCards.map((item) => (
              <article key={item.title} className="rounded-md border border-border/70 bg-background p-3">
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
              <FolderOpen className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold">Bearbeitungsschritte</h2>
          </div>
          <ol className="mt-3 grid gap-3 md:grid-cols-2">
            {processSteps.map((step, index) => (
              <li key={step} className="flex items-start gap-3 rounded-md border border-border/70 bg-background px-4 py-3 text-sm leading-6 text-foreground">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {helpCards.map((card) => (
            <article key={card.title} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <card.icon className="h-4 w-4" />
                </div>
                <h2 className="text-base font-semibold">{card.title}</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.text}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
              <Copy className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold">Icon-Legende im Editor</h2>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {iconLegend.map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-md border border-border/70 bg-background px-4 py-3 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{item.hint}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <h2 className="text-base font-semibold">API-Key und KI-Aktionen</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Der Anthropic API-Key wird in den Einstellungen lokal hinterlegt und nur verwendet, wenn du aktiv eine KI-Funktion startest. Wenn die KI arbeitet, bleibt der Button sichtbar und zeigt ein rotierendes Symbol. So ist sofort erkennbar, dass die Anfrage noch läuft und nicht beendet wurde.
          </p>
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            Für den Betrieb auf einem anderen Gerät muss dort ebenfalls ein gültiger API-Key in den Einstellungen eingetragen werden. Die Hilfe und die Einstellungen ersetzen keine technische Dokumentation, zeigen dir aber den praktischen Ablauf im Alltag.
          </div>
        </section>
      </div>
    </div>
  );
}
