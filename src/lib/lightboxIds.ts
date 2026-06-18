const TEMPLATE_PREVIEW_LIGHTBOX_PREFIX = 'template-preview:'

export function getTemplatePreviewLightboxId(imageId: string): string {
  return `${TEMPLATE_PREVIEW_LIGHTBOX_PREFIX}${imageId}`
}

export function parseTemplatePreviewLightboxId(lightboxImageId: string): string | null {
  return lightboxImageId.startsWith(TEMPLATE_PREVIEW_LIGHTBOX_PREFIX)
    ? lightboxImageId.slice(TEMPLATE_PREVIEW_LIGHTBOX_PREFIX.length)
    : null
}
