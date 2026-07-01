/**
 * POD Capture Screen — photo, signature, or document upload.
 * Mandatory before marking delivered when pod_required = true.
 */
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { uploadPod } from '../../../../src/api/client';
import { SignaturePad } from '../../../../src/components/SignaturePad';

type PodType = 'photo' | 'signature' | 'document';

interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

export default function PodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [podType, setPodType] = useState<PodType>('photo');
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureSvg, setSignatureSvg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const resetSelection = useCallback(() => {
    setPickedFile(null);
    setHasSignature(false);
    setSignatureSvg(null);
    setUploaded(false);
  }, []);

  const pickImage = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to capture POD photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri;
      const ext = uri.split('.').pop() ?? 'jpg';
      setPickedFile({
        uri,
        name: `pod_${Date.now()}.${ext}`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      setUploaded(false);
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Photo library access is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri;
      const ext = uri.split('.').pop() ?? 'jpg';
      setPickedFile({
        uri,
        name: `pod_${Date.now()}.${ext}`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      setUploaded(false);
    }
  }, []);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: ['application/pdf', 'image/*'],
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPickedFile({
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? 'application/octet-stream',
    });
    setUploaded(false);
  }, []);

  const createSignatureFile = useCallback(async () => {
    if (!signatureSvg) return null;

    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) {
      throw new Error('Signature storage is not available on this device.');
    }

    const uri = `${baseDir}pod-signature-${Date.now()}.svg`;
    await FileSystem.writeAsStringAsync(uri, signatureSvg, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      uri,
      name: `pod_signature_${Date.now()}.svg`,
      type: 'image/svg+xml',
    } satisfies PickedFile;
  }, [signatureSvg]);

  const handleUpload = useCallback(async () => {
    if (!id) return;
    setUploading(true);
    try {
      const fileToUpload =
        podType === 'signature'
          ? await createSignatureFile()
          : pickedFile;

      if (!fileToUpload) {
        Alert.alert('POD Required', 'Please capture a photo, signature, or document first.');
        return;
      }

      await uploadPod(id, fileToUpload, podType);
      setUploaded(true);
      Alert.alert(
        'POD Uploaded',
        'Proof of delivery captured successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }, [createSignatureFile, id, pickedFile, podType]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Proof of Delivery',
          headerShown: true,
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Upload proof of delivery to complete this job.</Text>

        {/* POD type selector */}
        <View style={styles.typeRow}>
          {(['photo', 'signature', 'document'] as PodType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeButton, podType === t && styles.typeButtonActive]}
              onPress={() => {
                setPodType(t);
                resetSelection();
              }}
            >
              <Text style={[styles.typeButtonText, podType === t && styles.typeButtonTextActive]}>
                {t === 'photo' ? '📸 Photo' : t === 'signature' ? '✍️ Signature' : '📄 Document'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preview */}
        {podType === 'signature' ? (
          <View style={styles.previewContainer}>
            <SignaturePad
              onChange={({ svg, hasSignature: nextHasSignature }) => {
                setSignatureSvg(svg);
                setHasSignature(nextHasSignature);
                setUploaded(false);
              }}
            />
            {hasSignature ? (
              <View style={styles.signatureReadyBanner}>
                <Text style={styles.signatureReadyText}>✅ Signature captured and ready to upload</Text>
              </View>
            ) : null}
          </View>
        ) : pickedFile ? (
          <View style={styles.previewContainer}>
            {pickedFile.type.startsWith('image') ? (
              <Image source={{ uri: pickedFile.uri }} style={styles.preview} resizeMode="cover" />
            ) : (
              <View style={styles.docPreview}>
                <Text style={styles.docIcon}>📄</Text>
                <Text style={styles.docName} numberOfLines={1}>
                  {pickedFile.name}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.clearButton} onPress={resetSelection}>
              <Text style={styles.clearButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : podType === 'document' ? (
          <View style={styles.pickArea}>
            <TouchableOpacity style={styles.pickButton} onPress={pickDocument}>
              <Text style={styles.pickIcon}>📄</Text>
              <Text style={styles.pickLabel}>Choose Document</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pickArea}>
            <TouchableOpacity style={styles.pickButton} onPress={pickImage}>
              <Text style={styles.pickIcon}>📷</Text>
              <Text style={styles.pickLabel}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickButton} onPress={pickFromGallery}>
              <Text style={styles.pickIcon}>🖼️</Text>
              <Text style={styles.pickLabel}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Upload CTA */}
        {((pickedFile && podType !== 'signature') || (podType === 'signature' && hasSignature && signatureSvg)) && !uploaded && (
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.buttonDisabled]}
            onPress={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>Upload POD</Text>
            )}
          </TouchableOpacity>
        )}

        {uploaded && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✅ POD uploaded successfully</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 24, paddingBottom: 60 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 24, lineHeight: 20 },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  typeButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeButtonActive: { borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
  typeButtonText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  typeButtonTextActive: { color: '#3b82f6' },
  pickArea: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  pickButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  pickIcon: { fontSize: 32, marginBottom: 8 },
  pickLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  previewContainer: { marginBottom: 24 },
  preview: { width: '100%', height: 240, borderRadius: 12, marginBottom: 12 },
  docPreview: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  docIcon: { fontSize: 40, marginBottom: 8 },
  docName: { color: '#94a3b8', fontSize: 13 },
  signatureReadyBanner: {
    marginTop: 12,
    backgroundColor: '#22c55e22',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  signatureReadyText: { color: '#86efac', fontWeight: '600', fontSize: 13 },
  clearButton: { alignItems: 'center' },
  clearButtonText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  uploadButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  uploadButtonText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  successBanner: {
    backgroundColor: '#22c55e22',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  successText: { color: '#22c55e', fontWeight: '700', fontSize: 15 },
});
