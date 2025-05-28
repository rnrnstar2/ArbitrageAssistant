"use client";

import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">Welcome to Hedge System</h1>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">ダッシュボード</h2>
        <p className="text-lg text-gray-600 mb-4">
          ようこそ、{user?.signInDetails?.loginId}さん！
        </p>
        <p className="text-gray-600">
          このシステムは、AIを活用したヘッジファンドアシスタントです。
          アービトラージ取引をサポートし、効率的な投資戦略の構築を支援します。
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-3 text-blue-800">市場分析</h3>
          <p className="text-blue-600">
            リアルタイムの市場データと価格差を分析し、アービトラージ機会を特定します。
          </p>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-3 text-green-800">ポートフォリオ管理</h3>
          <p className="text-green-600">
            投資ポートフォリオの状況を監視し、リスク管理を行います。
          </p>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-3 text-purple-800">AI分析</h3>
          <p className="text-purple-600">
            AIアルゴリズムを使用して市場予測と投資戦略を提案します。
          </p>
        </div>
      </div>
    </div>
  );
}
