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
    SETTINGS & FILE CACHE TRACKING ARRAYS
========================================================= */
let currentBrowserLocations = [];
let currentBrowserItems = [];

let currentAddItemFiles = [];
let currentEditItemFiles = []; 
let existingItemPhotosToDelete = []; 

let currentAddLocationFiles = [];
let currentEditLocationFile = null;

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
    reloadGlobalFormCaches(); 
    loadLocationsAdmin();     
    loadRootLocations();
    loadLocationDropdown();

    document.addEventListener("focus", function(event) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") {
            setTimeout(() => {
                if (typeof event.target.select === "function") {
                    event.target.select();
                }
            }, 30);
        }
    }, true); 
}

/* =========================================================
    TAB & PAGE NAVIGATION
========================================================= */
function showPage(pageId) {
    document.querySelectorAll(".inventory-page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    
    const page = document.getElementById(pageId);
    if (page) page.classList.add("active");

    const tabMap = { 'pageItems': 'tab-items', 'pageLocations': 'tab-locations', 'pageSettings': 'tab-settings', 'pageTags': 'tab-tags', 'pageCategories': 'tab-categories' };
    const tab = document.getElementById(tabMap[pageId]);
    if (tab) tab.classList.add("active");

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

    locationHistory = chain.slice(0, -1).map(l => l.id);

    const container = document.getElementById("breadcrumb");
    if (!container) return;
    container.innerHTML = "";

    const rootLink = document.createElement("span");
    rootLink.className = "breadcrumb-link";
    rootLink.textContent = "Items";
    rootLink.onclick = () => loadRootLocations();
    container.appendChild(rootLink);

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
        locationsAdmin = data.map(l => ({ id: l.id, name: l.name, parent: l.parent_id, barcode: l.barcode, nfc: l.nfc_tag, photo: l.photo_path, location_description: l.location_description, category: l.category }));
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
   MULTIPLE PHOTOS & CAMERA PREVIEW RUNTIME HANDLERS
========================================================= */
function handleMultipleFilesSelection(input, previewContainerId, mode) {
    const files = input.files;
    if (!files) return;

    let targetArray;
    if (mode === 'add-item') targetArray = currentAddItemFiles;
    else if (mode === 'edit-item') targetArray = currentEditItemFiles;
    else targetArray = currentAddLocationFiles;

    for (let i = 0; i < files.length; i++) {
        targetArray.push(files[i]);
    }
    renderMultipleFilesPreviews(previewContainerId, targetArray, mode);
}

function renderMultipleFilesPreviews(containerId, filesArray, mode, existingPhotos = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    // Render old database photos first (if any exist)
    existingPhotos.forEach((photo) => {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;";

        const img = document.createElement("img");
        img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
        img.src = window.db.storage.from("item-photos").getPublicUrl(photo.file_path).data.publicUrl;

        const removeBtn = document.createElement("div");
        removeBtn.style.cssText = "position: absolute; top: 2px; right: 2px; background: rgba(239, 68, 68, 0.9); color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer; font-weight: bold; line-height: 1;";
        removeBtn.innerHTML = "&times;";
        removeBtn.onclick = () => {
            existingItemPhotosToDelete.push(photo.file_path);
            const index = currentItemForActions.photos.findIndex(p => p.file_path === photo.file_path);
            if (index > -1) currentItemForActions.photos.splice(index, 1);
            renderMultipleFilesPreviews(containerId, filesArray, mode, currentItemForActions.photos);
        };

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        container.appendChild(wrapper);
    });

    // Render newly selected files or placeholders
    if (filesArray.length === 0 && existingPhotos.length === 0) {
        const defaultImg = mode.includes('item') ? "../assets/images/no-image.jpg" : "../assets/images/folder-icon.jpg";
        container.innerHTML = `<img src="${defaultImg}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd;">`;
        return;
    }

    filesArray.forEach((file, index) => {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;";

        const img = document.createElement("img");
        img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
        
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.readAsDataURL(file);

        const removeBtn = document.createElement("div");
        removeBtn.style.cssText = "position: absolute; top: 2px; right: 2px; background: rgba(239, 68, 68, 0.9); color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer; font-weight: bold; line-height: 1;";
        removeBtn.innerHTML = "&times;";
        removeBtn.onclick = () => {
            filesArray.splice(index, 1);
            renderMultipleFilesPreviews(containerId, filesArray, mode, existingPhotos);
        };

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        container.appendChild(wrapper);
    });
}

// Single Photo Picker Fallback logic for Location Forms
function previewLocationImage(input, previewId, mode) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (mode === 'add') {
            currentAddLocationFiles = [file];
        } else {
            currentEditLocationFile = file;
        }
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById(previewId).src = e.target.result;
        reader.readAsDataURL(file);
    }
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
    const barcode = document.getElementById("addItemBarcode").value;
    const nfc_tag = document.getElementById("addItemNFC").value;

    if (!name) return alert("Please enter an item name");

    const { data, error } = await withStatus(
        () => window.db.from("items").insert([{ 
            name, quantity, location_id, description, category, barcode, nfc_tag, tags: activeSelectedAddTags 
        }]).select(),
        "Adding new item..."
    );

    if (!error && data && data.length > 0) {
        const newItemId = data[0].id;

        if (currentAddItemFiles.length > 0) {
            for (let i = 0; i < currentAddItemFiles.length; i++) {
                const file = currentAddItemFiles[i];
                const fileName = `item-${newItemId}-${Date.now()}-${i}`;
                const { error: uploadError } = await window.db.storage.from("item-photos").upload(fileName, file);
                
                if (!uploadError) {
                    await window.db.from("photos").insert([{ item_id: newItemId, file_path: fileName }]);
                }
            }
        }

        closeAddItemModal();
        if (currentLocationId) loadLocation(currentLocationId);
        else loadRootLocations();
    }
}

async function actionDeleteItem() {
    if (!currentItemForActions || !currentItemForActions.id) {
        return alert("Error: No item selected for deletion.");
    }
    if (!confirm("Are you sure you want to permanently delete this item? This cannot be undone.")) {
        return;
    }
    const { error } = await withStatus(
        () => window.db.from("items").delete().eq("id", currentItemForActions.id),
        "Deleting item..."
    );
    if (!error) {
        closeItemActionsModal();
        if (currentLocationId) loadLocation(currentLocationId);
        else loadRootLocations();
    }
}

/* =========================================================
   RICH ITEM MODALS: VIEWER & EDIT LOGIC
========================================================= */
function openItemDetails(item) {
    currentItemForActions = item;

    document.getElementById("detailItemName").textContent = item.name;
    document.getElementById("detailItemQtyBadge").textContent = "Qty: " + item.quantity;
    document.getElementById("detailItemDescription").textContent = item.description || "No description provided.";
    document.getElementById("detailItemBarcode").textContent = item.barcode || "—";
    document.getElementById("detailItemNFC").textContent = item.nfc_tag || "—";

    document.getElementById("detailItemLocation").textContent = item.location_id ? "📍 " + buildLocationPath(item.location_id) : "📍 Unallocated Items";

    const imgEl = document.getElementById("detailItemImage");
    if (item.photos && item.photos.length > 0) {
        imgEl.src = window.db.storage.from("item-photos").getPublicUrl(item.photos[0].file_path).data.publicUrl;
    } else {
        imgEl.src = "../assets/images/no-image.jpg";
    }

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

async function switchToItemEdit() {
    if (!currentItemForActions) return;
    closeModal('itemDetailsModal');

    const item = currentItemForActions;

    document.getElementById("editItemName").value = item.name || "";
    document.getElementById("editItemQuantity").value = item.quantity || 0;
    document.getElementById("editItemDescription").value = item.description || "";
    document.getElementById("editItemBarcode").value = item.barcode || "";
    document.getElementById("editItemNFC").value = item.nfc_tag || "";
    document.getElementById("editItemCategory").value = item.category || "tools";

    activeSelectedEditTags = Array.isArray(item.tags) ? [...item.tags] : (item.tags ? [item.tags] : []);
    renderActiveTagPills('edit');

    const { data } = await window.db.from("locations").select("id, name");
    const select = document.getElementById("editItemLocationSelect");
    select.innerHTML = '<option value="">No Location (Unallocated)</option>' + 
        (data ? data.map(l => `<option value="${l.id}">${l.name}</option>`).join("") : "");
    select.value = item.location_id || "";

    // Clear file variables and render current structural gallery contents
    currentEditItemFiles = [];
    existingItemPhotosToDelete = [];
    renderMultipleFilesPreviews('editItemPreviewsRow', currentEditItemFiles, 'edit-item', item.photos || []);

    document.getElementById("itemEditModal").style.display = "flex";
}

async function saveItemEdits() {
    if (!currentItemForActions || !currentItemForActions.id) return;

    const itemId = currentItemForActions.id;

    // Remove deleted items from the database
    if (existingItemPhotosToDelete.length > 0) {
        for (let path of existingItemPhotosToDelete) {
            await window.db.from("photos").delete().eq("file_path", path);
        }
    }

    // Upload newly stacked photo streams
    if (currentEditItemFiles.length > 0) {
        for (let i = 0; i < currentEditItemFiles.length; i++) {
            const file = currentEditItemFiles[i];
            const fileName = `item-${itemId}-${Date.now()}-${i}`;
            const { error: uploadError } = await window.db.storage.from("item-photos").upload(fileName, file);
            if (!uploadError) {
                await window.db.from("photos").insert([{ item_id: itemId, file_path: fileName }]);
            }
        }
    }

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

    const { error } = await withStatus(
        () => window.db.from("items").update(payload).eq("id", itemId),
        "Updating item details..."
    );

    if (!error) {
        closeModal('itemEditModal');
        if (currentLocationId) loadLocation(currentLocationId);
        else loadRootLocations();
    }
}

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

function deleteItemPhoto() {
    document.getElementById('editItemPreview').src = "../assets/images/no-image.jpg";
    document.getElementById('editItemPhotoInput').value = "";
    window.itemPhotoDeleted = true;
}

/* =========================================================
   MODAL CONTROLS W/ PREVIEW RESETS
========================================================= */
function openAddItemModal() { 
    document.getElementById("itemName").value = "";
    document.getElementById("itemQuantity").value = "";
    document.getElementById("itemDescription").value = "";
    document.getElementById("addItemBarcode").value = "";
    document.getElementById("addItemNFC").value = "";
    
    document.getElementById("addItemPhotoInput").value = "";
    document.getElementById("addItemCameraInput").value = "";
    
    currentAddItemFiles = [];
    renderMultipleFilesPreviews('addItemPreviewsRow', currentAddItemFiles, 'item');
    
    activeSelectedAddTags = []; 
    renderActiveTagPills('add');
    
    const selectEl = document.getElementById("itemLocationSelect");
    if (selectEl) selectEl.value = (currentLocationId && currentLocationId !== "unallocated") ? currentLocationId : "";
    document.getElementById("addItemModal").style.display = "flex"; 
}

function closeAddItemModal() { 
    document.getElementById("addItemModal").style.display = "none"; 
}

function closeItemActionsModal() { document.getElementById("itemActionsModal").style.display = "none"; }
function openItemActions(event, itemId) { event.stopPropagation(); currentItemForActions = { id: itemId }; document.getElementById("itemActionsModal").style.display = "flex"; }
function openItemActionsFromDetails() { closeItemDetailsModal(); document.getElementById("itemActionsModal").style.display = "flex"; }

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

    currentEditLocationFile = null;
    window.locationPhotoDeleted = false;

    const previewImg = document.getElementById("editLocationPreview");
    if (loc.photo) {
        previewImg.src = window.db.storage.from("location-photos").getPublicUrl(loc.photo).data.publicUrl;
    } else {
        previewImg.src = "../assets/images/folder-icon.jpg";
    }

    document.getElementById("locationActionsModal").style.display = "flex";
}

async function saveLocationEdits() {
    if (!editingLocationId) return;

    let photoPath = locationsAdmin.find(l => l.id === editingLocationId)?.photo || null;

    if (currentEditLocationFile) {
        const fileName = `location-${Date.now()}`;
        const { error: uploadError } = await window.db.storage.from("location-photos").upload(fileName, currentEditLocationFile);
        if (!uploadError) photoPath = fileName;
    } else if (window.locationPhotoDeleted) {
        photoPath = null;
    }

    const payload = {
        name: document.getElementById("editLocationName").value,
        location_description: document.getElementById("editLocationDescription").value,
        barcode: document.getElementById("editLocationBarcode").value,
        nfc_tag: document.getElementById("editLocationNFC").value,
        category: document.getElementById("editLocationCategory").value,
        photo_path: photoPath
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

function deleteLocationPhoto() {
    document.getElementById('editLocationPreview').src = "../assets/images/folder-icon.jpg";
    document.getElementById('editLocationPhotoInput').value = ""; 
    document.getElementById('editLocationCameraInput').value = ""; 
    currentEditLocationFile = null;
    window.locationPhotoDeleted = true; 
}

/* =========================================================
   MANAGE LOCATIONS: CORE LOGIC
========================================================= */
function openAddLocationModal() {
    const fields = ["addLocationName", "addLocationDescription", "addLocationBarcode", "addLocationNFC"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    
    const cat = document.getElementById("addLocationCategory");
    if (cat) cat.value = "storage";

    document.getElementById("addLocationPhotoInput").value = "";
    document.getElementById("addLocationCameraInput").value = "";
    document.getElementById("addLocationPreview").src = "../assets/images/folder-icon.jpg";

    currentAddLocationFiles = [];
    document.getElementById("addLocationModal").style.display = "flex";
}

async function addLocation() {
    const name = document.getElementById("addLocationName").value;
    const description = document.getElementById("addLocationDescription").value;
    const barcode = document.getElementById("addLocationBarcode").value;
    const nfc = document.getElementById("addLocationNFC").value;
    const category = document.getElementById("addLocationCategory").value;

    if (!name) return alert("Please enter a folder name");

    let uploadedPhotoPath = null;
    if (currentAddLocationFiles.length > 0) {
        const file = currentAddLocationFiles[0]; 
        const fileName = `location-${Date.now()}`;
        const { error: uploadError } = await window.db.storage.from("location-photos").upload(fileName, file);
        if (!uploadError) {
            uploadedPhotoPath = fileName;
        }
    }

    const { error } = await withStatus(
        () => window.db.from("locations").insert([{ 
            name, 
            location_description: description, 
            barcode,
            nfc_tag: nfc,
            category,
            parent_id: currentLocationAdmin,
            photo_path: uploadedPhotoPath
        }]),
        "Creating folder..."
    );

    if (!error) {
        closeModal('addLocationModal');
        loadLocationsAdmin();
    }
}

async function attemptDeleteLocation() {
    if (!editingLocationId) return;

    const hasChildren = locationsAdmin.some(l => l.parent === editingLocationId);
    if (hasChildren) return alert("Cannot delete: This folder contains sub-folders.");

    const { data: items } = await window.db.from("items").select("id").eq("location_id", editingLocationId).limit(1);
    if (items && items.length > 0) return alert("Cannot delete: This folder contains items.");

    if (!confirm("Are you sure? This cannot be undone.")) return;

    const { error = null } = await withStatus(
        () => window.db.from("locations").delete().eq("id", editingLocationId),
        "Deleting folder..."
    );

    if (!error) {
        closeModal('locationActionsModal');
        loadLocationsAdmin();
    }
}

function closeModal(id) { 
    document.getElementById(id).style.display = "none"; 
}

/* =========================================================
   SEARCH & VIEWS (UPGRADED SCOPE DETECTOR HIDING)
========================================================= */
async function handleGlobalSearch(term) {
    if (!term.trim()) { 
        if (currentLocationId) loadLocation(currentLocationId);
        else loadRootLocations();
        return; 
    }

    const filterType = document.getElementById("searchTypeFilter")?.value || "all";
    document.getElementById("breadcrumb").innerHTML = `Search Results for <span style="color:#ff8c00;">"${term}"</span>`;

    const { data: items } = await window.db.from("items").select("*, photos(file_path)");
    if (!items) return;

    const sections = { name: [], location: [], tag: [], category: [] };
    const lowerTerm = term.toLowerCase();

    items.forEach(item => {
        const nameMatches = item.name?.toLowerCase().includes(lowerTerm);
        const locationPath = item.location_id ? buildLocationPath(item.location_id).toLowerCase() : "unallocated items";
        const locationMatches = locationPath.includes(lowerTerm);

        let tagMatches = false;
        if (Array.isArray(item.tags)) tagMatches = item.tags.some(t => t.toLowerCase().includes(lowerTerm));
        else if (typeof item.tags === 'string') tagMatches = item.tags.toLowerCase().includes(lowerTerm);

        const categoryMatches = item.category?.toLowerCase().includes(lowerTerm);
        const barcodeMatches = item.barcode?.toLowerCase() === lowerTerm || item.barcode?.toLowerCase().includes(lowerTerm);

        if ((filterType === "all" || filterType === "name") && nameMatches) sections.name.push(item);
        if ((filterType === "all" || filterType === "location") && locationMatches) sections.location.push(item);
        if ((filterType === "all" || filterType === "tag") && tagMatches) sections.tag.push(item);
        if ((filterType === "all" || filterType === "category") && categoryMatches) sections.category.push(item);
        if (filterType === "barcode" && barcodeMatches) sections.name.push(item); 
    });

    renderSectionedSearchResults(sections, filterType);
}

function renderSectionedSearchResults(sections, filterType = "all") {
    const container = document.getElementById("itemTiles");
    const tableContainer = document.getElementById("itemsTableWrapper");
    const folderContainer = document.getElementById("locationTiles");
    
    if (folderContainer) folderContainer.innerHTML = ""; 
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
        if (filterType !== "all") {
            if ((filterType === "name" || filterType === "barcode") && key !== "name") return;
            if (filterType === "location" && key !== "location") return;
            if (filterType === "tag" && key !== "tag") return;
            if (filterType === "category" && key !== "category") return;
        }

        const matchingArray = sections[key];

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

/* =========================================================
   HARDWARE SCANNER INTEGRATION W/ INLINE INPUT HOOKS
========================================================= */
async function executeDirectBarcodeLookup(scannedCodeString) {
    if (!scannedCodeString || !scannedCodeString.trim()) return;
    const cleanToken = scannedCodeString.trim();

    const { data: items } = await window.db.from("items").select("*, photos(file_path)");
    if (!items) return;

    const match = items.find(item => 
        (item.barcode && item.barcode.trim() === cleanToken) || 
        (item.nfc_tag && item.nfc_tag.trim() === cleanToken)
    );

    if (!match) {
        alert(`No items found matching that barcode! [ ${cleanToken} ]`);
        return;
    }

    if (match.location_id) {
        currentLocationId = match.location_id;
        await loadLocation(match.location_id);
    } else {
        currentLocationId = "unallocated";
        await loadUnallocatedItems();
    }

    openItemDetails(match);
}

let html5QrcodeScannerInstance = null;
let isProcessingScan = false; 

function openBarcodeScannerModal(targetInputId = null) {
    document.getElementById("simulatedBarcodeInput").value = "";
    document.getElementById("barcodeScannerModal").style.display = "flex";
    isProcessingScan = false; 
    
    window.activeBarcodeTargetInputId = targetInputId;

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
            if (isProcessingScan) return;
            isProcessingScan = true; 

            if (window.activeBarcodeTargetInputId) {
                document.getElementById(window.activeBarcodeTargetInputId).value = decodedText;
                closeBarcodeScannerModal();
            } else {
                document.getElementById("globalSearchInput").value = decodedText;
                document.getElementById("searchTypeFilter").value = "barcode";
                closeBarcodeScannerModal();
                executeDirectBarcodeLookup(decodedText); 
            }
        },
        (errorMessage) => {}
    ).catch(err => {
        console.warn("Hardware media source connection failure: ", err);
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
            document.getElementById("scannerReaderContainer").innerHTML = ""; 
            isProcessingScan = false; 
        }).catch(err => {
            console.warn("Forced device stream hardware release override: ", err);
            html5QrcodeScannerInstance = null;
            isProcessingScan = false;
        });
    }
}

function triggerSimulatedScan() {
    const inputCode = document.getElementById("simulatedBarcodeInput").value.trim();
    if (!inputCode) return alert("Please enter a barcode token string to simulate action processing.");
    
    if (window.activeBarcodeTargetInputId) {
        document.getElementById(window.activeBarcodeTargetInputId).value = inputCode;
        closeBarcodeScannerModal();
    } else {
        document.getElementById("globalSearchInput").value = inputCode;
        document.getElementById("searchTypeFilter").value = "barcode";
        closeBarcodeScannerModal();
        executeDirectBarcodeLookup(inputCode);
    }
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
    
    document.querySelectorAll('.col-picker-menu').forEach(m => m.style.display = "none");
    menu.style.display = isShowing ? "none" : "flex";
    
    document.onclick = () => menu.style.display = "none";
    menu.onclick = (e) => e.stopPropagation();
}

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
async function reloadGlobalFormCaches() {
    const { data: tData } = await window.db.from("tags").select("*").order("name");
    const { data: cData } = await window.db.from("item_categories").select("*").order("name");
    
    globalCachedTags = tData || [];
    globalCachedCategories = cData || [];

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

function handleTagSelection(mode, tagName) {
    if (!tagName) return;
    const targetArray = mode === 'add' ? activeSelectedAddTags : activeSelectedEditTags;
    
    if (!targetArray.includes(tagName)) {
        targetArray.push(tagName);
        renderActiveTagPills(mode);
    }
    
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
   LOCATION PATH UTILITY HELPERS
========================================================= */
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