// Store the loaded document data globally
let originalFileBytes = null;
let originalFileName = "";
let totalPages = 0;

// --- UI Elements ---
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const chooseBtn = document.getElementById('choose-btn');
const outputContainer = document.getElementById('output-container');
const rangeSplitContainer = document.getElementById('range-split-container');
const modal = document.getElementById('processing-modal');

const splitInput = document.getElementById('split-input');
const splitInfo = document.getElementById('split-info');
const btnPart1 = document.getElementById('btn-part1');
const btnPart2 = document.getElementById('btn-part2');

// --- Helper: Download Function ---
function download(data, filename, type) {
    const blob = new Blob([data], { type: type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- Event Listeners for Uploading ---
chooseBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    fileInput.click();
});

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        processFile(e.target.files[0]);
    }
    fileInput.value = ''; 
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
    }
});

// --- Process Uploaded File ---
async function processFile(file) {
    if (file.type !== 'application/pdf') {
        alert("Please select a valid PDF file.");
        return;
    }

    modal.style.display = 'flex';
    originalFileName = file.name.replace('.pdf', '');

    try {
        originalFileBytes = await file.arrayBuffer();
        
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(originalFileBytes);
        
        totalPages = pdfDoc.getPageCount();
        
        // Show the UI elements now that we have a file
        rangeSplitContainer.style.display = 'block';
        splitInput.max = totalPages;
        splitInput.value = '';
        splitInfo.innerText = `Total Pages: ${totalPages}`;
        
        renderUI();

    } catch (error) {
        console.error("Error reading PDF:", error);
        alert("Could not process this PDF. It may be corrupted or encrypted.");
    }
    
    modal.style.display = 'none';
}

// --- NEW: Split into 2 Parts Logic ---

// Update text when user types a page number
splitInput.addEventListener('input', () => {
    const val = parseInt(splitInput.value);
    if (!val || val < 2 || val > totalPages) {
        splitInfo.innerText = `Please enter a valid number between 2 and ${totalPages}.`;
    } else {
        splitInfo.innerText = `Part 1: Pages 1 to ${val - 1} | Part 2: Pages ${val} to ${totalPages}`;
    }
});

// Download Part 1
btnPart1.addEventListener('click', () => downloadSplitPart(1));

// Download Part 2
btnPart2.addEventListener('click', () => downloadSplitPart(2));

async function downloadSplitPart(partNumber) {
    if (!originalFileBytes) return;

    const splitVal = parseInt(splitInput.value);
    if (isNaN(splitVal) || splitVal < 2 || splitVal > totalPages) {
        alert(`Please enter a valid page number to split at (between 2 and ${totalPages}).`);
        return;
    }

    modal.style.display = 'flex';

    try {
        const { PDFDocument } = PDFLib;
        const originalDoc = await PDFDocument.load(originalFileBytes);
        const newDoc = await PDFDocument.create();
        
        let startIdx, endIdx;
        
        if (partNumber === 1) {
            // If splitting AT page 5, Part 1 is pages 1 to 4 (Indices 0 to 3)
            startIdx = 0;
            endIdx = splitVal - 2; 
        } else {
            // Part 2 is pages 5 to total (Indices 4 to total-1)
            startIdx = splitVal - 1;
            endIdx = totalPages - 1;
        }

        // Gather the specific page indices we want
        const indicesToCopy = [];
        for (let i = startIdx; i <= endIdx; i++) {
            indicesToCopy.push(i);
        }

        // Copy and add to new doc
        const copiedPages = await newDoc.copyPages(originalDoc, indicesToCopy);
        copiedPages.forEach((page) => newDoc.addPage(page));

        // Save and Trigger Download
        const newPdfBytes = await newDoc.save();
        
        const label = partNumber === 1 ? `Pages_1_to_${splitVal - 1}` : `Pages_${splitVal}_to_${totalPages}`;
        download(newPdfBytes, `${originalFileName}_${label}.pdf`, "application/pdf");
        
    } catch (error) {
        console.error("Error splitting part:", error);
        alert("Failed to split PDF.");
    }
    
    modal.style.display = 'none';
}

// --- Extract and Download Individual Specific Pages (Existing UI) ---
function renderUI() {
    outputContainer.innerHTML = '';

    for (let i = 0; i < totalPages; i++) {
        const card = document.createElement('div');
        card.className = 'pdf-card';

        card.innerHTML = `
            <div class="pdf-icon">📄</div>
            <div class="pdf-name">Page ${i + 1}</div>
            <button class="download-btn" onclick="extractPage(${i})">⬇ Download</button>
        `;
        
        outputContainer.appendChild(card);
    }
}

window.extractPage = async function(pageIndex) {
    if (!originalFileBytes) return;
    
    modal.style.display = 'flex';

    try {
        const { PDFDocument } = PDFLib;
        const originalDoc = await PDFDocument.load(originalFileBytes);
        const newDoc = await PDFDocument.create();
        
        const [copiedPage] = await newDoc.copyPages(originalDoc, [pageIndex]);
        newDoc.addPage(copiedPage);

        const newPdfBytes = await newDoc.save();
        download(newPdfBytes, `${originalFileName}_Page_${pageIndex + 1}.pdf`, "application/pdf");
        
    } catch (error) {
        console.error("Error extracting page:", error);
        alert("Failed to extract page.");
    }

    modal.style.display = 'none';
}
