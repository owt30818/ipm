// Copies text to the clipboard. Browsers hide navigator.clipboard on insecure origins
// (e.g. http://<server-ip>:3000 on the LAN), so fall back to a temporary textarea + execCommand.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permission denied or blocked: try the fallback below
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

// "10.0.0.5/32" -> "10.0.0.5"
export function ipOnly(ip: string): string {
  return String(ip).split("/")[0].trim();
}
