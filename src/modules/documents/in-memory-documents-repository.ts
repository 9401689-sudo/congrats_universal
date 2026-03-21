import type { DocumentRecord } from "../../domain/document.js";
import type { DocumentsRepository } from "../../engine/repositories/documents-repository.js";

export class InMemoryDocumentsRepository implements DocumentsRepository {
  private seq = 1;
  private readonly docs = new Map<string, DocumentRecord>();

  async getById(documentId: string): Promise<DocumentRecord | null> {
    return this.docs.get(documentId) ?? null;
  }

  async setFinalFileId(documentId: string, finalFileId: string): Promise<void> {
    const document = this.docs.get(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    document.finalFileId = finalFileId;
    this.docs.set(documentId, document);
  }

  async upsertDocument(input: {
    initiatorName: string;
    renderParams: Record<string, unknown>;
    requestId: string;
    tariff: "149" | "199";
  }): Promise<DocumentRecord> {
    const existing = [...this.docs.values()].find(
      (doc) => doc.requestId === input.requestId && doc.tariff === input.tariff
    );
    if (existing) {
      return existing;
    }

    const created: DocumentRecord = {
      finalFileId: null,
      id: String(this.seq++),
      requestId: input.requestId,
      tariff: input.tariff
    };
    this.docs.set(created.id, created);
    return created;
  }
}
