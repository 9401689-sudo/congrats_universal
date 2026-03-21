import type { DocumentRecord } from "../../domain/document.js";
import type { PostgresExecutor } from "../../infra/postgres.js";
import type { DocumentsRepository } from "./documents-repository.js";

type DocumentRow = {
  final_file_id?: string | null;
  id: number | string;
  request_id: number | string;
  tariff: "149" | "199";
};

export class PostgresDocumentsRepository implements DocumentsRepository {
  constructor(private readonly db: PostgresExecutor) {}

  async getById(documentId: string): Promise<DocumentRecord | null> {
    const result = await this.db.query<DocumentRow>(
      `
        select id, request_id, tariff, final_file_id
        from razreshenobot.documents
        where id = $1::bigint
        limit 1;
      `,
      [documentId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      finalFileId: row.final_file_id ?? null,
      id: String(row.id),
      requestId: String(row.request_id),
      tariff: row.tariff
    };
  }

  async setFinalFileId(documentId: string, finalFileId: string): Promise<void> {
    await this.db.query(
      `
        update razreshenobot.documents
        set final_file_id = $1
        where id = $2::bigint;
      `,
      [finalFileId, documentId]
    );
  }

  async upsertDocument(input: {
    initiatorName: string;
    renderParams: Record<string, unknown>;
    requestId: string;
    tariff: "149" | "199";
  }): Promise<DocumentRecord> {
    const result = await this.db.query<DocumentRow>(
      `
        insert into razreshenobot.documents
          (request_id, tariff, initiator_name, render_params)
        values
          ($1::bigint, $2::public.document_tariff, $3, $4::jsonb)
        on conflict (request_id, tariff)
        do update set
          initiator_name = excluded.initiator_name,
          render_params = excluded.render_params
        returning id, request_id, tariff, final_file_id;
      `,
      [input.requestId, input.tariff, input.initiatorName, JSON.stringify(input.renderParams)]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to upsert document");
    }

    return {
      finalFileId: row.final_file_id ?? null,
      id: String(row.id),
      requestId: String(row.request_id),
      tariff: row.tariff
    };
  }
}
