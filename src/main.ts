import "./style.css"; 

const APP_NAME = "Sticker Sketchpad"; //


const app = document.querySelector<HTMLDivElement>("#app")!;


document.title = APP_NAME;
app.innerHTML = `
  <h1>${APP_NAME}</h1>
  <div class="canvas-container">
    <canvas id="drawingCanvas" width="256" height="256"></canvas>
    <button id="clearButton">Clear</button>
  </div>
`;


const canvas = document.querySelector<HTMLCanvasElement>("#drawingCanvas")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clearButton")!;
const ctx = canvas.getContext("2d");

let drawing = false; // initialize drawing state

// draw functions
function startDrawing(event: MouseEvent) {
  drawing = true;
  draw(event); 
}

// stop drawing when the mouse button is released or leaves the canvas
function stopDrawing() {
  drawing = false;
  ctx?.beginPath(); // reset the current drawing path
}

function draw(event: MouseEvent) {
  if (!drawing || !ctx) return;

  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "black";
  
  ctx.lineTo(event.offsetX, event.offsetY); 
  ctx.stroke();
  ctx.beginPath(); 
  ctx.moveTo(event.offsetX, event.offsetY); 
}

// set up event listeners for canvas drawing
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseout", stopDrawing);

// clear function
clearButton.addEventListener("click", () => {
  ctx?.clearRect(0, 0, canvas.width, canvas.height); 
  clearButton.blur(); 
});