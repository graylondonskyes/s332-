"use strict";
// *****************************************************************************
// Copyright (C) 2017 TypeFox and others.
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
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.KEY_CODE_MAP = void 0;
const browser = require("@theia/core/lib/browser");
// This is exported as part of the public API, but we use it with private API's so we need to refer to the private version.
const keyCodes_1 = require("@theia/monaco-editor-core/esm/vs/base/common/keyCodes");
const MonacoPlatform = require("@theia/monaco-editor-core/esm/vs/base/common/platform");
exports.KEY_CODE_MAP = [];
(function () {
    exports.KEY_CODE_MAP[3] = keyCodes_1.KeyCode.PauseBreak; // VK_CANCEL 0x03 Control-break processing
    exports.KEY_CODE_MAP[8] = keyCodes_1.KeyCode.Backspace;
    exports.KEY_CODE_MAP[9] = keyCodes_1.KeyCode.Tab;
    exports.KEY_CODE_MAP[13] = keyCodes_1.KeyCode.Enter;
    exports.KEY_CODE_MAP[16] = keyCodes_1.KeyCode.Shift;
    exports.KEY_CODE_MAP[17] = keyCodes_1.KeyCode.Ctrl;
    exports.KEY_CODE_MAP[18] = keyCodes_1.KeyCode.Alt;
    exports.KEY_CODE_MAP[19] = keyCodes_1.KeyCode.PauseBreak;
    exports.KEY_CODE_MAP[20] = keyCodes_1.KeyCode.CapsLock;
    exports.KEY_CODE_MAP[27] = keyCodes_1.KeyCode.Escape;
    exports.KEY_CODE_MAP[32] = keyCodes_1.KeyCode.Space;
    exports.KEY_CODE_MAP[33] = keyCodes_1.KeyCode.PageUp;
    exports.KEY_CODE_MAP[34] = keyCodes_1.KeyCode.PageDown;
    exports.KEY_CODE_MAP[35] = keyCodes_1.KeyCode.End;
    exports.KEY_CODE_MAP[36] = keyCodes_1.KeyCode.Home;
    exports.KEY_CODE_MAP[37] = keyCodes_1.KeyCode.LeftArrow;
    exports.KEY_CODE_MAP[38] = keyCodes_1.KeyCode.UpArrow;
    exports.KEY_CODE_MAP[39] = keyCodes_1.KeyCode.RightArrow;
    exports.KEY_CODE_MAP[40] = keyCodes_1.KeyCode.DownArrow;
    exports.KEY_CODE_MAP[45] = keyCodes_1.KeyCode.Insert;
    exports.KEY_CODE_MAP[46] = keyCodes_1.KeyCode.Delete;
    exports.KEY_CODE_MAP[48] = keyCodes_1.KeyCode.Digit0;
    exports.KEY_CODE_MAP[49] = keyCodes_1.KeyCode.Digit1;
    exports.KEY_CODE_MAP[50] = keyCodes_1.KeyCode.Digit2;
    exports.KEY_CODE_MAP[51] = keyCodes_1.KeyCode.Digit3;
    exports.KEY_CODE_MAP[52] = keyCodes_1.KeyCode.Digit4;
    exports.KEY_CODE_MAP[53] = keyCodes_1.KeyCode.Digit5;
    exports.KEY_CODE_MAP[54] = keyCodes_1.KeyCode.Digit6;
    exports.KEY_CODE_MAP[55] = keyCodes_1.KeyCode.Digit7;
    exports.KEY_CODE_MAP[56] = keyCodes_1.KeyCode.Digit8;
    exports.KEY_CODE_MAP[57] = keyCodes_1.KeyCode.Digit9;
    exports.KEY_CODE_MAP[65] = keyCodes_1.KeyCode.KeyA;
    exports.KEY_CODE_MAP[66] = keyCodes_1.KeyCode.KeyB;
    exports.KEY_CODE_MAP[67] = keyCodes_1.KeyCode.KeyC;
    exports.KEY_CODE_MAP[68] = keyCodes_1.KeyCode.KeyD;
    exports.KEY_CODE_MAP[69] = keyCodes_1.KeyCode.KeyE;
    exports.KEY_CODE_MAP[70] = keyCodes_1.KeyCode.KeyF;
    exports.KEY_CODE_MAP[71] = keyCodes_1.KeyCode.KeyG;
    exports.KEY_CODE_MAP[72] = keyCodes_1.KeyCode.KeyH;
    exports.KEY_CODE_MAP[73] = keyCodes_1.KeyCode.KeyI;
    exports.KEY_CODE_MAP[74] = keyCodes_1.KeyCode.KeyJ;
    exports.KEY_CODE_MAP[75] = keyCodes_1.KeyCode.KeyK;
    exports.KEY_CODE_MAP[76] = keyCodes_1.KeyCode.KeyL;
    exports.KEY_CODE_MAP[77] = keyCodes_1.KeyCode.KeyM;
    exports.KEY_CODE_MAP[78] = keyCodes_1.KeyCode.KeyN;
    exports.KEY_CODE_MAP[79] = keyCodes_1.KeyCode.KeyO;
    exports.KEY_CODE_MAP[80] = keyCodes_1.KeyCode.KeyP;
    exports.KEY_CODE_MAP[81] = keyCodes_1.KeyCode.KeyQ;
    exports.KEY_CODE_MAP[82] = keyCodes_1.KeyCode.KeyR;
    exports.KEY_CODE_MAP[83] = keyCodes_1.KeyCode.KeyS;
    exports.KEY_CODE_MAP[84] = keyCodes_1.KeyCode.KeyT;
    exports.KEY_CODE_MAP[85] = keyCodes_1.KeyCode.KeyU;
    exports.KEY_CODE_MAP[86] = keyCodes_1.KeyCode.KeyV;
    exports.KEY_CODE_MAP[87] = keyCodes_1.KeyCode.KeyW;
    exports.KEY_CODE_MAP[88] = keyCodes_1.KeyCode.KeyX;
    exports.KEY_CODE_MAP[89] = keyCodes_1.KeyCode.KeyY;
    exports.KEY_CODE_MAP[90] = keyCodes_1.KeyCode.KeyZ;
    exports.KEY_CODE_MAP[93] = keyCodes_1.KeyCode.ContextMenu;
    exports.KEY_CODE_MAP[96] = keyCodes_1.KeyCode.Numpad0;
    exports.KEY_CODE_MAP[97] = keyCodes_1.KeyCode.Numpad1;
    exports.KEY_CODE_MAP[98] = keyCodes_1.KeyCode.Numpad2;
    exports.KEY_CODE_MAP[99] = keyCodes_1.KeyCode.Numpad3;
    exports.KEY_CODE_MAP[100] = keyCodes_1.KeyCode.Numpad4;
    exports.KEY_CODE_MAP[101] = keyCodes_1.KeyCode.Numpad5;
    exports.KEY_CODE_MAP[102] = keyCodes_1.KeyCode.Numpad6;
    exports.KEY_CODE_MAP[103] = keyCodes_1.KeyCode.Numpad7;
    exports.KEY_CODE_MAP[104] = keyCodes_1.KeyCode.Numpad8;
    exports.KEY_CODE_MAP[105] = keyCodes_1.KeyCode.Numpad9;
    exports.KEY_CODE_MAP[106] = keyCodes_1.KeyCode.NumpadMultiply;
    exports.KEY_CODE_MAP[107] = keyCodes_1.KeyCode.NumpadAdd;
    exports.KEY_CODE_MAP[108] = keyCodes_1.KeyCode.NUMPAD_SEPARATOR;
    exports.KEY_CODE_MAP[109] = keyCodes_1.KeyCode.NumpadSubtract;
    exports.KEY_CODE_MAP[110] = keyCodes_1.KeyCode.NumpadDecimal;
    exports.KEY_CODE_MAP[111] = keyCodes_1.KeyCode.NumpadDivide;
    exports.KEY_CODE_MAP[112] = keyCodes_1.KeyCode.F1;
    exports.KEY_CODE_MAP[113] = keyCodes_1.KeyCode.F2;
    exports.KEY_CODE_MAP[114] = keyCodes_1.KeyCode.F3;
    exports.KEY_CODE_MAP[115] = keyCodes_1.KeyCode.F4;
    exports.KEY_CODE_MAP[116] = keyCodes_1.KeyCode.F5;
    exports.KEY_CODE_MAP[117] = keyCodes_1.KeyCode.F6;
    exports.KEY_CODE_MAP[118] = keyCodes_1.KeyCode.F7;
    exports.KEY_CODE_MAP[119] = keyCodes_1.KeyCode.F8;
    exports.KEY_CODE_MAP[120] = keyCodes_1.KeyCode.F9;
    exports.KEY_CODE_MAP[121] = keyCodes_1.KeyCode.F10;
    exports.KEY_CODE_MAP[122] = keyCodes_1.KeyCode.F11;
    exports.KEY_CODE_MAP[123] = keyCodes_1.KeyCode.F12;
    exports.KEY_CODE_MAP[124] = keyCodes_1.KeyCode.F13;
    exports.KEY_CODE_MAP[125] = keyCodes_1.KeyCode.F14;
    exports.KEY_CODE_MAP[126] = keyCodes_1.KeyCode.F15;
    exports.KEY_CODE_MAP[127] = keyCodes_1.KeyCode.F16;
    exports.KEY_CODE_MAP[128] = keyCodes_1.KeyCode.F17;
    exports.KEY_CODE_MAP[129] = keyCodes_1.KeyCode.F18;
    exports.KEY_CODE_MAP[130] = keyCodes_1.KeyCode.F19;
    exports.KEY_CODE_MAP[144] = keyCodes_1.KeyCode.NumLock;
    exports.KEY_CODE_MAP[145] = keyCodes_1.KeyCode.ScrollLock;
    exports.KEY_CODE_MAP[186] = keyCodes_1.KeyCode.Semicolon;
    exports.KEY_CODE_MAP[187] = keyCodes_1.KeyCode.Equal;
    exports.KEY_CODE_MAP[188] = keyCodes_1.KeyCode.Comma;
    exports.KEY_CODE_MAP[189] = keyCodes_1.KeyCode.Minus;
    exports.KEY_CODE_MAP[190] = keyCodes_1.KeyCode.Period;
    exports.KEY_CODE_MAP[191] = keyCodes_1.KeyCode.Slash;
    exports.KEY_CODE_MAP[192] = keyCodes_1.KeyCode.Backquote;
    exports.KEY_CODE_MAP[193] = keyCodes_1.KeyCode.ABNT_C1;
    exports.KEY_CODE_MAP[194] = keyCodes_1.KeyCode.ABNT_C2;
    exports.KEY_CODE_MAP[219] = keyCodes_1.KeyCode.BracketLeft;
    exports.KEY_CODE_MAP[220] = keyCodes_1.KeyCode.Backslash;
    exports.KEY_CODE_MAP[221] = keyCodes_1.KeyCode.BracketRight;
    exports.KEY_CODE_MAP[222] = keyCodes_1.KeyCode.Quote;
    exports.KEY_CODE_MAP[223] = keyCodes_1.KeyCode.OEM_8;
    exports.KEY_CODE_MAP[226] = keyCodes_1.KeyCode.IntlBackslash;
    /**
     * https://lists.w3.org/Archives/Public/www-dom/2010JulSep/att-0182/keyCode-spec.html
     * If an Input Method Editor is processing key input and the event is keydown, return 229.
     */
    exports.KEY_CODE_MAP[229] = keyCodes_1.KeyCode.KEY_IN_COMPOSITION;
    if (browser.isIE) {
        exports.KEY_CODE_MAP[91] = keyCodes_1.KeyCode.Meta;
    }
    else if (browser.isFirefox) {
        exports.KEY_CODE_MAP[59] = keyCodes_1.KeyCode.Semicolon;
        exports.KEY_CODE_MAP[107] = keyCodes_1.KeyCode.Equal;
        exports.KEY_CODE_MAP[109] = keyCodes_1.KeyCode.Minus;
        if (MonacoPlatform.OS === MonacoPlatform.OperatingSystem.Macintosh) {
            exports.KEY_CODE_MAP[224] = keyCodes_1.KeyCode.Meta;
        }
    }
    else if (browser.isWebKit) {
        exports.KEY_CODE_MAP[91] = keyCodes_1.KeyCode.Meta;
        if (MonacoPlatform.OS === MonacoPlatform.OperatingSystem.Macintosh) {
            // the two meta keys in the Mac have different key codes (91 and 93)
            exports.KEY_CODE_MAP[93] = keyCodes_1.KeyCode.Meta;
        }
        else {
            exports.KEY_CODE_MAP[92] = keyCodes_1.KeyCode.Meta;
        }
    }
})();
//# sourceMappingURL=monaco-keycode-map.js.map