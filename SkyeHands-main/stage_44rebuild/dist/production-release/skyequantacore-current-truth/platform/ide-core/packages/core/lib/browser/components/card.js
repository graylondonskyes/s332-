"use strict";
// *****************************************************************************
// Copyright (C) 2026 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************
Object.defineProperty(exports, "__esModule", { value: true });
exports.Card = void 0;
const React = require("react");
/**
 * A reusable component for presentation of a card providing a capsule summary of some
 * data, article, or other object. Cards provide interaction behaviour when the `onClick`
 * call-back prop is supplied.
 */
exports.Card = React.memo(function Card(props) {
    const { icon, title, subtitle, onClick, className, children, maxTitleLines = 4, titleTooltip, actionButtons } = props;
    const isInteractive = onClick !== undefined;
    const handleKeyDown = React.useCallback((e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    }, [onClick]);
    const cardClasses = [
        'theia-Card',
        isInteractive && 'theia-Card-interactive',
        className
    ].filter(Boolean).join(' ');
    const titleStyle = {
        WebkitLineClamp: maxTitleLines
    };
    return (React.createElement("div", { className: cardClasses, onClick: onClick, role: isInteractive ? 'button' : undefined, tabIndex: isInteractive ? 0 : undefined, onKeyDown: isInteractive ? handleKeyDown : undefined },
        icon && (React.createElement("div", { className: `theia-Card-icon ${icon}` })),
        React.createElement("div", { className: "theia-Card-content" },
            React.createElement("div", { className: "theia-Card-title", title: titleTooltip, style: titleStyle }, title),
            actionButtons ? (React.createElement("div", { className: "theia-Card-footer" },
                subtitle && React.createElement("span", { className: "theia-Card-footer-time" }, subtitle),
                React.createElement("div", { className: "theia-Card-footer-actions" }, actionButtons.map((btn, i) => (React.createElement("button", { key: i, className: `theia-Card-action-btn ${btn.iconClass}`, title: btn.title, "aria-label": btn.title, onClick: btn.onClick })))))) : (subtitle && (React.createElement("div", { className: "theia-Card-subtitle" }, subtitle))),
            children)));
});
//# sourceMappingURL=card.js.map