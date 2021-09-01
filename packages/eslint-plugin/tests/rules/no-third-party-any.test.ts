import rule from '../../src/rules/no-third-party-any';
import { RuleTester, getFixturesRootDir } from '../RuleTester';

const ruleTester = new RuleTester({
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.noImplicitThis.json',
    tsconfigRootDir: getFixturesRootDir(),
  },
});

ruleTester.run('no-third-party-any', rule, {
  valid: [
    `''.replace(/blah (\d+)/, (argMatch, argGroup1: any) => argGroup1);`,
    `
declare function f(s: string, fn: (a: string, b: number) => void): string;
declare function f(n: number, fn: (a: Date, b: Date) => void): Date;

const d1 = f('s', (aS, bN) => {});
const d2 = f(1, (aD, bD) => {});
    `,
    `
declare function f(s: string, fn: (a: string, b: number) => void): string;
declare function f(n: number, fn: (a: Date, b: any) => void): Date;

const d1 = f('s', (aS, bN) => {});  // this one is OK
const d2 = f(1, (aD, bD) => {});  // this one is only OK because it's first-party
    `,
  ],
  invalid: [
    {
      code: `''.replace(/blah (\d+)/, (argMatch, argGroup1) => argGroup1);`,
      errors: [
        {
          messageId: 'contextualAny',
          line: 1,
          column: 36,
          endColumn: 45,
        },
      ],
    },
    //     {
    //       code: `
    // declare function f(s: string, fn: (a: string, b: number) => void): string;
    // declare function f(n: number, fn: (a: Date, b: any) => void): Date;
    //
    // const d1 = f('s', (aS, bN) => {});  // this one is OK
    // const d2 = f(1, (aD, bD) => {});  // this one is not
    //       `,
    //       errors: [
    //         {
    //           messageId: 'contextualAny',
    //           line: 5,
    //           column: 22,
    //           endColumn: 23,
    //         }
    //       ]
    //     }
  ],
});
