import { describe, expect, test } from "bun:test";

import { DOCUMENT_CREATE_ACTIONS } from "./documentActions";

describe("DOCUMENT_CREATE_ACTIONS", () => {
  test("contains every document option shown in the mobile-safe create dialog", () => {
    expect(DOCUMENT_CREATE_ACTIONS.map((action) => action.label)).toEqual([
      "Angebot",
      "Preisschild",
      "Ankaufvertrag",
      "Kaufvertrag",
      "Gelangensbestätigung",
      "Vermittlungsvertrag",
    ]);
  });

  test("marks Kaufvertrag as a dialog-opening action instead of a direct download", () => {
    expect(DOCUMENT_CREATE_ACTIONS.find((action) => action.id === "contract")).toMatchObject({
      id: "contract",
      label: "Kaufvertrag",
      kind: "dialog",
    });
  });
});
