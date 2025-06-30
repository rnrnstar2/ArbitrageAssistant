export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const getRiskLevelColor = (level: string) => {
  switch (level) {
    case "low": return "bg-status-success status-success";
    case "medium": return "bg-status-warning status-warning";
    case "high": return "bg-status-error status-error";
    default: return "bg-muted text-muted-foreground";
  }
};

export const getMarginLevelColor = (level: number) => {
  if (level === 0) return "text-muted-foreground";
  if (level < 100) return "text-status-error";
  if (level < 200) return "text-status-warning";
  return "text-status-success";
};