import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const API = 'https://www.xdrivelogistics.co.uk';
type Load = { id: string; pickup_area?: string; delivery_area?: string; pickup_datetime?: string; company_name?: string; vehicle_type?: string };
type Tab = 'Alerts' | 'My Quotes' | 'Bookings' | 'More';
const tabs: Tab[] = ['Alerts', 'My Quotes', 'Bookings', 'More'];
export default function App() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [token, setToken] = useState('');
  const [installationId, setInstallationId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<Tab>('Alerts');
  const [loads, setLoads] = useState<Load[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<Load | null>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [collectWithin, setCollectWithin] = useState('ASAP');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const configResponse = await fetch(API + '/api/driver/mobile/config');
        if (!configResponse.ok) throw new Error('Mobile authentication configuration unavailable (' + configResponse.status + ')');
        const config = await configResponse.json();
        const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
        });
        setClient(supabase);
        let id = await AsyncStorage.getItem('xdrive-installation-id');
        if (!id) { id = Crypto.randomUUID(); await AsyncStorage.setItem('xdrive-installation-id', id); }
        setInstallationId(id);
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) setToken(data.session.access_token);
        supabase.auth.onAuthStateChange((_event, session) => setToken(session?.access_token || ''));
      } catch (e) { setError(String(e)); }
    })();
  }, []);
  async function api(path: string, options?: RequestInit) {
    const response = await fetch(API + path, {
      ...options,
      headers: { 'Authorization': 'Bearer ' + token, 'x-xdrive-installation-id': installationId,
        'Content-Type': 'application/json', ...options?.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'HTTP ' + response.status);
    return body;
  }
  async function login() {
    if (!client || !installationId) return;
    setBusy(true); setError('');
    try {
      const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      const response = await fetch(API + '/api/driver/mobile/device-session', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ installation_id: installationId, app_package: 'co.uk.xdrivelogistics.driver', device_label: 'XDrive Android' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { await client.auth.signOut(); throw new Error(result.error || 'Device registration failed'); }
      setToken(data.session.access_token);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function refresh(next: Tab = tab) {
    if (!token || !installationId || next === 'More') return;
    setBusy(true); setError('');
    try {
      if (next === 'Alerts') {
        const result = await api('/api/driver/marketplace/loads');
        setLoads(Array.isArray(result) ? result : result.loads || result.jobs || []);
      } else if (next === 'My Quotes') {
        const result = await api('/api/driver/mobile/bids');
        setQuotes(result.bids || []);
      } else {
        const result = await api('/api/driver/mobile/jobs');
        setJobs(result.jobs || []);
      }
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  useEffect(() => { if (token && installationId) void refresh(tab); }, [token, installationId, tab]);
  async function submitQuote() {
    if (!selected || !Number.isFinite(Number(amount)) || Number(amount) <= 0) { setError('Enter a valid quote amount'); return; }
    setBusy(true); setError('');
    try {
      await api('/api/driver/mobile/bids', { method: 'POST', body: JSON.stringify({
        jobId: selected.id, amount: Number(amount), message,
        collectWithinMinutes: collectWithin === 'ASAP' ? null : Number(collectWithin),
      }) });
      setSelected(null); setAmount(''); setMessage(''); setTab('My Quotes');
      Alert.alert('Quote submitted', 'Your quote was saved to XDrive.');
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  const button = (label: string, onPress: () => void) => <TouchableOpacity onPress={onPress} style={styles.button}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
  if (!client) return <SafeAreaView style={styles.root}><ActivityIndicator /><Text>{error || 'Connecting to XDrive...'}</Text></SafeAreaView>;
  if (!token) return <SafeAreaView style={styles.root}><Text style={styles.title}>XDrive Logistics</Text><Text>Driver sign in</Text><TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/><TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword}/>{button(busy ? 'Signing in...' : 'Sign in', login)}<Text style={styles.error}>{error}</Text></SafeAreaView>;
  return <SafeAreaView style={styles.root}>
    <Text style={styles.title}>XDrive Logistics</Text>
    <View style={styles.nav}>{tabs.map(t => <TouchableOpacity key={t} onPress={() => {setSelected(null);setTab(t);}} style={[styles.tab, tab === t && styles.active]}><Text style={styles.tabText}>{t}</Text></TouchableOpacity>)}</View>
    {busy && <ActivityIndicator />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {selected ? <ScrollView><Text style={styles.heading}>Quote Now</Text><Text>{selected.pickup_area} → {selected.delivery_area}</Text><TextInput style={styles.input} placeholder="Amount GBP" keyboardType="decimal-pad" value={amount} onChangeText={setAmount}/><TextInput style={styles.input} placeholder="Message (optional)" value={message} onChangeText={setMessage}/><Text>Will collect within</Text><View style={styles.nav}>{['ASAP','15','30','45','60','90','120'].map(x=><TouchableOpacity key={x} onPress={()=>setCollectWithin(x)} style={[styles.small,collectWithin===x&&styles.active]}><Text>{x}</Text></TouchableOpacity>)}</View>{button('Submit quote',submitQuote)}{button('Back',()=>setSelected(null))}</ScrollView> :
      tab === 'Alerts' ? <FlatList data={loads} keyExtractor={item=>item.id} refreshing={busy} onRefresh={()=>refresh()} ListEmptyComponent={<Text>No available loads returned.</Text>} renderItem={({item})=><View style={styles.card}><Text style={styles.heading}>{item.company_name || 'Exchange load'}</Text><Text>Collection: {item.pickup_area || 'Not provided'}</Text><Text>Delivery: {item.delivery_area || 'Not provided'}</Text><Text>{item.pickup_datetime || ''}</Text>{button('Quote Now',()=>setSelected(item))}</View>}/> :
      tab === 'My Quotes' ? <FlatList data={quotes} keyExtractor={(item,i)=>String(item.id||i)} onRefresh={()=>refresh()} refreshing={busy} ListEmptyComponent={<Text>No quotes returned.</Text>} renderItem={({item})=><View style={styles.card}><Text style={styles.heading}>£{item.amount} — {item.status}</Text><Text>{item.pickupLocation} → {item.deliveryLocation}</Text></View>}/> :
      tab === 'Bookings' ? <FlatList data={jobs} keyExtractor={(item,i)=>String(item.id||i)} onRefresh={()=>refresh()} refreshing={busy} ListEmptyComponent={<Text>No bookings returned.</Text>} renderItem={({item})=><View style={styles.card}><Text style={styles.heading}>{item.status || 'Booking'}</Text><Text>{item.pickupLocation || item.pickup_location || ''}</Text><Text>{item.deliveryLocation || item.delivery_location || ''}</Text></View>}/> :
      <View>{button('Refresh',()=>refresh('Alerts'))}{button('Sign out',()=>{void client.auth.signOut();setToken('');})}</View>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#f8fafc',padding:14,gap:12},title:{fontSize:23,fontWeight:'800',color:'#0f172a',marginBottom:10},
  nav:{flexDirection:'row',flexWrap:'wrap',gap:5,marginBottom:10},tab:{paddingVertical:11,paddingHorizontal:8,backgroundColor:'#e2e8f0',borderRadius:7},active:{backgroundColor:'#bbf7d0'},tabText:{fontSize:12,fontWeight:'700'},card:{padding:14,backgroundColor:'white',borderRadius:10,marginBottom:10,gap:7,borderWidth:1,borderColor:'#e2e8f0'},heading:{fontSize:16,fontWeight:'700'},input:{backgroundColor:'white',padding:14,borderWidth:1,borderColor:'#cbd5e1',borderRadius:8,marginVertical:6},button:{backgroundColor:'#16a34a',padding:15,borderRadius:8,marginVertical:6,alignItems:'center'},buttonText:{color:'white',fontWeight:'700'},small:{padding:9,backgroundColor:'#e2e8f0',borderRadius:6},error:{color:'#b91c1c',marginVertical:8}
});