import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { Ctx } from "../lib/auth.ts";
import { db } from "../lib/db.ts";
import { CORS_HEADERS } from "../lib/http.ts";
import { downloadFile } from "../lib/storage.ts";
import { ymdHi } from "../lib/time.ts";
import { findIncident } from "./records.ts";

const SEVERITY: Record<string, string> = { low: "Faible", medium: "Moyen", high: "Élevé", critical: "Critique" };
const STATUS: Record<string, string> = { open: "Ouvert", in_progress: "En investigation", closed: "Clôturé" };
const PRIORITY: Record<string, string> = { immediate: "Immédiat", urgent: "Urgent", shift: "Dans le quart", prevention: "Prévention" };
const ACTION_STATUS: Record<string, string> = { todo: "À faire", in_progress: "En cours", done: "Fait" };

// Les polices standard PDF n'encodent que WinAnsi : on remplace le reste.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function safe(text: string): string {
  return [...text]
    .map((c) => {
      const code = c.codePointAt(0)!;
      if (c === "\t") return " ";
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(c)) return c;
      if (c === "≤") return "<=";
      if (c === "≥") return ">=";
      if (c === "§") return "§";
      return "?";
    })
    .join("");
}

function hexColor(hex: string | null) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  const n = m ? Number.parseInt(m[1], 16) : 0x0f1b2d;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Petit moteur de mise en page : texte qui passe à la ligne et à la page. */
class Writer {
  page!: PDFPage;
  y = 0;
  readonly margin = 50;
  readonly width = 595.28;
  readonly height = 841.89;

  constructor(private readonly doc: PDFDocument, readonly font: PDFFont, readonly bold: PDFFont) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([this.width, this.height]);
    this.y = this.height - this.margin;
  }

  ensure(h: number) {
    if (this.y - h < this.margin) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const para of safe(text).split(/\r?\n/)) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
        else {
          if (line) lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) {
    const size = o.size ?? 10;
    const font = o.bold ? this.bold : this.font;
    const x = this.margin + (o.indent ?? 0);
    for (const line of this.wrap(text, font, size, this.width - this.margin - x)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: o.color ?? rgb(0.1, 0.14, 0.2) });
      this.y -= size + 4;
    }
    this.y -= o.gap ?? 2;
  }

  heading(text: string) {
    this.y -= 8;
    this.ensure(30);
    this.text(text.toUpperCase(), { size: 9, bold: true, color: rgb(0.4, 0.44, 0.52), gap: 4 });
  }

  keyValue(label: string, value: string) {
    const size = 10;
    const labelW = 150;
    const lines = this.wrap(value || "—", this.font, size, this.width - 2 * this.margin - labelW);
    this.ensure((size + 4) * lines.length);
    this.page.drawText(safe(label), { x: this.margin, y: this.y - size, size, font: this.font, color: rgb(0.4, 0.44, 0.52) });
    for (const line of lines) {
      this.page.drawText(line, { x: this.margin + labelW, y: this.y - size, size, font: this.bold, color: rgb(0.06, 0.1, 0.18) });
      this.y -= size + 4;
    }
    this.y -= 2;
  }
}

/** GET /reports/incidents/{id} — fiche d'audit PDF (encadrement). */
export async function incidentPdf(ctx: Ctx, id: number): Promise<Response> {
  ctx.require("reports.generate");
  const sql = db();
  const inc = await findIncident(sql, ctx.tenant.id, id);
  const actions = await sql<{ position: number; description: string; priority: string; delay_minutes: number | null; responsible_role: string | null; status: string }[]>`
    select position, description, priority, delay_minutes, responsible_role, status
      from operix.incident_actions where incident_id = ${id} order by position, id`;

  const doc = await PDFDocument.create();
  doc.setTitle(`Incident ${inc.reference}`);
  doc.setProducer("OPERIX");
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  const brand = hexColor(ctx.tenant.primary_color);

  // En-tête
  w.page.drawRectangle({ x: 0, y: w.height - 70, width: w.width, height: 70, color: brand });
  w.page.drawText(safe(ctx.tenant.name), { x: w.margin, y: w.height - 38, size: 14, font: w.bold, color: rgb(1, 1, 1) });
  w.page.drawText(safe("Fiche d'audit incident — OPERIX HSSE"), { x: w.margin, y: w.height - 56, size: 9, font: w.font, color: rgb(0.85, 0.88, 0.93) });
  w.y = w.height - 100;

  const a = inc.ai_analysis as Record<string, unknown> | null;
  w.text(`Incident ${inc.reference}`, { size: 18, bold: true, gap: 2 });
  if (a?.category) w.text(String(a.category), { size: 12, color: rgb(0.4, 0.44, 0.52), gap: 8 });

  w.heading("Identification");
  w.keyValue("Référence", inc.reference);
  w.keyValue("Statut", STATUS[inc.status] ?? inc.status);
  w.keyValue("Classification", `${inc.type}${a?.subcategory ? ` • ${a.subcategory}` : ""}`);
  w.keyValue("Gravité", SEVERITY[inc.severity] ?? inc.severity);
  w.keyValue("Date et heure", `${inc.date}${inc.time ? ` ${inc.time}` : ""}`);
  w.keyValue("Emplacement", inc.location);
  if (inc.latitude !== null) w.keyValue("Position GPS", `${inc.latitude.toFixed(5)}, ${inc.longitude!.toFixed(5)}${inc.location_accuracy ? ` (±${Math.round(inc.location_accuracy)} m)` : ""}`);
  w.keyValue("Déclarant", inc.reporter_name ?? "—");
  w.keyValue("Enregistré le", `${ymdHi(inc.created_at)} UTC`);

  w.heading("Constat terrain");
  w.text(inc.description, { gap: 4 });

  if (inc.image) {
    const file = await downloadFile(inc.image);
    if (file && (file.type.includes("jpeg") || file.type.includes("png"))) {
      try {
        const img = file.type.includes("png") ? await doc.embedPng(file.bytes) : await doc.embedJpg(file.bytes);
        const maxW = w.width - 2 * w.margin;
        const scale = Math.min(maxW / img.width, 220 / img.height, 1);
        w.heading("Preuve photo");
        w.ensure(img.height * scale + 8);
        w.page.drawImage(img, { x: w.margin, y: w.y - img.height * scale, width: img.width * scale, height: img.height * scale });
        w.y -= img.height * scale + 8;
      } catch {
        // Image illisible : la fiche reste valable sans elle.
      }
    }
  }

  w.heading("Analyse des causes");
  w.keyValue("Cause immédiate", inc.immediate_cause ?? "—");
  w.keyValue("Cause racine", inc.root_cause ?? (Array.isArray(a?.causes) ? String(a!.causes[0] ?? "—") : "—"));
  if (a) {
    w.keyValue("Moteur d'analyse", a.engine === "ai" ? `Operix AI (${a.model ?? "IA"})` : a.engine === "rules" ? "Moteur de règles" : "Saisie manuelle");
    w.keyValue("Certitude", `${a.confidence ?? 0} %`);
    if (a.aggravating_factor) w.keyValue("Facteur aggravant", String(a.aggravating_factor));
    if (a.legal_reference) w.keyValue("Référentiel", String(a.legal_reference));
  }

  w.heading("Plan d'actions correctives");
  if (actions.length === 0) {
    w.text(inc.corrective_action ?? "Aucun plan d'actions déployé.");
  } else {
    const done = actions.filter((x) => x.status === "done").length;
    w.text(`${done} / ${actions.length} action(s) réalisée(s)`, { bold: true, gap: 4 });
    for (const [i, x] of actions.entries()) {
      const delay = x.delay_minutes === null ? "" : x.delay_minutes < 60 ? ` • ${x.delay_minutes} min` : x.delay_minutes < 1440 ? ` • ${Math.round(x.delay_minutes / 60)} h` : ` • ${Math.round(x.delay_minutes / 1440)} j`;
      w.text(`${i + 1}. ${x.description}`, { bold: true, gap: 0 });
      w.text(`${PRIORITY[x.priority] ?? x.priority}${delay} — ${x.responsible_role ?? "—"} — ${ACTION_STATUS[x.status] ?? x.status}`, { size: 9, indent: 14, color: rgb(0.4, 0.44, 0.52), gap: 4 });
    }
  }

  // Pied de page sur chaque page
  const pages = doc.getPages();
  for (const [i, p] of pages.entries()) {
    p.drawText(safe(`Généré le ${ymdHi(new Date())} UTC par OPERIX — page ${i + 1}/${pages.length}`), { x: w.margin, y: 25, size: 8, font: w.font, color: rgb(0.6, 0.64, 0.7) });
  }

  const bytes = await doc.save();
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="incident-${inc.reference}.pdf"`,
    },
  });
}
