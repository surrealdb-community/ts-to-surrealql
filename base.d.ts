declare type STRING = string
declare type INT = number
declare type BOOL = boolean
declare type DECIMAL = number
declare type RECORD<T> = T
// declare type 
declare type RELATION<I,O> = {
  in: I,
  out: O
}

declare type WITH_DEFAULT<T, S> = T
declare type WITH_VALUE<T, S> = T
declare type FUTURE<T, S> = T
declare type ASSERT<T, S extends string> = T
declare type SQL_EXPR<S extends string> = string