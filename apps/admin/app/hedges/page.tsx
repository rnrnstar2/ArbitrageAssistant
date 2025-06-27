import { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { HedgeManager } from '../../features/hedges/components/HedgeManager';
import { CreditOptimizer } from '../../features/hedges/components/CreditOptimizer';

export const metadata: Metadata = {
  title: '両建て管理',
  description: '動的組み替えとクレジット最適化による効率的な両建て管理',
};

export default function HedgesPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="management" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="management">両建て管理</TabsTrigger>
          <TabsTrigger value="optimization">クレジット最適化</TabsTrigger>
        </TabsList>
        
        <TabsContent value="management" className="mt-6">
          <HedgeManager />
        </TabsContent>
        
        <TabsContent value="optimization" className="mt-6">
          <CreditOptimizer />
        </TabsContent>
      </Tabs>
    </div>
  );
}