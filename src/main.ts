import "./style.css"; 

const APP_NAME = "Sticker Sketchpad";

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

let drawing = false;
let paths: { x: number; y: number }[][] = []; // array to store paths of points
let currentPath: { x: number; y: number }[] = []; // current drawing path

// draw functions
function startDrawing(event: MouseEvent) {
  drawing = true;
  currentPath = []; // clear current path
  paths.push(currentPath); // add new path to paths array
  addPointToPath(event); // add the starting point
}

function stopDrawing() {
  drawing = false;
}

// draw function that records points to paths
function addPointToPath(event: MouseEvent) {
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  currentPath.push({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  canvas.dispatchEvent(new Event('drawing-changed')); // dispatch event after adding a point
}

// drawing changes to update the canvas
canvas.addEventListener("drawing-changed", () => {
  ctx?.clearRect(0, 0, canvas.width, canvas.height); // clear canvas
  ctx?.beginPath(); // reset path

  // redraw based on stored paths
  paths.forEach(path => {
    path.forEach((point, index) => {
      if (index === 0) {
        ctx?.moveTo(point.x, point.y);
      } else {
        ctx?.lineTo(point.x, point.y);
      }
    });
    ctx?.stroke(); // Apply stroke
  });
});

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mousemove", addPointToPath);
canvas.addEventListener("mouseout", stopDrawing);

// Clear the canvas and paths on button click
clearButton.addEventListener("click", () => {
  paths = []; // reset
  ctx?.clearRect(0, 0, canvas.width, canvas.height); 
  clearButton.blur();
});