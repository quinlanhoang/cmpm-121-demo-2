// main.ts
import "./style.css";

// sticker array
let stickers = ["😀", "🥳", "🎉","🔥","🦁"];

const canvas = document.querySelector<HTMLCanvasElement>("#drawingCanvas")!;
const undoButton = document.querySelector<HTMLButtonElement>("#undoButton")!;
const redoButton = document.querySelector<HTMLButtonElement>("#redoButton")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clearButton")!;
const thinButton = document.querySelector<HTMLButtonElement>("#thinButton")!;
const thickButton = document.querySelector<HTMLButtonElement>("#thickButton")!;
const addStickerButton = document.querySelector<HTMLButtonElement>("#addStickerButton")!;
const exportButton = document.querySelector<HTMLButtonElement>("#exportButton")!; 
const stickerContainer = document.querySelector<HTMLDivElement>("#stickerContainer")!;
const ctx = canvas.getContext("2d");

// command interface
type Command = {
  execute: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
};

// interface for displayable elements on canvas
interface Drawable {
  display(ctx: CanvasRenderingContext2D): void;
}

// represents lines drawn with marker tool
class MarkerLine implements Drawable {
  private points: { x: number; y: number }[] = [];
  private thickness: number;

  constructor(initialX: number, initialY: number, thickness: number) {
    this.points.push({ x: initialX, y: initialY });
    this.thickness = thickness;
  }

  public drag(x: number, y: number) {
    this.points.push({ x, y });
  }

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

// tool previewing during drawing
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

class Sticker implements Drawable {
  private emoji: string;
  private x: number;
  private y: number;

  constructor(emoji: string, x: number, y: number) {
    this.emoji = emoji;
    this.x = x;
    this.y = y;
  }

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
    ctx.restore();
  }
}

// merge drawing state and tools
let drawing = false;
let drawables: Drawable[] = [];
let redoStack: Drawable[] = [];
let currentLine: MarkerLine | null = null;
let currentThickness = 2;
let toolPreview: ToolPreview | null = new ToolPreview(currentThickness);
let activeStickerCommand: Command | null = null;

// initalizes sticker button
function createStickerButtons() {
  stickerContainer.innerHTML = ""; // clear existing buttons
  stickers.forEach(emoji => {
    const button = document.createElement("button");
    button.textContent = emoji;
    button.className = "tool-button";
    button.addEventListener("click", () => setStickerMode(new PlaceStickerCommand(emoji)));
    stickerContainer.appendChild(button);
  });
}

createStickerButtons(); // initialize with default stickers

addStickerButton.addEventListener("click", () => {
  const customSticker = prompt("Enter a custom sticker emoji:");
  if (customSticker) {
    stickers.push(customSticker); // adds new sticker to array
    createStickerButtons(); // creates button for custom sticker
  }
});

function startDrawing(event: MouseEvent) {
  if (activeStickerCommand) return;

  drawing = true;
  const rect = canvas.getBoundingClientRect();
  currentLine = new MarkerLine(event.clientX - rect.left, event.clientY - rect.top, currentThickness);
  drawables.push(currentLine);
  redoStack = []; // clear redo stack when drawing a new line
  toolPreview?.setActive(false);
}

function stopDrawing() {
  drawing = false;
  currentLine = null;
  toolPreview?.setActive(true);
}

function addPointToLine(event: MouseEvent) {
  if (!drawing || !currentLine) return; // ensures drawing and line state are valid
  const rect = canvas.getBoundingClientRect();
  currentLine?.drag(event.clientX - rect.left, event.clientY - rect.top);
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

// redraws canvas when a change occurs
canvas.addEventListener("drawing-changed", () => {
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  drawables.forEach(element => element.display(ctx!));
  toolPreview?.display(ctx!);
});

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
    const lastUndo = redoStack.pop();
    if (lastUndo) {
      drawables.push(lastUndo);
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

// export canvas to PNG
exportButton.addEventListener("click", () => {
  
  // create a new canvas to export the current drawing
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = 1024;
  exportCanvas.height = 1024;
  const exportCtx = exportCanvas.getContext("2d");

  if (exportCtx) {
   
    // calculate scaling factor
    const scaleFactor = 1024 / canvas.width;
    exportCtx.scale(scaleFactor, scaleFactor);

    // draw each drawable on the new canvas
    drawables.forEach(drawable => drawable.display(exportCtx));

    // convert canvas to PNG
    const pngURL = exportCanvas.toDataURL("image/png");

    // create a download element and initiate a download
    const downloadLink = document.createElement("a");
    downloadLink.href = pngURL;
    downloadLink.download = "sketchpad_export.png";
    downloadLink.click();
  }
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

function updateToolSelection(selectedButton: HTMLButtonElement) {
  thinButton.classList.remove("selectedTool");
  thickButton.classList.remove("selectedTool");
  selectedButton.classList.add("selectedTool");
}

// switches to sticker mode
function setStickerMode(command: Command) {
  activeStickerCommand = command;
  toolPreview?.setActive(false);
  fireToolMovedEvent();
}

function applyStickerCommand(event: MouseEvent) {
  const rect = canvas.getBoundingClientRect();

  const handleMouseMove = (e: MouseEvent) => {
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    drawables.forEach(element => element.display(ctx!));
    if (ctx && activeStickerCommand && activeStickerCommand instanceof PlaceStickerCommand) {
      activeStickerCommand.execute(ctx, e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (ctx && activeStickerCommand && activeStickerCommand instanceof PlaceStickerCommand) {
      const { emoji } = activeStickerCommand;
      const sticker = new Sticker(emoji, e.clientX - rect.left, e.clientY - rect.top);
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

// signal a change to tool state
function fireToolMovedEvent() {
  canvas.dispatchEvent(new Event("tool-moved"));
}

// defaults to thin marker
updateToolSelection(thinButton);