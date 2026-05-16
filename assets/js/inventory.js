/* =========================================================
   GLOBAL STATE
========================================================= */
let currentItemForActions = null;
let currentLocationId = null;
let locationHistory = [];
let locationsAdmin = [];
let adminLocationView = "hierarchy";
let editingLocationId = null;
let currentLocationAdmin = null;


/* =========================================================
    SETTINGS
========================================================= */
let currentBrowserLocations = [];
let currentBrowserItems = [];

let userSettings = {
    view: 'medium',
    columns: { name: true, quantity: true, barcode: true, nfc: true, category: true, tags: true },
    widths: { name: '30%', quantity: '10%', barcode: '15%', nfc: '15%', category: '15%', tags: '15%' }
};

async function getSettingsKey() {
    try {
        const { data: { session } } = await window.db.auth.getSession();
        if (session?.user) return `warm_inventory_settings_${session.user.id}`;
    } catch(e) {}
    return `warm_inventory_settings_default`;
}

async function saveInventorySettings() {
    const key = await getSettingsKey();
    localStorage.setItem(key, JSON.stringify(userSettings));
}

async function loadInventorySettings() {
    const key = await getSettingsKey();
    const saved = localStorage.getItem(key);
    if (saved) userSettings = JSON.parse(saved);
    
    // Apply default view to dropdown selection list
    const select = document.querySelector("#pageItems .items-toolbar select");
    if (select) select.value = userSettings.view;
    changeItemsView(userSettings.view);
}

/* =========================================================
    INITIALIZATION
========================================================= */    

function initInventory() {
    initStatusIndicator();
    loadInventorySettings();
    loadRootLocations();
    loadLocationDropdown();
}

/* =========================================================
   TAB & PAGE NAVIGATION
========================================================= */
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll(".inventory-page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    
    // Show selected page
    const page = document.getElementById(pageId);
    if (page) page.classList.add("active");

    // Activate corresponding tab
    const tabMap = { 'pageItems': 'tab-items', 'pageLocations': 'tab-locations', 'pageSettings': 'tab-settings' };
    const tab = document.getElementById(tabMap[pageId]);
    if (tab) tab.classList.add("active");

    // Load data based on page
    if (pageId === "pageItems") loadRootLocations();
    if (pageId === "pageLocations") loadLocationsAdmin();
}

/* =========================================================
   ITEMS BROWSER LOGIC (UPDATED FOR UNIFIED TABLE VIEW)
========================================================= */
async function loadRootLocations() {
    currentLocationId = null;
    locationHistory = [];
    document.getElementById("locationBackBtn").style.display = "none";
    document.getElementById("breadcrumb").innerText = "Items";

    const { data: realLocations } = await withStatus(
        () => window.db.from("locations").select("*").is("parent_id", null),
        "Loading folders..."
    );

    // Save globally so the table view can read both folders and items
    currentBrowserLocations = [...(realLocations || []), { id: "unallocated", name: "Unallocated Items" }];
    currentBrowserItems = [];
    
    renderLocations(currentBrowserLocations);
    renderItems(currentBrowserItems);
}

async function loadLocation(id) {
    document.getElementById("locationBackBtn").style.display = "inline-block";
    const { data: loc } = await window.db.from("locations").select("*").eq("id", id).single();
    if (loc) buildBreadcrumb(loc);

    const { data: children } = await window.db.from("locations").select("*").eq("parent_id", id);
    const { data: items } = await window.db.from("items").select("*, photos(file_path)").eq("location_id", id);

    // Save globally so the table view can merge them
    currentBrowserLocations = children || [];
    currentBrowserItems = items || [];
    
    renderLocations(currentBrowserLocations);
    renderItems(currentBrowserItems);
}

function navigateToLocation(id) {
    if (id === "unallocated") { 
        currentLocationId = "unallocated"; 
        loadUnallocatedItems(); 
        return; 
    }
    if (currentLocationId && currentLocationId !== "unallocated") locationHistory.push(currentLocationId);
    currentLocationId = id;
    loadLocation(id);
}

function goBack() {
    if (locationHistory.length === 0) { loadRootLocations(); return; }
    currentLocationId = locationHistory.pop();
    loadLocation(currentLocationId);
}

async function loadUnallocatedItems() {
    document.getElementById("locationBackBtn").style.display = "inline-block";
    document.getElementById("breadcrumb").innerText = "Items > Unallocated";
    
    // Unallocated view has no folders, only items
    currentBrowserLocations = [];
    const { data: items } = await window.db.from("items").select("*, photos(file_path)").is("location_id", null);
    currentBrowserItems = items || [];
    
    renderLocations([]);
    renderItems(currentBrowserItems);
}

async function buildBreadcrumb(location) {
    let chain = [location];
    let parentId = location.parent_id;
    while (parentId) {
        const { data: parent } = await window.db.from("locations").select("*").eq("id", parentId).single();
        if (parent) { chain.unshift(parent); parentId = parent.parent_id; } 
        else break;
    }
    document.getElementById("breadcrumb").innerText = "Items > " + chain.map(l => l.name).join(" > ");
}
/* =========================================================
   MANAGEMENT LOGIC (ADMIN)
========================================================= */
async function loadLocationsAdmin() {
    const { data, error } = await withStatus(
        () => window.db.from("locations").select("*"),
        "Loading locations..."
    );
    if (!error) {
        locationsAdmin = data.map(l => ({ id: l.id, name: l.name, parent: l.parent_id, barcode: l.barcode, nfc: l.nfc_tag, photo: l.photo_path }));
        refreshLocationAdmin();
    }
}

function refreshLocationAdmin() {
    if (adminLocationView === "hierarchy") {
        if (!currentLocationAdmin) loadRootLocationsAdmin();
        else loadLocationAdmin(currentLocationAdmin);
    } else { loadFlatLocationsAdmin(); }
}

function loadRootLocationsAdmin() {
    currentLocationAdmin = null;
    document.getElementById("breadcrumbLocations").textContent = "Locations";
    document.getElementById("locationBackBtnAdmin").style.display = "none";
    renderLocationTilesAdmin(locationsAdmin.filter(l => !l.parent));
}

function loadLocationAdmin(id) {
    currentLocationAdmin = id;
    document.getElementById("breadcrumbLocations").textContent = buildLocationPath(id);
    document.getElementById("locationBackBtnAdmin").style.display = "inline-block";
    renderLocationTilesAdmin(locationsAdmin.filter(l => l.parent === id));
}

function goBackLocationAdmin() {
    if (!currentLocationAdmin) return loadRootLocationsAdmin();
    const loc = locationsAdmin.find(l => l.id === currentLocationAdmin);
    if (!loc || !loc.parent) return loadRootLocationsAdmin();
    loadLocationAdmin(loc.parent);
}

function loadFlatLocationsAdmin() {
    currentLocationAdmin = null;
    document.getElementById("breadcrumbLocations").textContent = "All Locations";
    document.getElementById("locationBackBtnAdmin").style.display = "none";
    const list = locationsAdmin.map(l => ({ ...l, fullPath: buildLocationPath(l.id) })).sort((a, b) => a.fullPath.localeCompare(b.fullPath));
    renderLocationTilesAdmin(list);
}

function buildLocationPath(id) {
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

/* =========================================================
   RENDERING ENGINE
========================================================= */
function renderLocations(locations) {
    const container = document.getElementById("locationTiles");
    container.innerHTML = "";
    locations.forEach(loc => {
        const tile = document.createElement("div");
        tile.className = "item-card location-card"; 
        tile.innerHTML = `
            <div class="item-card-photo-wrapper"><img src="../assets/images/folder-icon.jpg"></div>
            <div class="item-card-qty-badge" style="background:#ff8c00;">Folder</div>
            <div class="item-card-name">${loc.name}</div>
        `;
        tile.onclick = () => navigateToLocation(loc.id);
        container.appendChild(tile);
    });
}

function renderItems(items) {
    const container = document.getElementById("itemTiles");
    const tableContainer = document.getElementById("itemsTableWrapper");
    container.innerHTML = "";
    tableContainer.innerHTML = "";

    // 1. Build out the standard Grid items view context cards
    if (items && items.length > 0) {
        items.forEach(item => {
            const card = document.createElement("div");
            card.className = "item-card";
            let imgUrl = "../assets/images/no-image.jpg";
            if (item.photos?.length) imgUrl = window.db.storage.from("item-photos").getPublicUrl(item.photos[0].file_path).data.publicUrl;
            card.innerHTML = `
                <div class="item-card-photo-wrapper"><img src="${imgUrl}"></div>
                <div class="item-card-qty-badge">Qty: ${item.quantity}</div>
                <div class="item-card-cog" onclick="openItemActions(event, '${item.id}')">⚙️</div>
                <div class="item-card-name">${item.name}</div>
            `;
            card.onclick = () => openItemDetails(item);
            container.appendChild(card);
        });
    }

    // 2. Combine Active Folders and Active Items into a unified List data structure
    const combinedList = [];
    if (currentBrowserLocations && currentBrowserLocations.length > 0) {
        currentBrowserLocations.forEach(loc => {
            combinedList.push({
                isLocation: true, id: loc.id, name: loc.name,
                barcode: loc.barcode || '', nfc_tag: loc.nfc || '', category: loc.category || 'storage', tags: ''
            });
        });
    }
    if (items && items.length > 0) {
        items.forEach(item => {
            combinedList.push({
                isLocation: false, id: item.id, name: item.name, quantity: item.quantity,
                barcode: item.barcode || '', nfc_tag: item.nfc_tag || '', category: item.category || '—',
                tags: item.tags ? (Array.isArray(item.tags) ? item.tags.join(', ') : JSON.stringify(item.tags)) : '—',
                rawItem: item
            });
        });
    }

    const c = userSettings.columns;
    const w = userSettings.widths;

    // 3. Assemble the Table View framework layout inside layout wrapper
    tableContainer.innerHTML = `
        <button class="col-picker-btn" onclick="toggleColumnMenu(event, 'itemColMenu')">⚙️ Columns</button>
        <div id="itemColMenu" class="col-picker-menu">
            <label><input type="checkbox" ${c.name ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'name', 0, this.checked)"> Name</label>
            <label><input type="checkbox" ${c.quantity ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'quantity', 1, this.checked)"> Quantity</label>
            <label><input type="checkbox" ${c.barcode ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'barcode', 2, this.checked)"> Barcode</label>
            <label><input type="checkbox" ${c.nfc ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'nfc', 3, this.checked)"> NFC Tag</label>
            <label><input type="checkbox" ${c.category ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'category', 4, this.checked)"> Category</label>
            <label><input type="checkbox" ${c.tags ? 'checked' : ''} onchange="toggleTableColumn('itemsTable', 'tags', 5, this.checked)"> Tags</label>
        </div>
        <table class="custom-table" id="itemsTable">
            <thead>
                <tr>
                    <th style="width: ${w.name}; display: ${c.name ? '' : 'none'};">Name <div class="col-resizer"></div></th>
                    <th style="width: ${w.quantity}; display: ${c.quantity ? '' : 'none'};">Quantity <div class="col-resizer"></div></th>
                    <th style="width: ${w.barcode}; display: ${c.barcode ? '' : 'none'};">Barcode <div class="col-resizer"></div></th>
                    <th style="width: ${w.nfc}; display: ${c.nfc ? '' : 'none'};">NFC Tag <div class="col-resizer"></div></th>
                    <th style="width: ${w.category}; display: ${c.category ? '' : 'none'};">Category <div class="col-resizer"></div></th>
                    <th style="width: ${w.tags}; display: ${c.tags ? '' : 'none'};">Tags <div class="col-resizer"></div></th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    const tbody = tableContainer.querySelector("tbody");

    if (combinedList.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="6" style="text-align: center; color: #999; padding: 30px; font-style: italic;">Empty location directory context</td>`;
        tbody.appendChild(tr);
    } else {
        combinedList.forEach(row => {
            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";
            
            if (row.isLocation) {
                tr.onclick = () => navigateToLocation(row.id);
                tr.innerHTML = `
                    <td style="font-weight:700; color: #ff8c00; display: ${c.name ? '' : 'none'};">📦 ${row.name}</td>
                    <td style="color: #999; font-style: italic; display: ${c.quantity ? '' : 'none'};">— (Folder)</td>
                    <td style="display: ${c.barcode ? '' : 'none'};">${row.barcode || '—'}</td>
                    <td style="display: ${c.nfc ? '' : 'none'};">${row.nfc_tag || '—'}</td>
                    <td style="text-transform: capitalize; display: ${c.category ? '' : 'none'};">${row.category || '—'}</td>
                    <td style="color: #999; display: ${c.tags ? '' : 'none'};">—</td>
                `;
            } else {
                tr.onclick = () => openItemDetails(row.rawItem);
                tr.innerHTML = `
                    <td style="font-weight:600; display: ${c.name ? '' : 'none'};">🔹 ${row.name}</td>
                    <td style="display: ${c.quantity ? '' : 'none'};">${row.quantity}</td>
                    <td style="display: ${c.barcode ? '' : 'none'};">${row.barcode || '—'}</td>
                    <td style="display: ${c.nfc ? '' : 'none'};">${row.nfc_tag || '—'}</td>
                    <td style="display: ${c.category ? '' : 'none'};">${row.category || '—'}</td>
                    <td style="display: ${c.tags ? '' : 'none'};">${row.tags}</td>
                `;
            }
            tbody.appendChild(tr);
        });

        initResizableColumns(document.getElementById("itemsTable"));
    }
}

function renderLocationTilesAdmin(list) {
    const container = document.getElementById("locationTilesAdmin");
    if (!container) return;
    container.innerHTML = "";
    list.forEach(loc => {
        const div = document.createElement("div");
        div.className = "item-card location-card";
        let imgSrc = "../assets/images/folder-icon.jpg";
        if (loc.photo) imgSrc = window.db.storage.from("location-photos").getPublicUrl(loc.photo).data.publicUrl;
        div.innerHTML = `
            <div class="cog" onclick="openLocationActions('${loc.id}');event.stopPropagation();">⚙️</div>
            <div class="item-card-photo-wrapper"><img src="${imgSrc}"></div>
            <div class="item-card-name">${adminLocationView === "flat" ? loc.fullPath : loc.name}</div>
        `;
        if (adminLocationView === "hierarchy") div.onclick = () => loadLocationAdmin(loc.id);
        container.appendChild(div);
    });
}

/* =========================================================
   ITEM ACTIONS
========================================================= */
async function addItem() {
    const name = document.getElementById("itemName").value;
    const quantity = parseInt(document.getElementById("itemQuantity").value) || 0;
    const selectEl = document.getElementById("itemLocationSelect");
    
    // Convert an empty selection "" into a proper database null
    const location_id = selectEl.value === "" ? null : selectEl.value;

    if (!name) return alert("Please enter an item name");

    const { error } = await withStatus(
        () => window.db.from("items").insert([{ name, quantity, location_id }]),
        "Adding new item..."
    );

    if (!error) {
        closeAddItemModal();
        
        // Refresh the layout based on where the user currently is
        if (currentLocationId) {
            loadLocation(currentLocationId);
        } else {
            loadRootLocations();
        }
    }
}

async function actionDeleteItem() {
    // 1. Ensure we actually have an active item selected
    if (!currentItemForActions || !currentItemForActions.id) {
        return alert("Error: No item selected for deletion.");
    }

    // 2. Double-check with a confirmation prompt
    if (!confirm("Are you sure you want to permanently delete this item? This cannot be undone.")) {
        return;
    }

    // 3. Delete from the Supabase 'items' table
    const { error } = await withStatus(
        () => window.db.from("items").delete().eq("id", currentItemForActions.id),
        "Deleting item..."
    );

    if (!error) {
        // 4. Close the modal on success
        closeItemActionsModal();
        
        // 5. Refresh the list based on where you currently are standing
        if (currentLocationId) {
            loadLocation(currentLocationId);
        } else {
            loadRootLocations();
        }
    }
}

/* =========================================================
   RICH ITEM MODALS: VIEWER & EDIT LOGIC
========================================================= */

// 1. POPULATE READ-ONLY VIEW DETAILS MODAL
function openItemDetails(item) {
    currentItemForActions = item; // Store item reference

    document.getElementById("detailItemName").textContent = item.name;
    document.getElementById("detailItemQtyBadge").textContent = "Qty: " + item.quantity;
    document.getElementById("detailItemDescription").textContent = item.description || "No description provided.";
    document.getElementById("detailItemBarcode").textContent = item.barcode || "—";
    document.getElementById("detailItemNFC").textContent = item.nfc_tag || "—";

    // Dynamic resolution of parent locations chain via cached lookups
    document.getElementById("detailItemLocation").textContent = item.location_id ? "📍 " + buildLocationPath(item.location_id) : "📍 Unallocated Items";

    // Resolve storage public URL for images
    const imgEl = document.getElementById("detailItemImage");
    if (item.photos && item.photos.length > 0) {
        imgEl.src = window.db.storage.from("item-photos").getPublicUrl(item.photos[0].file_path).data.publicUrl;
    } else {
        imgEl.src = "../assets/images/no-image.jpg";
    }

    // Process Tags array to create individual pills
    const tagsContainer = document.getElementById("detailItemTagsContainer");
    tagsContainer.innerHTML = "";
    
    let tagArray = [];
    if (Array.isArray(item.tags)) tagArray = item.tags;
    else if (typeof item.tags === 'string' && item.tags.trim()) tagArray = item.tags.split(',').map(t => t.trim());

    if (tagArray.length > 0) {
        tagArray.forEach(tag => {
            const span = document.createElement("span");
            span.className = "tag-pill";
            span.textContent = tag;
            tagsContainer.appendChild(span);
        });
    } else {
        tagsContainer.innerHTML = `<span style="color:#999; font-style:italic; font-size:13px;">No tags assigned</span>`;
    }

    document.getElementById("itemDetailsModal").style.display = "flex";
}

// 2. SWITCH VIEW MODE TO MANAGEMENT FORM STATE
async function switchToItemEdit() {
    if (!currentItemForActions) return;
    closeModal('itemDetailsModal');

    const item = currentItemForActions;

    // Direct string field values binding
    document.getElementById("editItemName").value = item.name || "";
    document.getElementById("editItemQuantity").value = item.quantity || 0;
    document.getElementById("editItemDescription").value = item.description || "";
    document.getElementById("editItemBarcode").value = item.barcode || "";
    document.getElementById("editItemNFC").value = item.nfc_tag || "";
    document.getElementById("editItemCategory").value = item.category || "tools";

    // Turn array format parameters into a comma separated layout for input editing
    if (Array.isArray(item.tags)) document.getElementById("editItemTags").value = item.tags.join(", ");
    else document.getElementById("editItemTags").value = item.tags || "";

    // Sync active location dropdown items list choice parameters
    const { data } = await window.db.from("locations").select("id, name");
    const select = document.getElementById("editItemLocationSelect");
    select.innerHTML = '<option value="">No Location (Unallocated)</option>' + 
        (data ? data.map(l => `<option value="${l.id}">${l.name}</option>`).join("") : "");
    select.value = item.location_id || "";

    // Sync image state view preview targets
    const previewImg = document.getElementById("editItemPreview");
    if (item.photos && item.photos.length > 0) {
        previewImg.src = window.db.storage.from("item-photos").getPublicUrl(item.photos[0].file_path).data.publicUrl;
    } else {
        previewImg.src = "../assets/images/no-image.jpg";
    }

    document.getElementById("itemEditModal").style.display = "flex";
}

// 3. PERSIST ITEM EDITS INTO SUPABASE TABLE
async function saveItemEdits() {
    if (!currentItemForActions || !currentItemForActions.id) return;

    const itemId = currentItemForActions.id;
    const photoFile = document.getElementById("editItemPhotoInput").files[0];

    // 1. HANDLE PHOTO UPLOAD / DELETION
    if (photoFile) {
        const fileName = `item-${itemId}-${Date.now()}`;
        
        // Upload binary file to the 'item-photos' storage bucket
        const { error: uploadError } = await window.db.storage.from("item-photos").upload(fileName, photoFile);
        
        if (!uploadError) {
            // Wipe old photo entries for this item first to maintain 1 primary picture
            await window.db.from("photos").delete().eq("item_id", itemId);
            // Insert the new picture reference row
            await window.db.from("photos").insert([{ item_id: itemId, file_path: fileName }]);
        }
    } else if (window.itemPhotoDeleted) {
        // If the user clicked "Remove", clear references out of the database completely
        await window.db.from("photos").delete().eq("item_id", itemId);
    }

    // 2. PREPARE THE REST OF THE ITEM DATA
    const tagsInput = document.getElementById("editItemTags").value;
    const tagsArray = tagsInput.split(',').map(t => t.trim()).filter(t => t !== "");

    const payload = {
        name: document.getElementById("editItemName").value,
        quantity: parseInt(document.getElementById("editItemQuantity").value) || 0,
        location_id: document.getElementById("editItemLocationSelect").value || null,
        description: document.getElementById("editItemDescription").value,
        barcode: document.getElementById("editItemBarcode").value,
        nfc_tag: document.getElementById("editItemNFC").value,
        category: document.getElementById("editItemCategory").value,
        tags: tagsArray
    };

    // 3. PERSIST ITEM TEXT ATTRIBUTES
    const { error } = await withStatus(
        () => window.db.from("items").update(payload).eq("id", itemId),
        "Updating item details..."
    );

    if (!error) {
        window.itemPhotoDeleted = false; // Reset the deletion flag on success
        closeModal('itemEditModal');
        
        if (currentLocationId) loadLocation(currentLocationId);
        else loadRootLocations();
    }
}

// 4. PERMANENT INDIVIDUAL ITEM REMOVAL HANDLER
async function attemptDeleteItem() {
    if (!currentItemForActions || !currentItemForActions.id) return;

    if (!confirm("Are you sure you want to permanently delete this item? This operation cannot be undone.")) return;

    const { error } = await withStatus(
        () => window.db.from("items").delete().eq("id", currentItemForActions.id),
        "Removing item from system..."
    );

    if (!error) {
        closeModal('itemEditModal');
        if (currentLocationId) loadLocation(currentLocationId);
        else loadRootLocations();
    }
}

// 5. PICTURE STUDS CLEAN ROUTINES
function deleteItemPhoto() {
    document.getElementById('editItemPreview').src = "../assets/images/no-image.jpg";
    document.getElementById('editItemPhotoInput').value = "";
    window.itemPhotoDeleted = true;
}

/* =========================================================
   MODAL CONTROLS
========================================================= */
function openAddItemModal() { 
    // 1. Reset text inputs so it's clean for the next item
    document.getElementById("itemName").value = "";
    document.getElementById("itemQuantity").value = "";
    
    // 2. Automatically select the active folder location in the dropdown list
    const selectEl = document.getElementById("itemLocationSelect");
    if (selectEl) {
        if (currentLocationId && currentLocationId !== "unallocated") {
            selectEl.value = currentLocationId;
        } else {
            selectEl.value = ""; // Default to "No Location" if at root or unallocated
        }
    }
    
    document.getElementById("addItemModal").style.display = "flex"; 
}

function closeAddItemModal() { 
    // Clean fields on exit
    document.getElementById("itemName").value = "";
    document.getElementById("itemQuantity").value = "";
    document.getElementById("addItemModal").style.display = "none"; 
}


function closeItemActionsModal() { document.getElementById("itemActionsModal").style.display = "none"; }
function openItemActions(event, itemId) { event.stopPropagation(); currentItemForActions = { id: itemId }; document.getElementById("itemActionsModal").style.display = "flex"; }
function openItemActionsFromDetails() { closeItemDetailsModal(); document.getElementById("itemActionsModal").style.display = "flex"; }

// OPEN EDIT MODAL - Load existing data into the fields
function openLocationActions(id) {
    editingLocationId = id;
    const loc = locationsAdmin.find(l => l.id === id);
    if (!loc) return;

    document.getElementById("locationActionsName").textContent = loc.name;
    document.getElementById("editLocationName").value = loc.name || "";
    document.getElementById("editLocationDescription").value = loc.location_description || "";
    document.getElementById("editLocationBarcode").value = loc.barcode || "";
    document.getElementById("editLocationNFC").value = loc.nfc || "";
    document.getElementById("editLocationCategory").value = loc.category || "storage";

    document.getElementById("locationActionsModal").style.display = "flex";
}

// SAVE EDITS - Syncs updated fields back to the table
async function saveLocationEdits() {
    if (!editingLocationId) return;

    const payload = {
        name: document.getElementById("editLocationName").value,
        location_description: document.getElementById("editLocationDescription").value,
        barcode: document.getElementById("editLocationBarcode").value,
        nfc_tag: document.getElementById("editLocationNFC").value,
        category: document.getElementById("editLocationCategory").value
    };

    const { error } = await withStatus(
        () => window.db.from("locations").update(payload).eq("id", editingLocationId),
        "Saving changes..."
    );

    if (!error) {
        closeModal('locationActionsModal');
        loadLocationsAdmin();
    }
}

function confirmCancel(modalId) {
    if (confirm("Are you sure? Any unsaved changes will be lost.")) {
        closeModal(modalId);
    }
}

// Function to preview image locally before uploading
function previewLocationImage(input, previewId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById(previewId).src = e.target.result;
        reader.readAsDataURL(input.files[0]);
    }
}

// Logic to clear photo (UI only, saved on 'Save')
function deleteLocationPhoto() {
    document.getElementById('editLocationPreview').src = "../assets/images/folder-icon.jpg";
    document.getElementById('editLocationPhotoInput').value = ""; // Clear file input
    // We can use a flag to tell the save function to delete the photo in DB
    window.locationPhotoDeleted = true; 
}



/* =========================================================
   MANAGE LOCATIONS: CORE LOGIC
========================================================= */

// OPEN ADD MODAL - Clear all fields first
function openAddLocationModal() {
    const fields = ["addLocationName", "addLocationDescription", "addLocationBarcode", "addLocationNFC"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    
    const cat = document.getElementById("addLocationCategory");
    if (cat) cat.value = "storage";

    document.getElementById("addLocationModal").style.display = "flex";
}

// CREATE FOLDER - Syncs all fields to Supabase
async function addLocation() {
    const name = document.getElementById("addLocationName").value;
    const description = document.getElementById("addLocationDescription").value;
    const barcode = document.getElementById("addLocationBarcode").value;
    const nfc = document.getElementById("addLocationNFC").value;
    const category = document.getElementById("addLocationCategory").value;

    if (!name) return alert("Please enter a folder name");

    const { error } = await withStatus(
        () => window.db.from("locations").insert([{ 
            name, 
            location_description: description, // Matches your SB table
            barcode,
            nfc_tag: nfc,
            category,
            parent_id: currentLocationAdmin 
        }]),
        "Creating folder..."
    );

    if (!error) {
        closeModal('addLocationModal');
        loadLocationsAdmin();
    }
}



// DELETE LOCATION
async function attemptDeleteLocation() {
    if (!editingLocationId) return;

    // Check children first (prevent orphans)
    const hasChildren = locationsAdmin.some(l => l.parent === editingLocationId);
    if (hasChildren) return alert("Cannot delete: This folder contains sub-folders.");

    // Check items
    const { data: items } = await window.db.from("items").select("id").eq("location_id", editingLocationId).limit(1);
    if (items && items.length > 0) return alert("Cannot delete: This folder contains items.");

    if (!confirm("Are you sure? This cannot be undone.")) return;

    const { error } = await withStatus(
        () => window.db.from("locations").delete().eq("id", editingLocationId),
        "Deleting folder..."
    );

    if (!error) {
        closeModal('locationActionsModal');
        loadLocationsAdmin();
    }
}


// UI HELPERS
function closeModal(id) { 
    document.getElementById(id).style.display = "none"; 
    
    // If leaving the Add Location modal, fully clear all parameters
    if (id === 'addLocationModal') {
        const fields = ["addLocationName", "addLocationDescription", "addLocationBarcode", "addLocationNFC"];
        fields.forEach(fieldId => {
            const el = document.getElementById(fieldId);
            if (el) el.value = "";
        });
        
        const cat = document.getElementById("addLocationCategory");
        if (cat) cat.value = "storage";
        
        const img = document.getElementById("addLocationPreview");
        if (img) img.src = "../assets/images/folder-icon.jpg";
        
        const fileInput = document.getElementById("addLocationPhotoInput");
        if (fileInput) fileInput.value = "";
    }
}



function deleteLocationPhoto() {
    document.getElementById('editLocationPreview').src = "../assets/images/folder-icon.jpg";
    document.getElementById('editLocationPhotoInput').value = "";
    window.locationPhotoDeleted = true;
}

/* =========================================================
   SEARCH & VIEWS
========================================================= */
async function handleGlobalSearch(term) {
    if (!term.trim()) { loadRootLocations(); return; }
    document.getElementById("breadcrumb").innerText = `Search: ${term}`;
    renderLocations([]);
    const { data: items } = await window.db.from("items").select("*, photos(file_path)").or(`name.ilike.%${term}%,barcode.ilike.%${term}%`);
    renderItems(items || []);
}

function changeItemsView(view) { document.getElementById("pageItems").className = `inventory-page active items-view-${view}`; userSettings.view = view; saveInventorySettings();}
function changeLocationsView(view) { document.getElementById("pageLocations").className = `inventory-page active items-view-${view}`; }
function changeAdminLocationView(view) { adminLocationView = view; refreshLocationAdmin(); }

/* =========================================================
   STATUS INDICATOR
========================================================= */
let statusBox = null;
function initStatusIndicator() {
    statusBox = document.createElement("div"); statusBox.className = "status-indicator";
    document.body.appendChild(statusBox); setStatus("connected", "Connected");
}
function setStatus(mode, msg) {
    if (!statusBox) return;
    statusBox.style.background = mode === "syncing" ? "#ff8c00" : (mode === "error" ? "#ef4444" : "#22c55e");
    statusBox.textContent = msg;
}
async function withStatus(fn, label) {
    setStatus("syncing", label);
    try { const r = await fn(); setStatus("connected", "Connected"); return r; }
    catch (e) { setStatus("error", "Error"); throw e; }
}

async function loadLocationDropdown() {
    const { data } = await window.db.from("locations").select("id, name");
    const select = document.getElementById("itemLocationSelect");
    select.innerHTML = '<option value="">No Location</option>' + data.map(l => `<option value="${l.id}">${l.name}</option>`).join("");
}

/* =========================================================
   CUSTOMISABLE RESIZABLE TABLE HELPERS
========================================================= */

// Column Show/Hide Engine
function toggleTableColumn(tableId, colKey, colIndex, isVisible) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const displayValue = isVisible ? "" : "none";
    
    const th = table.querySelectorAll("thead th")[colIndex];
    if (th) th.style.display = displayValue;
    
    table.querySelectorAll("tbody tr").forEach(tr => {
        const td = tr.children[colIndex];
        if (td) td.style.display = displayValue;
    });

    userSettings.columns[colKey] = isVisible;
    saveInventorySettings();
}

function toggleColumnMenu(event, menuId) {
    event.stopPropagation();
    const menu = document.getElementById(menuId);
    const isShowing = menu.style.display === "flex";
    
    // Hide all column picking menus first
    document.querySelectorAll('.col-picker-menu').forEach(m => m.style.display = "none");
    menu.style.display = isShowing ? "none" : "flex";
    
    // Auto-close menu if user clicks anywhere else outside
    document.onclick = () => menu.style.display = "none";
    menu.onclick = (e) => e.stopPropagation();
}

// Interactive Live Column Width Resizing Handler
function initResizableColumns(table) {
    if (!table) return;
    const cols = table.querySelectorAll("thead th");
    
    cols.forEach((col, idx) => {
        const resizer = col.querySelector(".col-resizer");
        if (!resizer) return;
        
        resizer.addEventListener("mousedown", function(e) {
            e.preventDefault();
            resizer.classList.add("resizing");
            const startX = e.pageX;
            const startWidth = col.offsetWidth;
            
            function onMouseMove(moveEvent) {
                const currentWidth = startWidth + (moveEvent.pageX - startX);
                if (currentWidth > 60) col.style.width = currentWidth + "px";
            }
            
            function onMouseUp() {
                resizer.classList.remove("resizing");
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                
                // Track current configurations map onto local objects schema mapping
                const colKeys = ['name', 'quantity', 'barcode', 'nfc', 'category', 'tags'];
                const updatedCols = table.querySelectorAll("thead th");
                updatedCols.forEach((th, i) => {
                    if (colKeys[i]) userSettings.widths[colKeys[i]] = th.style.width || th.offsetWidth + "px";
                });
                saveInventorySettings();
            }
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
    });
}