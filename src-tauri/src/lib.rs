// 小林 AI · Tauri 后端核心
// 提供 3 个命令：get_system_info / get_hardware_info / run_shell
// AI 助手通过 run_shell 执行系统命令（内置安全黑名单）
use serde::Serialize;
use sysinfo::{Disks, Networks, System};

// ---------- 实时系统状态 ----------

#[derive(Serialize)]
struct ProcessInfo {
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

// ---------- 详细硬件信息 ----------

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

// ---------- AI 助手：执行 Shell 命令 ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellResult {
    stdout: String,
    stderr: String,
    success: bool,
}

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

// ---------- 应用入口 ----------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_hardware_info,
            run_shell
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
