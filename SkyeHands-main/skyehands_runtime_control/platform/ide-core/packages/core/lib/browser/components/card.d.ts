import * as React from 'react';
export interface CardActionButton {
    /** Icon class (e.g., codicon) */
    iconClass: string;
    /** Accessible label and tooltip */
    title: string;
    /** Called when the button is clicked; receives the mouse event */
    onClick: (e: React.MouseEvent) => void;
}
export interface CardProps {
    /** Icon class (e.g., codicon) */
    icon?: string;
    /** Primary text */
    title: string;
    /** Secondary text (e.g., timestamp) */
    subtitle?: string;
    /** If provided, card is interactive */
    onClick?: () => void;
    /** Additional CSS class */
    className?: string;
    /** Child content */
    children?: React.ReactNode;
    /** Maximum number of lines for title (default: 4) */
    maxTitleLines?: number;
    /** Tooltip for title */
    titleTooltip?: string;
    /**
     * Optional action buttons shown in the card footer on hover.
     * When provided, `subtitle` is rendered as fading text beneath the title
     * and is replaced by the action buttons on hover.
     */
    actionButtons?: CardActionButton[];
}
/**
 * A reusable component for presentation of a card providing a capsule summary of some
 * data, article, or other object. Cards provide interaction behaviour when the `onClick`
 * call-back prop is supplied.
 */
export declare const Card: any;
//# sourceMappingURL=card.d.ts.map