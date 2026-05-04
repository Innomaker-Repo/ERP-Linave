import React from "react";

interface OSHeaderProps {
  logoUrl?: string;
  dataEmissao?: string;
  cc?: string;
  cliente?: string;
  projeto?: string;
  equipamento?: string;
  local?: string;
  dataInicioPrevisto?: string;
  dataTerminoPrevisto?: string;
  ordemServicoNumero?: string;
  supervisor?: string;
}

export default function OSHeader({
  logoUrl = "/logo-linave.png", // ajuste o caminho conforme necessário
  dataEmissao = "",
  cc = "",
  cliente = "",
  projeto = "",
  equipamento = "",
  local = "",
  dataInicioPrevisto = "",
  dataTerminoPrevisto = "",
  ordemServicoNumero = "",
  supervisor = "",
}: OSHeaderProps) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: 'Arial, sans-serif', fontSize: 14 }} border={1}>
      <tbody>
        <tr>
          <td rowSpan={2} style={{ width: 180, textAlign: "center", padding: 4 }}>
            <img src={logoUrl} alt="Logo Linave" style={{ maxWidth: 150, maxHeight: 50 }} />
          </td>
          <td colSpan={6} style={{ textAlign: "center", fontWeight: "bold", fontSize: 18, background: "#fafafa" }}>
            ORDEM DE SERVIÇO DE PRODUÇÃO
          </td>
          <td style={{ width: 120, fontWeight: "bold", padding: 4 }}>Data Emissão:</td>
          <td style={{ width: 100, padding: 4 }}>{dataEmissao}</td>
        </tr>
        <tr>
          <td colSpan={6}></td>
          <td style={{ fontWeight: "bold", padding: 4 }}>CC.:</td>
          <td style={{ padding: 4 }}>{cc}</td>
        </tr>
        <tr>
          <td style={{ fontWeight: "bold", padding: 4 }}>CLIENTE</td>
          <td colSpan={3} style={{ padding: 4 }}>{cliente}</td>
          <td style={{ fontWeight: "bold", padding: 4 }}>Data início previsto:</td>
          <td style={{ padding: 4 }}>{dataInicioPrevisto}</td>
          <td style={{ fontWeight: "bold", padding: 4 }}>Data térm. Previsto:</td>
          <td style={{ padding: 4 }}>{dataTerminoPrevisto}</td>
        </tr>
        <tr>
          <td style={{ fontWeight: "bold", padding: 4 }}>PROJETO</td>
          <td colSpan={3} style={{ padding: 4 }}>{projeto}</td>
          <td style={{ fontWeight: "bold", padding: 4 }}>Ordem Serviço Nº:</td>
          <td style={{ padding: 4 }}>{ordemServicoNumero}</td>
          <td style={{ fontWeight: "bold", padding: 4 }}>Superv./Encarreg.:</td>
          <td style={{ padding: 4 }}>{supervisor}</td>
        </tr>
        <tr>
          <td style={{ fontWeight: "bold", padding: 4 }}>EQUIPAMENTO</td>
          <td colSpan={7} style={{ padding: 4 }}>{equipamento}</td>
        </tr>
        <tr>
          <td style={{ fontWeight: "bold", padding: 4 }}>LOCAL</td>
          <td colSpan={7} style={{ padding: 4 }}>{local}</td>
        </tr>
      </tbody>
    </table>
  );
}