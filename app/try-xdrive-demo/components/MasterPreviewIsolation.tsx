'use client';
import {createContext,useContext,type ReactNode} from 'react';
const MasterPreviewContext=createContext(false);
export function MasterPreviewIsolation({children}:{children:ReactNode}){
 return <MasterPreviewContext.Provider value={true}>{children}</MasterPreviewContext.Provider>;
}
export function useMasterPreviewIsolation(){return useContext(MasterPreviewContext)}
