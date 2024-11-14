// main.ts
import "./style.css";

// basic setup
const APP_NAME = "Sticker Sketchpad";
const app = document.querySelector<HTMLDivElement>("#app")!;

document.title = APP_NAME;
app.innerHTML = `
  <h1>${APP_NAME}</h1>
  <div class="canvas-container">
    <div class="toolbar">
      <button id="thinButton" class="tool-button">Thin Marker</button>
      <button id="thickButton" class="tool-button">Thick Marker</button>
      <button id="stickerButton1" class="tool-button">😀</button>
      <button id="stickerButton2" class="tool-button">🥳</button>
      <button id="stickerButton3" class="tool-button">🎉</button>
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

// command interface for executing different actions
type Command = {
  execute: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
};

// drawable interface for elements that can be displayed on the canvas
interface Drawable {
  display(ctx: CanvasRenderingContext2D): void;
}

// represents a line drawn with the marker tool
class MarkerLine implements Drawable {
  private points: { x: number; y: number }[] = [];
  private thickness: number;

  constructor(initialX: number, initialY: number, thickness: number) {
    this.points.push({ x: initialX, y: initialY });
    this.thickness = thickness;
  }

  // adds a point to the line as the marker drags
  public drag(x: number, y: number) {
    this.points.push({ x, y });
  }

  // render the line on the canvas
  public display(ctx: CanvasRenderingContext2D) {
    if (this.points.length === 0) return;

    ctx.beginPath();
    ctx.lineWidth = this.thickness;
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

// handles tool previewing during drawing
class ToolPreview {
  private x: number;
  private y: number;
  private thickness: number;
  private isActive: boolean = true;

  constructor(thickness: number) {
    this.x = 0;
    this.y = 0;
    this.thickness = thickness;
  }

  public setActive(isActive: boolean) {
    this.isActive = isActive;
  }

  public updatePosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public display(ctx: CanvasRenderingContext2D) {
    if (!this.isActive) return;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.thickness / 2, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }
}

// represents a sticker on the canvas
class Sticker implements Drawable {
  private emoji: string;
  private x: number;
  private y: number;

  constructor(emoji: string, x: number, y: number) {
    this.emoji = emoji;
    this.x = x;
    this.y = y;
  }

    // render the sticker on the canvas
  public display(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = 1.0; 
    ctx.font = '24px serif';
    ctx.fillStyle = '#000'; 
    ctx.fillText(this.emoji, this.x, this.y);
    ctx.restore();
  }
}

class PlaceStickerCommand implements Command {
  private emoji: string;

  constructor(emoji: string) {
    this.emoji = emoji;
  }

  execute(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save(); 
    ctx.globalAlpha = 1.0; 
    ctx.font = '24px serif';
    ctx.fillStyle = '#000'; 
    ctx.fillText(this.emoji, x, y);
    ctx.restore(); // restore settings to prevent affecting other draws
  }
}

// variables to manage drawing state and tool usage
let drawing = false;
let drawables: Drawable[] = []; 
let redoStack: Drawable[] = [];
let currentLine: MarkerLine | null = null;
let currentThickness = 2;
let toolPreview: ToolPreview | null = new ToolPreview(currentThickness);
let activeStickerCommand: Command | null = null;

// event handler for starting line drawing
function startDrawing(event: MouseEvent) {
  if (activeStickerCommand) return;  // disable if sticker mode is active

  drawing = true;
  const rect = canvas.getBoundingClientRect();
  currentLine = new MarkerLine(event.clientX - rect.left, event.clientY - rect.top, currentThickness);
  drawables.push(currentLine);
  redoStack = [];
  toolPreview?.setActive(false);
}

// event handler for stopping line drawing
function stopDrawing() {
  drawing = false;
  currentLine = null;
  toolPreview?.setActive(true);
}

// event handler for adding points to the current line
function addPointToLine(event: MouseEvent) {
  if (!drawing || !currentLine) return;
  const rect = canvas.getBoundingClientRect();
  currentLine?.drag(event.clientX - rect.left, event.clientY - rect.top);
  canvas.dispatchEvent(new Event("drawing-changed"));
}

// Update the tool preview position
function updateToolPreview(event: MouseEvent) {
  if (!drawing && toolPreview) {
    const rect = canvas.getBoundingClientRect();
    toolPreview.updatePosition(event.clientX - rect.left, event.clientY - rect.top);
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
}

// redraw the canvas whenever a change occurs
canvas.addEventListener("drawing-changed", () => {
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  drawables.forEach(element => element.display(ctx!));
  toolPreview?.display(ctx!);
});

// attach event listeners for user interactions
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mousemove", (event) => {
  if (activeStickerCommand) {
    applyStickerCommand(event);
  } else {
    addPointToLine(event);
    updateToolPreview(event);
  }
});
canvas.addEventListener("mouseout", stopDrawing);

// undo
undoButton.addEventListener("click", () => {
  if (drawables.length > 0) {
    const lastLine = drawables.pop();
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
      drawables.push(lastRedoLine);
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
  redoButton.blur();
});

// clear
clearButton.addEventListener("click", () => {
  drawables = [];
  redoStack = [];
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  clearButton.blur();
});

// thin thickness
thinButton.addEventListener("click", () => {
  currentThickness = 2;
  toolPreview = new ToolPreview(currentThickness);
  activeStickerCommand = null;  
  updateToolSelection(thinButton);
});

// thick thickness
thickButton.addEventListener("click", () => {
  currentThickness = 8;
  toolPreview = new ToolPreview(currentThickness);
  activeStickerCommand = null;  
  updateToolSelection(thickButton);
});

// update visual feedback for selected tool
function updateToolSelection(selectedButton: HTMLButtonElement) {
  thinButton.classList.remove("selectedTool");
  thickButton.classList.remove("selectedTool");
  selectedButton.classList.add("selectedTool");
}

// first sticker set
document.querySelector("#stickerButton1")!.addEventListener("click", () => {
  setStickerMode(new PlaceStickerCommand('😀'));
});

// second sticker set
document.querySelector("#stickerButton2")!.addEventListener("click", () => {
  setStickerMode(new PlaceStickerCommand('🥳'));
});

// third sticker set
document.querySelector("#stickerButton3")!.addEventListener("click", () => {
  setStickerMode(new PlaceStickerCommand('🎉'));
});

// set sticker mode
function setStickerMode(command: Command) {
  activeStickerCommand = command;
  toolPreview?.setActive(false);
  fireToolMovedEvent();
}

// handle sticker preview and placement
function applyStickerCommand(event: MouseEvent) {
  const rect = canvas.getBoundingClientRect();

  // preview sticker while moving the mouse
  const handleMouseMove = (e: MouseEvent) => {
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    drawables.forEach(element => element.display(ctx!));
    if (ctx && activeStickerCommand) {
      activeStickerCommand.execute(ctx, e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  // finalize sticker placement on mouseup
  const handleMouseUp = (e: MouseEvent) => {
    if (ctx && activeStickerCommand) {
      const sticker = new Sticker(activeStickerCommand.emoji, e.clientX - rect.left, e.clientY - rect.top);
      drawables.push(sticker);
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
    activeStickerCommand = null;
    canvas.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("mouseup", handleMouseUp);
  };

  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp, { once: true });
  fireToolMovedEvent();
}

// custom event to signal a change in tool state
function fireToolMovedEvent() {
  canvas.dispatchEvent(new Event("tool-moved"));
}

// initialize tool selection
updateToolSelection(thinButton);