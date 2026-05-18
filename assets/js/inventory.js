/* =========================================================
   GLOBAL STATE & UTILITIES
========================================================= */
let currentItemForActions = null;
let currentLocationId = null;
let locationHistory = [];
let locationsAdmin = [];
let tempLocationsAdmin = []; 
let adminLocationView = "hierarchy";
let editingLocationId = null;
let editingTempLocationId = null;
let currentLocationAdmin = null;
let currentTempLocationId = null; 

let globalCachedTags = [];
let globalCachedCategories = [];
let activeSelectedAddTags = [];
let activeSelectedEditTags = [];

let editingTagTargetId = null;
let editingCategoryTargetId = null;
let isSubModalContextCall = false;

let currentBrowserLocations = [];
let currentBrowserItems = [];

let currentAddItemFiles = [];
let currentEditItemFiles = []; 
let existingItemPhotosToDelete = []; 
let primaryPhotoIdentifier = null; 

let currentAddLocationFiles = [];
let currentEditLocationFile = null;

let lightboxImages = []; 
let lightboxIndex = 0;   
let lastMovedItemId = null;
let currentSortMode = "name_asc";
let currentSortModeLocations = "name_asc";
let itemsBrowserMode = "hierarchy";

let currentUserEmail = "Unknown User";
let allAuditLogs = [];

let userSettings = {
    view: 'medium',
    locationsView: 'medium',
    columns: { name: true, quantity: true, barcode: true, nfc: true, category: true, tags: true },
    widths: { name: '30%', quantity: '10%', barcode: '15%', nfc: '15%', category: '15%', tags: '15%' }
};

function buildLocationPath(id) {
    if (!id || !locationsAdmin || locationsAdmin.length === 0) return "";
    let loc = locationsAdmin.find(l => l.id === id);
    if (!loc) return "";
    const parts = [loc.name];
    while (loc.parent) {
        loc = locationsAdmin.find(l => l.id === loc.parent);
        if (!loc) break;
        parts.unshift(loc.name);
    }
    return parts.join(" > ");
}

function clearSearch() {
    document.getElementById('globalSearchInput').value = '';
    handleGlobalSearch('');
}

/* =========================================================
   CUSTOM BRANDED DIALOG ENGINE & UTILS
========================================================= */
function customAlert(message, title = "Notice") {
    return new Promise((resolve) => {
        document.getElementById("dialogTitle").textContent = title;
        document.getElementById("dialogMessage").textContent = message;
        const btnContainer = document.getElementById("dialogButtons");
        btnContainer.innerHTML = `<button class="btn-primary" id="dialogOkBtn" style="min-width: 120px;">OK</button>`;
        document.getElementById("customDialogModal").style.display = "flex";
        document.getElementById("dialogOkBtn").onclick = () => { document.getElementById("customDialogModal").style.display = "none"; resolve(); };
    });
}

function customConfirm(message, title = "Confirm Action", isDanger = false) {
    return new Promise((resolve) => {
        document.getElementById("dialogTitle").textContent = title;
        document.getElementById("dialogMessage").textContent = message;
        const btnColor = isDanger ? "background: #ef4444; border-color: #ef4444;" : "";
        const btnContainer = document.getElementById("dialogButtons");
        btnContainer.innerHTML = `<button class="btn-outline" id="dialogCancelBtn" style="min-width: 100px;">Cancel</button><button class="btn-primary" id="dialogConfirmBtn" style="${btnColor} min-width: 100px;">Confirm</button>`;
        document.getElementById("customDialogModal").style.display = "flex";
        document.getElementById("dialogCancelBtn").onclick = () => { document.getElementById("customDialogModal").style.display = "none"; resolve(false); };
        document.getElementById("dialogConfirmBtn").onclick = () => { document.getElementById("customDialogModal").style.display = "none"; resolve(true); };
    });
}

function closeModal(id) { document.getElementById(id).style.display = "none"; }
async function confirmCancel(modalId) { if (await customConfirm("Are you sure? Any unsaved changes will be lost.", "Discard Changes?", true)) { closeModal(modalId); } }
async function withStatus(fn, label) { window.setStatus("syncing", label); try { const r = await fn(); window.setStatus("connected", "Connected"); return r; } catch (e) { window.setStatus("error", "Error"); throw e; } }

/* =========================================================
    AUDIT LOGGING ENGINE
========================================================= */
async function logAction(actionType, targetEntity, targetName, details = "") {
    if (!window.isAppOnline) return; // Skip audit logs if offline for now
    try {
        await window.db.from("audit_logs").insert([{ user_email: currentUserEmail, action_type: actionType, target_entity: targetEntity, target_name: targetName, details: details }]);
    } catch(e) { console.error("Audit log failed:", e); }
}

async function loadAuditLogs() {
    try {
        // Read directly from the blazing-fast local database
        const logs = await localDB.audit_logs.toArray();
        
        // Sort them newest-first
        allAuditLogs = logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        filterAuditLogs();
    } catch (e) {
        console.warn("Could not load audit logs:", e);
        document.getElementById("auditLogTableBody").innerHTML = `<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;">No logs available.</td></tr>`;
    }
}

function filterAuditLogs() {
    const actionFilter = document.getElementById("logActionFilter")?.value || "ALL";
    const searchTerm = (document.getElementById("logSearchInput")?.value || "").toLowerCase();
    const tbody = document.getElementById("auditLogTableBody"); if (!tbody) return; tbody.innerHTML = "";

    const filtered = allAuditLogs.filter(log => {
        const matchAction = actionFilter === "ALL" || log.action_type === actionFilter;
        const matchSearch = (log.target_name && log.target_name.toLowerCase().includes(searchTerm)) || (log.user_email && log.user_email.toLowerCase().includes(searchTerm)) || (log.details && log.details.toLowerCase().includes(searchTerm));
        return matchAction && matchSearch;
    });

    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;">No logs match your criteria.</td></tr>`; return; }

    filtered.forEach(log => {
        const date = new Date(log.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
        let actionColor = "#475569";
        if (log.action_type === 'CREATE') actionColor = "#3b82f6"; if (log.action_type === 'UPDATE') actionColor = "#f59e0b"; if (log.action_type === 'DELETE') actionColor = "#ef4444";
        if (log.action_type === 'CHECKOUT') actionColor = "#10b981"; if (log.action_type === 'RETURN') actionColor = "#8b5cf6"; if (log.action_type === 'MOVE') actionColor = "#ff8c00";
        const tr = document.createElement("tr");
        tr.innerHTML = `<td style="font-size: 13px; color: #666;">${date}</td><td style="font-size: 13px; font-weight: 600;">${log.user_email}</td><td><span style="background: ${actionColor}20; color: ${actionColor}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${log.action_type}</span></td><td style="font-size: 13px; font-weight: bold; color: #333;">${log.target_entity}</td><td style="font-size: 13px;"><b>${log.target_name}</b> <span style="color:#666;">${log.details ? '- ' + log.details : ''}</span></td>`;
        tbody.appendChild(tr);
    });
}

/* =========================================================
    DATA BACKUP & EXPORT UTILITIES (OFFLINE SAFE)
========================================================= */
function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function exportFullBackup() {
    if (!(await customConfirm("This will download a full snapshot of your system database. Continue?", "System Backup"))) return;
    window.setStatus("syncing", "Preparing Backup...");
    try {
        const backupData = {
            timestamp: new Date().toISOString(), version: "1.1",
            tables: { 
                items: await localDB.items.toArray(), locations: await localDB.locations.toArray(), 
                temp_locations: await localDB.temp_locations.toArray(), tags: await localDB.tags.toArray(), 
                categories: await localDB.item_categories.toArray(), audit_logs: [] 
            }
        };
        const fileName = `warm_inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
        downloadFile(fileName, JSON.stringify(backupData, null, 2), "application/json");
        logAction("CREATE", "System", "Full Backup", "Exported JSON snapshot");
        window.setStatus("connected", "Backup Complete");
    } catch(e) { window.setStatus("error", "Backup Failed"); await customAlert("System encountered an error.", "System Error"); }
}

async function exportItemsCSV() {
    window.setStatus("syncing", "Generating CSV...");
    const items = await localDB.items.toArray();
    let csvContent = "Name,Quantity,Location Path,Assigned To (Temp Loc),Barcode,NFC,Category,Tags\n";
    items.forEach(item => {
        const locPath = item.location_id ? buildLocationPath(item.location_id) : 'Unallocated';
        const tempLoc = tempLocationsAdmin.find(t => t.id === item.assigned_to);
        const assignedTo = tempLoc ? tempLoc.name : '';
        const tags = Array.isArray(item.tags) ? item.tags.join("; ") : (item.tags || "");
        const row = [ `"${(item.name || '').replace(/"/g, '""')}"`, item.quantity || 0, `"${locPath.replace(/"/g, '""')}"`, `"${assignedTo.replace(/"/g, '""')}"`, `"${(item.barcode || '').replace(/"/g, '""')}"`, `"${(item.nfc_tag || '').replace(/"/g, '""')}"`, `"${(item.category || '').replace(/"/g, '""')}"`, `"${tags.replace(/"/g, '""')}"` ];
        csvContent += row.join(",") + "\n";
    });
    downloadFile(`warm_items_export_${new Date().getTime()}.csv`, csvContent, "text/csv");
    logAction("CREATE", "System", "Items CSV", "Exported Items to Spreadsheet");
    window.setStatus("connected", "Items Exported");
}

async function exportLocationsCSV() {
    window.setStatus("syncing", "Generating CSV...");
    let csvContent = "Folder Name,Full Path,Barcode,NFC,Category\n";
    locationsAdmin.forEach(loc => {
        const row = [ `"${(loc.name || '').replace(/"/g, '""')}"`, `"${buildLocationPath(loc.id).replace(/"/g, '""')}"`, `"${(loc.barcode || '').replace(/"/g, '""')}"`, `"${(loc.nfc || '').replace(/"/g, '""')}"`, `"${(loc.category || '').replace(/"/g, '""')}"` ];
        csvContent += row.join(",") + "\n";
    });
    downloadFile(`warm_locations_export_${new Date().getTime()}.csv`, csvContent, "text/csv");
    logAction("CREATE", "System", "Locations CSV", "Exported Locations");
    window.setStatus("connected", "Locations Exported");
}

async function exportItemsPDF() {
    if (!window.jspdf) return await customAlert("Report generator is currently loading...", "Loading Engine");
    window.setStatus("syncing", "Formatting PDF...");
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFontSize(18); doc.setTextColor(0, 74, 153); doc.text("Warm Right Ltd - Inventory Report", 14, 22);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generated: ${new Date().toLocaleString()} by ${currentUserEmail}`, 14, 30);

    const items = await localDB.items.toArray();
    const tableData = items.map(item => {
        const locPath = item.location_id ? buildLocationPath(item.location_id) : 'Unallocated';
        const tempLoc = tempLocationsAdmin.find(t => t.id === item.assigned_to);
        return [ item.name || 'Unknown', (item.quantity || 0).toString(), locPath, tempLoc ? `Out: ${tempLoc.name}` : 'In Stock', item.category || '-' ];
    });

    doc.autoTable({ startY: 38, head: [['Item Name', 'Qty', 'Storage Location', 'Current Status', 'Category']], body: tableData, theme: 'striped', headStyles: { fillColor: [0, 74, 153], textColor: [255, 255, 255] }, styles: { fontSize: 9 }, columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 15 }, 2: { cellWidth: 50 }, 3: { cellWidth: 40 }, 4: { cellWidth: 30 } } });
    doc.save(`warm_stock_report_${new Date().getTime()}.pdf`);
    logAction("CREATE", "System", "PDF Stock Report", "Exported PDF");
    window.setStatus("connected", "PDF Generated");
}

async function exportFullSystemZip() {
    if (!window.JSZip) return await customAlert("ZIP Engine is currently loading. Please wait a moment...", "Loading Engine");
    
    if (!(await customConfirm("Generate a fully self-contained offline archive? This may take a moment to download all images.", "Master Archive"))) return;

    window.setStatus("syncing", "Assembling Master Archive...");

    try {
        const zip = new JSZip();
        const imgFolder = zip.folder("images");

        // 1. Gather all data from the local Dexie DB
        let exportItems = JSON.parse(JSON.stringify(await localDB.items.toArray()));
        let exportLocs = JSON.parse(JSON.stringify(await localDB.locations.toArray()));
        let exportTemps = JSON.parse(JSON.stringify(await localDB.temp_locations.toArray()));
        const tags = await localDB.tags.toArray();
        const categories = await localDB.item_categories.toArray();

        // 2. Download Images to the Archive
        if (window.isAppOnline) {
            window.setStatus("syncing", "Downloading images to archive...");

            async function fetchAndZipImage(bucket, fileName) {
                if (!fileName) return null;
                try {
                    const { data, error } = await window.db.storage.from(bucket).download(fileName);
                    if (data) {
                        imgFolder.file(fileName, data);
                        return `./images/${fileName}`; 
                    }
                } catch (e) { console.warn("Failed to download image:", fileName); }
                return null;
            }

            for (let item of exportItems) {
                if (item.photos && Array.isArray(item.photos)) {
                    for (let photo of item.photos) {
                        const localPath = await fetchAndZipImage("item-photos", photo.file_path);
                        if (localPath) photo.file_path = localPath;
                    }
                }
            }

            for (let loc of exportLocs) {
                if (loc.photo_path) {
                    const localPath = await fetchAndZipImage("location-photos", loc.photo_path);
                    if (localPath) loc.photo_path = localPath;
                }
            }

            for (let temp of exportTemps) {
                if (temp.photo_path) {
                    const localPath = await fetchAndZipImage("location-photos", temp.photo_path);
                    if (localPath) temp.photo_path = localPath;
                }
            }
        } else {
            await customAlert("You are currently offline. The archive will be generated with data only (no images).", "Offline Notice");
        }

        // 3. Assemble and save inventory.json
        const backupData = { timestamp: new Date().toISOString(), items: exportItems, locations: exportLocs, temp_locations: exportTemps, tags: tags, categories: categories };
        zip.file("inventory.json", JSON.stringify(backupData, null, 2));

        // 4. Inject EXACT provided viewer.html, using CSS for the image placeholders
        const htmlContent = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline Inventory Viewer</title>
    <style>
        :root { --primary: #004a99; --accent: #10b981; --bg: #f8fafc; --card-bg: #ffffff; --text: #334155; }
        body { font-family: 'Segoe UI', -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
        .extraction-warning-banner { background: #fee2e2; color: #991b1b; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 13px; margin-bottom: 15px; text-align: center; border: 1px solid #fca5a5; display: none; }
        .header { background: var(--card-bg); padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 20px; text-align: center; }
        .file-upload { display: inline-block; background: var(--primary); color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 10px; transition: opacity 0.2s; font-size: 13px; }
        .file-upload:hover { opacity: 0.9; }
        input[type="file"] { display: none; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; justify-content: center; }
        .tab { padding: 10px 20px; background: var(--card-bg); border: 2px solid transparent; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .tab.active { border-color: var(--primary); color: var(--primary); }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
        .card { background: var(--card-bg); border-radius: 12px; padding: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; min-height: 260px; box-sizing: border-box; }
        .image-container { position: relative; width: 100%; height: 150px; background: #f1f5f9; border-radius: 8px; overflow: hidden; margin-bottom: 10px; }
        .card-img { width: 100%; height: 100%; object-fit: cover; }
        .no-image-box { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #94a3b8; font-weight: bold; font-size: 14px; text-align: center; padding: 10px; box-sizing: border-box;}
        .card h3 { margin: 0 0 5px 0; font-size: 16px; color: var(--primary); text-align: center; }
        .card p { margin: 0; font-size: 13px; color: #64748b; text-align: center; }
        .badge { display: inline-block; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin: 10px auto 0 auto; width: max-content; }
        .multi-icon { position: absolute; bottom: 8px; right: 8px; background: rgba(0, 0, 0, 0.65); color: white; padding: 5px 6px 3px 6px; border-radius: 6px; pointer-events: none; backdrop-filter: blur(2px); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; }
        .footer a { color: var(--primary); text-decoration: none; font-weight: bold; }
        .footer a:hover { text-decoration: underline; }
        .zip-blocker-screen { display: none; max-width: 500px; margin: 100px auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; border: 2px solid #ef4444; }
    </style>
</head>
<body>

    <div id="zipBlocker" class="zip-blocker-screen">
        <span style="font-size: 50px;">📁</span>
        <h2 style="color: #dc2626; margin-top: 15px;">Please extract the folder first!</h2>
        <p style="color: #4b5563; line-height: 1.6; font-size: 15px;">You are currently viewing this file from inside the compressed zip archive container. The application cannot load local resource directories until it is expanded.</p>
        <p style="font-weight: bold; margin-top: 20px; color: #1f2937;">Close this window, right-click the ZIP archive file, choose "Extract All", then reload this browser file from the extracted folder.</p>
    </div>

    <div id="mainViewerContent">
        <div id="reminderBanner" class="extraction-warning-banner">⚠️ Ensure your inventory file has been extracted! Otherwise local images will not render.</div>

        <div class="header">
            <h1 style="margin: 0 0 5px 0;">📦 Offline Inventory Browser</h1>
            <p id="statusMsg" style="margin: 0 0 15px 0; color: #64748b;">Attempting to auto-load local file profile...</p>
            <label class="file-upload"><input type="file" id="jsonLoader" accept=".json">📂 Load alternative inventory.json</label>
        </div>

        <div id="contentArea" style="display:none;">
            <div class="tabs">
                <div class="tab active" onclick="switchTab('items')">📝 Items (<span id="itemCount">0</span>)</div>
                <div class="tab" onclick="switchTab('locations')">📦 Locations (<span id="locCount">0</span>)</div>
                <div class="tab" onclick="switchTab('assignees')">👤 Assignees (<span id="assigneeCount">0</span>)</div>
            </div>
            <div id="itemsGrid" class="grid"></div>
            <div id="locationsGrid" class="grid" style="display: none;"></div>
            <div id="assigneesGrid" class="grid" style="display: none;"></div>
        </div>

        <div class="footer">
            Created by s-george-dev (Stephan George) | 
            <a href="https://github.com/s-george-dev" target="_blank">GitHub</a> | 
            <a href="https://www.linkedin.com/in/steph-v-george/" target="_blank">LinkedIn</a>
        </div>
    </div>

    <script>
        let db = {};

        (function checkArchiveEnvironment() {
            const url = window.location.href.toLowerCase();
            const isZipProtocol = url.indexOf('zip://') > -1 || url.indexOf('.zip/') > -1;
            const isTempPath = url.indexOf('/appdata/local/temp/') > -1 || url.indexOf('/var/folders/') > -1 || url.indexOf('/tmp/') > -1;
            
            if (isZipProtocol || isTempPath) {
                document.getElementById('mainViewerContent').style.display = 'none';
                document.getElementById('zipBlocker').style.display = 'block';
            }
        })();

        window.onload = function() {
            if(document.getElementById('zipBlocker').style.display === 'block') return;
            document.getElementById('reminderBanner').style.display = 'block';

            fetch('./inventory.json')
                .then(response => {
                    if (!response.ok) throw new Error();
                    return response.json();
                })
                .then(data => {
                    db = data;
                    document.getElementById('statusMsg').innerText = "Inventory profile detected and auto-loaded completely.";
                    document.getElementById('statusMsg').style.color = "#10b981";
                    renderAll();
                    document.getElementById('contentArea').style.display = 'block';
                })
                .catch(error => {
                    document.getElementById('statusMsg').innerText = "Notice: Automatic folder scan was blocked by browser security. Please click below to select your file manually.";
                });
        };

        document.getElementById('jsonLoader').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    db = JSON.parse(event.target.result);
                    renderAll();
                    document.getElementById('statusMsg').innerText = "Viewing imported collection file: " + file.name;
                    document.getElementById('statusMsg').style.color = "#475569";
                    document.getElementById('contentArea').style.display = 'block';
                } catch (err) { alert("Error parsing JSON file objects."); }
            };
            reader.readAsText(file);
        });

        function renderAll() {
            document.getElementById('itemCount').innerText = db.items?.length || 0;
            document.getElementById('locCount').innerText = db.locations?.length || 0;
            document.getElementById('assigneeCount').innerText = db.temp_locations?.length || 0;

            // Render Items
            document.getElementById('itemsGrid').innerHTML = (db.items || []).map(function(item) {
                let validPhotos = [];
                if (item.photos && Array.isArray(item.photos)) {
                    validPhotos = item.photos.map(function(p) {
                        if (!p) return '';
                        return p.file_path ? p.file_path : (typeof p === 'string' ? p : '');
                    }).filter(function(p) { return p !== ''; });
                }
                
                let imageHtml = "";
                let multiBadge = "";
                
                if (validPhotos.length > 0) {
                    if (validPhotos.length > 1) {
                        let safeArr = JSON.stringify(validPhotos).replace(/'/g, "&#39;");
                        multiBadge = "<div class='multi-icon'><svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='14' height='14' rx='2' ry='2'></rect><path d='M21 7v14a2 2 0 0 1-2 2H7'></path></svg></div>";
                        imageHtml = "<img class='card-img' src='" + validPhotos[0] + "' data-photos='" + safeArr + "' data-index='0' onclick='cycleImage(this)' style='cursor: pointer;'>";
                    } else {
                        imageHtml = "<img class='card-img' src='" + validPhotos[0] + "'>";
                    }
                } else {
                    imageHtml = "<div class='no-image-box'>No Image Available</div>";
                }
                
                return "<div class='card'>" +
                    "<div>" +
                        "<div class='image-container'>" + imageHtml + multiBadge + "</div>" +
                        "<h3>" + (item.name || 'Unnamed Item') + "</h3>" +
                        "<p>Barcode: " + (item.barcode || 'N/A') + "</p>" +
                    "</div>" +
                    "<div class='badge'>Qty: " + (item.quantity || 0) + "</div>" +
                "</div>";
            }).join('');

            // Render Locations
            document.getElementById('locationsGrid').innerHTML = (db.locations || []).map(function(loc) {
                let imageHtml = loc.photo_path 
                    ? "<img class='card-img' src='" + loc.photo_path + "'>" 
                    : "<div class='no-image-box'>No Image Available</div>";
                    
                return "<div class='card'>" +
                    "<div>" +
                        "<div class='image-container'>" + imageHtml + "</div>" +
                        "<h3 style='color: #10b981;'>" + (loc.name || 'Unnamed Location') + "</h3>" +
                    "</div>" +
                    "<p>" + (loc.location_description || 'Folder') + "</p>" +
                "</div>";
            }).join('');

            // Render Assignees
            document.getElementById('assigneesGrid').innerHTML = (db.temp_locations || []).map(function(assign) {
                let imageHtml = assign.photo_path 
                    ? "<img class='card-img' src='" + assign.photo_path + "'>" 
                    : "<div class='no-image-box'>No Image Available</div>";
                    
                return "<div class='card'>" +
                    "<div>" +
                        "<div class='image-container'>" + imageHtml + "</div>" +
                        "<h3 style='color: #ff8c00;'>" + (assign.name || 'Unnamed') + "</h3>" +
                    "</div>" +
                    "<p>" + (assign.description || 'Assignee') + "</p>" +
                "</div>";
            }).join('');
        }

        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.grid').forEach(function(g) { g.style.display = 'none'; });
            event.target.classList.add('active');
            if(tabName === 'items') document.getElementById('itemsGrid').style.display = 'grid';
            if(tabName === 'locations') document.getElementById('locationsGrid').style.display = 'grid';
            if(tabName === 'assignees') document.getElementById('assigneesGrid').style.display = 'grid';
        }

        function cycleImage(imgEl) {
            try {
                let photos = JSON.parse(imgEl.getAttribute('data-photos').replace(/&#39;/g, "'"));
                let currentIndex = parseInt(imgEl.getAttribute('data-index'));
                let nextIndex = (currentIndex + 1) % photos.length;
                imgEl.src = photos[nextIndex];
                imgEl.setAttribute('data-index', nextIndex);
            } catch (e) {}
        }
    </script>
</body>
</html>`;

        zip.file("viewer.html", htmlContent);

        // 5. Generate and Download
        window.setStatus("syncing", "Compressing Archive...");
        const content = await zip.generateAsync({ type: "blob" });
        
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `WarmRight_Master_Archive_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        logAction("CREATE", "System", "ZIP Archive", "Exported Offline Viewer");
        window.setStatus("connected", "Archive Downloaded");

    } catch (error) {
        console.error("ZIP Generation Failed:", error);
        window.setStatus("error", "ZIP Failed");
        await customAlert("Failed to generate the ZIP archive. Please check the console.", "Export Error");
    }
}

/* =========================================================
    GLOBAL BARCODE/NFC UNIQUENESS VALIDATOR (OFFLINE SAFE)
========================================================= */
async function isHardwareTagUnique(token, currentEntityId = null) {
    if (!token || !token.trim()) return true; 
    const cleanToken = token.trim().toLowerCase();
    
    // Check local Dexie DB for speed and offline capabilities
    const locs = await localDB.locations.toArray();
    if (locs.find(l => l.id !== currentEntityId && ((l.barcode && l.barcode.toLowerCase() === cleanToken) || (l.nfc_tag && l.nfc_tag.toLowerCase() === cleanToken)))) return false;
    
    const temps = await localDB.temp_locations.toArray();
    if (temps.find(t => t.id !== currentEntityId && ((t.barcode && t.barcode.toLowerCase() === cleanToken) || (t.nfc_tag && t.nfc_tag.toLowerCase() === cleanToken)))) return false;
    
    const items = await localDB.items.toArray();
    if (items.find(i => i.id !== currentEntityId && ((i.barcode && i.barcode.toLowerCase() === cleanToken) || (i.nfc_tag && i.nfc_tag.toLowerCase() === cleanToken)))) return false;

    return true; 
}

/* =========================================================
   USER SETTINGS & PREFERENCES MANAGER
========================================================= */
async function getSettingsKey() {
    if (window.db) {
        const { data: { session } } = await window.db.auth.getSession();
        if (session && session.user) return `inventory_settings_${session.user.id}`;
    }
    return 'inventory_settings_default';
}

async function saveInventorySettings() {
    try { const key = await getSettingsKey(); localStorage.setItem(key, JSON.stringify(userSettings)); } catch (error) { console.warn("Could not save settings:", error); }
}

async function loadInventorySettings() {
    try {
        const key = await getSettingsKey(); const saved = localStorage.getItem(key);
        if (saved) { const parsed = JSON.parse(saved); userSettings = { ...userSettings, ...parsed }; }
        const itemsSelect = document.querySelector('select[onchange*="changeItemsView"]');
        if (itemsSelect) itemsSelect.value = userSettings.view || 'medium';
        changeItemsView(userSettings.view || 'medium');

        const locsSelect = document.querySelector('select[onchange*="changeLocationsView"]');
        if (locsSelect) locsSelect.value = userSettings.locationsView || 'medium';
        changeLocationsView(userSettings.locationsView || 'medium');
    } catch (error) { console.warn("Could not load settings:", error); }
}

function changeItemsView(view) { 
    const page = document.getElementById("pageItems");
    if (page) { page.classList.remove('items-view-small', 'items-view-medium', 'items-view-large', 'items-view-list'); page.classList.add(`items-view-${view}`); }
    userSettings.view = view; saveInventorySettings();
}

function changeLocationsView(viewValue) { 
    window.currentLocationsView = viewValue;
    const page = document.getElementById("pageLocations");
    if (page) { page.classList.remove('items-view-small', 'items-view-medium', 'items-view-large', 'items-view-list'); page.classList.add(`items-view-${viewValue}`); }
    userSettings.locationsView = viewValue; saveInventorySettings();
    refreshLocationAdmin();
}

function changeItemsBrowserMode(mode) { itemsBrowserMode = mode; showPage('pageItems'); }
function changeSortOrder(mode) { currentSortMode = mode; renderLocations(currentBrowserLocations); renderItems(currentBrowserItems); }
function changeSortOrderLocations(mode) { currentSortModeLocations = mode; refreshLocationAdmin(); }
function changeAdminLocationView(view) { adminLocationView = view; refreshLocationAdmin(); }


/* =========================================================
   INITIALIZATION & DEXIE OFFLINE LOADERS
========================================================= */
async function initInventory() {
    const { data: { session } } = await window.db.auth.getSession();
    if (session && session.user) currentUserEmail = session.user.email;

    await loadInventorySettings();
    initFabScrollFade();

    // 1. Instantly load the UI from the local Dexie Database
    await refreshAllDataFromLocal();

    // 2. Trigger the background engine to download fresh data from Supabase
    if (window.isAppOnline && typeof window.syncDatabaseToLocal === "function") {
        await window.syncDatabaseToLocal();
    }

    document.addEventListener("focus", function(event) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") { setTimeout(() => { if (typeof event.target.select === "function") event.target.select(); }, 30); }
    }, true); 
}

// Reads all data from IndexedDB and populates the memory arrays
async function refreshAllDataFromLocal() {
    try {
        const tData = await localDB.tags.toArray();
        const cData = await localDB.item_categories.toArray();
        const lData = await localDB.locations.toArray();
        const tempData = await localDB.temp_locations.toArray();

        // Populate Tags & Categories
        globalCachedTags = tData.sort((a,b) => a.name.localeCompare(b.name));
        globalCachedCategories = cData.sort((a,b) => a.name.localeCompare(b.name));
        
        const catHtml = globalCachedCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join("");
        if (document.getElementById("itemCategorySelect")) document.getElementById("itemCategorySelect").innerHTML = catHtml; 
        if (document.getElementById("editItemCategory")) document.getElementById("editItemCategory").innerHTML = catHtml;
        
        const tagHtml = '<option value="" selected disabled>Select a tag...</option>' + globalCachedTags.map(t => `<option value="${t.name}">${t.name}</option>`).join("");
        if (document.getElementById("itemTagSelect")) document.getElementById("itemTagSelect").innerHTML = tagHtml; 
        if (document.getElementById("editItemTagSelect")) document.getElementById("editItemTagSelect").innerHTML = tagHtml;

        // Populate Assignees
        tempLocationsAdmin = tempData;
        loadAssignDropdown();

        // Populate Locations
        locationsAdmin = lData.map(l => ({ id: l.id, name: l.name, parent: l.parent_id, barcode: l.barcode, nfc: l.nfc_tag, photo: l.photo_path, location_description: l.location_description, category: l.category }));
        refreshLocationAdmin();
        loadLocationDropdown();
        
        // Refresh Current Items View
        if (document.getElementById("pageItems").classList.contains("active")) {
            if (currentLocationId === "unallocated") loadUnallocatedItems();
            else if (currentLocationId) loadLocation(currentLocationId);
            else if (itemsBrowserMode === "flat") loadAllItemsFlat();
            else loadRootLocations();
        }
        
        // Refresh Temp Locations View if Active
        if (document.getElementById("pageTempLocations").classList.contains("active")) {
            if (currentTempLocationId) loadTempLocationDetails(currentTempLocationId);
            else loadTempLocationsAdmin();
        }

    } catch (e) { console.warn("Failed to read from local DB:", e); }
}

async function syncAfterWrite() {
    // Quick helper to immediately pull fresh data to Dexie after a Supabase write
    if (window.isAppOnline && typeof window.syncDatabaseToLocal === "function") {
        await window.syncDatabaseToLocal();
    }
}


/* =========================================================
   TAB & PAGE NAVIGATION
========================================================= */
function showPage(pageId) {
    document.querySelectorAll(".inventory-page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".tab-link").forEach(b => b.classList.remove("active"));
    
    const page = document.getElementById(pageId); if (page) page.classList.add("active");
    const tabMap = { 'pageItems': 'tab-items', 'pageLocations': 'tab-locations', 'pageTempLocations': 'tab-temp-locations', 'pageTags': 'tab-tags', 'pageCategories': 'tab-categories', 'pageSettings': 'tab-settings' };
    const tab = document.getElementById(tabMap[pageId]); if (tab) tab.classList.add("active");

    if (pageId !== "pageTempLocations") currentTempLocationId = null;

    if (pageId === "pageItems") {
        if (itemsBrowserMode === "flat") loadAllItemsFlat();
        else { if (currentLocationId === "unallocated") loadUnallocatedItems(); else if (currentLocationId) loadLocation(currentLocationId); else loadRootLocations(); }
    }
    if (pageId === "pageLocations") loadLocationsAdmin();
    if (pageId === "pageTempLocations") loadTempLocationsAdmin();
    if (pageId === "pageTags") loadTagsAdmin();
    if (pageId === "pageCategories") loadCategoriesAdmin();
    if (pageId === "pageSettings") loadAuditLogs(); 
    
    // Control Mobile FAB visibility
    const fabItem = document.getElementById("fabItemBtn"); const fabLoc = document.getElementById("fabLocationBtn");
    const fabAdjust = document.getElementById("fabAdjustBtn"); const fabContainer = document.getElementById("mobileFabContainer");
    
    if (window.innerWidth <= 768 && fabContainer) {
        if (pageId === "pageItems") {
            fabContainer.style.display = "flex";
            if (fabItem) fabItem.style.display = "flex";
            if (fabLoc) fabLoc.style.display = "flex";
            if (fabAdjust) fabAdjust.style.display = "flex";
        } else if (pageId === "pageLocations") {
            fabContainer.style.display = "flex";
            if (fabItem) fabItem.style.display = "none";
            if (fabLoc) fabLoc.style.display = "flex";
            if (fabAdjust) fabAdjust.style.display = "none";
        } else {
            fabContainer.style.display = "none";
        }
    }
}

/* =========================================================
    ITEMS BROWSER LOGIC (DEXIE)
========================================================= */
async function loadRootLocations() {
    currentLocationId = null; locationHistory = [];
    const container = document.getElementById("breadcrumb");
    if (container) container.innerHTML = '<span class="breadcrumb-link active">Items</span>';
    const allLocs = await localDB.locations.toArray();
    const rootLocs = allLocs.filter(l => !l.parent_id);
    currentBrowserLocations = [...rootLocs, { id: "unallocated", name: "Unallocated Items" }];
    currentBrowserItems = [];
    renderLocations(currentBrowserLocations); renderItems(currentBrowserItems);
}

async function loadLocation(id) {
    const loc = await localDB.locations.get(id); if (loc) await buildBreadcrumb(loc);
    currentBrowserLocations = await localDB.locations.where('parent_id').equals(id).toArray();
    currentBrowserItems = await localDB.items.where('location_id').equals(id).toArray();
    renderLocations(currentBrowserLocations); renderItems(currentBrowserItems);
}

function navigateToLocation(id) {
    if (id === "unallocated") { currentLocationId = "unallocated"; loadUnallocatedItems(); return; }
    currentLocationId = id; loadLocation(id);
}

async function loadUnallocatedItems() {
    const container = document.getElementById("breadcrumb");
    if (container) container.innerHTML = `<span class="breadcrumb-link" onclick="loadRootLocations()">Items</span><span class="breadcrumb-separator"> > </span><span class="breadcrumb-link active">Unallocated Items</span>`;
    currentBrowserLocations = [];
    const allItems = await localDB.items.toArray(); currentBrowserItems = allItems.filter(i => !i.location_id);
    renderLocations([]); renderItems(currentBrowserItems);
}

async function loadAllItemsFlat() {
    currentLocationId = null;
    const container = document.getElementById("breadcrumb");
    if (container) container.innerHTML = '<span class="breadcrumb-link active">All Items (Flat View)</span>';
    currentBrowserLocations = []; 
    currentBrowserItems = await localDB.items.toArray(); 
    renderLocations([]); renderItems(currentBrowserItems);
}

async function buildBreadcrumb(location) {
    let chain = [location]; let parentId = location.parent_id;
    while (parentId) {
        const parent = await localDB.locations.get(parentId); 
        if (parent) { chain.unshift(parent); parentId = parent.parent_id; } else break;
    }
    locationHistory = chain.slice(0, -1).map(l => l.id);
    const container = document.getElementById("breadcrumb"); if (!container) return; container.innerHTML = "";
    const rootLink = document.createElement("span"); rootLink.className = "breadcrumb-link"; rootLink.textContent = "Items"; rootLink.onclick = () => loadRootLocations(); container.appendChild(rootLink);
    chain.forEach((l, idx) => {
        const sep = document.createElement("span"); sep.className = "breadcrumb-separator"; sep.textContent = " > "; container.appendChild(sep);
        const link = document.createElement("span"); link.className = "breadcrumb-link"; link.textContent = l.name;
        if (idx === chain.length - 1) { link.classList.add("active"); } else { link.onclick = () => { currentLocationId = l.id; loadLocation(l.id); }; }
        container.appendChild(link);
    });
}

/* =========================================================
    TEMP LOCATIONS / ASSIGNEES LOGIC (DEXIE)
========================================================= */
async function loadTempLocationsAdmin() {
    tempLocationsAdmin = await localDB.temp_locations.toArray();
    currentTempLocationId = null;
    document.getElementById("tempLocationTilesAdmin").style.display = "grid";
    document.getElementById("tempLocationItemsGrid").style.display = "none";
    const breadcrumb = document.getElementById("breadcrumbTempLocations");
    if (breadcrumb) breadcrumb.innerHTML = `<span class="breadcrumb-link active">Assigned Log</span>`;
    renderTempLocationTilesAdmin();
    loadAssignDropdown();
}

async function loadTempLocationDetails(tempId) {
    currentTempLocationId = tempId;
    const tempLoc = tempLocationsAdmin.find(t => t.id === tempId);
    const breadcrumb = document.getElementById("breadcrumbTempLocations");
    if (breadcrumb) breadcrumb.innerHTML = `<span class="breadcrumb-link" onclick="loadTempLocationsAdmin()">Assigned Log</span><span class="breadcrumb-separator"> > </span><span class="breadcrumb-link active">👤 ${tempLoc ? tempLoc.name : 'Assignee'}</span>`;
    document.getElementById("tempLocationTilesAdmin").style.display = "none";
    document.getElementById("tempLocationItemsGrid").style.display = "grid";
    
    const items = await localDB.items.toArray();
    const assignedItems = items.filter(i => i.assigned_to === tempId);
    renderAssignedItems(assignedItems || []);
}

function renderTempLocationTilesAdmin() {
    const container = document.getElementById("tempLocationTilesAdmin"); if (!container) return; container.innerHTML = "";
    if (tempLocationsAdmin.length === 0) { container.style.display = "block"; container.innerHTML = `<div style="padding: 40px; text-align: center; color: #999; font-style: italic;">No temporary assignment locations created yet.</div>`; return; }
    container.style.display = "grid";
    tempLocationsAdmin.forEach(loc => {
        const div = document.createElement("div"); div.className = "item-card temp-location-card";
        let imgSrc = "../assets/images/folder-icon.jpg"; if (loc.photo_path) imgSrc = window.db.storage.from("location-photos").getPublicUrl(loc.photo_path).data.publicUrl;
        div.innerHTML = `<div class="cog" onclick="openTempLocationActions('${loc.id}');event.stopPropagation();">⚙️</div><div class="item-card-photo-wrapper" style="border-radius:50%;"><img src="${imgSrc}"></div><div class="item-card-name" style="color:#10b981;">${loc.name}</div>`;
        div.onclick = () => loadTempLocationDetails(loc.id); container.appendChild(div);
    });
}

function renderAssignedItems(items) {
    const container = document.getElementById("tempLocationItemsGrid"); container.innerHTML = "";
    if (!items || items.length === 0) { container.style.display = "block"; container.innerHTML = `<div style="padding: 40px; text-align: center; color: #999; font-style: italic;">No items currently checked out to this assignee.</div>`; return; }
    container.style.display = "grid";
    items.forEach(item => {
        const card = document.createElement("div"); card.className = "item-card"; if (item.id === lastMovedItemId) card.classList.add("moved-item-highlight");
        let imgUrl = "../assets/images/no-image.jpg"; if (item.photos?.length) { const defaultPhoto = item.photos.find(p => p.is_primary) || item.photos[0]; imgUrl = window.db.storage.from("item-photos").getPublicUrl(defaultPhoto.file_path).data.publicUrl; }
        let locPath = item.location_id ? buildLocationPath(item.location_id) : "Unallocated";
        card.innerHTML = `<div class="item-card-photo-wrapper"><img src="${imgUrl}"></div><div class="item-card-qty-badge">Qty: ${item.quantity}</div><div onclick="executeReturnItem('${item.id}', true); event.stopPropagation();" style="position:absolute; top:8px; right:8px; background:#ef4444; color:white; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:bold; z-index:10; box-shadow:0 2px 4px rgba(0,0,0,0.2); cursor:pointer;">📥 Return Item</div><div class="item-card-name" style="margin-top: 10px;">${item.name}</div><div style="font-size: 11px; color: #666; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 4px;"><span>📍</span> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%;">${locPath}</span></div>`;
        card.onclick = () => openItemDetails(item); container.appendChild(card);
    });
}

/* =========================================================
    MANAGEMENT LOGIC (NORMAL FOLDERS)
========================================================= */
function refreshLocationAdmin() {
    if (adminLocationView === "hierarchy") {
        if (!currentLocationAdmin) loadRootLocationsAdmin();
        else loadLocationAdmin(currentLocationAdmin);
    } else { loadFlatLocationsAdmin(); }
}

async function loadLocationsAdmin() {
    const lData = await localDB.locations.toArray();
    
    // Safely map the database columns to the UI's memory variables
    locationsAdmin = lData.map(l => ({ 
        id: l.id, 
        name: l.name, 
        parent: l.parent_id, // <--- This was the missing link!
        barcode: l.barcode, 
        nfc: l.nfc_tag, 
        photo: l.photo_path, 
        location_description: l.location_description, 
        category: l.category 
    }));
    
    refreshLocationAdmin();
    loadLocationDropdown();
}

function loadRootLocationsAdmin() {
    currentLocationAdmin = null;
    const container = document.getElementById("breadcrumbLocations");
    if (container) container.innerHTML = '<span class="breadcrumb-link active">Locations</span>';
    renderLocationTilesAdmin(locationsAdmin.filter(l => !l.parent));
}

function loadLocationAdmin(id) {
    currentLocationAdmin = id;
    buildAdminBreadcrumb(id);
    renderLocationTilesAdmin(locationsAdmin.filter(l => l.parent === id));
}

function loadFlatLocationsAdmin() {
    currentLocationAdmin = null;
    const container = document.getElementById("breadcrumbLocations");
    if (container) container.innerHTML = `<span class="breadcrumb-link" onclick="loadRootLocationsAdmin()">Locations</span><span class="breadcrumb-separator"> > </span><span class="breadcrumb-link active">All Locations</span>`;
    const list = locationsAdmin.map(l => ({ ...l, fullPath: buildLocationPath(l.id) })).sort((a, b) => a.fullPath.localeCompare(b.fullPath));
    renderLocationTilesAdmin(list);
}

function buildAdminBreadcrumb(id) {
    const container = document.getElementById("breadcrumbLocations"); if (!container) return; container.innerHTML = "";
    const rootLink = document.createElement("span"); rootLink.className = "breadcrumb-link"; rootLink.textContent = "Locations"; rootLink.onclick = () => loadRootLocationsAdmin(); container.appendChild(rootLink);
    let loc = locationsAdmin.find(l => l.id === id); if (!loc) return;
    let chain = [loc]; while (loc.parent) { loc = locationsAdmin.find(l => l.id === loc.parent); if (!loc) break; chain.unshift(loc); }
    chain.forEach((l, idx) => {
        const sep = document.createElement("span"); sep.className = "breadcrumb-separator"; sep.textContent = " > "; container.appendChild(sep);
        const link = document.createElement("span"); link.className = "breadcrumb-link"; link.textContent = l.name;
        if (idx === chain.length - 1) link.classList.add("active"); else link.onclick = () => loadLocationAdmin(l.id); container.appendChild(link);
    });
}

function loadLocationDropdown() {
    if (!locationsAdmin || locationsAdmin.length === 0) return;
    const treePathsList = locationsAdmin.map(loc => ({ id: loc.id, fullNamePath: buildLocationPath(loc.id) })).sort((a, b) => a.fullNamePath.localeCompare(b.fullNamePath));
    const combinedOptionsHtml = '<option value="">No Location (Unallocated)</option>' + treePathsList.map(item => `<option value="${item.id}">${item.fullNamePath}</option>`).join("");
    const addSelect = document.getElementById("itemLocationSelect"); const editSelect = document.getElementById("editItemLocationSelect"); const moveSelect = document.getElementById("moveItemLocationSelect");
    if (addSelect) addSelect.innerHTML = combinedOptionsHtml; if (editSelect) editSelect.innerHTML = combinedOptionsHtml; if (moveSelect) moveSelect.innerHTML = combinedOptionsHtml;
}

function loadAssignDropdown() {
    const select = document.getElementById("assignItemSelect"); if (!select) return;
    if (!tempLocationsAdmin || tempLocationsAdmin.length === 0) { select.innerHTML = '<option value="" disabled selected>No temporary locations created yet.</option>'; return; }
    select.innerHTML = '<option value="" disabled selected>Select assignee...</option>' + tempLocationsAdmin.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
}

/* =========================================================
    RENDERING ENGINE (Items & Locations Grids/Tables)
========================================================= */
function renderLocations(locations) {
    const container = document.getElementById("locationTiles"); container.innerHTML = "";
    let sortedLocs = [...locations];
    if (currentSortMode.includes('desc')) sortedLocs.sort((a,b) => b.name.localeCompare(a.name)); else sortedLocs.sort((a,b) => a.name.localeCompare(b.name));
    sortedLocs.forEach(loc => {
        const tile = document.createElement("div"); tile.className = "item-card location-card"; 
        tile.innerHTML = `<div class="item-card-photo-wrapper"><img src="../assets/images/folder-icon.jpg"></div><div class="item-card-qty-badge" style="background:#ff8c00;">Folder</div><div class="item-card-name">${loc.name}</div>`;
        tile.onclick = () => navigateToLocation(loc.id); container.appendChild(tile);
    });
}

function renderItems(items) {
    const container = document.getElementById("itemTiles"); const tableContainer = document.getElementById("itemsTableWrapper");
    container.innerHTML = ""; tableContainer.innerHTML = "";

    let sortedItems = [...(items || [])];
    if (currentSortMode === 'name_asc') sortedItems.sort((a,b) => a.name.localeCompare(b.name));
    else if (currentSortMode === 'name_desc') sortedItems.sort((a,b) => b.name.localeCompare(a.name));
    else if (currentSortMode === 'qty_desc') sortedItems.sort((a,b) => b.quantity - a.quantity);
    else if (currentSortMode === 'qty_asc') sortedItems.sort((a,b) => a.quantity - b.quantity);

    if (sortedItems.length > 0) {
        sortedItems.forEach(item => {
            const card = document.createElement("div"); card.className = "item-card"; if (item.id === lastMovedItemId) card.classList.add("moved-item-highlight");
            let imgUrl = "../assets/images/no-image.jpg"; if (item.photos?.length) { const defP = item.photos.find(p => p.is_primary) || item.photos[0]; imgUrl = window.db.storage.from("item-photos").getPublicUrl(defP.file_path).data.publicUrl; }
            let locPath = item.location_id ? buildLocationPath(item.location_id) : "Unallocated";
            let overlayHtml = ""; let quickReturnHtml = "";
            if (item.assigned_to) {
                const tempLoc = tempLocationsAdmin.find(t => t.id === item.assigned_to);
                overlayHtml = `<div class="assigned-overlay"><div class="assigned-icon">👤</div><div class="assigned-label">Out</div><div class="assigned-name">${tempLoc ? tempLoc.name : 'Unknown'}</div></div>`;
                quickReturnHtml = `<div onclick="executeReturnItem('${item.id}'); event.stopPropagation();" style="position:absolute; top:8px; right:42px; background:#ef4444; color:white; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold; z-index:10; box-shadow:0 2px 4px rgba(0,0,0,0.2); cursor:pointer;">📥 Return</div>`;
            }
            card.innerHTML = `<div class="item-card-photo-wrapper">${overlayHtml}<img src="${imgUrl}"></div><div class="item-card-qty-badge">Qty: ${item.quantity}</div>${quickReturnHtml}<div class="item-card-name">${item.name}</div><div style="font-size: 11px; color: #666; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 4px; position: relative; z-index: 6;"><span>📍</span> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%;">${locPath}</span></div>`;
            card.onclick = () => openItemDetails(item); container.appendChild(card);
        });
    }

    const combinedList = [];
    let sortedLocsForTable = [...(currentBrowserLocations || [])];
    if (currentSortMode.includes('desc')) sortedLocsForTable.sort((a,b) => b.name.localeCompare(a.name)); else sortedLocsForTable.sort((a,b) => a.name.localeCompare(b.name));
    if (sortedLocsForTable.length > 0) sortedLocsForTable.forEach(loc => { combinedList.push({ isLocation: true, id: loc.id, name: loc.name, barcode: loc.barcode || '', nfc_tag: loc.nfc || '', category: loc.category || 'storage', tags: '' }); });
    if (sortedItems.length > 0) sortedItems.forEach(item => { combinedList.push({ isLocation: false, id: item.id, name: item.name, quantity: item.quantity, barcode: item.barcode || '', nfc_tag: item.nfc_tag || '', category: item.category || '—', tags: item.tags ? (Array.isArray(item.tags) ? item.tags.join(', ') : JSON.stringify(item.tags)) : '—', rawItem: item }); });

    const c = userSettings.columns; const w = userSettings.widths;
    tableContainer.innerHTML = `<button class="col-picker-btn" onclick="toggleColumnMenu(event, 'itemColMenu')">⚙️ Columns</button>
        <div id="itemColMenu" class="col-picker-menu">
            <label><input type="checkbox" ${c.name ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'name', 1, this.checked)"> Name</label>
            <label><input type="checkbox" ${c.quantity ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'quantity', 2, this.checked)"> Quantity</label>
            <label><input type="checkbox" ${c.barcode ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'barcode', 3, this.checked)"> Barcode</label>
            <label><input type="checkbox" ${c.nfc ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'nfc', 4, this.checked)"> NFC Tag</label>
            <label><input type="checkbox" ${c.category ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'category', 5, this.checked)"> Category</label>
            <label><input type="checkbox" ${c.tags ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'tags', 6, this.checked)"> Tags</label>
        </div>
        <table class="custom-table" id="itemsTable">
            <thead><tr><th style="width: 60px; min-width: 60px;">Photo</th><th style="width: ${w.name}; display: ${c.name ? '' : 'none'};">Name <div class="col-resizer"></div></th><th style="width: ${w.quantity}; display: ${c.quantity ? '' : 'none'};">Quantity <div class="col-resizer"></div></th><th style="width: ${w.barcode}; display: ${c.barcode ? '' : 'none'};">Barcode <div class="col-resizer"></div></th><th style="width: ${w.nfc}; display: ${c.nfc ? '' : 'none'};">NFC Tag <div class="col-resizer"></div></th><th style="width: ${w.category}; display: ${c.category ? '' : 'none'};">Category <div class="col-resizer"></div></th><th style="width: ${w.tags}; display: ${c.tags ? '' : 'none'};">Tags <div class="col-resizer"></div></th></tr></thead>
            <tbody></tbody>
        </table>`;

    const tbody = tableContainer.querySelector("tbody");
    if (combinedList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #999; padding: 30px; font-style: italic;">Empty directory context</td></tr>`;
        container.style.display = "block"; container.innerHTML = `<div style="padding: 40px; text-align: center; color: #64748b; font-size: 16px; font-weight: 600; font-style: italic; background: #f8fafc; border-radius: 12px; border: 2px dashed #cbd5e1; margin-top: 10px;">📭 This location is completely empty!</div>`;
    } else {
        container.style.display = "grid";
        combinedList.forEach(row => {
            const tr = document.createElement("tr"); tr.style.cursor = "pointer"; if (!row.isLocation && row.id === lastMovedItemId) tr.classList.add("moved-item-highlight");
            let rowImgSrc = "../assets/images/no-image.jpg"; 
            if (row.isLocation) {
                tr.onclick = () => navigateToLocation(row.id);
                const targetLocObj = locationsAdmin.find(l => l.id === row.id);
                if (targetLocObj && targetLocObj.photo) rowImgSrc = window.db.storage.from("location-photos").getPublicUrl(targetLocObj.photo).data.publicUrl; else rowImgSrc = "../assets/images/folder-icon.jpg";
                tr.innerHTML = `<td><img src="${rowImgSrc}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px;" onerror="this.onerror=null;this.src='../assets/images/folder-icon.jpg';"></td><td style="font-weight:700; color: #ff8c00; display: ${c.name ? '' : 'none'};">📦 ${row.name}</td><td style="color: #999; font-style: italic; display: ${c.quantity ? '' : 'none'};">—</td><td style="display: ${c.barcode ? '' : 'none'};">${row.barcode || '—'}</td><td style="display: ${c.nfc ? '' : 'none'};">${row.nfc_tag || '—'}</td><td style="text-transform: capitalize; display: ${c.category ? '' : 'none'};">${row.category || '—'}</td><td style="color: #999; display: ${c.tags ? '' : 'none'};">—</td>`;
            } else {
                tr.onclick = () => openItemDetails(row.rawItem);
                if (row.rawItem && row.rawItem.photos && row.rawItem.photos.length > 0) { const defaultPhoto = row.rawItem.photos.find(p => p.is_primary) || row.rawItem.photos[0]; rowImgSrc = window.db.storage.from("item-photos").getPublicUrl(defaultPhoto.file_path).data.publicUrl; }
                let nameHtml = row.name; if (row.rawItem.assigned_to) { const tempLoc = tempLocationsAdmin.find(t => t.id === row.rawItem.assigned_to); nameHtml = `<span style="color:#10b981;">👤 [Out: ${tempLoc ? tempLoc.name : 'User'}]</span> ${row.name}`; } else nameHtml = `🔹 ${row.name}`;
                tr.innerHTML = `<td><img src="${rowImgSrc}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px;" onerror="this.onerror=null;this.src='../assets/images/no-image.jpg';"></td><td style="font-weight:600; display: ${c.name ? '' : 'none'};">${nameHtml}</td><td style="display: ${c.quantity ? '' : 'none'};">${row.quantity}</td><td style="display: ${c.barcode ? '' : 'none'};">${row.barcode || '—'}</td><td style="display: ${c.nfc ? '' : 'none'};">${row.nfc_tag || '—'}</td><td style="display: ${c.category ? '' : 'none'};">${row.category || '—'}</td><td style="display: ${c.tags ? '' : 'none'};">${row.tags}</td>`;
            }
            tbody.appendChild(tr);
        });
        initResizableColumns(document.getElementById("itemsTable"));
    }
}

function renderLocationTilesAdmin(list) {
    const tileContainer = document.getElementById("locationTilesAdmin"); const tableContainer = document.getElementById("locationsTableWrapper");
    if (!tileContainer || !tableContainer) return;
    if (typeof currentLocationsView !== 'undefined' && currentLocationsView === 'list') {
        tileContainer.style.display = "none"; tableContainer.style.display = "block";
        let html = `<table class="custom-table" style="width: 100%;"><thead><tr><th>Folder</th><th>Path / Name</th><th>Barcode ID</th><th>Hardware ID (NFC)</th><th style="text-align: right; padding-right: 25px;">Actions</th></tr></thead><tbody>`;
        list.forEach(loc => {
            let imgSrc = "../assets/images/folder-icon.jpg"; if (loc.photo) imgSrc = window.db.storage.from("location-photos").getPublicUrl(loc.photo).data.publicUrl; else if (loc.photo_path) imgSrc = window.db.storage.from("location-photos").getPublicUrl(loc.photo_path).data.publicUrl;
            html += `<tr onclick="openLocationActions('${loc.id}')" style="cursor: pointer;"><td style="width: 65px;"><img src="${imgSrc}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;" onerror="this.src='../assets/images/folder-icon.jpg'"></td><td style="font-weight: 600; color: #004a99;">${adminLocationView === "flat" ? (loc.fullPath || loc.name) : (loc.name || "Unnamed Location")}</td><td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${loc.barcode || "—"}</code></td><td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${loc.nfc_tag || loc.nfc || "—"}</code></td><td style="text-align: right; padding-right: 15px;" onclick="event.stopPropagation();"><button class="btn-primary" onclick="openLocationActions('${loc.id}')" style="padding: 6px 12px; font-size: 12px; background:#004a99;">⚙️ Manage</button></td></tr>`;
        });
        html += `</tbody></table>`; tableContainer.innerHTML = html; return;
    }
    tableContainer.style.display = "none"; tileContainer.style.display = "grid"; tileContainer.innerHTML = "";
    let sortedList = [...list];
    if (typeof currentSortModeLocations !== 'undefined' && currentSortModeLocations === 'name_desc') { sortedList.sort((a, b) => { const nameA = adminLocationView === "flat" ? a.fullPath : a.name; const nameB = adminLocationView === "flat" ? b.fullPath : b.name; return nameB.localeCompare(nameA); }); } else { sortedList.sort((a, b) => { const nameA = adminLocationView === "flat" ? a.fullPath : a.name; const nameB = adminLocationView === "flat" ? b.fullPath : b.name; return nameA.localeCompare(nameB); }); }
    sortedList.forEach(loc => {
        const div = document.createElement("div"); div.className = "item-card location-card";
        let imgSrc = "../assets/images/folder-icon.jpg"; if (loc.photo) imgSrc = window.db.storage.from("location-photos").getPublicUrl(loc.photo).data.publicUrl; else if (loc.photo_path) imgSrc = window.db.storage.from("location-photos").getPublicUrl(loc.photo_path).data.publicUrl;
        div.innerHTML = `<div class="cog" onclick="openLocationActions('${loc.id}');event.stopPropagation();">⚙️</div><div class="item-card-photo-wrapper"><img src="${imgSrc}"></div><div class="item-card-name">${adminLocationView === "flat" ? loc.fullPath : loc.name}</div>`;
        if (adminLocationView === "hierarchy") div.onclick = () => loadLocationAdmin(loc.id); tileContainer.appendChild(div);
    });
}

function initResizableColumns(table) {
    if (!table) return; const cols = table.querySelectorAll("thead th");
    cols.forEach((col, idx) => {
        const resizer = col.querySelector(".col-resizer"); if (!resizer) return;
        resizer.addEventListener("mousedown", function(e) {
            e.preventDefault(); resizer.classList.add("resizing"); const startX = e.pageX; const startWidth = col.offsetWidth;
            function onMouseMove(moveEvent) { const currentWidth = startWidth + (moveEvent.pageX - startX); if (currentWidth > 60) col.style.width = currentWidth + "px"; }
            function onMouseUp() { resizer.classList.remove("resizing"); document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); const colKeys = ['name', 'quantity', 'barcode', 'nfc', 'category', 'tags']; const updatedCols = table.querySelectorAll("thead th"); updatedCols.forEach((th, i) => { if (colKeys[i]) userSettings.widths[colKeys[i]] = th.style.width || th.offsetWidth + "px"; }); saveInventorySettings(); }
            document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp);
        });
    });
}

function toggleTableColumn(tableId, colKey, colIndex, isVisible) {
    const table = document.getElementById(tableId); if (!table) return; const displayValue = isVisible ? "" : "none";
    const th = table.querySelectorAll("thead th")[colIndex]; if (th) th.style.display = displayValue;
    table.querySelectorAll("tbody tr").forEach(tr => { const td = tr.children[colIndex]; if (td) td.style.display = displayValue; });
    userSettings.columns[colKey] = isVisible; saveInventorySettings();
}

function toggleColumnMenu(event, menuId) {
    event.stopPropagation(); const menu = document.getElementById(menuId); const isShowing = menu.style.display === "flex";
    document.querySelectorAll('.col-picker-menu').forEach(m => m.style.display = "none"); menu.style.display = isShowing ? "none" : "flex";
    document.onclick = () => menu.style.display = "none"; menu.onclick = (e) => e.stopPropagation();
}

/* =========================================================
   MULTIPLE PHOTOS & CAMERA PREVIEW RUNTIME HANDLERS
========================================================= */
function handleMultipleFilesSelection(input, previewContainerId, mode) {
    const files = input.files; if (!files) return;
    let targetArray; if (mode === 'add-item') targetArray = currentAddItemFiles; else if (mode === 'edit-item') targetArray = currentEditItemFiles;
    for (let i = 0; i < files.length; i++) targetArray.push(files[i]);
    renderMultipleFilesPreviews(previewContainerId, targetArray, mode, mode === 'edit-item' ? currentItemForActions.photos || [] : []);
}

function renderMultipleFilesPreviews(containerId, filesArray, mode, existingPhotos = []) {
    const container = document.getElementById(containerId); if (!container) return; container.innerHTML = "";
    existingPhotos.forEach((photo) => {
        const wrapper = document.createElement("div"); wrapper.style.cssText = "position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;";
        const img = document.createElement("img"); img.style.cssText = "width: 100%; height: 100%; object-fit: cover;"; img.src = window.db.storage.from("item-photos").getPublicUrl(photo.file_path).data.publicUrl;
        const removeBtn = document.createElement("div"); removeBtn.style.cssText = "position: absolute; top: 2px; right: 2px; background: rgba(239, 68, 68, 0.9); color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer; font-weight: bold; line-height: 1;"; removeBtn.innerHTML = "&times;";
        removeBtn.onclick = () => { existingItemPhotosToDelete.push(photo.file_path); const index = currentItemForActions.photos.findIndex(p => p.file_path === photo.file_path); if (index > -1) currentItemForActions.photos.splice(index, 1); if (primaryPhotoIdentifier === photo.file_path) primaryPhotoIdentifier = null; renderMultipleFilesPreviews(containerId, filesArray, mode, currentItemForActions.photos); };
        const starBtn = document.createElement("div"); const isPrimary = primaryPhotoIdentifier === photo.file_path || photo.is_primary; if (isPrimary && !primaryPhotoIdentifier) primaryPhotoIdentifier = photo.file_path;
        starBtn.style.cssText = `position: absolute; bottom: 2px; left: 2px; font-size: 12px; cursor: pointer; background: rgba(0,0,0,0.6); padding: 2px 4px; border-radius: 4px; color: ${isPrimary ? '#ffb000' : '#fff'};`; starBtn.innerHTML = isPrimary ? "★" : "☆";
        starBtn.onclick = () => { primaryPhotoIdentifier = photo.file_path; existingPhotos.forEach(p => p.is_primary = (p.file_path === photo.file_path)); renderMultipleFilesPreviews(containerId, filesArray, mode, existingPhotos); };
        wrapper.appendChild(img); wrapper.appendChild(removeBtn); wrapper.appendChild(starBtn); container.appendChild(wrapper);
    });

    if (filesArray.length === 0 && existingPhotos.length === 0) {
        container.innerHTML = `<img src="../assets/images/no-image.jpg" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd;">`; return;
    }

    filesArray.forEach((file, index) => {
        const wrapper = document.createElement("div"); wrapper.style.cssText = "position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;";
        const img = document.createElement("img"); img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
        const reader = new FileReader(); reader.onload = (e) => { img.src = e.target.result; }; reader.readAsDataURL(file);
        const removeBtn = document.createElement("div"); removeBtn.style.cssText = "position: absolute; top: 2px; right: 2px; background: rgba(239, 68, 68, 0.9); color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer; font-weight: bold; line-height: 1;"; removeBtn.innerHTML = "&times;";
        removeBtn.onclick = () => { if (primaryPhotoIdentifier === file.name) primaryPhotoIdentifier = null; filesArray.splice(index, 1); renderMultipleFilesPreviews(containerId, filesArray, mode, existingPhotos); };
        const starBtn = document.createElement("div"); const isPrimary = primaryPhotoIdentifier === file.name;
        starBtn.style.cssText = `position: absolute; bottom: 2px; left: 2px; font-size: 12px; cursor: pointer; background: rgba(0,0,0,0.6); padding: 2px 4px; border-radius: 4px; color: ${isPrimary ? '#ffb000' : '#fff'};`; starBtn.innerHTML = isPrimary ? "★" : "☆";
        starBtn.onclick = () => { primaryPhotoIdentifier = file.name; if (mode === 'edit-item') existingPhotos.forEach(p => p.is_primary = false); renderMultipleFilesPreviews(containerId, filesArray, mode, existingPhotos); };
        wrapper.appendChild(img); wrapper.appendChild(removeBtn); wrapper.appendChild(starBtn); container.appendChild(wrapper);
    });
}

function previewLocationImage(input, previewId, mode) {
    if (input.files && input.files[0]) {
        const file = input.files[0]; if (mode === 'add') currentAddLocationFiles = [file]; else currentEditLocationFile = file;
        const reader = new FileReader(); reader.onload = (e) => document.getElementById(previewId).src = e.target.result; reader.readAsDataURL(file);
    }
}
function deleteLocationPhoto() { document.getElementById('editLocationPreview').src = "../assets/images/folder-icon.jpg"; document.getElementById('editLocationPhotoInput').value = ""; document.getElementById('editLocationCameraInput').value = ""; currentEditLocationFile = null; window.locationPhotoDeleted = true; }
function deleteTempLocationPhoto() { document.getElementById('editTempLocationPreview').src = "../assets/images/folder-icon.jpg"; document.getElementById('editTempLocationPhotoInput').value = ""; document.getElementById('editTempLocationCameraInput').value = ""; currentEditLocationFile = null; window.locationPhotoDeleted = true; }
function previewTempLocationImage(input, previewId, mode) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (mode === 'add') currentAddLocationFiles = [file];
        else currentEditLocationFile = file;
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById(previewId).src = e.target.result;
        reader.readAsDataURL(file);
    }
}

/* =========================================================
   ITEM ACTIONS (CRUD)
========================================================= */
function openAddItemModal() { 
    document.getElementById("itemName").value = ""; document.getElementById("itemQuantity").value = ""; document.getElementById("itemDescription").value = ""; document.getElementById("addItemBarcode").value = ""; document.getElementById("addItemNFC").value = ""; document.getElementById("addItemPhotoInput").value = ""; document.getElementById("addItemCameraInput").value = "";
    currentAddItemFiles = []; primaryPhotoIdentifier = null; renderMultipleFilesPreviews('addItemPreviewsRow', currentAddItemFiles, 'add-item');
    activeSelectedAddTags = []; renderActiveTagPills('add');
    const selectEl = document.getElementById("itemLocationSelect"); if (selectEl) selectEl.value = (currentLocationId && currentLocationId !== "unallocated") ? currentLocationId : "";
    document.getElementById("addItemModal").style.display = "flex"; 
}

function closeAddItemModal() { document.getElementById("addItemModal").style.display = "none"; }

async function addItem() {
    if (window.isProcessingTransaction) return;
    window.isProcessingTransaction = true;

    try {
        const name = document.getElementById("itemName").value;
        const quantity = parseInt(document.getElementById("itemQuantity").value) || 0;
        const location_id = document.getElementById("itemLocationSelect").value || null;
        const description = document.getElementById("itemDescription").value;
        const category = document.getElementById("itemCategorySelect").value || 'tools';
        const barcode = document.getElementById("addItemBarcode").value;
        const nfc_tag = document.getElementById("addItemNFC").value;

        if (!name) return await customAlert("Please enter an item name", "Missing Data");
        if (barcode && !(await isHardwareTagUnique(barcode))) return await customAlert("That Barcode ID is already registered!", "Duplicate Code");
        if (nfc_tag && !(await isHardwareTagUnique(nfc_tag))) return await customAlert("That NFC Tag is already registered!", "Duplicate Code");

        // Use the new Universal Writer!
        const payload = { name, quantity, location_id, description, category, barcode, nfc_tag, tags: activeSelectedAddTags };
        const response = await window.offlineSafeWrite('CREATE', 'items', payload);

        if (response.success) {
            const newItemId = response.id; // We get the UUID instantly!
            
            // Handle Offline Photos
            if (currentAddItemFiles.length > 0) {
                if (!primaryPhotoIdentifier) primaryPhotoIdentifier = currentAddItemFiles[0].name;
                for (let i = 0; i < currentAddItemFiles.length; i++) {
                    const file = currentAddItemFiles[i];
                    const fileName = `item-${newItemId}-${Date.now()}-${i}`;
                    const isPrimary = file.name === primaryPhotoIdentifier;
                    
                    // Convert the image to text and save to the Offline Queue!
                    const base64Data = await window.fileToBase64(file);
                    await localDB.sync_photos_queue.add({
                        record_id: newItemId, record_type: 'item', bucket: 'item-photos',
                        file_name: fileName, base64_data: base64Data, is_primary: isPrimary, status: 'pending'
                    });
                }
            }
            
            closeAddItemModal();
            logAction("CREATE", "Item", name, `Added quantity: ${quantity}`);
            
            await refreshAllDataFromLocal(); // Instantly update the UI without waiting for internet!
            window.processSyncQueue(); // Tell the engine to try uploading if we have a signal
        }
    } finally { window.isProcessingTransaction = false; }
}
async function switchToItemEdit() {
    if (!currentItemForActions) return;
    closeModal('itemDetailsModal');
    const item = currentItemForActions;

    try {
        // 1. Safely populate standard text fields
        if (document.getElementById("editItemName")) document.getElementById("editItemName").value = item.name || "";
        if (document.getElementById("editItemQuantity")) document.getElementById("editItemQuantity").value = item.quantity || 0;
        if (document.getElementById("editItemDescription")) document.getElementById("editItemDescription").value = item.description || "";
        if (document.getElementById("editItemBarcode")) document.getElementById("editItemBarcode").value = item.barcode || "";
        if (document.getElementById("editItemNFC")) document.getElementById("editItemNFC").value = item.nfc_tag || "";
        if (document.getElementById("editItemCategory")) document.getElementById("editItemCategory").value = item.category || "tools";
        if (document.getElementById("editItemLocationSelect")) document.getElementById("editItemLocationSelect").value = item.location_id || "";

        // 2. Safely parse tags (handles both arrays and comma-separated strings)
        let parsedTags = [];
        if (Array.isArray(item.tags)) {
            parsedTags = [...item.tags];
        } else if (typeof item.tags === 'string' && item.tags.trim()) {
            parsedTags = item.tags.split(',').map(t => t.trim());
        }
        activeSelectedEditTags = parsedTags;
        renderActiveTagPills('edit');

        // 3. Safely handle photos (removed strict syntax for maximum Android compatibility)
        currentEditItemFiles = []; 
        existingItemPhotosToDelete = []; 
        primaryPhotoIdentifier = null;
        
        const photos = item.photos || [];
        const existingPrimary = photos.find(p => p.is_primary);
        primaryPhotoIdentifier = existingPrimary ? existingPrimary.file_path : (photos.length > 0 ? photos[0].file_path : null);
        
        renderMultipleFilesPreviews('editItemPreviewsRow', currentEditItemFiles, 'edit-item', photos);

        // 4. Show the modal
        document.getElementById("itemEditModal").style.display = "flex";
        
    } catch (error) {
        console.error("Critical Error opening edit modal:", error);
        alert("An error occurred trying to load the editor. Please refresh the app.");
    }
}

async function attemptDeleteItem() {
    if (!currentItemForActions || !currentItemForActions.id) return await customAlert("No item selected.", "Error");
    if (!(await customConfirm("Are you sure you want to permanently delete this item? This operation cannot be undone.", "Delete Item?", true))) return;

    const itemName = currentItemForActions.name || "Unknown Item";
    
    // Offline Safe Delete
    const response = await window.offlineSafeWrite('DELETE', 'items', null, currentItemForActions.id);

    if (response.success) {
        closeModal('itemEditModal');
        logAction("DELETE", "Item", itemName, "Permanently removed from database");
        await refreshAllDataFromLocal(); // Instant UI update
        window.processSyncQueue(); // Sync if online
    }
}

async function executeMoveItem() {
    if (window.isProcessingTransaction) return;
    window.isProcessingTransaction = true;

    try {
        if (!currentItemForActions || !currentItemForActions.id) return;
        const destinationId = document.getElementById("moveItemLocationSelect").value || null;
        const targetItemId = currentItemForActions.id; 

        // Offline Safe Update
        const response = await window.offlineSafeWrite('UPDATE', 'items', { location_id: destinationId }, targetItemId);
        
        if (response.success) {
            closeModal('moveItemModal'); closeModal('itemDetailsModal'); closeBarcodeScannerModal();
            lastMovedItemId = targetItemId; 
            const destLoc = locationsAdmin.find(l => l.id === destinationId);
            logAction("MOVE", "Item", currentItemForActions.name, `Moved to ${destLoc ? destLoc.name : 'Unallocated'}`);

            await refreshAllDataFromLocal(); // Instant UI update
            window.processSyncQueue(); // Sync if online
            showPage('pageItems'); 
            setTimeout(() => { lastMovedItemId = null; }, 6000);
        }
    } finally { window.isProcessingTransaction = false; }
}

async function saveItemEdits() {
    if (!window.isAppOnline) return await customAlert("You must be connected to the internet to save edits.", "Offline Mode");
    if (window.isProcessingTransaction) return;
    window.isProcessingTransaction = true;

    try {
        if (!currentItemForActions || !currentItemForActions.id) return;
        const itemId = currentItemForActions.id;
        const barcode = document.getElementById("editItemBarcode").value;
        const nfc_tag = document.getElementById("editItemNFC").value;

        if (barcode && !(await isHardwareTagUnique(barcode, itemId))) return await customAlert("Barcode ID is already registered!", "Duplicate Code");
        if (nfc_tag && !(await isHardwareTagUnique(nfc_tag, itemId))) return await customAlert("NFC Tag is already registered!", "Duplicate Code");

        await window.db.from("photos").update({ is_primary: false }).eq("item_id", itemId);
        if (existingItemPhotosToDelete.length > 0) { for (let path of existingItemPhotosToDelete) await window.db.from("photos").delete().eq("file_path", path); }
        if (primaryPhotoIdentifier) await window.db.from("photos").update({ is_primary: true }).eq("file_path", primaryPhotoIdentifier);
        
        if (currentEditItemFiles.length > 0) {
            for (let i = 0; i < currentEditItemFiles.length; i++) {
                const file = currentEditItemFiles[i]; const fileName = `item-${itemId}-${Date.now()}-${i}`;
                const { error: uploadError } = await window.db.storage.from("item-photos").upload(fileName, file);
                if (!uploadError) {
                    const isThisPrimary = file.name === primaryPhotoIdentifier || (!primaryPhotoIdentifier && i === 0 && currentItemForActions.photos.length === 0);
                    await window.db.from("photos").insert([{ item_id: itemId, file_path: fileName, is_primary: isThisPrimary }]);
                }
            }
        }
        const payload = {
            name: document.getElementById("editItemName").value, quantity: parseInt(document.getElementById("editItemQuantity").value) || 0,
            location_id: document.getElementById("editItemLocationSelect").value || null, description: document.getElementById("editItemDescription").value,
            barcode, nfc_tag, category: document.getElementById("editItemCategory").value, tags: activeSelectedEditTags
        };
        const { error } = await withStatus(() => window.db.from("items").update(payload).eq("id", itemId), "Updating item...");
        if (!error) {
            closeModal('itemEditModal'); logAction("UPDATE", "Item", payload.name, "Modified item details");
            await syncAfterWrite();
            if (currentTempLocationId) await loadTempLocationDetails(currentTempLocationId); else if (currentLocationId === "unallocated") await loadUnallocatedItems();
            else if (currentLocationId) await loadLocation(currentLocationId); else await loadRootLocations();
        }
    } finally { window.isProcessingTransaction = false; }
}

function openMoveItemModal() {
    if (!currentItemForActions) return;
    document.getElementById("moveItemLocationBarcode").value = ""; document.getElementById("moveItemLocationSelect").value = currentItemForActions.location_id || "";
    document.getElementById("moveItemModal").style.display = "flex";
}

async function executeMoveItem() {
    if (!window.isAppOnline) return await customAlert("You must be connected to the internet to move items.", "Offline Mode");
    if (window.isProcessingTransaction) return;
    window.isProcessingTransaction = true;

    try {
        if (!currentItemForActions || !currentItemForActions.id) return;
        const destinationId = document.getElementById("moveItemLocationSelect").value || null;
        const targetItemId = currentItemForActions.id; 

        const { error } = await withStatus(() => window.db.from("items").update({ location_id: destinationId }).eq("id", targetItemId), "Relocating item...");
        if (!error) {
            closeModal('moveItemModal'); closeModal('itemDetailsModal'); closeBarcodeScannerModal();
            lastMovedItemId = targetItemId; const destLoc = locationsAdmin.find(l => l.id === destinationId);
            logAction("MOVE", "Item", currentItemForActions.name, `Moved to ${destLoc ? destLoc.name : 'Unallocated'}`);

            await syncAfterWrite();
            if (destinationId) { currentLocationId = destinationId; await loadLocation(destinationId); } 
            else { currentLocationId = "unallocated"; await loadUnallocatedItems(); }
            showPage('pageItems'); setTimeout(() => { lastMovedItemId = null; }, 6000);
        }
    } finally { window.isProcessingTransaction = false; }
}

/* =========================================================
   LOCATION ACTIONS (CRUD)
========================================================= */
function openAddLocationModal() {
    ["addLocationName", "addLocationDescription", "addLocationBarcode", "addLocationNFC"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    const cat = document.getElementById("addLocationCategory"); if (cat) cat.value = "storage";
    document.getElementById("addLocationPhotoInput").value = ""; document.getElementById("addLocationCameraInput").value = ""; document.getElementById("addLocationPreview").src = "../assets/images/folder-icon.jpg";
    currentAddLocationFiles = []; document.getElementById("addLocationModal").style.display = "flex";
}

async function addLocation() {
    const name = document.getElementById("addLocationName").value; 
    const description = document.getElementById("addLocationDescription").value; 
    const barcode = document.getElementById("addLocationBarcode").value; 
    const nfc = document.getElementById("addLocationNFC").value; 
    const category = document.getElementById("addLocationCategory").value;
    
    if (!name) return await customAlert("Please enter a folder name", "Missing Name");
    if (barcode && !(await isHardwareTagUnique(barcode))) return await customAlert("Barcode ID is already registered!", "Duplicate Code");
    if (nfc && !(await isHardwareTagUnique(nfc))) return await customAlert("NFC Tag is already registered!", "Duplicate Code");

    const payload = { name, location_description: description, barcode, nfc_tag: nfc, category, parent_id: currentLocationAdmin };
    const response = await window.offlineSafeWrite('CREATE', 'locations', payload);

    if (response.success) {
        // Handle Offline Photos
        if (currentAddLocationFiles.length > 0) {
            const file = currentAddLocationFiles[0]; 
            const fileName = `location-${Date.now()}`;
            const base64Data = await window.fileToBase64(file);
            
            await localDB.sync_photos_queue.add({
                record_id: response.id, record_type: 'location', bucket: 'location-photos',
                file_name: fileName, base64_data: base64Data, is_primary: true, status: 'pending'
            });
        }

        closeModal('addLocationModal'); 
        logAction("CREATE", "Location", name, "Created new folder"); 
        
        await refreshAllDataFromLocal();
        window.processSyncQueue();
    }
}

function openLocationActions(id) {
    editingLocationId = id; const loc = locationsAdmin.find(l => l.id === id); if (!loc) return;
    document.getElementById("locationActionsName").textContent = loc.name; document.getElementById("editLocationName").value = loc.name || ""; document.getElementById("editLocationDescription").value = loc.location_description || ""; document.getElementById("editLocationBarcode").value = loc.barcode || ""; document.getElementById("editLocationNFC").value = loc.nfc || ""; document.getElementById("editLocationCategory").value = loc.category || "storage";
    currentEditLocationFile = null; window.locationPhotoDeleted = false;
    const previewImg = document.getElementById("editLocationPreview"); if (loc.photo) previewImg.src = window.db.storage.from("location-photos").getPublicUrl(loc.photo).data.publicUrl; else previewImg.src = "../assets/images/folder-icon.jpg";
    document.getElementById("locationActionsModal").style.display = "flex";
}

async function saveLocationEdits() {
    if (!window.isAppOnline) return await customAlert("You must be connected to the internet to save edits.", "Offline Mode");
    if (!editingLocationId) return;
    const barcode = document.getElementById("editLocationBarcode").value; const nfc_tag = document.getElementById("editLocationNFC").value; const name = document.getElementById("editLocationName").value;
    if (barcode && !(await isHardwareTagUnique(barcode, editingLocationId))) return await customAlert("Barcode ID is already registered!", "Duplicate Code");
    if (nfc_tag && !(await isHardwareTagUnique(nfc_tag, editingLocationId))) return await customAlert("NFC Tag is already registered!", "Duplicate Code");

    let photoPath = locationsAdmin.find(l => l.id === editingLocationId)?.photo || null;
    if (currentEditLocationFile) {
        const fileName = `location-${Date.now()}`; const { error: uploadError } = await window.db.storage.from("location-photos").upload(fileName, currentEditLocationFile);
        if (!uploadError) photoPath = fileName;
    } else if (window.locationPhotoDeleted) photoPath = null;

    const payload = { name, location_description: document.getElementById("editLocationDescription").value, barcode, nfc_tag, category: document.getElementById("editLocationCategory").value, photo_path: photoPath };
    const { error } = await withStatus(() => window.db.from("locations").update(payload).eq("id", editingLocationId), "Saving changes...");
    if (!error) { closeModal('locationActionsModal'); logAction("UPDATE", "Location", name, "Modified folder structure"); await syncAfterWrite(); loadLocationsAdmin(); }
}

async function attemptDeleteLocation() {
    if (!window.isAppOnline) return await customAlert("You must be connected to the internet to delete folders.", "Offline Mode");
    if (!editingLocationId) return;
    const loc = locationsAdmin.find(l => l.id === editingLocationId);
    if (locationsAdmin.some(l => l.parent === editingLocationId)) return await customAlert("Cannot delete: This folder contains sub-folders.", "Folder Not Empty");
    const items = await localDB.items.where('location_id').equals(editingLocationId).toArray();
    if (items && items.length > 0) return await customAlert("Cannot delete: This folder contains items.", "Folder Not Empty");
    
    if (!(await customConfirm("Are you sure? This cannot be undone.", "Delete Folder?", true))) return;

    const { error = null } = await withStatus(() => window.db.from("locations").delete().eq("id", editingLocationId), "Deleting folder...");
    if (!error) { closeModal('locationActionsModal'); logAction("DELETE", "Location", loc ? loc.name : 'Unknown', "Deleted folder"); await syncAfterWrite(); loadLocationsAdmin(); }
}

/* =========================================================
   TEMP LOCATIONS ACTIONS (CRUD)
========================================================= */
function openAddTempLocationModal() {
    document.getElementById("addTempLocationName").value = ""; document.getElementById("addTempLocationDescription").value = ""; document.getElementById("addTempLocationBarcode").value = "";
    document.getElementById("addTempLocationPhotoInput").value = ""; document.getElementById("addTempLocationCameraInput").value = ""; document.getElementById("addTempLocationPreview").src = "../assets/images/folder-icon.jpg";
    currentAddLocationFiles = []; document.getElementById("addTempLocationModal").style.display = "flex";
}

async function addTempLocation() {
    if (!window.isAppOnline) return await customAlert("You must be connected to the internet to create an assignee.", "Offline Mode");
    const name = document.getElementById("addTempLocationName").value; const desc = document.getElementById("addTempLocationDescription").value; const barcode = document.getElementById("addTempLocationBarcode").value;
    if (!name) return await customAlert("Please enter a name for the assignee.", "Missing Name");
    if (barcode && !(await isHardwareTagUnique(barcode))) return await customAlert("That ID code is already in use.", "Duplicate Code");

    let uploadedPhotoPath = null;
    if (currentAddLocationFiles.length > 0) {
        const file = currentAddLocationFiles[0]; const fileName = `temp-loc-${Date.now()}`;
        const { error: uploadError } = await window.db.storage.from("location-photos").upload(fileName, file);
        if (!uploadError) uploadedPhotoPath = fileName;
    }

    const { error } = await withStatus(() => window.db.from("temp_locations").insert([{ name, description: desc, barcode, photo_path: uploadedPhotoPath }]), "Creating...");
    if (!error) { closeModal('addTempLocationModal'); logAction("CREATE", "Temp Location", name, "Created new assignee profile"); await syncAfterWrite(); loadTempLocationsAdmin(); }
}

function openTempLocationActions(id) {
    editingTempLocationId = id; const loc = tempLocationsAdmin.find(l => l.id === id); if (!loc) return;
    document.getElementById("tempLocationActionsName").textContent = loc.name; document.getElementById("editTempLocationName").value = loc.name || ""; document.getElementById("editTempLocationDescription").value = loc.description || ""; document.getElementById("editTempLocationBarcode").value = loc.barcode || "";
    currentEditLocationFile = null; window.locationPhotoDeleted = false;
    const previewImg = document.getElementById("editTempLocationPreview"); if (loc.photo_path) previewImg.src = window.db.storage.from("location-photos").getPublicUrl(loc.photo_path).data.publicUrl; else previewImg.src = "../assets/images/folder-icon.jpg";
    document.getElementById("tempLocationActionsModal").style.display = "flex";
}

async function saveTempLocationEdits() {
    if (!window.isAppOnline) return await customAlert("You must be connected to the internet to save edits.", "Offline Mode");
    if (!editingTempLocationId) return;
    const barcode = document.getElementById("editTempLocationBarcode").value; const name = document.getElementById("editTempLocationName").value;
    if (barcode && !(await isHardwareTagUnique(barcode, editingTempLocationId))) return await customAlert("Barcode in use.", "Duplicate Code");

    let photoPath = tempLocationsAdmin.find(l => l.id === editingTempLocationId)?.photo_path || null;
    if (currentEditLocationFile) {
        const fileName = `temp-loc-${Date.now()}`; const { error: uploadError } = await window.db.storage.from("location-photos").upload(fileName, currentEditLocationFile);
        if (!uploadError) photoPath = fileName;
    } else if (window.locationPhotoDeleted) photoPath = null;

    const payload = { name, description: document.getElementById("editTempLocationDescription").value, barcode, photo_path: photoPath };
    const { error } = await withStatus(() => window.db.from("temp_locations").update(payload).eq("id", editingTempLocationId), "Saving updates...");
    if (!error) { closeModal('tempLocationActionsModal'); logAction("UPDATE", "Temp Location", name, "Updated assignee details"); await syncAfterWrite(); loadTempLocationsAdmin(); }
}

async function attemptDeleteTempLocation() {
    if (!window.isAppOnline) return await customAlert("You must be connected to the internet to delete an assignee.", "Offline Mode");
    if (!editingTempLocationId) return;
    const loc = tempLocationsAdmin.find(t => t.id === editingTempLocationId);
    const items = await localDB.items.where('assigned_to').equals(editingTempLocationId).toArray();
    if (items && items.length > 0) return await customAlert("Cannot delete: Items are currently assigned to this profile.", "Assignee Active");
    if (!(await customConfirm("Delete this Temporary Location?", "Delete Assignee?", true))) return;

    const { error } = await withStatus(() => window.db.from("temp_locations").delete().eq("id", editingTempLocationId), "Deleting...");
    if (!error) { closeModal('tempLocationActionsModal'); logAction("DELETE", "Temp Location", loc.name, "Deleted assignee profile"); await syncAfterWrite(); loadTempLocationsAdmin(); }
}

/* =========================================================
   RICH ITEM MODALS: VIEWER & ASSIGNMENT LOGIC
========================================================= */
function openItemDetails(item) {
    currentItemForActions = item;
    document.getElementById("detailItemName").textContent = item.name;
    document.getElementById("detailItemQtyBadge").textContent = "Qty: " + item.quantity;
    document.getElementById("detailItemDescription").textContent = item.description || "No description provided.";
    document.getElementById("detailItemBarcode").textContent = item.barcode || "—";
    document.getElementById("detailItemNFC").textContent = item.nfc_tag || "—";
    document.getElementById("detailItemLocation").textContent = item.location_id ? "📍 " + buildLocationPath(item.location_id) : "📍 Unallocated Items";

    const imgEl = document.getElementById("detailItemImage"); const thumbsContainer = document.getElementById("detailItemThumbsRow"); const expandBtn = document.getElementById("lightboxLauncherBtn");
    thumbsContainer.innerHTML = ""; lightboxImages = []; lightboxIndex = 0;

    if (item.photos && item.photos.length > 0) {
        expandBtn.style.display = "block";
        const sortedPhotos = [...item.photos].sort((a,b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        imgEl.src = window.db.storage.from("item-photos").getPublicUrl(sortedPhotos[0].file_path).data.publicUrl;
        sortedPhotos.forEach((photo, idx) => {
            const publicUrl = window.db.storage.from("item-photos").getPublicUrl(photo.file_path).data.publicUrl;
            lightboxImages.push(publicUrl);
            const thumbImg = document.createElement("img"); thumbImg.className = `view-thumb-item ${idx === 0 ? 'active' : ''}`; thumbImg.src = publicUrl;
            thumbImg.onclick = () => { document.querySelectorAll(".view-thumb-item").forEach(t => t.classList.remove("active")); thumbImg.classList.add("active"); imgEl.src = publicUrl; lightboxIndex = idx; };
            thumbsContainer.appendChild(thumbImg);
        });
    } else { imgEl.src = "../assets/images/no-image.jpg"; expandBtn.style.display = "none"; }

    const tagsContainer = document.getElementById("detailItemTagsContainer"); tagsContainer.innerHTML = "";
    let tagArray = Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' && item.tags.trim() ? item.tags.split(',').map(t => t.trim()) : []);
    if (tagArray.length > 0) {
        tagArray.forEach(tag => {
            const span = document.createElement("span"); span.className = "tag-pill"; span.textContent = tag; span.style.cursor = "pointer"; span.style.transition = "background 0.15s"; span.title = `Click to search for all items tagged with "${tag}"`;
            span.onmouseover = () => { span.style.background = "#bae6fd"; span.style.color = "#0369a1"; }; span.onmouseout = () => { span.style.background = "#f1f5f9"; span.style.color = "#475569"; };
            span.onclick = () => clickSearchTag(tag); tagsContainer.appendChild(span);
        });
    } else tagsContainer.innerHTML = `<span style="color:#999; font-style:italic; font-size:13px;">No tags assigned</span>`;

    const assignBtn = document.getElementById("btnAssignReturnToggle"); const banner = document.getElementById("detailAssignedBanner"); const nameLabel = document.getElementById("detailAssignedTargetName");
    if (item.assigned_to) {
        const tempLoc = tempLocationsAdmin.find(t => t.id === item.assigned_to);
        banner.style.display = "flex"; nameLabel.textContent = tempLoc ? tempLoc.name : "Unknown User";
        assignBtn.textContent = "📥 Return Item"; assignBtn.style.background = "#ef4444"; assignBtn.style.borderColor = "#ef4444";
    } else {
        banner.style.display = "none"; assignBtn.textContent = "👤 Assign"; assignBtn.style.background = "#10b981"; assignBtn.style.borderColor = "#10b981";
    }
    document.getElementById("itemDetailsModal").style.display = "flex";
}

function openLightbox() { if (!lightboxImages || lightboxImages.length === 0) return; document.getElementById("review-lightbox").style.display = "flex"; updateLightboxUI(); }
function closeLightbox() { document.getElementById("review-lightbox").style.display = "none"; }
function changeLightboxImage(direction) { lightboxIndex += direction; if (lightboxIndex < 0) lightboxIndex = lightboxImages.length - 1; if (lightboxIndex >= lightboxImages.length) lightboxIndex = 0; updateLightboxUI(); }
function updateLightboxUI() { const imgEl = document.getElementById("lightbox-img"); const counterEl = document.getElementById("lightbox-counter"); if (imgEl && lightboxImages[lightboxIndex]) imgEl.src = lightboxImages[lightboxIndex]; if (counterEl) counterEl.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`; }


/* =========================================================
   ASSIGNMENT / RETURN LOGIC
========================================================= */
function handleAssignReturnToggle() {
    if (!currentItemForActions) return;
    if (currentItemForActions.assigned_to) executeReturnItem(currentItemForActions.id);
    else { document.getElementById("assignItemBarcode").value = ""; document.getElementById("assignItemSelect").value = ""; document.getElementById("assignItemModal").style.display = "flex"; }
}

async function executeAssignItem() {
    if (!currentItemForActions) return;
    const targetId = document.getElementById("assignItemSelect").value;
    if (!targetId) return await customAlert("Please select a valid assignee.", "Missing Target");
    const tempLoc = tempLocationsAdmin.find(t => t.id === targetId);

    // Offline Safe Update
    const response = await window.offlineSafeWrite('UPDATE', 'items', { assigned_to: targetId }, currentItemForActions.id);
    
    if (response.success) {
        closeModal("assignItemModal"); closeModal("itemDetailsModal"); lastMovedItemId = currentItemForActions.id; 
        logAction("CHECKOUT", "Item", currentItemForActions.name, `Assigned out to ${tempLoc ? tempLoc.name : 'User'}`);
        
        await refreshAllDataFromLocal(); // Instant UI update
        window.processSyncQueue(); // Sync if online
        setTimeout(() => { lastMovedItemId = null; }, 6000);
    }
}

async function executeReturnItem(itemId, fromTempView = false) {
    if (!(await customConfirm("Check this item back into the warehouse?", "Confirm Return"))) return;
    const itemData = currentBrowserItems.find(i => i.id === itemId) || currentItemForActions;

    // Offline Safe Update
    const response = await window.offlineSafeWrite('UPDATE', 'items', { assigned_to: null }, itemId);
    
    if (response.success) {
        closeModal("itemDetailsModal"); lastMovedItemId = itemId; 
        logAction("RETURN", "Item", itemData ? itemData.name : 'Item', "Checked back into warehouse");
        
        await refreshAllDataFromLocal(); // Instant UI update
        window.processSyncQueue(); // Sync if online
        
        // Force the Temp view to refresh its specific grid if we are on that tab
        if (currentTempLocationId || fromTempView) await loadTempLocationDetails(currentTempLocationId || fromTempView); 
        setTimeout(() => { lastMovedItemId = null; }, 6000);
    }
}

function handleAssignBarcodeLookup(scannedText) {
    if (!scannedText || !tempLocationsAdmin) return;
    const cleanToken = scannedText.trim().toLowerCase();
    const match = tempLocationsAdmin.find(t => (t.barcode && t.barcode.trim().toLowerCase() === cleanToken) || (t.nfc_tag && t.nfc_tag.trim().toLowerCase() === cleanToken));
    if (match) { document.getElementById("assignItemSelect").value = match.id; executeAssignItem(); }
}

async function executeFastReturnLookup(scannedCodeString) {
    if (!window.isAppOnline) return await customAlert("You must be connected to the internet for Fast Return.", "Offline Mode");
    if (!scannedCodeString || !scannedCodeString.trim()) return;
    const lowerToken = scannedCodeString.trim().toLowerCase();
    const items = await localDB.items.toArray(); 
    if (!items) return;

    const match = items.find(item => (item.barcode && item.barcode.trim().toLowerCase() === lowerToken) || (item.nfc_tag && item.nfc_tag.trim().toLowerCase() === lowerToken));
    if (!match) return await customAlert(`No items found matching that tag!`, "Scan Failed");
    if (!match.assigned_to) return await customAlert(`Item [${match.name}] is already in the warehouse (Not checked out).`, "Already In Stock");

    const { error } = await withStatus(() => window.db.from("items").update({ assigned_to: null }).eq("id", match.id), "Processing rapid return...");
    if (!error) {
        await customAlert(`Success! [${match.name}] has been checked back in.`, "Item Returned");
        lastMovedItemId = match.id; 
        logAction("RETURN", "Item", match.name, "Fast-Return via Scanner");
        await syncAfterWrite();
        if (currentTempLocationId) loadTempLocationDetails(currentTempLocationId);
        else if (currentLocationId) loadLocation(currentLocationId);
        else loadRootLocations();
        setTimeout(() => { lastMovedItemId = null; }, 6000);
    }
}


/* =========================================================
   SEARCH & FILTER LOGIC
========================================================= */
async function handleGlobalSearch(term) {
    const filterType = document.getElementById("searchTypeFilter")?.value || "all";
    const lowerTerm = term.toLowerCase().trim();
    if (!lowerTerm && activeSearchTags.length === 0 && !activeSearchCategory) { if (currentLocationId) loadLocation(currentLocationId); else loadRootLocations(); return; }
    document.getElementById("breadcrumb").innerHTML = `Filtered Search Grid View`;

    const items = await localDB.items.toArray(); 
    if (!items) return;
    const sections = { name: [], location: [], tag: [], category: [] };

    items.forEach(item => {
        const nameMatches = item.name?.toLowerCase().includes(lowerTerm);
        const locationPath = item.location_id ? buildLocationPath(item.location_id).toLowerCase() : "unallocated items";
        const locationMatches = locationPath.includes(lowerTerm);
        const barcodeMatches = (item.barcode && item.barcode.toLowerCase().includes(lowerTerm)) || (item.nfc_tag && item.nfc_tag.toLowerCase().includes(lowerTerm));

        let itemTagsArray = [];
        if (Array.isArray(item.tags)) itemTagsArray = item.tags; else if (typeof item.tags === 'string' && item.tags.trim()) itemTagsArray = item.tags.split(',').map(t => t.trim());
        const itemTagsLower = itemTagsArray.map(t => t.toLowerCase());

        let tagPillsMatch = true; if (filterType === "tag" && activeSearchTags.length > 0) tagPillsMatch = activeSearchTags.every(t => itemTagsLower.includes(t.toLowerCase()));
        let textTagMatch = lowerTerm ? itemTagsArray.some(t => t.toLowerCase().includes(lowerTerm)) : true;
        let catPillMatch = true; if (filterType === "category" && activeSearchCategory) catPillMatch = item.category?.toLowerCase() === activeSearchCategory.toLowerCase();
        let textCatMatch = lowerTerm ? item.category?.toLowerCase().includes(lowerTerm) : true;

        if (filterType === "all") {
            if (nameMatches) sections.name.push(item); if (locationMatches) sections.location.push(item);
            if (lowerTerm && itemTagsArray.some(t => t.toLowerCase().includes(lowerTerm))) sections.tag.push(item);
            if (item.category?.toLowerCase().includes(lowerTerm)) sections.category.push(item);
        } else if (filterType === "name" && nameMatches) sections.name.push(item); else if (filterType === "location" && locationMatches) sections.location.push(item); else if (filterType === "barcode" && barcodeMatches) sections.name.push(item); else if (filterType === "tag" && tagPillsMatch && textTagMatch) sections.tag.push(item); else if (filterType === "category" && catPillMatch && textCatMatch) sections.category.push(item);
    });
    renderSectionedSearchResults(sections, filterType);
}

function renderSectionedSearchResults(sections, filterType) {
    let combinedResults = [];
    
    // 1. Gather the results based on the active filter
    if (filterType === "all") {
        combinedResults = [...sections.name, ...sections.location, ...sections.tag, ...sections.category];
    } else if (filterType === "name" || filterType === "barcode") {
        combinedResults = [...sections.name];
    } else if (filterType === "location") {
        combinedResults = [...sections.location];
    } else if (filterType === "tag") {
        combinedResults = [...sections.tag];
    } else if (filterType === "category") {
        combinedResults = [...sections.category];
    }

    // 2. Remove duplicates (An item might match multiple criteria)
    const uniqueResults = Array.from(new Set(combinedResults.map(i => i.id)))
        .map(id => combinedResults.find(i => i.id === id));

    // 3. Update the global state so sorting/views work on the search results
    currentBrowserLocations = []; 
    currentBrowserItems = uniqueResults;
    
    // 4. Render the results to the screen
    renderLocations([]); 
    renderItems(uniqueResults);
}

function handleLocationBarcodeLookup(scannedText) {
    if (!scannedText || !locationsAdmin) return;
    const cleanToken = scannedText.trim().toLowerCase();
    const match = locationsAdmin.find(l => (l.barcode && l.barcode.trim().toLowerCase() === cleanToken) || (l.nfc && l.nfc.trim().toLowerCase() === cleanToken));
    if (match) { document.getElementById("moveItemLocationSelect").value = match.id; executeMoveItem(); }
}

/* =========================================================
   DYNAMIC TAGS & CATEGORIES MANAGEMENT SYSTEM
========================================================= */
function handleSearchFilterTypeChange() {
    const filterType = document.getElementById("searchTypeFilter").value; const pillsRow = document.getElementById("searchFilterPillsRow"); const searchInput = document.getElementById("globalSearchInput");
    activeSearchTags = []; activeSearchCategory = null; 
    if (filterType === "tag" || filterType === "category") { pillsRow.style.display = "flex"; renderSearchFilterPills(filterType); } else { pillsRow.style.display = "none"; pillsRow.innerHTML = ""; } 
    handleGlobalSearch(searchInput.value); 
}

function renderSearchFilterPills(filterType) {
    const pillsRow = document.getElementById("searchFilterPillsRow"); if (!pillsRow) return; pillsRow.innerHTML = "";
    if (filterType === "tag") {
        globalCachedTags.forEach(tag => {
            const pill = document.createElement("span"); pill.className = "tag-pill"; const isActive = activeSearchTags.includes(tag.name);
            pill.style.cssText = "cursor: pointer; user-select: none; transition: all 0.15s ease; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;";
            if (isActive) { pill.style.background = "#004a99"; pill.style.color = "#ffffff"; pill.style.borderColor = "#004a99"; pill.textContent = `✓ ${tag.name}`; } else { pill.style.background = "#f1f5f9"; pill.style.color = "#475569"; pill.style.borderColor = "#e2e8f0"; pill.textContent = `🏷️ ${tag.name}`; }
            pill.onclick = () => { if (activeSearchTags.includes(tag.name)) activeSearchTags = activeSearchTags.filter(t => t !== tag.name); else activeSearchTags.push(tag.name); renderSearchFilterPills("tag"); handleGlobalSearch(document.getElementById("globalSearchInput").value); }; pillsRow.appendChild(pill);
        });
    } else if (filterType === "category") {
        globalCachedCategories.forEach(cat => {
            const pill = document.createElement("span"); pill.className = "tag-pill"; const isActive = activeSearchCategory === cat.name;
            pill.style.cssText = "cursor: pointer; user-select: none; transition: all 0.15s ease; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;";
            if (isActive) { pill.style.background = "#ff8c00"; pill.style.color = "#ffffff"; pill.style.borderColor = "#ff8c00"; pill.textContent = `✓ ${cat.name}`; } else { pill.style.background = "#f1f5f9"; pill.style.color = "#475569"; pill.style.borderColor = "#e2e8f0"; pill.textContent = `📁 ${cat.name}`; }
            pill.onclick = () => { if (activeSearchCategory === cat.name) activeSearchCategory = null; else activeSearchCategory = cat.name; renderSearchFilterPills("category"); handleGlobalSearch(document.getElementById("globalSearchInput").value); }; pillsRow.appendChild(pill);
        });
    }
}

function clickSearchTag(tagName) {
    if (!tagName) return; closeModal('itemDetailsModal'); showPage('pageItems'); 
    const filterSelect = document.getElementById("searchTypeFilter"); if (filterSelect) filterSelect.value = "tag";
    const pillsRow = document.getElementById("searchFilterPillsRow"); if (pillsRow) pillsRow.style.display = "flex";
    activeSearchTags = [tagName]; document.getElementById("globalSearchInput").value = ""; renderSearchFilterPills("tag"); handleGlobalSearch("");
}

function handleTagSelection(mode, tagName) {
    if (!tagName) return; const targetArray = mode === 'add' ? activeSelectedAddTags : activeSelectedEditTags;
    if (!targetArray.includes(tagName)) { targetArray.push(tagName); renderActiveTagPills(mode); }
    document.getElementById(mode === 'add' ? "itemTagSelect" : "editItemTagSelect").value = "";
}

function removeSelectedTagBadge(mode, tagName) {
    if (mode === 'add') activeSelectedAddTags = activeSelectedAddTags.filter(t => t !== tagName); else activeSelectedEditTags = activeSelectedEditTags.filter(t => t !== tagName);
    renderActiveTagPills(mode);
}

function renderActiveTagPills(mode) {
    const container = document.getElementById(mode === 'add' ? "addItemTagsPillsRow" : "editItemTagsPillsRow"); const targetArray = mode === 'add' ? activeSelectedAddTags : activeSelectedEditTags;
    container.innerHTML = "";
    targetArray.forEach(tag => {
        const pill = document.createElement("span"); pill.className = "tag-pill"; pill.style.cssText = "display:inline-flex; align-items:center; gap:6px; background:#e0f2fe; border-color:#bae6fd; color:#0369a1;";
        pill.innerHTML = `${tag} <b style="cursor:pointer; color:#ef4444;">&times;</b>`; pill.querySelector("b").onclick = () => removeSelectedTagBadge(mode, tag); container.appendChild(pill);
    });
}

async function loadTagsAdmin() {
    const data = await localDB.tags.orderBy('name').toArray();
    const tbody = document.getElementById("centralTagsTableBody"); tbody.innerHTML = "";
    if(!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#999; font-style:italic; padding:20px;">No tags in registry</td></tr>`; return; }
    data.forEach(t => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td style="font-weight:600; color:#333;">${t.name}</td><td style="text-align:right; padding-right:15px;"><button class="btn-outline" style="padding:4px 10px; font-size:12px; margin-right:6px;" onclick="openTagModal(false, '${t.id}', '${t.name}')">Edit</button><button class="btn-danger" style="padding:4px 10px; font-size:12px;" onclick="deleteCentralTag('${t.id}')">Delete</button></td>`; 
        tbody.appendChild(tr);
    });
}

async function loadCategoriesAdmin() {
    const data = await localDB.item_categories.orderBy('name').toArray();
    const tbody = document.getElementById("centralCategoriesTableBody"); tbody.innerHTML = "";
    if(!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#999; font-style:italic; padding:20px;">No categories in registry</td></tr>`; return; }
    data.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td style="font-weight:600; color:#333;">${c.name}</td><td style="text-align:right; padding-right:15px;"><button class="btn-outline" style="padding:4px 10px; font-size:12px; margin-right:6px;" onclick="openCategoryModal(false, '${c.id}', '${c.name}')">Edit</button><button class="btn-danger" style="padding:4px 10px; font-size:12px;" onclick="deleteCentralCategory('${c.id}')">Delete</button></td>`; 
        tbody.appendChild(tr);
    });
}

function openTagModal(isSubCall = false, id = null, name = '') { isSubModalContextCall = isSubCall; editingTagTargetId = id; document.getElementById("tagModalTitle").textContent = id ? "Modify Tag Name" : "Add New Tag Label"; document.getElementById("tagModalInput").value = name; document.getElementById("centralTagModal").style.display = "flex"; }


async function saveCentralTag() { 
    const name = document.getElementById("tagModalInput").value.trim(); 
    if (!name) return await customAlert("Please enter a tag label designation.", "Missing Label"); 
    
    // Check local Dexie DB for duplicates first
    const existing = globalCachedTags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing && existing.id !== editingTagTargetId) return await customAlert("Tag already exists.", "Duplicate Error");

    let response;
    if (editingTagTargetId) {
        // UPDATE Existing
        response = await window.offlineSafeWrite('UPDATE', 'tags', { name }, editingTagTargetId);
    } else {
        // CREATE New
        response = await window.offlineSafeWrite('CREATE', 'tags', { name });
    }
    
    if (!response.error) { 
        closeModal('centralTagModal'); 
        logAction("CREATE/UPDATE", "Tag", name, "Modified system tag"); 
        await refreshAllDataFromLocal(); // Instantly update the UI
        if (isSubModalContextCall) { 
            const currentActiveMode = document.getElementById("itemEditModal").style.display === 'flex' ? 'edit' : 'add'; 
            handleTagSelection(currentActiveMode, name); 
        } else { 
            loadTagsAdmin(); 
        } 
    } 
}

async function deleteCentralTag(id) { 
    const tag = globalCachedTags.find(t => t.id === id);
    if (!(await customConfirm("Are you sure? Removing this tag will strip it from any item that uses it.", "Delete Tag?", true))) return; 
    
    const { error } = await window.offlineSafeWrite('DELETE', 'tags', null, id);
    
    if (!error) { 
        logAction("DELETE", "Tag", tag ? tag.name : "Unknown", "Removed system tag"); 
        await refreshAllDataFromLocal(); // Instantly update the UI
        loadTagsAdmin(); 
    } 
}






function openCategoryModal(isSubCall = false, id = null, name = '') { isSubModalContextCall = isSubCall; editingCategoryTargetId = id; document.getElementById("categoryModalTitle").textContent = id ? "Modify Category Classification" : "Add New Item Category"; document.getElementById("categoryModalInput").value = name; document.getElementById("centralCategoryModal").style.display = "flex"; }

async function saveCentralCategory() { 
    const name = document.getElementById("categoryModalInput").value.trim(); 
    if (!name) return await customAlert("Please specify classification name parameter.", "Missing Name"); 
    
    // Check local Dexie DB for duplicates first
    const existing = globalCachedCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing && existing.id !== editingCategoryTargetId) return await customAlert("Category already exists.", "Duplicate Error");

    let response; 
    if (editingCategoryTargetId) {
        response = await window.offlineSafeWrite('UPDATE', 'item_categories', { name }, editingCategoryTargetId); 
    } else {
        response = await window.offlineSafeWrite('CREATE', 'item_categories', { name }); 
    }
    
    if (!response.error) { 
        closeModal('centralCategoryModal'); 
        logAction("CREATE/UPDATE", "Category", name, "Modified classification"); 
        await refreshAllDataFromLocal(); // Instantly update UI
        if (isSubModalContextCall) { 
            const targetSelId = document.getElementById("itemEditModal").style.display === 'flex' ? "editItemCategory" : "itemCategorySelect"; 
            document.getElementById(targetSelId).value = name; 
        } else { 
            loadCategoriesAdmin(); 
        } 
    } 
}

async function deleteCentralCategory(id) { 
    const cat = globalCachedCategories.find(c => c.id === id);
    if (!(await customConfirm("Are you sure you want to drop this classification option?", "Delete Category?", true))) return; 
    
    const { error } = await window.offlineSafeWrite('DELETE', 'item_categories', null, id); 
    
    if (!error) { 
        logAction("DELETE", "Category", cat ? cat.name : "Unknown", "Removed category"); 
        await refreshAllDataFromLocal(); // Instantly update UI
        loadCategoriesAdmin(); 
    } 
}


/* =========================================================
   RAPID QUANTITY ADJUSTER FEATURE
========================================================= */
let currentQtyAdjusterItem = null;

function openQuantityAdjusterModal() {
    currentQtyAdjusterItem = null;
    document.getElementById("qtyAdjusterScanPrompt").style.display = "block"; document.getElementById("qtyAdjusterActiveItem").style.display = "none"; document.getElementById("qtyAdjusterManualBarcode").value = "";
    document.getElementById("quantityAdjusterModal").style.display = "flex";
    openBarcodeScannerModal('FAST_QTY_ADJUST');
}

async function handleQuantityAdjusterLookup(scannedCodeString) {
    if (!scannedCodeString || !scannedCodeString.trim()) return;
    const lowerToken = scannedCodeString.trim().toLowerCase();
    
    const items = await localDB.items.toArray();
    if (!items) return await customAlert("Failed to fetch database.", "Error");

    const match = items.find(item => (item.barcode && item.barcode.trim().toLowerCase() === lowerToken) || (item.nfc_tag && item.nfc_tag.trim().toLowerCase() === lowerToken));
    if (!match) {
        await customAlert(`No inventory item found matching code: [${scannedCodeString}]`, "Item Not Found");
        document.getElementById("qtyAdjusterScanPrompt").style.display = "block"; document.getElementById("qtyAdjusterActiveItem").style.display = "none"; return;
    }

    currentQtyAdjusterItem = match;
    document.getElementById("qtyAdjusterItemName").textContent = match.name; document.getElementById("qtyAdjusterItemBarcode").textContent = match.barcode || match.nfc_tag || "N/A"; document.getElementById("qtyAdjusterValue").value = match.quantity || 0;
    
    document.getElementById("qtyAdjusterScanPrompt").style.display = "none"; document.getElementById("qtyAdjusterActiveItem").style.display = "block";
}

function changeAdjusterQty(amount) {
    const input = document.getElementById("qtyAdjusterValue"); let currentVal = parseInt(input.value) || 0;
    let newVal = currentVal + amount; if (newVal < 0) newVal = 0; input.value = newVal;
}

async function saveQuantityAdjustment(closeAfter) {
    if (!window.isAppOnline) return await customAlert("You must be connected to the internet to adjust quantities.", "Offline Mode");
    if (!currentQtyAdjusterItem) return;
    if (window.isProcessingTransaction) return;
    window.isProcessingTransaction = true;

    const newQty = parseInt(document.getElementById("qtyAdjusterValue").value) || 0;
    try {
        const { error } = await withStatus(() => window.db.from("items").update({ quantity: newQty }).eq("id", currentQtyAdjusterItem.id), "Updating quantity...");
        if (!error) {
            logAction("UPDATE", "Item", currentQtyAdjusterItem.name, `Quantity adjusted: ${currentQtyAdjusterItem.quantity} -> ${newQty} (Fast Adjuster)`);
            await syncAfterWrite();
            if (currentLocationId) await loadLocation(currentLocationId); else await loadRootLocations();

            if (closeAfter) { closeModal('quantityAdjusterModal'); } else { openQuantityAdjusterModal(); }
        }
    } finally { window.isProcessingTransaction = false; }
}


/* =========================================================
   NFC & BARCODE HARDWARE SCANNERS
========================================================= */
let nfcAbortController = null;
let isProcessingNfcScan = false;
let html5QrcodeScannerInstance = null;
let isProcessingScan = false;

async function openNfcScannerModal(targetInputId = null) {
    if (!("NDEFReader" in window)) { await customAlert("NFC scanning requires a secure HTTPS connection. If you are testing on a local IP address or HTTP, Chrome blocks the NFC reader for security.", "Connection Error"); return; }
    window.activeNfcTargetInputId = targetInputId; document.getElementById("nfcScannerModal").style.display = "flex"; isProcessingNfcScan = false;
    try {
        const ndef = new NDEFReader(); nfcAbortController = new AbortController();
        await ndef.scan({ signal: nfcAbortController.signal });
        ndef.onreading = (event) => {
            if (isProcessingNfcScan) return;
            isProcessingNfcScan = true; const decodedText = event.serialNumber;
            if (window.activeNfcTargetInputId === 'FAST_RETURN') { closeNfcScannerModal(); executeFastReturnLookup(decodedText); } 
            else if (window.activeNfcTargetInputId === 'FAST_QTY_ADJUST') { closeNfcScannerModal(); handleQuantityAdjusterLookup(decodedText); }
            else if (window.activeNfcTargetInputId) {
                document.getElementById(window.activeNfcTargetInputId).value = decodedText;
                if (window.activeNfcTargetInputId === 'moveItemLocationBarcode') handleLocationBarcodeLookup(decodedText);
                if (window.activeNfcTargetInputId === 'assignItemBarcode') handleAssignBarcodeLookup(decodedText);
                closeNfcScannerModal();
            } else {
                document.getElementById("globalSearchInput").value = decodedText; const typeFilter = document.getElementById("searchTypeFilter"); if (typeFilter) typeFilter.value = "barcode";
                closeNfcScannerModal(); handleGlobalSearch(decodedText); 
            }
        };
        ndef.onreadingerror = async () => { isProcessingNfcScan = false; await customAlert("Error reading NFC tag. Try shifting it slightly.", "Read Error"); };
    } catch (error) { closeNfcScannerModal(); await customAlert("NFC Scan failed to initialize: " + error.message, "System Error"); }
}
function closeNfcScannerModal() { document.getElementById("nfcScannerModal").style.display = "none"; if (nfcAbortController) { nfcAbortController.abort(); nfcAbortController = null; } isProcessingNfcScan = false; }

function openBarcodeScannerModal(targetInputId = null) {
    document.getElementById("barcodeScannerModal").style.display = "flex"; isProcessingScan = false; window.activeBarcodeTargetInputId = targetInputId;
    html5QrcodeScannerInstance = new Html5Qrcode("scannerReaderContainer");
    html5QrcodeScannerInstance.start( { facingMode: "environment" }, { fps: 15, qrbox: { width: 260, height: 160 }, aspectRatio: 1.333333 },
        (decodedText) => {
            if (isProcessingScan) return; isProcessingScan = true; 
            if (window.activeBarcodeTargetInputId === 'FAST_RETURN') { closeBarcodeScannerModal(); executeFastReturnLookup(decodedText); } 
            else if (window.activeBarcodeTargetInputId === 'FAST_QTY_ADJUST') { closeBarcodeScannerModal(); handleQuantityAdjusterLookup(decodedText); }
            else if (window.activeBarcodeTargetInputId) {
                document.getElementById(window.activeBarcodeTargetInputId).value = decodedText;
                if (window.activeBarcodeTargetInputId === 'moveItemLocationBarcode') handleLocationBarcodeLookup(decodedText);
                if (window.activeBarcodeTargetInputId === 'assignItemBarcode') handleAssignBarcodeLookup(decodedText);
                closeBarcodeScannerModal();
            } else { document.getElementById("globalSearchInput").value = decodedText; const typeFilter = document.getElementById("searchTypeFilter"); if (typeFilter) typeFilter.value = "barcode"; closeBarcodeScannerModal(); handleGlobalSearch(decodedText); }
        }, (errorMessage) => {}
    ).catch(err => { console.warn("Camera failure: ", err); });
}
function closeBarcodeScannerModal() { document.getElementById("barcodeScannerModal").style.display = "none"; if (html5QrcodeScannerInstance) { html5QrcodeScannerInstance.stop().then(() => { html5QrcodeScannerInstance = null; document.getElementById("scannerReaderContainer").innerHTML = ""; isProcessingScan = false; }).catch(err => { html5QrcodeScannerInstance = null; isProcessingScan = false; }); } }


// Controls the fading of the mobile FAB when hitting the bottom of the page
function initFabScrollFade() {
    window.addEventListener('scroll', () => {
        if (window.innerWidth > 768) return;
        const fabContainer = document.getElementById("mobileFabContainer");
        if (!fabContainer) return;
        const scrollPosition = window.scrollY + window.innerHeight;
        const bottomPosition = document.documentElement.scrollHeight;
        if (scrollPosition >= bottomPosition - 30) fabContainer.classList.add('fab-faded');
        else fabContainer.classList.remove('fab-faded');
    }, { passive: true });
}