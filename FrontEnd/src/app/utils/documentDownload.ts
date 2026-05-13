export interface DownloadableDocumentLike {
  nome?: string;
  conteudo?: string;
  url?: string;
}

interface DownloadDocumentOptions {
  fallbackName?: string;
  onInvalid?: () => void;
}

export const getDocumentHref = (doc: DownloadableDocumentLike | null | undefined): string => {
  const conteudo = String(doc?.conteudo || '').trim();
  if (conteudo) return conteudo;

  const url = String(doc?.url || '').trim();
  if (url) return url;

  return '';
};

export const isDocumentDownloadable = (doc: DownloadableDocumentLike | null | undefined): boolean => {
  return Boolean(getDocumentHref(doc));
};

export const downloadDocument = (
  doc: DownloadableDocumentLike | null | undefined,
  options: DownloadDocumentOptions = {},
): boolean => {
  const href = getDocumentHref(doc);
  if (!href) {
    options.onInvalid?.();
    return false;
  }

  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = String(doc?.nome || options.fallbackName || 'documento');
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return true;
};
