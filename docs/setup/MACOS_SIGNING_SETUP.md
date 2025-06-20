# macOS署名設定ガイド

## 現在の問題

現在、Hedge SystemのmacOSビルドは署名されていないため、ダウンロード後に「壊れている」というエラーが表示されます。これはmacOSのGatekeeper機能によるもので、未署名のアプリケーションをブロックする仕組みです。

## 一時的な回避方法

### 方法1: 検疫属性を削除（コマンドライン） - 推奨
```bash
# アプリケーションフォルダにインストール後
xattr -cr /Applications/Hedge\ System.app

# ダウンロードフォルダの場合
xattr -cr ~/Downloads/Hedge\ System.app
```
**注意**: このコマンドを実行すると、macOSの検疫属性が完全に削除されるため、セキュリティ警告は表示されなくなります。「このまま開く」オプションも表示されません。

### 方法2: 右クリックで開く
1. Finderでアプリを右クリック（またはControlキーを押しながらクリック）
2. 「開く」を選択
3. 警告ダイアログで「開く」をクリック

### 方法3: システム環境設定から許可（方法2を試した後のみ）
1. 先に方法2（右クリックで開く）を試す
2. それでも開けない場合、システム環境設定 → プライバシーとセキュリティを開く
3. 一般タブの下部に「"Hedge System"は開発元を確認できないため...」というメッセージが表示される場合がある
4. 「このまま開く」ボタンをクリック

**重要**: `xattr -cr` コマンドを使用した場合、この方法は不要です。

## 恒久的な解決策（開発者向け）

### 1. Apple Developer Programへの登録（必須）
- 年間$99のApple Developer Programへの登録が必要
- https://developer.apple.com/programs/

### 2. 証明書の作成
1. Apple Developerアカウントで「Developer ID Application」証明書を作成
2. 証明書をmacOSのキーチェーンにインストール

### 3. GitHub Secretsの設定
```bash
# 証明書をbase64エンコード
base64 -i certificate.p12 -o certificate.base64

# GitHub Secretsに以下を追加：
# - APPLE_CERTIFICATE: base64エンコードされた証明書
# - APPLE_CERTIFICATE_PASSWORD: 証明書のパスワード
# - APPLE_SIGNING_IDENTITY: "Developer ID Application: Your Name (XXXXXXXXXX)"
# - APPLE_ID: Apple ID
# - APPLE_PASSWORD: App-specific password
```

### 4. エンタイトルメントファイルの作成
`apps/hedge-system/src-tauri/entitlements.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

### 5. tauri.conf.jsonの更新
```json
{
  "bundle": {
    "macOS": {
      "entitlements": "./entitlements.plist",
      "exceptionDomain": "",
      "frameworks": [],
      "minimumSystemVersion": "10.13",
      "signingIdentity": null,
      "providerShortName": null
    }
  }
}
```

### 6. GitHub Actionsワークフローの更新
```yaml
- name: Import Apple Certificate
  if: matrix.platform == 'macos-latest'
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  run: |
    # 証明書をインポート
    echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
    security create-keychain -p actions temp.keychain
    security default-keychain -s temp.keychain
    security unlock-keychain -p actions temp.keychain
    security import certificate.p12 -k temp.keychain -P $APPLE_CERTIFICATE_PASSWORD -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k actions temp.keychain

- name: Build Tauri app
  env:
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
```

### 7. Notarization（公証）の追加
ビルド後にAppleのNotarizationサービスに送信：
```yaml
- name: Notarize app
  if: matrix.platform == 'macos-latest'
  env:
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
  run: |
    xcrun altool --notarize-app \
      --primary-bundle-id "com.yourdomain.hedge-system" \
      --username "$APPLE_ID" \
      --password "$APPLE_PASSWORD" \
      --file "path/to/app.dmg"
```

## コスト考慮事項

- Apple Developer Program: 年間$99
- 署名とNotarizationにより配布が可能に
- エンタープライズ配布の場合は別途Enterprise Programが必要（年間$299）

## 代替案

### 1. 自己署名証明書（推奨しない）
- 無料だが、ユーザーは同様の警告を受ける
- 信頼性が低い

### 2. Electronへの移行
- Electronも同様の署名が必要
- 根本的な解決にはならない

### 3. Web版の提供
- 署名不要
- インストール不要
- ただしデスクトップアプリの利点を失う

## まとめ

現時点では、ユーザーに一時的な回避方法を案内するのが現実的です。将来的にアプリの配布を本格化する場合は、Apple Developer Programへの登録と適切な署名設定が必須となります。