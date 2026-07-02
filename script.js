// Store the loaded document data globally
let originalFileBytes = null;
let originalFileName = "";
let totalPages = 0;

// --- UI Elements ---
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const chooseBtn = document.getElementById('choose-btn');
const outputContainer = document.getElementById('output-container');
const modal = document.getElementById('processing-modal');

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

// --- Drag and Drop Logic ---
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
        renderUI();

    } catch (error) {
        console.error("Error reading PDF:", error);
        alert("Could not process this PDF. It may be corrupted or encrypted.");
    }
    
    modal.style.display = 'none';
}

// --- Render the UI (Cards for each page) ---
function renderUI() {
    outputContainer.innerHTML = '';

    for (let i = 0; i < totalPages; i++) {
        const card = document.createElement('div');
        card.className = 'pdf-card';

        // Displaying page numbers instead of filenames
        card.innerHTML = `
            <div class="pdf-icon">📄</div>
            <div class="pdf-name">Page ${i + 1}</div>
            <button class="download-btn" onclick="extractPage(${i})">⬇ Download</button>
        `;
        
        outputContainer.appendChild(card);
    }
}

// --- Extract and Download Specific Page ---
window.extractPage = async function(pageIndex) {
    if (!originalFileBytes) return;
    
    try {
        const { PDFDocument } = PDFLib;
        
        // Load the original doc
        const originalDoc = await PDFDocument.load(originalFileBytes);
        
        // Create a new empty doc
        const newDoc = await PDFDocument.create();
        
        // Copy just the chosen page (pdf-lib uses 0-based indexing)
        const [copiedPage] = await newDoc.copyPages(originalDoc, [pageIndex]);
        newDoc.addPage(copiedPage);

        // Save and trigger browser download
        const newPdfBytes = await newDoc.save();
        download(newPdfBytes, `${originalFileName}_Page_${pageIndex + 1}.pdf`, "application/pdf");
        
    } catch (error) {
        console.error("Error extracting page:", error);
        alert("Failed to extract page.");
    }
}
