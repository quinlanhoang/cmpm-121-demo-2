import "./style.css";

// sticker array with initial emojis
const stickers = ["😀", "🥳", "🎉", "🔥", "🦁"];
let currentColor = getRandomColor();
let currentRotation = 0; // default rotation

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
  private color: string;

  constructor(initialX: number, initialY: number, thickness: number, color: string) {
    this.points.push({ x: initialX, y: initialY });
    this.thickness = thickness;
    this.color = color;
  }

  public drag(x: number, y: number) {
    this.points.push({ x, y });
  }

  public display(ctx: CanvasRenderingContext2D) {
    if (this.points.length === 0) return;

    ctx.beginPath();
    ctx.lineWidth = this.thickness;
    ctx.strokeStyle = this.color;
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
  private color: string;

  constructor(thickness: number, color: string) {
    this.x = 0;
    this.y = 0;
    this.thickness = thickness;
    this.color = color;
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
    ctx.fillStyle = this.color;
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
  private rotation: number;

  constructor(emoji: string, x: number, y: number, rotation: number) {
    this.emoji = emoji;
    this.x = x;
    this.y = y;
    this.rotation = rotation;
  }

  public display(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.font = '24px serif';
    ctx.fillStyle = '#000';
    ctx.fillText(this.emoji, 0, 0);
    ctx.restore();
  }

  public getRotation(): number {
    return this.rotation;
  }

  public setRotation(rotation: number) {
    this.rotation = rotation;
  }
}

class PlaceStickerCommand implements Command {
  private emoji: string;

  constructor(emoji: string) {
    this.emoji = emoji;
  }

  execute(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((currentRotation * Math.PI) / 180); // apply current rotation
    ctx.font = '24px serif';
    ctx.fillStyle = '#000';
    ctx.fillText(this.emoji, 0, 0);
    ctx.restore();
  }
  
  public getEmoji() {
    return this.emoji;
  }
}

// merge drawing state and tools
let drawing = false;
let drawables: Drawable[] = [];
let redoStack: Drawable[] = [];
let currentLine: MarkerLine | null = null;
let currentThickness = 2;
let toolPreview: ToolPreview | null = new ToolPreview(currentThickness, currentColor);
let activeStickerCommand: Command | null = null;

// initializes sticker buttons
function createStickerButtons() {
  stickerContainer.innerHTML = ""; // clear existing buttons
  stickers.forEach(emoji => {
    const button = document.createElement("button");
    button.textContent = emoji;
    button.className = "tool-button";
    button.addEventListener("click", (event) =>
      setStickerMode(new PlaceStickerCommand(emoji), event));
    stickerContainer.appendChild(button);
  });
}

createStickerButtons(); // initialize with default stickers

addStickerButton.addEventListener("click", () => {
  const customSticker = prompt("Enter a custom sticker emoji:");
  if (customSticker) {
    stickers.push(customSticker);
    createStickerButtons(); // recreate sticker buttons with new addition
  }
});

function startDrawing(event: MouseEvent) {
  if (activeStickerCommand) return; // skip if in sticker mode

  drawing = true;
  const rect = canvas.getBoundingClientRect();
  currentLine = new MarkerLine(event.clientX - rect.left, event.clientY - rect.top, currentThickness, currentColor);
  drawables.push(currentLine);
  redoStack = [];
  toolPreview?.setActive(false);
  randomizeNextTool(); // randomizes color/rotation for the next use
}

function stopDrawing() {
  drawing = false;
  currentLine = null;
  toolPreview?.setActive(true);
  randomizeNextTool();
}

function addPointToLine(event: MouseEvent) {
  if (!drawing || !currentLine) return;
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
    applyStickerCommand();
  } else {
    addPointToLine(event);
    updateToolPreview(event);
  }
});
canvas.addEventListener("mouseout", stopDrawing);

// rotate current sticker on pressing R key
globalThis.addEventListener("keydown", (event) => {
  if ((event.key === 'R' || event.key === 'r') && activeStickerCommand instanceof PlaceStickerCommand) {
    currentRotation = (currentRotation + 90) % 360; // rotate the active tool preview
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
});

// utility function to generate random rainbow color
function getRandomColor(): string {
  const hue = Math.floor(Math.random() * 360); // full spectrum
  return `hsl(${hue}, 100%, 50%)`; // full saturation and medium lightness for bright colors
}

// utility function for randomizing tool attributes
function randomizeNextTool() {
  currentColor = getRandomColor();
  toolPreview = new ToolPreview(currentThickness, currentColor); // update preview with new color
}

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
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = 1024;
  exportCanvas.height = 1024;
  const exportCtx = exportCanvas.getContext("2d");

  if (exportCtx) {
    const scaleFactor = 1024 / canvas.width;
    exportCtx.scale(scaleFactor, scaleFactor);
    drawables.forEach(drawable => drawable.display(exportCtx));

    const pngURL = exportCanvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngURL;
    downloadLink.download = "sketchpad_export.png";
    downloadLink.click();
  }
});

// thin thickness
thinButton.addEventListener("click", () => {
  currentThickness = 2;
  activeStickerCommand = null;
  highlightButton(thinButton);
  randomizeNextTool(); 
});

// thick thickness
thickButton.addEventListener("click", () => {
  currentThickness = 8;
  activeStickerCommand = null;
  highlightButton(thickButton);
  randomizeNextTool(); 
});

// highlight button when selected
function highlightButton(button: HTMLButtonElement) {
  thinButton.classList.remove("selectedTool");
  thickButton.classList.remove("selectedTool");

  const allStickers = document.querySelectorAll(".sticker-panel .tool-button");
  allStickers.forEach(sticker => sticker.classList.remove("selectedTool"));
  
  button.classList.add("selectedTool");
}

// switches to sticker mode
function setStickerMode(command: Command, event?: Event) {
  activeStickerCommand = command;
  toolPreview?.setActive(false);
  const stickerButtons = document.querySelectorAll(".sticker-panel .tool-button");
  stickerButtons.forEach(button => button.classList.remove("selectedTool"));
  if (event !== undefined) {
    highlightButton(event.target as HTMLButtonElement);
  }
  fireToolMovedEvent();
}

function applyStickerCommand() {
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
      const emoji = activeStickerCommand.getEmoji();
      const sticker = new Sticker(emoji, e.clientX - rect.left, e.clientY - rect.top, currentRotation);
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
thinButton.click();