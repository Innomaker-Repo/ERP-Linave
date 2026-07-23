import React, { useState } from "react";

type ServiceRow = {
  item: string;
  descricao: string;
  quantidade: number;
  valor: number;
};

type Service = {
  id: number;
  name: string;
  description: string;
  postTexts: string[];
  table: ServiceRow[];
};

interface ServiceScopeExampleProps {
  initialServices?: Service[];
}

export default function ServiceScopeExample({ initialServices }: ServiceScopeExampleProps) {
  const defaultService1: Service = {
    id: 1,
    name: "Serviço Principal",
    description: "",
    postTexts: [""],
    table: [
      { item: "1", descricao: "Descrição exemplo", quantidade: 1, valor: 100 },
    ],
  };

  const [services, setServices] = useState<Service[]>(() => {
    if (initialServices && initialServices.length > 0) {
      const hasService1 = initialServices.some((s) => s.id === 1);
      return hasService1 ? initialServices : [defaultService1, ...initialServices];
    }
    return [defaultService1];
  });

  const addService = () => {
    setServices((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: `Serviço Adicional ${prev.length}`,
        description: "",
        postTexts: [""],
        table: [{ item: "1", descricao: "", quantidade: 1, valor: 0 }],
      },
    ]);
  };

  const updateService = (id: number, data: Partial<Service>) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
  };

  const addPostText = (id: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, postTexts: [...s.postTexts, ""] } : s)),
    );
  };

  const updatePostText = (id: number, idx: number, value: string) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const postTexts = [...s.postTexts];
        postTexts[idx] = value;
        return { ...s, postTexts };
      }),
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>A - Escopo Básico de Serviços</h2>
      {services.map((service, sIdx) => (
        <div key={service.id} style={{ border: "1px solid #ccc", margin: 16, padding: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{sIdx + 1}.</strong>
            <input
              type="text"
              placeholder="Nome do serviço"
              value={service.name}
              onChange={(e) => updateService(service.id, { name: e.target.value })}
              style={{ marginLeft: 8 }}
            />
          </div>

          <div>
            <strong>Descrição do serviço:</strong>
            <textarea
              value={service.description}
              onChange={(e) => updateService(service.id, { description: e.target.value })}
              placeholder="Descreva o serviço"
              style={{ width: "100%", margin: "4px 0" }}
            />
          </div>

          <div style={{ margin: "16px 0" }}>
            <strong>Tabela do Serviço</strong>
            <table border={1} cellPadding={4} style={{ width: "100%", marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Descrição</th>
                  <th>Quantidade</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {service.table.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.item}</td>
                    <td>{row.descricao}</td>
                    <td>{row.quantidade}</td>
                    <td>{row.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <strong>Textos livres depois da tabela:</strong>
            {service.postTexts.map((txt, idx) => (
              <div key={idx}>
                <textarea
                  value={txt}
                  onChange={(e) => updatePostText(service.id, idx, e.target.value)}
                  placeholder="Texto livre"
                  style={{ width: "100%", margin: "4px 0" }}
                />
              </div>
            ))}
            <button onClick={() => addPostText(service.id)}>Adicionar texto depois</button>
          </div>
        </div>
      ))}
      <button onClick={addService} style={{ marginTop: 16 }}>
        Adicionar novo Serviço
      </button>
    </div>
  );
}
