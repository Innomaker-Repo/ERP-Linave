export function getCompanyData() {
  const adminEmail = localStorage.getItem("currentAdmin");
  if (!adminEmail) return null;

  const database = JSON.parse(
    localStorage.getItem(`db_${adminEmail}`) || "{}"
  );

  return database.empresa || null;
}
