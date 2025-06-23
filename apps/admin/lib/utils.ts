import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export const formatDateTime = (date: string | Date) => {
  return format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: ja });
};

export const formatCurrency = (amount: number, currency = 'JPY') => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
  }).format(amount);
};