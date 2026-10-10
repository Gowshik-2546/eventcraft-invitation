        // State Management
        let eventData = {
            title: "Annual Grand Gala 2026",
            host: "Alexandra & James",
            tagline: "An evening of elegance, live jazz performance, exquisite dinner, and celebration under the stars.",
            date: "2026-12-12",
            startTime: "19:00",
            endTime: "23:30",
            venue: "The Crystal Ballroom, Grand Plaza",
            address: "742 Evergreen Terrace, New York, NY",
            dressCode: "Black Tie Optional",
            rsvpDeadline: "2026-12-01",
            textColor: "#000000",
            heroImg: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80",
            theme: "theme-gold",
            agenda: [
                { time: "07:00 PM", title: "Welcome Cocktail & Red Carpet Arrival" },
                { time: "08:15 PM", title: "Gourmet 3-Course Dinner Served" },
                { time: "09:30 PM", title: "Live Jazz Orchestra & Champagne Toast" },
                { time: "11:00 PM", title: "Midnight Fireworks & Afterparty" }
            ]
        };

        let rsvpList = [];
        let isAudioPlaying = false;
        let audioCtx = null;
        let oscillator = null;
        let gainNode = null;
        let eventSyncTimer = null;
        let eventSyncErrorShown = false;
        const isHostClient = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
        const rsvpListUrl = isHostClient
            ? '/api/rsvps/manage'
            : '/api/rsvps';

        // Initialize on Window Load
        window.onload = async function() {
            lucide.createIcons();
            loadLocalStorageData();
            try {
                await loadEventDataFromServer();
            } catch (error) {
                console.error('Could not load shared event settings:', error);
                showToast("Could not sync event details with the server.");
            }
            populateFormInputs();
            renderEventView();
            renderRSVPTable();
            startCountdown();
            updateShareURL();
            if (!isHostClient) {
                document.getElementById('editModeBtn').style.display = 'none';
            }
            await refreshRSVPs(true);
            setInterval(() => refreshRSVPs(false), 15000);
            if (!isHostClient) {
                setInterval(refreshSharedEventData, 15000);
            }
        };

        function loadLocalStorageData() {
            const savedEvent = localStorage.getItem('eventcraft_data');
            if (savedEvent) {
                try {
                    eventData = { ...eventData, ...JSON.parse(savedEvent) };
                } catch(e) { console.error(e); }
            }

            rsvpList = [];
        }

        function saveEventToStorage() {
            localStorage.setItem('eventcraft_data', JSON.stringify(eventData));
            if (isHostClient) {
                clearTimeout(eventSyncTimer);
                eventSyncTimer = setTimeout(() => saveEventToServer(true), 400);
            }
        }

        async function loadEventDataFromServer() {
            const response = await fetch('/api/event', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Event server returned ${response.status}`);
            }
            const sharedEventData = await response.json();
            if (sharedEventData) {
                eventData = { ...eventData, ...sharedEventData };
                if (isHostClient) {
                    localStorage.setItem('eventcraft_data', JSON.stringify(eventData));
                }
            } else if (isHostClient) {
                await saveEventToServer(false);
            }
        }

        async function refreshSharedEventData() {
            try {
                const response = await fetch('/api/event', { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`Event server returned ${response.status}`);
                }
                const sharedEventData = await response.json();
                if (sharedEventData) {
                    eventData = { ...eventData, ...sharedEventData };
                    renderEventView();
                }
                eventSyncErrorShown = false;
            } catch (error) {
                console.error('Could not refresh shared event settings:', error);
                if (!eventSyncErrorShown) {
                    showToast("Could not refresh event details from the server.");
                    eventSyncErrorShown = true;
                }
            }
        }

        async function saveEventToServer(showError) {
            try {
                const response = await fetch('/api/event', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(eventData)
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || `Event server returned ${response.status}`);
                }
                eventSyncErrorShown = false;
            } catch (error) {
                console.error('Could not save shared event settings:', error);
                if (showError && !eventSyncErrorShown) {
                    showToast("Event changes could not be shared with guests.");
                    eventSyncErrorShown = true;
                }
                throw error;
            }
        }

        async function refreshRSVPs(showError) {
            try {
                const response = await fetch(rsvpListUrl, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`RSVP server returned ${response.status}`);
                }
                const responses = await response.json();
                if (!Array.isArray(responses)) {
                    throw new Error('RSVP server returned invalid response data');
                }
                rsvpList = responses;
                renderRSVPTable();
                renderWishesList();
            } catch (error) {
                console.error('Could not sync RSVP responses:', error);
                if (showError) {
                    showToast("Could not connect to the RSVP server. Start backend/server.py.");
                }
            }
        }

        function escapeHTML(value) {
            return String(value ?? '').replace(/[&<>"']/g, character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[character]);
        }

        function renderEventView() {
            // Apply Theme
            document.body.className = `bg-slate-900 text-slate-100 font-sans min-h-screen antialiased selection:bg-amber-500 selection:text-white transition-colors duration-300 ${eventData.theme}`;

            // Render Text Content
            document.getElementById('displayTitle').innerText = eventData.title || "Event Title";
            document.getElementById('displayHostName').innerText = eventData.host || "Host";
            document.getElementById('displayTagline').innerText = eventData.tagline || "";
            document.getElementById('displayDressCode').innerText = eventData.dressCode || "Casual";
            document.getElementById('displayVenue').innerText = eventData.venue || "Venue";
            document.getElementById('displayAddress').innerText = eventData.address || "Address";
            document.getElementById('displayHeroImg').src = eventData.heroImg;
            const textColor = eventData.textColor || "#000000";
            [
                'displayDateTime',
                'displayTimeRange',
                'displayVenue',
                'displayAddress'
            ].forEach(id => {
                document.getElementById(id).style.color = textColor;
            });

            // Date Formatting
            if (eventData.date) {
                const dateObj = new Date(eventData.date + 'T00:00:00');
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                document.getElementById('displayDateTime').innerText = dateObj.toLocaleDateString('en-US', options);
            }

            // Time Formatting
            document.getElementById('displayTimeRange').innerText = `${format12Hr(eventData.startTime)} – ${format12Hr(eventData.endTime)}`;
            
            if (eventData.rsvpDeadline) {
                const deadlineObj = new Date(eventData.rsvpDeadline + 'T00:00:00');
                document.getElementById('displayRsvpDeadline').innerText = deadlineObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            }

            // Maps Link & Iframe update
            const mapSearchAddress = String(eventData.address || '').trim() || String(eventData.venue || '').trim();
            const encodedAddress = encodeURIComponent(mapSearchAddress);
            document.getElementById('mapBtn').href = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
            const mapUrl = `https://maps.google.com/maps?q=${encodedAddress}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
            const mapFrame = document.getElementById('mapIframe');
            if (mapFrame.src !== mapUrl) {
                mapFrame.src = mapUrl;
            }

            // Agenda Render
            const agendaContainer = document.getElementById('displayAgendaList');
            agendaContainer.innerHTML = '';
            if (eventData.agenda && eventData.agenda.length > 0) {
                eventData.agenda.forEach(item => {
                    agendaContainer.innerHTML += `
                        <div class="relative group">
                            <span class="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-slate-900"></span>
                            <span class="text-xs font-bold">${escapeHTML(item.time)}</span>
                            <p class="text-sm font-semibold">${escapeHTML(item.title)}</p>
                        </div>
                    `;
                });
                agendaContainer.style.color = textColor;
            } else {
                agendaContainer.innerHTML = '<p class="text-xs text-slate-500">No schedule items listed yet.</p>';
            }

            // Guest Count & Wishes Render
            renderWishesList();
        }

        function renderWishesList() {
            const wishesContainer = document.getElementById('wishesList');
            wishesContainer.innerHTML = '';
            
            const attending = rsvpList.filter(r => r.status === 'Attending');
            document.getElementById('attendingCountBadge').innerText = `${attending.length} Attending`;

            if (rsvpList.length === 0) {
                wishesContainer.innerHTML = `<p class="text-xs text-slate-500 col-span-2 text-center py-4">Be the first to RSVP and leave a note!</p>`;
                return;
            }

            rsvpList.forEach(item => {
                const isAttending = item.status === 'Attending';
                wishesContainer.innerHTML += `
                    <div class="p-3.5 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-xs flex items-center gap-1.5">
                                ${escapeHTML(item.name)}
                                ${isAttending ? '<span class="w-2 h-2 rounded-full bg-emerald-500"></span>' : '<span class="w-2 h-2 rounded-full bg-slate-400"></span>'}
                            </span>
                            <span class="text-[10px] px-2 py-0.5 rounded-full ${isAttending ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/20 text-slate-400'} font-semibold">
                                ${escapeHTML(item.status)}
                            </span>
                        </div>
                        ${item.message ? `<p class="text-xs text-slate-600 dark:text-slate-300 italic">"${escapeHTML(item.message)}"</p>` : ''}
                    </div>
                `;
            });
        }

        function populateFormInputs() {
            document.getElementById('inputTitle').value = eventData.title;
            document.getElementById('inputHost').value = eventData.host;
            document.getElementById('inputTagline').value = eventData.tagline;
            document.getElementById('inputDate').value = eventData.date;
            document.getElementById('inputStartTime').value = eventData.startTime;
            document.getElementById('inputEndTime').value = eventData.endTime;
            document.getElementById('inputVenue').value = eventData.venue;
            document.getElementById('inputAddress').value = eventData.address;
            document.getElementById('inputDressCode').value = eventData.dressCode;
            document.getElementById('inputRsvpDeadline').value = eventData.rsvpDeadline;
            document.getElementById('inputHeroImg').value = eventData.heroImg;
            document.getElementById('inputTextColor').value = eventData.textColor || "#000000";

            renderAgendaInputs();
        }

        function updateEventData() {
            eventData.title = document.getElementById('inputTitle').value;
            eventData.host = document.getElementById('inputHost').value;
            eventData.tagline = document.getElementById('inputTagline').value;
            eventData.date = document.getElementById('inputDate').value;
            eventData.startTime = document.getElementById('inputStartTime').value;
            eventData.endTime = document.getElementById('inputEndTime').value;
            eventData.venue = document.getElementById('inputVenue').value;
            eventData.address = document.getElementById('inputAddress').value;
            eventData.dressCode = document.getElementById('inputDressCode').value;
            eventData.rsvpDeadline = document.getElementById('inputRsvpDeadline').value;
            eventData.heroImg = document.getElementById('inputHeroImg').value;
            eventData.textColor = document.getElementById('inputTextColor').value;

            // Agenda sync
            const agendaRows = document.querySelectorAll('.agenda-input-row');
            eventData.agenda = [];
            agendaRows.forEach(row => {
                const time = row.querySelector('.agenda-time-input').value;
                const title = row.querySelector('.agenda-title-input').value;
                if (time || title) {
                    eventData.agenda.push({ time, title });
                }
            });

            saveEventToStorage();
            renderEventView();
        }

        function setTheme(themeClass) {
            eventData.theme = themeClass;
            updateEventData();
            showToast(`Theme updated to ${themeClass.replace('theme-', '')}`);
        }

        function setHeroPreset(url) {
            document.getElementById('inputHeroImg').value = url;
            updateEventData();
        }

        function renderAgendaInputs() {
            const container = document.getElementById('agendaInputContainer');
            container.innerHTML = '';
            eventData.agenda.forEach((item, index) => {
                container.innerHTML += `
                    <div class="flex gap-2 items-center agenda-input-row">
                        <input type="text" value="${item.time}" oninput="updateEventData()" placeholder="Time" class="agenda-time-input w-1/3 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none">
                        <input type="text" value="${item.title}" oninput="updateEventData()" placeholder="Activity Title" class="agenda-title-input w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none">
                        <button onclick="removeAgendaItem(${index})" class="p-1.5 text-red-400 hover:text-red-500">
                            <i data-lucide="trash" class="w-4 h-4"></i>
                        </button>
                    </div>
                `;
            });
            lucide.createIcons();
        }

        function addAgendaItem() {
            eventData.agenda.push({ time: "00:00 PM", title: "New Activity" });
            renderAgendaInputs();
            updateEventData();
        }

        function removeAgendaItem(index) {
            eventData.agenda.splice(index, 1);
            renderAgendaInputs();
            updateEventData();
        }

        async function resetToDefaults() {
            try {
                const response = await fetch('/api/event', { method: 'DELETE' });
                if (!response.ok) {
                    throw new Error(`Event server returned ${response.status}`);
                }
                localStorage.removeItem('eventcraft_data');
                location.reload();
            } catch (error) {
                console.error('Could not reset shared event settings:', error);
                showToast("Could not reset event settings on the server.");
            }
        }

        async function handleRSVPSubmit(e) {
            e.preventDefault();
            const newRSVP = {
                name: document.getElementById('rsvpName').value,
                email: document.getElementById('rsvpEmail').value,
                status: document.getElementById('rsvpStatus').value,
                plusOne: document.getElementById('rsvpPlusOne').value,
                dietary: document.getElementById('rsvpDietary').value || "None",
                message: document.getElementById('rsvpMessage').value || ""
            };

            let response;
            try {
                response = await fetch('/api/rsvps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newRSVP)
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || `RSVP server returned ${response.status}`);
                }
                rsvpList.unshift(await response.json());
            } catch (error) {
                console.error('Could not submit RSVP:', error);
                showToast("Your RSVP could not be saved. Please try again.");
                return;
            }
            renderWishesList();
            renderRSVPTable();

            // Trigger Confetti Celebration
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });

            showToast("🎉 RSVP Submitted Successfully!");
            document.getElementById('rsvpForm').reset();
        }

        function renderRSVPTable() {
            const tbody = document.getElementById('rsvpTableBody');
            tbody.innerHTML = '';

            if (rsvpList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500">No RSVPs received yet.</td></tr>`;
                return;
            }

            rsvpList.forEach(item => {
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
                        <td class="p-3 font-semibold">${escapeHTML(item.name)}</td>
                        <td class="p-3 text-slate-500">${escapeHTML(item.email)}</td>
                        <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Attending' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}">${escapeHTML(item.status)}</span></td>
                        <td class="p-3">${escapeHTML(item.plusOne)}</td>
                        <td class="p-3">${escapeHTML(item.dietary)}</td>
                        <td class="p-3 max-w-xs truncate" title="${escapeHTML(item.message)}">${escapeHTML(item.message || '-')}</td>
                        <td class="p-3">
                            <button onclick="deleteRSVP('${escapeHTML(item.id)}')" class="p-1 text-red-400 hover:text-red-500" title="Delete">
                                <i data-lucide="trash" class="w-4 h-4"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            lucide.createIcons();
        }

        async function deleteRSVP(id) {
            try {
                const response = await fetch(`/api/rsvps/${encodeURIComponent(id)}`, { method: 'DELETE' });
                if (!response.ok) {
                    throw new Error(`RSVP server returned ${response.status}`);
                }
                rsvpList = rsvpList.filter(r => String(r.id) !== String(id));
                renderRSVPTable();
                renderWishesList();
                showToast("RSVP deleted");
            } catch (error) {
                console.error('Could not delete RSVP:', error);
                showToast("Could not delete the RSVP from the server.");
            }
        }

        function clearRSVPs() {
            if (confirm("Are you sure you want to clear all guest RSVPs?")) {
                fetch('/api/rsvps', { method: 'DELETE' })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`RSVP server returned ${response.status}`);
                        }
                        rsvpList = [];
                        renderRSVPTable();
                        renderWishesList();
                        showToast("All RSVPs cleared");
                    })
                    .catch(error => {
                        console.error('Could not clear RSVPs:', error);
                        showToast("Could not clear responses from the server.");
                    });
            }
        }

        function exportRSVPCSV() {
            if (rsvpList.length === 0) {
                showToast("No RSVPs to export");
                return;
            }
            const csvEscape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
            const fields = ['name', 'email', 'status', 'plusOne', 'dietary', 'message', 'submittedAt'];
            const csvContent = [
                ['Name', 'Email', 'Status', 'Plus One', 'Dietary', 'Message', 'Submitted At'].map(csvEscape).join(','),
                ...rsvpList.map(response => fields.map(field => csvEscape(response[field])).join(','))
            ].join('\r\n');
            const encodedUri = URL.createObjectURL(new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' }));
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `RSVP_List_${eventData.title.replace(/\s+/g, '_')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(encodedUri), 1000);
        }

        function startCountdown() {
            setInterval(() => {
                if (!eventData.date) return;
                const targetDate = new Date(`${eventData.date}T${eventData.startTime || '00:00'}:00`).getTime();
                const now = new Date().getTime();
                const difference = targetDate - now;

                if (difference <= 0) {
                    document.getElementById('cdDays').innerText = "00";
                    document.getElementById('cdHours').innerText = "00";
                    document.getElementById('cdMins').innerText = "00";
                    document.getElementById('cdSecs').innerText = "00";
                    return;
                }

                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((difference % (1000 * 60)) / 1000);

                document.getElementById('cdDays').innerText = padZero(days);
                document.getElementById('cdHours').innerText = padZero(hours);
                document.getElementById('cdMins').innerText = padZero(minutes);
                document.getElementById('cdSecs').innerText = padZero(seconds);
            }, 1000);
        }

        function downloadICS() {
            const startDT = formatICSDate(eventData.date, eventData.startTime);
            const endDT = formatICSDate(eventData.date, eventData.endTime);

            const icsData = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EventCraft Studio//EN
BEGIN:VEVENT
SUMMARY:${eventData.title}
DESCRIPTION:${eventData.tagline} - Hosted by ${eventData.host}
LOCATION:${eventData.venue}, ${eventData.address}
DTSTART:${startDT}
DTEND:${endDT}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

            const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.setAttribute('download', `${eventData.title.replace(/\s+/g, '_')}.ics`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Downloaded .ICS Calendar file");
        }

        function openGoogleCal() {
            const startDT = formatICSDate(eventData.date, eventData.startTime);
            const endDT = formatICSDate(eventData.date, eventData.endTime);
            const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventData.title)}&dates=${startDT}/${endDT}&details=${encodeURIComponent(eventData.tagline)}&location=${encodeURIComponent(eventData.venue + ', ' + eventData.address)}`;
            window.open(url, '_blank');
        }

        function openShareModal() {
            document.getElementById('shareModal').classList.remove('hidden');
            updateShareURL();
        }

        function closeShareModal() {
            document.getElementById('shareModal').classList.add('hidden');
        }

        async function updateShareURL() {
            let shareUrl = new URL(window.location.href);
            if (['localhost', '127.0.0.1', '::1'].includes(shareUrl.hostname)) {
                try {
                    const response = await fetch('/api/info');
                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}`);
                    }
                    const serverInfo = await response.json();
                    shareUrl.hostname = serverInfo.lanAddress;
                } catch (error) {
                    console.error('Could not prepare a LAN invitation link:', error);
                }
            }
            const currentUrl = shareUrl.toString();
            document.getElementById('shareUrlInput').value = currentUrl;
            // Generate QR code via Public API
            document.getElementById('qrCodeImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`;
        }

        function copyShareUrl() {
            const input = document.getElementById('shareUrlInput');
            input.select();
            document.execCommand('copy');
            showToast("Link copied to clipboard!");
        }

        function toggleAudio() {
            if (isAudioPlaying) {
                stopAmbientMusic();
            } else {
                startAmbientMusic();
            }
        }

        function startAmbientMusic() {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                oscillator = audioCtx.createOscillator();
                gainNode = audioCtx.createGain();

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // Soft A3 chord note
                gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); // Gentle volume

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.start();

                isAudioPlaying = true;
                document.getElementById('musicText').innerText = "Sound Off";
                document.getElementById('audioToggleBtn').classList.add('bg-amber-500', 'text-slate-950');
                showToast("🎵 Playing ambient background sound");
            } catch(e) {
                console.error(e);
            }
        }

        function stopAmbientMusic() {
            if (oscillator) {
                oscillator.stop();
                oscillator.disconnect();
            }
            isAudioPlaying = false;
            document.getElementById('musicText').innerText = "Sound On";
            document.getElementById('audioToggleBtn').classList.remove('bg-amber-500', 'text-slate-950');
            showToast("Sound muted");
        }

        function switchMode(mode) {
            if (mode === 'edit' && !isHostClient) {
                return;
            }
            const guestSec = document.getElementById('guestViewSection');
            const hostSec = document.getElementById('hostStudioSection');
            const viewBtn = document.getElementById('viewModeBtn');
            const editBtn = document.getElementById('editModeBtn');

            if (mode === 'view') {
                guestSec.classList.remove('hidden');
                hostSec.classList.add('hidden');
                viewBtn.className = "px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm";
                editBtn.className = "px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
            } else {
                guestSec.classList.add('hidden');
                hostSec.classList.remove('hidden');
                editBtn.className = "px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm";
                viewBtn.className = "px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
            }
        }

        function showToast(message) {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = 'px-4 py-2.5 rounded-xl bg-slate-900/90 text-white text-xs font-semibold shadow-2xl backdrop-blur-md border border-white/20 transition-all duration-300 transform translate-y-2 opacity-0 flex items-center gap-2 pointer-events-auto';
            toast.innerHTML = `<i data-lucide="info" class="w-4 h-4 text-amber-400"></i> ${message}`;
            container.appendChild(toast);
            lucide.createIcons();

            setTimeout(() => {
                toast.classList.remove('translate-y-2', 'opacity-0');
            }, 10);

            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        function format12Hr(timeStr) {
            if (!timeStr) return '';
            const [h, m] = timeStr.split(':');
            let hour = parseInt(h);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12 || 12;
            return `${hour}:${m} ${ampm}`;
        }

        function formatICSDate(dateStr, timeStr) {
            if (!dateStr) return '';
            const cleanDate = dateStr.replace(/-/g, '');
            const cleanTime = (timeStr || '00:00').replace(':', '') + '00';
            return `${cleanDate}T${cleanTime}`;
        }

        function padZero(num) {
            return num < 10 ? `0${num}` : num;
        }
