async function load_font_file() {
    let file = document.getElementById('fontFile');
    if (!file || !file.files[0]) {
        showError('No font file selected', 'Please choose a TTF/OTF file before uploading.');
        return;
    }
    let bufr = await file.files[0].arrayBuffer();

    if (typeof Module === 'undefined' || !Module.FS) {
        showError('Runtime not ready', 'WebAssembly runtime is not initialized. Wait for initialization (pre-wasm) and try again.');
        return;
    }

    try         { Module.FS.mkdir('/work'); }
    catch (err) { /* directory already exits */ }

    console.log("about to write font file");
    Module.FS.writeFile('/work/temp.ttf', new Uint8Array(bufr));
    console.log("wrote font file");
    // TODO: actually run cpp code with uploaded file
}

// Call the font_ratios API and log the result
function getFontRatios() {
    const handleResult = (r) => {
        console.log("Font Ratios:", r);
        let parsed = r;
        try {
            if (typeof r === 'string') parsed = JSON.parse(r);
        } catch (err) {
            console.error('Failed to parse response', err);
            return;
        }
        const ratios = (parsed && parsed.ratios) ? parsed.ratios : parsed;
        renderRatiosTable(ratios);
    };

    if (typeof sendReq !== 'function') { showError('Runtime not ready', 'Backend API (sendReq) is not available yet. Make sure the wasm/app is initialized.'); return; }
    let res = sendReq({ "font_ratios": true });
    if (res && typeof res.then === 'function') {
        res.then(handleResult).catch(e => {
            console.error(e);
            showError('Request failed', e && e.message ? e.message : String(e));
        });
    } else if (res) {
        handleResult(res);
    }
}

function codepointKeyToChar(key) {
    const cp = Number(key);
    if (!Number.isFinite(cp)) return key;
    try { return String.fromCodePoint(cp); }
    catch (e) { return key; }
}

function renderRatiosTable(ratios) {
    const container = document.getElementById('ratios-container');
    if (!container) return;
    // Clear
    container.innerHTML = '';
    if (!ratios || Object.keys(ratios).length === 0) {
        container.textContent = 'No ratios to show';
        return;
    }
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = '8px';
    const thead = document.createElement('thead');
    const hrow = document.createElement('tr');
    ['Character', 'Codepoint', 'Ratio'].forEach(t => {
        const th = document.createElement('th');
        th.textContent = t;
        th.style.border = '1px solid #ccc';
        th.style.padding = '4px 8px';
        th.style.background = '#f6f6f6';
        hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    Object.keys(ratios).forEach(key => {
        const ratioVal = ratios[key];
        const row = document.createElement('tr');
        const charCell = document.createElement('td');
        charCell.textContent = codepointKeyToChar(key);
        const cpCell = document.createElement('td');
        cpCell.textContent = key;
        const ratioCell = document.createElement('td');
        ratioCell.textContent = (typeof ratioVal === 'object' && ratioVal.value) ? ratioVal.value : ratioVal;
        [charCell, cpCell, ratioCell].forEach(td => {
            td.style.border = '1px solid #ddd';
            td.style.padding = '4px 8px';
        });
        row.appendChild(charCell);
        row.appendChild(cpCell);
        row.appendChild(ratioCell);
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

window.addEventListener("load", (event) => {
    document.getElementById("fontFile").addEventListener("change", load_font_file);
    // Ensure canvas exists inside #text
    let textDiv = document.getElementById('text');
    if (textDiv && !document.getElementById('glyph-canvas')) {
        let canvas = document.createElement('canvas');
        canvas.id = 'glyph-canvas';
        textDiv.appendChild(canvas);
    }

    // Add event listener for font ratios button
    let ratiosBtn = document.getElementById('font-ratios-btn');
    if (ratiosBtn) {
        ratiosBtn.addEventListener('click', getFontRatios);
    }
});


function showBitmapCanvas(values) {
    const canvas = document.getElementById('glyph-canvas');
    if (!canvas) return;
    if (!values || !values.length) {
        canvas.width = 1;
        canvas.height = 1;
        return;
    }
    const w = values[0].length, h = values.length;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const v = values[y][x];
            if (v === 2) {
                // Red for shortest
                img.data[idx + 0] = 255;
                img.data[idx + 1] = 0;
                img.data[idx + 2] = 0;
            } else if (v === 3) {
                // Green for longest
                img.data[idx + 0] = 0;
                img.data[idx + 1] = 200;
                img.data[idx + 2] = 0;
            } else if (v === 1) {
                // Black for normal mask
                img.data[idx + 0] = 0;
                img.data[idx + 1] = 0;
                img.data[idx + 2] = 0;
            } else {
                // White for background
                img.data[idx + 0] = 255;
                img.data[idx + 1] = 255;
                img.data[idx + 2] = 255;
            }
            img.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
}

function say_hello() {
    console.log("about to run");
    const char = document.getElementById('charInput').value || "A";
    if (typeof sendReq !== 'function') { showError('Runtime not ready', 'Backend API (sendReq) is not available yet.'); return; }
    let res = sendReq({
        "font": { "char": char }
    });
    // If sendReq is async, use .then; otherwise, handle directly like this
    // if (res && typeof res.then === 'function') {
    if (!res) return;
    const handleResp = (body) => {
        console.log('response', body);
        let parsed = body;
        try { if (typeof body === 'string') parsed = JSON.parse(body); }
        catch (err) { showError('Malformed response', String(body)); return; }

        // Detect error responses from backend: status !== 'complete' or explicit failure
        if (parsed && parsed.status && parsed.status !== 'complete') {
            const msg = parsed.action ? `${parsed.action}: ${parsed.status}` : parsed.status;
            showError('Backend error', msg);
            return;
        }

        if (parsed && parsed.values) {
            showBitmapCanvas(parsed.values);
        } else {
            showError('No glyph data', JSON.stringify(parsed));
        }
    };

    if (typeof res.then === 'function') {
        res.then(handleResp).catch(e => { console.error(e); showError('Request failed', e && e.message ? e.message : String(e)); });
    } else {
        handleResp(res);
    }
}

// Modal helper functions
function showError(title, details) {
    const modal = document.getElementById('error-modal');
    const msg = document.getElementById('error-message');
    const pre = document.getElementById('error-details');
    if (!modal || !msg) {
        alert(title + '\n' + details);
        return;
    }
    msg.textContent = title;
    if (details) { pre.style.display = 'block'; pre.textContent = details; } else { pre.style.display = 'none'; }
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden','false');
}

function hideError() {
    const modal = document.getElementById('error-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
}

window.addEventListener('load', () => {
    const errClose = document.getElementById('error-close');
    const modal = document.getElementById('error-modal');
    if (errClose) errClose.addEventListener('click', hideError);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) hideError(); });
});
