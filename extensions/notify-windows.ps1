param(
    [Parameter(Mandatory = $true)][int]$AgentProcessId,
    [string]$Title = 'Pi',
    [string]$Body = 'Ready for input',
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PiForegroundWindow {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
}
'@

# Locate the Windows Terminal hosting this Pi process, not an unrelated terminal.
$terminalProcessId = 0
$cursor = $AgentProcessId
$seen = @{}
for ($i = 0; $i -lt 32 -and $cursor -gt 0; $i++) {
    if ($seen.ContainsKey($cursor)) { break }
    $seen[$cursor] = $true
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$cursor"
    if (!$process) { break }
    if ($process.Name -ieq 'WindowsTerminal.exe') {
        $terminalProcessId = [int]$process.ProcessId
        break
    }
    $cursor = [int]$process.ParentProcessId
}

[uint32]$foregroundProcessId = 0
$window = [PiForegroundWindow]::GetForegroundWindow()
[void][PiForegroundWindow]::GetWindowThreadProcessId($window, [ref]$foregroundProcessId)
$focused = $terminalProcessId -gt 0 -and $foregroundProcessId -eq $terminalProcessId

if ($CheckOnly) {
    [pscustomobject]@{
        terminalProcessId = $terminalProcessId
        foregroundProcessId = $foregroundProcessId
        suppressNotification = $focused
    } | ConvertTo-Json -Compress
    exit 0
}
if ($focused) { exit 0 }

# If ancestry cannot be resolved (for example, WSL), retain the original notification behavior.
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
# Avoid PowerShell enumeration of live WinRT node collections during AppendChild.
$xml = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]::new()
$escapedBody = [System.Security.SecurityElement]::Escape($Body)
$xml.LoadXml("<toast><visual><binding template='ToastText01'><text id='1'>$escapedBody</text></binding></visual></toast>")
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($Title).Show($toast)
