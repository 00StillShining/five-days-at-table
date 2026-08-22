/**
 * src/cd/chassis/index.ts — 13 BACK CHANNEL, and the one API the screens need.
 *
 * Most of this folder is the chassis's own body and no screen should import it:
 * StationRail, StationTray and GlyphField are BACK CHANNEL's instruments, and a
 * screen rendering one inside its own language scope would be an element
 * reading tokens from two worlds, which CD-BRIEF's zone fence forbids.
 *
 * ---------------------------------------------------------------------------
 * WHAT SCREENS DO IMPORT: the open-panel store (CD-BRIEF R6)
 * ---------------------------------------------------------------------------
 * "Open panels survive navigation, reset on reload."
 *
 * src/app/App.tsx mounts one scene at a time, so a route change UNMOUNTS the
 * outgoing scene and destroys every useState inside it. An open tray, an open
 * accordion group or a selected tab therefore CANNOT live in the scene. Swap the
 * hook and change nothing else:
 *
 *     // BEFORE — dies the moment the operator visits another room
 *     const [openAisle, setOpenAisle] = useState<string | null>(null);
 *
 *     // AFTER — survives navigation, dies on reload
 *     const [openAisle, setOpenAisle] = useOpenPanel<string | null>("aisle", null);
 *
 * The key is namespaced by the current screen automatically, so two screens may
 * both use "aisle" without colliding. One key per panel. Store only what a
 * panel's OPENNESS is — an id, a boolean, a tab name — never data; data comes
 * from the frozen store every time. Nothing here is persisted, so a reload
 * genuinely resets it, which is the second half of the ruling.
 *
 * `useOpenSection` is the same hook named for R7's accordion, and
 * `useCloseAllPanels` shuts every panel on the current screen at once for an
 * explicit whole-screen exit.
 *
 * Proven on the chassis itself rather than asserted: the Station Tray's own
 * register drives its open lid through `useOpenSection`, and opening TIMING,
 * navigating to SHOP and returning finds TIMING still open.
 */

/**
 * THE ANNUNCIATOR QUEUE (Fable review F2). One queue, one selector, one figure.
 * Every room's alarm strip derives its count from here and from nowhere else —
 * `arbiterFor(...).queued` is NOT a queue count and must not be printed as one.
 * See annunciator.ts's header for the two measured causes of the divergence.
 */
export {
  annunciatorQueue,
  useAnnunciator,
  caption as annunciatorCaption,
  captionSplit as annunciatorCaptionSplit,
  addressableIn,
  type AnnunciatorQueue,
} from "./annunciator";

export {
  OpenPanelProvider,
  useOpenPanel,
  useOpenSection,
  useCloseAllPanels,
  createPanelStore,
  type PanelStore,
  type OpenPanelProviderProps,
} from "./panels";
