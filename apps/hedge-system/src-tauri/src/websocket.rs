use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::State;
use tokio::sync::{Mutex, RwLock, mpsc};
use tokio::time::{Instant, interval};
use tokio_tungstenite::{
    accept_async,
    tungstenite::{Message, protocol::CloseFrame},
};
use futures_util::{SinkExt, StreamExt};
use log::{debug, error, info, warn};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WSServerState {
    pub is_running: bool,
    pub port: u16,
    pub host: String,
    pub connected_clients: usize,
    pub total_messages_received: u64,
    pub total_messages_sent: u64,
    pub errors: u64,
    pub uptime_seconds: u64,
    pub started_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClientConnection {
    pub id: String,
    pub connected_at: String,
    pub last_heartbeat: String,
    pub authenticated: bool,
    pub ea_info: Option<EAInfo>,
    pub message_count: u64,
    pub error_count: u64,
    pub latency_ms: Option<f64>,
    pub connection_quality: String, // "EXCELLENT", "GOOD", "POOR"
    pub message_buffer_size: usize,
    pub last_message_timestamp: String,
}

#[derive(Debug)]
pub struct MessageBuffer {
    messages: Vec<String>,
    max_size: usize,
    created_at: Instant,
}

#[derive(Debug)]
pub struct ConnectionPool {
    active_connections: Arc<RwLock<HashMap<String, Arc<Connection>>>>,
    message_buffers: Arc<RwLock<HashMap<String, MessageBuffer>>>,
    performance_metrics: Arc<RwLock<PerformanceMetrics>>,
}

#[derive(Debug)]
pub struct Connection {
    id: String,
    sender: Arc<Mutex<mpsc::UnboundedSender<Message>>>,
    info: Arc<RwLock<ClientConnection>>,
}

#[derive(Debug, Default)]
pub struct PerformanceMetrics {
    pub total_connections: u64,
    pub peak_connections: usize,
    pub avg_latency_ms: f64,
    pub messages_per_second: f64,
    pub error_rate: f64,
    pub uptime_seconds: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EAInfo {
    pub version: String,
    pub platform: String, // MT4/MT5
    pub account: String,
    pub server_name: Option<String>,
    pub company_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WSServerConfig {
    pub port: u16,
    pub host: String,
    pub auth_token: String,
    pub max_connections: usize,
    pub heartbeat_interval_seconds: u64,
    pub connection_timeout_seconds: u64,
}

#[derive(Debug)]
pub struct WSServerManager {
    pub state: Arc<Mutex<WSServerState>>,
    pub clients: Arc<RwLock<HashMap<String, ClientConnection>>>,
    pub config: Arc<RwLock<WSServerConfig>>,
    pub server_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    pub started_at: Arc<Mutex<Option<Instant>>>,
    pub connection_pool: Arc<ConnectionPool>,
    pub heartbeat_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    pub performance_monitor_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl ConnectionPool {
    pub fn new() -> Self {
        Self {
            active_connections: Arc::new(RwLock::new(HashMap::new())),
            message_buffers: Arc::new(RwLock::new(HashMap::new())),
            performance_metrics: Arc::new(RwLock::new(PerformanceMetrics::default())),
        }
    }
    
    pub async fn add_connection(&self, id: String, connection: Arc<Connection>) {
        self.active_connections.write().await.insert(id.clone(), connection);
        self.message_buffers.write().await.insert(id, MessageBuffer {
            messages: Vec::with_capacity(1000),
            max_size: 1000,
            created_at: Instant::now(),
        });
        
        // Update performance metrics
        let mut metrics = self.performance_metrics.write().await;
        metrics.total_connections += 1;
        let current_count = self.active_connections.read().await.len();
        if current_count > metrics.peak_connections {
            metrics.peak_connections = current_count;
        }
    }
    
    pub async fn remove_connection(&self, id: &str) {
        self.active_connections.write().await.remove(id);
        self.message_buffers.write().await.remove(id);
    }
    
    pub async fn get_connection(&self, id: &str) -> Option<Arc<Connection>> {
        self.active_connections.read().await.get(id).cloned()
    }
    
    pub async fn broadcast_message(&self, message: &str) -> Result<usize, String> {
        let connections = self.active_connections.read().await;
        let mut sent_count = 0;
        
        for connection in connections.values() {
            if let Ok(sender) = connection.sender.try_lock() {
                if sender.send(Message::Text(message.to_string())).is_ok() {
                    sent_count += 1;
                }
            }
        }
        
        Ok(sent_count)
    }
    
    pub async fn get_performance_metrics(&self) -> PerformanceMetrics {
        self.performance_metrics.read().await.clone()
    }
    
    pub async fn update_latency(&self, client_id: &str, latency_ms: f64) {
        if let Some(connection) = self.get_connection(client_id).await {
            let mut info = connection.info.write().await;
            info.latency_ms = Some(latency_ms);
            info.connection_quality = if latency_ms < 50.0 {
                "EXCELLENT".to_string()
            } else if latency_ms < 100.0 {
                "GOOD".to_string()
            } else {
                "POOR".to_string()
            };
        }
    }
}

impl Default for WSServerManager {
    fn default() -> Self {
        Self {
            state: Arc::new(Mutex::new(WSServerState {
                is_running: false,
                port: 8080,
                host: "127.0.0.1".to_string(),
                connected_clients: 0,
                total_messages_received: 0,
                total_messages_sent: 0,
                errors: 0,
                uptime_seconds: 0,
                started_at: None,
            })),
            clients: Arc::new(RwLock::new(HashMap::new())),
            config: Arc::new(RwLock::new(WSServerConfig {
                port: 8080,
                host: "127.0.0.1".to_string(),
                auth_token: "hedge-system-default-token".to_string(),
                max_connections: 10,
                heartbeat_interval_seconds: 30,
                connection_timeout_seconds: 300,
            })),
            server_handle: Arc::new(Mutex::new(None)),
            started_at: Arc::new(Mutex::new(None)),
            connection_pool: Arc::new(ConnectionPool::new()),
            heartbeat_handle: Arc::new(Mutex::new(None)),
            performance_monitor_handle: Arc::new(Mutex::new(None)),
        }
    }
}

impl WSServerManager {
    pub async fn start_server(&self) -> Result<(), String> {
        let mut state = self.state.lock().await;
        
        if state.is_running {
            return Err("WebSocket server is already running".to_string());
        }

        let config = {
            let config_guard = self.config.read().await;
            WSServerConfig {
                port: config_guard.port,
                host: config_guard.host.clone(),
                auth_token: config_guard.auth_token.clone(),
                max_connections: config_guard.max_connections,
                heartbeat_interval_seconds: config_guard.heartbeat_interval_seconds,
                connection_timeout_seconds: config_guard.connection_timeout_seconds,
            }
        };
        let server_addr = format!("{}:{}", config.host, config.port);
        
        info!("Starting WebSocket server on {}", server_addr);

        // TCPリスナーを開始
        let listener = tokio::net::TcpListener::bind(&server_addr)
            .await
            .map_err(|e| format!("Failed to bind to {}: {}", server_addr, e))?;

        // サーバー状態を更新
        state.is_running = true;
        state.port = config.port;
        state.host = config.host.clone();
        state.started_at = Some(chrono::Utc::now().to_rfc3339());
        
        // 開始時刻を記録
        *self.started_at.lock().await = Some(Instant::now());

        drop(state); // ロックを解放

        // サーバータスクを開始
        let server_task = self.spawn_server_task(listener, config.clone()).await;
        *self.server_handle.lock().await = Some(server_task);
        
        // ハートビート監視を開始
        let heartbeat_task = self.spawn_heartbeat_monitor(config.clone()).await;
        *self.heartbeat_handle.lock().await = Some(heartbeat_task);
        
        // パフォーマンス監視を開始
        let performance_task = self.spawn_performance_monitor().await;
        *self.performance_monitor_handle.lock().await = Some(performance_task);

        info!("WebSocket server started successfully on {} with high-performance features", server_addr);
        Ok(())
    }

    pub async fn stop_server(&self) -> Result<(), String> {
        let mut state = self.state.lock().await;
        
        if !state.is_running {
            return Ok(()); // 既に停止している
        }

        info!("Stopping WebSocket server...");

        // サーバータスクを停止
        if let Some(handle) = self.server_handle.lock().await.take() {
            handle.abort();
        }
        
        // ハートビート監視を停止
        if let Some(handle) = self.heartbeat_handle.lock().await.take() {
            handle.abort();
        }
        
        // パフォーマンス監視を停止
        if let Some(handle) = self.performance_monitor_handle.lock().await.take() {
            handle.abort();
        }

        // 全クライアントを切断
        self.disconnect_all_clients().await;

        // 状態をリセット
        state.is_running = false;
        state.connected_clients = 0;
        state.started_at = None;
        *self.started_at.lock().await = None;

        info!("WebSocket server stopped with all monitoring systems");
        Ok(())
    }

    pub async fn get_status(&self) -> WSServerState {
        let mut state = self.state.lock().await;
        
        // 稼働時間を更新
        if let Some(started_at) = *self.started_at.lock().await {
            state.uptime_seconds = started_at.elapsed().as_secs();
        }
        
        // 接続数を更新
        state.connected_clients = self.clients.read().await.len();
        
        state.clone()
    }

    pub async fn get_clients(&self) -> Vec<ClientConnection> {
        self.clients.read().await.values().cloned().collect()
    }

    pub async fn disconnect_client(&self, client_id: &str) -> Result<(), String> {
        let mut clients = self.clients.write().await;
        
        if clients.remove(client_id).is_some() {
            info!("Client {} disconnected by request", client_id);
            Ok(())
        } else {
            Err(format!("Client {} not found", client_id))
        }
    }

    async fn disconnect_all_clients(&self) {
        let mut clients = self.clients.write().await;
        let client_count = clients.len();
        clients.clear();
        
        if client_count > 0 {
            info!("Disconnected {} clients", client_count);
        }
    }

    async fn spawn_server_task(
        &self,
        listener: tokio::net::TcpListener,
        config: WSServerConfig,
    ) -> tokio::task::JoinHandle<()> {
        let state = Arc::clone(&self.state);
        let clients = Arc::clone(&self.clients);
        
        tokio::spawn(async move {
            info!("WebSocket server listening for connections...");
            
            while let Ok((stream, addr)) = listener.accept().await {
                debug!("New connection from: {}", addr);
                
                // 接続数制限チェック
                let current_connections = clients.read().await.len();
                if current_connections >= config.max_connections {
                    warn!("Connection rejected: max connections exceeded ({})", config.max_connections);
                    // 接続を即座にクローズ
                    drop(stream);
                    continue;
                }

                let state_clone = Arc::clone(&state);
                let clients_clone = Arc::clone(&clients);
                let config_clone = config.clone();
                
                // 各接続を別タスクで処理
                tokio::spawn(async move {
                    if let Err(e) = Self::handle_connection(
                        stream,
                        addr.to_string(),
                        state_clone,
                        clients_clone,
                        config_clone,
                    ).await {
                        error!("Connection handling error: {}", e);
                    }
                });
            }
        })
    }

    // 高性能ハートビート監視システム
    async fn spawn_heartbeat_monitor(
        &self,
        config: WSServerConfig,
    ) -> tokio::task::JoinHandle<()> {
        let clients = Arc::clone(&self.clients);
        let connection_pool = Arc::clone(&self.connection_pool);
        
        tokio::spawn(async move {
            let mut heartbeat_interval = interval(Duration::from_secs(config.heartbeat_interval_seconds));
            
            info!("Heartbeat monitor started with {}s interval", config.heartbeat_interval_seconds);
            
            loop {
                heartbeat_interval.tick().await;
                
                // クライアントの生存確認
                let now = chrono::Utc::now();
                let timeout_threshold = Duration::from_secs(config.connection_timeout_seconds);
                let mut inactive_clients = Vec::new();
                
                {
                    let clients_lock = clients.read().await;
                    for (client_id, client) in clients_lock.iter() {
                        if let Ok(last_heartbeat) = chrono::DateTime::parse_from_rfc3339(&client.last_heartbeat) {
                            let elapsed = now.signed_duration_since(last_heartbeat);
                            if elapsed.num_seconds() as u64 > config.connection_timeout_seconds {
                                inactive_clients.push(client_id.clone());
                            }
                        }
                    }
                }
                
                // 非アクティブクライアントを削除
                if !inactive_clients.is_empty() {
                    let mut clients_lock = clients.write().await;
                    for client_id in inactive_clients {
                        warn!("Removing inactive client: {}", client_id);
                        clients_lock.remove(&client_id);
                        connection_pool.remove_connection(&client_id).await;
                    }
                }
                
                // ハートビートメッセージを送信
                let heartbeat_msg = serde_json::json!({
                    "type": "HEARTBEAT",
                    "timestamp": now.to_rfc3339(),
                    "server": "hedge-system-ws"
                }).to_string();
                
                if let Ok(sent_count) = connection_pool.broadcast_message(&heartbeat_msg).await {
                    debug!("Heartbeat sent to {} clients", sent_count);
                }
            }
        })
    }

    // パフォーマンス監視システム
    async fn spawn_performance_monitor(&self) -> tokio::task::JoinHandle<()> {
        let connection_pool = Arc::clone(&self.connection_pool);
        let state = Arc::clone(&self.state);
        let started_at = Arc::clone(&self.started_at);
        
        tokio::spawn(async move {
            let mut monitor_interval = interval(Duration::from_secs(10)); // 10秒間隔
            
            info!("Performance monitor started");
            
            loop {
                monitor_interval.tick().await;
                
                // パフォーマンスメトリクスを更新
                let metrics = connection_pool.get_performance_metrics().await;
                
                // サーバー状態を更新
                if let Ok(mut state_lock) = state.try_lock() {
                    if let Some(start_time) = *started_at.lock().await {
                        state_lock.uptime_seconds = start_time.elapsed().as_secs();
                    }
                    
                    // メッセージ/秒を計算
                    if state_lock.uptime_seconds > 0 {
                        let msg_per_sec = state_lock.total_messages_received as f64 / state_lock.uptime_seconds as f64;
                        
                        // パフォーマンス警告
                        if msg_per_sec > 1000.0 {
                            warn!("High message rate detected: {:.2} msg/s", msg_per_sec);
                        }
                        
                        if metrics.avg_latency_ms > 100.0 {
                            warn!("High latency detected: {:.2}ms", metrics.avg_latency_ms);
                        }
                        
                        if metrics.error_rate > 5.0 {
                            warn!("High error rate detected: {:.2}%", metrics.error_rate);
                        }
                    }
                }
                
                debug!("Performance metrics - Connections: {}, Peak: {}, Avg latency: {:.2}ms", 
                       metrics.total_connections, metrics.peak_connections, metrics.avg_latency_ms);
            }
        })
    }

    async fn handle_connection(
        stream: tokio::net::TcpStream,
        client_addr: String,
        state: Arc<Mutex<WSServerState>>,
        clients: Arc<RwLock<HashMap<String, ClientConnection>>>,
        config: WSServerConfig,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let ws_stream = accept_async(stream).await?;
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        
        let client_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        // クライアント情報を登録（高性能機能付き）
        let client = ClientConnection {
            id: client_id.clone(),
            connected_at: now.clone(),
            last_heartbeat: now.clone(),
            authenticated: false,
            ea_info: None,
            message_count: 0,
            error_count: 0,
            latency_ms: None,
            connection_quality: "UNKNOWN".to_string(),
            message_buffer_size: 0,
            last_message_timestamp: now,
        };
        
        clients.write().await.insert(client_id.clone(), client);
        
        info!("Client {} connected from {}", client_id, client_addr);

        // メッセージ処理ループ（高性能版）
        while let Some(msg) = ws_receiver.next().await {
            let message_start_time = Instant::now();
            
            match msg {
                Ok(Message::Text(text)) => {
                    // メッセージ統計を更新
                    {
                        let mut state_lock = state.lock().await;
                        state_lock.total_messages_received += 1;
                    }
                    
                    // クライアント統計を更新（高性能機能付き）
                    {
                        let mut clients_lock = clients.write().await;
                        if let Some(client) = clients_lock.get_mut(&client_id) {
                            client.message_count += 1;
                            client.last_heartbeat = chrono::Utc::now().to_rfc3339();
                            client.last_message_timestamp = chrono::Utc::now().to_rfc3339();
                        }
                    }

                    debug!("Received message from {}: {}", client_id, text);
                    
                    // レイテンシ測定付きメッセージ処理
                    match Self::process_message(&text, &client_id, &clients, &config).await {
                        Ok(response) => {
                            if let Some(resp) = response {
                                let send_start = Instant::now();
                                
                                if let Err(e) = ws_sender.send(Message::Text(resp)).await {
                                    error!("Failed to send response to {}: {}", client_id, e);
                                    break;
                                }
                                
                                // レイテンシ計算・記録
                                let total_latency = message_start_time.elapsed().as_millis() as f64;
                                
                                // クライアント情報を更新
                                {
                                    let mut clients_lock = clients.write().await;
                                    if let Some(client) = clients_lock.get_mut(&client_id) {
                                        client.latency_ms = Some(total_latency);
                                        client.connection_quality = if total_latency < 50.0 {
                                            "EXCELLENT".to_string()
                                        } else if total_latency < 100.0 {
                                            "GOOD".to_string()
                                        } else {
                                            "POOR".to_string()
                                        };
                                    }
                                }
                                
                                let mut state_lock = state.lock().await;
                                state_lock.total_messages_sent += 1;
                                
                                // パフォーマンス警告
                                if total_latency > 100.0 {
                                    warn!("High latency detected for client {}: {:.2}ms", client_id, total_latency);
                                }
                            }
                        }
                        Err(e) => {
                            error!("Message processing error for {}: {}", client_id, e);
                            
                            // エラー統計を更新
                            {
                                let mut state_lock = state.lock().await;
                                state_lock.errors += 1;
                            }
                            
                            {
                                let mut clients_lock = clients.write().await;
                                if let Some(client) = clients_lock.get_mut(&client_id) {
                                    client.error_count += 1;
                                }
                            }
                        }
                    }
                }
                Ok(Message::Binary(_)) => {
                    warn!("Binary messages not supported from {}", client_id);
                }
                Ok(Message::Ping(ping)) => {
                    debug!("Ping from {}", client_id);
                    if let Err(e) = ws_sender.send(Message::Pong(ping)).await {
                        error!("Failed to send pong to {}: {}", client_id, e);
                        break;
                    }
                }
                Ok(Message::Pong(_)) => {
                    debug!("Pong from {}", client_id);
                    // heartbeatを更新
                    let mut clients_lock = clients.write().await;
                    if let Some(client) = clients_lock.get_mut(&client_id) {
                        client.last_heartbeat = chrono::Utc::now().to_rfc3339();
                    }
                }
                Ok(Message::Close(_)) => {
                    info!("Client {} disconnected", client_id);
                    break;
                }
                Ok(Message::Frame(_)) => {
                    // Frame messages are handled internally by tungstenite
                    debug!("Frame message from {}", client_id);
                }
                Err(e) => {
                    error!("WebSocket error for {}: {}", client_id, e);
                    break;
                }
            }
        }

        // クライアントを削除
        clients.write().await.remove(&client_id);
        info!("Client {} removed", client_id);
        
        Ok(())
    }

    async fn process_message(
        message: &str,
        client_id: &str,
        clients: &Arc<RwLock<HashMap<String, ClientConnection>>>,
        config: &WSServerConfig,
    ) -> Result<Option<String>, String> {
        // JSONメッセージを解析
        let json_msg: serde_json::Value = serde_json::from_str(message)
            .map_err(|e| format!("Invalid JSON: {}", e))?;

        let msg_type = json_msg.get("type")
            .and_then(|t| t.as_str())
            .ok_or("Missing message type")?;

        match msg_type {
            "AUTH" => {
                Self::handle_auth_message(&json_msg, client_id, clients, config).await
            }
            "HEARTBEAT" => {
                Self::handle_heartbeat_message(client_id, clients).await
            }
            "OPENED" | "CLOSED" | "ERROR" | "PRICE" | "PONG" | "INFO" => {
                // EA からのイベントメッセージ
                Self::handle_ea_event_message(&json_msg, client_id, clients).await
            }
            _ => {
                Err(format!("Unknown message type: {}", msg_type))
            }
        }
    }

    async fn handle_auth_message(
        json_msg: &serde_json::Value,
        client_id: &str,
        clients: &Arc<RwLock<HashMap<String, ClientConnection>>>,
        config: &WSServerConfig,
    ) -> Result<Option<String>, String> {
        let token = json_msg.get("token")
            .and_then(|t| t.as_str())
            .ok_or("Missing auth token")?;

        if token != config.auth_token {
            return Err("Invalid auth token".to_string());
        }

        // EA情報を取得
        let ea_info = json_msg.get("eaInfo")
            .map(|info| EAInfo {
                version: info.get("version").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                platform: info.get("platform").and_then(|p| p.as_str()).unwrap_or("unknown").to_string(),
                account: info.get("account").and_then(|a| a.as_str()).unwrap_or("unknown").to_string(),
                server_name: info.get("serverName").and_then(|s| s.as_str()).map(|s| s.to_string()),
                company_name: info.get("companyName").and_then(|c| c.as_str()).map(|c| c.to_string()),
            });

        // クライアントを認証済みに更新
        {
            let mut clients_lock = clients.write().await;
            if let Some(client) = clients_lock.get_mut(client_id) {
                client.authenticated = true;
                client.ea_info = ea_info.clone();
            }
        }

        info!("Client {} authenticated: {:?}", client_id, ea_info);

        // 認証成功レスポンス
        let response = serde_json::json!({
            "type": "AUTH_SUCCESS",
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "clientId": client_id
        });

        Ok(Some(response.to_string()))
    }

    async fn handle_heartbeat_message(
        client_id: &str,
        clients: &Arc<RwLock<HashMap<String, ClientConnection>>>,
    ) -> Result<Option<String>, String> {
        // heartbeatを更新
        {
            let mut clients_lock = clients.write().await;
            if let Some(client) = clients_lock.get_mut(client_id) {
                client.last_heartbeat = chrono::Utc::now().to_rfc3339();
            }
        }

        // heartbeat応答
        let response = serde_json::json!({
            "type": "HEARTBEAT_ACK",
            "timestamp": chrono::Utc::now().to_rfc3339()
        });

        Ok(Some(response.to_string()))
    }

    async fn handle_ea_event_message(
        json_msg: &serde_json::Value,
        client_id: &str,
        clients: &Arc<RwLock<HashMap<String, ClientConnection>>>,
    ) -> Result<Option<String>, String> {
        // クライアントが認証済みかチェック
        {
            let clients_lock = clients.read().await;
            if let Some(client) = clients_lock.get(client_id) {
                if !client.authenticated {
                    return Err("Client not authenticated".to_string());
                }
            } else {
                return Err("Client not found".to_string());
            }
        }

        // EAイベントメッセージを処理（実際の処理はTypeScript側のMessageProcessorで行う）
        debug!("EA event from {}: {}", client_id, json_msg);
        
        // このメッセージは応答不要
        Ok(None)
    }
}

// Tauri コマンド定義

#[tauri::command]
pub async fn start_websocket_server(
    port: u16,
    host: Option<String>,
    auth_token: Option<String>,
    state: State<'_, WSServerManager>,
) -> Result<(), String> {
    // 設定を更新
    {
        let mut config = state.config.write().await;
        config.port = port;
        if let Some(h) = host {
            config.host = h;
        }
        if let Some(token) = auth_token {
            config.auth_token = token;
        }
    }

    state.start_server().await
}

#[tauri::command]
pub async fn stop_websocket_server(
    state: State<'_, WSServerManager>,
) -> Result<(), String> {
    state.stop_server().await
}

#[tauri::command]
pub async fn get_websocket_server_status(
    state: State<'_, WSServerManager>,
) -> Result<WSServerState, String> {
    Ok(state.get_status().await)
}

#[tauri::command]
pub async fn get_websocket_clients(
    state: State<'_, WSServerManager>,
) -> Result<Vec<ClientConnection>, String> {
    Ok(state.get_clients().await)
}

#[tauri::command]
pub async fn disconnect_websocket_client(
    client_id: String,
    state: State<'_, WSServerManager>,
) -> Result<(), String> {
    state.disconnect_client(&client_id).await
}

#[tauri::command]
pub async fn update_websocket_config(
    config: WSServerConfig,
    state: State<'_, WSServerManager>,
) -> Result<(), String> {
    let mut current_config = state.config.write().await;
    *current_config = config;
    Ok(())
}

// 高性能機能用の新しいTauriコマンド

#[tauri::command]
pub async fn get_websocket_performance_metrics(
    state: State<'_, WSServerManager>,
) -> Result<PerformanceMetrics, String> {
    Ok(state.connection_pool.get_performance_metrics().await)
}

#[tauri::command]
pub async fn get_client_connection_quality(
    client_id: String,
    state: State<'_, WSServerManager>,
) -> Result<Option<ClientConnection>, String> {
    let clients = state.clients.read().await;
    Ok(clients.get(&client_id).cloned())
}

#[tauri::command]
pub async fn broadcast_websocket_message(
    message: String,
    state: State<'_, WSServerManager>,
) -> Result<usize, String> {
    state.connection_pool.broadcast_message(&message).await
}

#[tauri::command]
pub async fn optimize_websocket_performance(
    state: State<'_, WSServerManager>,
) -> Result<String, String> {
    let metrics = state.connection_pool.get_performance_metrics().await;
    
    let mut optimizations = Vec::new();
    
    // パフォーマンス最適化の提案
    if metrics.avg_latency_ms > 100.0 {
        optimizations.push("Consider reducing message size or frequency".to_string());
    }
    
    if metrics.error_rate > 5.0 {
        optimizations.push("Check network stability and message format validation".to_string());
    }
    
    if metrics.peak_connections > 50 {
        optimizations.push("Consider implementing connection pooling optimizations".to_string());
    }
    
    if optimizations.is_empty() {
        Ok("WebSocket performance is optimal".to_string())
    } else {
        Ok(format!("Optimization suggestions: {}", optimizations.join("; ")))
    }
}

#[tauri::command]
pub async fn get_websocket_detailed_stats(
    state: State<'_, WSServerManager>,
) -> Result<serde_json::Value, String> {
    let server_stats = state.get_status().await;
    let performance_metrics = state.connection_pool.get_performance_metrics().await;
    let clients = state.clients.read().await;
    
    let connection_qualities: std::collections::HashMap<String, String> = clients
        .iter()
        .map(|(id, client)| (id.clone(), client.connection_quality.clone()))
        .collect();
    
    let detailed_stats = serde_json::json!({
        "server": server_stats,
        "performance": {
            "total_connections": performance_metrics.total_connections,
            "peak_connections": performance_metrics.peak_connections,
            "avg_latency_ms": performance_metrics.avg_latency_ms,
            "messages_per_second": performance_metrics.messages_per_second,
            "error_rate": performance_metrics.error_rate,
            "uptime_seconds": performance_metrics.uptime_seconds
        },
        "connection_qualities": connection_qualities,
        "system_health": {
            "memory_usage": "optimal", // TODO: 実際のメモリ使用量を計測
            "cpu_usage": "normal",     // TODO: 実際のCPU使用量を計測
            "network_status": "stable"
        }
    });
    
    Ok(detailed_stats)
}