// deno-lint-ignore-file no-empty-interface
/// <reference types="./base.d.ts" />

export interface Person {
  firstname: STRING
  lastname?: STRING
  adress: {
    street: STRING,
    plz: STRING,
    ort: STRING
  } | null
  prev_adress: {
    street: STRING,
    plz: STRING,
    ort: STRING
  }[]
  email: STRING;
  is_member: WITH_DEFAULT<BOOL, true>
  test_num2: WITH_DEFAULT<INT, 42>
  newFileld2: STRING
  test_big: WITH_DEFAULT<INT, 42n>
  test_string: WITH_DEFAULT<STRING, 'abbb'>
  test_string2: WITH_DEFAULT<STRING, SQL_EXPR<'"abbb"'>>
  newField: INT
  age2: FUTURE<INT, SQL_EXPR<'time::now() - birthdate'>>
  age: WITH_VALUE<INT, FUTURE<INT, SQL_EXPR<'time::now() - birthdate'>>>
  ustruct3: unknown
  email2: ASSERT<STRING, SQL_EXPR<'$value != NONE AND is::email($value)'>>
  unstructered: WITH_DEFAULT<any, {}>
  ustruct2: any
  
  bff: RECORD<Person>
  array: STRING[],
  array2: Array<STRING>,
  tuple: [STRING, STRING]
}

export interface Friends extends RELATION<Person, Person> {
  
}

export type Couple = RELATION<Person, Person>