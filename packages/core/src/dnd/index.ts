// @dnd-kit/abstract - collision priority tiers for `useDroppable({ collisionPriority })`.
// Lowest=0, Low=1, Normal=2, High=3, Highest=4 — overrides a collision's intrinsic
// priority so nested drop zones sort by tier first, geometric distance second.
export { CollisionPriority } from "@dnd-kit/abstract";

// @dnd-kit/abstract - Modifiers
export {
  AxisModifier,
  restrictShapeToBoundingRectangle,
  RestrictToHorizontalAxis,
  RestrictToVerticalAxis,
  SnapModifier
} from "@dnd-kit/abstract/modifiers";

// @dnd-kit/collision - Collision detection algorithms used by useDroppable
export {
  closestCenter,
  closestCorners,
  defaultCollisionDetection,
  directionBiased,
  pointerDistance,
  pointerIntersection,
  shapeIntersection
} from "@dnd-kit/collision";

export type { CollisionDetector } from "@dnd-kit/collision";
// @dnd-kit/dom - Default preset, Feedback plugin (ghost rendering), and the
// pointer activation constraints (Distance / Delay) used to gate drag start
export { defaultPreset, Feedback, PointerActivationConstraints } from "@dnd-kit/dom";

export type { FeedbackInput, FeedbackOptions, FeedbackType } from "@dnd-kit/dom";
// @dnd-kit/dom - DOM-specific modifiers
export {
  RestrictToElement,
  RestrictToWindow
} from "@dnd-kit/dom/modifiers";

// @dnd-kit/helpers - Array manipulation utilities
export {
  arrayMove as moveArrayItem,
  move as moveDragItem,
  arraySwap as swapArrayItem,
  swap as swapDragItem
} from "@dnd-kit/helpers";

// @dnd-kit/react - Core React components and hooks
export type {
  BeforeDragStartEvent,
  CollisionEvent,
  DragDropEventHandlers,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent
} from "@dnd-kit/react";

export {
  DragDropProvider,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDragDropMonitor,
  useDraggable,
  useDragOperation,
  useDroppable
} from "@dnd-kit/react";

// @dnd-kit/react/sortable - Sortable functionality
export { useSortable } from "@dnd-kit/react/sortable";

// @hello-pangea/dnd - Alternative DnD library (fork of react-beautiful-dnd)
export type {
  DragDropContextProps,
  DraggableChildrenFn,
  DraggableId,
  DraggableLocation,
  DraggableProps,
  DraggableProvided,
  DraggableProvidedDraggableProps,
  DraggableProvidedDragHandleProps,
  DraggableRubric,
  DraggableStateSnapshot,
  DroppableId,
  DroppableProps,
  DroppableProvided,
  DroppableProvidedProps,
  DroppableStateSnapshot,
  DropResult,
  OnBeforeCaptureResponder,
  OnBeforeDragStartResponder,
  OnDragEndResponder,
  OnDragStartResponder,
  OnDragUpdateResponder
} from "@hello-pangea/dnd";

export {
  DragDropContext,
  Draggable,
  Droppable
} from "@hello-pangea/dnd";
