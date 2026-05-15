import { CircleHelp, Copy, Loader2, Sparkles, Save, Trash2, Undo2, Bold, List, ListOrdered, ALargeSmall, WandSparkles, Database, FolderOpen } from "lucide-react";

const helpCards = [
  {
    title: "1. Eintrag anlegen",
    text: "Neue Prompts, Code, Workflows oder Notizen werden links in der Bibliothek erstellt. Danach kannst du Inhalt, Kategorie, Tags und Favoriten direkt pflegen.",
    icon: Database,
  },
  {
    title: "2. KI nutzen",
    text: "Mit Titel & Metadaten ausfüllen oder KI-Variante erzeugen ergänzt die App Vorschläge automatisch. Währenddessen zeigt ein rotiertes Symbol, dass die KI gerade arbeitet.",
    icon: Sparkles,
  },
  {
    title: "3. Varianten verstehen",
    text: "Die erste Fassung heißt Original. Zusätzliche Fassungen heißen Variante 1, Variante 2 und Variante 3. Der Status zeigt, ob eine Variante optimiert oder manuell erstellt wurde.",
    icon: WandSparkles,
  },
  {
    title: "4. Editor bedienen",
    text: "Im Editor helfen kleine Schaltflächen für Rückgängig, Fett, Aufzählung, Nummerierung und Schriftgröße. Der Kopier-Button zeigt nach dem Klick ein Häkchen.",
    icon: Copy,
  },
  {
    title: "5. Speichern und Sichern",
    text: "Der Speichern-Button hält die lokale Bibliothek aktuell. Der JSON-Export ist die sichere Austausch- und Backup-Variante für andere Geräte oder ein Archiv.",
    icon: Save,
  },
  {
    title: "6. Aufräumen und löschen",
    text: "Du kannst Einträge duplizieren, als Favorit markieren oder löschen. Die Löschaktion ist bewusst als rote Schaltfläche dargestellt, damit sie sofort erkennbar bleibt.",
    icon: Trash2,
  },
] as const;

const iconLegend = [
  { icon: Undo2, label: "Rückgängig", hint: "letzte Inhaltsänderung zurücknehmen" },
  { icon: Bold, label: "Fett", hint: "markierten Text als Markdown fett einfügen" },
  { icon: List, label: "Liste", hint: "Aufzählung erzeugen" },
  { icon: ListOrdered, label: "Nummer", hint: "nummerierte Liste erzeugen" },
  { icon: ALargeSmall, label: "Textgröße", hint: "Schrift im Editor vergrößern oder normal anzeigen" },
  { icon: Copy, label: "Kopieren", hint: "Inhalt in die Zwischenablage kopieren" },
];

const processSteps = [
  "Eintrag auswählen oder neu anlegen",
  "Inhalt schreiben oder KI-Vorschläge erzeugen",
  "Variante prüfen und bei Bedarf als Original übernehmen",
  "Speichern, kopieren oder als JSON exportieren",
];

export function HelpPage() {
  return (
    <div className="h-screen overflow-y-auto bg-background px-10 py-9">
      <div className="max-w-5xl">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-500 text-white shadow-sm">
            <CircleHelp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Hilfe</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Die wichtigsten Abläufe kurz und klar zusammengefasst. Diese Seite ist als schnelle Orientierung gedacht, nicht als ausführliches Handbuch.
            </p>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {helpCards.map((card) => (
            <article key={card.title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <card.icon className="h-4 w-4" />
                </div>
                <h2 className="text-base font-semibold">{card.title}</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.text}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground">
              <FolderOpen className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold">Kernablauf</h2>
          </div>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {processSteps.map((step, index) => (
              <li key={step} className="flex items-start gap-3 rounded-md border border-border/70 bg-background px-4 py-3 text-sm leading-6 text-foreground">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground">
              <Copy className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold">Icon-Legende im Editor</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {iconLegend.map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-md border border-border/70 bg-background px-4 py-3 text-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
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

        <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <h2 className="text-base font-semibold">Hinweis zu KI-Aktionen</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Wenn die KI arbeitet, bleibt der Button sichtbar und zeigt ein rotierendes Symbol. So ist sofort erkennbar, dass die Anfrage noch läuft und nicht beendet wurde.
          </p>
        </section>
      </div>
    </div>
  );
}
