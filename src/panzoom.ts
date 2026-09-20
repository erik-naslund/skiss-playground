/**
 * Pan and zoom for the diagram pane: drag to move, wheel or pinch to scale,
 * Fit to go back to where it started.
 *
 * Hand-rolled with one CSS transform rather than a library. What is needed is
 * a translation, a scale and the arithmetic that keeps the point under the
 * pointer where it is, which is this file; a dependency would be larger than
 * that and would still have to be styled.
 *
 * Pointer events throughout, so a mouse, a trackpad and a touch screen are one
 * code path: a single pointer drags, two pointers pinch.
 */

/** How far the diagram can be scaled, so it can neither vanish nor fill the pane with one glyph. */
const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

/** Wheel zoom per notch. A line of wheel delta is roughly 0.1 of a scale step. */
const WHEEL_SENSITIVITY = 0.0015;

/** What a viewport is given back. */
export interface PanZoom {
  /** Back to the untransformed diagram, which is the one that fits the pane. */
  fit(): void;
  destroy(): void;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

const IDENTITY: Transform = { x: 0, y: 0, scale: 1 };

/** Scale clamped into what the pane will show. */
export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * The transform after scaling by `factor` about `(px, py)`, a point in the
 * viewport's own coordinates. The point under the pointer stays under it,
 * which is what makes a wheel zoom feel like it is zooming the diagram rather
 * than the corner of the pane.
 */
export function zoomAbout(current: Transform, factor: number, px: number, py: number): Transform {
  const scale = clampScale(current.scale * factor);
  // The factor actually applied, which is not the one asked for at the limits.
  const applied = scale / current.scale;
  return {
    scale,
    x: px - (px - current.x) * applied,
    y: py - (py - current.y) * applied,
  };
}

/**
 * Makes `content` draggable and zoomable inside `viewport`. The content is
 * transformed; the viewport keeps its size and clips.
 */
export function panZoom(viewport: HTMLElement, content: HTMLElement): PanZoom {
  let transform: Transform = { ...IDENTITY };
  // Every pointer currently down on the viewport, by id, at its last position.
  const pointers = new Map<number, { x: number; y: number }>();
  // While two pointers are down: the distance and the midpoint of the last move.
  let pinch: { distance: number; x: number; y: number } | undefined;

  function apply(): void {
    content.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
  }

  function local(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const box = viewport.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function onPointerDown(event: PointerEvent): void {
    // A drag across a diagram is a pan, not a selection of the words in it.
    event.preventDefault();
    pointers.set(event.pointerId, local(event));
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('dragging');
    if (pointers.size === 2) {
      pinch = pinchOf(pointers);
    }
  }

  function onPointerMove(event: PointerEvent): void {
    const previous = pointers.get(event.pointerId);
    if (previous === undefined) {
      return;
    }
    const position = local(event);
    pointers.set(event.pointerId, position);

    if (pointers.size >= 2) {
      const next = pinchOf(pointers);
      if (pinch !== undefined && next !== undefined && pinch.distance > 0) {
        transform = zoomAbout(transform, next.distance / pinch.distance, next.x, next.y);
        // The midpoint moves too: two fingers pan as well as pinch.
        transform = {
          ...transform,
          x: transform.x + (next.x - pinch.x),
          y: transform.y + (next.y - pinch.y),
        };
        apply();
      }
      pinch = next;
      return;
    }

    transform = {
      ...transform,
      x: transform.x + (position.x - previous.x),
      y: transform.y + (position.y - previous.y),
    };
    apply();
  }

  function onPointerUp(event: PointerEvent): void {
    pointers.delete(event.pointerId);
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    pinch = pointers.size === 2 ? pinchOf(pointers) : undefined;
    if (pointers.size === 0) {
      viewport.classList.remove('dragging');
    }
  }

  function onWheel(event: WheelEvent): void {
    // The page does not scroll under a diagram being zoomed.
    event.preventDefault();
    const { x, y } = local(event);
    // A trackpad pinch arrives as a wheel event with `ctrlKey` set, and its
    // deltas are small; the multiplier is what makes it feel like a pinch.
    const delta = event.deltaY * (event.ctrlKey ? 4 : 1);
    transform = zoomAbout(transform, Math.exp(-delta * WHEEL_SENSITIVITY), x, y);
    apply();
  }

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);
  viewport.addEventListener('wheel', onWheel, { passive: false });
  apply();

  return {
    fit: () => {
      transform = { ...IDENTITY };
      apply();
    },
    destroy: () => {
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerUp);
      viewport.removeEventListener('wheel', onWheel);
    },
  };
}

/** The distance between the first two pointers down, and the point between them. */
function pinchOf(
  pointers: ReadonlyMap<number, { x: number; y: number }>,
): { distance: number; x: number; y: number } | undefined {
  const [first, second] = [...pointers.values()];
  if (first === undefined || second === undefined) {
    return undefined;
  }
  return {
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}
