import "./style.css"; 

const APP_NAME = "Sticker Sketchpad";

const app = document.querySelector<HTMLDivElement>("#app")!;

document.title = APP_NAME;
app.innerHTML = `
  <h1>${APP_NAME}</h1>
  <div class="canvas-container">
    <canvas id="drawingCanvas" width="256" height="256"></canvas>
    <button id="undoButton">Undo</button>
    <button id="redoButton">Redo</button>
    <button id="clearButton">Clear</button>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#drawingCanvas")!;
const undoButton = document.querySelector<HTMLButtonElement>("#undoButton")!;
const redoButton = document.querySelector<HTMLButtonElement>("#redoButton")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clearButton")!;
const ctx = canvas.getContext("2d");

let drawing = false;
let paths: { x: number; y: number }[][] = []; // array to store paths of points
let redoStack: { x: number; y: number }[][] = []; // redo stack
let currentPath: { x: number; y: number }[] = []; // current drawing path

// draw functions
function startDrawing(event: MouseEvent) {
  drawing = true;
  currentPath = []; 
  paths.push(currentPath); 
  addPointToPath(event); 
  redoStack = []; // clear the redo stack on a new path start
}

function stopDrawing() {
  drawing = false;
}

// add a point to the current path
function addPointToPath(event: MouseEvent) {
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  currentPath.push({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  canvas.dispatchEvent(new Event('drawing-changed'));
}

// draw-change listener
canvas.addEventListener("drawing-changed", () => {
  ctx?.clearRect(0, 0, canvas.width, canvas.height);

  paths.forEach(path => {
    ctx?.beginPath();
    path.forEach((point, index) => {
      if (index === 0) {
        ctx?.moveTo(point.x, point.y);
      } else {
        ctx?.lineTo(point.x, point.y);
      }
    });
    ctx?.stroke();
  });
});

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mousemove", addPointToPath);
canvas.addEventListener("mouseout", stopDrawing);

// undo
undoButton.addEventListener("click", () => {
  if (paths.length > 0) {
    const lastPath = paths.pop(); // pop the last path from paths
    if (lastPath) {
      redoStack.push(lastPath); // push the path to redo stack
      canvas.dispatchEvent(new Event('drawing-changed'));
    }
  }
  undoButton.blur();
});

// redo
redoButton.addEventListener("click", () => {
  if (redoStack.length > 0) {
    const lastRedoPath = redoStack.pop(); // pop the last path from redo stack
    if (lastRedoPath) {
      paths.push(lastRedoPath); // add it back to paths
      canvas.dispatchEvent(new Event('drawing-changed'));
    }
  }
  redoButton.blur();
});

// clear
clearButton.addEventListener("click", () => {
  paths = [];
  redoStack = [];
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  clearButton.blur();
});