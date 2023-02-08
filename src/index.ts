import validator from 'validator';

import {
    AlphaLocale,
    ContainsOptions,
    HashAlgorithm,
    IdentityCardLocale,
    IsAlphanumericOptions,
    IsAlphaOptions,
    IsBase64Options,
    IsBooleanOptions,
    IsCreditCardOptions,
    IsCurrencyOptions,
    IsDateOptions,
    IsDecimalOptions,
    IsEmailOptions,
    IsEmptyOptions,
    IsFloatOptions,
    IsFQDNOptions,
    IsIMEIOptions,
    IsIntOptions,
    IsISO8601Options,
    IsISSNOptions,
    IsJSONOptions,
    IsLatLongOptions,
    IsLicensePlateLocale,
    IsMACAddressOptions,
    IsMobilePhoneOptions,
    IsNumericOptions,
    IsStrongPasswordOptions,
    IsURLOptions,
    MobilePhoneLocale,
    NormalizeEmailOptions,
    PassportCountryCode,
    PostalCodeLocale,
    TaxIDLocale,
    UUIDVersion,
    VATCountryCode,
    ValidatorJSChainStatus,
    ValidatorJSChainInput,
} from './types';

const defaultValidatorStatus: ValidatorJSChainStatus = {
    bailed: false,
    suspended: false,
    invertNext: false,
    lastValidator: undefined,
    results: {},
};

export default class ValidatorJSChain {
    constructor() {}

    //  Stores the currently validated value
    private input: ValidatorJSChainInput = {
        label: '',
        value: undefined,
    };

    //  Stores the current state of the validation chain
    private status: ValidatorJSChainStatus = defaultValidatorStatus;

    //  Utilities ---------------------------------------------

    public get errorCount(): number {
        let errors = 0;
        Object.keys(this.status.results).forEach(label => {
            Object.keys(this.status.results[label]).forEach(validator => {
                if (this.status.results[label][validator].error) errors++;
            });
        });
        return errors;
    }

    //  Returns the current results
    public get results() {
        return { ...this.status.results };
    }

    //  Returns the currently validated value
    public get value() {
        return this.input.value;
    }

    //  Returns the last validator called
    public get lastValidator() {
        return this.status.lastValidator;
    }

    //  Clears all errors, chainable
    public clearResults() {
        this.status = defaultValidatorStatus;
        return this;
    }

    //  Sets the currently validated value
    public setValue(label: string, value: any, unbail = false) {
        if (this.status.bailed || this.status.suspended) return this;

        if (!label || Object.keys(this.status.results).includes(label))
            throw `Invalid validation chain label: "${label}"`;

        if (value !== null && value !== undefined && value.constructor.name !== 'string') value = String(value);

        if (unbail) this.status.bailed = false;
        this.status.suspended = false;
        this.status.lastValidator = <string>(<unknown>null);
        this.status.invertNext = false;
        this.input = { label, value };
        return this;
    }

    //  Generic wrapper for all validators
    private validatorMethod(executor: (...passedArgs) => boolean, ...args) {
        //  prettier-ignore
        if (!this.status.results[this.input?.label])
            this.status.results[this.input?.label] = {};

        if (this.status.bailed || this.status.suspended) return this;

        //  If there is already a validator with the same name,
        //  then add a number suffix to this one
        let executorName = executor.name || 'custom';
        const results = this.status.results[this.input?.label];
        const regExp = new RegExp('^(' + executorName + ')(_d+)?', 'g');

        //  prettier-ignore
        const previousValidators = Object.keys(results)
            .filter(key => !!key.match(regExp));

        if (previousValidators.length) {
            //  Rename the very first validator result to *_0
            if (results[executorName]) {
                results[executorName + '_0'] = results[executorName];
                delete results[executorName];
            }
            executorName += '_' + previousValidators.length;
        }

        this.status.lastValidator = executorName;
        const validationResult = executor(String(this.input?.value), ...args);

        //  Save validator result into results
        results[executorName] = {
            error: this.status.invertNext ? validationResult : !validationResult,
        };

        this.status.invertNext = false;
        return this;
    }

    //  Generic wrapper for all sanitizers
    private sanitizerMethod(executor: (...passedArgs) => string, ...args) {
        if (this.status.bailed || this.status.suspended) return this;
        this.input.value = executor(String(this.input?.value), ...args);
        return this;
    }

    //  Skips further validation if the value is falsy
    public optional() {
        if (this.input?.value === undefined || this.input?.value === null || this.input?.value === '')
            this.status.bailed = true;
        return this;
    }

    //  Sets the invertNext flag, which indicates that the next validator should be negated
    //  The flag is reset after calling the validator, setting a new value or clearing the status
    public not() {
        this.status.invertNext = true;
        return this;
    }

    //  Breaks the validator chain if an error occured
    public bail() {
        if (this.errorCount > 0) {
            this.status.bailed = true;
            this.status.suspended = false;
        }
        return this;
    }

    //  Unbails the chain and continues
    public unbail() {
        this.status.bailed = false;
        return this;
    }

    //  Conditional validator wrapper
    //  If the condition evaluates to true, the next validators will not run until an endif() is found
    public if(condition: (value: any) => boolean) {
        if (this.status.bailed || this.status.suspended) return this;
        if (!condition(this.input?.value)) this.status.suspended = true;
        return this;
    }

    //  Ends a conditional validator
    public endif() {
        this.status.suspended = false;
        return this;
    }

    //  Replaces the last error message in the errors array with the output of a custom function
    public withMessage(generator: (value?: any) => string | object) {
        if (
            !!this.status?.lastValidator &&
            !this.status.bailed &&
            !this.status.suspended &&
            this.status.results[this.input?.label][this.status?.lastValidator].error
        )
            this.status.results[this.input?.label][this.status?.lastValidator].message = generator(this.input?.value);

        return this;
    }

    //  Allows the user to implement a custom validator
    public custom(validator: (value: any) => boolean, ...args) {
        return this.validatorMethod(validator, ...args);
    }

    //  Allows the user to implement a custom sanitizer
    public customSanitizer(sanitizer: (value: any) => any, ...args) {
        return this.sanitizerMethod(sanitizer, ...args);
    }

    //  Allows the extraction of the current value
    public peek(executor: (value: any) => any) {
        executor(this.input.value);
        return this;
    }

    //  ----- Validator methods -------------------------------------------------------------------------

    contains(seed: string, options?: ContainsOptions) {
        return this.validatorMethod(validator.contains, seed, options);
    }
    equals(comparison: string) {
        return this.validatorMethod(validator.equals, comparison);
    }
    ibanLocales() {
        return this.validatorMethod(validator.ibanLocales);
    }
    isAfter(options?: { comparisonDate: Date }) {
        return this.validatorMethod(validator.isAfter, options);
    }
    isAlpha(locale?: AlphaLocale, options?: IsAlphaOptions) {
        return this.validatorMethod(validator.isAlpha, locale, options);
    }
    isAlphanumeric(locale?: AlphaLocale, options?: IsAlphanumericOptions) {
        return this.validatorMethod(validator.isAlphanumeric, locale, options);
    }
    isAscii() {
        return this.validatorMethod(validator.isAscii);
    }
    isBase32(options?: { crockford: boolean }) {
        return this.validatorMethod(validator.isBase32, options);
    }
    isBase58() {
        return this.validatorMethod(validator.isBase58);
    }
    isBase64(options?: IsBase64Options) {
        return this.validatorMethod(validator.isBase64, options);
    }
    isBefore(date: Date) {
        return this.validatorMethod(validator.isBefore, date);
    }
    isBIC() {
        return this.validatorMethod(validator.isBIC);
    }
    isBoolean(options?: IsBooleanOptions) {
        return this.validatorMethod(validator.isBoolean, options);
    }
    isBtcAddress() {
        return this.validatorMethod(validator.isBtcAddress);
    }
    isByteLength(options?: IsIntOptions) {
        return this.validatorMethod(validator.isByteLength, options);
    }
    isCreditCard(options?: IsCreditCardOptions) {
        return this.validatorMethod(validator.isCreditCard, options);
    }
    isCurrency(options?: IsCurrencyOptions) {
        return this.validatorMethod(validator.isCurrency, options);
    }
    isDataURI() {
        return this.validatorMethod(validator.isDataURI);
    }
    isDate(options?: IsDateOptions) {
        return this.validatorMethod(validator.isDate, options);
    }
    isDecimal(options?: IsDecimalOptions) {
        return this.validatorMethod(validator.isDecimal, options);
    }
    isDivisibleBy(number: number) {
        return this.validatorMethod(validator.isDivisibleBy, number);
    }
    isEAN() {
        return this.validatorMethod(validator.isEAN);
    }
    isEmail(options?: IsEmailOptions) {
        return this.validatorMethod(validator.isEmail, options);
    }
    isEmpty(options?: IsEmptyOptions) {
        return this.validatorMethod(validator.isEmpty, options);
    }
    isEthereumAddress() {
        return this.validatorMethod(validator.isEthereumAddress);
    }
    isFloat(options?: IsFloatOptions) {
        return this.validatorMethod(validator.isFloat, options);
    }
    isFQDN(options?: IsFQDNOptions) {
        return this.validatorMethod(validator.isFQDN, options);
    }
    isFullWidth() {
        return this.validatorMethod(validator.isFullWidth);
    }
    isHalfWidth() {
        return this.validatorMethod(validator.isHalfWidth);
    }
    isHash(algorithm: HashAlgorithm) {
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
    isIdentityCard(locale?: IdentityCardLocale) {
        return this.validatorMethod(validator.isIdentityCard, locale);
    }
    isIMEI(options?: IsIMEIOptions) {
        return this.validatorMethod(validator.isIMEI, options);
    }
    isIP(version: 4 | 6 = 4) {
        return this.validatorMethod(validator.isIP, version);
    }
    isIPRange(version: 4 | 6 = 4) {
        return this.validatorMethod(validator.isIPRange, version);
    }
    isISBN(options?: 10 | 13) {
        return this.validatorMethod(validator.isISBN, options);
    }
    isIn(values: any[]) {
        return this.validatorMethod(validator.isIn, values);
    }
    isISIN() {
        return this.validatorMethod(validator.isISIN);
    }
    isInt(options?: IsIntOptions) {
        return this.validatorMethod(validator.isInt, options);
    }
    isISO4217() {
        return this.validatorMethod(validator.isISO4217);
    }
    isISO8601(options?: IsISO8601Options) {
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
    isISSN(options?: IsISSNOptions) {
        return this.validatorMethod(validator.isISSN, options);
    }
    isJSON(options?: IsJSONOptions) {
        return this.validatorMethod(validator.isJSON, options);
    }
    isJWT() {
        return this.validatorMethod(validator.isJWT);
    }
    isLength(options?: IsIntOptions) {
        return this.validatorMethod(validator.isLength, options);
    }
    isLatLong(options?: IsLatLongOptions) {
        return this.validatorMethod(validator.isLatLong, options);
    }
    isLicensePlate(locale?: IsLicensePlateLocale) {
        return this.validatorMethod(validator.isLicensePlate, locale);
    }
    isLocale() {
        return this.validatorMethod(validator.isLocale);
    }
    isLowercase() {
        return this.validatorMethod(validator.isLowercase);
    }
    isMACAddress(options?: IsMACAddressOptions) {
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
    isMobilePhone(locale?: MobilePhoneLocale | MobilePhoneLocale[], options?: IsMobilePhoneOptions) {
        return this.validatorMethod(validator.isMobilePhone, locale, options);
    }
    isMongoId() {
        return this.validatorMethod(validator.isMongoId);
    }
    isMultibyte() {
        return this.validatorMethod(validator.isMultibyte);
    }
    isNumeric(options?: IsNumericOptions) {
        return this.validatorMethod(validator.isNumeric, options);
    }
    isOctal() {
        return this.validatorMethod(validator.isOctal);
    }
    isPassportNumber(countryCode: PassportCountryCode) {
        return this.validatorMethod(validator.isPassportNumber, countryCode);
    }
    isPort() {
        return this.validatorMethod(validator.isPort);
    }
    isPostalCode(locale?: PostalCodeLocale) {
        return this.validatorMethod(validator.isPostalCode, locale);
    }
    isRFC3339() {
        return this.validatorMethod(validator.isRFC3339);
    }
    isRgbColor(includePercentValues?: boolean) {
        return this.validatorMethod(validator.isRgbColor, includePercentValues);
    }
    isSemVer() {
        return this.validatorMethod(validator.isSemVer);
    }
    isSlug() {
        return this.validatorMethod(validator.isSlug);
    }
    isStrongPassword(options?: IsStrongPasswordOptions) {
        return this.validatorMethod(validator.isStrongPassword, options);
    }
    isSurrogatePair() {
        return this.validatorMethod(validator.isSurrogatePair);
    }
    isTaxID(locale: TaxIDLocale) {
        return this.validatorMethod(validator.isTaxID, locale);
    }
    isUppercase() {
        return this.validatorMethod(validator.isUppercase);
    }
    isURL(options?: IsURLOptions) {
        return this.validatorMethod(validator.isURL, options);
    }
    isUUID(version?: UUIDVersion) {
        return this.validatorMethod(validator.isUUID, version);
    }
    isVariableWidth() {
        return this.validatorMethod(validator.isVariableWidth);
    }
    isVAT(countryCode: VATCountryCode) {
        return this.validatorMethod(validator.isVAT, countryCode);
    }
    isWhitelisted(chars: string) {
        return this.validatorMethod(validator.isWhitelisted, chars);
    }
    matches(pattern: string | RegExp, modifiers?: string) {
        return this.validatorMethod(validator.matches, pattern, modifiers);
    }

    //  ----- Sanitizer methods -------------------------------------------------------------------------

    blacklist(chars: string) {
        return this.validatorMethod(validator.blacklist, chars);
    }
    default() {
        return this.validatorMethod(validator.default);
    }
    escape() {
        return this.validatorMethod(validator.escape);
    }
    ltrim(chars?: string[]) {
        return this.validatorMethod(validator.ltrim, chars);
    }
    normalizeEmail(options?: NormalizeEmailOptions) {
        return this.validatorMethod(validator.normalizeEmail, options);
    }
    rtrim(chars?: string[]) {
        return this.validatorMethod(validator.rtrim, chars);
    }
    stripLow(keep_new_lines?: boolean) {
        return this.validatorMethod(validator.stripLow, keep_new_lines);
    }
    toBoolean(strict = true) {
        return this.validatorMethod(validator.toBoolean, strict);
    }
    toDate() {
        return this.validatorMethod(validator.toDate);
    }
    toFloat() {
        return this.validatorMethod(validator.toFloat);
    }
    toInt(radix?: number) {
        return this.validatorMethod(validator.toInt, radix);
    }
    toString() {
        return this.validatorMethod(validator.toString);
    }
    trim(chars?: string[]) {
        return this.validatorMethod(validator.trim, chars);
    }
    unescape() {
        return this.validatorMethod(validator.unescape);
    }
    whitelist(chars: string) {
        return this.validatorMethod(validator.whitelist, chars);
    }
}
