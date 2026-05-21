export type DocumentCreateActionId =
  | "offer"
  | "price-tag"
  | "purchase-contract"
  | "contract"
  | "gelangensbestaetigung"
  | "vermittlung";

export type DocumentCreateAction = {
  id: DocumentCreateActionId;
  label: string;
  kind: "direct" | "dialog";
};

export const DOCUMENT_CREATE_ACTIONS: DocumentCreateAction[] = [
  { id: "offer", label: "Angebot", kind: "direct" },
  { id: "price-tag", label: "Preisschild", kind: "direct" },
  { id: "purchase-contract", label: "Ankaufvertrag", kind: "dialog" },
  { id: "contract", label: "Kaufvertrag", kind: "dialog" },
  { id: "gelangensbestaetigung", label: "Gelangensbestätigung", kind: "dialog" },
  { id: "vermittlung", label: "Vermittlungsvertrag", kind: "dialog" },
];
