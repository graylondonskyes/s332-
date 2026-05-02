"use strict";
// *****************************************************************************
// Copyright (C) 2024 EclipseSource GmbH.
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
exports.FRONT_MATTER_REGEX = exports.PROMPT_FUNCTION_REGEX = exports.PROMPT_VARIABLE_THREE_BRACES_REGEX = exports.PROMPT_VARIABLE_TWO_BRACES_REGEX = void 0;
exports.matchVariablesRegEx = matchVariablesRegEx;
exports.matchFunctionsRegEx = matchFunctionsRegEx;
exports.stripFrontMatter = stripFrontMatter;
/** Should match the one from VariableResolverService. The format is `{{variableName:arg}}`. We allow {{}} and {{{}}} but no mixtures */
exports.PROMPT_VARIABLE_TWO_BRACES_REGEX = /(?<!\{)\{\{\s*([^{}]+?)\s*\}\}(?!\})/g;
exports.PROMPT_VARIABLE_THREE_BRACES_REGEX = /(?<!\{)\{\{\{\s*([^{}]+?)\s*\}\}\}(?!\})/g;
function matchVariablesRegEx(template) {
    const twoBraceMatches = [...template.matchAll(exports.PROMPT_VARIABLE_TWO_BRACES_REGEX)];
    const threeBraceMatches = [...template.matchAll(exports.PROMPT_VARIABLE_THREE_BRACES_REGEX)];
    return twoBraceMatches.concat(threeBraceMatches);
}
/** Match function/tool references in the prompt. The format is `~{functionId}`. */
exports.PROMPT_FUNCTION_REGEX = /\~\{\s*(.*?)\s*\}/g;
function matchFunctionsRegEx(template) {
    return [...template.matchAll(exports.PROMPT_FUNCTION_REGEX)];
}
/** Regex matching YAML front matter delimited by `---` */
exports.FRONT_MATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
/**
 * Strips YAML front matter from a template string, returning only the body.
 * If no front matter is present the original string is returned unchanged.
 */
function stripFrontMatter(template) {
    const match = template.match(exports.FRONT_MATTER_REGEX);
    return match ? match[2] : template;
}
//# sourceMappingURL=prompt-service-util.js.map