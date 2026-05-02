"use strict";
// *****************************************************************************
// Copyright (C) 2018 TypeFox and others.
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
const chai_1 = require("chai");
const mock_logger_1 = require("./test/mock-logger");
const logger_1 = require("./logger");
const logger_sanitizer_1 = require("./logger-sanitizer");
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-null/no-null */
/**
 * Testable subclass of Logger that exposes protected methods for testing.
 */
class TestableLogger extends logger_1.Logger {
    constructor(sanitizer) {
        super();
        // Bypass dependency injection for testing
        this.sanitizer = sanitizer;
    }
    testFormat(value) {
        return this.format(value);
    }
    testSanitize(message) {
        return this.sanitize(message);
    }
}
describe('logger', () => {
    it('window is not defined', () => {
        (0, chai_1.expect)(() => { window; }).to.throw(ReferenceError, /window is not defined/);
    });
    it('window is not defined when converting to boolean', () => {
        (0, chai_1.expect)(() => { !!window; }).to.throw(ReferenceError, /window is not defined/);
    });
    it('window is not defined safe', () => {
        (0, chai_1.expect)(() => { typeof window !== 'undefined'; }).to.not.throw(ReferenceError);
    });
    it('setting the root logger should not throw an error when the window is not defined', () => {
        (0, chai_1.expect)(() => {
            try {
                (0, logger_1.setRootLogger)(new mock_logger_1.MockLogger());
            }
            finally {
                (0, logger_1.unsetRootLogger)();
            }
        }).to.not.throw(ReferenceError);
    });
    describe('Logger sanitization', () => {
        let loggerWithSanitizer;
        let loggerWithoutSanitizer;
        beforeEach(() => {
            loggerWithSanitizer = new TestableLogger(new logger_sanitizer_1.DefaultLoggerSanitizer());
            loggerWithoutSanitizer = new TestableLogger(undefined);
        });
        describe('format', () => {
            it('should sanitize string messages with credentials', () => {
                const message = 'Connecting to http://user:pass@proxy.com:8080';
                const formatted = loggerWithSanitizer.testFormat(message);
                (0, chai_1.expect)(formatted).to.equal('Connecting to http://****:****@proxy.com:8080');
            });
            it('should sanitize error stack traces with credentials', () => {
                const error = new Error('Connection failed to http://admin:secret@server.com');
                const formatted = loggerWithSanitizer.testFormat(error);
                (0, chai_1.expect)(formatted).to.include('http://****:****@server.com');
                (0, chai_1.expect)(formatted).not.to.include('admin:secret');
            });
            it('should handle Error as Error not as generic object', () => {
                const error = new Error('Test error');
                const formatted = loggerWithSanitizer.testFormat(error);
                (0, chai_1.expect)(typeof formatted).to.equal('string');
                (0, chai_1.expect)(formatted).to.include('Error: Test error');
            });
            it('should handle objects containing Error instances', () => {
                const obj = {
                    error: new Error('http://user:pass@server.com'),
                    message: 'something failed'
                };
                const formatted = loggerWithSanitizer.testFormat(obj);
                (0, chai_1.expect)(formatted).to.be.an('object');
                (0, chai_1.expect)(formatted.message).to.equal('something failed');
            });
            it('should sanitize objects with sensitive data', () => {
                const obj = { url: 'http://user:pass@proxy.com' };
                const formatted = loggerWithSanitizer.testFormat(obj);
                (0, chai_1.expect)(formatted).to.deep.equal({ url: 'http://****:****@proxy.com' });
            });
            it('should sanitize nested objects with sensitive data', () => {
                const obj = {
                    changes: [{
                            text: '{"serverAuthToken": "abc122", "apiKey": "secret123"}'
                        }],
                    config: {
                        credentials: 'http://admin:password@server.com'
                    }
                };
                const formatted = loggerWithSanitizer.testFormat(obj);
                (0, chai_1.expect)(formatted.changes[0].text).to.equal('{"serverAuthToken": "****", "apiKey": "****"}');
                (0, chai_1.expect)(formatted.config.credentials).to.equal('http://****:****@server.com');
            });
            it('should return null unchanged', () => {
                const formatted = loggerWithSanitizer.testFormat(null);
                (0, chai_1.expect)(formatted).to.equal(null);
            });
            it('should return undefined unchanged', () => {
                const formatted = loggerWithSanitizer.testFormat(undefined);
                (0, chai_1.expect)(formatted).to.equal(undefined);
            });
            it('should return numbers unchanged', () => {
                const formatted = loggerWithSanitizer.testFormat(42);
                (0, chai_1.expect)(formatted).to.equal(42);
            });
            it('should handle messages without credentials', () => {
                const message = 'Normal log message';
                const formatted = loggerWithSanitizer.testFormat(message);
                (0, chai_1.expect)(formatted).to.equal('Normal log message');
            });
        });
        describe('sanitize without sanitizer', () => {
            it('should return message unchanged when no sanitizer is injected', () => {
                const message = 'http://user:pass@proxy.com:8080';
                const sanitized = loggerWithoutSanitizer.testSanitize(message);
                (0, chai_1.expect)(sanitized).to.equal(message);
            });
        });
        describe('sanitize with default sanitizer', () => {
            it('should mask credentials in URLs', () => {
                const message = 'http://user:pass@proxy.com:8080';
                const sanitized = loggerWithSanitizer.testSanitize(message);
                (0, chai_1.expect)(sanitized).to.equal('http://****:****@proxy.com:8080');
            });
            it('should mask multiple URLs in a single message', () => {
                const message = 'Primary: http://u1:p1@proxy1.com, Fallback: https://u2:p2@proxy2.com';
                const sanitized = loggerWithSanitizer.testSanitize(message);
                (0, chai_1.expect)(sanitized).to.equal('Primary: http://****:****@proxy1.com, Fallback: https://****:****@proxy2.com');
            });
            it('should mask multiple URLs in a single message', () => {
                const message = 'Proxy: http://u1:p1@proxy1.com, File: file:///some/path';
                const sanitized = loggerWithSanitizer.testSanitize(message);
                (0, chai_1.expect)(sanitized).to.equal('Proxy: http://****:****@proxy1.com, File: file:///some/path');
            });
            it('should mask credentials across different protocols', () => {
                const message = 'Proxies: socks5://u:p@socks.com:8080, ftp://u:p@ftp.com, wss://u:p@ws.com';
                const sanitized = loggerWithSanitizer.testSanitize(message);
                (0, chai_1.expect)(sanitized).to.equal('Proxies: socks5://****:****@socks.com:8080, ftp://****:****@ftp.com, wss://****:****@ws.com');
            });
            it('should mask API keys and tokens in fireDidChangeContent logs from settings file', () => {
                const message = '{  \"ai-features.google.apiKey\": \"abcdef12345\",\n  \"serverAuthToken\": \"github_pat_123456\" }';
                const sanitized = loggerWithSanitizer.testSanitize(message);
                (0, chai_1.expect)(sanitized).to.equal('{  \"ai-features.google.apiKey\": \"****\",\n  \"serverAuthToken\": \"****\" }');
            });
            it('should mask API keys in JSON format with different naming conventions', () => {
                const message = '{"API-KEY": "secret123", "openai_api_key": "mytoken"}';
                const sanitized = loggerWithSanitizer.testSanitize(message);
                (0, chai_1.expect)(sanitized).to.equal('{"API-KEY": "****", "openai_api_key": "****"}');
            });
        });
        describe('custom sanitizer', () => {
            it('should allow custom sanitizer implementation', () => {
                const customSanitizer = {
                    sanitize: (msg) => msg.replace(/secret/gi, '***')
                };
                const loggerWithCustomSanitizer = new TestableLogger(customSanitizer);
                const message = 'The secret code is SECRET';
                const sanitized = loggerWithCustomSanitizer.testSanitize(message);
                (0, chai_1.expect)(sanitized).to.equal('The *** code is ***');
            });
            it('should return sanitized string if sanitizer produces invalid JSON', () => {
                const customSanitizer = {
                    sanitize: (msg) => msg.replace(/"value":\s*"[^"]*"/g, '"value": INVALID')
                };
                const loggerWithCustomSanitizer = new TestableLogger(customSanitizer);
                const obj = { key: 'test', value: 'secret' };
                const formatted = loggerWithCustomSanitizer.testFormat(obj);
                (0, chai_1.expect)(formatted).to.equal('{"key":"test","value": INVALID}');
            });
        });
    });
});
//# sourceMappingURL=logger.spec.js.map