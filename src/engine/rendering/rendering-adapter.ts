export interface RenderingAdapter {
  renderFinal(input: {
    deliveryId: string;
    renderParams: Record<string, unknown>;
    requestId: string;
  }): Promise<{ fileId: string; renderedPath: string }>;
}
