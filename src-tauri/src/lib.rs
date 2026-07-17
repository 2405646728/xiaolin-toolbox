// 小林 AI · Tauri 后端核心
// 提供 AI 助手工具命令：系统信息 / 硬件信息 / Shell / 应用启动 / 文件操作 /
// 进程管理 / 剪贴板 / 浏览器 / 鼠标键盘 / 截屏 / 窗口管理 / 系统控制
use serde::Serialize;
use sysinfo::{Disks, Networks, System};

// ============================ 类型定义 ============================

#[derive(Serialize)]
struct ProcessInfo {
    pid: u32,
    name: String,
    cpu: f32,
    mem: f64, // MB
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemInfoPayload {
    cpu_usage: f32,
    cpu_cores: usize,
    cpu_temp: f32,
    mem_used: f64,   // GB
    mem_total: f64,  // GB
    disk_used: f64,  // GB
    disk_total: f64, // GB
    net_download: f64, // MB/s
    net_upload: f64,
    ping: u32,
    uptime: u64, // 秒
    processes: Vec<ProcessInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiskInfo {
    name: String,
    capacity: f64, // GB
    r#type: String, // SSD / HDD
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NetIface {
    iface: String,
    mac: String,
    ip: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BatteryInfo {
    vendor: String,
    model: String,
    cycles: u32,
    health: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HardwarePayload {
    hostname: String,
    platform: String,
    os_version: String,
    arch: String,
    cpu_brand: String,
    cpu_cores: usize,
    cpu_logical_cores: usize,
    cpu_frequency: u64, // MHz
    gpu_name: String,
    gpu_vendor: String,
    mem_total: f64, // GB
    mem_type: String,
    mb_manufacturer: String,
    mb_product: String,
    disks: Vec<DiskInfo>,
    battery: BatteryInfo,
    network: Vec<NetIface>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellResult {
    stdout: String,
    stderr: String,
    success: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileItem {
    name: String,
    size: u64,
    is_dir: bool,
    modified: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowInfo {
    title: String,
    pid: u32,
    hwnd: usize,
}

// ============================ 现有命令：系统状态 ============================

/// 采集实时系统状态（高频调用）
#[tauri::command]
fn get_system_info() -> SystemInfoPayload {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_usage = sys.global_cpu_usage();
    let cpu_cores = sys.cpus().len();

    let mem_total = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let mem_used = sys.used_memory() as f64 / 1024.0 / 1024.0 / 1024.0;

    let uptime = System::uptime();

    let disks = Disks::new_with_refreshed_list();
    let (disk_total, disk_available) = disks.list().iter().fold((0u64, 0u64), |(t, a), d| {
        (t + d.total_space(), a + d.available_space())
    });
    let disk_used = disk_total.saturating_sub(disk_available) as f64 / 1024.0 / 1024.0 / 1024.0;
    let disk_total = disk_total as f64 / 1024.0 / 1024.0 / 1024.0;

    let networks = Networks::new_with_refreshed_list();
    let (net_rx, net_tx) = networks
        .list()
        .iter()
        .fold((0u64, 0u64), |(r, t), (_, data)| {
            (r + data.received(), t + data.transmitted())
        });
    let net_download = net_rx as f64 / 1024.0 / 1024.0;
    let net_upload = net_tx as f64 / 1024.0 / 1024.0;

    let mut procs: Vec<&sysinfo::Process> = sys.processes().values().collect();
    procs.sort_by(|a, b| {
        b.cpu_usage()
            .partial_cmp(&a.cpu_usage())
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let processes = procs
        .iter()
        .take(8)
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().into_owned(),
            cpu: p.cpu_usage(),
            mem: p.memory() as f64 / 1024.0 / 1024.0,
        })
        .collect();

    SystemInfoPayload {
        cpu_usage,
        cpu_cores,
        cpu_temp: 0.0,
        mem_used,
        mem_total,
        disk_used,
        disk_total,
        net_download,
        net_upload,
        ping: 0,
        uptime,
        processes,
    }
}

// ============================ 现有命令：硬件信息 ============================

/// 采集详细硬件信息（一次性，无需高频）
#[tauri::command]
fn get_hardware_info() -> HardwarePayload {
    let sys = System::new_all();

    let hostname = System::host_name().unwrap_or_else(|| "未知".into());
    let platform = match System::name() {
        Some(n) => n,
        None => "未知".into(),
    };
    let os_version = System::os_version().unwrap_or_default();
    let arch = System::cpu_arch().unwrap_or_else(|| "unknown".into());

    let cpus = sys.cpus();
    let cpu_brand = cpus
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "未知".into());
    let cpu_frequency = cpus.first().map(|c| c.frequency()).unwrap_or(0);
    let cpu_logical_cores = cpus.len();
    let cpu_cores = cpu_logical_cores;

    let mem_total = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let mem_type = "未知".into();

    let disks_list = Disks::new_with_refreshed_list();
    let disks: Vec<DiskInfo> = disks_list
        .list()
        .iter()
        .map(|d| {
            let cap = d.total_space() as f64 / 1024.0 / 1024.0 / 1024.0;
            let name = d.name().to_string_lossy().into_owned();
            let dtype = if name.to_lowercase().contains("ssd") {
                "SSD".into()
            } else if name.to_lowercase().contains("hdd") {
                "HDD".into()
            } else {
                "未知".into()
            };
            DiskInfo { name, capacity: cap, r#type: dtype }
        })
        .collect();

    let networks = Networks::new_with_refreshed_list();
    let network: Vec<NetIface> = networks
        .list()
        .iter()
        .map(|(name, _data)| NetIface {
            iface: name.to_string(),
            mac: "未知".into(),
            ip: "未知".into(),
        })
        .collect();

    let gpu_name = "未知（需扩展 crate）".into();
    let gpu_vendor = "未知".into();
    let mb_manufacturer = "未知".into();
    let mb_product = "未知".into();
    let battery = BatteryInfo {
        vendor: "未知".into(),
        model: "未知".into(),
        cycles: 0,
        health: 0,
    };

    HardwarePayload {
        hostname, platform, os_version, arch, cpu_brand, cpu_cores, cpu_logical_cores,
        cpu_frequency, gpu_name, gpu_vendor, mem_total, mem_type, mb_manufacturer, mb_product,
        disks, battery, network,
    }
}

// ============================ 现有命令：Shell 执行 ============================

/// 执行系统 shell 命令（用于 AI 助手）
/// 仅在桌面环境可用，浏览器环境前端会降级提示
#[tauri::command]
fn run_shell(command: String, args: Vec<String>) -> Result<ShellResult, String> {
    use std::process::Command;

    // 安全黑名单：禁止执行破坏性命令
    let cmd_lower = command.to_lowercase();
    let blocked = ["format", "del", "rd", "rmdir", "mkfs", "dd"];
    for b in &blocked {
        if cmd_lower.contains(b) {
            return Err(format!("安全拦截：禁止执行命令 {}", command));
        }
    }

    let output = Command::new(&command)
        .args(&args)
        .output()
        .map_err(|e| format!("执行失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let success = output.status.success();

    Ok(ShellResult { stdout, stderr, success })
}

// ============================ Task 3：基础工具命令 ============================

/// 启动应用（白名单保护）
#[tauri::command]
fn open_app(name: String) -> Result<(), String> {
    let whitelist = [
        "notepad", "calc", "explorer", "msedge", "chrome", "firefox",
        "code", "wpsoffice", "word", "excel", "powerpoint",
    ];
    let name_lower = name.to_lowercase();
    if !whitelist.contains(&name_lower.as_str()) {
        return Err(format!("安全拦截：禁止启动非白名单应用 {}", name));
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe = match name_lower.as_str() {
            "notepad" => "notepad.exe",
            "calc" => "calc.exe",
            "explorer" => "explorer.exe",
            "word" => "winword.exe",
            "excel" => "excel.exe",
            "powerpoint" => "powerpnt.exe",
            _ => &name,
        };
        Command::new("cmd")
            .args(["/C", "start", "", exe])
            .spawn()
            .map_err(|e| format!("启动失败: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 列出目录内容
#[tauri::command]
fn list_files(path: String) -> Result<Vec<FileItem>, String> {
    use std::fs;
    let entries = fs::read_dir(&path).map_err(|e| format!("失败: {}", e))?;
    let mut items = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let (size, is_dir, modified) = match entry.metadata() {
            Ok(m) => (
                m.len(),
                m.is_dir(),
                m.modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0),
            ),
            Err(_) => (0, false, 0),
        };
        items.push(FileItem { name, size, is_dir, modified });
    }
    Ok(items)
}

/// 读取文本文件（限制 1MB）
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    use std::fs;
    let metadata = fs::metadata(&path).map_err(|e| format!("失败: {}", e))?;
    if metadata.len() > 1_000_000 {
        return Err("文件过大（超过 1MB）".into());
    }
    fs::read_to_string(&path).map_err(|e| format!("失败: {}", e))
}

/// 写入文本文件
#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    use std::fs;
    fs::write(&path, content).map_err(|e| format!("失败: {}", e))
}

/// 删除文件或目录（系统目录保护）
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    use std::fs;
    let path_lower = path.to_lowercase();
    let protected = [
        "c:\\windows",
        "c:\\program files",
        "c:\\program files (x86)",
        "c:\\system32",
        "c:\\boot",
    ];
    for p in &protected {
        if path_lower.contains(p) {
            return Err(format!("安全拦截：禁止删除系统目录 {}", path));
        }
    }
    let metadata = fs::metadata(&path).map_err(|e| format!("失败: {}", e))?;
    if metadata.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| format!("失败: {}", e))?;
    } else {
        fs::remove_file(&path).map_err(|e| format!("失败: {}", e))?;
    }
    Ok(())
}

/// 移动/重命名文件
#[tauri::command]
fn move_file(from: String, to: String) -> Result<(), String> {
    std::fs::rename(&from, &to).map_err(|e| format!("失败: {}", e))
}

/// 递归搜索文件名包含 pattern 的文件（最多返回 50 个）
#[tauri::command]
fn search_files(path: String, pattern: String) -> Result<Vec<String>, String> {
    let mut results = Vec::new();
    let pattern_lower = pattern.to_lowercase();
    search_recursive(&path, &pattern_lower, &mut results, 50);
    Ok(results)
}

fn search_recursive(dir: &str, pattern_lower: &str, results: &mut Vec<String>, max: usize) {
    if results.len() >= max {
        return;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if results.len() >= max {
            return;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if name.contains(pattern_lower) {
            results.push(path.to_string_lossy().into_owned());
        }
        if path.is_dir() {
            search_recursive(&path.to_string_lossy(), pattern_lower, results, max);
        }
    }
}

/// 终止进程（系统关键进程白名单保护）
#[tauri::command]
fn kill_process(pid: u32) -> Result<(), String> {
    let sys = System::new_all();
    let protected = [
        "smss.exe",
        "csrss.exe",
        "winlogon.exe",
        "services.exe",
        "lsass.exe",
        "svchost.exe",
        "explorer.exe",
        "system",
        "system idle process",
    ];
    if let Some(process) = sys.process(sysinfo::Pid::from_u32(pid)) {
        let name = process.name().to_string_lossy().to_lowercase();
        if protected.contains(&name.as_str()) {
            return Err(format!("安全拦截：禁止终止系统关键进程 {}", name));
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .map_err(|e| format!("失败: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 列出前 20 个 CPU 占用最高的进程
#[tauri::command]
fn list_processes() -> Vec<ProcessInfo> {
    let mut sys = System::new_all();
    sys.refresh_all();
    let mut procs: Vec<&sysinfo::Process> = sys.processes().values().collect();
    procs.sort_by(|a, b| {
        b.cpu_usage()
            .partial_cmp(&a.cpu_usage())
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    procs
        .iter()
        .take(20)
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().into_owned(),
            cpu: p.cpu_usage(),
            mem: p.memory() as f64 / 1024.0 / 1024.0,
        })
        .collect()
}

/// 读取剪贴板文本
#[tauri::command]
fn clipboard_get() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("失败: {}", e))?;
    clipboard.get_text().map_err(|e| format!("失败: {}", e))
}

/// 写入剪贴板文本
#[tauri::command]
fn clipboard_set(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("失败: {}", e))?;
    clipboard.set_text(text).map_err(|e| format!("失败: {}", e))?;
    Ok(())
}

/// 用默认浏览器打开链接
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("失败: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 用默认浏览器搜索（默认 Bing）
#[tauri::command]
fn search_web(query: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let encoded = url_encode(&query);
        let url = format!("https://www.bing.com/search?q={}", encoded);
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("失败: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

fn url_encode(s: &str) -> String {
    let mut result = String::new();
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}

// ============================ Task 6：鼠标键盘控制（enigo） ============================

use enigo::{
    Axis, Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings,
};

fn enigo_new() -> Result<Enigo, String> {
    Enigo::new(&Settings::default()).map_err(|e| format!("失败: {}", e))
}

/// 鼠标移动到坐标
#[tauri::command]
fn mouse_move(x: i32, y: i32) -> Result<(), String> {
    let mut enigo = enigo_new()?;
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| format!("失败: {}", e))
}

/// 鼠标单击（button: left/right/middle）
#[tauri::command]
fn mouse_click(x: i32, y: i32, button: String) -> Result<(), String> {
    let mut enigo = enigo_new()?;
    let btn = match button.to_lowercase().as_str() {
        "left" => Button::Left,
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => return Err(format!("未知鼠标按键: {}", button)),
    };
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| format!("失败: {}", e))?;
    enigo
        .button(btn, Direction::Click)
        .map_err(|e| format!("失败: {}", e))
}

/// 鼠标双击
#[tauri::command]
fn mouse_double_click(x: i32, y: i32) -> Result<(), String> {
    let mut enigo = enigo_new()?;
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| format!("失败: {}", e))?;
    enigo
        .button(Button::Left, Direction::Click)
        .map_err(|e| format!("失败: {}", e))?;
    enigo
        .button(Button::Left, Direction::Click)
        .map_err(|e| format!("失败: {}", e))
}

/// 鼠标右键单击
#[tauri::command]
fn mouse_right_click(x: i32, y: i32) -> Result<(), String> {
    let mut enigo = enigo_new()?;
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| format!("失败: {}", e))?;
    enigo
        .button(Button::Right, Direction::Click)
        .map_err(|e| format!("失败: {}", e))
}

/// 鼠标拖拽（从 from 移动到 to）
#[tauri::command]
fn mouse_drag(from_x: i32, from_y: i32, to_x: i32, to_y: i32) -> Result<(), String> {
    let mut enigo = enigo_new()?;
    enigo
        .move_mouse(from_x, from_y, Coordinate::Abs)
        .map_err(|e| format!("失败: {}", e))?;
    enigo
        .button(Button::Left, Direction::Press)
        .map_err(|e| format!("失败: {}", e))?;
    enigo
        .move_mouse(to_x, to_y, Coordinate::Abs)
        .map_err(|e| format!("失败: {}", e))?;
    enigo
        .button(Button::Left, Direction::Release)
        .map_err(|e| format!("失败: {}", e))
}

/// 鼠标滚动（正数上滚，负数下滚）
#[tauri::command]
fn mouse_scroll(amount: i32) -> Result<(), String> {
    let mut enigo = enigo_new()?;
    // enigo: positive = scroll down, negative = scroll up
    // 任务要求: positive = up, negative = down，所以取反
    enigo
        .scroll(-amount, Axis::Vertical)
        .map_err(|e| format!("失败: {}", e))
}

/// 键盘输入文本
#[tauri::command]
fn keyboard_type(text: String) -> Result<(), String> {
    let mut enigo = enigo_new()?;
    enigo.text(&text).map_err(|e| format!("失败: {}", e))
}

/// 解析按键名称为 enigo Key
fn parse_key(key: &str) -> Result<Key, String> {
    match key {
        "Enter" | "Return" => Ok(Key::Return),
        "Tab" => Ok(Key::Tab),
        "Esc" | "Escape" => Ok(Key::Escape),
        "Space" => Ok(Key::Space),
        "Backspace" => Ok(Key::Backspace),
        "Up" => Ok(Key::UpArrow),
        "Down" => Ok(Key::DownArrow),
        "Left" => Ok(Key::LeftArrow),
        "Right" => Ok(Key::RightArrow),
        "Home" => Ok(Key::Home),
        "End" => Ok(Key::End),
        "PageUp" => Ok(Key::PageUp),
        "PageDown" => Ok(Key::PageDown),
        "Delete" | "Del" => Ok(Key::Delete),
        "Insert" => Ok(Key::Insert),
        s if s.chars().count() == 1 => {
            let c = s.chars().next().unwrap();
            Ok(Key::Unicode(c))
        }
        _ => Err(format!("未知按键: {}", key)),
    }
}

/// 解析修饰键或普通键
fn parse_modifier(key: &str) -> Result<Key, String> {
    let lower = key.to_lowercase();
    match lower.as_str() {
        "ctrl" | "control" => Ok(Key::Control),
        "alt" | "option" => Ok(Key::Alt),
        "shift" => Ok(Key::Shift),
        "win" | "meta" | "super" | "cmd" | "command" => Ok(Key::Meta),
        _ => parse_key(key),
    }
}

/// 键盘按下单个键
#[tauri::command]
fn keyboard_press(key: String) -> Result<(), String> {
    let mut enigo = enigo_new()?;
    let k = parse_key(&key)?;
    enigo
        .key(k, Direction::Click)
        .map_err(|e| format!("失败: {}", e))
}

/// 键盘组合键（按下所有键 → 释放所有键反序）
#[tauri::command]
fn keyboard_hotkey(keys: Vec<String>) -> Result<(), String> {
    let mut enigo = enigo_new()?;
    let mut enigo_keys: Vec<Key> = Vec::new();
    for k in &keys {
        enigo_keys.push(parse_modifier(k)?);
    }
    // 按下所有键
    for k in &enigo_keys {
        enigo
            .key(*k, Direction::Press)
            .map_err(|e| format!("失败: {}", e))?;
    }
    // 反序释放所有键
    for k in enigo_keys.iter().rev() {
        enigo
            .key(*k, Direction::Release)
            .map_err(|e| format!("失败: {}", e))?;
    }
    Ok(())
}

// ============================ Task 7：截屏（xcap + image + base64） ============================

use base64::{engine::general_purpose, Engine};

/// 截取全屏，返回 base64 PNG（不带 data: 前缀）
#[tauri::command]
fn screenshot() -> Result<String, String> {
    let image = capture_full_screen()?;
    encode_png_base64(image)
}

/// 截取指定区域，返回 base64 PNG
#[tauri::command]
fn screenshot_region(x: i32, y: i32, width: u32, height: u32) -> Result<String, String> {
    let full = capture_full_screen()?;
    let cropped = image::imageops::crop_imm(&full, x as u32, y as u32, width, height).to_image();
    encode_png_base64(cropped)
}

/// 全屏截图保存到文件
#[tauri::command]
fn save_screenshot(path: String) -> Result<(), String> {
    let image = capture_full_screen()?;
    let dynamic = image::DynamicImage::ImageRgba8(image);
    dynamic
        .save_with_format(&path, image::ImageFormat::Png)
        .map_err(|e| format!("失败: {}", e))
}

fn capture_full_screen() -> Result<image::RgbaImage, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("失败: {}", e))?;
    let monitor = monitors.first().ok_or("无显示器")?;
    monitor.capture_image().map_err(|e| format!("失败: {}", e))
}

fn encode_png_base64(image: image::RgbaImage) -> Result<String, String> {
    let dynamic = image::DynamicImage::ImageRgba8(image);
    let mut cursor = std::io::Cursor::new(Vec::new());
    dynamic
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("失败: {}", e))?;
    let png_bytes = cursor.into_inner();
    let b64 = general_purpose::STANDARD.encode(&png_bytes);
    Ok(b64)
}

// ============================ Task 12：窗口管理（windows crate） ============================

#[cfg(target_os = "windows")]
mod win32_ops {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible, PostMessageW,
        SetForegroundWindow, ShowWindowAsync, SW_FORCEMINIMIZE, SW_MAXIMIZE, SW_RESTORE, WM_CLOSE,
    };

    pub struct WinEntry {
        pub title: String,
        pub pid: u32,
        pub hwnd: usize,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let results = &mut *(lparam.0 as *mut Vec<WinEntry>);
        if IsWindowVisible(hwnd).as_bool() {
            let mut buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buf);
            if len > 0 {
                let title = String::from_utf16_lossy(&buf[..len as usize]);
                let mut pid: u32 = 0;
                GetWindowThreadProcessId(hwnd, Some(&mut pid));
                results.push(WinEntry {
                    title,
                    pid,
                    hwnd: hwnd.0 as usize,
                });
            }
        }
        BOOL(1)
    }

    pub fn list_windows() -> Result<Vec<WinEntry>, String> {
        let mut results: Vec<WinEntry> = Vec::new();
        unsafe {
            let lparam = LPARAM(&mut results as *mut Vec<WinEntry> as isize);
            EnumWindows(Some(enum_proc), lparam).map_err(|e| format!("失败: {}", e))?;
        }
        Ok(results)
    }

    struct FindState {
        title_lower: String,
        found: Option<HWND>,
    }

    unsafe extern "system" fn find_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let state = &mut *(lparam.0 as *mut FindState);
        if state.found.is_some() {
            return BOOL(0);
        }
        if IsWindowVisible(hwnd).as_bool() {
            let mut buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buf);
            if len > 0 {
                let title = String::from_utf16_lossy(&buf[..len as usize]);
                if title.to_lowercase().contains(&state.title_lower) {
                    state.found = Some(hwnd);
                    return BOOL(0);
                }
            }
        }
        BOOL(1)
    }

    pub fn find_hwnd_by_title(title: &str) -> Option<HWND> {
        let mut state = FindState {
            title_lower: title.to_lowercase(),
            found: None,
        };
        unsafe {
            let lparam = LPARAM(&mut state as *mut FindState as isize);
            let _ = EnumWindows(Some(find_proc), lparam);
        }
        state.found
    }

    pub fn focus(title: &str) -> Result<(), String> {
        match find_hwnd_by_title(title) {
            Some(hwnd) => {
                unsafe {
                    // 先恢复（如果最小化），再置前
                    let _ = ShowWindowAsync(hwnd, SW_RESTORE);
                    let _ = SetForegroundWindow(hwnd);
                }
                Ok(())
            }
            None => Err("未找到匹配的窗口".into()),
        }
    }

    pub fn minimize(title: &str) -> Result<(), String> {
        match find_hwnd_by_title(title) {
            Some(hwnd) => {
                unsafe {
                    let _ = ShowWindowAsync(hwnd, SW_FORCEMINIMIZE);
                }
                Ok(())
            }
            None => Err("未找到匹配的窗口".into()),
        }
    }

    pub fn maximize(title: &str) -> Result<(), String> {
        match find_hwnd_by_title(title) {
            Some(hwnd) => {
                unsafe {
                    let _ = ShowWindowAsync(hwnd, SW_MAXIMIZE);
                    let _ = SetForegroundWindow(hwnd);
                }
                Ok(())
            }
            None => Err("未找到匹配的窗口".into()),
        }
    }

    pub fn close(title: &str) -> Result<(), String> {
        match find_hwnd_by_title(title) {
            Some(hwnd) => {
                unsafe {
                    let _ = PostMessageW(hwnd, WM_CLOSE, WPARAM(0), LPARAM(0));
                }
                Ok(())
            }
            None => Err("未找到匹配的窗口".into()),
        }
    }
}

/// 列出所有可见窗口
#[tauri::command]
fn list_windows() -> Result<Vec<WindowInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let entries = win32_ops::list_windows()?;
        Ok(entries
            .into_iter()
            .map(|e| WindowInfo {
                title: e.title,
                pid: e.pid,
                hwnd: e.hwnd,
            })
            .collect())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 聚焦窗口
#[tauri::command]
fn focus_window(title: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        win32_ops::focus(&title)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 最小化窗口
#[tauri::command]
fn minimize_window(title: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        win32_ops::minimize(&title)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 最大化窗口
#[tauri::command]
fn maximize_window(title: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        win32_ops::maximize(&title)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 关闭窗口
#[tauri::command]
fn close_window(title: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        win32_ops::close(&title)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

// ============================ Task 15：系统控制 ============================

/// 设置系统音量（0-100，需要 nircmd 工具）
#[tauri::command]
fn set_volume(level: u8) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let scaled = level as u32 * 65535 / 100;
        let result = std::process::Command::new("nircmd")
            .args(["setsysvolume", &scaled.to_string()])
            .output();
        match result {
            Ok(output) if output.status.success() => Ok(()),
            Ok(_) => Err("nircmd 执行失败".into()),
            Err(_) => Err(
                "音量控制需要 nircmd 工具，请安装 nircmd.exe 并添加到 PATH 后使用".into(),
            ),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 静音
#[tauri::command]
fn mute_volume() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let result = std::process::Command::new("nircmd")
            .args(["mute", "1"])
            .output();
        match result {
            Ok(output) if output.status.success() => Ok(()),
            Ok(_) => {
                // nircmd 不可用，回退到 SendKeys 音量静音切换键
                send_keys_fallback(173)
            }
            Err(_) => send_keys_fallback(173),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 取消静音
#[tauri::command]
fn unmute_volume() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let result = std::process::Command::new("nircmd")
            .args(["mute", "0"])
            .output();
        match result {
            Ok(output) if output.status.success() => Ok(()),
            Ok(_) => {
                // nircmd 不可用，回退到 SendKeys 音量静音切换键（toggle）
                send_keys_fallback(173)
            }
            Err(_) => send_keys_fallback(173),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

#[cfg(target_os = "windows")]
fn send_keys_fallback(key_code: u32) -> Result<(), String> {
    use std::process::Command;
    let script = format!(
        "$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]{})",
        key_code
    );
    Command::new("powershell")
        .args(["-Command", &script])
        .output()
        .map_err(|e| format!("失败: {}", e))?;
    Ok(())
}

/// 睡眠
#[tauri::command]
fn power_sleep() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32.exe")
            .args(["powrprof.dll,SetSuspendState", "0,1,0"])
            .spawn()
            .map_err(|e| format!("失败: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 重启
#[tauri::command]
fn power_restart() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("shutdown")
            .args(["/r", "/t", "0"])
            .spawn()
            .map_err(|e| format!("失败: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 关机
#[tauri::command]
fn power_shutdown() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("shutdown")
            .args(["/s", "/t", "0"])
            .spawn()
            .map_err(|e| format!("失败: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

/// 发送系统通知（使用 PowerShell MessageBox）
#[tauri::command]
fn send_notification(title: String, body: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let escaped_title = title.replace('\'', "''");
        let escaped_body = body.replace('\'', "''");
        let script = format!(
            "[reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null; [System.Windows.Forms.MessageBox]::Show('{}', '{}')",
            escaped_body, escaped_title
        );
        std::process::Command::new("powershell")
            .args(["-Command", &script])
            .spawn()
            .map_err(|e| format!("失败: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅在 Windows 可用".into())
    }
}

// ============================ 网络与无线控制 ============================

/// 查询 WiFi 启用状态
#[tauri::command]
fn wifi_status() -> Result<bool, String> {
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            "netsh interface show interface name='Wi-Fi'"
        ])
        .output()
        .map_err(|e| format!("执行失败: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    // 解析 "Administrative state: Enabled" 或中文 "已启用"
    let enabled = stdout.to_lowercase().contains("enabled")
        || stdout.to_lowercase().contains("已启用")
        || stdout.to_lowercase().contains("已打开");
    Ok(enabled)
}

/// 启用/禁用 WiFi（需要管理员权限）
#[tauri::command]
fn wifi_toggle(enable: bool) -> Result<(), String> {
    let action = if enable { "enable" } else { "disable" };
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            &format!("netsh interface set interface 'Wi-Fi' admin={}", action)
        ])
        .output()
        .map_err(|e| format!("执行失败: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("WiFi 切换失败（可能需要管理员权限）: {} {}", stdout, stderr));
    }
    Ok(())
}

/// 查询蓝牙启用状态
#[tauri::command]
fn bluetooth_status() -> Result<bool, String> {
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            "Get-PnpDevice -Class Bluetooth | Where-Object {$_.FriendlyName -like '*Radio*' -or $_.FriendlyName -like '*蓝牙*'} | Select-Object -First 1 -ExpandProperty Status"
        ])
        .output()
        .map_err(|e| format!("执行失败: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
    Ok(stdout == "ok" || stdout.contains("ok"))
}

/// 启用/禁用蓝牙（需要管理员权限）
#[tauri::command]
fn bluetooth_toggle(enable: bool) -> Result<(), String> {
    let cmd = if enable {
        "Enable-PnpDevice -Class Bluetooth -Confirm:$false -ErrorAction SilentlyContinue"
    } else {
        "Disable-PnpDevice -Class Bluetooth -Confirm:$false -ErrorAction SilentlyContinue"
    };
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", cmd])
        .output()
        .map_err(|e| format!("执行失败: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("蓝牙切换失败（可能需要管理员权限）: {}", stderr));
    }
    Ok(())
}

// ============================ 应用入口 ============================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // 系统信息
            get_system_info,
            get_hardware_info,
            // Shell
            run_shell,
            // 应用与进程
            open_app,
            kill_process,
            list_processes,
            // 文件操作
            list_files,
            read_file,
            write_file,
            delete_file,
            move_file,
            search_files,
            // 剪贴板
            clipboard_get,
            clipboard_set,
            // 浏览器
            open_url,
            search_web,
            // 鼠标控制
            mouse_move,
            mouse_click,
            mouse_double_click,
            mouse_right_click,
            mouse_drag,
            mouse_scroll,
            // 键盘控制
            keyboard_type,
            keyboard_press,
            keyboard_hotkey,
            // 截屏
            screenshot,
            screenshot_region,
            save_screenshot,
            // 窗口管理
            list_windows,
            focus_window,
            minimize_window,
            maximize_window,
            close_window,
            // 系统控制
            set_volume,
            mute_volume,
            unmute_volume,
            power_sleep,
            power_restart,
            power_shutdown,
            send_notification,
            // 网络与无线控制
            wifi_status,
            wifi_toggle,
            bluetooth_status,
            bluetooth_toggle
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
