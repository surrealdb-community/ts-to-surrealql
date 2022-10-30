
  [
  [
    {
      "name": "Person",
      "members": {
        "firstname": {
          "name": "firstname",
          "question": false,
          "type": {
            "type": "STRING",
            "typeArgs": []
          }
        },
        "lastname": {
          "name": "lastname",
          "question": true,
          "type": {
            "type": "STRING",
            "typeArgs": []
          }
        },
        "adress": {
          "name": "adress",
          "question": false,
          "type": {
            "type": "union",
            "typeArgs": [
              {
                "type": "typeLiteral",
                "members": {
                  "street": {
                    "name": "street",
                    "question": false,
                    "type": {
                      "type": "STRING",
                      "typeArgs": []
                    }
                  },
                  "plz": {
                    "name": "plz",
                    "question": false,
                    "type": {
                      "type": "STRING",
                      "typeArgs": []
                    }
                  },
                  "ort": {
                    "name": "ort",
                    "question": false,
                    "type": {
                      "type": "STRING",
                      "typeArgs": []
                    }
                  }
                }
              },
              null
            ]
          }
        },
        "prev_adress": {
          "name": "prev_adress",
          "question": false,
          "type": {
            "type": "array",
            "typeArgs": [
              {
                "type": "typeLiteral",
                "members": {
                  "street": {
                    "name": "street",
                    "question": false,
                    "type": {
                      "type": "STRING",
                      "typeArgs": []
                    }
                  },
                  "plz": {
                    "name": "plz",
                    "question": false,
                    "type": {
                      "type": "STRING",
                      "typeArgs": []
                    }
                  },
                  "ort": {
                    "name": "ort",
                    "question": false,
                    "type": {
                      "type": "STRING",
                      "typeArgs": []
                    }
                  }
                }
              }
            ]
          }
        },
        "email": {
          "name": "email",
          "question": false,
          "type": {
            "type": "STRING",
            "typeArgs": []
          }
        },
        "is_member": {
          "name": "is_member",
          "question": false,
          "type": {
            "type": "WITH_DEFAULT",
            "typeArgs": [
              {
                "type": "BOOL",
                "typeArgs": []
              },
              true
            ]
          }
        },
        "test_num2": {
          "name": "test_num2",
          "question": false,
          "type": {
            "type": "WITH_DEFAULT",
            "typeArgs": [
              {
                "type": "INT",
                "typeArgs": []
              },
              42
            ]
          }
        },
        "newFileld2": {
          "name": "newFileld2",
          "question": false,
          "type": {
            "type": "STRING",
            "typeArgs": []
          }
        },
        "test_big": {
          "name": "test_big",
          "question": false,
          "type": {
            "type": "WITH_DEFAULT",
            "typeArgs": [
              {
                "type": "INT",
                "typeArgs": []
              },
              "42n"
            ]
          }
        },
        "test_string": {
          "name": "test_string",
          "question": false,
          "type": {
            "type": "WITH_DEFAULT",
            "typeArgs": [
              {
                "type": "STRING",
                "typeArgs": []
              },
              "abbb"
            ]
          }
        },
        "test_string2": {
          "name": "test_string2",
          "question": false,
          "type": {
            "type": "WITH_DEFAULT",
            "typeArgs": [
              {
                "type": "STRING",
                "typeArgs": []
              },
              {
                "type": "SQL_EXPR",
                "typeArgs": [
                  "\"abbb\""
                ]
              }
            ]
          }
        },
        "newField": {
          "name": "newField",
          "question": false,
          "type": {
            "type": "INT",
            "typeArgs": []
          }
        },
        "age2": {
          "name": "age2",
          "question": false,
          "type": {
            "type": "FUTURE",
            "typeArgs": [
              {
                "type": "INT",
                "typeArgs": []
              },
              {
                "type": "SQL_EXPR",
                "typeArgs": [
                  "time::now() - birthdate"
                ]
              }
            ]
          }
        },
        "age": {
          "name": "age",
          "question": false,
          "type": {
            "type": "WITH_VALUE",
            "typeArgs": [
              {
                "type": "INT",
                "typeArgs": []
              },
              {
                "type": "FUTURE",
                "typeArgs": [
                  {
                    "type": "INT",
                    "typeArgs": []
                  },
                  {
                    "type": "SQL_EXPR",
                    "typeArgs": [
                      "time::now() - birthdate"
                    ]
                  }
                ]
              }
            ]
          }
        },
        "ustruct3": {
          "name": "ustruct3",
          "question": false,
          "type": {
            "type": "keyword",
            "typeArgs": [
              "Unknown"
            ]
          }
        },
        "email2": {
          "name": "email2",
          "question": false,
          "type": {
            "type": "ASSERT",
            "typeArgs": [
              {
                "type": "STRING",
                "typeArgs": []
              },
              {
                "type": "SQL_EXPR",
                "typeArgs": [
                  "$value != NONE AND is::email($value)"
                ]
              }
            ]
          }
        },
        "unstructered": {
          "name": "unstructered",
          "question": false,
          "type": {
            "type": "WITH_DEFAULT",
            "typeArgs": [
              {
                "type": "keyword",
                "typeArgs": [
                  "Any"
                ]
              },
              {
                "type": "typeLiteral",
                "members": {}
              }
            ]
          }
        },
        "ustruct2": {
          "name": "ustruct2",
          "question": false,
          "type": {
            "type": "keyword",
            "typeArgs": [
              "Any"
            ]
          }
        },
        "bff": {
          "name": "bff",
          "question": false,
          "type": {
            "type": "RECORD",
            "typeArgs": [
              {
                "type": "Person",
                "typeArgs": []
              }
            ]
          }
        },
        "array": {
          "name": "array",
          "question": false,
          "type": {
            "type": "array",
            "typeArgs": [
              {
                "type": "STRING",
                "typeArgs": []
              }
            ]
          }
        },
        "array2": {
          "name": "array2",
          "question": false,
          "type": {
            "type": "Array",
            "typeArgs": [
              {
                "type": "STRING",
                "typeArgs": []
              }
            ]
          }
        },
        "tuple": {
          "name": "tuple",
          "question": false,
          "type": {
            "type": "tuple",
            "typeArgs": [
              {
                "type": "STRING",
                "typeArgs": []
              },
              {
                "type": "STRING",
                "typeArgs": []
              }
            ]
          }
        }
      }
    },
    {
      "name": "Friends",
      "extends": [
        [
          {
            "type": "RELATION",
            "typeArgs": [
              {
                "type": "Person",
                "typeArgs": []
              },
              {
                "type": "Person",
                "typeArgs": []
              }
            ]
          }
        ]
      ],
      "members": {}
    },
    {
      "name": "Couple",
      "type": {
        "type": "RELATION",
        "typeArgs": [
          {
            "type": "Person",
            "typeArgs": []
          },
          {
            "type": "Person",
            "typeArgs": []
          }
        ]
      }
    }
  ],
  "\n"
]
