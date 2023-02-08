# ValidationChain

### Version 1.00

A framework-agnostic validator and sanitizer chain inspired by `express-validator`. Very useful for GraphQL resolvers!
Experimental, still under development. Please report bugs, I like to ignore them.

## How to install

```
npm i validator-chain
```

## Basic usage

First, import the `ValidationChain` object, and create an instance:

```
import ValidatorChain from `validator-chain`;

const validatorChain = new ValidatorChain();
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

validatorChain
  .setValue('myEmailAddress', myEmailAddress)
  .isEmail()
  .isIn(authorizedEmails);

console.log(validatorChain.errorCount);
console.log(validatorChain.results);
```

The output will be:

```
0
{
  "myEmailAddress": {
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
validatorChain
  .setValue('myEmailAddress', myEmailAddress)
  .isEmail()
  .isEmail()
  .isEmail()
```

Result:

```
{
  "email": {
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

## Validating data structures

If you have to validate a JSON data structure, use the `.setValue()` method to go through each field.

```
const employee = {
    name: 'John Doe',
    office: 1541,
    email: "somedude@company.com"
}

validatorChain
    .clearResults()
    .setValue('name', employee.name)
    .isLength({ min: 6, max: 128 })
    .matches(/^[A-Z]{1}[a-z]{2,32}\s([A-Z]{1}[a-z]{0,32}(\.?)\s)?[A-Z]{1}[a-z]{2,32}$/g)

    .setValue('office', employee.office)
    .isInt({ min: 1, max: 2000 })

    .setValue('email', employee.email)
    .isEmail()
    .isIn(authorizedEmails);

    console.log(validatorChain.results);
```

Notice that we called `clearResults()` at the beginning of the chain. In case you're reusing the same `ValidationChain` instance, this method must be called or the instance may retain previous results. See more about `clearResults()` in the method reference.

The above example will produce the following console output:

```
{
  "name": {
    "isLength": {
      "error": false
    },
    "matches": {
      "error": false
    }
  },
  "office": {
    "isInt": {
      "error": false
    }
  },
  "email": {
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
validatorChain
    .setValue('name', employee.name)
    .not()
    .equals('John Doe')
```

Output:

```
{
  "name": {
    "equals": {
      "error": true
    }
  }
}
```

## Error handling

If a validation error occurs, the chain will not stop executing. If you wish to stop it on errors, use the `bail()` method:

```
validatorChain
    .setValue('email', employee.email)
    .isLength({ min: 100, max: 128 })
    .bail()
    .isEmail()
```

In this case if `isLength()` finds an error, `.isEmail()` will not be executed, and it's not going to appear in the results.

Attention: `.bail()` shuts down the _entire_ validation chain. Everything after `.bail()` will be ignored. There are two ways to change this.

**Method 1:** setting a new value with the optional `unbail` argument. For example:

```
validatorChain
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
validatorChain
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

If the simple `error` flag won't do, you can define custom error messages with the `.withMessage()` method.

```
validatorChain
    .setValue('email', 'totally not an email')
    .isEmail()
    .withMessage(value => {
        return `Invalid email address: "${value}"`;
    });

console.log(validatorChain.results)
```

Output:

```
{
  email: {
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
validatorChain
  .setValue('email', 'johndoe@company.com')
  .if(value => value.includes('company.com'))
  .toLowercase()
  .isEmail()
  .isIn(authorizedEmails)
  .endif()
```

## Custom validators and sanitizers

User-defined validators and sanitizers can be created using the `.custom()` and `.customSanitizer()` methods.

A custom validator is a function that takes `value` as a parameter, representing the currently validated value, and returns a `boolean` value.

A custom sanitizer also takes `value` as parameter, and returns a string value.

```
validatorChain()
  .setValue('test', 'hahaha')
  .customSanitizer(value => value.replace(/ha/igm, 'he'))
  .custom(value => value.includes('he'))
```

# Object reference

## Properties

| Property                | Explanation                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `errorCount: number`    | The number of errors found during the entire validation chain. |
| `lastValidator: string` | Name of the last validator executed                            |
| `results: object`       | List of results                                                |
| `value: any`            | The currently verified value (without label)                   |

## Methods

| Method                                                      | Explanation                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bail()`                                                    | If the previous validator did not pass, no more validators or sanitizers will be executed until `unbail()` or `clearResults()` are called, or `setValue()` with `unbail = true`.<br />**WARNING:** The bail flag is persistent. If you reuse the same `ValidatorChain` instance for another validation, use the first `setValue()` call with the `unbail` argument to clear it. |
| `clearResults()`                                            | Clears all previous validation results                                                                                                                                                                                                                                                                                                                                          |
| `custom(validator: (value: any) => boolean, ...args)`       | Executes a custom validator. The passed function will receive the currently validated value as `value`, along with any arguments specified after.                                                                                                                                                                                                                               |
| `customSanitizer(sanitizer: (value: any) => any, ...args)`  | Executes a custom sanitizer. Works the same way as `custom()`. The output of `sanitizer` will replace the currently validated value.                                                                                                                                                                                                                                            |
| `if(condition: (value: any) => boolean)`                    | Validators and sanitizers after this method call will be skipped if the passed function returns `false`, until the next `endIf()` or `setValue()` call.                                                                                                                                                                                                                         |
| `optional()`                                                | If the validated value is falsy, no more validators will be executed until the next `setValue()` call.                                                                                                                                                                                                                                                                          |
| `not()`                                                     | Inverts the next validator. An error will be detected if the value passes.                                                                                                                                                                                                                                                                                                      |
| `peek(executor: (value: any) => any)`                       | Passes the currently validated value to `executor()` and runs it. The validation chain will not be affected. This method allows you to tap into the validation chain and extract the current value.                                                                                                                                                                             |
| `setValue(label: string, value: any, unbail = false)`       | Sets a new value to be validated.<br />`label` Label of the validator for the results list<br />`value` The value to be validated or sanitized<br />`unbail` If earlier you called `.bail()`, and this argument is `false`, `bail()` will remain in effect. All validators and sanitizers will still be skipped.                                                                |
| `unbail()`                                                  | If `bail()` was called earlier, the execution of the chain resumes after calling this method.                                                                                                                                                                                                                                                                                   |
| `withMessage(generator: (value?: any) => string \| object)` | Adds a custom error message. If the previous validator did not pass, the output of `generator()` will be added to the error message as `message`.                                                                                                                                                                                                                               |
