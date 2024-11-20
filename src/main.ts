import "./style.css";

/*
 * Globals
 */

const stickers = ["😀", "🥳", "🎉", "🔥", "🦁"];
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

let currentColor: string;
let currentRotation: number;
let drawing: boolean;
let drawables: Drawable[];
let redoStack: Drawable[];
let currentLine: MarkerLine | null;
let currentThickness: number;
let toolPreview: ToolPreview | null;
let activeStickerCommand: Command | null;

/*
 * Types
 */

type Command = {
  execute: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
};

interface Drawable {
  display(ctx: CanvasRenderingContext2D): void;
}

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

/*
 * Functions
 */

function createStickerButtons() {
  stickers.forEach(emoji => {
    const button = document.createElement("button");
    button.textContent = emoji;
    button.className = "tool-button";
    button.addEventListener("click", (event) =>
      useSticker(new PlaceStickerCommand(emoji), event));
    stickerContainer.appendChild(button);
  });
}

function updateStickerButtons() {
  stickerContainer.innerHTML = "";
  createStickerButtons();
}

function addCustomSticker() {
  const customSticker = prompt("Enter a custom sticker emoji:");
  if (customSticker) {
    stickers.push(customSticker);
    updateStickerButtons();
  }
}

function startDrawing(event: MouseEvent) {
  if (activeStickerCommand) return;

  drawing = true;
  const rect = canvas.getBoundingClientRect();
  currentLine = new MarkerLine(event.clientX - rect.left, event.clientY - rect.top, currentThickness, currentColor);
  drawables.push(currentLine);
  redoStack = [];
  toolPreview?.setActive(false);
  randomizeNextTool();
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

function updateToolPreview(event: MouseEvent) {
  if (!drawing && toolPreview) {
    const rect = canvas.getBoundingClientRect();
    toolPreview.updatePosition(event.clientX - rect.left, event.clientY - rect.top);
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
}

function redrawCanvas() {
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  drawables.forEach(element => element.display(ctx!));
  toolPreview?.display(ctx!);
}

function drawingHandleMouseMoveEvent(event: MouseEvent) {
  if (activeStickerCommand) {
    applyStickerCommand();
  } else {
    addPointToLine(event);
    updateToolPreview(event);
  }
}

function rotateCurrentSticker() {
  currentRotation = (currentRotation + 90) % 360;
}

function drawingHandleKeyEvent(event: KeyboardEvent) {
  if ((event.key === 'R' || event.key === 'r') && activeStickerCommand instanceof PlaceStickerCommand) {
    rotateCurrentSticker();
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
}

function getRandomColor(): string {
  const hue = Math.floor(Math.random() * 360); // full spectrum
  return `hsl(${hue}, 100%, 50%)`; // full saturation and medium lightness for bright colors
}

function randomizeNextTool() {
  currentColor = getRandomColor();
  toolPreview = new ToolPreview(currentThickness, currentColor); // update preview with new color
}

function undoDrawingCommand() {
  if (drawables.length > 0) {
    const lastLine = drawables.pop();
    if (lastLine) {
      redoStack.push(lastLine);
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
  undoButton.blur();
}

function redoDrawingCommand() {
  if (redoStack.length > 0) {
    const lastUndo = redoStack.pop();
    if (lastUndo) {
      drawables.push(lastUndo);
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
  redoButton.blur();
}

function clearDrawing() {
  drawables = [];
  redoStack = [];
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  clearButton.blur();
}

function exportCanvasToPNG() {
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
}

function useThinMarker() {
  currentThickness = 2;
  activeStickerCommand = null;
  highlightButton(thinButton);
  randomizeNextTool(); 
}

function useThickMarker() {
  currentThickness = 8;
  activeStickerCommand = null;
  highlightButton(thickButton);
  randomizeNextTool(); 
}

function highlightButton(button: HTMLButtonElement) {
  thinButton.classList.remove("selectedTool");
  thickButton.classList.remove("selectedTool");

  const allStickers = document.querySelectorAll(".sticker-panel .tool-button");
  allStickers.forEach(sticker => sticker.classList.remove("selectedTool"));
  
  button.classList.add("selectedTool");
}

function useSticker(command: Command, event?: Event) {
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

function fireToolMovedEvent() {
  canvas.dispatchEvent(new Event("tool-moved"));
}

/*
 * Initialization
 */

function initializeApp() {
  canvas.addEventListener("drawing-changed", redrawCanvas);
  globalThis.addEventListener("keydown", drawingHandleKeyEvent);
  addStickerButton.addEventListener("click", addCustomSticker);
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mousemove", drawingHandleMouseMoveEvent);
  canvas.addEventListener("mouseout", stopDrawing);
  undoButton.addEventListener("click", undoDrawingCommand);
  redoButton.addEventListener("click", redoDrawingCommand);
  clearButton.addEventListener("click", clearDrawing);
  exportButton.addEventListener("click", exportCanvasToPNG);
  thinButton.addEventListener("click", useThinMarker);
  thickButton.addEventListener("click", useThickMarker);

  currentColor = getRandomColor();
  currentRotation = 0;
  drawing = false;
  drawables = [];
  redoStack = [];
  currentLine = null;
  currentThickness = 2;
  toolPreview = new ToolPreview(currentThickness, currentColor);
  activeStickerCommand = null;
  
  createStickerButtons();
  
  useThinMarker();
}

initializeApp();