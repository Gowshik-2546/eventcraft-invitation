# RSVP server

Run the application from the project folder with:

```powershell
python backend\server.py
```

Then open `http://localhost:8080/` on the host computer. The frontend is organized as:

- `frontend\index.html` - invitation markup
- `frontend\css\styles.css` - page styling
- `frontend\js\app.js` - client-side behavior and API calls
- `frontend\js\tailwind.config.js` - Tailwind theme configuration
- `backend\server.py` - static-file server and RSVP/event API

Host Studio saves shared event settings, including the venue address and map location, to `backend\data\event_config.json`. Guest RSVPs are written to `backend\data\guest_responses.csv`; Host Studio reads the shared list and refreshes it every 15 seconds. Use **Export CSV** to download a copy.

To let guests on the same Wi-Fi/LAN submit from their devices, use **Share Event** on the host computer and send the generated link or QR code. The host computer must stay on and the firewall must allow connections on port 8080. Guest devices can submit RSVPs and see public guest-book details; event settings and RSVP management remain restricted to the host computer.

This development server is not intended for public internet use. Deploy behind HTTPS and add host authentication before using it for a public event.
