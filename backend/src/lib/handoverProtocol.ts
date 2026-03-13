import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HandoverProtocol } from "../types";

const DEALER_NAME = "MainAuto Miltenberg Manuel Rui Fernandes";
const DEALER_ADDRESS = "Mainzer Str. 10 + 37";
const DEALER_CITY = "63897 Miltenberg";
const DEALER_WEB = "www.mainauto.eu";
const DEALER_EMAIL = "mainauto@gmail.com";
const DEALER_PHONE = "+49(0)9371-5054245";
const DEALER_TAX_ID = "DE196691148";
const DEALER_BANK = "Sparkasse Odenwaldkreis";
const DEALER_IBAN = "DE 59 5085 1952 0000 1147 77";
const DEALER_BIC = "HELADEF1ERB";
const DAMAGE_SKETCH_FILE = join(import.meta.dir, "../../webapp/public/car_vector.png");
const LOGO_DATA_URI = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 110"><rect width="320" height="110" fill="transparent"/><text x="8" y="70" font-family="Arial, Helvetica, sans-serif" font-size="72" font-style="italic" font-weight="700" fill="#0a3dff">M</text><text x="72" y="86" font-family="Georgia, Times New Roman, serif" font-size="96" font-style="italic" font-weight="700" fill="#e32119">A</text><text x="150" y="82" font-family="Arial, Helvetica, sans-serif" font-size="74" font-style="italic" font-weight="700" fill="#111111">uto</text></svg>`)}`;
const DAMAGE_SKETCH_DATA_URI = existsSync(DAMAGE_SKETCH_FILE)
  ? `data:image/png;base64,${readFileSync(DAMAGE_SKETCH_FILE).toString("base64")}`
  : "";

interface VehicleSnapshot {
  vehicleNumber: string;
  brand: string;
  model: string;
  color: string | null;
  mileage: number;
  vin: string | null;
  fuelType: string | null;
  customerId: string | null;
}

interface CustomerSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  email: string | null;
  phone: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function valueOrBlank(value: string | null | undefined): string {
  return value ? escapeHtml(value) : "&nbsp;";
}

function checkbox(checked: boolean): string {
  return `<span class="checkbox">${checked ? "&#10003;" : "&nbsp;"}</span>`;
}

function fieldRow(label: string, value: string, small = false): string {
  return `
    <div class="field-row${small ? " field-row-small" : ""}">
      <span class="field-label">${escapeHtml(label)}</span>
      <span class="field-value">${valueOrBlank(value)}</span>
    </div>
  `;
}

function checkItem(label: string, checked: boolean, extra = ""): string {
  return `
    <div class="check-item">
      ${checkbox(checked)}
      <span>${escapeHtml(label)}${extra}</span>
    </div>
  `;
}

function describeExterior(value: HandoverProtocol["condition"]["exterior"]): string {
  switch (value) {
    case "washed":
      return "gewaschen";
    case "lightly_soiled":
      return "leicht verschmutzt";
    case "heavily_soiled":
      return "stark verschmutzt";
    default:
      return "";
  }
}

function describeInterior(value: HandoverProtocol["condition"]["interior"]): string {
  switch (value) {
    case "clean":
      return "sauber";
    case "lightly_soiled":
      return "leicht verschmutzt";
    case "heavily_soiled":
      return "stark verschmutzt";
    default:
      return "";
  }
}

function describeFuelLevel(value: HandoverProtocol["condition"]["fuelLevel"]): string {
  switch (value) {
    case "empty":
      return "leer";
    case "quarter":
      return "1/4";
    case "half":
      return "1/2";
    case "three_quarters":
      return "3/4";
    case "full":
      return "voll";
    default:
      return "";
  }
}

function describeWheelCondition(value: HandoverProtocol["mountedWheels"]["condition"]): string {
  switch (value) {
    case "new":
      return "neu";
    case "like_new":
      return "neuwertig";
    case "used":
      return "gebraucht";
    case "worn":
      return "abgefahren";
    default:
      return "";
  }
}

function getLogoImgHtml(className: string, logoSrc: string = LOGO_DATA_URI): string {
  return `<img src="${logoSrc}" alt="MainAuto" class="${className}" />`;
}

function getDealerHeaderHtml(logoSrc: string = LOGO_DATA_URI): string {
  return `
    <div class="dealer-header">
      <div class="dealer-brand">
        ${getLogoImgHtml("dealer-logo", logoSrc)}
        <div>
          <div class="dealer-name">${DEALER_NAME}</div>
          <div class="dealer-sub">${DEALER_ADDRESS} &bull; ${DEALER_CITY} &bull; Tel. ${DEALER_PHONE} &bull; Web: ${DEALER_WEB} &bull; Mail: ${DEALER_EMAIL} &bull; USt-IdNr. ${DEALER_TAX_ID}</div>
        </div>
      </div>
    </div>
  `;
}

function getDealerFooterHtml(): string {
  return `
    ${DEALER_NAME} &bull; ${DEALER_ADDRESS} &bull; ${DEALER_CITY}<br>
    E-Mail: ${DEALER_EMAIL} &bull; Tel. ${DEALER_PHONE} &bull; Web: ${DEALER_WEB}<br>
    ${DEALER_BANK} &bull; IBAN: ${DEALER_IBAN} &bull; BIC: ${DEALER_BIC}<br>
    USt-IdNr. ${DEALER_TAX_ID} &bull; Vertretungsberechtigt: Manuel Rui Fernandes
  `;
}

function renderSketchHtml(markers: HandoverProtocol["damage"]["markers"]): string {
  const markerHtml = markers
    .map((marker) => {
      const cx = marker.x;
      const cy = marker.y;
      return `<circle cx="${cx}" cy="${cy}" r="2.9" class="damage-marker" />`;
    })
    .join("");

  return `
    <div class="damage-sketch-canvas" aria-hidden="true">
      <img src="${DAMAGE_SKETCH_DATA_URI}" alt="" class="damage-sketch-image" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="damage-marker-layer">
        ${markerHtml}
      </svg>
    </div>
  `;
}

export function resolveDocumentLogoSrc(c: { req: { header: (name: string) => string | undefined } }): string {
  const origin = c.req.header("origin");
  const referer = c.req.header("referer");

  if (origin && /^https?:\/\//i.test(origin)) {
    return `${origin.replace(/\/$/, "")}/mainauto-logo.png`;
  }

  if (referer) {
    try {
      return `${new URL(referer).origin}/mainauto-logo.png`;
    } catch {
      return LOGO_DATA_URI;
    }
  }

  return LOGO_DATA_URI;
}

export function buildDefaultHandoverProtocol(
  vehicle: VehicleSnapshot,
  customer: CustomerSnapshot | null
): HandoverProtocol {
  return {
    vehicle: {
      licensePlate: "",
      manufacturerModelType: [vehicle.brand, vehicle.model].filter(Boolean).join(" "),
      color: vehicle.color ?? "",
      fuelType: vehicle.fuelType ?? "",
      mileage: vehicle.mileage ? vehicle.mileage.toLocaleString("de-DE") : "",
      vin: vehicle.vin ?? "",
      internalVehicleNumber: vehicle.vehicleNumber,
    },
    handover: {
      date: "",
      time: "",
      location: "",
    },
    giver: {
      name: "MainAuto Miltenberg",
      company: DEALER_NAME,
      street: DEALER_ADDRESS,
      postalCodeCity: DEALER_CITY,
      email: DEALER_EMAIL,
      phone: DEALER_PHONE,
    },
    receiverCustomerId: customer?.id ?? vehicle.customerId ?? null,
    receiver: {
      name: customer ? `${customer.firstName} ${customer.lastName}`.trim() : "",
      company: customer?.company ?? "",
      street: customer?.address ?? "",
      postalCodeCity: [customer?.zip, customer?.city].filter(Boolean).join(" "),
      email: customer?.email ?? "",
      phone: customer?.phone ?? "",
    },
    condition: {
      exterior: "",
      interior: "",
      fuelLevel: "",
    },
    items: {
      keys: {
        checked: false,
        count: null,
      },
      serviceBook: false,
      vehicleFolder: false,
      chargingCableType2: false,
      chargingCableSchuko: false,
      registrationPart1: false,
      registrationPart2: false,
      cocCertificate: false,
      parkingHeaterRemote: false,
      warningTriangle: false,
      safetyVest: false,
      firstAidKit: false,
      other: "",
    },
    mountedWheels: {
      summer: false,
      winter: false,
      allSeason: false,
      alloy: false,
      steel: false,
      spareWheel: false,
      condition: "",
    },
    includedWheels: {
      summer: false,
      winter: false,
      allSeason: false,
      alloy: false,
      steel: false,
      spareWheel: false,
      condition: "",
    },
    damage: {
      markers: [],
      remark: "",
    },
  };
}

export function generateHandoverProtocolHtml(
  data: HandoverProtocol,
  logoSrc: string = LOGO_DATA_URI
): string {
  const keyCount = data.items.keys.count !== null && data.items.keys.count !== undefined
    ? ` <span class="inline-note">Anzahl ${escapeHtml(String(data.items.keys.count))}</span>`
    : ' <span class="inline-note">Anzahl ____</span>';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Übergabeprotokoll</title>
<style>
  @page { margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #161616; background: #fff; }
  .page { width: 210mm; min-height: 297mm; padding: 12mm 14mm 14mm; margin: 0 auto; background: #fff; }
  .dealer-header { border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 10px; }
  .dealer-brand { display: flex; align-items: flex-start; gap: 12px; }
  .dealer-logo { width: 84px; height: auto; object-fit: contain; flex-shrink: 0; }
  .dealer-name { font-size: 13pt; font-weight: bold; }
  .dealer-sub { font-size: 8pt; color: #555; line-height: 1.4; margin-top: 3px; }
  .doc-header { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 8px; }
  .doc-title { font-size: 16pt; font-weight: bold; }
  .internal-number { font-size: 8.5pt; color: #666; }
  .info-banner { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 9px 11px; border: 1px solid #d7dbe1; background: #f4f6f8; border-radius: 12px; }
  .info-banner-badge { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.12em; color: #667085; font-weight: bold; }
  .info-banner-copy { font-size: 9pt; color: #344054; line-height: 1.45; }
  .section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .section { border: 1px solid #d7d7d7; border-radius: 10px; padding: 10px; break-inside: avoid; page-break-inside: avoid; }
  .section-title { font-size: 9.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #b42318; margin-bottom: 8px; }
  .field-row { display: grid; grid-template-columns: 112px 1fr; align-items: end; gap: 8px; margin-bottom: 5px; font-size: 9pt; }
  .field-row-small { grid-template-columns: 95px 1fr; }
  .field-label { color: #444; font-weight: 600; }
  .field-value { border-bottom: 1.4px solid #efb0aa; min-height: 16px; display: block; padding-bottom: 2px; }
  .state-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .state-card { border: 1px solid #d7d7d7; border-radius: 10px; padding: 10px; min-height: 86px; break-inside: avoid; page-break-inside: avoid; }
  .state-label { font-size: 8.5pt; color: #555; margin-bottom: 6px; }
  .state-value { font-size: 10pt; font-weight: bold; }
  .items-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
  .check-list { display: grid; gap: 5px; }
  .check-item { display: flex; align-items: center; gap: 7px; font-size: 9pt; line-height: 1.35; }
  .checkbox { width: 14px; height: 14px; border: 1.5px solid #444; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; flex: 0 0 14px; }
  .inline-note { font-size: 8.5pt; color: #555; }
  .wheels-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
  .wheel-box { border: 1px solid #d7d7d7; border-radius: 10px; padding: 10px; break-inside: avoid; page-break-inside: avoid; }
  .wheel-options { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; margin-bottom: 8px; }
  .wheel-condition { margin-top: 10px; }
  .damage-box { border: 1px solid #d7d7d7; border-radius: 10px; padding: 10px; margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
  .damage-note { font-size: 8.5pt; color: #555; margin-bottom: 8px; }
  .sketch-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 8px; break-inside: avoid; page-break-inside: avoid; }
  .sketch-shell { border: 1px solid #d7d7d7; border-radius: 12px; padding: 8px; background: #fafafa; break-inside: avoid; page-break-inside: avoid; }
  .sketch-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.14em; color: #667085; margin-bottom: 6px; text-align: center; }
  .damage-sketch-canvas { position: relative; width: 100%; height: 220px; overflow: hidden; border-radius: 10px; background: linear-gradient(180deg, #f8fafc 0%, #f2f4f7 100%); }
  .damage-sketch-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0.92; }
  .damage-marker-layer { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .damage-marker { fill: rgba(225, 29, 72, 0.15); stroke: #be123c; stroke-width: 1.2; }
  .damage-remark { margin-top: 10px; break-inside: avoid; page-break-inside: avoid; }
  .note-value { min-height: 48px; border-bottom: 1.4px solid #efb0aa; padding-bottom: 2px; font-size: 9pt; line-height: 1.45; white-space: pre-wrap; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-top: 34px; break-inside: avoid; page-break-inside: avoid; }
  .signature-line { border-top: 1px solid #111; padding-top: 5px; font-size: 8.5pt; color: #444; }
  .doc-footer { border-top: 1.5px solid #111; margin-top: 16px; padding-top: 6px; font-size: 7.5pt; color: #444; text-align: center; line-height: 1.6; }
  @media print {
    body { background: #fff; }
    .page { width: auto; min-height: auto; padding: 0; margin: 0; }
    .section-grid,
    .state-grid,
    .items-grid,
    .wheels-grid,
    .sketch-grid,
    .signatures {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
</style>
</head>
<body>
<div class="page">
  ${getDealerHeaderHtml(logoSrc)}
  <div class="doc-header">
    <div class="doc-title">Übergabeprotokoll</div>
    <div class="internal-number">Interne Fahrzeugnummer: ${valueOrBlank(data.vehicle.internalVehicleNumber)}</div>
  </div>
  <div class="info-banner">
    <div class="info-banner-badge">Fahrzeuginfo</div>
    <div class="info-banner-copy">VIN: ${valueOrBlank(data.vehicle.vin)} &nbsp;&bull;&nbsp; Interne Fahrzeugnummer: ${valueOrBlank(data.vehicle.internalVehicleNumber)}</div>
  </div>

  <div class="section-grid">
    <div class="section">
      <div class="section-title">Fahrzeugdaten</div>
      ${fieldRow("Kennzeichen", data.vehicle.licensePlate)}
      ${fieldRow("Hersteller / Modell / Typ", data.vehicle.manufacturerModelType)}
      ${fieldRow("Farbe", data.vehicle.color)}
      ${fieldRow("Kraftstoffart", data.vehicle.fuelType)}
      ${fieldRow("Kilometerstand", data.vehicle.mileage)}
      ${fieldRow("VIN", data.vehicle.vin)}
    </div>
    <div class="section">
      <div class="section-title">Übergabeinformationen</div>
      ${fieldRow("Datum Übergabe", data.handover.date)}
      ${fieldRow("Uhrzeit Übergabe", data.handover.time)}
      ${fieldRow("Ort der Übergabe", data.handover.location)}
    </div>
  </div>

  <div class="section-grid">
    <div class="section">
      <div class="section-title">Daten des Übergebenden</div>
      ${fieldRow("Name", data.giver.name)}
      ${fieldRow("Firma", data.giver.company)}
      ${fieldRow("Straße", data.giver.street)}
      ${fieldRow("PLZ, Ort", data.giver.postalCodeCity)}
      ${fieldRow("E-Mail", data.giver.email)}
      ${fieldRow("Telefon", data.giver.phone)}
    </div>
    <div class="section">
      <div class="section-title">Daten des Übernehmenden</div>
      ${fieldRow("Name", data.receiver.name)}
      ${fieldRow("Firma", data.receiver.company)}
      ${fieldRow("Straße", data.receiver.street)}
      ${fieldRow("PLZ, Ort", data.receiver.postalCodeCity)}
      ${fieldRow("E-Mail", data.receiver.email)}
      ${fieldRow("Telefon", data.receiver.phone)}
    </div>
  </div>

  <div class="state-grid">
    <div class="state-card">
      <div class="section-title">Fahrzeugzustand außen</div>
      <div class="state-label">Auswahl</div>
      <div class="state-value">${valueOrBlank(describeExterior(data.condition.exterior))}</div>
    </div>
    <div class="state-card">
      <div class="section-title">Innenraum</div>
      <div class="state-label">Auswahl</div>
      <div class="state-value">${valueOrBlank(describeInterior(data.condition.interior))}</div>
    </div>
    <div class="state-card">
      <div class="section-title">Tankfüllung</div>
      <div class="state-label">Auswahl</div>
      <div class="state-value">${valueOrBlank(describeFuelLevel(data.condition.fuelLevel))}</div>
    </div>
  </div>

  <div class="items-grid">
    <div class="section">
      <div class="section-title">Folgendes wurde übergeben</div>
      <div class="check-list">
        ${checkItem("Fahrzeugschlüssel", data.items.keys.checked, keyCount)}
        ${checkItem("Serviceheft", data.items.serviceBook)}
        ${checkItem("Bordmappe", data.items.vehicleFolder)}
        ${checkItem("Ladekabel Typ 2", data.items.chargingCableType2)}
        ${checkItem("Ladekabel Schuko", data.items.chargingCableSchuko)}
        ${checkItem("Verbandkasten", data.items.firstAidKit)}
      </div>
    </div>
    <div class="section">
      <div class="section-title">Dokumente und Zubehör</div>
      <div class="check-list">
        ${checkItem("Zulassungsbescheinigung Teil 1", data.items.registrationPart1)}
        ${checkItem("Zulassungsbescheinigung Teil 2", data.items.registrationPart2)}
        ${checkItem("COC-Zertifikat", data.items.cocCertificate)}
        ${checkItem("Fernbedienung Standheizung", data.items.parkingHeaterRemote)}
        ${checkItem("Warndreieck", data.items.warningTriangle)}
        ${checkItem("Warnweste", data.items.safetyVest)}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Sonstiges</div>
    <div class="note-value">${valueOrBlank(data.items.other)}</div>
  </div>

  <div class="wheels-grid">
    <div class="wheel-box">
      <div class="section-title">Montierte Reifen / Felgen</div>
      <div class="wheel-options">
        ${checkItem("Sommerreifen", data.mountedWheels.summer)}
        ${checkItem("Alufelgen", data.mountedWheels.alloy)}
        ${checkItem("Winterreifen", data.mountedWheels.winter)}
        ${checkItem("Stahlfelgen", data.mountedWheels.steel)}
        ${checkItem("Ganzjahresreifen", data.mountedWheels.allSeason)}
        ${checkItem("Reserverad", data.mountedWheels.spareWheel)}
      </div>
      <div class="wheel-condition">
        ${fieldRow("Zustand", describeWheelCondition(data.mountedWheels.condition), true)}
      </div>
    </div>
    <div class="wheel-box">
      <div class="section-title">Mit abgegebene Reifen / Felgen</div>
      <div class="wheel-options">
        ${checkItem("Sommerreifen", data.includedWheels.summer)}
        ${checkItem("Alufelgen", data.includedWheels.alloy)}
        ${checkItem("Winterreifen", data.includedWheels.winter)}
        ${checkItem("Stahlfelgen", data.includedWheels.steel)}
        ${checkItem("Ganzjahresreifen", data.includedWheels.allSeason)}
        ${checkItem("Reserverad", data.includedWheels.spareWheel)}
      </div>
      <div class="wheel-condition">
        ${fieldRow("Zustand", describeWheelCondition(data.includedWheels.condition), true)}
      </div>
    </div>
  </div>

  <div class="damage-box">
    <div class="section-title">Beschädigungen</div>
    <div class="damage-note">Digitale Marker aus dem Übergabeprotokoll</div>
    <div class="sketch-grid">
      <div class="sketch-shell">
        <div class="sketch-label">Fahrzeugskizze</div>
        ${renderSketchHtml(data.damage.markers)}
      </div>
    </div>
    <div class="damage-remark">
      <div class="section-title">Bemerkung zu Beschädigungen</div>
      <div class="note-value">${valueOrBlank(data.damage.remark)}</div>
    </div>
  </div>

  <div class="signatures">
    <div class="signature-line">Ort, Datum</div>
    <div class="signature-line">Unterschrift des Übergebenden</div>
    <div class="signature-line">Unterschrift des Übernehmenden</div>
  </div>

  <div class="doc-footer">${getDealerFooterHtml()}</div>
</div>
</body>
</html>`;
}
