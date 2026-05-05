let currentStep = 1;
let path = 'full';

const FORMSPREE_QUICK = "https://formspree.io/f/xbdwodnp"; 
const FORMSPREE_FULL = "https://formspree.io/f/xaqvoqdy";

function updateProgress() {
    const container = document.getElementById('mainProgressContainer');
    const fill = document.getElementById('progressFill');
    if (currentStep === 1) {
        container.classList.remove('visible');
        return;
    }
    container.classList.add('visible');
    const labelSetId = (path === 'quick') ? 'labels-quick' : 'labels-full';
    document.getElementById('labels-quick').style.display = (path === 'quick') ? 'flex' : 'none';
    document.getElementById('labels-full').style.display = (path === 'full') ? 'flex' : 'none';

    const labels = document.querySelectorAll(`#${labelSetId} span`);
    const totalPathSteps = labels.length;
    let stepIndex = 0;
    if (path === 'quick') {
        if (currentStep === 2) stepIndex = 1;
        if (currentStep === 7) stepIndex = 2;
        if (currentStep === 8) stepIndex = 3;
        if (currentStep === 9) stepIndex = 4;
    } else {
        stepIndex = currentStep - 1; 
    }
    const percentage = (stepIndex / totalPathSteps) * 100;
    fill.style.width = `${percentage}%`;
    labels.forEach((l, i) => l.classList.toggle('active', (i + 1) <= stepIndex));
}

function setFormPath(choice) {
    path = choice;
    document.getElementById('experienceForm').action = (path === 'quick') ? FORMSPREE_QUICK : FORMSPREE_FULL;
    document.getElementById('pathInput').value = choice;
    nextStep();
}

/**
 * NEW: Manual Validation Check
 * Checks if required fields in the CURRENT visible step are filled.
 */
function validateCurrentStep() {
    const currentSection = document.querySelector(`[data-step="${currentStep}"]`);
    const requiredInputs = currentSection.querySelectorAll('[required]');
    let isValid = true;

    requiredInputs.forEach(input => {
        if (!input.value.trim()) {
            input.style.borderColor = "red";
            isValid = false;
        } else {
            input.style.borderColor = "#ccc";
        }
    });

    if (!isValid) alert("Please fill in all required fields before continuing.");
    return isValid;
}

function nextStep() {
    // Only validate if we are past the choice screen
    if (currentStep > 1 && !validateCurrentStep()) return;

    document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');
    
    if (currentStep === 2 && path === 'quick') currentStep = 7;
    else if (currentStep === 6 && path === 'full') currentStep = 7;
    else currentStep++;

    document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevStep() {
    document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');
    if (currentStep === 7 && path === 'quick') currentStep = 2;
    else if (currentStep === 9) currentStep = 8;
    else currentStep--;

    document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');
    updateProgress();
}

function togglePartnerFields() {
    const val = document.getElementById('serviceSource').value;
    document.getElementById('partnerFields').classList.toggle('open', val === 'partner');
}
function toggleOtherRepair(sel) {
    document.getElementById('otherRepair').style.display = (sel.value === 'other') ? 'block' : 'none';
}
function toggleFollowUp(show) { document.getElementById('followUpGroup').classList.toggle('open', show); }
function toggleRepFields(show) { document.getElementById('repFields').classList.toggle('open', show); }

function showReviewPage() {
    if (!validateCurrentStep()) return;

    const summary = document.getElementById('reviewSummary');
    const form = document.getElementById('experienceForm');
    summary.innerHTML = '';
    const formData = new FormData(form);

    form.querySelectorAll('[data-label]').forEach(input => {
        const label = input.getAttribute('data-label');
        const val = formData.get(input.name);
        
        // Logical filter to only show what the user actually filled
        const isPartner = input.name.includes('partner_') || input.name.includes('main_');
        const isRepair = input.name.includes('eng_') || input.name.includes('repair_') || input.name.includes('return_');

        if (path === 'quick' && (isPartner || isRepair)) return;

        if (val && val !== "" && val !== "on") {
            const div = document.createElement('div');
            div.className = 'summary-item';
            div.innerHTML = `<strong>${label}</strong> <span>${val}</span>`;
            summary.appendChild(div);
        }
    });

    document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');
    currentStep = 9;
    document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');
    updateProgress();
}

document.getElementById('experienceForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.innerText = "Sending...";
    submitBtn.disabled = true;

    try {
        const res = await fetch(this.action, { 
            method: 'POST', 
            body: new FormData(this), 
            headers: { 'Accept': 'application/json' } 
        });

        if (res.ok) {
            document.querySelector(`[data-step="9"]`).classList.remove('active');
            currentStep = 10;
            document.querySelector(`[data-step="10"]`).classList.add('active');
            updateProgress();
            
            setTimeout(() => { window.location.href = 'index.html'; }, 4000);
        } else {
            alert("We are really sorry. There seems to be an issue our end. Please email us directly letting us know there is a FORM ERROR - we will report it immediately to our IT Team. We sincerely apologise for this error. If you would still like to pass on your feedback, please email us at info@warmright.uk");
            submitBtn.innerText = "Submit Feedback";
            submitBtn.disabled = false;
        }
    } catch (err) {
        alert("Network Error. Please check your connection. If the problem persists, please let us know at info@warright.uk");
        submitBtn.innerText = "Submit Feedback";
        submitBtn.disabled = false;
    }
});