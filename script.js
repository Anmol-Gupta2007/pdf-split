// Global State
let originalFileBytes = null;
let originalFileName = "";
let totalPages = 0;
let pagesToRemove = new Set(); 

// --- UI Elements ---
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const chooseBtn = document.getElementById('choose-btn');
const outputContainer = document.getElementById('output-container');
const actionBar = document.getElementById('action-bar');
const statusText = document.getElementById('status-text');
const downloadFinalBtn = document.getElementById('download-final-btn');
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
    pagesToRemove.clear(); 

    try {
        originalFileBytes = await file.arrayBuffer();
        
        // 1. Get total pages using pdf-lib
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(originalFileBytes);
        totalPages = pdfDoc.getPageCount();
        
        actionBar.style.display = 'block';
        updateStatusText();
        
        // 2. Render the visual previews using pdf.js
        await renderPreviews();

    } catch (error) {
        console.error("Error reading PDF:", error);
        alert("Could not process this PDF. It may be corrupted or encrypted.");
    }
    
    modal.style.display = 'none';
}

// --- Render Visual Page Previews ---
async function renderPreviews() {
    outputContainer.innerHTML = '';

    // Load the document for viewing in pdf.js
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(originalFileBytes) });
    const pdfViewerDoc = await loadingTask.promise;

    for (let i = 0; i < totalPages; i++) {
        const card = document.createElement('div');
        card.className = 'pdf-card';
        card.id = `page-card-${i}`;

        // Create the card with an empty canvas
        card.innerHTML = `
            <canvas id="canvas-${i}" class="pdf-preview"></canvas>
            <div class="pdf-name">Page ${i + 1}</div>
            <button id="btn-${i}" class="toggle-btn btn-keep" onclick="togglePage(${i})">✔️ Keep Page</button>
        `;
        
        outputContainer.appendChild(card);

        // Render the PDF page onto the canvas
        try {
            const page = await pdfViewerDoc.getPage(i + 1);
            const canvas = document.getElementById(`canvas-${i}`);
            const context = canvas.getContext('2d');
            
            // Calculate scale (so the internal resolution matches our 160px height CSS)
            const unscaledViewport = page.getViewport({ scale: 1 });
            const scale = 160 / unscaledViewport.height; 
            const viewport = page.getViewport({ scale: scale });
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
        } catch (err) {
            console.error("Error rendering page", i, err);
        }
    }
}

// --- Instant Toggle Page State ---
window.togglePage = function(pageIndex) {
    const card = document.getElementById(`page-card-${pageIndex}`);
    const btn = document.getElementById(`btn-${pageIndex}`);

    if (pagesToRemove.has(pageIndex)) {
        // Restore the page
        pagesToRemove.delete(pageIndex); 
        card.classList.remove('removed-state');
        btn.className = 'toggle-btn btn-keep';
        btn.innerHTML = '✔️ Keep Page';
    } else {
        // Mark for removal
        pagesToRemove.add(pageIndex); 
        card.classList.add('removed-state');
        btn.className = 'toggle-btn btn-remove';
        btn.innerHTML = '❌ Removed';
    }
    
    updateStatusText();
}

function updateStatusText() {
    statusText.innerText = `${pagesToRemove.size} page(s) selected for removal out of ${totalPages}.`;
    
    if (pagesToRemove.size === totalPages) {
        statusText.innerText += " (You cannot remove all pages!)";
        statusText.style.color = "red";
    } else if (pagesToRemove.size > 0) {
        statusText.style.color = "#e74c3c";
    } else {
        statusText.style.color = "#554488";
    }
}

// --- Generate and Download Final PDF ---
downloadFinalBtn.addEventListener('click', async () => {
    if (!originalFileBytes) return;

    if (pagesToRemove.size === totalPages) {
        alert("You cannot remove all pages from the document. Please keep at least one page.");
        return;
    }

    if (pagesToRemove.size === 0) {
        alert("You haven't selected any pages to remove. The document is unchanged.");
    }

    modal.style.display = 'flex';

    try {
        const { PDFDocument } = PDFLib;
        const originalDoc = await PDFDocument.load(originalFileBytes);
        const newDoc = await PDFDocument.create();
        
        // Figure out which pages to KEEP
        const indicesToKeep = [];
        for (let i = 0; i < totalPages; i++) {
            if (!pagesToRemove.has(i)) {
                indicesToKeep.push(i);
            }
        }

        // Copy only the kept pages
        const copiedPages = await newDoc.copyPages(originalDoc, indicesToKeep);
        copiedPages.forEach((page) => newDoc.addPage(page));

        // Save and Trigger Download
        const newPdfBytes = await newDoc.save();
        download(newPdfBytes, `${originalFileName}_PagesRemoved.pdf`, "application/pdf");
        
    } catch (error) {
        console.error("Error creating updated PDF:", error);
        alert("Failed to remove pages and create PDF.");
    }
    
    modal.style.display = 'none';
});
