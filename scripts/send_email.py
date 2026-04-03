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
    
    # 颜色变量定义
    bg_dark = "#09090b"    # 极深背景
    card_bg = "#18181b"    # 卡片背景
    card_border = "#27272a"
    text_primary = "#f4f4f5"
    text_secondary = "#a1a1aa"
    text_muted = "#71717a"
    
    # 状态配置
    if status == "error":
        status_color = "#ef4444"
        status_bg = "#450a0a"
        status_text = "部署失败"
    elif status == "warning":
        status_color = "#f59e0b"
        status_bg = "#451a03"
        status_text = "部署警告"
    elif status == "health_repaired":
        status_color = "#3b82f6"
        status_bg = "#172554"
        status_text = "系统自愈"
    else:
        status_color = "#10b981"
        status_bg = "#064e3b"
        status_text = "部署成功"

    files_html = ""
    if changed_files:
        files_list = ""
        for f in changed_files.split():
            files_list += (
                f'<div style="padding:10px 14px;'
                f'background-image:linear-gradient(#27272a,#27272a);background-color:#27272a;border-radius:6px;margin-bottom:6px;'
                f'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;'
                f'border:1px solid #3f3f46;">'
                f'<span style="color:#e4e4e7;-webkit-text-fill-color:#e4e4e7;word-break:break-all;">{f}</span>'
                f'</div>'
            )
        files_html = (
            f'<div style="margin-top:32px;">'
            f'<div style="font-size:12px;font-weight:600;color:{text_muted};-webkit-text-fill-color:{text_muted};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">变更文件</div>'
            f'{files_list}'
            f'</div>'
        )

    commit_html = ""
    if commit_title:
        commit_html = (
            f'<div style="margin-top:32px;">'
            f'<div style="font-size:12px;font-weight:600;color:{text_muted};-webkit-text-fill-color:{text_muted};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Git Commit</div>'
            f'<div style="background-image:linear-gradient(#27272a,#27272a);background-color:#27272a;border-radius:12px;padding:20px;border-left:4px solid {status_color};">'
            f'<div style="font-size:16px;font-weight:600;color:{text_primary};-webkit-text-fill-color:{text_primary};margin-bottom:8px;word-break:break-word;">{commit_title}</div>'
        )
        if commit_body:
            commit_html += f'<div style="font-size:14px;color:{text_secondary};-webkit-text-fill-color:{text_secondary};line-height:1.6;white-space:pre-wrap;word-break:break-all;overflow-wrap:break-word;">{commit_body}</div>'
        commit_html += f'</div></div>'

    details_html = ""
    if extra_details:
        details_html = (
            f'<div style="margin-top:32px;">'
            f'<div style="font-size:12px;font-weight:600;color:{text_muted};-webkit-text-fill-color:{text_muted};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">详细日志</div>'
            f'<div style="background-image:linear-gradient(#000000,#000000);background-color:#000000;border-radius:12px;padding:20px;font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px;color:#d4d4d8;-webkit-text-fill-color:#d4d4d8;line-height:1.6;white-space:pre-wrap;word-break:break-all;overflow-wrap:break-word;border:1px solid #27272a;">{extra_details}</div>'
            f'</div>'
        )

    version_html = ""
    if current_version != "unknown":
        short_ver = current_version[:8] if len(current_version) > 8 else current_version
        version_html = (
            f'<div style="margin-top:32px;padding-top:24px;border-top:1px dashed #27272a;">'
            f'<table width="100%" cellpadding="0" cellspacing="0" border="0">'
            f'<tr>'
            f'<td align="left"><span style="font-size:13px;color:{text_muted};-webkit-text-fill-color:{text_muted};">系统版本</span></td>'
            f'<td align="right"><span style="font-size:13px;color:{text_secondary};-webkit-text-fill-color:{text_secondary};font-family:monospace;background-image:linear-gradient(#27272a,#27272a);background-color:#27272a;padding:6px 12px;border-radius:6px;border:1px solid #3f3f46;">{short_ver}</span></td>'
            f'</tr>'
            f'</table>'
            f'</div>'
        )

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    html_body = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <style>
        :root {{ color-scheme: dark; }}
        body, table, td, div {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }}
        body {{ margin: 0; padding: 0; background-color: {bg_dark}; color: {text_primary}; -webkit-font-smoothing: antialiased; }}
    </style>
</head>
<body bgcolor="{bg_dark}" style="margin: 0; padding: 0; background-image: linear-gradient({bg_dark}, {bg_dark}); background-color: {bg_dark}; min-height: 100vh;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{bg_dark}" style="background-image: linear-gradient({bg_dark}, {bg_dark}); background-color: {bg_dark}; width: 100%; min-height: 100vh; table-layout: fixed;">
        <tr>
            <td align="center" valign="top" style="padding: 40px 15px 60px 15px;">
                <!-- Main Card -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-image: linear-gradient({card_bg}, {card_bg}); background-color: {card_bg}; border-radius: 16px; overflow: hidden; border: 1px solid {card_border}; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
                    <!-- Top color bar -->
                    <tr>
                        <td height="6" bgcolor="{status_color}" style="background-image: linear-gradient({status_color}, {status_color}); background-color: {status_color}; line-height: 6px; font-size: 6px;">&nbsp;</td>
                    </tr>
                    
                    <!-- Header -->
                    <tr>
                        <td style="padding: 32px 40px; border-bottom: 1px solid {card_border}; background-image: linear-gradient({card_bg}, {card_bg}); background-color: {card_bg};" bgcolor="{card_bg}">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td valign="middle">
                                        <div style="font-size: 24px; font-weight: 700; color: #ffffff; -webkit-text-fill-color: #ffffff; margin: 0;">SD-UI 系统通知</div>
                                        <div style="font-size: 13px; color: {text_secondary}; -webkit-text-fill-color: {text_secondary}; margin-top: 6px; letter-spacing: 0.05em;">AUTOMATED DEPLOYMENT</div>
                                    </td>
                                    <td align="right" valign="middle">
                                        <table cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td bgcolor="{status_bg}" style="padding: 8px 16px; background-image: linear-gradient({status_bg}, {status_bg}); background-color: {status_bg}; border-radius: 9999px; border: 1px solid {status_color}40; white-space: nowrap;">
                                                    <span style="font-size: 14px; font-weight: 600; color: {status_color}; -webkit-text-fill-color: {status_color};">{status_text}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Content Body -->
                    <tr>
                        <td style="padding: 40px; background-image: linear-gradient({card_bg}, {card_bg}); background-color: {card_bg};" bgcolor="{card_bg}">
                            <div style="margin-bottom: 8px;">
                                <div style="font-size: 12px; font-weight: 600; color: {text_muted}; -webkit-text-fill-color: {text_muted}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">运行状态</div>
                                <div style="font-size: 20px; font-weight: 500; color: {text_primary}; -webkit-text-fill-color: {text_primary}; line-height: 1.5; word-break: break-word;">{message}</div>
                                <div style="font-size: 14px; color: {text_secondary}; -webkit-text-fill-color: {text_secondary}; margin-top: 12px;">
                                    {current_time}
                                </div>
                            </div>

                            {commit_html}
                            {files_html}
                            {details_html}
                            {version_html}
                            
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 40px; background-image: linear-gradient({bg_dark}, {bg_dark}); background-color: {bg_dark}; border-top: 1px solid {card_border}; text-align: center;" bgcolor="{bg_dark}">
                            <div style="font-size: 13px; color: {text_muted}; -webkit-text-fill-color: {text_muted}; line-height: 1.6;">
                                此邮件由 SD-UI 热部署系统自动生成并发送<br>
                                <span style="font-size: 12px; color: #3f3f46; -webkit-text-fill-color: #3f3f46; margin-top: 12px; display: inline-block;">© 2026 SD-UI Project &bull; Environment: Linux</span>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""
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
            "-s", "-f",
            "-X", "POST",
            "https://api.resend.com/emails",
            "-H", f"Authorization: Bearer {api_key}",
            "-H", "Content-Type: application/json; charset=utf-8",
            "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
