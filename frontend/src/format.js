// Dates are stored as "YYYY-MM-DD" (older trips may use "DD-MM-YYYY")
export function formatDate(value) {
  if (!value) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const legacy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  let date;
  if (iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  else if (legacy) date = new Date(Number(legacy[3]), Number(legacy[2]) - 1, Number(legacy[1]));
  if (!date || Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatCost(value) {
  if (value === undefined || value === null || value === "") return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}
