export type DeliveryRecord = {
  deliveryMethod: "manual" | "username";
  documentId: string;
  id: string;
  recipientUsername: string | null;
  scheduledAt: string;
};

export type DeliveryContext = {
  deliveryId: string;
  deliveryMethod: "manual" | "username";
  documentId: string;
  finalFileId: string | null;
  recipientUsername: string | null;
  renderParams: Record<string, unknown>;
  requestId: string;
  tgUserId: string;
};
