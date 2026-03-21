export type PaymentRecord = {
  amount: number;
  id: string;
  providerPaymentId: string;
  requestId: string;
  tariff: "149" | "199";
};
