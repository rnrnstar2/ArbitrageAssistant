# S3配布アーキテクチャ

## 概要

Hedge Systemは、AWS S3を使用して各プラットフォーム向けのインストーラーとアップデート用ファイルを配布しています。このドキュメントでは、S3にアップロードされる各ファイルの役割と構造について説明します。

## S3バケット構造

```
s3://amplify-arbitrageassistantreleases/releases/hedge-system/
├── latest.json                     # アップデーターマニフェスト
└── v{version}/                     # バージョン別ディレクトリ
    ├── dmg/                        # macOSインストーラー
    ├── macos/                      # macOSアップデーター
    ├── nsis/                       # Windows NSISインストーラー
    └── msi/                        # Windows MSIインストーラー
```

## プラットフォーム別ファイル

### macOS

#### DMGファイル（インストーラー）
- **用途**: 初回インストール用のディスクイメージ
- **ファイル名**: 
  - `Hedge System_{version}_aarch64.dmg` - Apple Silicon (M1/M2/M3)用
  - `Hedge System_{version}_x64.dmg` - Intel Mac用
- **特徴**: 
  - ドラッグ&ドロップでインストール可能
  - macOSのGatekeeperに対応
  - ユーザーフレンドリーなインストール体験

#### app.tar.gz（アップデーター）
- **用途**: 自動アップデート用の圧縮アプリケーションバンドル
- **ファイル名**: `Hedge System.app.tar.gz`
- **特徴**:
  - 軽量で高速なダウンロード
  - 既存インストールの上書き更新
  - 署名ファイル（.sig）付きで配布

### Windows

#### MSIファイル（エンタープライズ向け）
- **用途**: グループポリシーやSCCMでの展開に適したインストーラー
- **ファイル名**: `Hedge System_{version}_x64_en-US.msi`
- **特徴**:
  - サイレントインストール対応
  - エンタープライズ環境での大規模展開向け
  - Windows Installerテクノロジー使用

#### EXEファイル（一般ユーザー向け）
- **用途**: 標準的なWindowsインストーラー
- **ファイル名**: `Hedge System_{version}_x64-setup.exe`
- **特徴**:
  - NSISベースのインストーラー
  - カスタマイズ可能なインストールオプション
  - 一般的なWindowsユーザー向け

#### ZIPファイル（アップデーター）
- **用途**: Windows向け自動アップデート
- **ファイル名**: 
  - `*.msi.zip` - MSI形式のアップデート
  - `*.nsis.zip` - NSIS形式のアップデート
- **特徴**: 署名ファイル付きで配布

## 特殊ファイル

### latest.json
アップデーターが新バージョンをチェックするためのマニフェストファイル。

```json
{
  "version": "v0.1.16",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2025-05-29T14:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkK...",
      "url": "https://amplify-arbitrageassistantreleases.s3.ap-northeast-1.amazonaws.com/releases/hedge-system/v0.1.16/macos/Hedge System.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "...",
      "url": "..."
    },
    "windows-x86_64": {
      "signature": "...",
      "url": "..."
    }
  }
}
```

### 署名ファイル（.sig）
- **用途**: ファイルの真正性と完全性を保証
- **仕組み**:
  - Tauriの秘密鍵で署名
  - アプリ内蔵の公開鍵で検証
  - ファイルの改ざんを防止
- **対象ファイル**:
  - `*.app.tar.gz.sig`
  - `*.msi.zip.sig`
  - `*.nsis.zip.sig`

## なぜ複数のファイル形式が必要なのか

### プラットフォームの多様性
1. **macOS**: Intel MacとApple Siliconの両方をサポート
2. **Windows**: 個人ユーザーとエンタープライズの異なるニーズに対応

### 配布シナリオの違い
1. **初回インストール**: ユーザーフレンドリーなインストーラー（DMG/EXE/MSI）
2. **自動アップデート**: 軽量で高速な圧縮ファイル（tar.gz/zip）

### セキュリティ要件
- すべてのアップデート用ファイルに署名を付与
- Tauriのアップデーターシステムによる自動検証

## アップデートプロセス

1. **アプリケーション起動時**:
   - `latest.json`をダウンロード
   - 現在のバージョンと比較

2. **新バージョン検出時**:
   - プラットフォームに応じたアップデートファイルをダウンロード
   - 署名を検証
   - バックグラウンドで更新を準備

3. **更新の適用**:
   - ユーザーの確認後、アプリを再起動して更新を適用

## S3配布の利点

1. **高可用性**: AWS S3の99.99%の可用性
2. **グローバル配信**: CloudFrontとの統合でグローバルに高速配信
3. **コスト効率**: 使用量ベースの課金
4. **スケーラビリティ**: ユーザー数の増加に自動対応

## セキュリティ考慮事項

1. **HTTPS配信**: すべてのダウンロードはHTTPS経由
2. **署名検証**: Tauriの組み込み署名検証システム
3. **バケットポリシー**: 読み取り専用のパブリックアクセス
4. **バージョン管理**: 古いバージョンも保持してロールバック可能

## トラブルシューティング

### アップデートが機能しない場合
1. `latest.json`のURLが正しいか確認
2. 署名ファイルが正しくアップロードされているか確認
3. `tauri.conf.json`の公開鍵設定を確認

### ダウンロードが遅い場合
1. CloudFrontの導入を検討
2. リージョンの最適化
3. ファイルサイズの最適化

## 今後の改善案

1. **CloudFront統合**: CDNによる配信速度の向上
2. **デルタアップデート**: 差分のみのダウンロードで更新サイズを削減
3. **ミラーサーバー**: 複数のS3バケットでの冗長性確保
4. **アップデート統計**: ダウンロード数やバージョン分布の追跡