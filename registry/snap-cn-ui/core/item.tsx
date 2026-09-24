import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";

/**
 * One object in a scene — a card, a step, a message, a photo — handed to
 * whoever is editing the scene.
 *
 * A scene draws its objects itself: it knows where each one is on every frame.
 * Remotion Studio wants each one as something it can select, outline and edit
 * on its own. `Item` is the seam between the two. The scene wraps the root
 * element of each object in it:
 *
 *   <Item key={i} index={k}>
 *     <div style={…}>…</div>
 *   </Item>
 *
 * With nothing above it — which is every `shadcn add` install and every render
 * on the site — it returns that element untouched: no wrapper, no extra DOM, no
 * behaviour. Inside a Studio Element, an `ItemHost` above it gets the element
 * and the object's index, and can put it inside the object's own `<Sequence>`
 * with the selection outline on that exact node, so the outline moves with the
 * object for its whole animation.
 */
export type ItemHost = (index: number, node: ReactElement) => ReactNode;

const ItemHostContext = createContext<ItemHost | null>(null);

export const ItemHostProvider = ItemHostContext.Provider;

export function Item({
  index,
  primary = true,
  children,
}: {
  /** Which of the scene's objects this is, in the order its props list them. */
  index: number;
  /**
   * False on every copy but one, for a scene that draws the same object more
   * than once (a looping rail): an object has one outline.
   */
  primary?: boolean;
  children: ReactElement;
}): ReactNode {
  const host = useContext(ItemHostContext);
  return host && primary ? host(index, children) : children;
}
