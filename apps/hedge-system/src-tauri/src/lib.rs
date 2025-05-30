use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Manager, AppHandle, Emitter};

// アップデートチェックコマンド
#[tauri::command]
async fn check_for_updates(app: AppHandle) -> Result<String, String> {
    log::info!("Manual update check triggered");
    // フロントエンドで処理するため、イベントを発行
    app.emit("manual-update-check", ()).map_err(|e| e.to_string())?;
    Ok("Update check initiated".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![check_for_updates])
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
            println!("DEBUG: Menu check_updates clicked"); // デバッグ出力
            if let Err(e) = app.emit("manual-update-check", ()) {
              log::error!("Failed to emit update check event: {}", e);
              println!("DEBUG: Failed to emit event: {}", e); // デバッグ出力
            } else {
              println!("DEBUG: Successfully emitted manual-update-check event"); // デバッグ出力
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
