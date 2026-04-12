export type Database = any;

export function getAdminEmail(): string {
  const adminEmail = localStorage.getItem("currentAdmin");
  if (!adminEmail) throw new Error("currentAdmin não definido.");
  return adminEmail;
}

export function getDbKey(adminEmail?: string) {
  const email = adminEmail ?? getAdminEmail();
  return `db_${email}`;
}

export function loadDatabase(): Database {
  const key = getDbKey();
  const db = JSON.parse(localStorage.getItem(key) || "{}");
  return ensureDbShape(db);
}

export function saveDatabase(db: Database) {
  const key = getDbKey();
  localStorage.setItem(key, JSON.stringify(ensureDbShape(db)));
}

export function ensureDbShape(db: Database): Database {
  // Coleções padrão do ERP
  db.clientes = db.clientes || [];
  db.funcionarios = db.funcionarios || [];
  db.equipes = db.equipes || [];
  db.obras = db.obras || [];
  db.os = db.os || [];
  db.atividades = db.atividades || [];
  db.fornecedores = db.fornecedores || [];
  db.financeiro = db.financeiro || [];

  // Novas coleções RH/Relatórios
  db.alocacoes = db.alocacoes || [];
  db.registrosHoras = db.registrosHoras || [];
  db.folhaPagamento = db.folhaPagamento || [];

  // contadores
  db._counters = db._counters || {};
  db._osCounters = db._osCounters || {};

  return db;
}
