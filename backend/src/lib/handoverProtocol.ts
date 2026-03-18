import type { HandoverProtocol } from "../types";
import { DEFAULT_DEALER_SETTINGS } from "./dealers";

export interface HandoverDealerProfile {
  name: string;
  addressLine1: string;
  cityLine: string;
  website: string;
  email: string;
  phone: string;
  taxId: string;
  legalRepresentative: string;
  bankName: string;
  iban: string;
  bic: string;
  logoUrl?: string | null;
}

function getDefaultDealerProfile(): HandoverDealerProfile {
  return {
    name: DEFAULT_DEALER_SETTINGS.displayName,
    addressLine1: DEFAULT_DEALER_SETTINGS.addressLine1,
    cityLine: `${DEFAULT_DEALER_SETTINGS.zip} ${DEFAULT_DEALER_SETTINGS.city}`,
    website: DEFAULT_DEALER_SETTINGS.website,
    email: DEFAULT_DEALER_SETTINGS.email,
    phone: DEFAULT_DEALER_SETTINGS.phone,
    taxId: DEFAULT_DEALER_SETTINGS.taxId,
    legalRepresentative: DEFAULT_DEALER_SETTINGS.legalRepresentative,
    bankName: DEFAULT_DEALER_SETTINGS.bankName,
    iban: DEFAULT_DEALER_SETTINGS.iban,
    bic: DEFAULT_DEALER_SETTINGS.bic,
    logoUrl: null,
  };
}

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

function getLogoImgHtml(
  className: string,
  logoSrc: string | null = null,
  alt: string = DEFAULT_DEALER_SETTINGS.displayName
): string {
  if (!logoSrc) {
    return "";
  }
  return `<img src="${logoSrc}" alt="${alt}" class="${className}" />`;
}

function getDealerHeaderHtml(profile: HandoverDealerProfile, logoSrc: string | null = null): string {
  return `
    <div class="dealer-header">
      <div class="dealer-brand">
        ${getLogoImgHtml("dealer-logo", logoSrc, profile.name)}
        <div>
          <div class="dealer-name">${profile.name}</div>
          <div class="dealer-sub">${profile.addressLine1} &bull; ${profile.cityLine} &bull; Tel. ${profile.phone} &bull; Web: ${profile.website} &bull; Mail: ${profile.email} &bull; USt-IdNr. ${profile.taxId}</div>
        </div>
      </div>
    </div>
  `;
}

function getDealerFooterHtml(profile: HandoverDealerProfile): string {
  return `
    ${profile.name} &bull; ${profile.addressLine1} &bull; ${profile.cityLine}<br>
    E-Mail: ${profile.email} &bull; Tel. ${profile.phone} &bull; Web: ${profile.website}<br>
    ${profile.bankName} &bull; IBAN: ${profile.iban} &bull; BIC: ${profile.bic}<br>
    USt-IdNr. ${profile.taxId} &bull; Vertretungsberechtigt: ${profile.legalRepresentative}
  `;
}

function renderSketchHtml(markers: HandoverProtocol["damage"]["markers"], sketchSrc: string): string {
  const markerHtml = markers
    .map((marker) => {
      return `<span class="damage-marker-dot" style="left:${marker.x}%; top:${marker.y}%"></span>`;
    })
    .join("");

  return `
    <div class="damage-sketch-canvas" aria-hidden="true">
      <img src="${escapeHtml(sketchSrc)}" alt="" class="damage-sketch-image" />
      ${markerHtml}
    </div>
  `;
}

export function resolveDocumentLogoSrc(profile?: HandoverDealerProfile): string | null {
  return profile?.logoUrl ?? null;
}

export function buildDefaultHandoverProtocol(
  vehicle: VehicleSnapshot,
  customer: CustomerSnapshot | null,
  dealerProfile: HandoverDealerProfile = getDefaultDealerProfile()
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
      name: dealerProfile.name,
      company: dealerProfile.name,
      street: dealerProfile.addressLine1,
      postalCodeCity: dealerProfile.cityLine,
      email: dealerProfile.email,
      phone: dealerProfile.phone,
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
  dealerProfile: HandoverDealerProfile = getDefaultDealerProfile(),
  logoSrc: string | null = dealerProfile.logoUrl || null,
  sketchSrc: string = "/car.png"
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
  .dealer-logo { width: 148px; max-height: 72px; height: auto; object-fit: contain; flex-shrink: 0; }
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
  .damage-sketch-canvas { position: relative; width: 100%; aspect-ratio: 1151 / 750; overflow: hidden; border-radius: 10px; background: linear-gradient(180deg, #f8fafc 0%, #f2f4f7 100%); }
  .damage-sketch-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; opacity: 1; }
  .damage-marker-dot { position: absolute; width: 16px; height: 16px; border-radius: 999px; border: 2px solid #be123c; background: rgba(244, 63, 94, 0.12); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18); transform: translate(-50%, -50%); }
  .damage-remark { margin-top: 10px; break-inside: avoid; page-break-inside: avoid; }
  .note-value { min-height: 48px; border-bottom: 1.4px solid #efb0aa; padding-bottom: 2px; font-size: 9pt; line-height: 1.45; white-space: pre-wrap; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-top: 48px; break-inside: avoid; page-break-inside: avoid; }
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
  ${getDealerHeaderHtml(dealerProfile, logoSrc)}
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
        ${renderSketchHtml(data.damage.markers, sketchSrc)}
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

  <div class="doc-footer">${getDealerFooterHtml(dealerProfile)}</div>
</div>
</body>
</html>`;
}
