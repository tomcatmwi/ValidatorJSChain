"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const validator_1 = __importDefault(require("validator"));
const defaultValidatorStatus = {
    bailed: false,
    suspended: false,
    skipped: false,
    invertNext: false
};
class ValidatorJSChain {
    constructor() { }
    input = {
        label: null,
        value: undefined,
    };
    status = { ...defaultValidatorStatus };
    get errorCount() {
        let errors = 0;
        if (!this.status.results)
            return errors;
        const results = this.status.results;
        Object.keys(results).forEach(label => {
            Object.keys(results[label])
                .filter(x => x !== 'value')
                .forEach(validator => {
                if (results[label][validator].error)
                    errors++;
            });
        });
        return errors;
    }
    get errors() {
        if (!this.status.results)
            return {};
        const retval = {};
        const results = this.status.results;
        Object.keys(results).forEach(label => {
            Object.keys(results[label])
                .filter(x => x !== 'value')
                .forEach(validator => {
                if (results[label][validator].error) {
                    if (!retval[label])
                        retval[label] = { value: results[label].value };
                    retval[label][validator] = results[label][validator];
                }
            });
        });
        return retval;
    }
    get values() {
        if (!this.status.results)
            return {};
        const retval = {};
        Object.keys(this.status.results).forEach(key => {
            retval[key] = this.status.results[key].value;
        });
        return retval;
    }
    get results() {
        return { ...this.status.results };
    }
    get value() {
        return this.input.value;
    }
    get lastValidator() {
        return this.status.lastValidator;
    }
    clearResults() {
        if (this.status.bailed || this.status.suspended || this.status.skipped)
            return this;
        this.status = { ...defaultValidatorStatus };
        return this;
    }
    addResultValues(values, overwrite = false) {
        if (!this.status.results)
            this.status.results = {};
        Object.keys(values).forEach(key => {
            if (overwrite || !this.values[key]) {
                this.status.results[key] = {
                    value: values[key],
                };
            }
        });
        return this;
    }
    setValue(label, value = '', unbail = false, convertToString = true) {
        if (unbail)
            this.status.bailed = false;
        if (this.status.bailed || this.status.suspended)
            return this;
        this.status.skipped = false;
        if (!label || (!!label && !!this.status.results && Object.keys(this.status.results).includes(label))) {
            throw `Invalid validation chain label: "${String(label)}"`;
        }
        if (convertToString) {
            if (!!value && typeof value === 'object')
                value = JSON.stringify(value);
            if (value !== null && value !== undefined && typeof value !== 'string')
                value = String(value);
            if (value === null || value === undefined)
                value = '';
        }
        this.status.suspended = false;
        this.status.lastValidator = null;
        this.status.invertNext = false;
        this.input = { label, value };
        if (!this.status.results)
            this.status.results = {};
        this.status.results[label] = {
            value,
        };
        return this;
    }
    validatorMethod(executor, ...args) {
        if (!this.input.label)
            return this;
        if (!this.status.results)
            this.status.results = {};
        if (!this.status.results[this.input.label])
            this.status.results[this.input.label] = {
                value: this.input.value
            };
        if (this.status.bailed || this.status.suspended || this.status.skipped)
            return this;
        let executorName = executor.name || 'custom';
        const results = this.status.results[this.input.label];
        const regExp = new RegExp('^(' + executorName + ')(_d+)?', 'g');
        const previousValidators = Object.keys(results)
            .filter(key => !!key.match(regExp));
        if (previousValidators.length) {
            if (results[executorName]) {
                results[executorName + '_0'] = results[executorName];
                delete results[executorName];
            }
            executorName += '_' + previousValidators.length;
        }
        this.status.lastValidator = executorName;
        const validationResult = executor(this.input?.value, ...args);
        results[executorName] = {
            error: this.status.invertNext ? validationResult : !validationResult,
        };
        this.status.invertNext = false;
        return this;
    }
    sanitizerMethod(executor, ...args) {
        if (this.status.bailed || this.status.suspended || this.status.skipped)
            return this;
        const isExecutorALocalMethod = (Object.getOwnPropertyNames(Object.getPrototypeOf(this)).includes(executor.name));
        const sanitizedValue = executor(isExecutorALocalMethod ? String(this.input?.value) : this.input.value, ...args);
        this.input.value = sanitizedValue;
        if (!this.status.results)
            this.status.results = {};
        this.status.results[this.input.label] = {
            ...this.status.results[this.input.label],
            value: sanitizedValue,
        };
        return this;
    }
    default(value, stringify = true) {
        if (this.status.bailed || this.status.suspended || this.status.skipped)
            return this;
        const newValue = value === null ? null : (stringify ? String(value) : value);
        if (!this.input.value) {
            this.input.value = newValue;
            this.status.results[this.input.label].value = value;
        }
        return this;
    }
    optional() {
        if (this.status.bailed || this.status.suspended || this.status.skipped)
            return this;
        if (this.input?.value === undefined || this.input?.value === null || this.input?.value === '')
            this.status.skipped = true;
        return this;
    }
    not() {
        if (this.status.bailed || this.status.suspended || this.status.skipped)
            return this;
        this.status.invertNext = true;
        return this;
    }
    bail() {
        if (this.errorCount > 0) {
            this.status.bailed = true;
            this.status.suspended = false;
        }
        return this;
    }
    unbail() {
        if (this.status.suspended || this.status.skipped)
            return this;
        this.status.bailed = false;
        return this;
    }
    if(condition) {
        const results = {};
        Object.keys({ ...this.status?.results || {} })
            .forEach(key => results[key] = (this.status?.results?.[key]).value);
        if (!condition(this.input?.value, results))
            this.status.suspended = true;
        return this;
    }
    endif() {
        this.status.suspended = false;
        return this;
    }
    withMessage(message) {
        if (!this.status.bailed &&
            !this.status.suspended &&
            !!this.status.lastValidator &&
            !!this.input.label &&
            !!this.status.results) {
            const label = this.input.label;
            const results = this.status.results;
            const lastResult = results[label][this.status.lastValidator];
            if (lastResult.error)
                lastResult.message = typeof message === 'function' ? message(this.input.value) : message;
        }
        return this;
    }
    custom(validator, ...args) {
        return this.validatorMethod(validator, ...args);
    }
    customSanitizer(sanitizer, ...args) {
        return this.sanitizerMethod(sanitizer, ...args);
    }
    peek(executor) {
        if (this.status.bailed || this.status.suspended || this.status.skipped)
            return this;
        executor(this.input.value);
        return this;
    }
    contains(seed, options) {
        return this.validatorMethod(validator_1.default.contains, seed, options);
    }
    equals(comparison) {
        return this.validatorMethod(validator_1.default.equals, comparison);
    }
    ibanLocales() {
        return this.validatorMethod(validator_1.default.ibanLocales);
    }
    isAfter(options) {
        return this.validatorMethod(validator_1.default.isAfter, options);
    }
    isAlpha(locale, options) {
        return this.validatorMethod(validator_1.default.isAlpha, locale, options);
    }
    isAlphanumeric(locale, options) {
        return this.validatorMethod(validator_1.default.isAlphanumeric, locale, options);
    }
    isAscii() {
        return this.validatorMethod(validator_1.default.isAscii);
    }
    isBase32(options) {
        return this.validatorMethod(validator_1.default.isBase32, options);
    }
    isBase58() {
        return this.validatorMethod(validator_1.default.isBase58);
    }
    isBase64(options) {
        return this.validatorMethod(validator_1.default.isBase64, options);
    }
    isBefore(date) {
        return this.validatorMethod(validator_1.default.isBefore, date);
    }
    isBIC() {
        return this.validatorMethod(validator_1.default.isBIC);
    }
    isBoolean(options) {
        return this.validatorMethod(validator_1.default.isBoolean, options);
    }
    isBtcAddress() {
        return this.validatorMethod(validator_1.default.isBtcAddress);
    }
    isByteLength(options) {
        return this.validatorMethod(validator_1.default.isByteLength, options);
    }
    isCreditCard(options) {
        return this.validatorMethod(validator_1.default.isCreditCard, options);
    }
    isCurrency(options) {
        return this.validatorMethod(validator_1.default.isCurrency, options);
    }
    isDataURI() {
        return this.validatorMethod(validator_1.default.isDataURI);
    }
    isDate(options) {
        return this.validatorMethod(validator_1.default.isDate, options);
    }
    isDecimal(options) {
        return this.validatorMethod(validator_1.default.isDecimal, options);
    }
    isDivisibleBy(number) {
        return this.validatorMethod(validator_1.default.isDivisibleBy, number);
    }
    isEAN() {
        return this.validatorMethod(validator_1.default.isEAN);
    }
    isEmail(options) {
        return this.validatorMethod(validator_1.default.isEmail, options);
    }
    isEmpty(options) {
        return this.validatorMethod(validator_1.default.isEmpty, options);
    }
    isEthereumAddress() {
        return this.validatorMethod(validator_1.default.isEthereumAddress);
    }
    isFloat(options) {
        return this.validatorMethod(validator_1.default.isFloat, options);
    }
    isFQDN(options) {
        return this.validatorMethod(validator_1.default.isFQDN, options);
    }
    isFullWidth() {
        return this.validatorMethod(validator_1.default.isFullWidth);
    }
    isHalfWidth() {
        return this.validatorMethod(validator_1.default.isHalfWidth);
    }
    isHash(algorithm) {
        return this.validatorMethod(validator_1.default.isHash, algorithm);
    }
    isHexadecimal() {
        return this.validatorMethod(validator_1.default.isHexadecimal);
    }
    isHexColor() {
        return this.validatorMethod(validator_1.default.isHexColor);
    }
    isHSL() {
        return this.validatorMethod(validator_1.default.isHSL);
    }
    isIBAN() {
        return this.validatorMethod(validator_1.default.isIBAN);
    }
    isIdentityCard(locale) {
        return this.validatorMethod(validator_1.default.isIdentityCard, locale);
    }
    isIMEI(options) {
        return this.validatorMethod(validator_1.default.isIMEI, options);
    }
    isIP(version = 4) {
        return this.validatorMethod(validator_1.default.isIP, version);
    }
    isIPRange(version = 4) {
        return this.validatorMethod(validator_1.default.isIPRange, version);
    }
    isISBN(options) {
        return this.validatorMethod(validator_1.default.isISBN, options);
    }
    isIn(values) {
        return this.validatorMethod(validator_1.default.isIn, values);
    }
    isISIN() {
        return this.validatorMethod(validator_1.default.isISIN);
    }
    isInt(options) {
        return this.validatorMethod(validator_1.default.isInt, options);
    }
    isISO4217() {
        return this.validatorMethod(validator_1.default.isISO4217);
    }
    isISO8601(options) {
        return this.validatorMethod(validator_1.default.isISO8601, options);
    }
    isISO31661Alpha2() {
        return this.validatorMethod(validator_1.default.isISO31661Alpha2);
    }
    isISO31661Alpha3() {
        return this.validatorMethod(validator_1.default.isISO31661Alpha3);
    }
    isISRC() {
        return this.validatorMethod(validator_1.default.isISRC);
    }
    isISSN(options) {
        return this.validatorMethod(validator_1.default.isISSN, options);
    }
    isJSON(options) {
        return this.validatorMethod(validator_1.default.isJSON, options);
    }
    isJWT() {
        return this.validatorMethod(validator_1.default.isJWT);
    }
    isLength(options) {
        return this.validatorMethod(validator_1.default.isLength, options);
    }
    isLatLong(options) {
        return this.validatorMethod(validator_1.default.isLatLong, options);
    }
    isLicensePlate(locale) {
        return this.validatorMethod(validator_1.default.isLicensePlate, locale);
    }
    isLocale() {
        return this.validatorMethod(validator_1.default.isLocale);
    }
    isLowercase() {
        return this.validatorMethod(validator_1.default.isLowercase);
    }
    isMACAddress(options) {
        return this.validatorMethod(validator_1.default.isMACAddress, options);
    }
    isMagnetURI() {
        return this.validatorMethod(validator_1.default.isMagnetURI);
    }
    isMD5() {
        return this.validatorMethod(validator_1.default.isMD5);
    }
    isMimeType() {
        return this.validatorMethod(validator_1.default.isMimeType);
    }
    isMobilePhone(locale, options) {
        return this.validatorMethod(validator_1.default.isMobilePhone, locale, options);
    }
    isMongoId() {
        return this.validatorMethod(validator_1.default.isMongoId);
    }
    isMultibyte() {
        return this.validatorMethod(validator_1.default.isMultibyte);
    }
    isNumeric(options) {
        return this.validatorMethod(validator_1.default.isNumeric, options);
    }
    isOctal() {
        return this.validatorMethod(validator_1.default.isOctal);
    }
    isPassportNumber(countryCode) {
        return this.validatorMethod(validator_1.default.isPassportNumber, countryCode);
    }
    isPhoneNumber() {
        return this.validatorMethod((str) => new RegExp(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/ig).test(str));
    }
    isPort() {
        return this.validatorMethod(validator_1.default.isPort);
    }
    isPostalCode(locale) {
        return this.validatorMethod(validator_1.default.isPostalCode, locale);
    }
    isRFC3339() {
        return this.validatorMethod(validator_1.default.isRFC3339);
    }
    isRgbColor(includePercentValues) {
        return this.validatorMethod(validator_1.default.isRgbColor, includePercentValues);
    }
    isSemVer() {
        return this.validatorMethod(validator_1.default.isSemVer);
    }
    isSlug() {
        return this.validatorMethod(validator_1.default.isSlug);
    }
    isStrongPassword(options) {
        return this.validatorMethod(validator_1.default.isStrongPassword, options);
    }
    isSurrogatePair() {
        return this.validatorMethod(validator_1.default.isSurrogatePair);
    }
    isTaxID(locale) {
        return this.validatorMethod(validator_1.default.isTaxID, locale);
    }
    isUppercase() {
        return this.validatorMethod(validator_1.default.isUppercase);
    }
    isURL(options) {
        return this.validatorMethod(validator_1.default.isURL, options);
    }
    isUUID(version) {
        return this.validatorMethod(validator_1.default.isUUID, version);
    }
    isVariableWidth() {
        return this.validatorMethod(validator_1.default.isVariableWidth);
    }
    isVAT(countryCode) {
        return this.validatorMethod(validator_1.default.isVAT, countryCode);
    }
    isWhitelisted(chars) {
        return this.validatorMethod(validator_1.default.isWhitelisted, chars);
    }
    matches(pattern, modifiers) {
        return this.validatorMethod(validator_1.default.matches, pattern, modifiers);
    }
    blacklist(chars) {
        return this.sanitizerMethod(validator_1.default.blacklist, chars);
    }
    capitalize(all = false) {
        return this.sanitizerMethod((str) => {
            if (!str || str.length <= 0)
                return str;
            return all ?
                str.toUpperCase()
                :
                    str.charAt(0).toUpperCase() + str.slice(1);
        });
    }
    escape() {
        return this.sanitizerMethod(validator_1.default.escape);
    }
    ltrim(chars) {
        return this.sanitizerMethod(validator_1.default.ltrim, chars);
    }
    normalizeEmail(options) {
        return this.sanitizerMethod(validator_1.default.normalizeEmail, options);
    }
    rtrim(chars) {
        return this.sanitizerMethod(validator_1.default.rtrim, chars);
    }
    stripLow(keep_new_lines) {
        return this.sanitizerMethod(validator_1.default.stripLow, keep_new_lines);
    }
    toBoolean(strict = true) {
        return this.sanitizerMethod(validator_1.default.toBoolean, strict);
    }
    toDate() {
        return this.sanitizerMethod(validator_1.default.toDate);
    }
    toFloat() {
        return this.sanitizerMethod(validator_1.default.toFloat);
    }
    toInt(radix) {
        return this.sanitizerMethod(validator_1.default.toInt, radix);
    }
    toJSON() {
        return this.sanitizerMethod((str) => {
            try {
                return JSON.parse(str);
            }
            catch (err) {
                return err.message;
            }
        });
    }
    toSqlDate(options = { day_start: false, day_end: false }) {
        return this.sanitizerMethod((str) => {
            let date;
            if (typeof str === 'string') {
                if (isNaN(Date.parse(str)))
                    return null;
                date = new Date(str);
            }
            else if (str.constructor.name === 'Date')
                date = str;
            else
                return null;
            if (options?.day_start) {
                date.setHours(0);
                date.setMinutes(0);
                date.setSeconds(0);
            }
            else if (options?.day_end) {
                date.setHours(23);
                date.setMinutes(59);
                date.setSeconds(59);
                date.setSeconds(59);
            }
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${date.toTimeString().slice(0, 9)}`;
        });
    }
    toString() {
        return this.sanitizerMethod(validator_1.default.toString);
    }
    trim(chars) {
        return this.sanitizerMethod(validator_1.default.trim, chars);
    }
    unescape() {
        return this.sanitizerMethod(validator_1.default.unescape);
    }
    whitelist(chars) {
        return this.sanitizerMethod(validator_1.default.whitelist, chars);
    }
}
exports.default = ValidatorJSChain;
