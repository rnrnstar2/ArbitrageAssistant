export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const getRiskLevelColor = (level: string) => {
  switch (level) {
    case "low": return "bg-green-100 text-green-800";
    case "medium": return "bg-yellow-100 text-yellow-800";
    case "high": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

export const getMarginLevelColor = (level: number) => {
  if (level === 0) return "text-gray-500";
  if (level < 100) return "text-red-600";
  if (level < 200) return "text-yellow-600";
  return "text-green-600";
};