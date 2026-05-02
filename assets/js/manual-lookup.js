/* =========================================
   Boiler Manuals Lookup Script
   - Handles modal open/close
   - Autocomplete by model
   - Lookup by GC number
   ========================================= */

let boilerData = [];

// --- Load boiler data JSON ---
fetch('../assets/data/boiler-manuals.json')
  .then(res => res.json())
  .then(data => boilerData = data);

/* =========================================
   DOM Elements (grab once, reuse)
   ========================================= */
const autocompleteList   = document.getElementById('autocompleteList');
const modelInput         = document.getElementById('modelInput');
const gcInput            = document.getElementById('gcInput');
const manualLinks        = document.getElementById('manualLinks');
const gcFormInputLook    = document.getElementById('gc-number');
const manualModal        = document.getElementById('manualModal');
const makeInput          = document.getElementById('makeInput');

/* =========================================
   Modal Functions
   ========================================= */
function openModal(make = '') {
  if (!manualModal) return;
  manualModal.style.display = 'flex';

  if (makeInput) {
    makeInput.value = make;
    makeInput.disabled = !!make;
  }

  if (modelInput) modelInput.value = '';
  if (gcInput) gcInput.value = '';
  if (manualLinks) manualLinks.innerHTML = '';
  if (autocompleteList) autocompleteList.innerHTML = '';
}

function closeModal() {
  if (manualModal) manualModal.style.display = 'none';
}

// Close modal if clicking outside content
if (manualModal) {
  manualModal.addEventListener('click', function (e) {
    if (e.target === manualModal) {
      closeModal();
    }
  });
}

/* =========================================
   Boiler Tile Click → Open Modal
   ========================================= */
document.querySelectorAll('.boiler-tile').forEach(tile => {
  tile.addEventListener('click', e => {
    e.preventDefault();
    const make = tile.getAttribute('data-make');
    openModal(make);
  });
});

/* =========================================
   Helpers to Show Results
   ========================================= */
function showLinks(item) {
  if (!manualLinks) return;
  manualLinks.innerHTML = `
    <div class="boiler-tile fade-in" style="width:100%">
      <h3>${item.make} ${item.model}</h3>
      <p>GC Number: ${item.gcNumber}</p>
      <a href="${item.links.FreeBoilerManuals}" target="_blank">FreeBoilerManuals</a><br>
      <a href="${item.links.DHSSpares}" target="_blank">DHSSpares</a><br>
      <a href="${item.links.BoilerManuals}" target="_blank">BoilerManuals</a>
    </div>
  `;
}

function showNoMatchInResults(message = 'No boiler found with that GC number.') {
  if (!manualLinks) return;
  manualLinks.innerHTML = `
    <div class="fade-in no-match-tile" id="noMatchTile">
      <p><strong>${message}</strong></p>
      <p style="font-size: 0.9rem; color: var(--text-secondary);">Click here to request a manual</p>
    </div>
  `;

  const tile = document.getElementById('noMatchTile');
  if (tile) {
    tile.addEventListener('click', () => {
      closeModal();
      window.location.href = '/support/manuals.html#manual-request';
    });
  }
}

/* =========================================
   Autocomplete by Model
   ========================================= */
if (modelInput) {
  modelInput.addEventListener('input', function () {
    const query = this.value.toLowerCase().trim();
    if (autocompleteList) autocompleteList.innerHTML = '';
    if (manualLinks) manualLinks.innerHTML = '';

    if (query.length === 0) return;

    const matches = boilerData.filter(item =>
      item.model.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      if (autocompleteList) {
        autocompleteList.innerHTML = `
          <div class="fade-in no-match-tile" id="noModelMatchTile">
            <p><strong>Can't find your model?</strong><br>
            Complete our find a manual form and we’ll do our best to locate it.</p>
          </div>
        `;
        const tile = document.getElementById('noModelMatchTile');
        if (tile) {
          tile.addEventListener('click', () => {
            closeModal();
            window.location.href = '/support/manuals.html#manual-request';
          });
        }
      }
    } else {
      matches.forEach(item => {
        const div = document.createElement('div');
        div.className = 'fade-in dropdown-item';
        div.textContent = `${item.model} (${item.make})`;
        div.onclick = () => {
          if (makeInput) makeInput.value = item.make;
          modelInput.value = item.model;
          if (gcInput) gcInput.value = item.gcNumber;
          showLinks(item);
          if (autocompleteList) autocompleteList.innerHTML = '';
        };
        if (autocompleteList) autocompleteList.appendChild(div);
      });
    }
  });
}

/* =========================================
   Lookup by GC Number (inside modal)
   ========================================= */
if (gcInput) {
  gcInput.addEventListener('input', function () {
    if (autocompleteList) autocompleteList.innerHTML = '';
    if (manualLinks) manualLinks.innerHTML = '';

    const raw = this.value.replace(/\D/g, '').slice(0, 7);
    let formatted = '';

    if (raw.length > 0) formatted += raw.slice(0, 2);
    if (raw.length > 2) formatted += '-' + raw.slice(2, 5);
    if (raw.length > 5) formatted += '-' + raw.slice(5, 7);

    this.value = formatted;
    console.log('Formatted GC:', formatted);

    const match = boilerData.find(item => item.gcNumber === formatted);
    if (match) {
      if (makeInput) makeInput.value = match.make;
      if (modelInput) modelInput.value = match.model;
      showLinks(match);
    } else if (formatted.length === 9) {
      showNoMatchInResults();
    }
  });
}

/* =========================================
   Lookup by GC Number (form input elsewhere)
   ========================================= */
if (gcFormInputLook) {
  gcFormInputLook.addEventListener('input', function (e) {
    const input = e.target;
    const raw = input.value.replace(/\D/g, '').slice(0, 7);
    const prevLength = input.value.length;
    const cursor = input.selectionStart;

    let formatted = '';
    if (raw.length > 0) formatted += raw.slice(0, 2);
    if (raw.length > 2) formatted += '-' + raw.slice(2, 5);
    if (raw.length > 5) formatted += '-' + raw.slice(5, 7);

    input.value = formatted;

    // Adjust cursor position
    const nextLength = formatted.length;
    const diff = nextLength - prevLength;
    input.setSelectionRange(cursor + diff, cursor + diff);
  });
}