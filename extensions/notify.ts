/**
 * Pi Notify Extension
 *
 * Sends a native terminal notification when Pi agent is done and waiting for input.
 * Supports multiple terminal protocols:
 * - OSC 777: Ghostty, iTerm2, WezTerm, rxvt-unicode
 * - OSC 99: Kitty
 * - Windows toast: Windows Terminal (native Windows focus check; WSL fallback)
 * Native Windows suppresses notifications when the hosting terminal process is foreground.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function windowsToastScript(title: string, body: string): string {
	const type = "Windows.UI.Notifications";
	const mgr = `[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime]`;
	const template = `[${type}.ToastTemplateType]::ToastText01`;
	const toast = `[${type}.ToastNotification]::new($xml)`;
	return [
		`${mgr} > $null`,
		`$xml = [${type}.ToastNotificationManager]::GetTemplateContent(${template})`,
		`$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${body}')) > $null`,
		`[${type}.ToastNotificationManager]::CreateToastNotifier('${title}').Show(${toast})`,
	].join("; ");
}

function notifyOSC777(title: string, body: string): void {
	process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
}

function notifyOSC99(title: string, body: string): void {
	// Kitty OSC 99: i=notification id, d=0 means not done yet, p=body for second part
	process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
	process.stdout.write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
}

async function notifyWindows(title: string, body: string): Promise<void> {
	const args = process.platform === "win32"
		? ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
			fileURLToPath(new URL("./notify-windows.ps1", import.meta.url)),
			"-AgentProcessId", String(process.pid), "-Title", title, "-Body", body]
		: ["-NoProfile", "-NonInteractive", "-Command", windowsToastScript(title, body)];
	await execFileAsync("powershell.exe", args, { windowsHide: true, timeout: 15000 });
}

async function notify(title: string, body: string): Promise<void> {
	if (process.env.WT_SESSION) {
		await notifyWindows(title, body);
	} else if (process.env.KITTY_WINDOW_ID) {
		notifyOSC99(title, body);
	} else {
		notifyOSC777(title, body);
	}
}

export default function (pi: ExtensionAPI) {
	// `agent_end` fires after each low-level run; Pi may still retry, compact,
	// or continue with queued follow-ups. Notify only after the full run settles.
	pi.on("agent_settled", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		try {
			await notify("Pi", "Ready for input");
		} catch (error) {
			ctx.ui.notify(`Desktop notification failed: ${error instanceof Error ? error.message : String(error)}`, "warning");
		}
	});
}
