import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  loadDriverDocuments,
  loadDriverProfile,
  loadPreferences,
  loadAssignedJobs,
  login,
  publishLocation,
  savePreferences,
  sendQuickNote,
  updateJobStatus,
  updatePassword,
  uploadPodDocument,
} from "./src/api";
import { clearSession, loadSession, saveSession, type DriverSession } from "./src/storage";
import type { DriverDocument, DriverJob, DriverPreferences, DriverProfile, DriverTab } from "./src/types";

const STATUS_FLOW = ["on_my_way", "on_site_pickup", "loaded", "in_transit", "on_site_delivery", "delivered"] as const;

export default function App() {
  const [session, setSession] = useState<DriverSession | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [prefs, setPrefs] = useState<DriverPreferences>({ notifyTracked: false, emailNotifications: false });
  const [selectedTab, setSelectedTab] = useState<DriverTab>("today");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [importantNote, setImportantNote] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  useEffect(() => {
    void (async () => {
      const persisted = await loadSession();
      if (persisted) {
        setSession(persisted);
        await refreshAll(persisted, false);
      }
    })();
  }, []);

  async function refreshAll(activeSession: DriverSession, showBusy = true) {
    try {
      if (showBusy) setBusy(true);
      const nextProfile = await loadDriverProfile(activeSession);
      const [nextJobs, nextDocuments, nextPrefs] = await Promise.all([
        loadAssignedJobs(activeSession, nextProfile.driverId),
        loadDriverDocuments(activeSession, nextProfile.driverId),
        loadPreferences(activeSession),
      ]);

      setProfile(nextProfile);
      setJobs(nextJobs);
      setDocuments(nextDocuments);
      setPrefs(nextPrefs);
      if (!selectedJobId && nextJobs.length > 0) setSelectedJobId(nextJobs[0].id);
      if (selectedJobId && !nextJobs.some((job) => job.id === selectedJobId)) setSelectedJobId(nextJobs[0]?.id ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Refresh failed.";
      Alert.alert("Refresh failed", message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    try {
      setBusy(true);
      const nextSession = await login(email.trim(), password);
      await saveSession(nextSession);
      setSession(nextSession);
      await refreshAll(nextSession, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed.";
      Alert.alert("Login failed", message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await clearSession();
    setSession(null);
    setProfile(null);
    setJobs([]);
    setDocuments([]);
    setSelectedJobId(null);
  }

  async function handleQuickNote() {
    if (!session || !selectedJobId || !quickNote.trim()) return;
    try {
      setBusy(true);
      await sendQuickNote(session, selectedJobId, quickNote.trim(), importantNote);
      setQuickNote("");
      setImportantNote(false);
      Alert.alert("Success", "Dispatch note sent.");
    } catch (error) {
      Alert.alert("Quick note failed", error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(nextStatus: string) {
    if (!session || !profile || !selectedJob) return;
    if (nextStatus === "delivered" && selectedJob.podPhotos.length === 0 && selectedJob.deliveryPhotos.length === 0) {
      Alert.alert("POD required", "Upload POD before marking delivery complete.");
      return;
    }

    try {
      setBusy(true);
      await updateJobStatus(session, profile.driverId, selectedJob.id, nextStatus);
      await refreshAll(session, false);
      Alert.alert("Success", `Status moved to ${nextStatus}.`);
    } catch (error) {
      Alert.alert("Status update failed", error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishLocation() {
    if (!session) return;
    try {
      setBusy(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission not granted.");

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await publishLocation(session, current.coords.latitude, current.coords.longitude);
      Alert.alert("Success", "Location published.");
    } catch (error) {
      Alert.alert("Location publish failed", error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadPod() {
    if (!session || !profile || !selectedJob) {
      Alert.alert("Select job", "Select a job before uploading POD.");
      return;
    }

    const picked = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (picked.canceled) return;

    const file = picked.assets[0];
    try {
      setBusy(true);
      await uploadPodDocument(session, profile.driverId, selectedJob, {
        name: file.name,
        mimeType: file.mimeType ?? "application/octet-stream",
        uri: file.uri,
      });
      await refreshAll(session, false);
      Alert.alert("Success", "POD uploaded.");
    } catch (error) {
      Alert.alert("POD upload failed", error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePrefs() {
    if (!session) return;
    try {
      setBusy(true);
      await savePreferences(session, prefs);
      Alert.alert("Saved", "Settings saved.");
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordChange() {
    if (!session || newPassword.length < 8) return;
    try {
      setBusy(true);
      await updatePassword(session, newPassword);
      setNewPassword("");
      Alert.alert("Success", "Password updated.");
    } catch (error) {
      Alert.alert("Password update failed", error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.loginContainer}>
          <Text style={styles.title}>XDrive Driver App</Text>
          <Text style={styles.subtitle}>Native Android (Expo + React Native)</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
          <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={busy || !email || !password}>
            <Text style={styles.primaryText}>{busy ? "Signing in..." : "Sign In"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Driver Dashboard</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.ghostButton} onPress={() => void refreshAll(session)}>
            <Text style={styles.ghostText}>Refresh</Text>
          </Pressable>
          <Pressable style={styles.ghostButton} onPress={handleLogout}>
            <Text style={styles.ghostText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(["today", "jobs", "messages", "documents", "settings"] as DriverTab[]).map((tab) => (
          <Pressable key={tab} style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]} onPress={() => setSelectedTab(tab)}>
            <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>{tab.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {busy ? <ActivityIndicator style={{ marginVertical: 8 }} /> : null}

      <ScrollView contentContainerStyle={styles.content}>
        {(selectedTab === "today" || selectedTab === "jobs") && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Profile</Text>
              <Text>Driver ID: {profile?.driverId ?? "-"}</Text>
              <Text>Company ID: {profile?.companyId ?? "-"}</Text>
              <Pressable style={styles.primaryButton} onPress={handlePublishLocation}>
                <Text style={styles.primaryText}>Publish Current Location</Text>
              </Pressable>
            </View>

            {jobs.map((job) => (
              <Pressable key={job.id} style={[styles.card, selectedJobId === job.id && styles.selectedCard]} onPress={() => setSelectedJobId(job.id)}>
                <Text style={styles.cardTitle}>Job {job.id.slice(0, 8)}</Text>
                <Text>Status: {(job.currentStatus || job.status).toUpperCase()}</Text>
                <Text>Pickup: {job.pickupLocation}</Text>
                <Text>Delivery: {job.deliveryLocation}</Text>
                <Text>POD count: {job.podPhotos.length}</Text>

                <View style={styles.statusGrid}>
                  {STATUS_FLOW.map((next) => (
                    <Pressable key={next} style={styles.smallButton} onPress={() => { setSelectedJobId(job.id); void handleStatusChange(next); }}>
                      <Text style={styles.smallButtonText}>{next}</Text>
                    </Pressable>
                  ))}
                </View>
              </Pressable>
            ))}
          </>
        )}

        {selectedTab === "messages" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick Note to Dispatch</Text>
            <TextInput style={styles.input} value={quickNote} onChangeText={setQuickNote} placeholder="Write a short note" />
            <View style={styles.switchRow}>
              <Text>Important</Text>
              <Switch value={importantNote} onValueChange={setImportantNote} />
            </View>
            <Pressable style={styles.primaryButton} onPress={handleQuickNote} disabled={!quickNote.trim()}>
              <Text style={styles.primaryText}>Send Note</Text>
            </Pressable>
          </View>
        )}

        {selectedTab === "documents" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>POD Upload</Text>
              <Text>Selected job: {selectedJobId ?? "None"}</Text>
              <Pressable style={styles.primaryButton} onPress={handleUploadPod}>
                <Text style={styles.primaryText}>Upload POD</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Driver Documents</Text>
              {documents.length === 0 ? <Text>No documents found.</Text> : null}
              {documents.map((doc) => (
                <View key={doc.id} style={styles.docRow}>
                  <Text style={styles.docType}>{doc.docType || "document"}</Text>
                  <Text>{doc.status || "unknown"}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {selectedTab === "settings" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notifications</Text>
              <View style={styles.switchRow}>
                <Text>Notify when tracked</Text>
                <Switch
                  value={prefs.notifyTracked}
                  onValueChange={(value) => setPrefs((current) => ({ ...current, notifyTracked: value }))}
                />
              </View>
              <View style={styles.switchRow}>
                <Text>Email notifications</Text>
                <Switch
                  value={prefs.emailNotifications}
                  onValueChange={(value) => setPrefs((current) => ({ ...current, emailNotifications: value }))}
                />
              </View>
              <Pressable style={styles.primaryButton} onPress={handleSavePrefs}>
                <Text style={styles.primaryText}>Save Settings</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Security</Text>
              <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" secureTextEntry />
              <Pressable style={styles.primaryButton} onPress={handlePasswordChange} disabled={newPassword.length < 8}>
                <Text style={styles.primaryText}>Update Password</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F2F5FA",
  },
  loginContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#12233D",
  },
  subtitle: {
    color: "#4A607A",
    marginBottom: 12,
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabButton: {
    backgroundColor: "#D7E1EC",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: "#0D63F3",
  },
  tabText: {
    fontSize: 11,
    color: "#204066",
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: "#0D63F3",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C2F49",
  },
  input: {
    borderColor: "#C8D2DF",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: "#0D63F3",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  ghostButton: {
    backgroundColor: "#E3EBF6",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ghostText: {
    color: "#18416D",
    fontWeight: "700",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  smallButton: {
    backgroundColor: "#E7EEF7",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  smallButtonText: {
    color: "#1D3E63",
    fontSize: 11,
    fontWeight: "700",
  },
  docRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D9E2EE",
  },
  docType: {
    fontWeight: "700",
  },
});
