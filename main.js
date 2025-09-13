async function load_font_file() {
    let file = document.getElementById('fontFile');
    if (!file || !file.files[0]) {
        alert('no file!');
    }
    let bufr = await file.files[0].arrayBuffer();

    try         { Module.FS.mkdir('/work'); }
    catch (err) { /* directory already exits */ }

    console.log("about to write font file");
    Module.FS.writeFile('/work/temp.ttf', new Uint8Array(bufr));
    console.log("wrote font file");
    // TODO: actually run cpp code with uploaded file
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
    let res = sendReq({
        "font": { "char": char }
    });
    // If sendReq is async, use .then; otherwise, handle directly like this
    // if (res && typeof res.then === 'function') {
    if (res) {
        console.log(res);
        let response = JSON.parse(res);
        if (response && response.values) {
            showBitmapCanvas(response.values);
        }
    }
}
