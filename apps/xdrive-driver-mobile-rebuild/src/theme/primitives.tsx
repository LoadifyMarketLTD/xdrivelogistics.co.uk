import React, { createContext, forwardRef, useContext } from 'react';
import * as RN from 'react-native';
import { Ionicons as NativeIonicons } from '@expo/vector-icons';
import { useAppTheme } from './ThemeProvider';
import { foregroundColor, surfaceColor } from './palette';

const SurfaceContext=createContext<string|undefined>(undefined);
type AnyStyle=RN.ViewStyle & RN.TextStyle & RN.ImageStyle;
function themedStyle(style: unknown, night:boolean, inherited:string): AnyStyle {
  const result={...(RN.StyleSheet.flatten(style as RN.StyleProp<AnyStyle>)||{})};
  if(result.backgroundColor) result.backgroundColor=surfaceColor(result.backgroundColor,night) as RN.ColorValue;
  const bg=typeof result.backgroundColor==='string'&&result.backgroundColor!=='transparent'?result.backgroundColor:inherited;
  if(result.color) result.color=foregroundColor(result.color,bg,night);
  if(!result.fontWeight && typeof result.fontFamily==='string') {
    if(result.fontFamily.includes('700Bold')) result.fontWeight='700';
    else if(result.fontFamily.includes('600SemiBold')) result.fontWeight='600';
    else if(result.fontFamily.includes('500Medium')) result.fontWeight='500';
  }
  if(night && result.backgroundColor==='#000000' && typeof result.width==='number' && result.width<=32) result.backgroundColor='#CBD5E1';
  for(const key of ['borderColor','borderTopColor','borderBottomColor','borderLeftColor','borderRightColor'] as const) {
    if(night&&result[key]&&typeof result[key]==='string') {
      const v=result[key] as string;
      if(/^#[C-Fc-f][0-9a-fA-F]{5}$/.test(v)) result[key]='#64748B';
      if(v.toUpperCase()==='#000000') result[key]='#CBD5E1';
    }
  }
  return result;
}
function useSurface() {
  const {isDark,palette}=useAppTheme();
  const inherited=useContext(SurfaceContext)||palette.background;
  return {isDark,palette,inherited};
}
function background(style: AnyStyle,parent:string) {
  return typeof style.backgroundColor==='string'&&style.backgroundColor!=='transparent'?style.backgroundColor:parent;
}
export const View=forwardRef<RN.View,RN.ViewProps>(({style,children,...props},ref)=>{
  const {isDark,inherited}=useSurface(); const mapped=themedStyle(style,isDark,inherited);
  return <RN.View {...props} ref={ref} style={mapped}><SurfaceContext.Provider value={background(mapped,inherited)}>{children}</SurfaceContext.Provider></RN.View>;
});
export const SafeAreaView=forwardRef<RN.View,RN.ViewProps>(({style,children,...props},ref)=>{
  const {isDark,inherited}=useSurface(); const mapped=themedStyle(style,isDark,inherited);
  return <RN.SafeAreaView {...props} ref={ref} style={mapped}><SurfaceContext.Provider value={background(mapped,inherited)}>{children}</SurfaceContext.Provider></RN.SafeAreaView>;
});
export const Text=forwardRef<RN.Text,RN.TextProps>(({style,...props},ref)=>{
  const {isDark,inherited}=useSurface(); const mapped=themedStyle(style,isDark,inherited);
  mapped.color=foregroundColor(mapped.color,inherited,isDark);
  return <RN.Text {...props} ref={ref} style={mapped}/>;
});
export const Pressable=forwardRef<RN.View,RN.PressableProps>(({style,children,...props},ref)=>{
  const {isDark,inherited}=useSurface();
  const resolve=(state:RN.PressableStateCallbackType)=>themedStyle(typeof style==='function'?style(state):style,isDark,inherited);
  return <RN.Pressable {...props} ref={ref} style={resolve}>{state=><SurfaceContext.Provider value={background(resolve(state),inherited)}>{typeof children==='function'?children(state):children}</SurfaceContext.Provider>}</RN.Pressable>;
});
export const ScrollView=forwardRef<RN.ScrollView,RN.ScrollViewProps>(({style,contentContainerStyle,children,...props},ref)=>{
  const {isDark,inherited}=useSurface(); const mapped=themedStyle(style,isDark,inherited);
  const content=themedStyle(contentContainerStyle,isDark,background(mapped,inherited));
  return <RN.ScrollView {...props} ref={ref} style={mapped} contentContainerStyle={content}><SurfaceContext.Provider value={background(content,background(mapped,inherited))}>{children}</SurfaceContext.Provider></RN.ScrollView>;
});
export const KeyboardAvoidingView=forwardRef<RN.KeyboardAvoidingView,RN.KeyboardAvoidingViewProps>(({style,children,...props},ref)=>{
  const {isDark,inherited}=useSurface(); const mapped=themedStyle(style,isDark,inherited);
  return <RN.KeyboardAvoidingView {...props} ref={ref} style={mapped}><SurfaceContext.Provider value={background(mapped,inherited)}>{children}</SurfaceContext.Provider></RN.KeyboardAvoidingView>;
});
export const TextInput=forwardRef<RN.TextInput,RN.TextInputProps>(({style,placeholderTextColor,selectionColor,...props},ref)=>{
  const {isDark,inherited,palette}=useSurface(); const mapped=themedStyle(style,isDark,inherited); const bg=background(mapped,inherited);
  mapped.color=foregroundColor(mapped.color,bg,isDark);
  return <RN.TextInput {...props} ref={ref} style={mapped} placeholderTextColor={foregroundColor(placeholderTextColor||palette.muted,bg,isDark)} selectionColor={selectionColor||palette.accent} keyboardAppearance={isDark?'dark':'light'}/>;
});
export function ActivityIndicator({color,...props}:RN.ActivityIndicatorProps) {
  const {isDark,inherited}=useSurface();return <RN.ActivityIndicator {...props} color={foregroundColor(color||'#1D57D8',inherited,isDark)}/>;
}
export function RefreshControl({colors,tintColor,...props}:RN.RefreshControlProps) {
  const {isDark,inherited,palette}=useSurface();
  return <RN.RefreshControl {...props} colors={(colors||[palette.brand]).map(c=>foregroundColor(c,palette.surface,isDark))} tintColor={foregroundColor(tintColor||palette.accent,inherited,isDark)} progressBackgroundColor={palette.surface}/>;
}
export function ThemeIonicons({color,...props}:React.ComponentProps<typeof NativeIonicons>) {
  const {isDark,inherited}=useSurface(); return <NativeIonicons {...props} color={foregroundColor(color,inherited,isDark)}/>;
}

ThemeIonicons.glyphMap = NativeIonicons.glyphMap;
