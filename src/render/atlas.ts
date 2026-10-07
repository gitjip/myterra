import { hash2 } from '../core/rng';
import { TILE } from '../data/tuning';
import { TileId } from '../data/tiles';

interface TileStyle {
  readonly base: string;
  readonly accent: string;
  readonly speckle: number;
}

const STYLES: Readonly<Partial<Record<TileId, TileStyle>>> = {
  [TileId.Air]: { base: '#00000000', accent: '#00000000', speckle: 0 },
  [TileId.Dirt]: { base: '#76502f', accent: '#a06a3b', speckle: 0.08 },
  [TileId.Stone]: { base: '#606875', accent: '#8b95a3', speckle: 0.1 },
  [TileId.Grass]: { base: '#6d4b2c', accent: '#59a34f', speckle: 0.06 },
  [TileId.Wood]: { base: '#85512d', accent: '#c4874b', speckle: 0.08 },
  [TileId.Leaf]: { base: '#286b43', accent: '#4da96b', speckle: 0.12 },
  [TileId.Sand]: { base: '#d0ad66', accent: '#f0d58c', speckle: 0.1 },
  [TileId.Torch]: { base: '#5c3b25', accent: '#ffd166', speckle: 0 },
  [TileId.DoorTopClosed]: { base: '#8a5a32', accent: '#d39a54', speckle: 0.04 },
  [TileId.DoorTopOpen]: { base: '#00000000', accent: '#00000000', speckle: 0 },
  [TileId.DoorBottomClosed]: { base: '#8a5a32', accent: '#d39a54', speckle: 0.04 },
  [TileId.DoorBottomOpen]: { base: '#00000000', accent: '#00000000', speckle: 0 },
  [TileId.Bedrock]: { base: '#252a35', accent: '#596274', speckle: 0.14 },
  [TileId.CoalOre]: { base: '#5a5f69', accent: '#23272e', speckle: 0.16 },
  [TileId.IronOre]: { base: '#6b6f78', accent: '#c9a07a', speckle: 0.16 },
  [TileId.GoldOre]: { base: '#6b6f78', accent: '#f0c419', speckle: 0.16 },
  [TileId.Obsidian]: { base: '#241a33', accent: '#5a4a7a', speckle: 0.12 },
};

const DEFAULT_STYLE: TileStyle = { base: '#ff00ff', accent: '#ff80ff', speckle: 0 };

/** Procedural atlas. It owns no external assets and is generated once at boot. */
export class TileAtlas {
  public readonly canvas: HTMLCanvasElement;
  private readonly columns = 4;

  public constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = TILE.px * this.columns;
    this.canvas.height = TILE.px * Math.ceil((TileId.Obsidian + 1) / this.columns);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('MyTerra: could not create the tile atlas context.');
    ctx.imageSmoothingEnabled = false;
    for (const tile of Object.values(TileId).filter(
      (value): value is TileId => typeof value === 'number',
    )) {
      this.drawTile(ctx, tile);
    }
  }

  public sourceRect(tile: TileId): { sx: number; sy: number; sw: number; sh: number } {
    const index = tile;
    return {
      sx: (index % this.columns) * TILE.px,
      sy: Math.floor(index / this.columns) * TILE.px,
      sw: TILE.px,
      sh: TILE.px,
    };
  }

  private drawTile(ctx: CanvasRenderingContext2D, tile: TileId): void {
    const style = STYLES[tile] ?? DEFAULT_STYLE;
    const { sx, sy } = this.sourceRect(tile);
    ctx.clearRect(sx, sy, TILE.px, TILE.px);
    if (style.base.endsWith('00')) return;
    ctx.fillStyle = style.base;
    ctx.fillRect(sx, sy, TILE.px, TILE.px);
    if (tile === TileId.Grass) {
      ctx.fillStyle = style.accent;
      ctx.fillRect(sx, sy, TILE.px, 4);
    } else if (tile === TileId.Torch) {
      ctx.fillStyle = '#b56b35';
      ctx.fillRect(sx + 7, sy + 5, 2, 9);
      ctx.fillStyle = style.accent;
      ctx.fillRect(sx + 5, sy + 2, 6, 5);
    } else {
      ctx.fillStyle = style.accent;
      ctx.fillRect(sx + 3, sy + 3, 2, 2);
      ctx.fillRect(sx + 11, sy + 10, 2, 2);
    }
    if (style.speckle > 0) {
      ctx.fillStyle = style.accent;
      for (let y = 1; y < TILE.px - 1; y += 3) {
        for (let x = 1; x < TILE.px - 1; x += 3) {
          if (hash2(tile * TILE.px + x, y, tile + 17) < style.speckle) {
            ctx.fillRect(sx + x, sy + y, 1, 1);
          }
        }
      }
    }
  }
}
