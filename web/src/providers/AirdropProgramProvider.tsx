import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Program, AnchorProvider, type Idl } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import idl from './idl.json';
import type { AirdropContract } from './AirdropContractTypes';

// Context type definition
interface AirdropProgramContextType {
  program: Program<AirdropContract> | null;
  isLoading: boolean;
}

// Create the context
const AirdropProgramContext = createContext<AirdropProgramContextType | undefined>(undefined);

// Provider props interface
interface AirdropProgramProviderProps {
  children: ReactNode;
}

// Provider component
export const AirdropProgramProvider: React.FC<AirdropProgramProviderProps> = ({ children }) => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const { program, isLoading } = useMemo(() => {
    if (!wallet || !wallet.publicKey) {
      return { program: null, isLoading: false };
    }

    try {
      const provider = new AnchorProvider(
        connection,
        wallet,
        AnchorProvider.defaultOptions()
      );

      const program = new Program(idl as Idl, provider) as Program<AirdropContract>;
      
      return { program, isLoading: false };
    } catch (error) {
      console.error('Failed to initialize airdrop program:', error);
      return { program: null, isLoading: false };
    }
  }, [connection, wallet]);

  const value: AirdropProgramContextType = {
    program,
    isLoading,
  };

  return (
    <AirdropProgramContext.Provider value={value}>
      {children}
    </AirdropProgramContext.Provider>
  );
};

// Custom hook to use the context
export const useAirdropProgram = (): AirdropProgramContextType => {
  const context = useContext(AirdropProgramContext);
  
  if (context === undefined) {
    throw new Error('useAirdropProgram must be used within an AirdropProgramProvider');
  }
  
  return context;
};
