// main.ts
import "./style.css";

const APP_NAME = "Sticker Sketchpad";
const app = document.querySelector<HTMLDivElement>("#app")!;

document.title = APP_NAME;
app.innerHTML = `
  <h1>${APP_NAME}</h1>
  <div class="canvas-container">
    <div class="toolbar">
      <button id="thinButton" class="tool-button">Thin Marker</button>
      <button id="thickButton" class="tool-button">Thick Marker</button>
    </div>
    <canvas id="drawingCanvas" width="256" height="256"></canvas>
    <div class="controls">
      <button id="undoButton">Undo</button>
      <button id="redoButton">Redo</button>
      <button id="clearButton">Clear</button>
    </div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#drawingCanvas")!;
const undoButton = document.querySelector<HTMLButtonElement>("#undoButton")!;
const redoButton = document.querySelector<HTMLButtonElement>("#redoButton")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clearButton")!;
const thinButton = document.querySelector<HTMLButtonElement>("#thinButton")!;
const thickButton = document.querySelector<HTMLButtonElement>("#thickButton")!;
const ctx = canvas.getContext("2d");

// handles marker drawing
class MarkerLine {
  private points: { x: number; y: number }[] = [];
  private thickness: number;

  constructor(initialX: number, initialY: number, thickness: number) {
    this.points.push({ x: initialX, y: initialY });
    this.thickness = thickness;
  }

  // add a new point to the line
  public drag(x: number, y: number) {
    this.points.push({ x, y });
  }

  // draw the line on the canvas with the specified thickness
  public display(ctx: CanvasRenderingContext2D) {
    if (this.points.length === 0) return;

    ctx.beginPath();
    ctx.lineWidth = this.thickness; // set the line thickness
    this.points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
  }
}

class ToolPreview {
  private x: number;
  private y: number;
  private thickness: number;

  constructor(thickness: number) {
    this.x = 0;
    this.y = 0;
    this.thickness = thickness;
  }

  // update position of the preview
  public updatePosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  // render the preview on the canvas
  public display(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.thickness / 2, 0, 2 * Math.PI);
    
    // preview circle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; 
    ctx.strokeStyle = '#ff0000';           
    ctx.lineWidth = 2;                    
    ctx.fill();
    ctx.stroke();                        
  }
}

let drawing = false;
let paths: MarkerLine[] = []; // store MarkerLine objects
let redoStack: MarkerLine[] = []; // redo stack
let currentLine: MarkerLine | null = null;
let currentThickness = 2; // default thickness is thin
let toolPreview: ToolPreview | null = new ToolPreview(currentThickness);

// start drawing a new line
function startDrawing(event: MouseEvent) {
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  currentLine = new MarkerLine(event.clientX - rect.left, event.clientY - rect.top, currentThickness);
  paths.push(currentLine);
  redoStack = []; // clear the redo stack on a new line start
  toolPreview = null; // hide tool preview while drawing
}

// stop drawing
function stopDrawing() {
  drawing = false;
  currentLine = null;
  toolPreview = new ToolPreview(currentThickness); // show tool preview again after drawing
}

// add a point to the current line
function addPointToLine(event: MouseEvent) {
  if (!drawing || !currentLine) return;
  const rect = canvas.getBoundingClientRect();
  currentLine.drag(event.clientX - rect.left, event.clientY - rect.top);
  canvas.dispatchEvent(new Event("drawing-changed"));
}

// update tool preview position
function updateToolPreview(event: MouseEvent) {
  if (!drawing && toolPreview) {
    const rect = canvas.getBoundingClientRect();
    toolPreview.updatePosition(event.clientX - rect.left, event.clientY - rect.top);
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
}

// redraw all lines on the canvas, including tool preview
canvas.addEventListener("drawing-changed", () => {
  ctx?.clearRect(0, 0, canvas.width, canvas.height);

  paths.forEach(line => {
    line.display(ctx!);
  });

  // Display the tool preview if available
  if (toolPreview) {
    toolPreview.display(ctx!);
  }
});

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mousemove", (event) => {
  addPointToLine(event);
  updateToolPreview(event);
});
canvas.addEventListener("mouseout", stopDrawing);

// undo
undoButton.addEventListener("click", () => {
  if (paths.length > 0) {
    const lastLine = paths.pop();
    if (lastLine) {
      redoStack.push(lastLine);
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
  undoButton.blur();
});

// redo
redoButton.addEventListener("click", () => {
  if (redoStack.length > 0) {
    const lastRedoLine = redoStack.pop();
    if (lastRedoLine) {
      paths.push(lastRedoLine);
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
  redoButton.blur();
});

// clear canvas
clearButton.addEventListener("click", () => {
  paths = [];
  redoStack = [];
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  clearButton.blur();
});

// marker tool selection
thinButton.addEventListener("click", () => {
  currentThickness = 2; // thin marker
  toolPreview = new ToolPreview(currentThickness); // update tool preview thickness
  updateToolSelection(thinButton);
});

thickButton.addEventListener("click", () => {
  currentThickness = 8; // thick marker
  toolPreview = new ToolPreview(currentThickness); // update tool preview thickness
  updateToolSelection(thickButton);
});

// helper to update the selected tool visually
function updateToolSelection(selectedButton: HTMLButtonElement) {
  // remove "selectedTool" class from all buttons
  thinButton.classList.remove("selectedTool");
  thickButton.classList.remove("selectedTool");
  
  // add "selectedTool" class to the currently selected button
  selectedButton.classList.add("selectedTool");
}

// initialize the default tool selection
updateToolSelection(thinButton);
