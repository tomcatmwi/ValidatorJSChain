import validator from 'validator';
const defaultValidatorStatus = {
    bailed: false,
    suspended: false,
    skipped: false,
    invertNext: false,
};
export default class ValidatorJSChain {
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
    setValue(label, value, unbail = false, convertToString = true) {
        if (unbail)
            this.status.bailed = false;
        if (this.status.bailed || this.status.suspended)
            return this;
        this.status.skipped = false;
        if (!label || (!!label && !!this.status.results && Object.keys(this.status.results).includes(label)))
            throw `Invalid validation chain label: "${String(label)}"`;
        if (convertToString) {
            if (!!value && typeof value === 'object')
                value = JSON.stringify(value);
            if (value !== null && value !== undefined && typeof value !== 'string')
                value = String(value);
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
        const sanitizedValue = executor(String(this.input?.value), ...args);
        this.input.value = sanitizedValue;
        if (!this.status.results)
            this.status.results = {};
        this.status.results[this.input.label] = {
            ...this.status.results[this.input.label],
            value: sanitizedValue,
        };
        return this;
    }
    default(value) {
        if (!this.input.value) {
            this.input.value = value === null ? null : String(value);
            this.status.results[this.input.label].value = value;
        }
        return this;
    }
    optional() {
        if (this.input?.value === undefined || this.input?.value === null || this.input?.value === '')
            this.status.skipped = true;
        return this;
    }
    not() {
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
        this.status.bailed = false;
        return this;
    }
    if(condition) {
        if (this.status.bailed || this.status.suspended)
            return this;
        if (!condition(this.input?.value))
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
                lastResult.message = message;
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
        executor(this.input.value);
        return this;
    }
    contains(seed, options) {
        return this.validatorMethod(validator.contains, seed, options);
    }
    equals(comparison) {
        return this.validatorMethod(validator.equals, comparison);
    }
    ibanLocales() {
        return this.validatorMethod(validator.ibanLocales);
    }
    isAfter(options) {
        return this.validatorMethod(validator.isAfter, options);
    }
    isAlpha(locale, options) {
        return this.validatorMethod(validator.isAlpha, locale, options);
    }
    isAlphanumeric(locale, options) {
        return this.validatorMethod(validator.isAlphanumeric, locale, options);
    }
    isAscii() {
        return this.validatorMethod(validator.isAscii);
    }
    isBase32(options) {
        return this.validatorMethod(validator.isBase32, options);
    }
    isBase58() {
        return this.validatorMethod(validator.isBase58);
    }
    isBase64(options) {
        return this.validatorMethod(validator.isBase64, options);
    }
    isBefore(date) {
        return this.validatorMethod(validator.isBefore, date);
    }
    isBIC() {
        return this.validatorMethod(validator.isBIC);
    }
    isBoolean(options) {
        return this.validatorMethod(validator.isBoolean, options);
    }
    isBtcAddress() {
        return this.validatorMethod(validator.isBtcAddress);
    }
    isByteLength(options) {
        return this.validatorMethod(validator.isByteLength, options);
    }
    isCreditCard(options) {
        return this.validatorMethod(validator.isCreditCard, options);
    }
    isCurrency(options) {
        return this.validatorMethod(validator.isCurrency, options);
    }
    isDataURI() {
        return this.validatorMethod(validator.isDataURI);
    }
    isDate(options) {
        return this.validatorMethod(validator.isDate, options);
    }
    isDecimal(options) {
        return this.validatorMethod(validator.isDecimal, options);
    }
    isDivisibleBy(number) {
        return this.validatorMethod(validator.isDivisibleBy, number);
    }
    isEAN() {
        return this.validatorMethod(validator.isEAN);
    }
    isEmail(options) {
        return this.validatorMethod(validator.isEmail, options);
    }
    isEmpty(options) {
        return this.validatorMethod(validator.isEmpty, options);
    }
    isEthereumAddress() {
        return this.validatorMethod(validator.isEthereumAddress);
    }
    isFloat(options) {
        return this.validatorMethod(validator.isFloat, options);
    }
    isFQDN(options) {
        return this.validatorMethod(validator.isFQDN, options);
    }
    isFullWidth() {
        return this.validatorMethod(validator.isFullWidth);
    }
    isHalfWidth() {
        return this.validatorMethod(validator.isHalfWidth);
    }
    isHash(algorithm) {
        return this.validatorMethod(validator.isHash, algorithm);
    }
    isHexadecimal() {
        return this.validatorMethod(validator.isHexadecimal);
    }
    isHexColor() {
        return this.validatorMethod(validator.isHexColor);
    }
    isHSL() {
        return this.validatorMethod(validator.isHSL);
    }
    isIBAN() {
        return this.validatorMethod(validator.isIBAN);
    }
    isIdentityCard(locale) {
        return this.validatorMethod(validator.isIdentityCard, locale);
    }
    isIMEI(options) {
        return this.validatorMethod(validator.isIMEI, options);
    }
    isIP(version = 4) {
        return this.validatorMethod(validator.isIP, version);
    }
    isIPRange(version = 4) {
        return this.validatorMethod(validator.isIPRange, version);
    }
    isISBN(options) {
        return this.validatorMethod(validator.isISBN, options);
    }
    isIn(values) {
        return this.validatorMethod(validator.isIn, values);
    }
    isISIN() {
        return this.validatorMethod(validator.isISIN);
    }
    isInt(options) {
        return this.validatorMethod(validator.isInt, options);
    }
    isISO4217() {
        return this.validatorMethod(validator.isISO4217);
    }
    isISO8601(options) {
        return this.validatorMethod(validator.isISO8601, options);
    }
    isISO31661Alpha2() {
        return this.validatorMethod(validator.isISO31661Alpha2);
    }
    isISO31661Alpha3() {
        return this.validatorMethod(validator.isISO31661Alpha3);
    }
    isISRC() {
        return this.validatorMethod(validator.isISRC);
    }
    isISSN(options) {
        return this.validatorMethod(validator.isISSN, options);
    }
    isJSON(options) {
        return this.validatorMethod(validator.isJSON, options);
    }
    isJWT() {
        return this.validatorMethod(validator.isJWT);
    }
    isLength(options) {
        return this.validatorMethod(validator.isLength, options);
    }
    isLatLong(options) {
        return this.validatorMethod(validator.isLatLong, options);
    }
    isLicensePlate(locale) {
        return this.validatorMethod(validator.isLicensePlate, locale);
    }
    isLocale() {
        return this.validatorMethod(validator.isLocale);
    }
    isLowercase() {
        return this.validatorMethod(validator.isLowercase);
    }
    isMACAddress(options) {
        return this.validatorMethod(validator.isMACAddress, options);
    }
    isMagnetURI() {
        return this.validatorMethod(validator.isMagnetURI);
    }
    isMD5() {
        return this.validatorMethod(validator.isMD5);
    }
    isMimeType() {
        return this.validatorMethod(validator.isMimeType);
    }
    isMobilePhone(locale, options) {
        return this.validatorMethod(validator.isMobilePhone, locale, options);
    }
    isMongoId() {
        return this.validatorMethod(validator.isMongoId);
    }
    isMultibyte() {
        return this.validatorMethod(validator.isMultibyte);
    }
    isNumeric(options) {
        return this.validatorMethod(validator.isNumeric, options);
    }
    isOctal() {
        return this.validatorMethod(validator.isOctal);
    }
    isPassportNumber(countryCode) {
        return this.validatorMethod(validator.isPassportNumber, countryCode);
    }
    isPort() {
        return this.validatorMethod(validator.isPort);
    }
    isPostalCode(locale) {
        return this.validatorMethod(validator.isPostalCode, locale);
    }
    isRFC3339() {
        return this.validatorMethod(validator.isRFC3339);
    }
    isRgbColor(includePercentValues) {
        return this.validatorMethod(validator.isRgbColor, includePercentValues);
    }
    isSemVer() {
        return this.validatorMethod(validator.isSemVer);
    }
    isSlug() {
        return this.validatorMethod(validator.isSlug);
    }
    isStrongPassword(options) {
        return this.validatorMethod(validator.isStrongPassword, options);
    }
    isSurrogatePair() {
        return this.validatorMethod(validator.isSurrogatePair);
    }
    isTaxID(locale) {
        return this.validatorMethod(validator.isTaxID, locale);
    }
    isUppercase() {
        return this.validatorMethod(validator.isUppercase);
    }
    isURL(options) {
        return this.validatorMethod(validator.isURL, options);
    }
    isUUID(version) {
        return this.validatorMethod(validator.isUUID, version);
    }
    isVariableWidth() {
        return this.validatorMethod(validator.isVariableWidth);
    }
    isVAT(countryCode) {
        return this.validatorMethod(validator.isVAT, countryCode);
    }
    isWhitelisted(chars) {
        return this.validatorMethod(validator.isWhitelisted, chars);
    }
    matches(pattern, modifiers) {
        return this.validatorMethod(validator.matches, pattern, modifiers);
    }
    blacklist(chars) {
        return this.sanitizerMethod(validator.blacklist, chars);
    }
    escape() {
        return this.sanitizerMethod(validator.escape);
    }
    ltrim(chars) {
        return this.sanitizerMethod(validator.ltrim, chars);
    }
    normalizeEmail(options) {
        return this.sanitizerMethod(validator.normalizeEmail, options);
    }
    rtrim(chars) {
        return this.sanitizerMethod(validator.rtrim, chars);
    }
    stripLow(keep_new_lines) {
        return this.sanitizerMethod(validator.stripLow, keep_new_lines);
    }
    toBoolean(strict = true) {
        return this.sanitizerMethod(validator.toBoolean, strict);
    }
    toDate() {
        return this.sanitizerMethod(validator.toDate);
    }
    toFloat() {
        return this.sanitizerMethod(validator.toFloat);
    }
    toInt(radix) {
        return this.sanitizerMethod(validator.toInt, radix);
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
    toString() {
        return this.sanitizerMethod(validator.toString);
    }
    trim(chars) {
        return this.sanitizerMethod(validator.trim, chars);
    }
    unescape() {
        return this.sanitizerMethod(validator.unescape);
    }
    whitelist(chars) {
        return this.sanitizerMethod(validator.whitelist, chars);
    }
}
