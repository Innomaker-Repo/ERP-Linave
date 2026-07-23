import { getCachedWorkspace } from "../services/workspaceStorage";

export function getCompanyData() {
  return getCachedWorkspace().empresa || null;
}

/**
 * Convenção do sistema para a empresa prestadora dos documentos (proposta, OS, etc.):
 * - Linave é a prestadora padrão  -> logo /image2.jpg
 * - Servinave é usada quando o nome contém "servinave" -> logo /image1.png
 * Os dois logos ficam em FrontEnd/public.
 */
export const LINAVE_LOGO_URL = '/image2.jpg';
export const SERVINAVE_LOGO_URL = '/image1.png';

/** Retorna true quando a prestadora é a Linave (padrão quando o nome não indica Servinave). */
export function isEmpresaLinave(empresaPrestadora?: string | null): boolean {
  const nome = String(empresaPrestadora || '').trim().toLowerCase();
  return !nome.includes('servinave');
}

/** URL do logo (em /public) correspondente à empresa prestadora. */
export function getLogoUrlForEmpresa(empresaPrestadora?: string | null): string {
  return isEmpresaLinave(empresaPrestadora) ? LINAVE_LOGO_URL : SERVINAVE_LOGO_URL;
}
