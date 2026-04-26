export declare const LoggerSanitizer: unique symbol;
/**
 * Service for sanitizing log messages to remove sensitive information.
 *
 * Adopters can rebind this service to customize sanitization behavior,
 * for example to mask additional patterns like API keys or tokens.
 *
 * @example
 * ```ts
 * // Custom sanitizer that extends the default behavior
 * @injectable()
 * class CustomLoggerSanitizer extends DefaultLoggerSanitizer {
 *     override sanitize(message: string): string {
 *         let sanitized = super.sanitize(message);
 *         // Add custom sanitization, e.g., mask API keys
 *         sanitized = sanitized.replace(/api[_-]?key[=:]\s*['"]?[\w-]+['"]?/gi, 'api_key=****');
 *         return sanitized;
 *     }
 * }
 *
 * // In your module:
 * rebind(LoggerSanitizer).to(CustomLoggerSanitizer).inSingletonScope();
 * ```
 */
export interface LoggerSanitizer {
    /**
     * Sanitizes a log message by masking sensitive information.
     *
     * @param message The log message to sanitize
     * @returns The sanitized message with sensitive data masked
     */
    sanitize(message: string): string;
}
/**
 * Represents a sanitization rule with a pattern and replacement string.
 */
export interface SanitizationRule {
    /**
     * The regex pattern to match sensitive information.
     * Can use capture groups that can be referenced in the replacement string.
     */
    pattern: RegExp;
    /**
     * The replacement string. Can include capture group references like $1, $2, etc.
     */
    replacement: string;
    /**
     * Optional quick check function that returns true if the message might contain
     * sensitive data matching this rule. Used as a fast early-exit optimization
     * to avoid running expensive regex operations on messages that definitely
     * don't contain sensitive data.
     *
     * If not provided, the regex pattern will always be executed.
     */
    precheck?: (message: string) => boolean;
}
/**
 * Default set of log sanitization rules.
 */
export declare const DefaultSanitizationRules: SanitizationRule[];
/**
 * Default implementation of LoggerSanitizer that masks credentials in URLs.
 */
export declare class DefaultLoggerSanitizer implements LoggerSanitizer {
    protected rules: SanitizationRule[];
    sanitize(message: string): string;
}
//# sourceMappingURL=logger-sanitizer.d.ts.map