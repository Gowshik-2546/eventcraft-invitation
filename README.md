# EventCraft

EventCraft is an interactive event invitation website with a customizable Host Studio, live guest preview, venue mapping, shared RSVP collection, and CSV export.

## Features

- Customize event details, themes, schedule, banner image, and guest-facing text color.
- Preview guest-facing invitation changes live.
- Display the venue address, a Google Maps link, and an embedded map generated from the saved address.
- Collect guest RSVPs, including attendance status, plus-one, dietary restrictions, and a note.
- Store RSVPs in a shared CSV file and export a copy from Host Studio.
- Share the guest invitation using a link or QR code.

## Project layout

```text
frontend/
  index.html
  css/styles.css
  js/app.js
  js/tailwind.config.js
backend/
  server.py
  data/                    # Runtime data; excluded from Git
```

## Run locally

From the project root, start the Python server:

```powershell
python backend\server.py
```

Open [http://localhost:8080/](http://localhost:8080/) on the host computer. The server writes guest responses to `backend\data\guest_responses.csv` and shared event settings to `backend\data\event_config.json`. These runtime files are excluded from version control.

To invite guests on the same local network, use **Share Event** and send the generated LAN link or QR code. The host computer must remain on and allow connections on port 8080. Host Studio management endpoints are restricted to the local computer.

## Technology

- Frontend: HTML, CSS, JavaScript, Tailwind CSS, Lucide icons
- Backend: Python standard library HTTP server and CSV/JSON file storage

The included server is for local development and trusted LAN use. Use an HTTPS deployment with host authentication before exposing the application to the public internet.
