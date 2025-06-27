import { Metadata } from 'next';
import { AccountManagerEnhanced } from '../../features/accounts/components/AccountManagerEnhanced';

export const metadata: Metadata = {
  title: '口座管理',
  description: 'MT4/MT5口座の管理とクレジット履歴の確認',
};

export default function AccountsPage() {
  return <AccountManagerEnhanced />;
}