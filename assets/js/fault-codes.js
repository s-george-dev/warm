
const faultData = {
  vaillant: {
    name: "Vaillant Boilers",
    codes: [
      { code: "F22", desc: "Low water pressure or system leak" },
      { code: "F28", desc: "Ignition fault — no flame detected" },
      { code: "F29", desc: "Flame extinguished during operation" },
      { code: "F75", desc: "Pump or pressure sensor issue" },
      { code: "F83", desc: "Flow/return temperature difference too high" },
      { code: "F84", desc: "Flow/return sensors swapped or faulty" },
      { code: "F85", desc: "Flow sensor fault" },
      { code: "F61", desc: "Gas valve or control board fault" },
      { code: "F62", desc: "Gas valve not closing properly" },
      { code: "F64", desc: "Internal electronics or NTC fault" }
    ]
  },
  worcester: {
    name: "Worcester Bosch Boilers",
    codes: [
      { code: "EA", desc: "Ignition failure — no flame detected" },
      { code: "E9", desc: "Overheat or water circulation fault" },
      { code: "CE 207", desc: "Flow temperature sensor fault" },
      { code: "C6 217", desc: "Fan speed or air pressure issue" },
      { code: "D5", desc: "Return sensor open or short circuit" },
      { code: "EA 227", desc: "Flame not established" },
      { code: "E1 218", desc: "Pressure sensor fault" },
      { code: "H07", desc: "Low mains voltage" },
      { code: "CE 229", desc: "Control board communication error" },
      { code: "E5", desc: "Fan or PCB failure" },
      { code: "E9 224", desc: "Overheat — high limit thermostat" }
    ]
  },
  ideal: {
    name: "Ideal Boilers",
    codes: [
      { code: "L2", desc: "Ignition lockout — flame failure", action: "This fault needs to be investigated by an engineer. <a href='/contact.html'>Contact us</a>" },
      { code: "F1", desc: "Low water pressure", action: "You can try topping up the pressure. <a href='https://www.youtube.com/results?search_query=ideal+boiler+f1+how+to+increase+pressure' target='_blank' rel='noopener'>See how in these videos.</a>" },
      { code: "F2", desc: "Flame loss during operation" },
      { code: "F3", desc: "Fan speed fault" },
      { code: "F5", desc: "Return thermistor fault" },
      { code: "F7", desc: "Low mains voltage" },
      { code: "F9", desc: "PCB communication error" },
      { code: "L5", desc: "Reset required — overheat or pump issue" },
      { code: "F10", desc: "Flow thermistor fault" }
    ]
  },
  baxi: {
    name: "Baxi Boilers",
    codes: [
      { code: "E133", desc: "Ignition failure or gas supply issue" },
      { code: "E119", desc: "Low water pressure" },
      { code: "E168", desc: "Voltage or PCB error" },
      { code: "E160", desc: "Fan fault" },
      { code: "E110", desc: "Overheat or sensor trip" },
      { code: "E125", desc: "Pump overrun or circulation issue" },
      { code: "E131", desc: "Temperature sensor error" },
      { code: "E20", desc: "Internal error — PCB fault" }
    ]
  },
  potterton: {
    name: "Potterton Boilers",
    codes: [
      { code: "E119", desc: "Low system water pressure" },
      { code: "E133", desc: "Ignition fault — gas issue" },
      { code: "E125", desc: "Circulation fault or pump issue" },
      { code: "E160", desc: "Fan or air pressure fault" },
      { code: "E168", desc: "Control board error" }
    ]
  },
  glowworm: {
    name: "Glow-worm Boilers",
    codes: [
      { code: "F1", desc: "Low system water pressure" },
      { code: "F3", desc: "Fan speed error" },
      { code: "F4", desc: "Ignition failure", action: "This usually needs attention from an engineer. <a href='/contact.html'>Book a visit</a>." },
      { code: "F5", desc: "Overheat lockout" },
      { code: "F9", desc: "PCB or sensor communication fault" },
      { code: "F11", desc: "Flow temperature sensor fault" },
      { code: "F12", desc: "Return temperature sensor fault" }
    ]
  },
  ariston: {
    name: "Ariston Boilers",
    codes: [
      { code: "501", desc: "Ignition failure — no flame detected" },
      { code: "302", desc: "Fan or air pressure switch fault" },
      { code: "108", desc: "Low water pressure — refill needed", action: "Try re-pressurising the system if you’re confident. <a href='https://www.youtube.com/results?search_query=ariston+boiler+108+pressure' target='_blank' rel='noopener'>Watch how here.</a>" },
      { code: "103", desc: "Overheat or circulation fault" },
      { code: "504", desc: "Flame signal lost during operation" },
      { code: "101", desc: "NTC thermistor fault" },
      { code: "601", desc: "Communication error — PCB or display issue" }
    ]
  },
  alpha: {
    name: "Alpha Boilers",
    codes: [
      { code: "E10", desc: "Low system pressure" },
      { code: "E20", desc: "Flow sensor or pump fault" },
      { code: "E25", desc: "Overheat — circulation issue" },
      { code: "E28", desc: "Flame loss" },
      { code: "E34", desc: "Air pressure switch fault" },
      { code: "E37", desc: "Flow temperature sensor fault" },
      { code: "E99", desc: "PCB fault or power issue" }
    ]
  },
  viessmann: {
    name: "Viessmann Boilers",
    codes: [
      { code: "F2", desc: "Flame failure — ignition fault" },
      { code: "F4", desc: "Overheat lockout — high limit thermostat" },
      { code: "A9", desc: "Return temperature sensor fault" },
      { code: "F9", desc: "Communication issue with display or control board" },
      { code: "E6", desc: "Fan or air pressure sensor fault" },
      { code: "A3", desc: "Flow sensor or NTC fault" },
      { code: "E0", desc: "Low system water pressure", action: "You can often fix this by topping up the pressure — check your user manual or <a href='https://www.youtube.com/results?search_query=viessmann+boiler+pressure+low' target='_blank' rel='noopener'>watch this guide</a>." }
    ]
  }
};


function showFaultCodes(brand) {
  const data = faultData[brand];
  document.getElementById("manufacturer-section").style.display = "none";
  document.getElementById("faultcode-section").style.display = "block";
  document.getElementById("brand-title").textContent = data.name;

  const grid = document.getElementById("faultcode-grid");
  grid.innerHTML = "";

  data.codes.forEach(item => {
    const tile = document.createElement("div");
    tile.className = "fault-tile";
    tile.innerHTML = `<h3>${item.code}</h3><p>${item.desc}</p>`;

    if (item.action) {
      const actionEl = document.createElement("div");
      actionEl.style.display = "none";
      actionEl.classList.add("action-text");
      actionEl.innerHTML = `
        <p class="advice-body">${item.action}</p>
        <a href="#" class="hide-advice-link">Hide advice</a>
      `;

      const toggleMsg = document.createElement("p");
      toggleMsg.textContent = "Show advice";
      toggleMsg.classList.add("toggle-msg");

      tile.appendChild(toggleMsg);
      tile.appendChild(actionEl);

      const expandTile = () => {
        actionEl.style.display = "block";
        toggleMsg.textContent = "";
        tile.classList.add("expanded");
        tile.removeEventListener("click", expandTile);
      };
      tile.addEventListener("click", expandTile);

      const attachLinkGuards = () => {
        actionEl.querySelectorAll("a").forEach(link => {
          link.addEventListener("click", e => e.stopPropagation());
        });
      };
      attachLinkGuards();

      actionEl.querySelector(".hide-advice-link").addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        actionEl.style.display = "none";
        toggleMsg.textContent = "Show advice";
        tile.classList.remove("expanded");
        tile.addEventListener("click", expandTile);
      });
    }

    grid.appendChild(tile);
  });

  const contactTile = document.createElement("div");
  contactTile.className = "fault-tile";
  contactTile.innerHTML = `<h3>Code not here?</h3><p><a href="/contact.html">Get in touch with us</a> for expert help.</p>`;
  grid.appendChild(contactTile);

  document.getElementById("search-bar-container").style.display =
    data.codes.length > 1 ? "flex" : "none";
}


function goBackToManufacturers() {
  document.getElementById("manufacturer-section").style.display = "block";
  document.getElementById("faultcode-section").style.display = "none";
  document.getElementById("fault-search").value = "";
}

function filterFaultCodes() {
  const searchValue = document.getElementById("fault-search").value.toLowerCase();
  const tiles = document.querySelectorAll("#faultcode-grid .fault-tile");
  tiles.forEach(tile => {
    const text = tile.textContent.toLowerCase();
    const isContactTile = tile.innerHTML.includes("Get in touch");
    tile.style.display = text.includes(searchValue) || isContactTile ? "" : "none";
  });
}

