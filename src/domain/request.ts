export type RequestRecord = {
  deliveryMethod?: "manual" | "username" | null;
  deliveryUsername?: string | null;
  id: string;
  initiatorTimezone?: string | null;
  recipientName: string | null;
  selectedVariantIdx?: number | null;
  status?: string | null;
};
