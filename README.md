# ValidatorJSChain

### Version 1.9.1

A framework-agnostic validator and sanitizer chain inspired by `express-validator`. Very useful for GraphQL resolvers!

Not experimental any more! Serving faithfully in many of our projects, both frontend and backend.

Please still report bugs so I can ignore them. (Never got a single report.)

## How to install

```
npm i validatorjs-chain
```

## Basic usage

First, import the `ValidatorJSChain` object, and create an instance:

```
import ValidatorJSChain from `validatorjs-chain`;

const validatorJSChain = new ValidatorJSChain();
```

Now you can verify any variable using one or multiple validators.

All validators and sanitizers of `validator.js` can be used the same way as in `express-validator`. For more information, please refer to [the documentation of validator.js.](https://github.com/validatorjs/validator.js)

In the following example we verify the value `myEmailAddress` if it's a correctly formed email, and then whether it's one of the authorized addresses:

```
const myEmailAddress = 'somedude@company.com';

const authorizedEmails = [
    'boss@company.com',
    'secretary@company.com',
    'somedude@company.com',
    'someotherdude@company.com'
]

validatorJSChain
  .setValue('myEmailAddress', myEmailAddress)
  .isEmail()
  .isIn(authorizedEmails);

console.log(validatorJSChain.errorCount);
console.log(validatorJSChain.results);
```

The output will be:

```
{
  "myEmailAddress": {
    "value": "somedude@company.com",
    "isEmail": {
      "error": false
    },
    "isIn": {
      "error": false
    }
  }
}
```

If you use the same validator multiple times, the results will be numbered with a postfix:

```
validatorJSChain
  .setValue('myEmailAddress', myEmailAddress)
  .isEmail()
  .isEmail()
  .isEmail()
```

Result:

```
{
  "email": {
    "value": "somedude@company.com",
    "isEmail_0": {
      "error": false
    },
    "isEmail_1": {
      "error": false
    },
    "isEmail_2": {
      "error": false
    },
  }
}

```

## Sanitizers

As you can see in the previous example, the result returned by the `.results` getter contains a `value` field. This is holding the value passed to the chain, and every sanitizer will change it. Extract this value to update your original variables. For example:

```
const validatorChain = new ValidatorChain();
let myValue = '  This string is going to be trimmed  ';

validatorChain()
  .setValue('myValue', myValue)
  .trim()

myValue = validatorChain.results.myValue.value;
console.log('"' + myValue + '"');
```

This should output:

```
"This string is going to be trimmed"
```

Alternatively you can use the `values` property to get a key-value list of all values passed to the validator chain:

```
console.log(validatorChain.values);
```

Result:

```
{ myValue: 'This string is going to be trimmed' }
```

Note that `validate.js` validators only accept string values, and they will emit strings as well. `ValidatorJSChain` will convert any value passed to the chain to a string, and as a consequence, the corresponding `value` will be a string too. To change this, use type conversion sanitizers, like `toInt()`:

```
validatorChain()
  setValue('myNumber', 1541)
  .isInt({ min: 1000, max: 2000 })
  .toInt()
```

## Validating data structures

If you have to validate a JSON data structure, use the `.setValue()` method to go through each field.

```
const employee = {
    name: 'John Doe',
    office: 1541,
    email: "somedude@company.com"
}

validatorJSChain
    .clearResults()
    .setValue('name', employee.name)
    .isLength({ min: 6, max: 128 })
    .matches(/^[A-Z]{1}[a-z]{2,32}\s([A-Z]{1}[a-z]{0,32}(\.?)\s)?[A-Z]{1}[a-z]{2,32}$/g)

    .setValue('office', employee.office)
    .isInt({ min: 1, max: 2000 })

    .setValue('email', employee.email)
    .isEmail()
    .isIn(authorizedEmails);

    console.log(validatorJSChain.results);
```

Notice that we called `clearResults()` at the beginning of the chain. In case you're reusing the same `ValidatorJSChain` instance, this method must be called or the instance may retain previous results. See more about `clearResults()` in the method reference.

The above example will produce the following console output:

```
{
  "name": {
    "value": "John Doe",
    "isLength": {
      "error": false
    },
    "matches": {
      "error": false
    }
  },
  "office": {
    "vale": "1541",
    "isInt": {
      "error": false
    }
  },
  "email": {
    "value": "somedude@company.com",
    "isEmail": {
      "error": false
    },
    "isIn": {
      "error": false
    }
  }
}
```

As there were no validation errors, all `error` flags are `false`.

## Inverting a validator

You can turn around a validator with the `.not()` method. The result of the next validator will be negated, meaning the `error` value will be `false` if the validator did _not_ pass, and `true` if it _did_ pass.

Example:

```
validatorJSChain
    .setValue('name', employee.name)
    .not()
    .equals('John Doe')
```

Output:

```
{
  "name": {
    "value": "John Doe",
    "equals": {
      "error": true
    }
  }
}
```

## Error handling

If a validation error occurs, the chain will not stop executing. If you wish to stop it on errors, use the `bail()` method:

```
validatorJSChain
    .setValue('email', employee.email)
    .isLength({ min: 100, max: 128 })
    .bail()
    .isEmail()
```

In this case if `isLength()` finds an error, `.isEmail()` will not be executed, and it's not going to appear in the results.

Attention: `.bail()` shuts down the _entire_ validation chain. Everything after `.bail()` will be ignored. There are two ways to change this.

**Method 1:** setting a new value with the optional `unbail` argument. For example:

```
validatorJSChain
    .setValue('email', employee.email)
    .isLength({ min: 100, max: 128 })
    .bail()
    .isEmail()
    .setValue('name', 'employee.email', true)
    .isLength({ min: 6, max: 128 })
    .matches(/^[A-Z]{1}[a-z]{2,32}\s([A-Z]{1}[a-z]{0,32}(\.?)\s)?[A-Z]{1}[a-z]{2,32}$/g)
```

Although `.bail()` will stop the execution of the chain, and `.isEmail()` will be ignored, `.setValue()` will "unbail" the chain, and execution continues normally.

**Method 2:** using the `unbail()` method:

```
validatorJSChain
    .setValue('email', employee.email)
    .isLength({ min: 100, max: 128 })
    .bail()
    .isEmail()
    .isIn(authorizedEmails)
    .unbail()
    .isLength({ min: 6, max: 128 })
```

If the first `.isLength()` validator fails, the following `.isEmail()` and `.isIn()` will not execute, but `.unbail()` restores the chain, and the second `.isLength()` will trigger again.

## Custom error messages

If the simple `error` flag won't do, you can define custom error messages with the `.withMessage()` method. The parameter can also be a `Record<string, any>` or a function as `(value: any) => (string | Record<string, any>)`

```
validatorJSChain
    .setValue('email', 'totally not an email')
    .isEmail()
    .withMessage(value => {
        return `Invalid email address: "${value}"`;
    });

console.log(validatorJSChain.results)
```

Output:

```
{
  email: {
    value: "totally not an email",
    isEmail: {
      error: true,
      message: 'Invalid email address: "totally not an email"'
    }
  }
}
```

The function passed to `withMessage()` may return any data type, including objects or arrays.

## Conditionals

Elements of the validator chain may be made conditional with the `.if()` method. The block ends with the `.endif()` method. In this example, the validators and sanitizers between these two will only run if the email address contains the substring `'company.com'`:

```
validatorJSChain
  .setValue('email', 'johndoe@company.com')
  .if(value => value.includes('company.com'))
  .toLowercase()
  .isEmail()
  .isIn(authorizedEmails)
  .endif()
```

It is also possible to compare the current value to other values in the validation chain. For example, you may want to validate an address. A US address requires a state to be specified, but a European address doesn't. Therefore a European address must have a `null` value for `state`, while an US address should have a string. Here is how to do it:

```
validatorJSChain
  .clearResults()
  
  //  Validate country - it should be a 2 character code
  .setValue('country', selectedCountry)
  .isIn(['us', 'fr', 'gr', 'hu', 'cz', 'ru', 'it', 'es', 'uk'])
  .withMessage('This is not a country we know')
  .bail()

  //  Validate state
  .setValue('state', selectedState)
  
  // Country is US
  .if((value, sanitized) => sanitized.country === 'us')
    .isIn['AL', 'AK', 'AZ', 'AR' ... ]
    .withMessage('Invalid state!')
    .bail()
  .endif()

  //  Country is not US
  .if((value, sanitized) => sanitized.country !== 'us')
    .isEmpty()
    .withMessage('This country has no states!')
    .bail()
  .endif()
```

Note that `sanitized` will only contain values that have been validated before. If you moved the state validator section before the country validators, `sanitized` would not have a `.country` node. If you want to validate your value against the user's raw input, you don't need `sanitized`.

Conditionals cannot be nested. An `.endif()` clears all conditions set previously.

## Custom validators and sanitizers

User-defined validators and sanitizers can be created using the `.custom()` and `.customSanitizer()` methods.

A custom validator is a function that takes `value` as a parameter, representing the currently validated value, and returns a `boolean` value.

A custom sanitizer also takes `value` as parameter, and returns a string value.

```
validatorJSChain()
  .setValue('test', 'hahaha')
  .customSanitizer(value => value.replace(/ha/igm, 'he'))
  .custom(value => value.includes('he'))
```

*Important:* Built-in sanitizers always stringify your value. Custom sanitizers never do. The function you pass as a custom sanitizer always receives the value as it is when it gets there in the validation chain.

*Also important:* If you're working with non-primitive values, such as arrays or records, it's recommended to only use custom validators and sanitizers on them. Built-in validators and sanitizers always stringify their output.

# Object reference

## Properties

| Property                       | Explanation                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| `errorCount: number`           | The number of errors found during the entire validation chain. |
| `errors: Record<string, any>`  | Same as `results` but contains only errors                     |
| `lastValidator: string`        | Name of the last validator executed                            |
| `results: Record<string, any>` | List of results                                                |
| `value: string`                | The currently verified value (without label)                   |
| `values: Record<string, any>`  | All values passed to the chain, sanitized                      |

## Methods

| Method                                                                   | Explanation                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addResultValues(values: Record<string, any>, overwrite = false)`        | Adds unsanitized values to the chain result. The `overwrite` flag determines if already existing results should be overwritten if the same key exists in the object passed in `values`. This method is useful when you don't want to validate an entire object, but you need all values to be present in the validation result. It is recommended to only use this method at the very end of the chain. |
| `bail()`                                                                 | If the previous validator did not pass, no more validators or sanitizers will be executed until `unbail()` or `clearResults()` are called, or `setValue()` with `unbail = true`. **Attention:** The bail flag is persistent. If you reuse the same `ValidatorJSChain` instance for another validation, use the first `setValue()` call with the `unbail` argument to clear it.                          |
| `clearResults()`                                                         | Clears all previous validation results                                                                                                                                                                                                                                                                                                                                                                  |
| `custom(validator: (value: any) => boolean, ...args)`                    | Executes a custom validator. The passed function will receive the currently validated value as `value`, along with any arguments specified after.                                                                                                                                                                                                                                                       |
| `customSanitizer(sanitizer: (value: any) => any, ...args)`               | Executes a custom sanitizer. Works the same way as `custom()`. The output of `sanitizer` will replace the currently validated value.                                                                                                                                                                                                                                                                    |
| `default(value)`                                                         | If the value currently in the pipeline is falsy, this method changes it to the specified value.                                                                                                                                                                                                                                                                                                         |
| `if(condition: (value: any, sanitized: Record<string, any>) => boolean)`                                 | Validators and sanitizers after this method call will be skipped if the passed function returns `false`, until the next `endIf()` or `setValue()` call. The `value` argument contains the currently validated value (as set by the last `setValue()` call), and `sanitized` contains all values already sanitized so far.                                                                                                                                                                               |
| `optional()`                                                             | If the validated value is falsy, no more validators will be executed until the next `setValue()` call.                                                                                                                                                                                                                                                                                                  |
| `not()`                                                                  | Inverts the next validator. An error will be detected if the value passes.                                                                                                                                                                                                                                                                                                                              |
| `peek(executor: (value: any) => any)`                                    | Passes the currently validated value to `executor()` and runs it. The validation chain will not be affected. This method allows you to tap into the validation chain and extract the current value.                                                                                                                                                                                                     |
| `setValue(label: string, value: any, unbail = false, convertToString = true)`        | Sets a new value to be validated.<br />`label` Label of the validator for the results list<br />`value` The value to be validated or sanitized<br />`unbail` If earlier you called `.bail()`, and this argument is `false`, `bail()` will remain in effect. All validators and sanitizers will still be skipped.<br />`convertToString` Converts the validated value to a string. This is important because `validate.js` can only handle strings. However, if it's important to preserve the original type, turn this flag to `false`. In this case, you can only use custom validators and sanitizers (`custom` and `customSanitizer`) or your code will throw an exception!                                                                                        |
| `unbail()`                                                               | If `bail()` was called earlier, the execution of the chain resumes after calling this method.                                                                                                                                                                                                                                                                                                           |
| `withMessage(message: string | Record<string, any> | ((value: any) => (string | Record<string, any>)))` | Adds a custom error message. If the previous validator did not pass, the output will be added to the collection of error messages.                                                                                                                                                                                                                                                      |

## Custom sanitizers

These are unique to `ValidatorJSChain` and not part of the original `validator.js` package.

| Sanitizer | Explanation                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capitalize(value: string)`        | Capitalizes a string (so you won't need to write a custom sanitizer for a simple `.toUpperCase()`) |
| `toJSON(value: string)`        | Converts a string to a JSON object. Returns the error message on failure. |
| `toSqlDate(value: string \| Date, options: { day_start: boolean, day_end: boolean })`        | Converts a string to a Javascript `Date` object, then to a SQL-compatible `'YYYY-mm-dd HH:ii:ss'` date string. Returns `null` if the string cannot be parsed to a `Date`. Optionally accepts a `Date` too.<br />`day_start` sets the time to `00:00:00`<br />`day_end` sets the time to `23:59:59` if `day_start` isn't `true` |
| `trim(value: string)`        | Trims a string value |
