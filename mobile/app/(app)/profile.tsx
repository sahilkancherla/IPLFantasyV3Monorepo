import { View, Text, TouchableOpacity, Alert, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../stores/authStore'

export default function ProfileScreen() {
  const { logout, deleteAccount, updateProfile } = useAuth()
  const { user } = useAuthStore()

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [saving, setSaving] = useState(false)

  const isDirty =
    fullName !== (user?.full_name ?? '') ||
    displayName !== (user?.display_name ?? '') ||
    email !== (user?.email ?? '')

  const handleSave = async () => {
    if (!isDirty) return
    setSaving(true)
    try {
      await updateProfile({
        fullName: fullName !== user?.full_name ? fullName : undefined,
        displayName: displayName !== user?.display_name ? displayName : undefined,
        email: email !== user?.email ? email : undefined,
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save changes.'
      Alert.alert('Error', msg)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try { await deleteAccount() }
            catch { Alert.alert('Error', 'Failed to delete account. Please try again.') }
          },
        },
      ]
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}
      >
        {/* Avatar */}
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'white', fontSize: 28, fontWeight: '700' }}>
              {((user?.display_name ?? user?.full_name ?? user?.username ?? '?')[0]).toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>@{user?.username}</Text>
        </View>

        {/* Edit fields */}
        <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
          <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />
          <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />
          <Field label="Display Name" value={displayName} onChangeText={setDisplayName} placeholder="Nickname shown in leagues" />
          <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" />
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isDirty || saving}
          style={{
            backgroundColor: isDirty && !saving ? '#111827' : '#e5e7eb',
            borderRadius: 12, paddingVertical: 14, alignItems: 'center',
          }}
        >
          {saving
            ? <ActivityIndicator color="white" />
            : <Text style={{ color: isDirty ? 'white' : '#9ca3af', fontWeight: '700', fontSize: 15 }}>Save Changes</Text>
          }
        </TouchableOpacity>

        {/* Account actions */}
        <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
          <TouchableOpacity
            onPress={handleLogout}
            style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: '#111827', fontSize: 15 }}>Sign Out</Text>
            <Text style={{ color: '#d1d5db', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            style={{ paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: '#ef4444', fontSize: 15 }}>Delete Account</Text>
            <Text style={{ color: '#fca5a5', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize }: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'email-address'
  autoCapitalize?: 'none' | 'sentences' | 'words'
}) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
      <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#d1d5db"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
        style={{ color: '#111827', fontSize: 15, padding: 0 }}
      />
    </View>
  )
}
