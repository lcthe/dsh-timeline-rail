/**
 * @lcthe/dsh-timeline-rail — runtime invariant companion.
 *
 * No runtime invariant: this package contributes a single slot registration
 * and owns no cross-checkable runtime relationship of its own. Rendering
 * correctness is enforced by the slot system (registration into
 * `conversation.input.dock`) and by the component's own measurement effect.
 */
export const INVARIANT = 'No runtime invariant: pure client slot registration with no owned runtime relationship.'
