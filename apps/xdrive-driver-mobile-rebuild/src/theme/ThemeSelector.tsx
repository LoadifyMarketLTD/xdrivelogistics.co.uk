import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Pressable, Text, View } from './primitives';
import { useAppTheme, type ThemeMode } from './ThemeProvider';
const choices: Array<{value:ThemeMode;label:string}>=[{value:'auto',label:'Auto'},{value:'day',label:'Day'},{value:'night',label:'Night'}];
export function ThemeSelector() {
  const {mode,setMode}=useAppTheme(); const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  async function choose(next:ThemeMode) {if(saving)return;setSaving(true);setError('');try{await setMode(next);}catch{setError('Appearance could not be saved. Please try again.');}finally{setSaving(false);}}
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.title}>Appearance</Text>
    <Text style={s.hint}>Auto follows your phone's display setting.</Text>
    <View style={s.row}>{choices.map(choice=><Pressable key={choice.value} accessibilityRole="radio" accessibilityLabel={'Theme '+choice.label} accessibilityState={{checked:mode===choice.value,disabled:saving}} disabled={saving} onPress={()=>choose(choice.value)} style={[s.choice,mode===choice.value&&s.selected]}>
      <Text style={[s.label,mode===choice.value&&s.selectedLabel]}>{choice.label}</Text>
    </Pressable>)}</View>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
  </View>;
}
const s=StyleSheet.create({
  card:{marginHorizontal:16,padding:16,gap:9,borderRadius:16,backgroundColor:'#FFFFFF'},
  title:{fontFamily:'Inter_700Bold',fontSize:16,color:'#172033'},
  hint:{fontFamily:'Inter_500Medium',fontSize:12,lineHeight:18,color:'#475569'},
  row:{flexDirection:'row',gap:8},
  choice:{flex:1,minHeight:46,borderRadius:12,backgroundColor:'#F1F3F6',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#CBD5E1'},
  selected:{backgroundColor:'#F5A300',borderColor:'#F5A300'},
  label:{fontFamily:'Inter_600SemiBold',fontSize:14,color:'#475569'},
  selectedLabel:{fontFamily:'Inter_700Bold',color:'#172033'},
  error:{fontSize:12,color:'#B42318'},
});
