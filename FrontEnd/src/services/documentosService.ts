import api from './api';

/**
 * Serviço de Documentos (tabela SQL `comercialapp_documento`).
 *
 * Persiste de verdade qualquer upload do sistema: o binário vai para o disco do
 * backend (MEDIA_ROOT, via FileField) e o banco guarda caminho + metadados. Isso
 * substitui o antigo base64-em-memória (que se perdia no reload).
 *
 *   POST   /comercial/documentos/      multipart: arquivo + vinculo_tipo/id + categoria
 *   GET    /comercial/documentos/?vinculo_tipo=&vinculo_id=&categoria=
 *   DELETE /comercial/documentos/<id>/
 *
 * Recuperação: cada documento volta com `url` RELATIVA (/media/...). Como o frontend
 * acessa tudo no mesmo origem (proxy do Vite / túnel ngrok único), a URL relativa
 * abre/baixa direto, sem CORS.
 */

export type DocumentoVinculo = 'negocio' | 'os' | 'financeiro';
export type DocumentoCategoria =
  | 'negocio'
  | 'cliente_assinado'
  | 'os_assinatura'
  | 'fin_anexo'
  | 'fin_comprovante'
  | 'fin_documento'
  | 'outro';

// Shape cru retornado pelo backend (snake_case).
export interface DocumentoApi {
  id: number;
  url: string | null;
  nome_original: string;
  tipo: string;
  tamanho: number;
  categoria: DocumentoCategoria;
  vinculo_tipo: string;
  vinculo_id: string;
  uploaded_at: string;
}

// Shape consumido pelas telas (mesma forma do antigo DocumentoNegocio: `conteudo`
// passa a ser a URL, então o código existente de abrir/baixar segue funcionando).
export interface DocumentoFront {
  id: string;
  backendId: number;
  nome: string;
  tipo: string;
  tamanho: number;
  dataUpload: string;
  url: string;
  conteudo: string; // = url (compatibilidade com o código que abria base64)
  categoria: string;
  vinculoTipo: string;
  vinculoId: string;
}

export const mapDocApiToFront = (d: DocumentoApi): DocumentoFront => ({
  id: `doc-${d.id}`,
  backendId: d.id,
  nome: d.nome_original || 'documento',
  tipo: d.tipo || '',
  tamanho: d.tamanho || 0,
  dataUpload: d.uploaded_at || '',
  url: d.url || '',
  conteudo: d.url || '',
  categoria: d.categoria || 'outro',
  vinculoTipo: d.vinculo_tipo || '',
  vinculoId: d.vinculo_id || '',
});

export const mapDocsApiToFront = (docs: any): DocumentoFront[] =>
  (Array.isArray(docs) ? docs : []).map(mapDocApiToFront);

interface UploadParams {
  vinculoTipo: DocumentoVinculo | string;
  vinculoId: string | number;
  categoria: DocumentoCategoria;
}

export async function uploadDocumento(file: File, params: UploadParams): Promise<DocumentoFront> {
  const form = new FormData();
  form.append('arquivo', file);
  form.append('vinculo_tipo', String(params.vinculoTipo));
  form.append('vinculo_id', String(params.vinculoId));
  form.append('categoria', params.categoria);
  // Não setamos Content-Type: o axios injeta o boundary do multipart automaticamente.
  const { data } = await api.post('documentos/', form);
  return mapDocApiToFront(data as DocumentoApi);
}

export async function listarDocumentos(params: {
  vinculoTipo?: string;
  vinculoId?: string | number;
  categoria?: string;
}): Promise<DocumentoFront[]> {
  const query: Record<string, string> = {};
  if (params.vinculoTipo) query.vinculo_tipo = String(params.vinculoTipo);
  if (params.vinculoId !== undefined && params.vinculoId !== '') query.vinculo_id = String(params.vinculoId);
  if (params.categoria) query.categoria = String(params.categoria);
  const { data } = await api.get('documentos/', { params: query });
  return mapDocsApiToFront(data);
}

export async function excluirDocumento(backendId: number | string): Promise<void> {
  await api.delete(`documentos/${backendId}/`);
}
