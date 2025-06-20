'use client';

import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { listen } from '@tauri-apps/api/event';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@repo/ui/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Download, Loader2, Info } from 'lucide-react';
import { useAutoUpdater } from '@/hooks/useAutoUpdater';

export function UpdateNotification() {
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<{ version: string; notes: string; update: unknown } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showCheckingDialog, setShowCheckingDialog] = useState(false);
  const [checkingMessage, setCheckingMessage] = useState<string>('アップデートを確認中...');

  // アップデーターフックを使用（通知のみモード）
  const { downloadAndInstallUpdate } = useAutoUpdater({
    checkInterval: 2 * 60 * 60 * 1000, // 2時間ごと
    initialDelay: 30 * 1000, // 30秒後
    onUpdateAvailable: (version, notes, update) => {
      setShowCheckingDialog(false);
      if (version === 'エラー') {
        // エラーの場合
        setCheckingMessage(notes);
        setTimeout(() => setShowCheckingDialog(false), 3000);
      } else {
        setUpdateInfo({ version, notes, update });
        setShowUpdateDialog(true);
      }
    },
    onCheckStart: () => {
      setShowCheckingDialog(true);
      setCheckingMessage('アップデートを確認中...');
    },
    onNoUpdate: () => {
      setCheckingMessage('お使いのバージョンは最新です。');
      setTimeout(() => setShowCheckingDialog(false), 2000);
    },
  });

  // アプリ起動時にバージョンを取得
  useEffect(() => {
    getVersion().then(setCurrentVersion).catch(console.error);
  }, []);

  // About ダイアログのイベントをリッスン
  useEffect(() => {
    let unlistenAbout: (() => void) | null = null;
    
    const setupAboutListener = async () => {
      try {
        unlistenAbout = await listen('show-about', () => {
          setShowAboutDialog(true);
        });
      } catch (error) {
        console.error('Failed to setup about listener:', error);
      }
    };

    setupAboutListener();

    return () => {
      if (unlistenAbout) {
        unlistenAbout();
      }
    };
  }, []);

  const handleInstallUpdate = async () => {
    if (!updateInfo?.update) return;

    setIsDownloading(true);
    setShowUpdateDialog(false);
    
    try {
      console.log('アップデートのダウンロード・インストールを開始します...');
      
      // 実際のダウンロード・インストール実行
      await downloadAndInstallUpdate(updateInfo.update);
      
    } catch (error) {
      console.error('アップデートエラー:', error);
      alert('アップデートのインストール中にエラーが発生しました。');
      setIsDownloading(false);
      setShowUpdateDialog(true); // ダイアログを再表示
    }
  };

  const handleLaterUpdate = () => {
    setShowUpdateDialog(false);
    setUpdateInfo(null);
  };

  return (
    <>
      {/* チェック中ダイアログ */}
      <AlertDialog open={showCheckingDialog} onOpenChange={setShowCheckingDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center gap-2">
              {checkingMessage.includes('最新') ? (
                <Badge className="bg-green-600">✓</Badge>
              ) : checkingMessage.includes('エラー') ? (
                <Badge variant="destructive">✗</Badge>
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              <span className="text-center">{checkingMessage}</span>
            </AlertDialogTitle>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      {/* アップデートダイアログ */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              システムアップデートのお知らせ
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">現在のバージョン:</span>
                  <Badge variant="outline">v{currentVersion}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">新しいバージョン:</span>
                  <Badge className="bg-primary">v{updateInfo?.version}</Badge>
                </div>
                {updateInfo?.notes && (
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <h4 className="text-sm font-medium mb-2">更新内容:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {updateInfo.notes}
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleLaterUpdate}>
              後で実行
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleInstallUpdate}
              disabled={isDownloading}
              className="bg-primary hover:bg-primary/90"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ダウンロード中...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  手動で更新実行
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aboutダイアログ */}
      <AlertDialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Hedge System について
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Hedge System</CardTitle>
                    <CardDescription>アービトラージ取引支援システム</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">バージョン:</span>
                      <Badge variant="outline">v{currentVersion}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">技術スタック:</span>
                      <span className="text-sm">Tauri + Next.js</span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-3">
                    <p className="text-xs text-muted-foreground">
                      © 2025 ArbitrageAssistant. All rights reserved.
                    </p>
                  </CardFooter>
                </Card>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowAboutDialog(false)}>
              閉じる
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}