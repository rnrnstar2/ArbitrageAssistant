'use client';

import { useEffect, useRef, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { listen } from '@tauri-apps/api/event';

interface AutoUpdaterOptions {
  // アップデートチェックの間隔（ミリ秒）
  checkInterval?: number;
  // サイレントアップデート（ユーザー確認なし）
  silent?: boolean;
  // 起動時の初回チェックまでの遅延（ミリ秒）
  initialDelay?: number;
  // アップデート通知のコールバック
  onUpdateAvailable?: (version: string, notes: string) => void;
}

export function useAutoUpdater(options: AutoUpdaterOptions = {}) {
  const {
    checkInterval = 30 * 60 * 1000, // デフォルト30分
    silent = false, // デフォルトでポップアップ表示
    initialDelay = 10 * 1000, // デフォルト10秒
    onUpdateAvailable,
  } = options;

  const isUpdatingRef = useRef(false);

  useEffect(() => {
    const performUpdate = async (isManual = false) => {
      // 既にアップデート中の場合はスキップ
      if (isUpdatingRef.current) return;

      try {
        console.log(isManual ? '手動アップデートチェック中...' : 'アップデートをチェック中...');
        
        // デバッグ用のアラート
        if (isManual) {
          alert('アップデートをチェックしています...');
        }
        
        const update = await check();
        
        if (update?.available) {
          console.log(`新しいバージョン ${update.version} が利用可能です`);
          
          if (silent && !isManual) {
            // サイレントアップデート：ユーザー確認なし（手動の場合は除く）
            await downloadAndInstallUpdate(update);
          } else {
            // ポップアップ通知：ユーザーに通知
            if (onUpdateAvailable) {
              onUpdateAvailable(update.version, update.body || 'アップデートが利用可能です');
            }
          }
        } else {
          console.log('現在のバージョンは最新です');
          if (isManual) {
            // 手動チェックで最新版の場合のみ通知
            alert('お使いのバージョンは最新です。');
          }
        }
      } catch (error) {
        console.error('アップデートチェックエラー:', error);
        if (isManual) {
          alert('アップデートのチェック中にエラーが発生しました。');
        }
        isUpdatingRef.current = false;
      }
    };

    // メニューからの手動チェックイベントをリッスン
    let unlistenManualCheck: (() => void) | null = null;
    
    const setupManualCheckListener = async () => {
      try {
        console.log('[useAutoUpdater] Setting up manual check listener...');
        // グローバルイベントリスナーとして登録
        unlistenManualCheck = await listen('manual-update-check', (event) => {
          console.log('[useAutoUpdater] Manual update check event received!', event);
          performUpdate(true);
        });
        console.log('[useAutoUpdater] Manual check listener setup complete');
      } catch (error) {
        console.error('[useAutoUpdater] Failed to setup manual check listener:', error);
      }
    };

    setupManualCheckListener();

    // 初回チェック
    const initialTimer = setTimeout(() => performUpdate(false), initialDelay);

    // 定期的なチェック
    const interval = setInterval(() => performUpdate(false), checkInterval);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      if (unlistenManualCheck) {
        unlistenManualCheck();
      }
    };
  }, [checkInterval, silent, initialDelay, onUpdateAvailable]);

  // アップデートをダウンロード・インストールする関数
  const downloadAndInstallUpdate = async (update: any) => {
    isUpdatingRef.current = true;
    
    try {
      console.log('バックグラウンドでダウンロード開始...');
      
      // ダウンロードと進捗の追跡
      let lastProgress = 0;
      await update.downloadAndInstall((event: any) => {
        // DownloadEventの型に基づいて処理
        if (event.event === 'Started' && event.data?.contentLength) {
          console.log(`ダウンロード開始: ${event.data.contentLength} bytes`);
        } else if (event.event === 'Progress' && event.data?.contentLength) {
          const percentage = Math.round((event.data.downloadedLength || 0) / event.data.contentLength * 100);
          if (percentage > lastProgress + 10) {
            console.log(`ダウンロード進捗: ${percentage}%`);
            lastProgress = percentage;
          }
        } else if (event.event === 'Finished') {
          console.log('ダウンロード完了');
        }
      });
      
      console.log('アップデートのインストール完了。アプリを再起動します...');
      
      // 3秒後に自動的に再起動
      setTimeout(async () => {
        await relaunch();
      }, 3000);
      
    } catch (error) {
      console.error('アップデートインストールエラー:', error);
      isUpdatingRef.current = false;
      throw error;
    }
  };

  return { 
    isUpdating: isUpdatingRef.current,
    downloadAndInstallUpdate
  };
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