export type VariantSnapshot = {
  bg: string;
  content: {
    intro: string;
    points: string[];
  };
  idx: number;
  initiatorName: string;
  layout: {
    seal: {
      opacity: number;
      rot: number;
      scale: number;
      x: number;
      y: number;
    };
    stamp: {
      opacity: number;
      rot: number;
      scale: number;
      x: number;
      y: number;
    };
  };
  meta: {
    assetsVersion: string;
    createdAt: number;
    engineVersion: string;
  };
  recipientName: string;
  templateId: string;
};
