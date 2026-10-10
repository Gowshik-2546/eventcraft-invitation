import csv
import json
import re
import socket
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RESPONSES_FILE = Path(__file__).resolve().parent / "data" / "guest_responses.csv"
EVENT_FILE = Path(__file__).resolve().parent / "data" / "event_config.json"
CSV_FIELDS = ("id", "name", "email", "status", "plusOne", "dietary", "message", "submittedAt")
PORT = 8080
FILE_LOCK = threading.Lock()
EVENT_TEXT_LIMITS = {
    "title": 160,
    "host": 160,
    "tagline": 2000,
    "date": 10,
    "startTime": 5,
    "endTime": 5,
    "venue": 200,
    "address": 500,
    "dressCode": 100,
    "rsvpDeadline": 10,
    "textColor": 7,
    "heroImg": 2000,
    "theme": 30,
}


def read_responses():
    if not RESPONSES_FILE.exists():
        return []
    with RESPONSES_FILE.open("r", newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file))


def write_responses(responses):
    RESPONSES_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary_file = RESPONSES_FILE.with_suffix(".csv.tmp")
    with temporary_file.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(responses)
    temporary_file.replace(RESPONSES_FILE)


def write_event(event):
    EVENT_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary_file = EVENT_FILE.with_suffix(".json.tmp")
    with temporary_file.open("w", encoding="utf-8") as file:
        json.dump(event, file, ensure_ascii=False, indent=2)
    temporary_file.replace(EVENT_FILE)


class EventCraftHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        request = urlsplit(self.path)
        path = request.path
        if path in ("/", "/event_invitation_web_app.html"):
            location = "/frontend/index.html"
            if request.query:
                location += f"?{request.query}"
            self.send_response(302)
            self.send_header("Location", location)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if path == "/api/info":
            try:
                self.send_json(200, {"lanAddress": socket.gethostbyname(socket.gethostname())})
            except OSError as error:
                self.log_error("Could not determine LAN address: %s", error)
                self.send_json(500, {"error": "Could not determine the host computer's LAN address"})
            return
        if path == "/api/event":
            try:
                with FILE_LOCK:
                    event = json.loads(EVENT_FILE.read_text(encoding="utf-8")) if EVENT_FILE.exists() else None
                self.send_json(200, event)
            except (OSError, json.JSONDecodeError) as error:
                self.log_error("Could not read event settings: %s", error)
                self.send_json(500, {"error": "Could not load event settings"})
            return
        if path == "/api/rsvps":
            try:
                with FILE_LOCK:
                    responses = read_responses()
                self.send_json(200, [
                    {key: item[key] for key in ("id", "name", "status", "message")}
                    for item in responses
                ])
            except OSError as error:
                self.log_error("Could not read RSVPs: %s", error)
                self.send_json(500, {"error": "Could not load guest responses"})
            return
        if path == "/api/rsvps/manage":
            if self.client_address[0] not in ("127.0.0.1", "::1"):
                self.send_json(403, {"error": "Management is only allowed from the host computer"})
                return
            try:
                with FILE_LOCK:
                    self.send_json(200, read_responses())
            except OSError as error:
                self.log_error("Could not read RSVPs: %s", error)
                self.send_json(500, {"error": "Could not load guest responses"})
            return
        if path == "/backend/data" or path.startswith("/backend/data/"):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != "/api/rsvps":
            self.send_json(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 16384:
                raise ValueError("Request body must be between 1 and 16384 bytes")
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("Request body must be a JSON object")
            response = {
                "name": self.required_text(payload, "name", 100),
                "email": self.required_text(payload, "email", 254),
                "status": self.required_text(payload, "status", 20),
                "plusOne": self.required_text(payload, "plusOne", 30),
                "dietary": self.optional_text(payload, "dietary", 300),
                "message": self.optional_text(payload, "message", 1000),
            }
            if "@" not in response["email"]:
                raise ValueError("Email address is invalid")
            if response["status"] not in ("Attending", "Declined"):
                raise ValueError("Attendance status is invalid")
            if response["plusOne"] not in ("None", "Bringing +1"):
                raise ValueError("Plus-one selection is invalid")
            with FILE_LOCK:
                records = read_responses()
                response["id"] = str(max((int(item["id"]) for item in records), default=0) + 1)
                response["submittedAt"] = datetime.now(timezone.utc).isoformat()
                records.insert(0, response)
                write_responses(records)
            self.send_json(201, response)
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
            self.send_json(400, {"error": str(error)})
        except OSError as error:
            self.log_error("Could not save RSVP: %s", error)
            self.send_json(500, {"error": "Could not save the RSVP"})

    def do_PUT(self):
        if urlsplit(self.path).path != "/api/event":
            self.send_json(404, {"error": "Not found"})
            return
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            self.send_json(403, {"error": "Event settings can only be changed from the host computer"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 65536:
                raise ValueError("Event settings must be between 1 and 65536 bytes")
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("Event settings must be a JSON object")
            event = {}
            for key, maximum in EVENT_TEXT_LIMITS.items():
                value = payload.get(key, "")
                if not isinstance(value, str) or len(value) > maximum:
                    raise ValueError(f"{key} must be text no longer than {maximum} characters")
                event[key] = value
            if not re.fullmatch(r"#[0-9a-fA-F]{6}", event["textColor"]):
                raise ValueError("Event font color must be a six-digit hex color")
            if event["theme"] not in ("theme-gold", "theme-cyber", "theme-floral", "theme-sunset", "theme-modern"):
                raise ValueError("Event theme is invalid")
            if event["heroImg"] and not event["heroImg"].startswith(("https://", "http://")):
                raise ValueError("Hero image URL must use HTTP or HTTPS")
            agenda = payload.get("agenda", [])
            if not isinstance(agenda, list) or len(agenda) > 100:
                raise ValueError("Agenda must be a list of at most 100 items")
            event["agenda"] = []
            for item in agenda:
                if not isinstance(item, dict):
                    raise ValueError("Agenda items must be objects")
                time = self.optional_text(item, "time", 40)
                title = self.optional_text(item, "title", 300)
                event["agenda"].append({"time": time, "title": title})
            with FILE_LOCK:
                write_event(event)
            self.send_json(200, {"saved": True})
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
            self.send_json(400, {"error": str(error)})
        except OSError as error:
            self.log_error("Could not save event settings: %s", error)
            self.send_json(500, {"error": "Could not save event settings"})

    def do_DELETE(self):
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            self.send_json(403, {"error": "RSVP management is only allowed from the host computer"})
            return
        path = unquote(urlsplit(self.path).path)
        if path == "/api/event":
            try:
                with FILE_LOCK:
                    EVENT_FILE.unlink(missing_ok=True)
            except OSError as error:
                self.log_error("Could not reset event settings: %s", error)
                self.send_json(500, {"error": "Could not reset event settings"})
                return
            self.send_json(200, {"deleted": "event"})
            return
        if path == "/api/rsvps":
            try:
                with FILE_LOCK:
                    write_responses([])
            except OSError as error:
                self.log_error("Could not clear RSVPs: %s", error)
                self.send_json(500, {"error": "Could not clear guest responses"})
                return
            self.send_json(200, {"deleted": "all"})
            return
        prefix = "/api/rsvps/"
        if not path.startswith(prefix):
            self.send_json(404, {"error": "Not found"})
            return
        response_id = path[len(prefix):]
        try:
            with FILE_LOCK:
                records = read_responses()
                remaining = [item for item in records if item["id"] != response_id]
                if len(remaining) == len(records):
                    self.send_json(404, {"error": "RSVP not found"})
                    return
                write_responses(remaining)
        except OSError as error:
            self.log_error("Could not delete RSVP: %s", error)
            self.send_json(500, {"error": "Could not delete the RSVP"})
            return
        self.send_json(200, {"deleted": response_id})

    @staticmethod
    def required_text(payload, key, maximum):
        value = payload.get(key)
        if not isinstance(value, str):
            raise ValueError(f"{key} must be text")
        value = value.strip()
        if not value or len(value) > maximum:
            raise ValueError(f"{key} must contain 1 to {maximum} characters")
        return value

    @staticmethod
    def optional_text(payload, key, maximum):
        value = payload.get(key, "")
        if not isinstance(value, str) or len(value) > maximum:
            raise ValueError(f"{key} must contain no more than {maximum} characters")
        return value.strip()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), EventCraftHandler)
    print(f"EventCraft available at http://localhost:{PORT}/event_invitation_web_app.html")
    print(f"RSVP file: {RESPONSES_FILE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()
