import Phaser from 'phaser';

const GAME_WIDTH = 400;
const GAME_HEIGHT = 620;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#222',
  parent: 'game',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: {
    preload,
    create,
    update
  }
};


const GRID_SIZE = 9;
const BLOCK_SIZE = 40;
const PREVIEW_BLOCK_SIZE = BLOCK_SIZE;
const GRID_ORIGIN_X = (GAME_WIDTH - GRID_SIZE * BLOCK_SIZE) / 2;
const GRID_ORIGIN_Y = 60;
const TRAY_TOP = 460;
let score = 0;
let scoreText;
let grid = [];
let shapes = [];
let draggingShape = null;
let dragOffsetX = 0;
let dragOffsetY = 0;


function preload() {
  // No assets needed for prototype
}


function create() {
  score = 0;
  scoreText = this.add.text(10, 10, 'Score: 0', { font: '20px Arial', fill: '#fff' });
  // Create grid
  grid = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    grid[row] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = this.add.rectangle(
        GRID_ORIGIN_X + col * BLOCK_SIZE + BLOCK_SIZE / 2,
        GRID_ORIGIN_Y + row * BLOCK_SIZE + BLOCK_SIZE / 2,
        BLOCK_SIZE - 2,
        BLOCK_SIZE - 2,
        0x8d6748,
        0.25
      ).setStrokeStyle(1, 0x8d6748);
      cell.filled = false;
      grid[row][col] = cell;
    }
  }
  // Generate shapes
  shapes = generateShapes(this);

  // Manual pointer drag for reliable behavior on container children.
  this.input.on('pointerdown', (pointer, gameObjects) => {
    const hit = gameObjects.find((o) => o.isShapeBlock) || gameObjects.find((o) => o.isShape);
    if (!hit) return;

    draggingShape = hit.parentShape || hit;
    draggingShape.setDepth(1000);
    dragOffsetX = pointer.x - draggingShape.x;
    dragOffsetY = pointer.y - draggingShape.y;
  });

  this.input.on('pointermove', (pointer) => {
    if (!draggingShape || !pointer.isDown) return;
    draggingShape.x = pointer.x - dragOffsetX;
    draggingShape.y = pointer.y - dragOffsetY;
  });

  this.input.on('pointerup', () => {
    if (!draggingShape) return;

    if (tryPlaceShape(this, draggingShape)) {
      draggingShape.destroy();
      shapes = shapes.filter((s) => s !== draggingShape);
      if (shapes.length === 0) {
        shapes = generateShapes(this);
      }
    } else {
      draggingShape.x = draggingShape.startX;
      draggingShape.y = draggingShape.startY;
      draggingShape.setDepth(0);
    }

    draggingShape = null;
  });
}


// Generate 3 random shapes for the player to drag
function generateShapes(scene) {
  const shapeDefs = [
    [[1]],
    [[1,1]],
    [[1],[1]],
    [[1,1,1]],
    [[1],[1],[1]],
    [[1,1],[1,1]],
    [[1,0],[1,0],[1,1]],
    [[1,1,1],[0,1,0]],
    [[1,1,1],[1,1,1],[1,1,1]]
  ];
  let shapes = [];
  const defs = [];
  for (let i = 0; i < 3; i++) {
    defs.push(Phaser.Utils.Array.GetRandom(shapeDefs));
  }

  const marginX = 16;
  const availableWidth = GAME_WIDTH - marginX * 2;
  const widths = defs.map((def) => getShapeCols(def) * PREVIEW_BLOCK_SIZE);
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);
  const gap = defs.length > 1 ? Math.max(0, (availableWidth - totalWidth) / (defs.length - 1)) : 0;
  let x = marginX;

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const shapeCols = getShapeCols(def);
    const shapeRows = def.length;
    const shapeWidth = shapeCols * PREVIEW_BLOCK_SIZE;
    const shapeHeight = shapeRows * PREVIEW_BLOCK_SIZE;
    const y = TRAY_TOP + Math.max(0, (GAME_HEIGHT - TRAY_TOP - shapeHeight) / 2);
    const shape = createShape(scene, def, x, y, PREVIEW_BLOCK_SIZE);
    shapes.push(shape);
    x += shapeWidth + gap;
  }

  return shapes;
}

function getShapeCols(def) {
  return def.reduce((max, row) => Math.max(max, row.length), 0);
}

function createShape(scene, def, x, y, cellSize) {
  const container = scene.add.container(x, y);
  container.isShape = true;
  container.startX = x;
  container.startY = y;
  const shapeCols = getShapeCols(def);
  const shapeWidth = shapeCols * cellSize;
  const shapeHeight = def.length * cellSize;

  for (let row = 0; row < def.length; row++) {
    for (let col = 0; col < def[row].length; col++) {
      if (def[row][col]) {
        const block = scene.add.rectangle(
          col * cellSize,
          row * cellSize,
          cellSize - 4,
          cellSize - 4,
          0xc69c6d
        ).setOrigin(0, 0).setStrokeStyle(2, 0x8d6748);
        block.isShapeBlock = true;
        block.parentShape = container;
        block.setInteractive(new Phaser.Geom.Rectangle(0, 0, cellSize, cellSize), Phaser.Geom.Rectangle.Contains);
        container.add(block);
      }
    }
  }

  container.shapeDef = def;
  container.setSize(shapeWidth, shapeHeight);
  return container;
}

function tryPlaceShape(scene, shape) {
  // Find top-left grid cell under shape
  const def = shape.shapeDef;
  const gridX = Math.round((shape.x - GRID_ORIGIN_X) / BLOCK_SIZE);
  const gridY = Math.round((shape.y - GRID_ORIGIN_Y) / BLOCK_SIZE);
  // Check if shape fits
  for (let row = 0; row < def.length; row++) {
    for (let col = 0; col < def[row].length; col++) {
      if (def[row][col]) {
        const r = gridY + row;
        const c = gridX + col;
        if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
        if (grid[r][c].filled) return false;
      }
    }
  }
  // Place shape
  for (let row = 0; row < def.length; row++) {
    for (let col = 0; col < def[row].length; col++) {
      if (def[row][col]) {
        const r = gridY + row;
        const c = gridX + col;
        grid[r][c].filled = true;
        grid[r][c].setFillStyle(0xc69c6d, 1);
      }
    }
  }
  // Check for line clears
  checkLineClears(scene);
  score += def.flat().filter(Boolean).length * 10;
  scoreText.setText('Score: ' + score);
  return true;
}

function checkLineClears(scene) {
  // Check rows
  for (let row = 0; row < GRID_SIZE; row++) {
    if (grid[row].every(cell => cell.filled)) {
      for (let col = 0; col < GRID_SIZE; col++) {
        grid[row][col].filled = false;
        grid[row][col].setFillStyle(0x8d6748, 0.25);
      }
      score += 90;
    }
  }
  // Check columns
  for (let col = 0; col < GRID_SIZE; col++) {
    let full = true;
    for (let row = 0; row < GRID_SIZE; row++) {
      if (!grid[row][col].filled) {
        full = false;
        break;
      }
    }
    if (full) {
      for (let row = 0; row < GRID_SIZE; row++) {
        grid[row][col].filled = false;
        grid[row][col].setFillStyle(0x8d6748, 0.25);
      }
      score += 90;
    }
  }
}


function update() {
  // No animation for prototype
}

new Phaser.Game(config);
