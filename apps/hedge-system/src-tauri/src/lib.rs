use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Manager, AppHandle, Emitter};

mod websocket;

// アップデートチェックコマンド
#[tauri::command]
async fn check_for_updates(app: AppHandle) -> Result<String, String> {
    log::info!("Manual update check triggered via command");
    // フロントエンドで処理するため、イベントを発行
    app.emit("manual-update-check", ()).map_err(|e| e.to_string())?;
    Ok("Update check initiated".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .manage(websocket::WSServerManager::default())
    .invoke_handler(tauri::generate_handler![
      check_for_updates,
      websocket::start_websocket_server,
      websocket::stop_websocket_server,
      websocket::get_websocket_server_status,
      websocket::get_websocket_clients,
      websocket::disconnect_websocket_client,
      websocket::update_websocket_config
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // アプリケーションメニューを作成
      let check_updates = MenuItemBuilder::with_id("check_updates", "アップデートを確認").build(app)?;
      let about = MenuItemBuilder::with_id("about", "Hedge Systemについて").build(app)?;
      let quit = MenuItemBuilder::with_id("quit", "終了").build(app)?;

      let app_menu = SubmenuBuilder::new(app, "Hedge System")
        .item(&about)
        .separator()
        .item(&check_updates)
        .separator()
        .item(&quit)
        .build()?;

      let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .build()?;

      app.set_menu(menu)?;

      // メニューイベントハンドラー
      app.on_menu_event(move |app, event| {
        match event.id().as_ref() {
          "check_updates" => {
            log::info!("Menu: Check for updates clicked");
            
            // メインウィンドウに対してイベントを送信
            if let Some(window) = app.get_webview_window("main") {
              if let Err(e) = window.emit("manual-update-check", ()) {
                log::error!("Failed to emit update check event: {}", e);
              }
            } else {
              // ウィンドウが見つからない場合は、アプリ全体にイベントを送信
              if let Err(e) = app.emit("manual-update-check", ()) {
                log::error!("Failed to emit update check event: {}", e);
              }
            }
          }
          "about" => {
            log::info!("Menu: About clicked");
            if let Err(e) = app.emit("show-about", ()) {
              log::error!("Failed to emit about event: {}", e);
            }
          }
          "quit" => {
            log::info!("Menu: Quit clicked");
            std::process::exit(0);
          }
          _ => {}
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
