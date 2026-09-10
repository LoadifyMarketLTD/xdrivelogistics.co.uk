import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkPalette, lightPalette, type Palette } from './palette';
export type ThemeMode='auto'|'day'|'night';
type Theme={mode:ThemeMode; isDark:boolean; palette:Palette; setMode:(value:ThemeMode)=>Promise<void>};
const ThemeContext=createContext<Theme|null>(null);
const STORAGE_KEY='xdrive.appearance.v1';
export function ThemeProvider({children}:{children:React.ReactNode}) {
  const system=useColorScheme();
  const [mode,setPreference]=useState<ThemeMode>('auto');
  const [ready,setReady]=useState(false);
  useEffect(()=>{let mounted=true; AsyncStorage.getItem(STORAGE_KEY).then(value=>{
    if(mounted && (value==='auto'||value==='day'||value==='night'))setPreference(value);
  }).catch(()=>undefined).finally(()=>{if(mounted)setReady(true);}); return ()=>{mounted=false;};},[]);
  const isDark=mode==='night'||(mode==='auto'&&system==='dark');
  const palette=isDark?darkPalette:lightPalette;
  const value=useMemo<Theme>(()=>({mode,isDark,palette,setMode:async(next)=>{
    await AsyncStorage.setItem(STORAGE_KEY,next);setPreference(next);
  }}),[mode,isDark,palette]);
  return <ThemeContext.Provider value={value}>{ready?children:<View style={{flex:1,backgroundColor:palette.background,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={palette.accent}/></View>}</ThemeContext.Provider>;
}
export function useAppTheme() {
  const theme=useContext(ThemeContext);
  if(!theme)throw new Error('XDrive ThemeProvider is missing');
  return theme;
}
