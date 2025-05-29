'use client';

import { useEffect, useRef } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

interface AutoUpdaterOptions {
  // アップデートチェックの間隔（ミリ秒）
  checkInterval?: number;
  // サイレントアップデート（ユーザー確認なし）
  silent?: boolean;
  // 起動時の初回チェックまでの遅延（ミリ秒）
  initialDelay?: number;
}

export function useAutoUpdater(options: AutoUpdaterOptions = {}) {
  const {
    checkInterval = 30 * 60 * 1000, // デフォルト30分
    silent = true,
    initialDelay = 10 * 1000, // デフォルト10秒
  } = options;

  const isUpdatingRef = useRef(false);

  useEffect(() => {
    const performUpdate = async () => {
      // 既にアップデート中の場合はスキップ
      if (isUpdatingRef.current) return;

      try {
        console.log('アップデートをチェック中...');
        const update = await check();
        
        if (update?.available) {
          console.log(`新しいバージョン ${update.version} が利用可能です`);
          
          if (silent) {
            // サイレントアップデート：ユーザー確認なし
            isUpdatingRef.current = true;
            
            console.log('バックグラウンドでダウンロード開始...');
            
            // ダウンロードと進捗の追跡
            let lastProgress = 0;
            await update.downloadAndInstall((progress) => {
              const percentage = Math.round((progress.downloadedLength / progress.contentLength) * 100);
              if (percentage > lastProgress + 10) {
                console.log(`ダウンロード進捗: ${percentage}%`);
                lastProgress = percentage;
              }
            });
            
            console.log('アップデートのインストール完了。アプリを再起動します...');
            
            // 3秒後に自動的に再起動
            setTimeout(async () => {
              await relaunch();
            }, 3000);
            
          } else {
            // 非サイレント：ユーザーに通知（UpdateCheckerコンポーネントで処理）
            console.log('アップデートが利用可能です（ユーザー確認待ち）');
          }
        } else {
          console.log('現在のバージョンは最新です');
        }
      } catch (error) {
        console.error('自動アップデートエラー:', error);
        isUpdatingRef.current = false;
      }
    };

    // 初回チェック
    const initialTimer = setTimeout(performUpdate, initialDelay);

    // 定期的なチェック
    const interval = setInterval(performUpdate, checkInterval);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [checkInterval, silent, initialDelay]);

  return { isUpdating: isUpdatingRef.current };
}

// 起動時に即座にチェックする場合の関数
export async function checkAndInstallUpdatesSilently() {
  try {
    const update = await check();
    
    if (update?.available) {
      console.log(`サイレントアップデート開始: v${update.version}`);
      
      // バックグラウンドでダウンロード・インストール
      await update.downloadAndInstall();
      
      // 自動再起動
      await relaunch();
    }
  } catch (error) {
    console.error('サイレントアップデートエラー:', error);
  }
}