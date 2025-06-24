import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

// null/undefined安全な日付処理関数
export const formatDate = (date: string | Date | null | undefined): string => 
  date ? format(new Date(date), 'yyyy/MM/dd', { locale: ja }) : 'N/A';

export const formatDateTime = (date: string | Date | null | undefined): string => 
  date ? format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: ja }) : 'N/A';

export const formatCurrency = (amount: number | null | undefined, currency = 'JPY'): string => {
  if (amount === null || amount === undefined) return 'N/A';
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
  }).format(amount);
};