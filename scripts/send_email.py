#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

def generate_email_html(status, message, commit_title="", commit_body="", changed_files="", extra_details="", current_version="unknown"):
    """生成邮件HTML内容"""
    status_color = "#10B981"
    status_bg = "#ECFDF5"
    status_text = "成功"
    card_border = "#374151"

    if status == "error":
        status_color = "#EF4444"
        status_bg = "#FEF2F2"
        status_text = "失败"
        card_border = "#7F1D1D"
    elif status == "warning":
        status_color = "#F59E0B"
        status_bg = "#FFFBEB"
        card_border = "#92400E"
        status_text = "警告"
    elif status == "health_repaired":
        status_color = "#3B82F6"
        status_bg = "#EFF6FF"
        status_text = "自愈"
        card_border = "#1E40AF"

    files_html = ""
    if changed_files:
        files_list = ""
        for f in changed_files.split():  # 假设changed_files是空格分隔的文件列表
            file_icon = "📄"
            if f.endswith(".sh"):
                file_icon = "🔧"
            elif f.endswith(".tsx") or f.endswith(".ts"):
                file_icon = "⚛️"
            elif f.endswith(".json"):
                file_icon = "📋"
            elif f.endswith(".css") or f.endswith(".scss"):
                file_icon = "🎨"
            elif f.endswith(".prisma"):
                file_icon = "🗃️"
            elif f.endswith(".md"):
                file_icon = "📝"
            elif f.startswith("ui/public/"):
                file_icon = "🖼️"
            files_list += f"<div style='display:flex;align-items:center;padding:8px 12px;background:#1F2937;border-radius:6px;margin-bottom:6px;font-family:ui-monospace,monospace;font-size:13px;'><span style='margin-right:10px;'>{file_icon}</span><span style='color:#E5E7EB;word-break:break-all;'>{f}</span></div>"
        files_html = f"<div style='margin-top:20px;'>
            <div style='font-size:13px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;'>变更文件</div>
            {files_list}
        </div>"

    commit_html = ""
    if commit_title:
        commit_html = f"<div style='margin-top:20px;'>
            <div style='font-size:13px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;'>Commit</div>
            <div style='background:#1F2937;border-radius:8px;padding:16px;border-left:3px solid {status_color};'>
                <div style='font-size:15px;font-weight:600;color:#F3F4F6;margin-bottom:8px;'>{commit_title}</div>"
        if commit_body:
            commit_html += f"<div style='font-size:13px;color:#9CA3AF;line-height:1.6;white-space:pre-wrap;'>{commit_body}</div>"
        commit_html += "</div></div>"

    details_html = ""
    if extra_details:
        details_html = f"<div style='margin-top:20px;'>
            <div style='font-size:13px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;'>详细信息</div>
            <div style='background:#1F2937;border-radius:8px;padding:16px;font-size:13px;color:#D1D5DB;line-height:1.6;white-space:pre-wrap;'>{extra_details}</div>
        </div>"

    version_html = ""
    if current_version != "unknown":
        version_html = f"<div style='margin-top:12px;font-size:12px;color:#6B7280;'>当前版本: {current_version[:8] if len(current_version) > 8 else current_version}</div>"

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    html_body = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <style>
        body {{ margin: 0; padding: 0; background-color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }}
    </style>
</head>
<body>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;padding:30px 15px;">
        <tr>
            <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#1F2937;border-radius:16px;overflow:hidden;border:1px solid #374151;max-width:560px;">
                    <tr>
                        <td style="padding:28px 32px;border-bottom:1px solid #374151;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <div style="display:flex;align-items:center;">
                                            <div style="width:40px;height:40px;background:linear-gradient(135deg,{status_color} 0%,{status_color}99 100%);border-radius:10px;margin-right:14px;display:flex;align-items:center;justify-content:center;">
                                                <span style="font-size:20px;">🚀</span>
                                            </div>
                                            <div>
                                                <div style="font-size:18px;font-weight:700;color:#F9FAFB;">SD-UI</div>
                                                <div style="font-size:12px;color:#6B7280;">热部署系统</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td align="right">
                                        <span style="display:inline-block;padding:6px 14px;border-radius:20px;background:{status_bg};color:{status_color};font-size:13px;font-weight:600;">{status_text}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 32px;">
                            <div style="margin-bottom:20px;">
                                <div style="font-size:13px;color:#6B7280;margin-bottom:6px;">消息</div>
                                <div style="font-size:16px;color:#F3F4F6;font-weight:500;">{message}</div>
                            </div>
                            <div style="margin-bottom:20px;">
                                <div style="font-size:13px;color:#6B7280;margin-bottom:6px;">时间</div>
                                <div style="font-size:14px;color:#D1D5DB;">{current_time}</div>
                            </div>
                            {commit_html}
                            {files_html}
                            {details_html}
                            {version_html}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px;background:#111827;border-top:1px solid #374151;">
                            <div style="text-align:center;">
                                <span style="font-size:12px;color:#4B5563;">此邮件由 SD-UI 热部署系统发送</span>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>'''
    return html_body

def send_email(subject, status, message, commit_title="", commit_body="", changed_files="", extra_details="", current_version="unknown"):
    """发送邮件通知"""
    # 尝试从环境变量文件加载
    env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ui", ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" in line:
                        key, value = line.split("=", 1)
                        key = key.strip()
                        value = value.strip().strip('"')
                        if key not in os.environ:
                            os.environ[key] = value

    api_key = os.environ.get("RESEND_API_KEY")
    email_from = os.environ.get("EMAIL_FROM")
    email_to = os.environ.get("EMAIL_TO")

    if not all([api_key, email_from, email_to]):
        print("Error: Missing environment variables (RESEND_API_KEY, EMAIL_FROM, EMAIL_TO)")
        print(f"RESEND_API_KEY: {'SET' if api_key else 'NOT SET'}")
        print(f"EMAIL_FROM: {'SET' if email_from else 'NOT SET'}")
        print(f"EMAIL_TO: {'SET' if email_to else 'NOT SET'}")
        return False

    # 生成HTML内容
    html_body = generate_email_html(status, message, commit_title, commit_body, changed_files, extra_details, current_version)

    data = {
        "from": email_from,
        "to": [email_to],
        "subject": subject,
        "html": html_body
    }

    try:
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(data).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json; charset=utf-8"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
            print(f"Email sent successfully: {result.get('id', 'unknown')}")
            return True

    except urllib.error.HTTPError as e:
        error_raw = ""
        error_body = None
        try:
            error_raw = e.read().decode("utf-8")
            if error_raw.strip():
                error_body = json.loads(error_raw)
        except Exception:
            pass
        if error_body:
            print(f"HTTP Error {e.code}: {json.dumps(error_body, ensure_ascii=False)}")
        else:
            print(f"HTTP Error {e.code}: {error_raw if error_raw else '(empty response)'}")
        return False
    except json.JSONDecodeError as e:
        print(f"JSON Decode Error: {e}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: send_email.py <subject> <status> <message> [commit_title] [commit_body] [changed_files] [extra_details] [current_version]")
        sys.exit(1)

    subject = sys.argv[1]
    status = sys.argv[2]
    message = sys.argv[3]
    commit_title = sys.argv[4] if len(sys.argv) > 4 else ""
    commit_body = sys.argv[5] if len(sys.argv) > 5 else ""
    changed_files = sys.argv[6] if len(sys.argv) > 6 else ""
    extra_details = sys.argv[7] if len(sys.argv) > 7 else ""
    current_version = sys.argv[8] if len(sys.argv) > 8 else "unknown"

    success = send_email(subject, status, message, commit_title, commit_body, changed_files, extra_details, current_version)
    sys.exit(0 if success else 1)