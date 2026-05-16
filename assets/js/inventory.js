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
let globalCachedTags = [];
let globalCachedCategories = [];
let activeSelectedAddTags = [];
let activeSelectedEditTags = [];

let editingTagTargetId = null;
let editingCategoryTargetId = null;
let isSubModalContextCall = false;

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
     reloadGlobalFormCaches(); // Preloads dynamic tags & category options
     loadLocationsAdmin();     // Preloads central folder hierarchy map cache
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
    const tabMap = { 'pageItems': 'tab-items', 'pageLocations': 'tab-locations', 'pageSettings': 'tab-settings', 'pageTags': 'tab-tags', 'pageCategories': 'tab-categories' };
    const tab = document.getElementById(tabMap[pageId]);
    if (tab) tab.classList.add("active");

    // Load data based on page
   if (pageId === "pageItems") loadRootLocations();
if (pageId === "pageLocations") loadLocationsAdmin();
if (pageId === "pageTags") loadTagsAdmin();
if (pageId === "pageCategories") loadCategoriesAdmin();
}

/* =========================================================
   ITEMS BROWSER LOGIC (UPDATED FOR UNIFIED TABLE VIEW)
========================================================= */
async function loadRootLocations() {
    currentLocationId = null;
    locationHistory = [];
    
    const container = document.getElementById("breadcrumb");
    if (container) container.innerHTML = '<span class="breadcrumb-link active">Items</span>';

    const { data: realLocations } = await withStatus(
        () => window.db.from("locations").select("*").is("parent_id", null),
        "Loading folders..."
    );

    currentBrowserLocations = [...(realLocations || []), { id: "unallocated", name: "Unallocated Items" }];
    currentBrowserItems = [];
    renderLocations(currentBrowserLocations);
    renderItems(currentBrowserItems);
}

async function loadLocation(id) {
    const { data: loc } = await window.db.from("locations").select("*").eq("id", id).single();
    if (loc) buildBreadcrumb(loc);

    const { data: children } = await window.db.from("locations").select("*").eq("parent_id", id);
    const { data: items } = await window.db.from("items").select("*, photos(file_path)").eq("location_id", id);

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
    currentLocationId = id;
    loadLocation(id);
}

async function loadUnallocatedItems() {
    const container = document.getElementById("breadcrumb");
    if (container) {
        container.innerHTML = `
            <span class="breadcrumb-link" onclick="loadRootLocations()">Items</span>
            <span class="breadcrumb-separator"> > </span>
            <span class="breadcrumb-link active">Unallocated Items</span>
        `;
    }
    
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

    // Recalculate historical back-steps implicitly based on the active path node
    locationHistory = chain.slice(0, -1).map(l => l.id);

    const container = document.getElementById("breadcrumb");
    if (!container) return;
    container.innerHTML = "";

    // 1. Append Base Root Node
    const rootLink = document.createElement("span");
    rootLink.className = "breadcrumb-link";
    rootLink.textContent = "Items";
    rootLink.onclick = () => loadRootLocations();
    container.appendChild(rootLink);

    // 2. Map Dynamic Intermediary Chain Nodes
    chain.forEach((l, idx) => {
        const sep = document.createElement("span");
        sep.className = "breadcrumb-separator";
        sep.textContent = " > ";
        container.appendChild(sep);

        const link = document.createElement("span");
        link.className = "breadcrumb-link";
        link.textContent = l.name;

        if (idx === chain.length - 1) {
            link.classList.add("active");
        } else {
            link.onclick = () => {
                currentLocationId = l.id;
                loadLocation(l.id);
            };
        }
        container.appendChild(link);
    });
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
    if (container) {
        container.innerHTML = `
            <span class="breadcrumb-link" onclick="loadRootLocationsAdmin()">Locations</span>
            <span class="breadcrumb-separator"> > </span>
            <span class="breadcrumb-link active">All Locations</span>
        `;
    }
    const list = locationsAdmin.map(l => ({ ...l, fullPath: buildLocationPath(l.id) })).sort((a, b) => a.fullPath.localeCompare(b.fullPath));
    renderLocationTilesAdmin(list);
}

function buildAdminBreadcrumb(id) {
    const container = document.getElementById("breadcrumbLocations");
    if (!container) return;
    container.innerHTML = "";

    const rootLink = document.createElement("span");
    rootLink.className = "breadcrumb-link";
    rootLink.textContent = "Locations";
    rootLink.onclick = () => loadRootLocationsAdmin();
    container.appendChild(rootLink);

    let loc = locationsAdmin.find(l => l.id === id);
    if (!loc) return;

    let chain = [loc];
    while (loc.parent) {
        loc = locationsAdmin.find(l => l.id === loc.parent);
        if (!loc) break;
        chain.unshift(loc);
    }

    chain.forEach((l, idx) => {
        const sep = document.createElement("span");
        sep.className = "breadcrumb-separator";
        sep.textContent = " > ";
        container.appendChild(sep);

        const link = document.createElement("span");
        link.className = "breadcrumb-link";
        link.textContent = l.name;

        if (idx === chain.length - 1) {
            link.classList.add("active");
        } else {
            link.onclick = () => loadLocationAdmin(l.id);
        }
        container.appendChild(link);
    });
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
    const location_id = document.getElementById("itemLocationSelect").value || null;
    const description = document.getElementById("itemDescription").value;
    const category = document.getElementById("itemCategorySelect").value || 'tools';
    const photoFile = document.getElementById("addItemPhotoInput").files[0];

    if (!name) return alert("Please enter an item name");

    // We add .select() here to get back the newly created item's ID row parameters
    const { data, error } = await withStatus(
        () => window.db.from("items").insert([{ 
            name, quantity, location_id, description, category, tags: activeSelectedAddTags 
        }]).select(),
        "Adding new item..."
    );

    if (!error && data && data.length > 0) {
        const newItemId = data[0].id;

        // Handle binary file upload to the storage bucket if selected
        if (photoFile) {
            const fileName = `item-${newItemId}-${Date.now()}`;
            const { error: uploadError } = await window.db.storage.from("item-photos").upload(fileName, photoFile);
            
            if (!uploadError) {
                // Link the successfully uploaded storage file into the relational database photos table
                await window.db.from("photos").insert([{ item_id: newItemId, file_path: fileName }]);
            }
        }

        closeAddItemModal();
        if (currentLocationId) loadLocation(currentLocationId);
        else loadRootLocations();
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
 activeSelectedEditTags = Array.isArray(item.tags) ? [...item.tags] : (item.tags ? [item.tags] : []);
renderActiveTagPills('edit');

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
        tags: activeSelectedEditTags
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
    document.getElementById("itemName").value = "";
    document.getElementById("itemQuantity").value = "";
    document.getElementById("itemDescription").value = "";
    
    // Clear the picture file queues and reset back to the generic avatar asset
    document.getElementById("addItemPhotoInput").value = "";
    document.getElementById("addItemPreview").src = "../assets/images/no-image.jpg";
    
    activeSelectedAddTags = []; 
    renderActiveTagPills('add');
    
    const selectEl = document.getElementById("itemLocationSelect");
    if (selectEl) selectEl.value = (currentLocationId && currentLocationId !== "unallocated") ? currentLocationId : "";
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
/* =========================================================
   DYNAMIC TAGS & CATEGORIES MANAGEMENT SYSTEM
========================================================= */

// 1. DYNAMIC DROPDOWNS POPULATOR CACHE
async function reloadGlobalFormCaches() {
    const { data: tData } = await window.db.from("tags").select("*").order("name");
    const { data: cData } = await window.db.from("item_categories").select("*").order("name");
    
    globalCachedTags = tData || [];
    globalCachedCategories = cData || [];

    // Map targets to Add/Edit Select containers
    const addCat = document.getElementById("itemCategorySelect");
    const editCat = document.getElementById("editItemCategory");
    const catHtml = globalCachedCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join("");
    if (addCat) addCat.innerHTML = catHtml;
    if (editCat) editCat.innerHTML = catHtml;

    const addTagSel = document.getElementById("itemTagSelect");
    const editTagSel = document.getElementById("editItemTagSelect");
    const tagHtml = '<option value="" selected disabled>Select a tag...</option>' + 
                    globalCachedTags.map(t => `<option value="${t.name}">${t.name}</option>`).join("");
    if (addTagSel) addTagSel.innerHTML = tagHtml;
    if (editTagSel) editTagSel.innerHTML = tagHtml;
}

// 2. PILL BADGE BADGES CONTROLLER UI EVENT
function handleTagSelection(mode, tagName) {
    if (!tagName) return;
    const targetArray = mode === 'add' ? activeSelectedAddTags : activeSelectedEditTags;
    
    if (!targetArray.includes(tagName)) {
        targetArray.push(tagName);
        renderActiveTagPills(mode);
    }
    
    // Clear selection row index
    document.getElementById(mode === 'add' ? "itemTagSelect" : "editItemTagSelect").value = "";
}

function removeSelectedTagBadge(mode, tagName) {
    if (mode === 'add') {
        activeSelectedAddTags = activeSelectedAddTags.filter(t => t !== tagName);
    } else {
        activeSelectedEditTags = activeSelectedEditTags.filter(t => t !== tagName);
    }
    renderActiveTagPills(mode);
}

function renderActiveTagPills(mode) {
    const container = document.getElementById(mode === 'add' ? "addItemTagsPillsRow" : "editItemTagsPillsRow");
    const targetArray = mode === 'add' ? activeSelectedAddTags : activeSelectedEditTags;
    container.innerHTML = "";

    targetArray.forEach(tag => {
        const pill = document.createElement("span");
        pill.className = "tag-pill";
        pill.style.cssText = "display:inline-flex; align-items:center; gap:6px; background:#e0f2fe; border-color:#bae6fd; color:#0369a1;";
        pill.innerHTML = `${tag} <b style="cursor:pointer; color:#ef4444;">&times;</b>`;
        pill.querySelector("b").onclick = () => removeSelectedTagBadge(mode, tag);
        container.appendChild(pill);
    });
}

// 3. CENTRAL TAG ACTIONS PANELS RENDERING
async function loadTagsAdmin() {
    const { data } = await window.db.from("tags").select("*").order("name");
    const tbody = document.getElementById("centralTagsTableBody");
    tbody.innerHTML = "";
    
    if(!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#999; font-style:italic; padding:20px;">No tags in registry</td></tr>`;
        return;
    }
    data.forEach(t => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight:600; color:#333;">${t.name}</td>
            <td style="text-align:right; padding-right:15px;">
                <button class="btn-outline" style="padding:4px 10px; font-size:12px; margin-right:6px;" onclick="openTagModal(false, '${t.id}', '${t.name}')">Edit</button>
                <button class="btn-danger" style="padding:4px 10px; font-size:12px;" onclick="deleteCentralTag('${t.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openTagModal(isSubCall = false, id = null, name = '') {
    isSubModalContextCall = isSubCall;
    editingTagTargetId = id;
    document.getElementById("tagModalTitle").textContent = id ? "Modify Tag Name" : "Add New Tag Label";
    document.getElementById("tagModalInput").value = name;
    document.getElementById("centralTagModal").style.display = "flex";
}

async function saveCentralTag() {
    const name = document.getElementById("tagModalInput").value.trim();
    if (!name) return alert("Please enter a tag label designation.");

    let response;
    if (editingTagTargetId) {
        response = await window.db.from("tags").update({ name }).eq("id", editingTagTargetId);
    } else {
        response = await window.db.from("tags").insert([{ name }]);
    }

    if (!response.error) {
        closeModal('centralTagModal');
        await reloadGlobalFormCaches();
        if (isSubModalContextCall) {
            // Automatically push directly into active item creation arrays if created inline
            const currentActiveMode = document.getElementById("itemEditModal").style.display === 'flex' ? 'edit' : 'add';
            handleTagSelection(currentActiveMode, name);
        } else {
            loadTagsAdmin();
        }
    } else {
        alert("Action failed: Value identifier might already exist.");
    }
}

async function deleteCentralTag(id) {
    if (!confirm("Are you sure? Removing this tag will strip it from any item that uses it.")) return;
    const { error } = await window.db.from("tags").delete().eq("id", id);
    if (!error) { await reloadGlobalFormCaches(); loadTagsAdmin(); }
}

// 4. CENTRAL CATEGORY ACTIONS PANELS RENDERING
async function loadCategoriesAdmin() {
    const { data } = await window.db.from("item_categories").select("*").order("name");
    const tbody = document.getElementById("centralCategoriesTableBody");
    tbody.innerHTML = "";
    
    if(!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#999; font-style:italic; padding:20px;">No categories in registry</td></tr>`;
        return;
    }
    data.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight:600; color:#333;">${c.name}</td>
            <td style="text-align:right; padding-right:15px;">
                <button class="btn-outline" style="padding:4px 10px; font-size:12px; margin-right:6px;" onclick="openCategoryModal(false, '${c.id}', '${c.name}')">Edit</button>
                <button class="btn-danger" style="padding:4px 10px; font-size:12px;" onclick="deleteCentralCategory('${c.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openCategoryModal(isSubCall = false, id = null, name = '') {
    isSubModalContextCall = isSubCall;
    editingCategoryTargetId = id;
    document.getElementById("categoryModalTitle").textContent = id ? "Modify Category Classification" : "Add New Item Category";
    document.getElementById("categoryModalInput").value = name;
    document.getElementById("centralCategoryModal").style.display = "flex";
}

async function saveCentralCategory() {
    const name = document.getElementById("categoryModalInput").value.trim();
    if (!name) return alert("Please specify classification name parameter.");

    let response;
    if (editingCategoryTargetId) {
        response = await window.db.from("item_categories").update({ name }).eq("id", editingCategoryTargetId);
    } else {
        response = await window.db.from("item_categories").insert([{ name }]);
    }

    if (!response.error) {
        closeModal('centralCategoryModal');
        await reloadGlobalFormCaches();
        if (isSubModalContextCall) {
            const targetSelId = document.getElementById("itemEditModal").style.display === 'flex' ? "editItemCategory" : "itemCategorySelect";
            document.getElementById(targetSelId).value = name;
        } else {
            loadCategoriesAdmin();
        }
    } else {
        alert("Action failed: Classification value identifier matches existing record entry.");
    }
}

async function deleteCentralCategory(id) {
    if (!confirm("Are you sure you want to drop this classification option?")) return;
    const { error } = await window.db.from("item_categories").delete().eq("id", id);
    if (!error) { await reloadGlobalFormCaches(); loadCategoriesAdmin(); }
}
/* =========================================================
   ADVANCED SEGMENTED SEARCH & HARDWARE SCAN INTERCEPTOR
========================================================= */

// 1. ADVANCED SEGMENTED MULTI-CRITERIA SEARCH ENGINE
async function handleGlobalSearch(term) {
    if (!term.trim()) { 
        // If search bar empty, instantly reset back to active directory context
        if (currentLocationId) loadLocation(currentLocationId);
        else loadRootLocations();
        return; 
    }

    const filterType = document.getElementById("searchTypeFilter")?.value || "all";
    document.getElementById("breadcrumb").innerHTML = `Search Results for <span style="color:#ff8c00;">"${term}"</span>`;

    // Fetch the items array with image references
    const { data: items } = await window.db.from("items").select("*, photos(file_path)");
    if (!items) return;

    // Define the sectioned storage categories buckets
    const sections = { name: [], location: [], tag: [], category: [] };
    const lowerTerm = term.toLowerCase();

    items.forEach(item => {
        const nameMatches = item.name?.toLowerCase().includes(lowerTerm);
        
        // Resolve the parent directory path via our global locations list hierarchy cache
        const locationPath = item.location_id ? buildLocationPath(item.location_id).toLowerCase() : "unallocated items";
        const locationMatches = locationPath.includes(lowerTerm);

        // Check JSONB Array tags references
        let tagMatches = false;
        if (Array.isArray(item.tags)) tagMatches = item.tags.some(t => t.toLowerCase().includes(lowerTerm));
        else if (typeof item.tags === 'string') tagMatches = item.tags.toLowerCase().includes(lowerTerm);

        const categoryMatches = item.category?.toLowerCase().includes(lowerTerm);
        const barcodeMatches = item.barcode?.toLowerCase() === lowerTerm || item.barcode?.toLowerCase().includes(lowerTerm);

        // Map data rows onto matching criteria buckets depending on active filter mode choices
        if ((filterType === "all" || filterType === "name") && nameMatches) sections.name.push(item);
        if ((filterType === "all" || filterType === "location") && locationMatches) sections.location.push(item);
        if ((filterType === "all" || filterType === "tag") && tagMatches) sections.tag.push(item);
        if ((filterType === "all" || filterType === "category") && categoryMatches) sections.category.push(item);
        if (filterType === "barcode" && barcodeMatches) sections.name.push(item); // Fallback to name group for explicit codes
    });

    renderSectionedSearchResults(sections);
}

// 2. LAYOUT ADAPTIVE SEGMENTED RESULTS RENDERER
function renderSectionedSearchResults(sections) {
    const container = document.getElementById("itemTiles");
    const tableContainer = document.getElementById("itemsTableWrapper");
    const folderContainer = document.getElementById("locationTiles");
    
    if (folderContainer) folderContainer.innerHTML = ""; // Clear active navigation folders during searches
    container.innerHTML = "";
    tableContainer.innerHTML = "";

    const isListView = userSettings.view === 'list';
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "width: 100%; text-align: left;";

    const headersMap = {
        name: "Items (by name)",
        location: "Items (by location)",
        tag: "Items (by tag)",
        category: "Items (by category)"
    };

    Object.keys(sections).forEach(key => {
        const matchingArray = sections[key];

        // Section Title Label
        const sectionHeader = document.createElement("h4");
        sectionHeader.style.cssText = "margin: 25px 0 10px 0; color: #004a99; border-bottom: 2px solid #edf2f7; padding-bottom: 6px; font-size: 15px; font-weight: 700;";
        sectionHeader.textContent = headersMap[key];
        wrapper.appendChild(sectionHeader);

        if (matchingArray.length === 0) {
            const emptyLabel = document.createElement("div");
            emptyLabel.style.cssText = "color: #999; font-style: italic; padding: 10px 0; font-size: 13px;";
            emptyLabel.textContent = "No results!";
            wrapper.appendChild(emptyLabel);
        } else {
            if (isListView) {
                // Construct compact data rows list table layout for search results
                const segmentTableWrap = document.createElement("div");
                segmentTableWrap.className = "items-table-wrapper";
                segmentTableWrap.style.cssText = "display: block; margin-top: 5px; margin-bottom: 15px;";
                segmentTableWrap.innerHTML = `
                    <table class="custom-table">
                        <thead>
                            <tr>
                                <th style="width: 45%;">Name</th>
                                <th style="width: 15%;">Quantity</th>
                                <th style="width: 20%;">Barcode</th>
                                <th style="width: 20%;">NFC Tag</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                `;
                const tbody = segmentTableWrap.querySelector("tbody");
                matchingArray.forEach(item => {
                    const tr = document.createElement("tr");
                    tr.style.cursor = "pointer";
                    tr.onclick = () => openItemDetails(item);
                    tr.innerHTML = `
                        <td style="font-weight:600;">🔹 ${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>${item.barcode || '—'}</td>
                        <td>${item.nfc_tag || '—'}</td>
                    `;
                    tbody.appendChild(tr);
                });
                wrapper.appendChild(segmentTableWrap);
            } else {
                // Construct normal adaptive picture card grid layout blocks
                const gridBlock = document.createElement("div");
                gridBlock.className = "items-grid";
                gridBlock.style.margin = "8px 0 20px 0";
                
                matchingArray.forEach(item => {
                    const card = document.createElement("div");
                    card.className = "item-card";
                    let imgUrl = "../assets/images/avatar-default.avif";
                    if (item.photos?.length) imgUrl = window.db.storage.from("item-photos").getPublicUrl(item.photos[0].file_path).data.publicUrl;
                    card.innerHTML = `
                        <div class="item-card-photo-wrapper"><img src="${imgUrl}"></div>
                        <div class="item-card-qty-badge">Qty: ${item.quantity}</div>
                        <div class="item-card-cog" onclick="openItemActions(event, '${item.id}')">⚙️</div>
                        <div class="item-card-name">${item.name}</div>
                    `;
                    card.onclick = () => openItemDetails(item);
                    gridBlock.appendChild(card);
                });
                wrapper.appendChild(gridBlock);
            }
        }
    });

    if (isListView) tableContainer.appendChild(wrapper);
    else container.appendChild(wrapper);
}

// 3. HARDWARE SCANNER ROUTING ENGINE (AUTO REDIRECTION & LEAPING)
async function executeDirectBarcodeLookup(scannedCodeString) {
    if (!scannedCodeString || !scannedCodeString.trim()) return;
    const cleanToken = scannedCodeString.trim();

    // Query across all system items configurations mapping parameters
    const { data: items } = await window.db.from("items").select("*, photos(file_path)");
    if (!items) return;

    // Cross reference by exact token against barcode and hardware tag columns
    const match = items.find(item => 
        (item.barcode && item.barcode.trim() === cleanToken) || 
        (item.nfc_tag && item.nfc_tag.trim() === cleanToken)
    );

    if (!match) {
        alert(`No items found matching that barcode! [ ${cleanToken} ]`);
        return;
    }

    // Direct automated leaping injection tree routing logic parameters
    if (match.location_id) {
        currentLocationId = match.location_id;
        await loadLocation(match.location_id);
    } else {
        currentLocationId = "unallocated";
        await loadUnallocatedItems();
    }

    // Pop open details preview presentation drawer instantly
    openItemDetails(match);
}

// 4. HARDWARE CAMERA VIEWPORT HARDWARE PORTAL STREAM CONTROLS
let cameraStreamReferenceObject = null;

let html5QrcodeScannerInstance = null;
let isProcessingScan = false; // State lock flag to stop alert looping

function openBarcodeScannerModal() {
    document.getElementById("simulatedBarcodeInput").value = "";
    document.getElementById("barcodeScannerModal").style.display = "flex";
    isProcessingScan = false; // Reset the state lock on launch

    html5QrcodeScannerInstance = new Html5Qrcode("scannerReaderContainer");

    const config = { 
        fps: 15,
        qrbox: { width: 260, height: 160 },
        aspectRatio: 1.333333
    };

    html5QrcodeScannerInstance.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
            // 1. If a frame is already processing, ignore all other incoming frames
            if (isProcessingScan) return;
            isProcessingScan = true; // Engage lock immediately

            document.getElementById("globalSearchInput").value = decodedText;
            document.getElementById("searchTypeFilter").value = "barcode";
            
            closeBarcodeScannerModal();
            executeDirectBarcodeLookup(decodedText); 
        },
        (errorMessage) => {
            // Leave blank to keep console quiet during focus seeking
        }
    ).catch(err => {
        console.warn("Hardware media source connection failure: ", err);
        // Alert developer if mobile camera is being blocked by unsecure HTTP testing
        if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
            alert("Camera Blocked: Mobile browsers require an HTTPS secure connection to open device camera streams.");
        }
    });
}

function closeBarcodeScannerModal() {
    document.getElementById("barcodeScannerModal").style.display = "none";
    
    if (html5QrcodeScannerInstance) {
        html5QrcodeScannerInstance.stop().then(() => {
            html5QrcodeScannerInstance = null;
            document.getElementById("scannerReaderContainer").innerHTML = ""; // Wipe residue
            isProcessingScan = false; // Release lock only after stream is dead
        }).catch(err => {
            console.warn("Forced device stream hardware release override: ", err);
            html5QrcodeScannerInstance = null;
            isProcessingScan = false;
        });
    }
}