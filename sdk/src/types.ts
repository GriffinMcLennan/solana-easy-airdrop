/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/airdrop_contract.json`.
 */
export type AirdropContract = {
  address: "F6fHBUyYyaW14CxjSnJjLck8vMmWew3PbCnt5TMqRdZX";
  metadata: {
    name: "airdropContract";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "claim";
      discriminator: [62, 198, 214, 193, 213, 159, 108, 210];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "authorityTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "authority";
              },
              {
                kind: "account";
                path: "tokenProgram";
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142,
                13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216,
                219, 233, 248, 89
              ];
            };
          };
        },
        {
          name: "merkleRootTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "merkleRoot";
              },
              {
                kind: "account";
                path: "tokenProgram";
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142,
                13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216,
                219, 233, 248, 89
              ];
            };
          };
        },
        {
          name: "mint";
        },
        {
          name: "merkleRoot";
        },
        {
          name: "claimReceipt";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [114, 101, 99, 101, 105, 112, 116];
              },
              {
                kind: "account";
                path: "merkleRoot";
              },
              {
                kind: "account";
                path: "authority";
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        }
      ];
      args: [
        {
          name: "proof";
          type: {
            vec: {
              array: ["u8", 32];
            };
          };
        },
        {
          name: "amount";
          type: "u64";
        },
        {
          name: "leafIndex";
          type: "u32";
        }
      ];
    },
    {
      name: "createAirdrop";
      discriminator: [227, 135, 208, 66, 137, 177, 80, 94];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "authorityTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "authority";
              },
              {
                kind: "account";
                path: "tokenProgram";
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142,
                13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216,
                219, 233, 248, 89
              ];
            };
          };
        },
        {
          name: "merkleRootTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "merkleRoot";
              },
              {
                kind: "account";
                path: "tokenProgram";
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142,
                13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216,
                219, 233, 248, 89
              ];
            };
          };
        },
        {
          name: "mint";
        },
        {
          name: "merkleRoot";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 114, 107, 108, 101, 95, 114, 111, 111, 116];
              },
              {
                kind: "arg";
                path: "merkleRootHash";
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        }
      ];
      args: [
        {
          name: "merkleRootHash";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "amount";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "claimReceipt";
      discriminator: [223, 233, 11, 229, 124, 165, 207, 28];
    },
    {
      name: "merkleRoot";
      discriminator: [30, 240, 94, 145, 74, 59, 138, 185];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "invalidAmount";
      msg: "Invalid amount";
    },
    {
      code: 6001;
      name: "invalidProof";
      msg: "Invalid proof";
    }
  ];
  types: [
    {
      name: "claimReceipt";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "merkleRoot";
      type: {
        kind: "struct";
        fields: [
          {
            name: "hash";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "mint";
            type: "pubkey";
          }
        ];
      };
    }
  ];
};
