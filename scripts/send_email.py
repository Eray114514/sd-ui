#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.error

def send_email(subject, html_body):
    api_key = os.environ.get("RESEND_API_KEY")
    email_from = os.environ.get("EMAIL_FROM")
    email_to = os.environ.get("EMAIL_TO")

    if not all([api_key, email_from, email_to]):
        print("Error: Missing environment variables (RESEND_API_KEY, EMAIL_FROM, EMAIL_TO)")
        return False

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
        error_body = json.loads(e.read().decode("utf-8"))
        print(f"HTTP Error {e.code}: {error_body}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: send_email.py <subject> <html_body_file>")
        sys.exit(1)

    subject = sys.argv[1]
    html_file = sys.argv[2]

    with open(html_file, "r", encoding="utf-8") as f:
        html_body = f.read()

    success = send_email(subject, html_body)
    sys.exit(0 if success else 1)