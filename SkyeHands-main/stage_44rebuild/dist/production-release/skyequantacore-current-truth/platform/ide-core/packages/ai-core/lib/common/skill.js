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
exports.SkillDescription = exports.SKILL_FILE_NAME = void 0;
exports.isValidSkillName = isValidSkillName;
exports.validateSkillDescription = validateSkillDescription;
exports.parseSkillFile = parseSkillFile;
exports.combineSkillDirectories = combineSkillDirectories;
const js_yaml_1 = require("js-yaml");
/**
 * The standard filename for skill definition files.
 */
exports.SKILL_FILE_NAME = 'SKILL.md';
/**
 * Regular expression for valid skill names.
 * Must be lowercase kebab-case with digits allowed.
 * Examples: 'my-skill', 'skill1', 'my-skill-2'
 */
const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/**
 * Maximum allowed length for skill descriptions.
 */
const MAX_DESCRIPTION_LENGTH = 1024;
var SkillDescription;
(function (SkillDescription) {
    /**
     * Type guard to check if an unknown value is a valid SkillDescription.
     * Validates that required fields exist and have correct types.
     */
    function is(entry) {
        if (typeof entry !== 'object' || entry === undefined) {
            return false;
        }
        // eslint-disable-next-line no-null/no-null
        if (entry === null) {
            return false;
        }
        const obj = entry;
        return typeof obj.name === 'string' && typeof obj.description === 'string';
    }
    SkillDescription.is = is;
    /**
     * Compares two SkillDescription objects for equality based on name.
     */
    function equals(a, b) {
        return a.name === b.name;
    }
    SkillDescription.equals = equals;
})(SkillDescription || (exports.SkillDescription = SkillDescription = {}));
/**
 * Validates if a skill name follows the required format.
 * Valid names are lowercase kebab-case with digits allowed.
 * No leading/trailing/consecutive hyphens.
 *
 * @param name The skill name to validate
 * @returns true if the name is valid, false otherwise
 */
function isValidSkillName(name) {
    return SKILL_NAME_REGEX.test(name);
}
/**
 * Validates a SkillDescription against all constraints.
 *
 * @param description The skill description to validate
 * @param directoryName The name of the directory containing the SKILL.md file
 * @returns Array of validation error messages, empty if valid
 */
function validateSkillDescription(description, directoryName) {
    const errors = [];
    if (typeof description.name !== 'string') {
        errors.push('Skill name must be a string');
    }
    else {
        if (description.name !== directoryName) {
            errors.push(`Skill name '${description.name}' must match directory name '${directoryName}'. Skipping skill.`);
        }
        if (!isValidSkillName(description.name)) {
            errors.push(`Skill name '${description.name}' must be lowercase kebab-case (e.g., 'my-skill', 'skill1')`);
        }
    }
    if (typeof description.description !== 'string') {
        errors.push('Skill description must be a string');
    }
    else if (description.description.length > MAX_DESCRIPTION_LENGTH) {
        errors.push(`Skill description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`);
    }
    return errors;
}
/**
 * Parses a SKILL.md file content, extracting YAML frontmatter metadata and markdown content.
 * @param content The raw file content
 * @returns Object with parsed metadata (if valid) and the markdown content
 */
function parseSkillFile(content) {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);
    if (!match) {
        return { metadata: undefined, content };
    }
    try {
        const yamlContent = match[1];
        const markdownContent = match[2].trim();
        const parsedYaml = (0, js_yaml_1.load)(yamlContent);
        if (!parsedYaml || typeof parsedYaml !== 'object') {
            return { metadata: undefined, content };
        }
        // Validate that required fields are present (name and description)
        if (!SkillDescription.is(parsedYaml)) {
            return { metadata: undefined, content };
        }
        return { metadata: parsedYaml, content: markdownContent };
    }
    catch {
        return { metadata: undefined, content };
    }
}
/**
 * Combines skill directories with proper priority ordering.
 * Workspace directory has highest priority, followed by configured directories, then default.
 * First directory wins on duplicates.
 */
function combineSkillDirectories(workspaceSkillsDir, configuredDirectories, defaultSkillsDir) {
    const allDirectories = [];
    if (workspaceSkillsDir) {
        allDirectories.push(workspaceSkillsDir);
    }
    for (const dir of configuredDirectories) {
        if (!allDirectories.includes(dir)) {
            allDirectories.push(dir);
        }
    }
    if (defaultSkillsDir && !allDirectories.includes(defaultSkillsDir)) {
        allDirectories.push(defaultSkillsDir);
    }
    return allDirectories;
}
//# sourceMappingURL=skill.js.map