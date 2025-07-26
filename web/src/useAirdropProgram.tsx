import { useMemo } from 'react';
import idl from './idl.json';
import { Program, AnchorProvider, type Idl } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import type { AirdropContract } from './AirdropContractTypes';

export function useAirdropProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet || !wallet.publicKey) return null;

    const provider = new AnchorProvider(
      connection,
      wallet,
      AnchorProvider.defaultOptions()
    );

    return new Program(idl as Idl, provider) as Program<AirdropContract>;
  }, [connection, wallet]);
}
