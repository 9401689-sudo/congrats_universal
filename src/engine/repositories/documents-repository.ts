import type { DocumentRecord } from "../../domain/document.js";

export interface DocumentsRepository {
  getById(documentId: string): Promise<DocumentRecord | null>;
  setFinalFileId(documentId: string, finalFileId: string): Promise<void>;
  upsertDocument(input: {
    initiatorName: string;
    renderParams: Record<string, unknown>;
    requestId: string;
    tariff: "149" | "199";
  }): Promise<DocumentRecord>;
}
