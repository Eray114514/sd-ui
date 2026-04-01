#!/usr/bin/env python3
import os
import sys
import json
import subprocess
from datetime import datetime

try:
    import resend
    use_sdk = True
except ImportError:
    use_sdk = False

try:
    import urllib.request
    import urllib.error
    use_urllib = True
except ImportError:
    use_urllib = False

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
        for f in changed_files.split():
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
            files_list += (
                "<div style=\"display:flex;align-items:center;padding:8px 12px;"
                "background:#1F2937;border-radius:6px;margin-bottom:6px;"
                "font-family:ui-monospace,monospace;font-size:13px;\">"
                "<span style=\"margin-right:10px;\">" + file_icon + "</span>"
                "<span style=\"color:#E5E7EB;word-break:break-all;\">" + f + "</span>"
                "</div>"
            )
        files_html = (
            "<div style=\"margin-top:20px;\">"
            "<div style=\"font-size:13px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;\">变更文件</div>"
            + files_list +
            "</div>"
        )

    commit_html = ""
    if commit_title:
        commit_html = (
            "<div style=\"margin-top:20px;\">"
            "<div style=\"font-size:13px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;\">Commit</div>"
            "<div style=\"background:#1F2937;border-radius:8px;padding:16px;border-left:3px solid " + status_color + ";\">"
            "<div style=\"font-size:15px;font-weight:600;color:#F3F4F6;margin-bottom:8px;\">" + commit_title + "</div>"
        )
        if commit_body:
            commit_html += "<div style=\"font-size:13px;color:#9CA3AF;line-height:1.6;white-space:pre-wrap;\">" + commit_body + "</div>"
        commit_html += "</div></div>"

    details_html = ""
    if extra_details:
        details_html = (
            "<div style=\"margin-top:20px;\">"
            "<div style=\"font-size:13px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;\">详细信息</div>"
            "<div style=\"background:#1F2937;border-radius:8px;padding:16px;font-size:13px;color:#D1D5DB;line-height:1.6;white-space:pre-wrap;\">" + extra_details + "</div>"
            "</div>"
        )

    version_html = ""
    if current_version != "unknown":
        version_html = "<div style=\"margin-top:12px;font-size:12px;color:#6B7280;\">当前版本: " + (current_version[:8] if len(current_version) > 8 else current_version) + "</div>"

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    html_body = (
        '<!DOCTYPE html>\n'
        '<html>\n'
        '<head>\n'
        '    <meta charset="utf-8">\n'
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        '    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n'
        '    <style>\n'
        '        body { margin: 0; padding: 0; background-color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }\n'
        '    </style>\n'
        '</head>\n'
        '<body>\n'
        '    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;padding:30px 15px;">\n'
        '        <tr>\n'
        '            <td align="center">\n'
        '                <table width="560" cellpadding="0" cellspacing="0" style="background:#1F2937;border-radius:16px;overflow:hidden;border:1px solid #374151;max-width:560px;">\n'
        '                    <tr>\n'
        '                        <td style="padding:28px 32px;border-bottom:1px solid #374151;">\n'
        '                            <table width="100%" cellpadding="0" cellspacing="0">\n'
        '                                <tr>\n'
        '                                    <td>\n'
        '                                        <div style="display:flex;align-items:center;">\n'
        '                                            <div style="width:40px;height:40px;background:linear-gradient(135deg,' + status_color + ' 0%,' + status_color + '99 100%);border-radius:10px;margin-right:14px;display:flex;align-items:center;justify-content:center;">\n'
        '                                                <span style="font-size:20px;">🚀</span>\n'
        '                                            </div>\n'
        '                                            <div>\n'
        '                                                <div style="font-size:18px;font-weight:700;color:#F9FAFB;">SD-UI</div>\n'
        '                                                <div style="font-size:12px;color:#6B7280;">热部署系统</div>\n'
        '                                            </div>\n'
        '                                        </div>\n'
        '                                    </td>\n'
        '                                    <td align="right">\n'
        '                                        <span style="display:inline-block;padding:6px 14px;border-radius:20px;background:' + status_bg + ';color:' + status_color + ';font-size:13px;font-weight:600;">' + status_text + '</span>\n'
        '                                    </td>\n'
        '                                </tr>\n'
        '                            </table>\n'
        '                        </td>\n'
        '                    </tr>\n'
        '                    <tr>\n'
        '                        <td style="padding:28px 32px;">\n'
        '                            <div style="margin-bottom:20px;">\n'
        '                                <div style="font-size:13px;color:#6B7280;margin-bottom:6px;">消息</div>\n'
        '                                <div style="font-size:16px;color:#F3F4F6;font-weight:500;">' + message + '</div>\n'
        '                            </div>\n'
        '                            <div style="margin-bottom:20px;">\n'
        '                                <div style="font-size:13px;color:#6B7280;margin-bottom:6px;">时间</div>\n'
        '                                <div style="font-size:14px;color:#D1D5DB;">' + current_time + '</div>\n'
        '                            </div>\n'
        + commit_html + '\n'
        + files_html + '\n'
        + details_html + '\n'
        + version_html + '\n'
        '                        </td>\n'
        '                    </tr>\n'
        '                    <tr>\n'
        '                        <td style="padding:20px 32px;background:#111827;border-top:1px solid #374151;">\n'
        '                            <div style="text-align:center;">\n'
        '                                <span style="font-size:12px;color:#4B5563;">此邮件由 SD-UI 热部署系统发送</span>\n'
        '                            </div>\n'
        '                        </td>\n'
        '                    </tr>\n'
        '                </table>\n'
        '            </td>\n'
        '        </tr>\n'
        '    </table>\n'
        '</body>\n'
        '</html>'
    )
    return html_body

def send_email_with_sdk(api_key, email_from, email_to, subject, html_body):
    """使用官方 SDK 发送邮件"""
    try:
        resend.api_key = api_key
        params = {
            "from": email_from,
            "to": [email_to],
            "subject": subject,
            "html": html_body
        }
        response = resend.Emails.send(params)
        print(f"Email sent successfully (SDK): {response.get('id', 'unknown')}")
        return True
    except Exception as e:
        print(f"SDK Error: {e}")
        return False

def send_email_with_curl(api_key, email_from, email_to, subject, html_body):
    """使用 curl 发送邮件"""
    data = {
        "from": email_from,
        "to": [email_to],
        "subject": subject,
        "html": html_body
    }

    try:
        cmd = [
            "curl",
            "-s",
            "-X", "POST",
            "https://api.resend.com/emails",
            "-H", f"Authorization: Bearer {api_key}",
            "-H", "Content-Type: application/json; charset=utf-8",
            "-d", json.dumps(data)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            try:
                response = json.loads(result.stdout)
                print(f"Email sent successfully (curl): {response.get('id', 'unknown')}")
                return True
            except json.JSONDecodeError:
                print(f"curl success but invalid JSON response: {result.stdout}")
                return True
        else:
            print(f"curl failed with exit code {result.returncode}")
            print(f"stderr: {result.stderr}")
            print(f"stdout: {result.stdout}")
            return False
    except subprocess.TimeoutExpired:
        print("curl timeout")
        return False
    except Exception as e:
        print(f"curl error: {e}")
        return False

def send_email_with_urllib(api_key, email_from, email_to, subject, html_body):
    """使用 urllib 发送邮件"""
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
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Connection": "keep-alive"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
            print(f"Email sent successfully (urllib): {result.get('id', 'unknown')}")
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

def send_email(subject, status, message, commit_title="", commit_body="", changed_files="", extra_details="", current_version="unknown"):
    """发送邮件通知"""
    api_key = os.environ.get("RESEND_API_KEY")
    email_from = os.environ.get("EMAIL_FROM")
    email_to = os.environ.get("EMAIL_TO")

    if not all([api_key, email_from, email_to]):
        print("Error: Missing environment variables (RESEND_API_KEY, EMAIL_FROM, EMAIL_TO)")
        print(f"RESEND_API_KEY: {'SET' if api_key else 'NOT SET'}")
        print(f"EMAIL_FROM: {'SET' if email_from else 'NOT SET'}")
        print(f"EMAIL_TO: {'SET' if email_to else 'NOT SET'}")
        return False

    html_body = generate_email_html(status, message, commit_title, commit_body, changed_files, extra_details, current_version)

    if use_sdk:
        print("Trying to send email with Resend SDK...")
        if send_email_with_sdk(api_key, email_from, email_to, subject, html_body):
            return True
        print("SDK failed, trying curl...")

    try:
        print("Trying to send email with curl...")
        if send_email_with_curl(api_key, email_from, email_to, subject, html_body):
            return True
        print("curl failed, trying urllib...")
    except Exception as e:
        print(f"curl setup failed: {e}")

    if use_urllib:
        print("Trying to send email with urllib...")
        if send_email_with_urllib(api_key, email_from, email_to, subject, html_body):
            return True

    print("All email sending methods failed")
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
