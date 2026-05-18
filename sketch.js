/* cc teddavis.org
*/

var credits = { 
    names : [ 
        'Lucie Lin',
        'Alina Prokopchuk' 
    ],
    class : 'IDCE HGK – MA – Digital Cultures',
    description : 'interactive pottery generator; a digital ceramics studio powered by p5.js & hydra.' 
} 

let libs = [
    'https://unpkg.com/hydra-synth', 
    'includes/libs/hydra-synth.js',
    'https://unpkg.com/@supabase/supabase-js@2'
];

const supabaseUrl = 'https://yqdbhkqucvvyurfddbvp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZGJoa3F1Y3Z2eXVyZmRkYnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTQ5NTYsImV4cCI6MjA5NDE3MDk1Nn0.kHlRCIlcQ6_vuGLfYknUMfERq-Xq0i1SHnY9WHZsMqQ';
let supabaseClient;

let overGUI = false;
let isGalleryOpen = false;
let galleryItems = [];

let hc = document.createElement('canvas');
hc.height = 360;
let hydra = new Hydra({
    detectAudio: false,
    canvas: hc      
});
noize = hydra.synth.noise;

let button;
let mline = [],
    pline = [],
    polyline = [],
    textureImg; 
    
osc(35, 0.1, 0.8)
    .mask(osc(20, 0.1).rotate(() => Slider1.value() * 0.1)) 
    .repeatY(() => Slider3.value())
    .kaleid(() => Slider1.value())
    .colorama(() => Slider2.value()) 
    .modulate(noize(3, 0.1), () => Slider2.value())
    .modulateScale(osc(2).kaleid(3), () => Slider4.value() / 255)
    .blend(o0, () => Slider4.value() / 300)
    .out();

function preload() {}

function initSupabase() {
    if (!supabaseClient && window.supabase) {
        supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
    }
}

function setup() {
    setAttributes('preserveDrawingBuffer', true);
    createCanvas(windowWidth, windowHeight, WEBGL);
    pixelDensity(1);
    
    initSupabase();
    fetchGalleryItems();

    genLathe();
    angleMode(DEGREES);
    buildGUI();
    buildGalleryDOM();
    pg = createGraphics(hc.width, hc.height);
}

function draw() {
    background(15);
    
    push();
    translate(-width / 2, -height / 2); 
    stroke(100);
    noFill();
    
    let canInteract = !overGUI && !isGalleryOpen;

    if (mouseIsPressed && frameCount % 4 == 0 && !overGUI) {
        mline.push([mouseX, mouseY]); 
    }

    if (mouseIsPressed && !overGUI && mline.length > 3) { 
        beginShape();
        for (let l of mline) curveVertex(l[0], l[1]); 
        endShape();
    }
    pop();

    pg.clear();
    pg.drawingContext.drawImage(hc, 0, 0, pg.width, pg.height);
    texture(pg);

    push();
    rotateX(-35);
    rotateY(frameCount / 10); 
    
    // 👑 修正：動態縮放陶罐，確保在手機版不會太大擋住 UI
    let scaleF = windowWidth < 992 ? (windowWidth / 850) : 0.85;
    scale(scaleF);

    lights();
    ambientLight(50);
    noStroke();
    if (m) model(m);
    pop();
}

function mousePressed() {
    if (!overGUI) mline = [];
}

function mouseReleased() {
    if (!overGUI && mline.length > 3) {
        pline = mline.map(l => [l[0] / width, l[1] / height]);
        m = lathe(pline);
    }
}

function saveImage(){ save("myimage.png"); }

function touchMoved() { if (!overGUI) return false; }

function keyPressed() {
    if (keyCode === 32 && mline.length > 3) m = lathe(mline);
    if (key === 's' || key === 'S') saveCanvas('MyPottery', 'png'); 
}

function genLathe() {
    let presetCurve = [];
    for (let i = 0; i <= 30; i++) {
        let shapeT = map(i, 0, 30, 0.15, 0.85); 
        let y = map(i, 0, 30, 0.25, 0.75); 
        let x = 0.22 + 0.12 * Math.sin(shapeT * Math.PI) + 0.06 * Math.cos(shapeT * Math.PI * 3);
        presetCurve.push([Math.abs(x), y]);
    }
    m = lathe(presetCurve, 30, 750, 750); 
}

function lathe(points, detail = 20, width = 750, height = 750) {
    let angle = TWO_PI / detail;
    return new p5.Geometry(
        detail,
        points.length - 1,
        function createLatheGeometry() {
            for (let pt of points) {
                let y = map(pt[1], 0, 1, -height / 2, height / 2);
                let rad = map(pt[0], 0, 1, 0, width / 2);
                for (let i = 0; i <= detail; i++) {
                    let x = Math.sin(i * angle) * rad;
                    let z = Math.cos(i * angle) * rad;
                    let u = map(i, 0, detail, 0, 1);
                    let v = map(pt[1], 0, 1, 0, 1);
                    this.vertices.push(new p5.Vector(x, y, z));
                    this.uvs.push(u, v); 
                }
            }
            this.computeFaces();
            this.computeNormals();
            this.gid = `lathe|${points.map((pt) => pt.join(",")).join(";")}|${detail}|${width}|${height}`;
        }
    );
}

async function fetchGalleryItems() {
    initSupabase(); 
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('gallery_items')
            .select('image_url')
            .order('created_at', { ascending: false })
            .limit(30); 
        if (error) throw error;
        if (data) {
            galleryItems = data.map(item => item.image_url);
            if (isGalleryOpen) renderGalleryItems();
        }
    } catch (err) {}
}

function dataURLtoBlob(dataurl) {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new Blob([u8arr], { type: mime });
}

async function publishArtifact() {
    initSupabase(); 
    let btn = select('.publish-btn');
    if (!supabaseClient) { alert("Loading..."); return; }
    if (!btn) return;
    btn.html('⏳ Uploading...');
    btn.attribute('disabled', 'true');

    try {
        let sourceCanvas = document.querySelector('canvas');
        let cropCanvas = document.createElement('canvas');
        let cropSize = 600; 
        cropCanvas.width = cropSize;
        cropCanvas.height = cropSize;
        let ctx = cropCanvas.getContext('2d');
        let captureSize = Math.min(sourceCanvas.width, sourceCanvas.height) * 0.65; 
        let startX = (sourceCanvas.width - captureSize) / 2;
        let startY = (sourceCanvas.height - captureSize) / 2;

        ctx.drawImage(sourceCanvas, startX, startY, captureSize, captureSize, 0, 0, cropSize, cropSize);

        let dataURL = cropCanvas.toDataURL('image/png');
        let blob = dataURLtoBlob(dataURL);
        let fileName = `artifact_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;

        const { error: uploadError } = await supabaseClient
            .storage.from('artifacts').upload(fileName, blob, { contentType: 'image/png', cacheControl: '3600' });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabaseClient.storage.from('artifacts').getPublicUrl(fileName);
        let publicUrl = publicUrlData.publicUrl;

        const { error: dbError } = await supabaseClient
            .from('gallery_items').insert([{ image_url: publicUrl }]);
        if (dbError) throw dbError;

        btn.html('✨ Published!');
        btn.removeAttribute('disabled');
        await fetchGalleryItems();
        if (!isGalleryOpen) toggleGallery(); 
        setTimeout(() => { btn.html('Publish'); }, 2000);

    } catch (err) {
        btn.html('❌ Error');
        btn.removeAttribute('disabled');
        setTimeout(() => { btn.html('Publish'); }, 2000);
    }
}

function buildGUI() {
    guiHolder = createDiv('').class('guiholder');
    
    let topSection = createDiv().parent(guiHolder).class('panel gui-top');
    
    let brandBox = createDiv().parent(topSection).class('grid-cell brand-box');
    createDiv('Pottery.gen').parent(brandBox).style('font-size', '16pt').style('font-weight', 'bold').style('letter-spacing', '2px').style('color', '#fff');
    createDiv('Digital Ceramics Studio').parent(brandBox).style('font-size', '9pt').style('color', '#999').style('margin-top', '4px').style('letter-spacing', '0.5px');

    let infoBox = createDiv().parent(topSection).class('grid-cell info-box');
    createDiv('<b>Sculpt</b>// draw a line to mold your clay.<br><b>Glaze</b>// slide around to mix your colors.').parent(infoBox).style('font-size', '9pt').style('line-height', '1.6').style('color', '#ddd');
    
    createButton('✦ Explore Gallery ✦ ')
        .parent(infoBox) 
        .class('gallery-toggle-btn')
        .mousePressed(toggleGallery);

    let actionBox = createDiv().parent(topSection).class('grid-cell action-box');
    createButton('Save').parent(actionBox).class('btn save-btn').mousePressed(() => saveCanvas('pottery_gen', 'png'));
    createButton('Publish').parent(actionBox).class('btn publish-btn').mousePressed(publishArtifact);

    let sliderSection = createDiv().parent(guiHolder).class('panel gui-sliders');

    function createCustomSlider(min, max, defaultVal, step, labelText) {
        let sliderWrapper = createDiv().parent(sliderSection).class('grid-cell slider-wrapper');
        createDiv(labelText).parent(sliderWrapper).class('label');
        return createSlider(min, max, defaultVal, step).parent(sliderWrapper).class('slider');
    }
    
    Slider1 = createCustomSlider(1, 20, 8, 1, '✿ fractal ✿');    
    Slider2 = createCustomSlider(0, 1, 0.05, 0.01, '≈ spectrum ≈'); 
    Slider3 = createCustomSlider(1, 15, 1, 1, '≡ layers ≡');     
    Slider4 = createCustomSlider(0, 100, 20, 1, '≋ liquid ≋');

    let panels = [topSection, sliderSection];
    for(let p of panels) {
        p.mouseOver(() => { overGUI = true; });
        p.mouseOut(() => { overGUI = false; });
        p.touchStarted(() => { overGUI = true; }); 
        p.touchEnded(() => { overGUI = false; });
    }

    createElement('style', `
        body { margin: 0; padding: 0; overflow: hidden; user-select: none; -webkit-user-select: none; background-color: #050505; }
        
        .guiholder { position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh; padding: 20px 40px; z-index: 999; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; box-sizing: border-box; }
        
   
        .panel { pointer-events: auto; background: rgba(12, 12, 14, 0.70); backdrop-filter: blur(12px) saturate(120%); -webkit-backdrop-filter: blur(12px) saturate(120%); border: 1px solid rgba(255, 255, 255, 0.08); border-top: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5); font-family: 'Courier New', Courier, monospace; box-sizing: border-box; transition: border-color 0.4s ease; padding: 12px 20px; }
        .panel:hover { border-color: rgba(255, 255, 255, 0.18); }

        @media (min-width: 993px) {
            .gui-top { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: start; gap: 20px; width: 100%; max-width: 1100px; margin: 0 auto; }
            .gui-sliders { display: grid; grid-template-columns: repeat(4, 1fr); align-items: center; gap: 25px; width: 100%; max-width: 900px; margin: 0 auto; padding: 18px 25px; }
            .action-box { align-self: center; } 
        }

        @media (max-width: 992px) { 
            .guiholder { padding: 10px 4% 35px 4%; justify-content: space-between; }
            .panel { width: 100%; padding: 10px 14px; margin: 0; }
            

            .gui-top { 
                display: grid; 
                grid-template-columns: 1fr auto; 
                grid-template-areas: "brand action" "info info"; 
                gap: 6px; /
                align-items: center;
            }
            .brand-box { grid-area: brand; text-align: left !important; }
            .action-box { grid-area: action; justify-content: flex-end; }
            .info-box { grid-area: info; text-align: left !important; margin-top: 2px; }

            .gui-sliders { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 12px 14px; }
            

            .brand-box > div:nth-child(1) { font-size: 13pt !important; } 
            .brand-box > div:nth-child(2) { font-size: 7.5pt !important; margin-top: 2px !important;} 
            .info-box > div:first-child { font-size: 8pt !important; line-height: 1.4 !important; } 
            .btn { padding: 5px 10px !important; font-size: 8.5pt !important; }
            .gallery-toggle-btn { margin-top: 4px !important; font-size: 8.5pt !important; }
            
            .gallery-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
        }

        .brand-box { text-align: left; }
        .info-box { text-align: left; }
        .slider-wrapper { text-align: center; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        
        .gallery-toggle-btn { background: none; border: none; color: #c3b1fd; font-family:'Courier New', Courier, monospace; font-size: 9pt; font-weight: bold; letter-spacing: 1px; padding: 0; margin-top: 8px; cursor: pointer; transition: opacity 0.2s; display: inline-block; }
        .gallery-toggle-btn:hover { opacity: 0.8; text-decoration: underline; }
        
        .action-box { display: flex; justify-content: flex-end; gap: 8px; align-items: center; }
        .btn { cursor: pointer; font-family:'Courier New', Courier, monospace; font-size: 9.5pt; font-weight: bold; letter-spacing: 0.5px; padding: 6px 14px; border-radius: 6px; transition: all 0.2s; outline: none; }
        .save-btn { background: rgba(255, 255, 255, 0.1); color: #eee; border: 1px solid rgba(255, 255, 255, 0.2); }
        .save-btn:hover { background: rgba(255, 255, 255, 0.2); color: #fff; transform: scale(1.05); }
        .publish-btn { background: rgba(247, 135, 255, 0.13); color: rgb(195, 177, 253); border: 1px solid rgba(195, 177, 253, 0.4); }
        .publish-btn:hover:not([disabled]) { background: #c3b1fd; color: #050505; box-shadow: 0 0 10px rgba(195, 177, 253, 0.6); transform: scale(1.05); }
        .publish-btn[disabled] { opacity: 0.6; cursor: wait; }
        
        .label { color: #eeeeee; font-size: 9pt; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
        .slider { -webkit-appearance: none; appearance: none; width: 100%; height: 3px; background: rgba(255, 255, 255, 0.18); border-radius: 2px; outline: none; cursor: pointer; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 6px rgba(255, 255, 255, 0.4); transition: transform 0.2s; }
        .slider::-webkit-slider-thumb:hover { transform: scale(1.35); }
        
        .gallery-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh; background: rgba(5, 5, 7, 0.85); backdrop-filter: blur(25px); z-index: 1000; display: flex; flex-direction: column; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.4s ease; }
        .gallery-overlay.active { opacity: 1; pointer-events: auto; }
        .gallery-header { width: 80%; max-width: 1200px; display: flex; justify-content: space-between; align-items: center; padding: 40px 0 20px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
        .gallery-title { color: #fff; font-family:'Courier New', Courier, monospace; font-size: 14pt; font-weight: bold; letter-spacing: 2px; }
        .gallery-close-btn { background: rgba(255,255,255,0.1); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; font-size: 12pt; cursor: pointer; }
        .gallery-grid { width: 80%; max-width: 1200px; flex: 1; margin: 30px 0 60px 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; overflow-y: auto; padding-right: 10px; }
        .gallery-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; overflow: hidden; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; position: relative; transition: transform 0.3s; cursor: pointer; }
        .gallery-card:hover { transform: translateY(-3px); border-color: rgba(195, 177, 253, 0.4); }
        .gallery-card img { width: 100%; height: 100%; object-fit: cover; }
        
        .lightbox { position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh; background: rgba(0,0,0,0.9); z-index: 2000; display: none; align-items: center; justify-content: center; cursor: zoom-out; }
        .lightbox.active { display: flex; }
        .lightbox img { max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 0 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); }
    `);
}

function buildGalleryDOM() {
    let overlay = createDiv('').class('gallery-overlay').id('galleryOverlay');
    let header = createDiv().parent(overlay).class('gallery-header');
    createDiv('Pottery.gen Gallery').parent(header).class('gallery-title');
    createButton('✕').parent(header).class('gallery-close-btn').mousePressed(toggleGallery);
    createDiv().parent(overlay).class('gallery-grid').id('galleryGrid');
    
    overlay.mouseOver(() => { overGUI = true; });
    overlay.mouseOut(() => { overGUI = false; });
    let lb = createDiv('').class('lightbox').id('lightbox').mousePressed(closeLightbox);
    createImg('').parent(lb).id('lightboxImg');
}

function renderGalleryItems() {
    let grid = select('#galleryGrid');
    if (!grid) return;
    grid.html(''); 
    for (let url of galleryItems) {
        let card = createDiv().parent(grid).class('gallery-card');
        createImg(url, 'artifact').parent(card);
        card.mousePressed(() => openLightbox(url));
    }
}
function openLightbox(url) {
    select('#lightboxImg').attribute('src', url);
    select('#lightbox').addClass('active');
}

function closeLightbox() {
    select('#lightbox').removeClass('active');
}

function toggleGallery() {
    isGalleryOpen = !isGalleryOpen;
    let overlay = select('#galleryOverlay');
    if (isGalleryOpen) { overlay.addClass('active'); fetchGalleryItems(); } 
    else { overlay.removeClass('active'); }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}