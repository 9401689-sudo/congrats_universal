type LayoutPreset = {
  opacity: number;
  rot: number;
  scale: number;
  x: number;
  y: number;
};

type TemplatePreset = {
  sealPresets: readonly LayoutPreset[];
  stampPresets: readonly LayoutPreset[];
};

export const currentCampaignVariants = {
  backgrounds: ["bg1.png", "bg2.png", "bg3.png", "bg4.png", "bg5.png", "bg6.png"] as const,
  templates: {
    t01: {
      sealPresets: [
        { x: 920, y: 1820, rot: -8, scale: 0.82, opacity: 0.78 },
        { x: 980, y: 1880, rot: -12, scale: 0.82, opacity: 0.8 },
        { x: 1040, y: 1860, rot: -6, scale: 0.82, opacity: 0.76 }
      ],
      stampPresets: [
        { x: 220, y: 1900, rot: 10, scale: 0.9, opacity: 0.9 },
        { x: 260, y: 1980, rot: 8, scale: 0.9, opacity: 0.88 },
        { x: 320, y: 1940, rot: 14, scale: 0.9, opacity: 0.92 }
      ]
    },
    t02: {
      sealPresets: [
        { x: 980, y: 1840, rot: -10, scale: 0.82, opacity: 0.78 },
        { x: 1040, y: 1900, rot: -15, scale: 0.82, opacity: 0.8 }
      ],
      stampPresets: [
        { x: 240, y: 1920, rot: 10, scale: 0.9, opacity: 0.9 },
        { x: 300, y: 2000, rot: 6, scale: 0.9, opacity: 0.88 }
      ]
    },
    t03: {
      sealPresets: [
        { x: 1000, y: 1860, rot: -5, scale: 0.82, opacity: 0.76 },
        { x: 920, y: 1820, rot: -9, scale: 0.82, opacity: 0.8 }
      ],
      stampPresets: [
        { x: 260, y: 1960, rot: 16, scale: 0.9, opacity: 0.92 },
        { x: 320, y: 2020, rot: 12, scale: 0.9, opacity: 0.9 }
      ]
    }
  } satisfies Record<string, TemplatePreset>
};
